-- ==============================================================================
-- SCHEMA DINÁMICO: FRITA MEJOR PWA (Fase 2)
-- Objetivo: Soportar gestión dinámica de Bodegas, Producción y Recetas (CRUD Admin)
-- ==============================================================================

-- 1. EXTENSIONES Y CONFIGURACIÓN
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLAS MAESTRAS (Catálogos editables por el Admin)

-- 2.1 Tabla de Insumos/Ingredientes (Lo que se compra)
CREATE TABLE public.insumos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  unidad_medida text NOT NULL DEFAULT 'kg', -- kg, g, lb, und
  stock_minimo numeric(10,3) DEFAULT 0,
  es_activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2.2 Tabla de Bodegas (Múltiples ubicaciones)
CREATE TABLE public.bodegas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('PRINCIPAL', 'SECUNDARIA', 'CUARTO_FRIO')),
  es_activa boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2.3 Inventario Físico (Tabla Pivot: Insumo <-> Bodega)
-- Guarda la cantidad actual de cada insumo en cada bodega (y opcionalmente el lote)
CREATE TABLE public.inventario (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE CASCADE,
  bodega_id uuid REFERENCES public.bodegas(id) ON DELETE CASCADE,
  cantidad_actual numeric(10,3) DEFAULT 0,
  lote text,
  fecha_vencimiento date,
  last_updated timestamp with time zone DEFAULT now(),
  UNIQUE(insumo_id, bodega_id, lote) -- Un insumo puede tener varios lotes distintos en una misma bodega
);

-- 2.4 Tabla de Productos Finales (Lo que se vende/produce en Planta)
CREATE TABLE public.productos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  rendimiento_base text NOT NULL, -- ej: '1 kg', '50 und'
  unidad_produccion text NOT NULL DEFAULT 'kg',
  stock_minimo numeric(10,3) DEFAULT 0,
  es_activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2.5 Recetas (Fórmula o Escandallo, Pivot: Producto <-> Insumo)
-- Esta tabla dice cuánto de cada insumo se necesita para fabricar el "Rendimiento Base" del Producto.
CREATE TABLE public.recetas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  producto_id uuid REFERENCES public.productos(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad_necesaria numeric(10,3) NOT NULL, -- Cantidad requerida del insumo
  unidad_esquema text NOT NULL, -- La unidad en la que está la receta (ej: 'g', 'kg')
  UNIQUE(producto_id, insumo_id)
);

-- ==============================================================================
-- 3. POLÍTICAS RLS (Row Level Security) - Seguridad a nivel de roles
-- ==============================================================================

-- Activamos RLS para restringir acceso
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;

-- Políticas de LECTURA (Todos los usuarios autenticados pueden leer)
CREATE POLICY "Lectura global insumos" ON public.insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura global bodegas" ON public.bodegas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura global inventario" ON public.inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura global productos" ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura global recetas" ON public.recetas FOR SELECT TO authenticated USING (true);

-- Nota: Las políticas de INSERCIÓN/ACTUALIZACIÓN se configurarán luego
-- para asegurar que solo los usuarios de la tabla 'usuarios_roles' con rol ADMIN 
-- puedan alterar catálogos, y los Operarios/Bodegueros solo modifiquen el inventario.

-- ==============================================================================
-- 4. MÓDULO OPERATIVO DE VENDEDORES Y LOGÍSTICA
-- ==============================================================================

-- 4.1 Tipos Enum
CREATE TYPE public.restock_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE public.closing_status AS ENUM ('ok', 'missing', 'surplus');

-- 4.2 Tabla de Solicitudes de Surtido (Vendedor -> Logística)
CREATE TABLE public.restock_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_point_id uuid REFERENCES public.bodegas(id) ON DELETE CASCADE, 
  items_payload jsonb NOT NULL, 
  status public.restock_status DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- 4.3 Snapshots de Inventario (Foto al cierre del turno)
CREATE TABLE public.inventory_snapshots (
  point_id uuid REFERENCES public.bodegas(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.productos(id) ON DELETE CASCADE,
  qty numeric(10,3) DEFAULT 0,
  inventory_snapshot jsonb, -- Foto del stock remanente al cerrar: [{insumo_id/producto_id, qty}]
  last_updated timestamp with time zone DEFAULT now(),
  PRIMARY KEY (point_id, product_id)
);

-- 4.4 Tabla de Cierres Diarios
CREATE TABLE public.daily_closings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  point_id uuid REFERENCES public.bodegas(id) ON DELETE CASCADE,
  theory_sale numeric(10,2) NOT NULL,
  cash numeric(10,2) NOT NULL,
  transfer numeric(10,2) NOT NULL,
  expenses numeric(10,2) NOT NULL,
  difference numeric(10,2) NOT NULL,
  status public.closing_status NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 4.5 Función RPC para Completar Surtido Atómicamente
CREATE OR REPLACE FUNCTION public.commit_restock(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request record;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
BEGIN
  -- 1. Obtener y bloquear la fila de la solicitud
  SELECT * INTO v_request 
  FROM public.restock_requests 
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restock request not found or is not pending';
  END IF;

  -- 2. Procesar el payload y actualizar el inventario del punto solicitante en inventory_snapshots
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_request.items_payload)
  LOOP
    v_product_id := (v_item->>'id')::uuid; 
    v_qty := (v_item->>'qty')::numeric;

    -- Actualizar o insertar (UPSERT)
    INSERT INTO public.inventory_snapshots (point_id, product_id, qty, last_updated)
    VALUES (v_request.requester_point_id, v_product_id, v_qty, now())
    ON CONFLICT (point_id, product_id) DO UPDATE 
    SET qty = public.inventory_snapshots.qty + EXCLUDED.qty,
        last_updated = now();
        
  END LOOP;

  -- 3. Marcar solicitud como completada
  UPDATE public.restock_requests
  SET status = 'completed', completed_at = now()
  WHERE id = p_request_id;

END;
$$;
