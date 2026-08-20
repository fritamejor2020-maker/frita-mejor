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
      timeout: 4000,
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
          headers: { ...reqOpts.headers, 'Authorization': authHeader }
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

async function descargarTodasLasMarcacionesHikvision() {
  const acsUrl = `/ISAPI/AccessControl/AcsEvent?format=json`;
  let posicion = 0;
  let marcacionesTotales = [];
  let totalEnMemoria = 0;

  do {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: posicion,
        maxResults: 10,
        major: 0,
        minor: 0
      }
    });

    try {
      const respuesta = await isapiDigestFetchSingle(acsUrl, { method: 'POST', body: payload });
      if (!respuesta.ok || !respuesta.text) break;

      const data = JSON.parse(respuesta.text);
      totalEnMemoria = data.AcsEvent?.totalMatches || 0;
      const loteActual = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(loteActual) || loteActual.length === 0) break;

      marcacionesTotales.push(...loteActual);
      posicion += loteActual.length;
      await new Promise(r => setTimeout(r, 20));
    } catch (e) {
      console.error(`Error at position ${posicion}:`, e.message);
      break;
    }
  } while (posicion < totalEnMemoria);

  return marcacionesTotales;
}

async function main() {
  console.log('🚀 Descargando todas las marcaciones...');
  const allEvents = await descargarTodasLasMarcacionesHikvision();
  console.log(`\n✅ Total descargados: ${allEvents.length}`);

  // Map the 4 key variables
  const mapped = allEvents.map(ev => ({
    employeeNoString: ev.employeeNoString || '',
    serialNo: ev.serialNo || 0,
    attendanceStatus: ev.attendanceStatus || (ev.minor === 21 ? 'checkIn' : ev.minor === 22 ? 'checkOut' : `minor_${ev.minor}`),
    time: ev.time || ''
  }));

  // Count by attendanceStatus
  const statusCounts = {};
  mapped.forEach(m => {
    statusCounts[m.attendanceStatus] = (statusCounts[m.attendanceStatus] || 0) + 1;
  });
  console.log('\n📊 Conteo por attendanceStatus:');
  Object.entries(statusCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // Count by minor code
  const minorCounts = {};
  allEvents.forEach(ev => {
    minorCounts[ev.minor] = (minorCounts[ev.minor] || 0) + 1;
  });
  console.log('\n📊 Conteo por minor code:');
  Object.entries(minorCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  minor ${k}: ${v}`));

  // Count events with non-empty employeeNoString
  const withEmployee = mapped.filter(m => m.employeeNoString && m.employeeNoString !== '' && m.employeeNoString !== '0');
  console.log(`\n👤 Eventos con employeeNoString válido (no vacío, no "0"): ${withEmployee.length}`);

  // Count by employeeNoString
  const empCounts = {};
  withEmployee.forEach(m => {
    empCounts[m.employeeNoString] = (empCounts[m.employeeNoString] || 0) + 1;
  });
  console.log('\n👤 Conteo por empleado:');
  Object.entries(empCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  employeeNo ${k}: ${v}`));

  // Show checkIn + checkOut only for valid employees
  const attendance = withEmployee.filter(m => m.attendanceStatus === 'checkIn' || m.attendanceStatus === 'checkOut');
  const checkIns = attendance.filter(m => m.attendanceStatus === 'checkIn').length;
  const checkOuts = attendance.filter(m => m.attendanceStatus === 'checkOut').length;
  console.log(`\n🟢 CheckIn con empleado válido: ${checkIns}`);
  console.log(`🔴 CheckOut con empleado válido: ${checkOuts}`);
  console.log(`📋 Total attendance marks: ${checkIns + checkOuts}`);

  // Show first 5 samples
  console.log('\n📝 Primeras 5 marcaciones con las 4 variables:');
  mapped.slice(0, 5).forEach((m, i) => {
    console.log(`  [${i}] employeeNoString="${m.employeeNoString}" serialNo=${m.serialNo} attendanceStatus="${m.attendanceStatus}" time="${m.time}"`);
  });

  // Show first 5 attendance marks with valid employee
  console.log('\n📝 Primeras 5 marcaciones checkIn/checkOut con empleado válido:');
  attendance.slice(0, 5).forEach((m, i) => {
    console.log(`  [${i}] employeeNoString="${m.employeeNoString}" serialNo=${m.serialNo} attendanceStatus="${m.attendanceStatus}" time="${m.time}"`);
  });
}

main().catch(console.error);
