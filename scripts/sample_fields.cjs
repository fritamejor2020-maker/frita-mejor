const http = require('http');
const crypto = require('crypto');

const CFG = { ip: '192.168.3.220', port: 80, user: 'admin', pass: 'Control.1' };

function dig(pathStr, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? Buffer.from(opts.body) : null;
  return new Promise((resolve, reject) => {
    const o = {
      hostname: CFG.ip, port: CFG.port, path: pathStr, method, timeout: 4000,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close', ...(body ? { 'Content-Length': body.length } : {}) }
    };
    const r = http.request(o, rs => {
      if (rs.statusCode === 401) {
        const w = rs.headers['www-authenticate'] || '';
        const realm = (w.match(/realm="([^"]+)"/) || [])[1] || '';
        const nonce = (w.match(/nonce="([^"]+)"/) || [])[1] || '';
        const qop = (w.match(/qop="([^"]+)"/) || [])[1] || '';
        const ha1 = crypto.createHash('md5').update(`${CFG.user}:${realm}:${CFG.pass}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
        const resp = qop
          ? crypto.createHash('md5').update(`${ha1}:${nonce}:00000001:0a4f113b:${qop}:${ha2}`).digest('hex')
          : crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        let ah = `Digest username="${CFG.user}", realm="${realm}", nonce="${nonce}", uri="${pathStr}", response="${resp}"`;
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

async function main() {
  // Grab first page to see ALL fields of a raw event
  const payload = JSON.stringify({ AcsEventCond: { searchID: '1', searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 } });
  const r = await dig('/ISAPI/AccessControl/AcsEvent?format=json', { method: 'POST', body: payload });
  const data = JSON.parse(r.text);
  const list = data.AcsEvent?.InfoList || [];

  console.log('=== ALL FIELDS of event[0] ===');
  console.log(JSON.stringify(list[0], null, 2));

  const withEmp = list.find(e => e.employeeNoString && e.employeeNoString !== '' && e.employeeNoString !== '0');
  if (withEmp) {
    console.log('\n=== ALL FIELDS of first event with employeeNoString ===');
    console.log(JSON.stringify(withEmp, null, 2));
  }

  // Grab a page with major=5 minor=75 to see checkIn events
  const p21 = JSON.stringify({ AcsEventCond: { searchID: '1', searchResultPosition: 0, maxResults: 10, major: 5, minor: 75 } });
  const r21 = await dig('/ISAPI/AccessControl/AcsEvent?format=json', { method: 'POST', body: p21 });
  const d21 = JSON.parse(r21.text);
  const l21 = d21.AcsEvent?.InfoList || [];
  console.log('\n=== major=5, minor=75 sample (first 3) ===');
  l21.slice(0, 3).forEach((e, i) => console.log(`[${i}]`, JSON.stringify({ employeeNoString: e.employeeNoString, minor: e.minor, major: e.major, attendanceStatus: e.attendanceStatus, time: e.time, serialNo: e.serialNo })));
}

main().catch(console.error);
