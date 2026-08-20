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

async function verifyToday() {
  console.log('🔍 Verificando marcaciones de HOY (2026-08-06) en Supabase...');
  const logs = await getFromSupabaseNative('attendance_logs_BRANCH-001');
  if (!Array.isArray(logs)) {
    console.log('❌ No se recibieron logs.');
    return;
  }

  console.log(`✅ Se leyeron ${logs.length} marcaciones totales de Supabase.`);
  const todayLogs = logs.filter(l => l.timestamp.startsWith('2026-08-06'));

  console.log(`\n📋 TOTAL MARCACIONES ENCONTRADAS HOY (2026-08-06): ${todayLogs.length}`);
  todayLogs.sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  todayLogs.forEach(l => {
    console.log(`Empleado #${l.employeeNo.padEnd(3)} | Hora: ${l.timestamp.slice(11,19)} | Estado: ${l.attendanceStatus.padEnd(8)} | Tipo: ${l.type}`);
  });
}

verifyToday().catch(console.error);
