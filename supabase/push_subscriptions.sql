-- ============================================================
-- push_subscriptions — Tabla para Web Push Notifications
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_opened_at  text NOT NULL,   -- identifica la jornada activa del Dejador
  endpoint         text NOT NULL UNIQUE,
  p256dh           text NOT NULL,
  auth             text NOT NULL,
  created_at       timestamptz DEFAULT now()
);

-- Solo el service_role puede insertar/eliminar (la Edge Function usa service_role)
-- El anon key solo puede insertar sus propias suscripciones
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede insertar su propia suscripción
CREATE POLICY "insert_own_subscription" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Política: solo service_role puede leer todas (la Edge Function)
CREATE POLICY "service_read_all" ON push_subscriptions
  FOR SELECT USING (auth.role() = 'service_role');

-- Política: solo el propio endpoint puede eliminarse (al desuscribirse)
CREATE POLICY "delete_own_subscription" ON push_subscriptions
  FOR DELETE USING (true);
