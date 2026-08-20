const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BIOMETRIC_CONFIG = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

const SUPABASE_REST_HOST = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_REST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

function getFromSupabaseNative(key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const arr = JSON.parse(b);
            resolve(arr && arr[0] ? arr[0].value : null);
          } else resolve(null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function postToSupabaseNative(key, value) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ key, value, updated_at: new Date().toISOString() });
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      port: 443,
      path: `/rest/v1/app_state`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        console.log(`POST [${key}] HTTP ${res.statusCode}`);
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
    });
    req.on('error', (e) => { console.error('POST err:', e); resolve(false); });
    req.write(payload);
    req.end();
  });
}

function dig(pathStr, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? Buffer.from(opts.body) : null;
  return new Promise((resolve, reject) => {
    const o = {
      hostname: BIOMETRIC_CONFIG.ipAddress, port: BIOMETRIC_CONFIG.port, path: pathStr, method, timeout: 4000,
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

async function main() {
  console.log('🚀 Leyendo posiciones 0 a 7800 (todas las marcaciones brutas de empleados)...');
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
      process.stdout.write(`Obtenidas ${allEvents.length} marcaciones (${posicion}/${maxPos})...\r`);
      await new Promise(r => setTimeout(r, 6));
    } catch (e) {
      break;
    }
  } while (posicion < maxPos);

  console.log(`\n✅ Lectura del biométrico completada: ${allEvents.length} marcaciones obtenidas.`);

  // Filter valid employees & map 1-to-1 directly with 4 key variables
  const mappedLogs = allEvents
    .filter(ev => {
      let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
      if (!rawNo || rawNo === '0' || rawNo === '18446744073709551613') return false;
      return true;
    })
    .map(ev => {
      let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
      const rawStatus = String(ev.attendanceStatus || '').toLowerCase();
      const isExit = rawStatus === 'checkout' || rawStatus === 'exit' || rawStatus === 'check_out' || rawStatus === 'out' || rawStatus === 'overtimeout' || ev.minor === 22;
      const finalTimestamp = ev.time || new Date().toISOString();
      const logId = ev.serialNo ? `LOG-TERM-001-${ev.serialNo}` : `LOG-TERM-001-${rawNo}-${finalTimestamp.slice(0, 19)}`;

      return {
        id: logId,
        employeeId: `EMP-${rawNo}`,
        employeeNo: rawNo,
        serialNo: ev.serialNo ? Number(ev.serialNo) : undefined,
        attendanceStatus: isExit ? 'checkOut' : (ev.attendanceStatus && ev.attendanceStatus !== 'undefined' ? ev.attendanceStatus : 'checkIn'),
        timestamp: finalTimestamp,
        type: isExit ? 'EXIT' : 'ENTRY',
        branchId: 'BRANCH-001',
        terminalId: 'TERM-001',
        verifyMethod: ev.currentVerifyMode || 'BIOMETRIC',
        doorNo: ev.doorNo || 1
      };
    });

  console.log(`📋 Total de registros 1-a-1 de asistencia formateados: ${mappedLogs.length}`);

  // Fetch current logs from Supabase to merge
  const currentLogs = await getFromSupabaseNative('attendance_logs') || [];
  console.log(`Logs existentes en Supabase: ${currentLogs.length}`);

  const existingIds = new Set(currentLogs.map(l => l.id));
  const newLogs = mappedLogs.filter(l => !existingIds.has(l.id));
  console.log(`Nuevos logs a agregar: ${newLogs.length}`);

  const mergedLogs = [...currentLogs, ...newLogs];
  console.log(`Total logs finales combinados: ${mergedLogs.length}`);

  // Push to Supabase app_state
  console.log('\n☁️ Guardando en Supabase...');
  const ok1 = await postToSupabaseNative('attendance_logs', mergedLogs);
  const ok2 = await postToSupabaseNative('attendance_logs_BRANCH-001', mergedLogs);

  if (ok1 && ok2) {
    console.log(`\n🎉 ¡ÉXITO TOTAL! ${mergedLogs.length} marcaciones 1-a-1 guardadas exitosamente en Supabase.`);
  } else {
    console.error(`❌ Falló la subida: ok1=${ok1}, ok2=${ok2}`);
  }
}

main().catch(console.error);
