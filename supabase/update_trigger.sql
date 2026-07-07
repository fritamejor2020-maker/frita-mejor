CREATE OR REPLACE FUNCTION public.decrement_stock_on_delivery_completion()
RETURNS trigger AS $$
DECLARE
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_point_id text;
  v_link_sales boolean;
BEGIN
  -- Leer si el ligado de ventas está activo en app_state
  BEGIN
    SELECT (value->'inventoryControl'->>'linkSalesToInventory')::boolean INTO v_link_sales
    FROM public.app_state
    WHERE key = 'posSettings';
  EXCEPTION WHEN OTHERS THEN
    v_link_sales := false;
  END;

  IF v_link_sales IS NOT TRUE THEN
    RETURN NEW; -- Si no está activo el ligado de ventas, no hacer nada
  END IF;

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
        v_product_id := v_item->>'productId'; 
        v_qty := (v_item->>'qty')::integer;

        -- Restar del stock en inventory_snapshots (asegurándose de no bajar de 0)
        -- Si v_product_id no es un entero puro (por ser alfanumérico), intentar castearlo o buscar correspondencia en products
        IF v_product_id ~ '^[0-9]+$' THEN
          UPDATE public.inventory_snapshots
          SET quantity = GREATEST(0, quantity - v_qty)
          WHERE point_id = v_point_id AND product_id = v_product_id::integer;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
