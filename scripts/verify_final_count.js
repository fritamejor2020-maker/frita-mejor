import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCount() {
  const { data, count, error } = await supabase
    .from('olaclick_orders')
    .select('id, customer_name, public_id', { count: 'exact' })
    .eq('status', 'PENDING');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`=== TOTAL PEDIDOS PENDING EN SUPABASE: ${count ?? (data?.length || 0)} ===`);
  (data || []).slice(0, 10).forEach(o => {
    console.log(`  - ${o.public_id} (${o.customer_name})`);
  });
}

verifyCount();
