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

async function checkMajor5Minors() {
  console.log('--- REVISANDO TODOS LOS MINOR CODES DE MAJOR 5 (EVENTOS DE AUTENTICACIÓN) ---');
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  const initCond = { searchID: "major5_scan", searchResultPosition: 0, maxResults: 10, major: 5, minor: 0 };
  const res1 = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });

  if (!res1.ok || !res1.text) {
    console.error('Error al conectar');
    return;
  }

  const data1 = JSON.parse(res1.text);
  const total = data1.AcsEvent?.totalMatches || 0;
  console.log(`Total de eventos de Autenticación de Usuarios (major: 5): ${total}`);

  // Escanear los últimos 1000 eventos de major: 5
  let pos = Math.max(0, total - 1000);
  let minorCounts = {};
  let validUserEvents = [];

  while (pos < total) {
    const resBatch = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "m5_b", searchResultPosition: pos, maxResults: 100, major: 5, minor: 0 } }) });
    if (!resBatch.ok || !resBatch.text) break;
    let list = JSON.parse(resBatch.text).AcsEvent?.InfoList || [];
    if (!Array.isArray(list)) list = [list];
    if (list.length === 0) break;

    list.forEach(ev => {
      minorCounts[ev.minor] = (minorCounts[ev.minor] || 0) + 1;
      const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
      if (empNo && empNo !== '0' && empNo !== '18446744073709551613') {
        validUserEvents.push(ev);
      }
    });

    pos += list.length;
  }

  console.log('\n📊 DISTRIBUCIÓN DE MINOR CODES DENTRO DE MAJOR 5 (AUTENTICACIÓN):');
  console.log(JSON.stringify(minorCounts, null, 2));

  console.log(`\n✅ EVENTOS CON ID DE EMPLEADO VÁLIDO DENTRO DE MAJOR 5: ${validUserEvents.length}`);
  const userMap = {};
  validUserEvents.forEach(ev => {
    const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
    userMap[empNo] = (userMap[empNo] || 0) + 1;
  });
  console.log('Conteo por empleado en Major 5:');
  console.log(JSON.stringify(userMap, null, 2));
}

checkMajor5Minors();
