-- ==============================================================================
-- MIGRACIÓN: Pedidos Móviles (delivery_requests) y Zonas de Cobertura (geofences)
-- ==============================================================================

-- 1. Tabla de Geocercas (Zonas de Servicio)
CREATE TABLE IF NOT EXISTS public.geofences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  coordinates jsonb NOT NULL,          -- Array de puntos: [{"lat": 1.23, "lng": 4.56}, ...]
  is_active   boolean DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Tabla de Pedidos en Vivo (Rappi-style)
CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name        text NOT NULL,
  client_phone       text NOT NULL,
  client_address     text,
  client_lat         double precision NOT NULL,
  client_lng         double precision NOT NULL,
  items              jsonb NOT NULL,        -- Array: [{"productId": 1, "qty": 2, "name": "Frito", "price": 4000}]
  total_amount       integer NOT NULL,      -- Monto total en COP
  status             text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  assigned_vendor_id text,                  -- ID del vendedor (de la tabla vendor_locations)
  client_token       uuid NOT NULL,         -- Token secreto en localStorage del cliente para tracking seguro
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  accepted_at        timestamp with time zone,
  completed_at       timestamp with time zone
);

-- Indexación de alta velocidad para Realtime y Consultas Operativas
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON public.delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_assigned_vendor ON public.delivery_requests(assigned_vendor_id);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON public.geofences(is_active);

-- ==============================================================================
-- CAPA DE SEGURIDAD 1: Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

-- Políticas para public.geofences:
-- - Lectura pública para cualquier cliente (anon) o vendedor
CREATE POLICY "Lectura global de geocercas activas"
  ON public.geofences FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- - Operaciones de administración (solo usuarios autenticados)
CREATE POLICY "Admin CRUD geocercas"
  ON public.geofences FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Políticas para public.delivery_requests:
-- - Clientes públicos (anon) solo pueden INSERTAR pedidos, NO leerlos directamente
CREATE POLICY "Anon inserta pedidos"
  ON public.delivery_requests FOR INSERT TO anon
  WITH CHECK (true);

-- - Vendedores y Admins (usuarios autenticados) pueden leer y modificar cualquier pedido
CREATE POLICY "Vendedores y admins CRUD pedidos"
  ON public.delivery_requests FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Políticas adicionales en vendor_locations (para permitir que anon lea repartidores activos)
CREATE POLICY "Anon lee vendedores activos en el mapa"
  ON public.vendor_locations FOR SELECT TO anon
  USING (is_active = true);

-- Permitir que usuarios anónimos (clientes) lean puntos de venta, productos e inventario
CREATE POLICY "Anon lee puntos de venta activos" ON public.sales_points FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "Anon lee productos" ON public.products FOR SELECT TO anon USING (true);
CREATE POLICY "Anon lee instantaneas de inventario" ON public.inventory_snapshots FOR SELECT TO anon USING (true);

-- ==============================================================================
-- CAPA DE SEGURIDAD 2: RPC Seguro para Seguimiento (Anti-Scraping)
-- ==============================================================================

-- Función segura que solo expone un pedido específico si se conoce su UUID y su token secreto de cliente
CREATE OR REPLACE FUNCTION public.get_active_delivery_request(p_order_id uuid, p_client_token uuid)
RETURNS TABLE (
  id                 uuid,
  client_name        text,
  client_phone       text,
  client_address     text,
  client_lat         double precision,
  client_lng         double precision,
  items              jsonb,
  total_amount       integer,
  status             text,
  assigned_vendor_id text,
  created_at         timestamp with time zone,
  accepted_at        timestamp with time zone,
  completed_at       timestamp with time zone,
  vendor_name        text,
  vendor_lat         double precision,
  vendor_lng         double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.client_name,
    d.client_phone,
    d.client_address,
    d.client_lat,
    d.client_lng,
    d.items,
    d.total_amount,
    d.status,
    d.assigned_vendor_id,
    d.created_at,
    d.accepted_at,
    d.completed_at,
    v.vendor_name,
    v.lat as vendor_lat,
    v.lng as vendor_lng
  FROM public.delivery_requests d
  LEFT JOIN public.vendor_locations v ON d.assigned_vendor_id = v.vendor_id
  WHERE d.id = p_order_id AND d.client_token = p_client_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- CAPA DE SEGURIDAD 3: Trigger Postgres de Prevención de Spam
-- ==============================================================================

-- Función disparadora para validar restricciones antes de insertar un pedido
CREATE OR REPLACE FUNCTION public.check_active_delivery_request()
RETURNS trigger AS $$
BEGIN
  -- Validar formato del número telefónico (entre 7 y 15 dígitos numéricos)
  IF NOT NEW.client_phone ~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'El número de teléfono móvil ingresado no es válido (debe tener entre 7 y 15 dígitos numéricos).';
  END IF;

  -- Bloquear inserción si ya existe un pedido activo para el mismo número telefónico
  IF EXISTS (
    SELECT 1 FROM public.delivery_requests
    WHERE client_phone = NEW.client_phone
      AND status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'Ya existe un pedido de entrega activo y en curso para este número de teléfono.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_active_delivery_request
BEFORE INSERT ON public.delivery_requests
FOR EACH ROW
EXECUTE FUNCTION public.check_active_delivery_request();

-- ==============================================================================
-- CAPA DE INTEGRACIÓN: Descuento Automático de Stock al Entregar
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.decrement_stock_on_delivery_completion()
RETURNS trigger AS $$
DECLARE
  v_item jsonb;
  v_product_id integer;
  v_qty integer;
  v_point_id text;
BEGIN
  -- Si el estado cambia a completed, descontar stock del sales_point del vendedor
  IF NEW.status = 'completed' AND OLD.status = 'accepted' THEN
    -- Obtener el point_id (T1, T2...) asociado al vendor_id
    SELECT point_id INTO v_point_id
    FROM public.vendor_locations
    WHERE vendor_id = NEW.assigned_vendor_id;

    IF v_point_id IS NOT NULL THEN
      -- Iterar sobre los items del pedido
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
      LOOP
        v_product_id := (v_item->>'productId')::integer; 
        v_qty := (v_item->>'qty')::integer;

        -- Restar del stock en inventory_snapshots (asegurándose de no bajar de 0)
        UPDATE public.inventory_snapshots
        SET quantity = GREATEST(0, quantity - v_qty)
        WHERE point_id = v_point_id AND product_id = v_product_id;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_decrement_stock_on_delivery_completion
AFTER UPDATE OF status ON public.delivery_requests
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_delivery_completion();
