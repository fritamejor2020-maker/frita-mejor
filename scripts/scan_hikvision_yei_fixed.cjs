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

async function searchYeiEvents() {
  console.log('--- BUSCANDO EVENTOS DIRECTOS EN HIKVISION PARA EMPLEADO #2 (Yei) ---');
  
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  // 1. Obtener totalMatches
  const initCond = { searchID: "yei_scan", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 };
  const res1 = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });

  if (!res1.ok || !res1.text) {
    console.error('Error al conectar con el dispositivo biométrico.');
    return;
  }

  const data1 = JSON.parse(res1.text);
  const totalEnMemoria = data1.AcsEvent?.totalMatches || 0;
  console.log(`Total de eventos en la memoria del terminal Hikvision: ${totalEnMemoria}`);

  // Escanear los últimos 5,000 eventos en lotes de 100
  let posicion = Math.max(0, totalEnMemoria - 5000);
  const pageSize = 100;
  let yeiEvents = [];
  let totalEscaneados = 0;

  while (posicion < totalEnMemoria) {
    const batchCond = {
      searchID: "yei_scan_batch",
      searchResultPosition: posicion,
      maxResults: pageSize,
      major: 0,
      minor: 0
    };

    const resBatch = await dig(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });
    if (!resBatch.ok || !resBatch.text) break;

    const dataBatch = JSON.parse(resBatch.text);
    let loteActual = dataBatch.AcsEvent?.InfoList || [];
    if (!Array.isArray(loteActual)) loteActual = [loteActual];
    if (loteActual.length === 0) break;

    totalEscaneados += loteActual.length;

    loteActual.forEach(ev => {
      const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
      if (empNo === '2' || empNo === '02' || empNo === '002' || empNo === 'yei' || empNo === 'Yei') {
        yeiEvents.push(ev);
      }
    });

    posicion += loteActual.length;
  }

  console.log(`\n✅ Escaneo completado. Total de eventos revisados: ${totalEscaneados}`);
  console.log(`🔍 EVENTOS ENCONTRADOS PARA EMPLEADO #2 (Yei): ${yeiEvents.length}`);

  if (yeiEvents.length > 0) {
    console.log('\n--- DETALLE DE EVENTOS DE YEI (#2) ---');
    yeiEvents.forEach((ev, idx) => {
      console.log(`${idx + 1}. Time: ${ev.time} | User: "${ev.employeeNoString}" | Status: "${ev.attendanceStatus}" | Major: ${ev.major} | Minor: ${ev.minor} | Serial: ${ev.serialNo}`);
    });
  } else {
    console.log('\n❌ No se encontró NINGÚN registro para el empleado #2 (Yei) en los últimos 5,000 eventos almacenados en el terminal Hikvision.');
  }

  // 3. Revisar también si hay algún usuario registrado con ID 2 en la lista de usuarios del terminal
  console.log('\n--- VERIFICANDO SI YEI EXISTE COMO USUARIO EN EL TERMINAL ---');
  const userRes = await dig('/ISAPI/AccessControl/UserInfo/Search?format=json', {
    method: 'POST',
    body: JSON.stringify({
      UserInfoSearchCond: {
        searchID: "user_2_search",
        searchResultPosition: 0,
        maxResults: 30
      }
    })
  });

  if (userRes.ok && userRes.text) {
    try {
      const userData = JSON.parse(userRes.text);
      const userList = userData.UserInfoSearch?.UserInfo || [];
      const arrUsers = Array.isArray(userList) ? userList : [userList];
      console.log(`Usuarios en el terminal: ${arrUsers.length}`);
      arrUsers.forEach(u => {
        console.log(`- ID: "${u.employeeNo}" | Nombre: "${u.name}" | UserType: "${u.userType}"`);
      });
    } catch (e) {
      console.error('Error parseando usuarios:', e.message);
    }
  }
}

searchYeiEvents();
