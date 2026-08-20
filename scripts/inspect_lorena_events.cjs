const http = require('http');
const crypto = require('crypto');
const https = require('https');

const BIOMETRIC_CONFIG = { ipAddress: '192.168.3.220', port: 80, username: 'admin', password: 'Control.1' };
const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function dig(pathStr, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? Buffer.from(opts.body) : null;
  return new Promise((resolve, reject) => {
    const o = {
      hostname: BIOMETRIC_CONFIG.ipAddress, port: BIOMETRIC_CONFIG.port, path: pathStr, method, timeout: 8000,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close', ...(body ? { 'Content-Length': body.length } : {}) }
    };
    const r = http.request(o, rs => {
      if (rs.statusCode === 401) {
        const w = rs.headers['www-authenticate'] || '';
        const realm = (w.match(/realm="([^"]+)"/) || [])[1] || '';
        const nonce = (w.match(/nonce="([^"]+)"/) || [])[1] || '';
        const qop = (w.match(/qop="([^"]+)"/) || [])[1] || '';
        const ha1 = crypto.createHash('md5').update(`${BIOMETRIC_CONFIG.username}:${realm}:${BIOMETRIC_CONFIG.password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
        const resp = qop
          ? crypto.createHash('md5').update(`${ha1}:${nonce}:00000001:0a4f113b:${qop}:${ha2}`).digest('hex')
          : crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        let ah = `Digest username="${BIOMETRIC_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${pathStr}", response="${resp}"`;
        if (qop) ah += `, qop=${qop}, nc=00000001, cnonce="0a4f113b"`;
        const r2 = http.request({ ...o, headers: { ...o.headers, 'Authorization': ah } }, rs2 => {
          let b = ''; rs2.on('data', c => b += c); rs2.on('end', () => resolve({ ok: rs2.statusCode === 200, text: b }));
        });
        r2.on('error', reject); if (body) r2.write(body); r2.end();
      } else {
        let b = ''; rs.on('data', c => b += c); rs.on('end', () => resolve({ ok: rs.statusCode === 200, text: b }));
      }
    });
    r.on('error', reject); if (body) r.write(body); r.end();
  });
}

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

async function inspectLorena() {
  console.log('=== 1. BUSCANDO A LORENA EN CONTRATOS Y USUARIOS ===');
  const contracts = await getSupabaseKey('payroll_contracts_BRANCH-001');
  const lorenaContract = contracts.find(c => (c.fullName || '').toLowerCase().includes('lorena'));
  console.log('Contrato de Lorena en Supabase:', lorenaContract);

  const lorenaEmpNo = lorenaContract?.employeeNo || '13'; // Let's search all users
  console.log(`Número de empleado asignado a Lorena: "${lorenaEmpNo}"`);

  console.log('\n=== 2. EVENTOS RECIENTES EN HIKVISION PARA LORENA (#13 O NOMBRE LORENA) ===');
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';
  const initCond = { searchID: "lorena_scan", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 };
  const res1 = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });

  if (res1.ok && res1.text) {
    const totalMatches = JSON.parse(res1.text).AcsEvent?.totalMatches || 0;
    console.log(`Total de eventos globales: ${totalMatches}`);

    let pos = Math.max(0, totalMatches - 3000);
    let lorenaEvents = [];

    while (pos < totalMatches) {
      const batch = { searchID: "lor_b", searchResultPosition: pos, maxResults: 100, major: 0, minor: 0 };
      const resBatch = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: batch }) });
      if (!resBatch.ok || !resBatch.text) break;
      let list = JSON.parse(resBatch.text).AcsEvent?.InfoList || [];
      if (!Array.isArray(list)) list = [list];
      if (list.length === 0) break;

      list.forEach(ev => {
        const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
        if (empNo === String(lorenaEmpNo) || empNo === '13' || (ev.name || '').toLowerCase().includes('lorena')) {
          lorenaEvents.push(ev);
        }
      });

      pos += list.length;
    }

    console.log(`\n🔍 TOTAL DE EVENTOS DE LORENA EN HIKVISION: ${lorenaEvents.length}`);
    lorenaEvents.forEach((ev, i) => {
      console.log(`${i+1}. Serial: ${ev.serialNo} | Time: ${ev.time} | User: "${ev.employeeNoString}" | Card: "${ev.cardNo}" | Major: ${ev.major} | Minor: ${ev.minor} | Status: "${ev.attendanceStatus}"`);
    });
  }

  console.log('\n=== 3. REVISANDO REGISTROS DE LORENA EN SUPABASE ("attendance_logs") ===');
  const logs = await getSupabaseKey('attendance_logs');
  const lorenaLogs = logs.filter(l => String(l.employeeNo || '').trim() === String(lorenaEmpNo) || String(l.employeeNo || '').trim() === '13');
  console.log(`Logs de Lorena actualmente en Supabase: ${lorenaLogs.length}`);
  console.dir(lorenaLogs, { depth: null });
}

inspectLorena();
