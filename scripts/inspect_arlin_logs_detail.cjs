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
  const logs = await getFromSupabase('attendance_logs') || [];
  console.log(`Total logs in attendance_logs: ${logs.length}`);
  
  const arlinLogs = logs.filter(l => String(l.employeeNo) === '24' || String(l.employeeId) === 'EMP-24');
  console.log(`Arlin logs count: ${arlinLogs.length}`);

  arlinLogs.forEach((l, i) => {
    console.log(`Log #${i+1}: ID=${l.id} | TS=${l.timestamp} | Type=${l.type} | Status=${l.attendanceStatus} | Serial=${l.serialNo}`);
  });

  const logsBranch = await getFromSupabase('attendance_logs_BRANCH-001') || [];
  console.log(`Total logs in attendance_logs_BRANCH-001: ${logsBranch.length}`);

  const arlinBranchLogs = logsBranch.filter(l => String(l.employeeNo) === '24' || String(l.employeeId) === 'EMP-24');
  console.log(`Arlin BRANCH-001 logs count: ${arlinBranchLogs.length}`);
}

main();
