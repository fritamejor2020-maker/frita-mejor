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

const EMP_NAMES = {
  '2': 'Yei', '3': 'Moni', '4': 'Jhon', '5': 'Luis', '6': 'Fernanda',
  '8': 'Jose', '9': 'Jaider', '10': 'Yisela', '11': 'Yesica', '12': 'Valentina',
  '13': 'Empleado 13', '14': 'Empleado 14', '15': 'Empleado 15', '16': 'Empleado 16',
  '17': 'Empleado 17', '18': 'Empleado 18', '19': 'Empleado 19', '20': 'Empleado 20',
  '21': 'Empleado 21', '22': 'Empleado 22', '24': 'Arlin', '25': 'Empleado 25',
  '27': 'Empleado 27', '28': 'Empleado 28', '29': 'Empleado 29', '30': 'Empleado 30',
  '31': 'Empleado 31', '32': 'Empleado 32', '33': 'Empleado 33', '34': 'Empleado 34',
  '35': 'Empleado 35', '36': 'Empleado 36', '38': 'Empleado 38', '39': 'Empleado 39',
  '40': 'Empleado 40', '41': 'Empleado 41'
};

async function main() {
  const logs = await getFromSupabaseNative('attendance_logs_BRANCH-001') || [];
  console.log(`TOTAL_LOGS=${logs.length}`);

  // Sort chronologically
  logs.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  const minDate = logs[0]?.timestamp || '';
  const maxDate = logs[logs.length - 1]?.timestamp || '';

  console.log(`MIN_DATE=${minDate}`);
  console.log(`MAX_DATE=${maxDate}`);

  // Count by employee
  const byEmp = {};
  logs.forEach(l => {
    const no = String(l.employeeNo).trim();
    if (!byEmp[no]) byEmp[no] = [];
    byEmp[no].push(l);
  });

  console.log('\n--- EMPLOYEES SUMMARY ---');
  Object.keys(byEmp).sort((a,b) => Number(a)-Number(b)).forEach(emp => {
    const name = EMP_NAMES[emp] || `Empleado #${emp}`;
    const empLogs = byEmp[emp];
    const firstLog = empLogs[0].timestamp.slice(0, 10);
    const lastLog = empLogs[empLogs.length - 1].timestamp.slice(0, 10);
    console.log(`Emp #${emp.padEnd(3)} (${name.padEnd(12)}): ${empLogs.length.toString().padStart(4)} marcaciones totales (Desde ${firstLog} hasta ${lastLog})`);
  });

  // Filter August 2026 week logs
  const weekAug = logs.filter(l => {
    const d = (l.timestamp || '').slice(0, 10);
    return d >= '2026-08-03' && d <= '2026-08-09';
  });

  console.log(`\n--- WEEK AUGUST 3-9 2026 SUMMARY (${weekAug.length} MARCAS) ---`);
  const byEmpAug = {};
  weekAug.forEach(l => {
    const no = String(l.employeeNo).trim();
    if (!byEmpAug[no]) byEmpAug[no] = [];
    byEmpAug[no].push(l);
  });

  Object.keys(byEmpAug).sort((a,b) => Number(a)-Number(b)).forEach(emp => {
    const name = EMP_NAMES[emp] || `Empleado #${emp}`;
    console.log(`\n👤 #${emp} - ${name} (${byEmpAug[emp].length} marcaciones esta semana):`);
    byEmpAug[emp].forEach(l => {
      const timeStr = l.timestamp.replace('T', ' ').slice(0, 19);
      console.log(`   • Serial: ${String(l.serialNo || '').padEnd(6)} | Fecha/Hora: ${timeStr} | Estado: ${l.attendanceStatus} (${l.type})`);
    });
  });
}

main().catch(console.error);
