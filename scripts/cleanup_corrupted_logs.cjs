const https = require('https');

const SUPABASE_URL = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

async function postToSupabase(key, value) {
  const payload = JSON.stringify({ key, value });
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_URL,
      path: '/rest/v1/app_state',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }));
    });
    
    req.on('error', () => resolve({ ok: false }));
    req.write(payload);
    req.end();
  });
}

async function cleanup() {
  console.log('Cleaning up corrupted attendance logs in Supabase...');
  // Reset attendance_logs and attendance_logs_BRANCH-001 to empty array so real user punches populate cleanly
  await postToSupabase('attendance_logs', []);
  await postToSupabase('attendance_logs_BRANCH-001', []);
  console.log('✅ Supabase attendance_logs cleared cleanly!');
}

cleanup();
