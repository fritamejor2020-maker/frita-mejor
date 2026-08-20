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

async function inspectMinor21And22() {
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  for (const m of [21, 22]) {
    const initCond = { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 5, minor: m };
    const res1 = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });
    const data1 = JSON.parse(res1.text);
    const totalMatches = data1.AcsEvent?.totalMatches || 0;
    console.log(`Minor ${m} totalMatches: ${totalMatches}`);

    const startPos = Math.max(0, totalMatches - 10);
    const batchCond = { searchID: "1", searchResultPosition: startPos, maxResults: 10, major: 5, minor: m };
    const resBatch = await isapiDigestFetchSingle(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });
    const dataBatch = JSON.parse(resBatch.text);
    const events = dataBatch.AcsEvent?.InfoList || [];

    console.log(`Latest 10 events for Minor ${m}:`);
    events.forEach(ev => {
      console.log(JSON.stringify(ev));
    });
  }
}

inspectMinor21And22();
