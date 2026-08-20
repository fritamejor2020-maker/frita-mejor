const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function dumpKeys() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: `/rest/v1/app_state?select=key`, method: 'GET',
      headers: { 'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}` }
    }, res => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          console.log('Todas las llaves existentes en Supabase:', rows.map(r => r.key));
          resolve(rows);
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', reject); req.end();
  });
}

dumpKeys();
