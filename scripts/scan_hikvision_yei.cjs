const http = require('http');
const crypto = require('crypto');

const HIK_HOST = '192.168.3.220';
const HIK_PORT = 80;
const HIK_USER = 'admin';
const HIK_PASS = 'Control.1';

function parseDigestHeader(header) {
  const opts = {};
  const matches = header.match(/(\w+)=("[^"]*"|[^,]*)/g);
  if (matches) {
    matches.forEach(m => {
      const parts = m.split('=');
      const key = parts[0].trim();
      const val = parts[1].trim().replace(/^"|"$/g, '');
      opts[key] = val;
    });
  }
  return opts;
}

function renderAuthHeader(method, pathStr, challenge) {
  const c = parseDigestHeader(challenge);
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ha1 = crypto.createHash('md5').update(`${HIK_USER}:${c.realm}:${HIK_PASS}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
  const response = crypto.createHash('md5').update(`${ha1}:${c.nonce}:${nc}:${cnonce}:${c.qop}:${ha2}`).digest('hex');

  return `Digest username="${HIK_USER}", realm="${c.realm}", nonce="${c.nonce}", uri="${pathStr}", qop=${c.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

function isapiFetch(pathStr, method, bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyData = bodyObj ? JSON.stringify(bodyObj) : '';
    const req1 = http.request({
      hostname: HIK_HOST,
      port: HIK_PORT,
      path: pathStr,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      }
    }, (res1) => {
      if (res1.statusCode === 401 && res1.headers['www-authenticate']) {
        const auth = renderAuthHeader(method, pathStr, res1.headers['www-authenticate']);
        const req2 = http.request({
          hostname: HIK_HOST,
          port: HIK_PORT,
          path: pathStr,
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyData),
            'Authorization': auth
          }
        }, (res2) => {
          let text = '';
          res2.on('data', chunk => text += chunk);
          res2.on('end', () => resolve({ status: res2.statusCode, text }));
        });
        req2.on('error', reject);
        if (bodyData) req2.write(bodyData);
        req2.end();
      } else {
        let text = '';
        res1.on('data', chunk => text += chunk);
        res1.on('end', () => resolve({ status: res1.statusCode, text }));
      }
    });
    req1.on('error', reject);
    if (bodyData) req1.write(bodyData);
    req1.end();
  });
}

async function searchYeiEvents() {
  console.log('--- BUSCANDO EVENTOS DIRECTOS EN HIKVISION PARA EMPLEADO #2 (Yei) ---');
  
  // 1. Probar con filtro directo employeeNoString
  const cond1 = {
    searchID: "yei_search_1",
    searchResultPosition: 0,
    maxResults: 100,
    employeeNoString: "2"
  };

  const res1 = await isapiFetch('/ISAPI/AccessControl/AcsEvent?format=json', 'POST', { AcsEventCond: cond1 });
  console.log('Filtro employeeNoString "2" HTTP:', res1.status);
  try {
    const data1 = JSON.parse(res1.text);
    console.log('Total matches con employeeNoString "2":', data1.AcsEvent?.totalMatches);
    const list1 = data1.AcsEvent?.InfoList || [];
    const arr1 = Array.isArray(list1) ? list1 : [list1];
    console.log('Eventos devueltos:', arr1.length);
    arr1.forEach(ev => {
      console.log(`- Time: ${ev.time} | User: "${ev.employeeNoString}" | Status: ${ev.attendanceStatus} | Minor: ${ev.minor} | Serial: ${ev.serialNo}`);
    });
  } catch (e) {
    console.error('Error parseando res1:', e.message, res1.text?.slice(0, 200));
  }

  // 2. Escanear toda la memoria si el filtro de Hikvision no respeta employeeNoString
  console.log('\n--- ESCANEANDO LOS ÚLTIMOS 5000 EVENTOS EN MEMORIA DE HIKVISION BUSCANDO "2" ---');
  const condInit = { searchID: "all_scan", searchResultPosition: 0, maxResults: 1, major: 0, minor: 0 };
  const resInit = await isapiFetch('/ISAPI/AccessControl/AcsEvent?format=json', 'POST', { AcsEventCond: condInit });
  const dataInit = JSON.parse(resInit.text);
  const total = dataInit.AcsEvent?.totalMatches || 0;
  console.log('Total de eventos en memoria:', total);

  let pos = Math.max(0, total - 5000);
  let yeiEvents = [];

  while (pos < total) {
    const batchCond = { searchID: "scan_yei", searchResultPosition: pos, maxResults: 100, major: 0, minor: 0 };
    const resBatch = await isapiFetch('/ISAPI/AccessControl/AcsEvent?format=json', 'POST', { AcsEventCond: batchCond });
    if (resBatch.status !== 200 || !resBatch.text) break;
    const dataBatch = JSON.parse(resBatch.text);
    let list = dataBatch.AcsEvent?.InfoList || [];
    if (!Array.isArray(list)) list = [list];
    if (list.length === 0) break;

    list.forEach(ev => {
      const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
      if (empNo === '2' || empNo === '02' || empNo === '002') {
        yeiEvents.push(ev);
      }
    });

    pos += list.length;
  }

  console.log(`\n🎉 ENCONTRADOS TOTAL PARA YEI (#2) EN HIKVISION: ${yeiEvents.length} EVENTOS:`);
  yeiEvents.forEach(ev => {
    console.log(`📅 ${ev.time} | CardNo: ${ev.cardNo} | Status: "${ev.attendanceStatus}" | Major: ${ev.major} | Minor: ${ev.minor} | Serial: ${ev.serialNo}`);
  });
}

searchYeiEvents();
