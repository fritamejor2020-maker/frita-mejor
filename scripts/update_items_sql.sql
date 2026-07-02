-- SQL Script to transform items JSONB array to include both legacy and new key names for every item
UPDATE olaclick_orders
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name', COALESCE(item->>'product_name', item->>'name', 'Producto'),
      'product_name', COALESCE(item->>'product_name', item->>'name', 'Producto'),
      'qty', COALESCE((item->>'quantity')::int, (item->>'qty')::int, 1),
      'quantity', COALESCE((item->>'quantity')::int, (item->>'qty')::int, 1),
      'price', COALESCE((item->>'combo_price')::int, (item->>'variant_price')::int, (item->>'price')::int, 0),
      'combo_price', COALESCE((item->>'combo_price')::int, (item->>'variant_price')::int, (item->>'price')::int, 0),
      'note', COALESCE(item->>'comment', item->>'note', ''),
      'comment', COALESCE(item->>'comment', item->>'note', '')
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE items IS NOT NULL AND jsonb_array_length(items) > 0;
