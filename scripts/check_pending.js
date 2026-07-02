import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingOrders() {
  const { data, error } = await supabase.from('olaclick_orders').select('id, customer_name, status, created_at');
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("=== ALL ORDERS STATUS IN DB ===");
  data.forEach(o => {
    console.log(`${o.id} | ${o.customer_name} | status: ${o.status} | created: ${o.created_at}`);
  });
}

checkPendingOrders();
