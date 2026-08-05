const http = require('http');
const crypto = require('crypto');

const payload = JSON.stringify({
  AcsEventCond: {
    searchID: "1",
    searchResultPosition: 26028,
    maxResults: 20,
    major: 0,
    minor: 0
  }
});

const payloadBuffer = Buffer.from(payload, 'utf-8');

console.log('Querying latest events (pos 26028 to 26034)...');

const req = http.request('http://192.168.3.220/ISAPI/AccessControl/AcsEvent?format=json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': payloadBuffer.length
  }
}, (res) => {
  const wwwAuth = res.headers['www-authenticate'];
  const realm = (wwwAuth.match(/realm="([^"]+)"/) || [])[1] || '';
  const nonce = (wwwAuth.match(/nonce="([^"]+)"/) || [])[1] || '';
  const qop = (wwwAuth.match(/qop="([^"]+)"/) || [])[1] || '';

  const cnonce = '0a4f113b';
  const nc = '00000001';
  const uri = '/ISAPI/AccessControl/AcsEvent?format=json';

  const ha1 = crypto.createHash('md5').update(`admin:${realm}:Control.1`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`POST:${uri}`).digest('hex');
  const respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');

  const digestHeader = `Digest username="admin", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${respStr}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

  const req2 = http.request('http://192.168.3.220/ISAPI/AccessControl/AcsEvent?format=json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Content-Length': payloadBuffer.length,
      'Authorization': digestHeader
    }
  }, (res2) => {
    let body = '';
    res2.on('data', c => body += c);
    res2.on('end', () => {
      try {
        const json = JSON.parse(body);
        console.log('Total matches:', json.AcsEvent?.totalMatches);
        const list = json.AcsEvent?.InfoList || [];
        console.log(`Fetched ${list.length} events:`);
        list.forEach(ev => {
          console.log(`Serial #${ev.serialNo} | Emp: ${ev.employeeNoString} | Card: ${ev.cardNo} | Time: ${ev.time} | Status: ${ev.attendanceStatus} | Minor: ${ev.minor}`);
        });
      } catch (e) {
        console.log('Body:', body.slice(0, 1000));
      }
    });
  });

  req2.write(payloadBuffer);
  req2.end();
});

req.write(payloadBuffer);
req.end();
