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
        try { resolve(JSON.parse(data)[0]?.value || null); } catch (e) { resolve(null); }
      });
    });
    req.on('error', reject); req.end();
  });
}

function postToSupabaseKey(keyName, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ key: keyName, value: payload, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: '/rest/v1/app_state', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
        'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => resolve(res.statusCode));
    req.on('error', reject); req.write(body); req.end();
  });
}

async function setExactUserCheckboxes() {
  console.log('=== AJUSTANDO EXACTAMENTE LOS CHECKBOXES DEL USUARIO (Productos Vendidos y Firma del Cajero DESACTIVADOS) ===');

  for (const k of ['posSettings', 'posSettings_BRANCH-001']) {
    let current = await getSupabaseKey(k) || {};
    current.ticketConfig = {
      ...(current.ticketConfig || {}),
      zShowProductsSold: false,  // Desactivado como en la foto 1 del usuario
      zShowSignatureLine: false  // Desactivado como en la foto 1 del usuario
    };
    const status = await postToSupabaseKey(k, current);
    console.log(`Guardado en "${k}": HTTP ${status}`);
  }
}

setExactUserCheckboxes();
