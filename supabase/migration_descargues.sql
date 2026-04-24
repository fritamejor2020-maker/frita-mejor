-- ==============================================================================
-- MIGRACIÓN: Columnas para sistema de Descargues de Efectivo
-- Fecha: 2026-04-24
-- Descripción:
--   Agrega soporte para el sistema de descargues (retiros parciales de caja)
--   en la tabla 'incomes'. Los descargues son retiros de efectivo durante un
--   turno para minimizar el riesgo de robo.
--
-- INSTRUCCIONES:
--   1. Ir a tu proyecto en supabase.com
--   2. Ir a "SQL Editor" en el menú izquierdo
--   3. Pegar y ejecutar este archivo completo
-- ==============================================================================

-- Agregar columna 'subtipo':
--   Indica si es un descargue específico ('Descargue 1', 'Descargue 2', ...)
--   o el cierre final del turno ('Cierre Final').
--   NULL = ingreso normal sin descargues.
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS subtipo text DEFAULT NULL;

-- Índice para consultas rápidas por subtipo y fecha
-- (útil para el panel admin y para calcular el siguiente número de descargue)
CREATE INDEX IF NOT EXISTS idx_incomes_subtipo
  ON public.incomes (ubicacion, jornada, tipo, subtipo)
  WHERE subtipo IS NOT NULL;

-- ==============================================================================
-- VERIFICACIÓN: Ejecuta esto para confirmar que las columnas se crearon bien
-- ==============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'incomes'
--   AND column_name IN ('subtipo')
-- ORDER BY column_name;
