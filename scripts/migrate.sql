-- Add new columns to olaclick_orders for the corrected OlaClick webhook
ALTER TABLE olaclick_orders ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE olaclick_orders ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE olaclick_orders ADD COLUMN IF NOT EXISTS delivery_price INTEGER DEFAULT 0;
ALTER TABLE olaclick_orders ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'DELIVERY';
