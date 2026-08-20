const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tnqydscohgpxbchqvxat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucXlkc2NvaGdweGJjaHF2eGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMzc0ODUsImV4cCI6MjA1NjzgMzQ4NX0.S4_6kE_tU8gT30u_U5kU9G9H3b51X515X515X515X515';

function fetchHikvisionEventsForUser2() {
  return new Promise((resolve) => {
    // Escanear evento por evento filtrando employeeNoString === "2"
    const req = http.request({
      hostname: '192.168.3.220',
      port: 80,
      path: '/ISAPI/AccessControl/AcsEvent?format=json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Digest username="admin", realm="DS-K1T8003MF", nonce="4d61746368313233", uri="/ISAPI/AccessControl/AcsEvent?format=json", response="0123456789abcdef0123456789abcdef"' // or standard digest handling
      }
    });
  });
}

// Vamos a usar un script de búsqueda limpia en Supabase y en la memoria descargada del Hikvision
async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('--- 1. BUSCANDO EN SUPABASE PARA EMPLEADO #2 (Yei) ---');
  const { data: rows, error } = await supabase.from('app_state').select('*').in('key', ['attendance_logs', 'attendance_logs_BRANCH-001']);
  
  let allLogs = [];
  if (rows) {
    rows.forEach(r => {
      if (Array.isArray(r.value)) {
        allLogs.push(...r.value);
      }
    });
  }

  const yeiLogsSupabase = allLogs.filter(l => {
    const no = String(l.employeeNo || l.employeeNoString || l.employeeId || '').trim();
    return no === '2' || no === '02' || no === '002';
  });

  console.log(`Logs encontrados en Supabase para #2 (Yei): ${yeiLogsSupabase.length}`);
  console.dir(yeiLogsSupabase, { depth: null });
}

run();
