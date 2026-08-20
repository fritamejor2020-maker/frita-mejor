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
        req2.on('timeout', () => { req2.destroy(); reject(new Error('Timeout')); });
        if (bodyData) req2.write(bodyData);
        req2.end();
      } else {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, text: body }));
      }
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function descargarTodasLasMarcacionesHikvision(ip, usuario, clave) {
  const acsUrl = `/ISAPI/AccessControl/AcsEvent?format=json`;
  let posicion = 0;
  let marcacionesTotales = [];
  let totalEnMemoria = 0;

  do {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: posicion, // <-- La posición avanza (0, 10, 20, 30...)
        maxResults: 10,                 // <-- Hikvision limita a 10 por llamada
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
      process.stdout.write(`Downloaded ${posicion}/${totalEnMemoria} records...\r`);

      await new Promise(r => setTimeout(r, 20));
    } catch (e) {
      console.error(`Error at position ${posicion}:`, e.message);
      break;
    }

  } while (posicion < totalEnMemoria);

  console.log(`\n✅ DESCARGA COMPLETA: ${marcacionesTotales.length} de ${totalEnMemoria} marcaciones totales recibidas.`);
  return marcacionesTotales;
}

descargarTodasLasMarcacionesHikvision('192.168.3.220', 'admin', 'Control.1');
