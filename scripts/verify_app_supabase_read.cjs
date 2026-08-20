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
  console.log('🔍 Verificando lectura de Supabase que hace la app React/Electron...');

  const logsGlobal = await getFromSupabaseNative('attendance_logs');
  console.log(`Key "attendance_logs": ${Array.isArray(logsGlobal) ? logsGlobal.length : 'null'} registros.`);

  const logsBranch = await getFromSupabaseNative('attendance_logs_BRANCH-001');
  console.log(`Key "attendance_logs_BRANCH-001": ${Array.isArray(logsBranch) ? logsBranch.length : 'null'} registros.`);

  if (Array.isArray(logsBranch) && logsBranch.length > 0) {
    const aug = logsBranch.filter(l => l.timestamp && l.timestamp.includes('2026-08-'));
    console.log(`\n📅 Marcaciones registradas en la nube para Agosto 2026: ${aug.length} marcaciones.`);
    
    // Check distribution of employees in August
    const empDist = {};
    aug.forEach(l => empDist[l.employeeNo] = (empDist[l.employeeNo] || 0) + 1);
    console.log('\n📊 Conteo de marcaciones en Agosto por empleado:');
    Object.entries(empDist).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([emp, count]) => {
      console.log(`   Empleado #${emp}: ${count} marcaciones`);
    });
  }
}

main().catch(console.error);
