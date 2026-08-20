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

async function fastCheck() {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  // Total matches for minor: 38
  const req38 = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 1, major: 5, minor: 38 } });
  const res38 = await dig(acsUrl, { method: 'POST', body: req38 });
  const total38 = JSON.parse(res38.text).AcsEvent?.totalMatches || 0;
  console.log(`📌 Total minor 38 matches: ${total38}`);

  let events = [];
  const startPos = Math.max(0, total38 - 300);
  let pos = startPos;
  while (pos < total38) {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: pos, maxResults: 30, major: 5, minor: 38 } });
    try {
      const res = await dig(acsUrl, { method: 'POST', body: payload });
      if (!res.ok) break;
      const data = JSON.parse(res.text);
      const batch = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(batch) || batch.length === 0) break;
      events.push(...batch);
      pos += batch.length;
    } catch (e) { break; }
  }

  console.log(`\n📋 MARCACIONES DE HOY (2026-08-06) CON DETALLE DE ATTENDANCE STATUS:`);
  const todayEvents = events.filter(ev => (ev.time || '').startsWith('2026-08-06'));
  todayEvents.forEach((ev, i) => {
    const emp = ev.employeeNoString || ev.employeeNo || ev.cardNo;
    console.log(`${i+1}. Serial: ${ev.serialNo} | Emp: #${emp} | Time: ${ev.time} | attendanceStatus: "${ev.attendanceStatus}" | statusValue: ${ev.statusValue} | cardNo: "${ev.cardNo}"`);
  });

  const explicitToday = todayEvents.filter(ev => ev.attendanceStatus && ev.attendanceStatus !== 'undefined');
  console.log(`\n🌟 EVENTOS DE HOY CON ATTENDANCE STATUS EXPLÍCITO (NO UNDEFINED): ${explicitToday.length}`);
  explicitToday.forEach((ev, i) => {
    console.log(`  👉 #${i+1}: Emp #${ev.employeeNoString} | Time: ${ev.time} | Status: "${ev.attendanceStatus}" | Serial: ${ev.serialNo}`);
  });
}

fastCheck().catch(console.error);
