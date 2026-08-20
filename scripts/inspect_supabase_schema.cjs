const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function inspect() {
  const req = https.request({
    hostname: SUPABASE_REST_HOST,
    port: 443,
    path: `/rest/v1/app_state?select=*&limit=1`,
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
      console.log('Status:', res.statusCode);
      console.log('Response body:', b);
    });
  });
  req.on('error', console.error);
  req.end();
}

inspect();
