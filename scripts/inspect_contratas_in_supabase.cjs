const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContratas() {
  console.log('=== Checking customer_types ===');
  const { data: ct, error: err1 } = await supabase.from('customer_types').select('*');
  console.log('customer_types:', JSON.stringify(ct, null, 2), err1);

  console.log('\n=== Checking customers ===');
  const { data: c, error: err2 } = await supabase.from('customers').select('*');
  console.log('customers:', JSON.stringify(c, null, 2), err2);

  console.log('\n=== Checking pos_settings ===');
  const { data: ps, error: err3 } = await supabase.from('pos_settings').select('*');
  console.log('pos_settings:', JSON.stringify(ps, null, 2), err3);
}

checkContratas();
