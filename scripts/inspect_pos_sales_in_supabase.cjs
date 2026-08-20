const https = require('https');

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getSupabaseKey(keyName) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: `/rest/v1/app_state?key=eq.${keyName}&select=*`, method: 'GET',
      headers: { 'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}` }
    }, res => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)[0]?.value || []); } catch (e) { resolve([]); }
      });
    });
    req.on('error', reject); req.end();
  });
}

async function inspectPosSales() {
  console.log('=== BUSCANDO VENTAS #422918 Y #561060 EN POSSALES SUPABASE ===');
  for (const k of ['posSales', 'posSales_BRANCH-001']) {
    const val = await getSupabaseKey(k);
    const matches = val.filter(s => String(s.id).includes('422918') || String(s.id).includes('561060') || s.status === 'suspended' || s.isHeld);
    console.log(`Key "${k}": ${val.length} ventas totales, ${matches.length} ventas en espera/coincidentes.`);
    if (matches.length > 0) {
      console.dir(matches, { depth: null });
    }
  }
}

inspectPosSales();
