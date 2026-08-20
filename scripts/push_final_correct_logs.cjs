const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = { ipAddress: '192.168.3.220', port: 80, username: 'admin', password: 'Control.1' };
const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function postToSupabaseNative(key, value) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ key, value, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: `/rest/v1/app_state`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`, 'Prefer': 'resolution=merge-duplicates', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { console.log(`POST [${key}] HTTP ${res.statusCode}`); resolve(res.statusCode >= 200 && res.statusCode < 300); });
    });
    req.on('error', (e) => resolve(false)); req.write(payload); req.end();
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
  console.log('🚀 Leyendo marcaciones del biométrico...');
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  let posicion = 0;
  const maxPos = 7800;
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
      await new Promise(r => setTimeout(r, 6));
    } catch (e) { break; }
  } while (posicion < maxPos);

  console.log(`\n✅ Lectura completada: ${allEvents.length} marcaciones obtenidas.`);

  const validEvents = allEvents.filter(ev => {
    let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
    return rawNo && rawNo !== '0' && rawNo !== '18446744073709551613';
  });

  const byEmpDay = {};
  validEvents.forEach(ev => {
    const rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
    const ts = ev.time || '';
    const dateStr = ts.slice(0, 10);
    const key = `${rawNo}_${dateStr}`;
    if (!byEmpDay[key]) byEmpDay[key] = [];
    byEmpDay[key].push(ev);
  });

  const mappedLogs = [];
  Object.values(byEmpDay).forEach(dayEvents => {
    dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    dayEvents.forEach((ev, idx) => {
      const rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
      const rawStatus = String(ev.attendanceStatus || '').toLowerCase();

      let isExit = false;
      if (rawStatus === 'checkout' || rawStatus === 'exit' || rawStatus === 'check_out' || rawStatus === 'out' || ev.minor === 22) {
        isExit = true;
      } else if (rawStatus === 'checkin' || rawStatus === 'entry' || rawStatus === 'in') {
        isExit = false;
      } else {
        isExit = idx % 2 === 1;
      }

      const finalTimestamp = ev.time || new Date().toISOString();
      const logId = ev.serialNo ? `LOG-TERM-001-${ev.serialNo}` : `LOG-TERM-001-${rawNo}-${finalTimestamp.slice(0, 19)}`;

      mappedLogs.push({
        id: logId,
        employeeId: `EMP-${rawNo}`,
        employeeNo: rawNo,
        serialNo: ev.serialNo ? Number(ev.serialNo) : undefined,
        attendanceStatus: isExit ? 'checkOut' : 'checkIn',
        timestamp: finalTimestamp,
        type: isExit ? 'EXIT' : 'ENTRY',
        branchId: 'BRANCH-001',
        terminalId: 'TERM-001',
        verifyMethod: ev.currentVerifyMode || 'BIOMETRIC',
        doorNo: ev.doorNo || 1
      });
    });
  });

  console.log(`📋 Total logs a subir: ${mappedLogs.length}`);

  // Check Valentina (#12) logs in August
  const valAug = mappedLogs.filter(l => l.employeeNo === '12' && l.timestamp.startsWith('2026-08'));
  console.log('\n--- VALENTINA (#12) AGOSTO 2026 ---');
  valAug.forEach(l => console.log(`Serial: ${l.serialNo} | Time: ${l.timestamp} | Status: ${l.attendanceStatus} | Type: ${l.type}`));

  console.log('\n☁️ Guardando en Supabase...');
  const ok1 = await postToSupabaseNative('attendance_logs', mappedLogs);
  const ok2 = await postToSupabaseNative('attendance_logs_BRANCH-001', mappedLogs);

  if (ok1 && ok2) {
    console.log(`\n🎉 ¡ÉXITO TOTAL! ${mappedLogs.length} marcaciones guardadas en Supabase.`);
  }
}

main().catch(console.error);
