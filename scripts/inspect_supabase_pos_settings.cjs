const fs = require('fs');

const SUPABASE_URL = 'https://uevcotmnffftoelscjua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.json();
  data.forEach(item => {
    if (item.key && item.key.includes('posSettings')) {
      console.log('=== KEY:', item.key, '===');
      console.log(JSON.stringify(item.value?.hardwareSettings || item.value, null, 2));
    }
  });
}

main().catch(console.error);
