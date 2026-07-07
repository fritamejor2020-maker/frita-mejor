const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: invGlobal } = await supabase.from('app_state').select('*').eq('key', 'inventory');
  const { data: invBranch } = await supabase.from('app_state').select('*').eq('key', 'inventory_BRANCH-001');

  console.log('--- GLOBAL INVENTORY ---');
  console.log(invGlobal ? JSON.stringify(invGlobal[0]?.value, null, 2) : 'no global');

  console.log('--- BRANCH INVENTORY ---');
  console.log(invBranch ? JSON.stringify(invBranch[0]?.value, null, 2) : 'no branch');
}

main().catch(console.error);
