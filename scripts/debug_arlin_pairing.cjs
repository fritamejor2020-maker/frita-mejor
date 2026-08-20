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
  const arlinLogs = logs.filter(l => String(l.employeeNo) === '24');
  console.log(`Arlin total logs: ${arlinLogs.length}`);

  const dayLogs = arlinLogs
    .filter(l => (l.timestamp || '').slice(0, 10) === '2026-08-04')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log('\n--- Arlin dayLogs sorted by timestamp ---');
  dayLogs.forEach((l, i) => {
    console.log(`${i+1}. [${l.timestamp}] type: "${l.type}" status: "${l.attendanceStatus}" serialNo: ${l.serialNo}`);
  });

  // Now simulate the shift pairing logic from useAttendanceData.ts!
  const getTimeString = (ts) => {
    if (!ts) return '';
    if (ts.includes('T')) return ts.slice(11, 19);
    if (ts.includes(' ')) return ts.split(' ')[1] || ts.slice(11, 19);
    return ts.slice(11, 19);
  };

  const shiftPairs = [];
  const hasExplicitExits = dayLogs.some(
    (l) => l.type === 'EXIT' || String(l.type).toUpperCase() === 'CHECKOUT'
  );

  console.log('\nhasExplicitExits:', hasExplicitExits);

  if (hasExplicitExits) {
    let currentPair = null;
    dayLogs.forEach((log) => {
      const isExit = log.type === 'EXIT' || String(log.type).toUpperCase() === 'CHECKOUT';
      if (!isExit) {
        if (currentPair && !currentPair.lastOut) {
          shiftPairs.push(currentPair);
        }
        currentPair = {
          firstIn: getTimeString(log.timestamp),
          lastOut: undefined,
          logs: [log],
        };
      } else {
        if (currentPair) {
          currentPair.lastOut = getTimeString(log.timestamp);
          currentPair.logs.push(log);
          shiftPairs.push(currentPair);
          currentPair = null;
        } else {
          shiftPairs.push({
            firstIn: undefined,
            lastOut: getTimeString(log.timestamp),
            logs: [log],
          });
        }
      }
    });
    if (currentPair) {
      shiftPairs.push(currentPair);
    }
  }

  console.log('\n--- Resulting shiftPairs ---');
  console.log(JSON.stringify(shiftPairs, null, 2));
}

main();
