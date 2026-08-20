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

async function findLorena() {
  const keys = ['payrollContracts', 'payroll_contracts_BRANCH-001', 'payrollEmployees', 'payroll_employees_BRANCH-001'];
  for (const k of keys) {
    const val = await getSupabaseKey(k);
    if (Array.isArray(val)) {
      const match = val.find(c => (c.fullName || c.name || '').toLowerCase().includes('lorena'));
      if (match) {
        console.log(`Lorena encontrada en key "${k}":`, match);
      }
    }
  }

  // Buscar todos los empleados en el biométrico
  console.log('\n--- TODOS LOS CONTRATOS REGISTRADOS ---');
  const allContracts = await getSupabaseKey('payroll_contracts_BRANCH-001');
  if (Array.isArray(allContracts)) {
    allContracts.forEach(c => {
      console.log(`- #${c.employeeNo} | ${c.fullName} | ID: ${c.employeeId}`);
    });
  }
}

findLorena();
