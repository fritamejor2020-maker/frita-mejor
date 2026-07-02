import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnonUpdate() {
  console.log("Testing update on Tatiana mora order with ANON KEY...");
  const { data, error } = await supabase
    .from('olaclick_orders')
    .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
    .eq('id', 'a22898f9-f51a-4a9a-ace4-b52fd95b7749')
    .select();

  console.log("Error:", error);
  console.log("Data returned:", data);
}

testAnonUpdate();
