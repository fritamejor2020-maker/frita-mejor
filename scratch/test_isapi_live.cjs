const http = require('http');
const crypto = require('crypto');

const config = {
  ip: '192.168.3.220',
  port: 80,
  user: 'admin',
  pass: 'Control.1'
};

function parseWwwAuthenticate(header) {
  if (!header) return null;
  const challenge = {};
  const matches = header.matchAll(/(\w+)=["']?([^"',]+)["']?/g);
  for (const match of matches) {
    challenge[match[1]] = match[2];
  }
  return challenge;
}

function generateDigestHeader(method, path, challenge) {
  const cnonce = crypto.randomBytes(8).toString('hex');
  const nc = '00000001';
  const ha1 = crypto.createHash('md5').update(`${config.user}:${challenge.realm}:${config.pass}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');
  
  let response;
  if (challenge.qop) {
    response = crypto.createHash('md5').update(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`).digest('hex');
  } else {
    response = crypto.createHash('md5').update(`${ha1}:${challenge.nonce}:${ha2}`).digest('hex');
  }

  let header = `Digest username="${config.user}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${path}", response="${response}"`;
  if (challenge.qop) {
    header += `, qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}"`;
  }
  if (challenge.opaque) {
    header += `, opaque="${challenge.opaque}"`;
  }
  return header;
}

async function requestISAPI(path, method = 'POST', bodyData = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.ip,
      port: config.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 401) {
        const wwwAuth = res.headers['www-authenticate'];
        const challenge = parseWwwAuthenticate(wwwAuth);
        if (!challenge || !challenge.nonce) {
          return resolve({ status: res.statusCode, body: 'No challenge' });
        }

        const digestHeader = generateDigestHeader(method, path, challenge);
        const retryOpts = {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': digestHeader
          }
        };

        const retryReq = http.request(retryOpts, (retryRes) => {
          let data = '';
          retryRes.on('data', chunk => data += chunk);
          retryRes.on('end', () => resolve({ status: retryRes.statusCode, body: data }));
        });
        retryReq.on('error', reject);
        if (bodyData) retryReq.write(bodyData);
        retryReq.end();
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function main() {
  console.log('--- Probando conexión ISAPI a 192.168.3.220 ---');
  try {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 10,
        major: 0,
        minor: 0
      }
    });
    const res = await requestISAPI('/ISAPI/AccessControl/AcsEvent?format=json', 'POST', payload);
    console.log('Status:', res.status);
    console.log('Body length:', res.body ? res.body.length : 0);
    if (res.body) {
      console.log('Sample Body:', res.body.slice(0, 1000));
      try {
        const json = JSON.parse(res.body);
        console.log('Total matches:', json.AcsEvent?.totalMatches);
        const total = json.AcsEvent?.totalMatches || 0;
        if (total > 0) {
          // Consultar los últimos 10
          const lastPos = Math.max(0, total - 10);
          const lastPayload = JSON.stringify({
            AcsEventCond: {
              searchID: "1",
              searchResultPosition: lastPos,
              maxResults: 10,
              major: 0,
              minor: 0
            }
          });
          const lastRes = await requestISAPI('/ISAPI/AccessControl/AcsEvent?format=json', 'POST', lastPayload);
          console.log('\n--- ÚLTIMAS 10 MARCACIONES EN VIVO ---');
          console.log(lastRes.body);
        }
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }
  } catch (err) {
    console.error('Error de conexión:', err.message);
  }
}

main();
