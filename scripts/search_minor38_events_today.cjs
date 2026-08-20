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

async function searchMinor38() {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  console.log('🔎 Buscando el total de marcaciones de empleados (minor: 38)...');
  const req = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 1, major: 5, minor: 38 } });
  const res = await dig(acsUrl, { method: 'POST', body: req });
  const data = JSON.parse(res.text);
  const total38 = data.AcsEvent?.totalMatches || 0;
  console.log(`📌 Total matches con minor: 38 = ${total38}`);

  if (total38 > 0) {
    // Read the last 50 minor:38 events!
    const startPos = Math.max(0, total38 - 50);
    console.log(`🔎 Leyendo marcaciones con minor: 38 desde posición ${startPos} hasta ${total38}...`);
    const reqLast = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: startPos, maxResults: 50, major: 5, minor: 38 } });
    const resLast = await dig(acsUrl, { method: 'POST', body: reqLast });
    const list = JSON.parse(resLast.text).AcsEvent?.InfoList || [];

    console.log(`\n📋 ÚLTIMAS 50 MARCACIONES DE EMPLEADOS (MINOR 38) EN EL DISPOSITIVO:`);
    list.forEach((ev, i) => {
      console.log(`${startPos + i}. Serial: ${ev.serialNo} | Emp: ${ev.employeeNoString || ev.employeeNo || ev.cardNo} | Time: ${ev.time} | Status: ${ev.attendanceStatus} | VerifyMode: ${ev.currentVerifyMode}`);
    });
  }
}

searchMinor38().catch(console.error);
