const http = require('http');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

function isapiDigestFetchSingle(pathStr, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const bodyData = options.body ? Buffer.from(options.body, 'utf-8') : null;

  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: BIOMETRIC_CONFIG.ipAddress,
      port: BIOMETRIC_CONFIG.port,
      path: pathStr,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
        'Connection': 'close',
        ...(bodyData ? { 'Content-Length': bodyData.length } : {})
      }
    };

    const req = http.request(reqOpts, (res) => {
      if (res.statusCode === 401) {
        const wwwAuth = res.headers['www-authenticate'] || '';
        const realm = (wwwAuth.match(/realm="([^"]+)"/) || [])[1] || '';
        const nonce = (wwwAuth.match(/nonce="([^"]+)"/) || [])[1] || '';
        const qop = (wwwAuth.match(/qop="([^"]+)"/) || [])[1] || '';

        const cnonce = '0a4f113b';
        const nc = '00000001';
        const ha1 = crypto.createHash('md5').update(`${BIOMETRIC_CONFIG.username}:${realm}:${BIOMETRIC_CONFIG.password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
        
        let respStr;
        if (qop) {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let authHeader = `Digest username="${BIOMETRIC_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${pathStr}", response="${respStr}"`;
        if (qop) authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

        const retryOpts = {
          ...reqOpts,
          headers: {
            ...reqOpts.headers,
            'Authorization': authHeader
          }
        };

        const req2 = http.request(retryOpts, (res2) => {
          let body = '';
          res2.on('data', c => body += c);
          res2.on('end', () => resolve({ ok: res2.statusCode === 200, status: res2.statusCode, text: body }));
        });
        req2.on('error', reject);
        if (bodyData) req2.write(bodyData);
        req2.end();
      } else {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, text: body }));
      }
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function countCheckInCheckOut() {
  console.log('🔍 Executing read-only count of checkIn and checkOut records from Hikvision terminal 192.168.3.220:80...');
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  // 1. Query minor: 21 (checkIn)
  const reqCheckIn = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 5, minor: 21 } });
  const resCheckIn = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: reqCheckIn });
  const dataCheckIn = JSON.parse(resCheckIn.text || '{}');
  const totalCheckIns = dataCheckIn.AcsEvent?.totalMatches || 0;

  // 2. Query minor: 22 (checkOut)
  const reqCheckOut = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 5, minor: 22 } });
  const resCheckOut = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: reqCheckOut });
  const dataCheckOut = JSON.parse(resCheckOut.text || '{}');
  const totalCheckOuts = dataCheckOut.AcsEvent?.totalMatches || 0;

  // 3. Query total events overall
  const reqTotal = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 } });
  const resTotal = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: reqTotal });
  const dataTotal = JSON.parse(resTotal.text || '{}');
  const totalEventsAll = dataTotal.AcsEvent?.totalMatches || 0;

  console.log('\n======================================================');
  console.log('📊 CONTEO DIRECTO DESDE EL BIOMÉTRICO HIKVISION (192.168.3.220):');
  console.log(`- Total de eventos guardados en memoria: ${totalEventsAll.toLocaleString()}`);
  console.log(`- Registros de Entrada (checkIn / minor 21): ${totalCheckIns.toLocaleString()}`);
  console.log(`- Registros de Salida (checkOut / minor 22): ${totalCheckOuts.toLocaleString()}`);
  console.log(`- Total de Marcaciones Laborales (checkIn + checkOut): ${(totalCheckIns + totalCheckOuts).toLocaleString()}`);
  console.log('======================================================\n');

  // Let's inspect the 20 most recent checkIn and checkOut logs with employee details
  console.log('📋 MUESTRA DE LAS ÚLTIMAS 10 ENTRADAS (CHECKIN):');
  const lastInPos = Math.max(0, totalCheckIns - 10);
  const resLastIns = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: lastInPos, maxResults: 10, major: 5, minor: 21 } }) });
  const listIns = JSON.parse(resLastIns.text || '{}').AcsEvent?.InfoList || [];
  (Array.isArray(listIns) ? listIns : [listIns]).forEach((ev, i) => {
    console.log(`  Entrada #${i+1}: Serial=${ev.serialNo} | ID_Empleado="${ev.employeeNoString || ev.employeeNo || 'Sin ID'}" | Fecha=${ev.time} | Estado=${ev.attendanceStatus || 'checkIn'}`);
  });

  console.log('\n📋 MUESTRA DE LAS ÚLTIMAS 10 SALIDAS (CHECKOUT):');
  const lastOutPos = Math.max(0, totalCheckOuts - 10);
  const resLastOuts = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: lastOutPos, maxResults: 10, major: 5, minor: 22 } }) });
  const listOuts = JSON.parse(resLastOuts.text || '{}').AcsEvent?.InfoList || [];
  (Array.isArray(listOuts) ? listOuts : [listOuts]).forEach((ev, i) => {
    console.log(`  Salida #${i+1}: Serial=${ev.serialNo} | ID_Empleado="${ev.employeeNoString || ev.employeeNo || 'Sin ID'}" | Fecha=${ev.time} | Estado=${ev.attendanceStatus || 'checkOut'}`);
  });
}

countCheckInCheckOut();
