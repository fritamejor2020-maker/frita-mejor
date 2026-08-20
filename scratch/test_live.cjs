const http = require('http');
const crypto = require('crypto');

const config = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

async function isapiDigestFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const bodyData = options.body ? Buffer.from(options.body, 'utf-8') : null;

  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: config.ipAddress,
      port: config.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
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
        const ha1 = crypto.createHash('md5').update(`${config.username}:${realm}:${config.password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');
        
        let respStr;
        if (qop) {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let authHeader = `Digest username="${config.username}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${respStr}"`;
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

async function descargarTodasLasMarcacionesHikvision(ip, usuario, clave) {
  const path = '/ISAPI/AccessControl/AcsEvent?format=json';
  const pageSize = 30;
  let posicion = 0;
  let marcacionesTotales = [];
  let totalEnMemoria = 0;

  // 1. Obtener totalEnMemoria
  const initCond = {
    searchID: "1",
    searchResultPosition: 0,
    maxResults: pageSize,
    major: 0,
    minor: 0
  };

  const res1 = await isapiDigestFetch(path, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });
  if (!res1.ok || !res1.text) return [];

  const data1 = JSON.parse(res1.text);
  totalEnMemoria = data1.AcsEvent?.totalMatches || 0;
  console.log(`Total de marcaciones en memoria del biométrico: ${totalEnMemoria}`);

  // Para rapidez en el navegador, leemos las últimas 150 marcaciones paginando en lotes de 30
  posicion = Math.max(0, totalEnMemoria - 150);

  do {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: posicion,
        maxResults: pageSize,
        major: 0,
        minor: 0
      }
    });

    const respuesta = await isapiDigestFetch(path, { method: 'POST', body: payload });
    if (!respuesta.ok || !respuesta.text) break;

    const data = JSON.parse(respuesta.text);
    const loteActual = data.AcsEvent?.InfoList || [];

    if (loteActual.length === 0) break;

    marcacionesTotales.push(...loteActual);
    posicion += loteActual.length;

    // Breve pausa de 20ms entre páginas para estabilidad total
    await new Promise((r) => setTimeout(r, 20));

  } while (posicion < totalEnMemoria);

  return marcacionesTotales;
}

async function main() {
  console.log('--- Probando método descargarTodasLasMarcacionesHikvision ---');
  const logs = await descargarTodasLasMarcacionesHikvision('192.168.3.220', 'admin', 'Control.1');
  console.log(`Descargadas ${logs.length} marcaciones.`);

  if (logs.length > 0) {
    console.log('\n--- MUESTRA DEL ÚLTIMO REGISTRO OBTENIDO CON SUS 4 VARIABLES CLAVE ---');
    const last = logs[logs.length - 1];
    console.log({
      employeeNoString: last.employeeNoString,
      serialNo: last.serialNo,
      attendanceStatus: last.attendanceStatus,
      time: last.time,
      minor: last.minor
    });
  }
}

main();
