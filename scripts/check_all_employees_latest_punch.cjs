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
  
  // Download last 3000 events
  const r0 = await dig(acsUrl, { method: 'POST', body: JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 } }) });
  const total = JSON.parse(r0.text).AcsEvent?.totalMatches || 0;
  
  let posicion = Math.max(0, total - 3000);
  let allEvents = [];
  
  do {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: posicion, maxResults: 10, major: 0, minor: 0 } });
    const res = await dig(acsUrl, { method: 'POST', body: payload });
    if (!res.ok) break;
    const data = JSON.parse(res.text);
    const batch = data.AcsEvent?.InfoList || [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    allEvents.push(...batch);
    posicion += batch.length;
    await new Promise(r => setTimeout(r, 10));
  } while (posicion < total);

  console.log(`Analizando los últimos ${allEvents.length} eventos (de posición ${total-3000} a ${total})...`);

  // Track latest punch per employeeNoString
  const latestByEmp = {};
  allEvents.forEach(ev => {
    const emp = ev.employeeNoString;
    if (!emp || emp === '0' || emp === '18446744073709551613') return;
    if (!latestByEmp[emp]) {
      latestByEmp[emp] = { firstSeen: ev.time, lastSeen: ev.time, count: 0 };
    }
    latestByEmp[emp].lastSeen = ev.time;
    latestByEmp[emp].count++;
  });

  console.log('\n📊 Última marcación registrada por Empleado (en las últimas 3,000 marcaciones):');
  Object.entries(latestByEmp).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([emp, data]) => {
    console.log(`Empleado #${emp.padEnd(4)} | Total marcas: ${String(data.count).padEnd(4)} | Primera: ${data.firstSeen} | Última: ${data.lastSeen}`);
  });
}

main().catch(console.error);
