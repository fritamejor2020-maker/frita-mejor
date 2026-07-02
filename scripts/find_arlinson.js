import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findArlinsonOrder() {
  const { data, error } = await supabase
    .from('olaclick_orders')
    .select('*')
    .or('customer_name.ilike.%Arlinson%,public_id.ilike.%CO-8595%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("=== ARLINSON / CO-8595 SEARCH IN DB ===");
  console.log(JSON.stringify(data, null, 2));
}

findArlinsonOrder();
