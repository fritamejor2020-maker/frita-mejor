// ============================================================
// Supabase Edge Function: olaclick-webhook
// Recibe notificaciones de pedidos en tiempo real desde OlaClick.
// Inserta/actualiza los pedidos en la tabla `olaclick_orders`.
// ============================================================
// Deploy:
//   supabase functions deploy olaclick-webhook --no-verify-jwt
//
// Opcional - Variables de entorno en Supabase:
//   OLACLICK_WEBHOOK_SECRET  → token secreto para validar x-api-key en el header
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const method = req.method;
    if (method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Solo se permiten peticiones POST' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Validar Token de Autenticación (x-api-key) ─────────
    const webhookSecret = Deno.env.get('OLACLICK_WEBHOOK_SECRET') ?? '';
    if (webhookSecret) {
      const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('Authorization') || '';
      const cleanHeader = apiKeyHeader.replace('Bearer ', '').trim();
      
      if (cleanHeader !== webhookSecret) {
        console.warn('[olaclick-webhook] Intento de acceso no autorizado');
        return new Response(
          JSON.stringify({ error: 'No autorizado: x-api-key inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── 2. Parsear y Normalizar el Payload ────────────────────
    const body = await req.json();
    console.log('[olaclick-webhook] Payload recibido:', JSON.stringify(body, null, 2));

    // Identificar el evento (OlaClick envía 'order_created', 'order_updated', 'order_deleted')
    const eventType = body.event || body.event_type || body.type || 'order_created';
    
    // OlaClick envuelve los datos del pedido en `order` u `order_data` o directamente en la raíz
    const orderRaw = body.order || body.order_data || body.data || body;

    // Normalizar los campos principales de forma robusta
    const orderId = String(orderRaw.order_id || orderRaw.id || orderRaw.number || `OLA-${Date.now()}`);
    const customerName = orderRaw.customer_name || orderRaw.customer?.name || 'Cliente OlaClick';
    const customerPhone = orderRaw.customer_phone || orderRaw.customer?.phone || '';
    const deliveryAddress = orderRaw.delivery_address || orderRaw.customer?.address || '';
    const totalAmount = Math.round(Number(orderRaw.total_amount || orderRaw.total || 0));
    const paymentMethod = orderRaw.payment_method || orderRaw.payment || 'No especificado';
    const storeId = String(orderRaw.store_id || orderRaw.store?.id || '');

    // Normalizar los ítems del pedido
    const rawItems = orderRaw.items || orderRaw.products || [];
    const normalizedItems = Array.isArray(rawItems)
      ? rawItems.map((item: any) => ({
          productId: String(item.productId || item.product_id || item.id || ''),
          name: String(item.name || item.product_name || 'Producto'),
          price: Math.round(Number(item.price || 0)),
          qty: Math.max(1, Number(item.qty || item.quantity || 1)),
          note: String(item.note || item.comment || item.description || ''),
        }))
      : [];

    // ── 3. Inicializar Cliente Supabase (Service Role para bypass de RLS si es necesario) ──
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    );

    // ── 4. Procesar el Evento ─────────────────────────────────
    if (eventType === 'order_deleted') {
      // Si el pedido se elimina, lo marcamos como CANCELADO
      console.log(`[olaclick-webhook] Pedido eliminado: ${orderId}`);
      const { error } = await supabaseAdmin
        .from('olaclick_orders')
        .update({ status: 'REJECTED', rejection_reason: 'Eliminado desde OlaClick', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
    } else {
      // Para order_created o order_updated, hacemos un UPSERT
      // Si el status general de OlaClick es CANCELLED, lo mapeamos a REJECTED en Frita Mejor
      const orderStatusRaw = String(orderRaw.status || '').toUpperCase();
      let localStatus = 'PENDING';
      
      if (orderStatusRaw === 'CANCELLED' || orderStatusRaw === 'REJECTED') {
        localStatus = 'REJECTED';
      } else if (orderStatusRaw === 'CONFIRMED' || orderStatusRaw === 'ACCEPTED') {
        localStatus = 'ACCEPTED';
      }

      console.log(`[olaclick-webhook] Upsert del pedido ${orderId}. Estado: ${localStatus}`);

      const orderData = {
        id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        items: normalizedItems,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        store_id: storeId,
        status: localStatus,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('olaclick_orders')
        .upsert(orderData, { onConflict: 'id' });

      if (error) throw error;
    }

    // ── 5. Retornar Respuesta HTTP 200 OK (Sync Acknowledged) ──
    return new Response(
      JSON.stringify({ success: true, orderId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[olaclick-webhook] Error de procesamiento:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
