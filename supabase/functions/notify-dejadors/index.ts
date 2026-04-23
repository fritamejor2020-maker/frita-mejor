// ============================================================
// Supabase Edge Function: notify-dejadors
// Se llama via HTTP POST cuando un Vendedor envía un pedido.
// Envía Web Push a todos los Dejadores con turno abierto.
// ============================================================
// Deploy:
//   supabase functions deploy notify-dejadors --no-verify-jwt
//
// Variables de entorno requeridas (en Supabase Dashboard → Edge Functions → Secrets):
//   VAPID_PRIVATE_KEY    → clave privada VAPID generada con web-push
//   VAPID_PUBLIC_KEY     → clave pública VAPID
//   VAPID_SUBJECT        → mailto:tu@email.com  o  https://tu-dominio.com
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Configurar web-push con las claves VAPID ──────────────
    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@fritamejor.com';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('Faltan variables de entorno VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // ── Leer el body del request ──────────────────────────────
    const body = await req.json();
    const {
      pointId    = '',
      items      = '',
      requestId  = '',
      body: msgBody = 'Un vendedor necesita surtido',
    } = body;

    // ── Obtener todas las suscripciones activas de Dejadores ──
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    );

    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No hay Dejadores suscritos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Payload de la notificación ────────────────────────────
    const payload = JSON.stringify({
      title:     `🛵 Pedido de ${pointId || 'un vendedor'}`,
      body:      msgBody,
      pointId,
      items,
      requestId,
    });

    // ── Enviar push a cada Dejador suscrito ───────────────────
    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth:   sub.auth,
            },
          },
          payload,
          { TTL: 60 }  // expira en 60s si el dispositivo no está disponible
        )
      )
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Limpiar suscripciones inválidas (endpoint expirado / 410 Gone)
    const expired: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = (result as PromiseRejectedResult).reason;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expired.push(subscriptions[i].endpoint);
        }
      }
    });
    if (expired.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired);
    }

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[notify-dejadors]', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
