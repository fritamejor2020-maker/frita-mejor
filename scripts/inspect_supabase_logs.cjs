const https = require('https');

const SUPABASE_URL = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

async function getFromSupabase(key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_URL,
      path: `/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json && json[0] ? json[0].value : null);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

async function main() {
  console.log('--- Inspecting attendance_logs ---');
  const logs1 = await getFromSupabase('attendance_logs');
  console.log('attendance_logs count:', logs1 ? logs1.length : 0);
  if (logs1 && logs1.length > 0) {
    console.log('Sample logs (first 5):', JSON.stringify(logs1.slice(0, 5), null, 2));
    console.log('Sample logs (last 5):', JSON.stringify(logs1.slice(-5), null, 2));
  }

  console.log('\n--- Inspecting attendance_logs_BRANCH-001 ---');
  const logs2 = await getFromSupabase('attendance_logs_BRANCH-001');
  console.log('attendance_logs_BRANCH-001 count:', logs2 ? logs2.length : 0);

  console.log('\n--- Inspecting employees ---');
  const employees = await getFromSupabase('employees') || await getFromSupabase('attendance_employees');
  console.log('employees count:', employees ? employees.length : 0);
  if (employees && employees.length > 0) {
    console.log('Sample employees:', JSON.stringify(employees.slice(0, 5), null, 2));
  }
}

main();
