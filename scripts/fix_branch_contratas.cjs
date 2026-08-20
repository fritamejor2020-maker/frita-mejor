const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncContratas() {
  console.log('--- Syncing Contratas across all keys in Supabase ---');
  
  // Read global keys
  const { data, error } = await supabase
    .from('app_state')
    .select('key, value')
    .in('key', ['customerTypes', 'customers']);

  if (error || !data) {
    console.error('Error reading global contratas:', error);
    return;
  }

  const globalTypes = data.find(r => r.key === 'customerTypes')?.value || [];
  const globalCusts = data.find(r => r.key === 'customers')?.value || [];

  console.log('Global customerTypes count:', globalTypes.length);
  console.log('Global customers count:', globalCusts.length);

  // Update BRANCH-001 keys to match global
  await supabase.from('app_state').upsert({ key: 'customerTypes_BRANCH-001', value: globalTypes });
  await supabase.from('app_state').upsert({ key: 'customers_BRANCH-001', value: globalCusts });

  console.log('✅ Synchronized customerTypes_BRANCH-001 and customers_BRANCH-001 in Supabase successfully!');
}

syncContratas();
