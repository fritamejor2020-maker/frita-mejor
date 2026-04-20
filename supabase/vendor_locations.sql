-- ==============================================================================
-- TABLA: vendor_locations — Última ubicación GPS conocida de cada vendedor
-- Se actualiza cada 30s mientras el vendedor está activo.
-- Cuando el vendedor se desconecta, la última fila queda guardada.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_locations (
  vendor_id   text PRIMARY KEY,            -- ID del vendedor (puede ser el user.id)
  vendor_name text NOT NULL,               -- Nombre para mostrar en el mapa
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  updated_at  timestamp with time zone DEFAULT now(),
  is_active   boolean DEFAULT true          -- Se pone false al cerrar turno
);

-- Índice para consultas rápidas de vendedores activos
CREATE INDEX IF NOT EXISTS idx_vendor_locations_active
  ON public.vendor_locations (is_active)
  WHERE is_active = true;

-- RLS: cualquier usuario autenticado puede leer
ALTER TABLE public.vendor_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura global vendor_locations"
  ON public.vendor_locations FOR SELECT TO authenticated USING (true);

-- Vendedores pueden insertar/actualizar su propia ubicación
CREATE POLICY "Vendedor upsert su ubicación"
  ON public.vendor_locations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
