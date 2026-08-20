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
  
  let posicion = 0;
  const maxPos = 7800;
  let allEvents = [];

  do {
    const payload = JSON.stringify({ AcsEventCond: { searchID: "1", searchResultPosition: posicion, maxResults: 10, major: 0, minor: 0 } });
    try {
      const res = await dig(acsUrl, { method: 'POST', body: payload });
      if (!res.ok) break;
      const data = JSON.parse(res.text);
      const batch = data.AcsEvent?.InfoList || [];
      if (!Array.isArray(batch) || batch.length === 0) break;
      allEvents.push(...batch);
      posicion += batch.length;
      await new Promise(r => setTimeout(r, 5));
    } catch (e) { break; }
  } while (posicion < maxPos);

  console.log(`Revisando ${allEvents.length} eventos del biométrico...`);

  // Filter events with employeeNoString
  const empEvents = allEvents.filter(ev => ev.employeeNoString && ev.employeeNoString !== '' && ev.employeeNoString !== '0');
  console.log(`Eventos con employeeNoString: ${empEvents.length}`);

  // Count raw attendanceStatus values
  const statusMap = {};
  empEvents.forEach(ev => {
    const st = String(ev.attendanceStatus);
    statusMap[st] = (statusMap[st] || 0) + 1;
  });

  console.log('\n📊 Valores exactos de ev.attendanceStatus en el biométrico:');
  console.log(statusMap);

  // Show samples of events where attendanceStatus IS NOT "undefined"
  const nonUndefined = empEvents.filter(ev => String(ev.attendanceStatus) !== 'undefined');
  console.log(`\nEventos donde attendanceStatus NO ES "undefined": ${nonUndefined.length}`);
  nonUndefined.slice(0, 20).forEach((ev, i) => {
    console.log(`  [${i}] emp=${ev.employeeNoString} status="${ev.attendanceStatus}" time="${ev.time}" minor=${ev.minor} serial=${ev.serialNo}`);
  });
}

main().catch(console.error);
