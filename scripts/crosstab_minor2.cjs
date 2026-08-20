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
  
  // Sample from position 5000 (middle of data, where minor 38 events exist)
  let posicion = 5000;
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
    await new Promise(r => setTimeout(r, 20));
  } while (allEvents.length < 100);

  console.log(`Descargados: ${allEvents.length} eventos (desde posición 5000)`);

  // Cross-tab
  const crossTab = {};
  allEvents.forEach(ev => {
    const minor = ev.minor;
    const hasEmp = ev.employeeNoString && ev.employeeNoString !== '' && ev.employeeNoString !== '0';
    const key = `minor_${minor}`;
    if (!crossTab[key]) crossTab[key] = { withEmployee: 0, withoutEmployee: 0, samples: [] };
    if (hasEmp) {
      crossTab[key].withEmployee++;
      if (crossTab[key].samples.length < 3) {
        crossTab[key].samples.push({
          employeeNoString: ev.employeeNoString,
          minor: ev.minor,
          attendanceStatus: ev.attendanceStatus,
          time: ev.time,
          serialNo: ev.serialNo
        });
      }
    } else {
      crossTab[key].withoutEmployee++;
    }
  });

  console.log('\n=== CROSS-TAB: minor code × employeeNoString (pos 5000-5100) ===');
  Object.entries(crossTab).forEach(([key, val]) => {
    console.log(`\n${key}: ${val.withEmployee} CON empleado, ${val.withoutEmployee} SIN empleado`);
    if (val.samples.length > 0) {
      console.log('  Muestras CON empleado:');
      val.samples.forEach(s => console.log(`    emp="${s.employeeNoString}" status="${s.attendanceStatus}" time="${s.time}" serial=${s.serialNo}`));
    }
  });
}

main().catch(console.error);
