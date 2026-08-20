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
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';
  const r0 = await dig(acsUrl, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 } }) });
  const total = JSON.parse(r0.text).AcsEvent?.totalMatches || 0;
  console.log(`Total en memoria: ${total}`);

  // Sample at pos 0
  const rFirst = await dig(acsUrl, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 5, major: 0, minor: 0 } }) });
  const dFirst = JSON.parse(rFirst.text).AcsEvent?.InfoList || [];
  console.log('Pos 0 time:', dFirst[0]?.time, 'serialNo:', dFirst[0]?.serialNo);

  // Sample at pos (total - 3000)
  const pos3k = Math.max(0, total - 3000);
  const r3k = await dig(acsUrl, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: pos3k, maxResults: 5, major: 0, minor: 0 } }) });
  const d3k = JSON.parse(r3k.text).AcsEvent?.InfoList || [];
  console.log(`Pos ${pos3k} time:`, d3k[0]?.time, 'serialNo:', d3k[0]?.serialNo);

  // Sample at pos (total - 10)
  const rLast = await dig(acsUrl, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: total - 10, maxResults: 5, major: 0, minor: 0 } }) });
  const dLast = JSON.parse(rLast.text).AcsEvent?.InfoList || [];
  console.log(`Pos ${total-10} time:`, dLast[dLast.length-1]?.time, 'serialNo:', dLast[dLast.length-1]?.serialNo);
}

main().catch(console.error);
