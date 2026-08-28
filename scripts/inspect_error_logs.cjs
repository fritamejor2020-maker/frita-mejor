const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uevcotmnffftoelscjua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectErrorLogs() {
  const { data, error } = await supabase.from('error_logs').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) {
    console.error('Error fetching error_logs:', error);
  } else {
    console.log('Total registros recientes en error_logs:', data.length);
    data.forEach(l => {
      console.log(JSON.stringify(l, null, 2));
    });
  }
}

inspectErrorLogs().catch(console.error);
