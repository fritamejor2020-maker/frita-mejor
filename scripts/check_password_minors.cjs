const http = require('http');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = { ipAddress: '192.168.3.220', port: 80, username: 'admin', password: 'Control.1' };

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

async function checkPasswordMinors() {
  console.log('--- COMPROBANDO EVENTOS DE CONTRASEÑA / PIN EN HIKVISION ---');
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  // Minor codes típicos de contraseña en Hikvision ISAPI:
  // minor: 2 (Card + Password)
  // minor: 3 (Card + PIN)
  // minor: 4 (Password Pass / PIN Pass)
  // minor: 5 (EmployeeNo + Password Pass)
  // minor: 6 (Password Fail)
  const passwordMinors = [2, 3, 4, 5, 6, 7, 8, 9];

  for (const m of passwordMinors) {
    const res = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: `pwd_${m}`, searchResultPosition: 0, maxResults: 10, major: 5, minor: m } }) });
    if (res.ok && res.text) {
      try {
        const data = JSON.parse(res.text);
        const total = data.AcsEvent?.totalMatches || 0;
        console.log(`Minor ${m} (Contraseña/PIN) totalMatches: ${total}`);
        if (total > 0) {
          const info = data.AcsEvent?.InfoList || [];
          const list = Array.isArray(info) ? info : [info];
          list.forEach(ev => {
            console.log(`  - Minor ${m} | Time: ${ev.time} | User: "${ev.employeeNoString}" | Status: "${ev.attendanceStatus}" | Serial: ${ev.serialNo}`);
          });
        }
      } catch (e) {}
    }
  }
}

checkPasswordMinors();
