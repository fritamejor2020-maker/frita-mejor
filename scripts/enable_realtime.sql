-- Enable Realtime for olaclick_orders table in Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE olaclick_orders;
ALTER TABLE olaclick_orders REPLICA IDENTITY FULL;
