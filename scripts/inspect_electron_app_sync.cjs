const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('app_state')
    .select('key, value')
    .in('key', ['customers', 'customerTypes', 'customers_BRANCH-001', 'customerTypes_BRANCH-001']);

  console.log('--- SUPABASE CURRENT DATA ---');
  data.forEach(row => {
    console.log(`KEY: ${row.key}`);
    console.log(JSON.stringify(row.value, null, 2));
  });
}

check();
