import http from 'node:http';
import crypto from 'node:crypto';

function digestAuthFetch(urlStr, method, bodyStr, username, password) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    
    const req1 = http.request(url, { method, timeout: 5000 }, (res1) => {
      let body1 = '';
      res1.on('data', chunk => body1 += chunk);
      res1.on('end', () => {
        if (res1.statusCode !== 401) {
          return resolve({ statusCode: res1.statusCode, body: body1 });
        }

        const authHeader = res1.headers['www-authenticate'];
        if (!authHeader) return reject(new Error('No WWW-Authenticate header'));

        const realmMatch = authHeader.match(/realm="([^"]+)"/);
        const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
        const qopMatch = authHeader.match(/qop="([^"]+)"/);

        const realm = realmMatch ? realmMatch[1] : '';
        const nonce = nonceMatch ? nonceMatch[1] : '';
        const qop = qopMatch ? qopMatch[1] : '';

        const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${url.pathname}${url.search}`).digest('hex');

        const cnonce = crypto.randomBytes(8).toString('hex');
        const nc = '00000001';

        let response;
        if (qop) {
          response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let digestHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${url.pathname}${url.search}", response="${response}"`;
        if (qop) {
          digestHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
        }

        const req2 = http.request(url, {
          method,
          timeout: 5000,
          headers: {
            'Authorization': digestHeader,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr)
          }
        }, (res2) => {
          let body2 = '';
          res2.on('data', chunk => body2 += chunk);
          res2.on('end', () => {
            resolve({ statusCode: res2.statusCode, body: body2 });
          });
        });

        req2.on('error', reject);
        req2.write(bodyStr);
        req2.end();
      });
    });

    req1.on('error', reject);
    req1.on('timeout', () => { req1.destroy(); reject(new Error('Timeout req1')); });
    if (bodyStr) req1.write(bodyStr);
    req1.end();
  });
}

async function descargarTodasLasMarcacionesHikvision(ip, usuario, clave) {
  const acsUrl = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
  let posicion = 0;
  let marcacionesTotales = [];
  let totalEnMemoria = 0;

  console.log(`📡 Conectando a biométrico ${ip} con usuario '${usuario}'...`);

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
      const respuesta = await digestAuthFetch(acsUrl, 'POST', payload, usuario, clave);
      if (respuesta.statusCode !== 200) {
        console.error(`HTTP Status ${respuesta.statusCode}: ${respuesta.body}`);
        break;
      }

      const data = JSON.parse(respuesta.body);
      totalEnMemoria = data.AcsEvent?.totalMatches || 0;
      let loteActual = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(loteActual)) loteActual = [loteActual];

      if (loteActual.length === 0) break;

      marcacionesTotales.push(...loteActual);
      posicion += loteActual.length;

      if (posicion % 100 === 0 || posicion >= totalEnMemoria) {
        console.log(`⏳ Descargadas ${posicion} / ${totalEnMemoria} marcaciones...`);
      }
    } catch (err) {
      console.error('Error en iteración:', err);
      break;
    }
  } while (posicion < totalEnMemoria);

  console.log(`\n✅ EXTRACCIÓN COMPLETA: ${marcacionesTotales.length} eventos descargados de ${totalEnMemoria} en memoria.`);

  // Filtrar solo las que tengan attendanceStatus checkIn o checkOut
  const marcacionesValidas = marcacionesTotales.filter(m => 
    m.attendanceStatus === 'checkIn' || m.attendanceStatus === 'checkOut'
  );

  console.log(`🎯 Marcaciones válidas (attendanceStatus: checkIn / checkOut): ${marcacionesValidas.length}`);

  // Filtrar marcaciones del 5 de agosto de 2026
  const hoyStr = '2026-08-05';
  const marcacionesHoy = marcacionesValidas.filter(m => m.time && m.time.startsWith(hoyStr));
  console.log(`📅 Marcaciones de hoy (${hoyStr}): ${marcacionesHoy.length}`);

  marcacionesHoy.forEach(m => {
    console.log(`   - Emp #${m.employeeNoString} | Hora: ${m.time} | Estado: ${m.attendanceStatus} | Serial: ${m.serialNo}`);
  });

  return marcacionesTotales;
}

descargarTodasLasMarcacionesHikvision('192.168.3.220', 'admin', 'Control.1');
