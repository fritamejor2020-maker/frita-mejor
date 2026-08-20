const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBranchKeys() {
  const { data } = await supabase.from('app_state').select('key, value').in('key', ['customerTypes', 'customerTypes_BRANCH-001', 'customers', 'customers_BRANCH-001']);
  console.log('=== BRANCH VS GLOBAL KEYS ===');
  data.forEach(r => {
    console.log(`Key: ${r.key}`);
    console.log(JSON.stringify(r.value, null, 2));
  });
}

checkBranchKeys();
