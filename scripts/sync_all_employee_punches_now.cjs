const http = require('http');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const CFG = { ip: '192.168.3.220', port: 80, user: 'admin', pass: 'Control.1' };
const SUPABASE_URL = 'https://lxsfwybidxkuzicowpxd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4c2Z3eWJpZHhrdXppY293cHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MTg5NzksImV4cCI6MjA2OTE5NDk3OX0.XfT0eL-9rXF6gQ-aJ52d43lJ3956s-Z_E1aV8hG-5p0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  console.log('🚀 Escaneando posiciones 0 a 8000 (donde residen TODAS las marcaciones de empleados)...');
  const acsUrl = '/ISAPI/AccessControl/AcsEvent?format=json';

  let posicion = 0;
  const maxPos = 8000;
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
      process.stdout.write(`Obtenidas ${allEvents.length} marcaciones (posición ${posicion}/${maxPos})...\r`);
      await new Promise(r => setTimeout(r, 10));
    } catch (e) {
      break;
    }
  } while (posicion < maxPos);

  console.log(`\n✅ Lectura completada: ${allEvents.length} marcaciones en total.`);

  // Filter valid employees
  const validEvents = allEvents.filter(ev => {
    const emp = ev.employeeNoString;
    return emp && emp !== '' && emp !== '0' && emp !== '18446744073709551613';
  });

  console.log(`👤 Eventos con empleado válido: ${validEvents.length}`);

  // Group by employee and local date
  const byEmpDay = {};
  validEvents.forEach(ev => {
    const emp = String(ev.employeeNoString).trim();
    const ts = ev.time || '';
    const dateStr = ts.slice(0, 10);
    const key = `${emp}_${dateStr}`;
    if (!byEmpDay[key]) byEmpDay[key] = [];
    byEmpDay[key].push(ev);
  });

  // Map to attendance_logs structure
  const mappedLogs = [];
  Object.values(byEmpDay).forEach(dayEvents => {
    dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const first = dayEvents[0];
    const last = dayEvents[dayEvents.length - 1];
    const emp = String(first.employeeNoString).trim();

    // ENTRY
    const ts1 = first.time || new Date().toISOString();
    const id1 = first.serialNo ? `LOG-TERM-001-${first.serialNo}` : `LOG-TERM-001-${emp}-${ts1.slice(0, 19)}`;
    mappedLogs.push({
      id: id1,
      employeeId: `EMP-${emp}`,
      employeeNo: emp,
      serialNo: first.serialNo ? Number(first.serialNo) : undefined,
      attendanceStatus: 'checkIn',
      timestamp: ts1,
      type: 'ENTRY',
      branchId: 'BRANCH-001',
      terminalId: 'TERM-001',
      verifyMethod: first.currentVerifyMode || 'BIOMETRIC',
      doorNo: first.doorNo || 1
    });

    // EXIT (if last is different from first)
    if (last.serialNo !== first.serialNo) {
      const ts2 = last.time || new Date().toISOString();
      const id2 = last.serialNo ? `LOG-TERM-001-${last.serialNo}` : `LOG-TERM-001-${emp}-${ts2.slice(0, 19)}`;
      mappedLogs.push({
        id: id2,
        employeeId: `EMP-${emp}`,
        employeeNo: emp,
        serialNo: last.serialNo ? Number(last.serialNo) : undefined,
        attendanceStatus: 'checkOut',
        timestamp: ts2,
        type: 'EXIT',
        branchId: 'BRANCH-001',
        terminalId: 'TERM-001',
        verifyMethod: last.currentVerifyMode || 'BIOMETRIC',
        doorNo: last.doorNo || 1
      });
    }
  });

  console.log(`📋 Registros formateados (ENTRY + EXIT): ${mappedLogs.length}`);

  // Count per employee for the week of Aug 3 to Aug 9
  const augLogs = mappedLogs.filter(l => l.timestamp.includes('2026-08-'));
  console.log(`\n📅 Registros para Agosto 2026: ${augLogs.length}`);
  
  const empAugCount = {};
  augLogs.forEach(l => {
    empAugCount[l.employeeNo] = (empAugCount[l.employeeNo] || 0) + 1;
  });
  
  console.log('\n📊 Empleados con marcaciones en Agosto 2026:');
  Object.entries(empAugCount).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([emp, count]) => {
    console.log(`  Empleado #${emp}: ${count} marcaciones`);
  });

  // Save to Supabase
  console.log('\n☁️ Subiendo marcaciones a Supabase...');
  const { error: err1 } = await supabase.from('attendance_logs').upsert(mappedLogs, { onConflict: 'id' });
  const { error: err2 } = await supabase.from('attendance_logs_BRANCH-001').upsert(mappedLogs, { onConflict: 'id' });

  if (err1 || err2) {
    console.error('❌ Error guardando en Supabase:', err1 || err2);
  } else {
    console.log(`✅ ¡ÉXITO TOTAL! ${mappedLogs.length} marcaciones guardadas en Supabase para todos los empleados.`);
  }
}

main().catch(console.error);
