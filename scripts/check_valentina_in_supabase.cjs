const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getFromSupabaseNative(key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const arr = JSON.parse(b);
            resolve(arr && arr[0] ? arr[0].value : null);
          } else resolve(null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function main() {
  const logs = await getFromSupabaseNative('attendance_logs_BRANCH-001') || [];
  const val = logs.filter(l => String(l.employeeNo).trim() === '12');

  console.log(`TOTAL Valentina (#12) logs in Supabase: ${val.length}`);
  
  val.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  console.log('\n--- TODOS LOS REGISTROS DE VALENTINA (#12) EN AGOSTO 2026 ---');
  const aug = val.filter(l => (l.timestamp || '').startsWith('2026-08'));
  aug.forEach(l => {
    console.log(`Serial: ${String(l.serialNo).padEnd(6)} | Time: ${l.timestamp} | Status: ${l.attendanceStatus} | Type: ${l.type}`);
  });

  console.log('\n--- ÚLTIMOS 15 REGISTROS HISTÓRICOS DE VALENTINA (#12) ---');
  val.slice(-15).forEach(l => {
    console.log(`Serial: ${String(l.serialNo).padEnd(6)} | Time: ${l.timestamp} | Status: ${l.attendanceStatus} | Type: ${l.type}`);
  });
}

main().catch(console.error);
