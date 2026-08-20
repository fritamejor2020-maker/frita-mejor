const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getSupabaseKey(keyName) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state?key=eq.${keyName}&select=*`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed[0]?.value || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function postToSupabaseKey(keyName, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ key: keyName, value: payload, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: '/rest/v1/app_state',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function syncYeiLog() {
  const yeiLog = {
    id: 'LOG-TERM-001-25542',
    terminalId: 'TERM-001',
    employeeNo: '2',
    employeeId: 'EMP-002',
    timestamp: '2026-08-01T10:30:27-05:00',
    type: 'ENTRY',
    verifyMethod: 'FINGERPRINT',
    attendanceStatus: 'checkIn',
    serialNo: 25542
  };

  for (const key of ['attendance_logs', 'attendance_logs_BRANCH-001']) {
    const existing = await getSupabaseKey(key);
    const filtered = existing.filter(l => l.id !== yeiLog.id && l.serialNo !== 25542);
    filtered.push(yeiLog);
    const status = await postToSupabaseKey(key, filtered);
    console.log(`Guardado CheckIn de Yei (#2) en Supabase key "${key}": HTTP ${status}`);
  }
}

syncYeiLog();
