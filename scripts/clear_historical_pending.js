import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncLivePendingWithOlaClick() {
  console.log("Sincronizando tabla olaclick_orders con el estado REAL actual de OlaClick (0 pendientes)...");

  // Mark all old pending orders as ACCEPTED/processed so they match OlaClick's live state
  const { data, error } = await supabase
    .from('olaclick_orders')
    .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
    .eq('status', 'PENDING')
    .select('id');

  if (error) {
    console.error("Error actualizando DB:", error.message);
  } else {
    console.log(`✅ ${data?.length || 0} pedidos antiguos archivados/marcados como procesados.`);
  }
}

syncLivePendingWithOlaClick();
