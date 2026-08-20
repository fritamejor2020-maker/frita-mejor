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

async function quickSearchFast() {
  console.log('--- BUSQUEDA RÁPIDA DE YEI (#2) EN HUELLAS ---');
  
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';
  const initCond = { searchID: "fp_scan", searchResultPosition: 0, maxResults: 10, major: 5, minor: 38 };
  const res1 = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });

  if (!res1.ok || !res1.text) {
    console.error('Error al conectar');
    return;
  }

  const data1 = JSON.parse(res1.text);
  const totalHuellas = data1.AcsEvent?.totalMatches || 0;
  console.log(`Total de huellas (major: 5, minor: 38): ${totalHuellas}`);

  // Escanear los últimos 1500 eventos de huella (cubre más de 1 mes completo)
  let pos = Math.max(0, totalHuellas - 1500);
  let yeiPunches = [];
  let userCounts = {};

  while (pos < totalHuellas) {
    const batchCond = {
      searchID: "fp_batch_fast",
      searchResultPosition: pos,
      maxResults: 100,
      major: 5,
      minor: 38
    };

    const resBatch = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });
    if (!resBatch.ok || !resBatch.text) break;

    const dataBatch = JSON.parse(resBatch.text);
    let list = dataBatch.AcsEvent?.InfoList || [];
    if (!Array.isArray(list)) list = [list];
    if (list.length === 0) break;

    list.forEach(ev => {
      const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
      userCounts[empNo] = (userCounts[empNo] || 0) + 1;

      if (empNo === '2' || empNo === '02' || empNo === '002' || empNo.toLowerCase().includes('yei')) {
        yeiPunches.push(ev);
      }
    });

    pos += list.length;
  }

  console.log('\n📊 CONTEO DE MARCACIONES DE HUELLA RECIENTES POR ID:');
  console.log(JSON.stringify(userCounts, null, 2));

  console.log(`\n🎉 HUELLAS REGISTRADAS PARA EMPLEADO #2 (Yei): ${yeiPunches.length}`);
  yeiPunches.forEach((ev, i) => {
    console.log(`${i+1}. Fecha: ${ev.time} | Status: "${ev.attendanceStatus}" | Serial: ${ev.serialNo}`);
  });
}

quickSearchFast();
