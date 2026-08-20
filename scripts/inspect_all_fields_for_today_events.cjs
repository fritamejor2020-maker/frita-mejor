const http = require('http');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = { ipAddress: '192.168.3.220', port: 80, username: 'admin', password: 'Control.1' };

function dig(pathStr, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? Buffer.from(opts.body) : null;
  return new Promise((resolve, reject) => {
    const o = {
      hostname: BIOMETRIC_CONFIG.ipAddress, port: BIOMETRIC_CONFIG.port, path: pathStr, method, timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close', ...(body ? { 'Content-Length': body.length } : {}) }
    };
    const r = http.request(o, rs => {
      if (rs.statusCode === 401) {
        const w = rs.headers['www-authenticate'] || '';
        const realm = (w.match(/realm="([^"]+)"/) || [])[1] || '';
        const nonce = (w.match(/nonce="([^"]+)"/) || [])[1] || '';
        const qop = (w.match(/qop="([^"]+)"/) || [])[1] || '';
        const ha1 = crypto.createHash('md5').update(`${BIOMETRIC_CONFIG.username}:${realm}:${BIOMETRIC_CONFIG.password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
        const resp = qop
          ? crypto.createHash('md5').update(`${ha1}:${nonce}:00000001:0a4f113b:${qop}:${ha2}`).digest('hex')
          : crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        let ah = `Digest username="${BIOMETRIC_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${pathStr}", response="${resp}"`;
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

async function inspectAllFieldsToday() {
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  // Query events for TODAY 2026-08-06 using date filter in AcsEventCond!
  console.log('🔎 Consultando biométrico para 2026-08-06...');
  const req = JSON.stringify({
    AcsEventCond: {
      searchID: "today1",
      searchResultPosition: 0,
      maxResults: 100,
      startTime: "2026-08-06T00:00:00-05:00",
      endTime: "2026-08-06T23:59:59-05:00"
    }
  });

  const res = await dig(acsUrl, { method: 'POST', body: req });
  if (!res.ok) {
    console.log('❌ Error al consultar biométrico');
    return;
  }

  const data = JSON.parse(res.text);
  const list = data.AcsEvent?.InfoList || [];
  const totalMatches = data.AcsEvent?.totalMatches || 0;
  console.log(`📌 Total matches reportados por filtro de fecha hoy: ${totalMatches}`);
  console.log(`📋 Obtenidos en este lote: ${list.length}`);

  console.log('\n--- DETALLE COMPLETO DE CADA EVENTO DE HOY ---');
  list.forEach((ev, idx) => {
    console.log(`\nEvent #${idx + 1} (Serial: ${ev.serialNo}):`);
    console.log(`  employeeNoString: "${ev.employeeNoString}"`);
    console.log(`  employeeNo:       "${ev.employeeNo}"`);
    console.log(`  cardNo:           "${ev.cardNo}"`);
    console.log(`  time:             "${ev.time}"`);
    console.log(`  attendanceStatus: "${ev.attendanceStatus}"`);
    console.log(`  major:            ${ev.major}`);
    console.log(`  minor:            ${ev.minor}`);
    console.log(`  doorNo:           ${ev.doorNo}`);
    console.log(`  cardReaderNo:     ${ev.cardReaderNo}`);
    console.log(`  type:             ${ev.type}`);
    console.log(`  statusValue:      ${ev.statusValue}`);
    console.log(`  LABEL/RAW:        ${JSON.stringify(ev)}`);
  });
}

inspectAllFieldsToday().catch(console.error);
