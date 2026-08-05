import http from 'node:http';
import crypto from 'node:crypto';

function testPassword(pwd) {
  return new Promise((resolve) => {
    const url = new URL('http://192.168.3.220/ISAPI/System/deviceInfo');
    const req1 = http.request(url, { method: 'GET' }, (res1) => {
      let body1 = '';
      res1.on('data', c => body1 += c);
      res1.on('end', () => {
        if (res1.statusCode !== 401) {
          console.log(`Password '${pwd}': HTTP ${res1.statusCode}`);
          return resolve(false);
        }
        const authHeader = res1.headers['www-authenticate'];
        if (!authHeader) return resolve(false);

        const realmMatch = authHeader.match(/realm="([^"]+)"/);
        const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
        const qopMatch = authHeader.match(/qop="([^"]+)"/);

        const realm = realmMatch ? realmMatch[1] : '';
        const nonce = nonceMatch ? nonceMatch[1] : '';
        const qop = qopMatch ? qopMatch[1] : '';

        const ha1 = crypto.createHash('md5').update(`admin:${realm}:${pwd}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`GET:/ISAPI/System/deviceInfo`).digest('hex');
        const cnonce = crypto.randomBytes(8).toString('hex');
        const nc = '00000001';

        let response;
        if (qop) {
          response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let digestHeader = `Digest username="admin", realm="${realm}", nonce="${nonce}", uri="/ISAPI/System/deviceInfo", response="${response}"`;
        if (qop) digestHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

        const req2 = http.request(url, {
          method: 'GET',
          headers: { 'Authorization': digestHeader }
        }, (res2) => {
          let body2 = '';
          res2.on('data', c => body2 += c);
          res2.on('end', () => {
            console.log(`Password '${pwd}': HTTP ${res2.statusCode}`);
            if (res2.statusCode === 200) {
              console.log('SUCCESS! Body snippet:', body2.slice(0, 200));
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });

        req2.end();
      });
    });
    req1.end();
  });
}

async function run() {
  const passwords = ['Frita123', 'Control.1', 'admin', 'admin123', '12345', '123456'];
  for (const pwd of passwords) {
    const ok = await testPassword(pwd);
    if (ok) break;
  }
}

run();
