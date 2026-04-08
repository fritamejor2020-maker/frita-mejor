-- ==============================================================================
-- SCHEMA REALTIME: FRITA MEJOR - Offline-First Sync
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ==============================================================================

-- 1. Tabla central de estado sincronizado
CREATE TABLE IF NOT EXISTS public.app_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 2. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_app_state_updated_at ON public.app_state;
CREATE TRIGGER set_app_state_updated_at
  BEFORE UPDATE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS — Acceso abierto (la app controla auth por su propio sistema)
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura global app_state" ON public.app_state;
DROP POLICY IF EXISTS "Escritura global app_state" ON public.app_state;
DROP POLICY IF EXISTS "Upsert global app_state" ON public.app_state;

CREATE POLICY "Lectura global app_state"  ON public.app_state FOR SELECT USING (true);
CREATE POLICY "Escritura global app_state" ON public.app_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Upsert global app_state"   ON public.app_state FOR UPDATE USING (true);

-- 4. Habilitar Realtime en la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;

-- 5. Seed inicial con todas las keys vacías (evita errores de "not found")
INSERT INTO public.app_state (key, value) VALUES
  ('warehouses',       '[]'::jsonb),
  ('inventory',        '[]'::jsonb),
  ('movements',        '[]'::jsonb),
  ('products',         '[]'::jsonb),
  ('recipes',          '[]'::jsonb),
  ('fritadoRecipes',   '[]'::jsonb),
  ('posCategories',    '[]'::jsonb),
  ('posSettings',      '{}'::jsonb),
  ('posShifts',        '[]'::jsonb),
  ('posSales',         '[]'::jsonb),
  ('posExpenses',      '[]'::jsonb),
  ('customers',        '[]'::jsonb),
  ('customerTypes',    '[]'::jsonb),
  ('loadTemplates',    '[]'::jsonb),
  ('vehicles',         '[]'::jsonb),
  ('suppliers',        '[]'::jsonb),
  ('pendingRequests',  '[]'::jsonb),
  ('loadHistory',      '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
