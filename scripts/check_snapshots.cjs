const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY1OTc2MywiZXhwIjoyMDkxMjM1NzYzfQ.p25GdMYJXKxa725L5y95Jslp_lrBdA2927v16KEExyQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: appState } = await supabase.from('app_state').select('*');
  console.log('--- APP STATE ROWS ---');
  console.log(appState ? appState.map(r => ({ key: r.key, length: JSON.stringify(r.value).length })) : 'no data');
}

main().catch(console.error);
