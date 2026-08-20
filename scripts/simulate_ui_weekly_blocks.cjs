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

function getLogDateStr(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch {}
  return ts.slice(0, 10);
}

function getTimeString(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  } catch {}
  return ts.slice(11, 16);
}

async function main() {
  console.log('🧪 Simulando la lógica exacta de la UI para la semana del 3 al 9 de Agosto 2026...');
  
  const attendanceLogs = await getFromSupabaseNative('attendance_logs_BRANCH-001') || [];
  console.log(`Cargadas ${attendanceLogs.length} marcaciones de Supabase.`);

  const weekDays = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
  
  // Test employees 2 to 41
  const employees = ['2', '3', '4', '5', '6', '8', '9', '10', '11', '12', '14', '15', '16', '17', '21', '24', '32'];

  console.log('\n📅 Bloques de Turno Calculados por la UI para la Semana (3 al 9 Ago 2026):\n');

  employees.forEach(empNo => {
    const empLogs = attendanceLogs.filter(l => String(l.employeeNo).trim() === empNo);
    console.log(`👤 Empleado #${empNo.padEnd(3)}:`);
    
    let hasShiftsThisWeek = false;
    weekDays.forEach(dateStr => {
      const dayLogs = empLogs
        .filter(l => getLogDateStr(l.timestamp) === dateStr)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (dayLogs.length > 0) {
        hasShiftsThisWeek = true;
        const firstIn = getTimeString(dayLogs[0].timestamp);
        const lastOut = dayLogs.length > 1 ? getTimeString(dayLogs[dayLogs.length - 1].timestamp) : 'En turno...';
        console.log(`   - ${dateStr}: ${firstIn} -> ${lastOut} (${dayLogs.length} marcas)`);
      }
    });

    if (!hasShiftsThisWeek) {
      console.log('   (Sin marcaciones registradas para esta semana)');
    }
  });
}

main().catch(console.error);
