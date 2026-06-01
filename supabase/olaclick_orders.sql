-- ==============================================================================
-- MÓDULO INTEGRACIÓN OLACLICK (Socios de Pedidos)
-- ==============================================================================

-- Crear tabla para almacenar los pedidos recibidos por Webhook de OlaClick
CREATE TABLE IF NOT EXISTS public.olaclick_orders (
  id varchar PRIMARY KEY, -- ID del pedido de OlaClick (ej: '1234567')
  customer_name varchar NOT NULL,
  customer_phone varchar,
  delivery_address text,
  items jsonb NOT NULL, -- Formato: [{ productId: string, name: string, price: number, qty: number, note: string }]
  total_amount integer NOT NULL, -- En COP, sin decimales
  payment_method varchar, -- EFECTIVO, ONLINE, TRANSFERENCIA, etc.
  status varchar NOT NULL DEFAULT 'PENDING', -- PENDING (Pendiente), ACCEPTED (Aceptado), REJECTED (Rechazado)
  rejection_reason text, -- Motivo por el cual se rechaza el pedido
  store_id varchar, -- ID de sede que OlaClick asigna si aplica
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.olaclick_orders ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
-- 1. Permitir que cualquier usuario autenticado (Cajeros, Admins) realice CRUD completo
DROP POLICY IF EXISTS "Allow all authenticated users on olaclick_orders" ON public.olaclick_orders;
CREATE POLICY "Allow all authenticated users on olaclick_orders" 
  ON public.olaclick_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Permitir inserciones públicas y lecturas básicas para el rol anon (Edge Function de Supabase)
DROP POLICY IF EXISTS "Allow anonymous inserts on olaclick_orders" ON public.olaclick_orders;
CREATE POLICY "Allow anonymous inserts on olaclick_orders" 
  ON public.olaclick_orders FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous selects on olaclick_orders" ON public.olaclick_orders;
CREATE POLICY "Allow anonymous selects on olaclick_orders" 
  ON public.olaclick_orders FOR SELECT TO anon USING (true);

-- Agregar la tabla a la publicación de Realtime si es necesario
-- (Habitualmente se configura en Supabase Dashboard o schema_realtime.sql)
ALTER TABLE public.olaclick_orders REPLICA IDENTITY FULL;
