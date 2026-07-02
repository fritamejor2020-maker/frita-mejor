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

    // Identificar el evento (OlaClick envía 'ORDER_CREATED', 'ORDER_UPDATED', etc.)
    const eventType = body.event_type || body.event || body.type || 'ORDER_CREATED';
    
    // OlaClick envuelve los datos del pedido en `data`
    const orderRaw = body.data || body;

    // Normalizar los campos principales de forma robusta
    const orderId = String(orderRaw.id || `OLA-${Date.now()}`);
    const publicId = orderRaw.public_id || '';
    const customerName = orderRaw.client?.name || 'Cliente OlaClick';
    const customerPhone = orderRaw.client?.phone || '';
    // Construir dirección desde address.area + address.city
    const addressArea = orderRaw.address?.area || '';
    const addressCity = orderRaw.address?.city || '';
    const deliveryAddress = [addressArea, addressCity].filter(Boolean).join(', ') || '';
    // El total de OlaClick viene en COP (pesos colombianos), NO en centavos
    const totalAmount = Math.round(Number(orderRaw.total || 0));
    const deliveryPrice = Math.round(Number(orderRaw.delivery_price || 0));
    const serviceType = orderRaw.service_type || 'DELIVERY';
    const paymentMethod = orderRaw.service_type || 'No especificado';
    const storeId = String(body.merchant_id || orderRaw.store_id || '');

    // Normalizar los ítems del pedido (OlaClick usa "combos")
    const rawItems = orderRaw.combos || orderRaw.items || [];
    const normalizedItems = Array.isArray(rawItems)
      ? rawItems.map((item: any) => {
          const name = String(item.product_name || item.name || 'Producto');
          const qty = Math.max(1, Number(item.quantity || item.qty || 1));
          const price = Math.round(Number(item.combo_price || item.variant_price || item.price || 0));
          const note = String(item.comment || item.note || '');

          return {
            productId: String(item.product_id || item.productId || item.id || ''),
            product_id: String(item.product_id || item.productId || item.id || ''),
            name: name,
            product_name: name,
            qty: qty,
            quantity: qty,
            price: price,
            combo_price: price,
            variant_price: Math.round(Number(item.variant_price || price)),
            note: note,
            comment: note,
            sku: item.sku || null,
            category: item.product_category_name || '',
            modifiers: item.modifiers || [],
            variantName: item.variant_name || null,
          };
        })
      : [];

    // ── 3. Inicializar Cliente Supabase (Service Role para bypass de RLS si es necesario) ──
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    );

    // ── 4. Procesar el Evento ─────────────────────────────────
    if (eventType === 'ORDER_DELETED' || eventType === 'order_deleted') {
      // Si el pedido se elimina, lo marcamos como CANCELADO
      console.log(`[olaclick-webhook] Pedido eliminado: ${orderId}`);
      const { error } = await supabaseAdmin
        .from('olaclick_orders')
        .update({ status: 'REJECTED', rejection_reason: 'Eliminado desde OlaClick', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
    } else {
      // Para ORDER_CREATED o ORDER_UPDATED, hacemos un UPSERT
      // Mapear estados de OlaClick a estados locales de Frita Mejor:
      //   PENDING → PENDING, PREPARING → ACCEPTED, COMPLETED → ACCEPTED,
      //   CANCELLED → REJECTED, REJECTED → REJECTED
      const orderStatusRaw = String(orderRaw.status || '').toUpperCase();
      let localStatus = 'PENDING';
      
      if (orderStatusRaw === 'CANCELLED' || orderStatusRaw === 'REJECTED') {
        localStatus = 'REJECTED';
      } else if (orderStatusRaw === 'PREPARING' || orderStatusRaw === 'COMPLETED' || orderStatusRaw === 'CONFIRMED' || orderStatusRaw === 'ACCEPTED') {
        localStatus = 'ACCEPTED';
      }

      console.log(`[olaclick-webhook] Upsert del pedido ${orderId} (${publicId}). Estado OlaClick: ${orderStatusRaw} → Local: ${localStatus}`);

      const orderData = {
        id: orderId,
        public_id: publicId,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        items: normalizedItems,
        total_amount: totalAmount,
        delivery_price: deliveryPrice,
        service_type: serviceType,
        payment_method: paymentMethod,
        store_id: storeId,
        status: localStatus,
        raw_payload: body,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('olaclick_orders')
        .upsert(orderData, { onConflict: 'id' });

      if (error) throw error;
    }

    // ── 5. Retornar Respuesta HTTP 200 OK (Sync Acknowledged) ──
    return new Response(
      JSON.stringify({ success: true, orderId, publicId }),
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
