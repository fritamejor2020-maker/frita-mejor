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

function postToSupabaseNative(key, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ key, value: payload, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST, port: 443, path: '/rest/v1/app_state', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
        'apikey': SUPABASE_REST_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => resolve(res.statusCode));
    req.on('error', reject); req.write(data); req.end();
  });
}

async function extractAllAttendanceEvents() {
  console.log('=== EXTRAENDO TANTO HUELLAS (minor 38) COMO TARJETAS (minor 1) ===');
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  // 1. Extraer marcaciones por Huella (minor: 38)
  let fpLogs = [];
  const initFp = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "fp_init", searchResultPosition: 0, maxResults: 10, major: 5, minor: 38 } }) });
  if (initFp.ok && initFp.text) {
    const totalFp = JSON.parse(initFp.text).AcsEvent?.totalMatches || 0;
    let pos = Math.max(0, totalFp - 1000);
    while (pos < totalFp) {
      const res = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "fp_b", searchResultPosition: pos, maxResults: 100, major: 5, minor: 38 } }) });
      if (!res.ok || !res.text) break;
      let list = JSON.parse(res.text).AcsEvent?.InfoList || [];
      if (!Array.isArray(list)) list = [list];
      if (list.length === 0) break;
      fpLogs.push(...list);
      pos += list.length;
    }
  }

  // 2. Extraer marcaciones por Tarjeta (minor: 1)
  let cardLogs = [];
  const initCard = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "card_init", searchResultPosition: 0, maxResults: 10, major: 5, minor: 1 } }) });
  if (initCard.ok && initCard.text) {
    const totalCard = JSON.parse(initCard.text).AcsEvent?.totalMatches || 0;
    let pos = 0;
    while (pos < totalCard) {
      const res = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "card_b", searchResultPosition: pos, maxResults: 100, major: 5, minor: 1 } }) });
      if (!res.ok || !res.text) break;
      let list = JSON.parse(res.text).AcsEvent?.InfoList || [];
      if (!Array.isArray(list)) list = [list];
      if (list.length === 0) break;
      cardLogs.push(...list);
      pos += list.length;
    }
  }

  console.log(`Marcaciones por huella (recientes 1000): ${fpLogs.length}`);
  console.log(`Marcaciones por tarjeta (totales): ${cardLogs.length}`);

  // Filtrar marcaciones válidas
  const validFp = fpLogs.filter(ev => ev.attendanceStatus && ev.attendanceStatus !== 'undefined');
  const validCards = cardLogs.filter(ev => ev.employeeNoString && ev.employeeNoString.trim() !== '');

  console.log(`Marcaciones de Huella válidas (con checkIn/checkOut): ${validFp.length}`);
  console.log(`Marcaciones de Tarjeta válidas (con empleado asignado): ${validCards.length}`);

  const allRaw = [...validFp, ...validCards];
  allRaw.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const mapped = allRaw.map(ev => {
    const isCard = ev.minor === 1;
    const isEntry = isCard ? true : (ev.attendanceStatus === 'checkIn' || ev.attendanceStatus === 'overtimeIn');
    return {
      id: `LOG-TERM-001-${ev.serialNo}`,
      terminalId: 'TERM-001',
      employeeNo: String(ev.employeeNoString || ev.employeeNo || '').trim(),
      employeeId: `EMP-${String(ev.employeeNoString || ev.employeeNo || '').trim().padStart(3, '0')}`,
      timestamp: ev.time,
      type: isEntry ? 'ENTRY' : 'EXIT',
      verifyMethod: isCard ? 'CARD' : 'FINGERPRINT',
      attendanceStatus: ev.attendanceStatus || (isEntry ? 'checkIn' : 'checkOut'),
      serialNo: ev.serialNo,
      cardNo: ev.cardNo || undefined
    };
  });

  console.log(`\n🎉 TOTAL REGISTROS MAPEADOS (HUELLA + TARJETA): ${mapped.length}`);
  mapped.forEach(m => {
    console.log(`- #${m.employeeNo} | ${m.timestamp} | ${m.verifyMethod} (${m.cardNo || 'Huella'}) | ${m.type} | Serial ${m.serialNo}`);
  });

  // Guardar en Supabase
  const st1 = await postToSupabaseNative('attendance_logs', mapped);
  const st2 = await postToSupabaseNative('attendance_logs_BRANCH-001', mapped);
  console.log(`\nSincronización a Supabase: attendance_logs (HTTP ${st1}), attendance_logs_BRANCH-001 (HTTP ${st2})`);
}

extractAllAttendanceEvents();
