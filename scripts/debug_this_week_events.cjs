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
  
  // Download last 500 events
  let posicion = Math.max(0, total - 500);
  let recentEvents = [];
  
  do {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: posicion, maxResults: 10, major: 0, minor: 0 } });
    const res = await dig(acsUrl, { method: 'POST', body: payload });
    if (!res.ok) break;
    const data = JSON.parse(res.text);
    const batch = data.AcsEvent?.InfoList || [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    recentEvents.push(...batch);
    posicion += batch.length;
    await new Promise(r => setTimeout(r, 15));
  } while (posicion < total);

  console.log(`Descargados ${recentEvents.length} eventos recientes.`);

  // Filter events from Aug 1 to Aug 6, 2026
  const augEvents = recentEvents.filter(ev => {
    const t = ev.time || '';
    return t.includes('2026-08-') || t.includes('2026-07-31');
  });

  console.log(`\n📅 Eventos desde el 1 de Agosto (total: ${augEvents.length}):`);
  
  // Group by employee and minor code
  const summary = {};
  augEvents.forEach(ev => {
    const emp = ev.employeeNoString || 'VACIO';
    const minor = ev.minor;
    const status = ev.attendanceStatus;
    const time = ev.time;
    if (!summary[emp]) summary[emp] = [];
    summary[emp].push({ minor, status, time, serialNo: ev.serialNo, cardNo: ev.cardNo });
  });

  Object.entries(summary).sort().forEach(([emp, logs]) => {
    console.log(`\n👤 Empleado #${emp} (${logs.length} marcas en Agosto):`);
    logs.forEach(l => {
      console.log(`   - Time: ${l.time} | minor: ${l.minor} | status: "${l.status}" | serial: ${l.serialNo}`);
    });
  });
}

main().catch(console.error);
