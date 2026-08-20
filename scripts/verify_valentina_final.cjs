const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getFromSupabaseNative(key) {
  return new Promise((resolve) => {
    https.get({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state?key=eq.${key}&select=value`,
      headers: { 'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}` }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const arr = JSON.parse(b);
          resolve(arr[0]?.value || null);
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function verify() {
  console.log('🔍 Verificando datos guardados en Supabase...');
  const logs = await getFromSupabaseNative('attendance_logs_BRANCH-001');
  if (!Array.isArray(logs)) {
    console.log('❌ No se obtuvieron logs.');
    return;
  }
  console.log(`✅ Se leyeron ${logs.length} marcaciones en total de Supabase.`);

  const valentina = logs.filter(l => l.employeeNo === '12' && l.timestamp.startsWith('2026-08'));
  console.log('\n--- VALENTINA (#12) EN AGOSTO 2026 ---');
  valentina.forEach(l => {
    console.log(`Fecha/Hora: ${l.timestamp} | Estado: ${l.attendanceStatus} | Tipo: ${l.type} | ID: ${l.id}`);
  });
}

verify().catch(console.error);
