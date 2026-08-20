const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA9MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function postToSupabaseNative(key, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ key, data });
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state?key=eq.${encodeURIComponent(key)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function dig(pathStr, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? Buffer.from(opts.body) : null;
  return new Promise((resolve, reject) => {
    const o = {
      hostname: BIOMETRIC_CONFIG.ipAddress, port: BIOMETRIC_CONFIG.port, path: pathStr, method, timeout: 4000,
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

async function main() {
  console.log('🚀 Escaneando posiciones 0 a 8000 para extraer TODAS las marcaciones de empleados...');
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  let posicion = 0;
  const maxPos = 8000;
  let allEvents = [];

  do {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: posicion, maxResults: 10, major: 0, minor: 0 } });
    try {
      const res = await dig(acsUrl, { method: 'POST', body: payload });
      if (!res.ok) break;
      const data = JSON.parse(res.text);
      const batch = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(batch) || batch.length === 0) break;
      allEvents.push(...batch);
      posicion += batch.length;
      process.stdout.write(`Obtenidas ${allEvents.length} marcaciones (${posicion}/${maxPos})...\r`);
      await new Promise(r => setTimeout(r, 8));
    } catch (e) {
      break;
    }
  } while (posicion < maxPos);

  console.log(`\n✅ Lectura completada: ${allEvents.length} marcaciones en total.`);

  // Filter valid employees
  const validEvents = allEvents.filter(ev => {
    const emp = ev.employeeNoString;
    return emp && emp !== '' && emp !== '0' && emp !== '18446744073709551613';
  });

  console.log(`👤 Eventos con empleado válido: ${validEvents.length}`);

  // Group by employee and local date
  const byEmpDay = {};
  validEvents.forEach(ev => {
    const emp = String(ev.employeeNoString).trim();
    const ts = ev.time || '';
    const dateStr = ts.slice(0, 10);
    const key = `${emp}_${dateStr}`;
    if (!byEmpDay[key]) byEmpDay[key] = [];
    byEmpDay[key].push(ev);
  });

  // Map to attendance_logs structure
  const mappedLogs = [];
  Object.values(byEmpDay).forEach(dayEvents => {
    dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const first = dayEvents[0];
    const last = dayEvents[dayEvents.length - 1];
    const emp = String(first.employeeNoString).trim();

    // ENTRY
    const ts1 = first.time || new Date().toISOString();
    const id1 = first.serialNo ? `LOG-TERM-001-${first.serialNo}` : `LOG-TERM-001-${emp}-${ts1.slice(0, 19)}`;
    mappedLogs.push({
      id: id1,
      employeeId: `EMP-${emp}`,
      employeeNo: emp,
      serialNo: first.serialNo ? Number(first.serialNo) : undefined,
      attendanceStatus: 'checkIn',
      timestamp: ts1,
      type: 'ENTRY',
      branchId: 'BRANCH-001',
      terminalId: 'TERM-001',
      verifyMethod: first.currentVerifyMode || 'BIOMETRIC',
      doorNo: first.doorNo || 1
    });

    // EXIT (if last is different from first)
    if (last.serialNo !== first.serialNo) {
      const ts2 = last.time || new Date().toISOString();
      const id2 = last.serialNo ? `LOG-TERM-001-${last.serialNo}` : `LOG-TERM-001-${emp}-${ts2.slice(0, 19)}`;
      mappedLogs.push({
        id: id2,
        employeeId: `EMP-${emp}`,
        employeeNo: emp,
        serialNo: last.serialNo ? Number(last.serialNo) : undefined,
        attendanceStatus: 'checkOut',
        timestamp: ts2,
        type: 'EXIT',
        branchId: 'BRANCH-001',
        terminalId: 'TERM-001',
        verifyMethod: last.currentVerifyMode || 'BIOMETRIC',
        doorNo: last.doorNo || 1
      });
    }
  });

  console.log(`📋 Total marcaciones formateadas: ${mappedLogs.length}`);

  // Push to Supabase app_state
  console.log('\n☁️ Subiendo a Supabase (key: attendance_logs y attendance_logs_BRANCH-001)...');
  const ok1 = await postToSupabaseNative('attendance_logs', mappedLogs);
  const ok2 = await postToSupabaseNative('attendance_logs_BRANCH-001', mappedLogs);

  if (ok1 && ok2) {
    console.log(`\n🎉 ¡ÉXITO TOTAL! ${mappedLogs.length} marcaciones subidas a Supabase.`);
    console.log('Ahora todos los empleados (Yei, Moni, Jhon, Luis, Fernanda, Jose, Jaider, Yisela, Yesica, etc.) tienen sus entradas y salidas sincronizadas.');
  } else {
    console.error(`❌ Falló la subida a Supabase: ok1=${ok1}, ok2=${ok2}`);
  }
}

main().catch(console.error);
