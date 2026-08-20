const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getFromSupabaseNative(key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=data`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const arr = JSON.parse(b);
            resolve(arr && arr[0] ? arr[0].data : null);
          } else {
            console.log('GET status:', res.statusCode, b);
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', (e) => { console.error('GET err:', e); resolve(null); });
    req.end();
  });
}

function postToSupabaseNative(key, data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ key, data });
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        console.log('POST status:', res.statusCode, b);
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
    });
    req.on('error', (e) => { console.error('POST err:', e); resolve(false); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Probando getFromSupabaseNative...');
  const logs = await getFromSupabaseNative('attendance_logs');
  console.log(`Logs actuales en Supabase: ${Array.isArray(logs) ? logs.length : 'ninguno'}`);

  console.log('Probando postToSupabaseNative test...');
  const ok = await postToSupabaseNative('test_key', { hello: 'world' });
  console.log(`Post ok: ${ok}`);
}

main().catch(console.error);
