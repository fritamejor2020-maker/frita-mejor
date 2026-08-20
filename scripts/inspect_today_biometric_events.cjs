const http = require('http');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = { ipAddress: '192.168.3.220', port: 80, username: 'admin', password: 'Control.1' };

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

async function inspectToday() {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  // 1. Get total matches
  const initialReq = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 1, major: 0, minor: 0 } });
  const initRes = await dig(acsUrl, { method: 'POST', body: initialReq });
  const initData = JSON.parse(initRes.text);
  const totalMatches = initData.AcsEvent?.totalMatches || 0;
  console.log(`📌 Total matches en memoria biométrica: ${totalMatches}`);

  // Scan backwards from totalMatches - 1000 to totalMatches
  const startPos = Math.max(0, totalMatches - 1000);
  console.log(`🔎 Escaneando desde la posición ${startPos} hasta ${totalMatches}...`);

  let allEvents = [];
  let pos = startPos;
  while (pos < totalMatches) {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: pos, maxResults: 30, major: 0, minor: 0 } });
    try {
      const res = await dig(acsUrl, { method: 'POST', body: payload });
      if (!res.ok) break;
      const data = JSON.parse(res.text);
      const batch = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(batch) || batch.length === 0) break;
      allEvents.push(...batch);
      pos += batch.length;
    } catch (e) { break; }
  }

  console.log(`✅ Eventos escaneados en el rango final: ${allEvents.length}`);

  // Filter valid employee events
  const employeeEvents = allEvents.filter(ev => {
    let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
    return rawNo && rawNo !== '0' && rawNo !== '18446744073709551613';
  });

  console.log(`📋 Eventos de empleados encontrados: ${employeeEvents.length}`);

  // Find events for TODAY 2026-08-06
  const todayEvents = employeeEvents.filter(ev => (ev.time || '').startsWith('2026-08-06'));
  console.log(`\n--- MARCACIONES DE HOY (2026-08-06) ---`);
  if (todayEvents.length === 0) {
    console.log('⚠️ No se encontraron marcaciones para 2026-08-06 en el rango escaneado.');
    console.log('Últimos 10 eventos de empleados registrados:');
    employeeEvents.slice(-10).forEach(ev => {
      console.log(`Pos: ${ev.searchResultPosition || '?'} | Emp: ${ev.employeeNoString || ev.employeeNo} | Time: ${ev.time} | Minor: ${ev.minor} | Status: ${ev.attendanceStatus}`);
    });
  } else {
    todayEvents.forEach(ev => {
      console.log(`Emp: ${ev.employeeNoString || ev.employeeNo} | Time: ${ev.time} | Minor: ${ev.minor} | Status: ${ev.attendanceStatus}`);
    });
  }
}

inspectToday().catch(console.error);
