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
      hostname: BIOMETRIC_CONFIG.ipAddress, port: BIOMETRIC_CONFIG.port, path: pathStr, method, timeout: 5000,
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

function postToSupabaseNative(key, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ key, value: payload, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: '/rest/v1/app_state', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
        'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`
      }
    }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.write(data); req.end();
  });
}

async function runExactUserReq() {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  const reqInit = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 5, minor: 38 } });
  const resInit = await dig(acsUrl, { method: 'POST', body: reqInit });
  const totalMatches = JSON.parse(resInit.text).AcsEvent?.totalMatches || 0;
  console.log(`📌 Total matches (minor: 38): ${totalMatches}`);

  const startPos = Math.max(0, totalMatches - 5000);
  console.log(`🚀 Escaneando desde la posición ${startPos} hasta ${totalMatches}...`);

  let pos = startPos;
  let allEvents = [];
  const pageSize = 50;

  while (pos < totalMatches) {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: pos, maxResults: pageSize, major: 5, minor: 38 } });
    try {
      const res = await dig(acsUrl, { method: 'POST', body: payload });
      if (!res.ok) break;
      const data = JSON.parse(res.text);
      let batch = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(batch)) batch = [batch];
      if (batch.length === 0) break;
      allEvents.push(...batch);
      pos += batch.length;
    } catch (e) { break; }
  }

  console.log(`✅ Eventos leídos en el rango de los últimos 5000: ${allEvents.length}`);

  // Filtrar descartando completamente attendanceStatus === "undefined" o vacío
  const filteredEvents = allEvents.filter(ev => {
    const st = ev.attendanceStatus;
    if (!st || st === 'undefined' || st === 'null') return false;
    const emp = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
    if (!emp || emp === '0' || emp === '18446744073709551613') return false;
    return true;
  });

  console.log(`\n🌟 REGISTROS CON ATTENDANCE STATUS VÁLIDO (IGNORANDO UNDEFINED): ${filteredEvents.length}`);

  const mappedLogs = filteredEvents.map(ev => {
    const rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
    const st = String(ev.attendanceStatus).toLowerCase();
    const isExit = (st === 'checkout' || st === 'exit' || st === 'check_out' || st === 'out' || st === 'overtimeout' || ev.minor === 22);
    const finalStatus = isExit ? 'checkOut' : 'checkIn';

    return {
      id: ev.serialNo ? `LOG-TERM-001-${ev.serialNo}` : `LOG-TERM-001-${rawNo}-${ev.time}`,
      employeeId: `EMP-${rawNo}`,
      employeeNo: rawNo,
      serialNo: ev.serialNo ? Number(ev.serialNo) : undefined,
      attendanceStatus: finalStatus,
      rawAttendanceStatus: ev.attendanceStatus,
      timestamp: ev.time,
      type: isExit ? 'EXIT' : 'ENTRY',
      branchId: 'BRANCH-001',
      terminalId: 'TERM-001',
      verifyMethod: ev.minor === 38 ? 'BIOMETRIC' : 'CARD_PASS',
      doorNo: ev.doorNo || 1
    };
  });

  console.log('\n--- DETALLE COMPLETO DE LOS REGISTROS VÁLIDOS OBTENIDOS ---');
  mappedLogs.forEach((l, idx) => {
    console.log(`${idx + 1}. Empleado #${l.employeeNo.padEnd(3)} | Serial: ${String(l.serialNo).padEnd(6)} | Fecha/Hora: ${l.timestamp} | Estado: ${l.attendanceStatus} (Original: "${l.rawAttendanceStatus}")`);
  });

  if (mappedLogs.length > 0) {
    console.log('\n☁️ Guardando en Supabase...');
    const r1 = await postToSupabaseNative('attendance_logs', mappedLogs);
    const r2 = await postToSupabaseNative('attendance_logs_BRANCH-001', mappedLogs);
    console.log(`POST [attendance_logs] HTTP ${r1.status}`);
    console.log(`POST [attendance_logs_BRANCH-001] HTTP ${r2.status}`);
  }
}

runExactUserReq().catch(console.error);
