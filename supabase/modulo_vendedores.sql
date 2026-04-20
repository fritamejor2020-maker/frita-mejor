-- ==============================================================================
-- 4. MÓDULO OPERATIVO DE VENDEDORES Y LOGÍSTICA
-- ==============================================================================

-- 4.1 Tipos Enum y Extensiones
CREATE TYPE public.point_type AS ENUM ('fija', 'variable', 'local');
CREATE TYPE public.point_status AS ENUM ('active', 'inactive');
CREATE TYPE public.restock_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE public.closing_status AS ENUM ('ok', 'missing', 'surplus');

-- 4.2 Tablas Principales

-- sales_points (Activos Físicos / Triciclos / Locales)
CREATE TABLE public.sales_points (
  id varchar PRIMARY KEY, -- ej: 'T1', 'L1'
  name varchar NOT NULL,
  type public.point_type NOT NULL,
  status public.point_status NOT NULL DEFAULT 'active'
);

-- products (Catálogo Maestro)
CREATE TABLE public.products (
  id serial PRIMARY KEY,
  name varchar NOT NULL,
  price integer NOT NULL -- en COP, sin decimales
);

-- inventory_snapshots (Inventario Móvil y Fijo - SSOT)
CREATE TABLE public.inventory_snapshots (
  point_id varchar REFERENCES public.sales_points(id) ON DELETE CASCADE,
  product_id integer REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (point_id, product_id)
);

-- restock_requests (Asignación de Stock / Peticiones de Surtido)
CREATE TABLE public.restock_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_point_id varchar REFERENCES public.sales_points(id) ON DELETE CASCADE,
  status public.restock_status DEFAULT 'pending',
  items_payload jsonb NOT NULL, -- estructura [{ productId: number, qty: number, name: string }]
  created_at timestamp with time zone DEFAULT now()
);

-- daily_closings (Cuadre de Caja y Auditoría)
CREATE TABLE public.daily_closings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  point_id varchar REFERENCES public.sales_points(id) ON DELETE CASCADE,
  user_id uuid, -- FK al Auth de Supabase si aplica: REFERENCES auth.users(id)
  shift varchar NOT NULL, -- ej: 'AM', 'PM'
  responsible_name varchar NOT NULL,
  theory_sales integer NOT NULL,
  reported_cash integer NOT NULL,
  reported_transfer integer NOT NULL,
  reported_expenses integer NOT NULL,
  expenses_desc text,
  difference integer NOT NULL,
  status public.closing_status NOT NULL,
  inventory_snapshot jsonb NOT NULL, -- Foto del stock remanente al cerrar
  created_at timestamp with time zone DEFAULT now()
);

-- 4.3 Función RPC para Surtido Atómico (commit_restock)
CREATE OR REPLACE FUNCTION public.commit_restock(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request record;
  v_item jsonb;
  v_product_id integer;
  v_qty integer;
BEGIN
  -- Bloquear fila para evitar condiciones de carrera
  SELECT * INTO v_request 
  FROM public.restock_requests 
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restock request not found or is not pending';
  END IF;

  -- Procesar payload y actualizar inventory_snapshots
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_request.items_payload)
  LOOP
    v_product_id := (v_item->>'productId')::integer; 
    v_qty := (v_item->>'qty')::integer;

    INSERT INTO public.inventory_snapshots (point_id, product_id, quantity)
    VALUES (v_request.requester_point_id, v_product_id, v_qty)
    ON CONFLICT (point_id, product_id) DO UPDATE 
    SET quantity = public.inventory_snapshots.quantity + EXCLUDED.quantity;
  END LOOP;

  -- Completar la solicitud
  UPDATE public.restock_requests
  SET status = 'completed'
  WHERE id = p_request_id;
END;
$$;

-- 4.4 Políticas RLS Básicas (Asumiendo que cualquier Auth puede hacer CRUD básico internamente)
ALTER TABLE public.sales_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users on sales_points" ON public.sales_points FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated users on products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated users on inventory_snapshots" ON public.inventory_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated users on restock_requests" ON public.restock_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated users on daily_closings" ON public.daily_closings FOR ALL TO authenticated USING (true) WITH CHECK (true);
