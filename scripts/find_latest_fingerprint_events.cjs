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

async function findLatest() {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  // Try querying with minor: 38 directly if supported
  console.log('🔍 Probando filtro por minor: 38 (huella dactilar)...');
  const req38 = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 38 } });
  const res38 = await dig(acsUrl, { method: 'POST', body: req38 });
  if (res38.ok) {
    const data38 = JSON.parse(res38.text);
    console.log(`📌 Total marcaciones con minor:38 en el sistema: ${data38.AcsEvent?.totalMatches || 0}`);
    const total38 = data38.AcsEvent?.totalMatches || 0;
    if (total38 > 0) {
      // Get the last 20 events of minor: 38
      const lastReq = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: Math.max(0, total38 - 20), maxResults: 30, major: 0, minor: 38 } });
      const lastRes = await dig(acsUrl, { method: 'POST', body: lastReq });
      const lastData = JSON.parse(lastRes.text);
      const list = lastData.AcsEvent?.InfoList || [];
      console.log(`\n📋 ÚLTIMAS ${list.length} MARCACIONES DE HUELLA (MINOR 38) EN EL BIOMÉTRICO:`);
      list.forEach((ev, i) => {
        console.log(`${i+1}. Emp: ${ev.employeeNoString || ev.employeeNo || ev.cardNo} | Time: ${ev.time} | Minor: ${ev.minor} | Status: ${ev.attendanceStatus} | Serial: ${ev.serialNo}`);
      });
    }
  }

  // Also query by date range for today: 2026-08-06T00:00:00 to 2026-08-06T23:59:59
  console.log('\n🔍 Probando filtro por fecha de HOY (2026-08-06)...');
  const dateReq = JSON.stringify({ AcsEventCond: { searchID: "2", searchResultPosition: 0, maxResults: 50, startTime: "2026-08-06T00:00:00-05:00", endTime: "2026-08-06T23:59:59-05:00" } });
  const dateRes = await dig(acsUrl, { method: 'POST', body: dateReq });
  if (dateRes.ok) {
    const dateData = JSON.parse(dateRes.text);
    console.log(`📌 Total eventos hoy por filtro de fecha: ${dateData.AcsEvent?.totalMatches || 0}`);
    const listDate = dateData.AcsEvent?.InfoList || [];
    listDate.forEach((ev, i) => {
      console.log(`${i+1}. Emp: ${ev.employeeNoString || ev.employeeNo || ev.cardNo} | Time: ${ev.time} | Minor: ${ev.minor} | Status: ${ev.attendanceStatus} | Serial: ${ev.serialNo}`);
    });
  }
}

findLatest().catch(console.error);
