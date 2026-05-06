-- =============================================================================
-- ERROR LOGS — Tabla para registrar errores de la app en campo
-- Ejecutar este SQL en el editor de Supabase:
-- https://supabase.com/dashboard/project/uevcotmnffftoelscjua/sql/new
-- =============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'error',          -- 'crash', 'error', 'unhandled_rejection', 'manual'
  message     TEXT NOT NULL,                          -- Mensaje de error
  stack       TEXT,                                   -- Stack trace
  component_stack TEXT,                               -- React component stack (solo para crashes)
  url         TEXT,                                   -- URL donde ocurrió
  user_info   JSONB,                                  -- { id, name, role, branchId }
  device_info JSONB,                                  -- { userAgent, platform, screenSize, ... }
  app_version TEXT,                                   -- Versión de la app (ej: "1.0.0-beta.1")
  extra       TEXT,                                   -- Info adicional en JSON
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs (type);
CREATE INDEX IF NOT EXISTS idx_error_logs_version ON error_logs (app_version);

-- RLS: permitir INSERT desde el rol anon (la app no usa auth de Supabase)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede insertar errores
CREATE POLICY "anon_insert_errors" ON error_logs
  FOR INSERT TO anon
  WITH CHECK (true);

-- Política: cualquiera puede leer errores (para el Admin en futuro)
CREATE POLICY "anon_select_errors" ON error_logs
  FOR SELECT TO anon
  USING (true);

-- =============================================================================
-- VERIFICACIÓN: después de ejecutar, deberías ver la tabla en Table Editor.
-- Para consultar errores recientes:
--   SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50;
-- =============================================================================
