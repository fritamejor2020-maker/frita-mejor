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

async function isapiDigestFetchWithRetry(pathStr, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await isapiDigestFetchSingle(pathStr, options);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`⚠️ Socket warning (${err.code || err.message}). Retrying attempt ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 250));
    }
  }
}

function isapiDigestFetchSingle(pathStr, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const bodyData = options.body ? Buffer.from(options.body, 'utf-8') : null;

  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: BIOMETRIC_CONFIG.ipAddress,
      port: BIOMETRIC_CONFIG.port,
      path: pathStr,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
        'Connection': 'close', // Evita acumulacion de sockets abiertos en el biométrico
        ...(bodyData ? { 'Content-Length': bodyData.length } : {})
      }
    };

    const req = http.request(reqOpts, (res) => {
      if (res.statusCode === 401) {
        const wwwAuth = res.headers['www-authenticate'] || '';
        const realm = (wwwAuth.match(/realm="([^"]+)"/) || [])[1] || '';
        const nonce = (wwwAuth.match(/nonce="([^"]+)"/) || [])[1] || '';
        const qop = (wwwAuth.match(/qop="([^"]+)"/) || [])[1] || '';

        const cnonce = '0a4f113b';
        const nc = '00000001';
        const ha1 = crypto.createHash('md5').update(`${BIOMETRIC_CONFIG.username}:${realm}:${BIOMETRIC_CONFIG.password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
        
        let respStr;
        if (qop) {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let authHeader = `Digest username="${BIOMETRIC_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${pathStr}", response="${respStr}"`;
        if (qop) authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

        const retryOpts = {
          ...reqOpts,
          headers: {
            ...reqOpts.headers,
            'Authorization': authHeader
          }
        };

        const req2 = http.request(retryOpts, (res2) => {
          let body = '';
          res2.on('data', c => body += c);
          res2.on('end', () => resolve({ ok: res2.statusCode === 200, status: res2.statusCode, text: body }));
        });
        req2.on('error', reject);
        if (bodyData) req2.write(bodyData);
        req2.end();
      } else {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, text: body }));
      }
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function postToSupabase(key, value) {
  const payload = JSON.stringify({ key, value });
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      path: '/rest/v1/app_state',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body }));
    });
    
    req.on('error', () => resolve({ ok: false }));
    req.write(payload);
    req.end();
  });
}

async function getFromSupabase(key) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: SUPABASE_REST_HOST,
      path: `/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_REST_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_ANON_KEY}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json && json[0] ? json[0].value : null);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

async function runTestSync() {
  console.log('🚀 Initiating Robust Electron Biometric Extraction (Connection: close + retry)...');
  const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';

  const initCond = { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 };
  const res1 = await isapiDigestFetchWithRetry(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });
  
  if (!res1.ok || !res1.text) {
    console.error('❌ Failed to connect to Hikvision terminal on 192.168.3.220:80');
    return;
  }

  const data1 = JSON.parse(res1.text);
  const totalEnMemoria = data1.AcsEvent?.totalMatches || 0;
  console.log(`📊 Device Total Matches in Memory: ${totalEnMemoria}`);

  let posicion = Math.max(0, totalEnMemoria - 150); // Fetch recent 150 events
  const pageSize = 30;
  let marcacionesTotales = [];

  do {
    const batchCond = {
      searchID: "1",
      searchResultPosition: posicion,
      maxResults: pageSize,
      major: 0,
      minor: 0
    };

    try {
      const resBatch = await isapiDigestFetchWithRetry(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });
      if (!resBatch.ok || !resBatch.text) break;

      const dataBatch = JSON.parse(resBatch.text);
      let loteActual = dataBatch.AcsEvent?.InfoList || [];
      if (!Array.isArray(loteActual)) loteActual = [loteActual];
      if (loteActual.length === 0) break;

      marcacionesTotales.push(...loteActual);
      posicion += loteActual.length;
      console.log(`Fetched page position ${posicion}/${totalEnMemoria} (${loteActual.length} events)`);

      // Pausa prudente entre peticiones HTTP para cuidar el microcontrolador Hikvision
      await new Promise(r => setTimeout(r, 60));
    } catch (err) {
      console.error(`Page position ${posicion} failed:`, err.message);
      break;
    }

  } while (posicion < totalEnMemoria);

  console.log(`Total events fetched from device: ${marcacionesTotales.length}`);

  const deletedLogIds = await getFromSupabase('deleted_attendance_log_ids') || [];
  const deletedSet = new Set(deletedLogIds);

  const mappedLogs = marcacionesTotales
    .filter(ev => {
      let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
      const isAuthEvent = ev.minor === 21 || ev.minor === 22 || ev.minor === 38 || ev.minor === 1 || ev.minor === 75;
      if ((!rawNo || rawNo === '0') && isAuthEvent) rawNo = '24';
      if (rawNo === '18446744073709551613' || rawNo === '') return false;

      if (ev.serialNo != null) {
        const serialStr = String(ev.serialNo);
        if (deletedSet.has(serialStr) || deletedSet.has(`LOG-TERM-001-${serialStr}`)) return false;
      }
      return true;
    })
    .map(ev => {
      let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '0').trim();
      if ((!rawNo || rawNo === '0') && (ev.minor === 21 || ev.minor === 22 || ev.minor === 38 || ev.minor === 1 || ev.minor === 75)) {
        rawNo = '24';
      }
      const rawStatus = String(ev.attendanceStatus || '').toLowerCase();
      const isExit = rawStatus === 'checkout' || rawStatus === 'exit' || rawStatus === 'check_out' || rawStatus === 'out' || ev.statusValue === 2 || ev.minor === 22;
      const finalTimestamp = ev.time || new Date().toISOString();
      const logId = ev.serialNo ? `LOG-TERM-001-${ev.serialNo}` : `LOG-TERM-001-${rawNo}-${finalTimestamp.slice(0, 19)}`;
      
      return {
        id: logId,
        employeeId: `EMP-${rawNo}`,
        employeeNo: rawNo,
        serialNo: ev.serialNo ? Number(ev.serialNo) : undefined,
        attendanceStatus: isExit ? 'checkOut' : 'checkIn',
        timestamp: finalTimestamp,
        type: isExit ? 'EXIT' : 'ENTRY',
        branchId: 'BRANCH-001',
        terminalId: 'TERM-001',
        verifyMethod: ev.currentVerifyMode || 'BIOMETRIC',
        doorNo: ev.doorNo || 1
      };
    });

  console.log(`Mapped logs count: ${mappedLogs.length}`);

  const currentLogs = await getFromSupabase('attendance_logs') || [];
  const existingIds = new Set(currentLogs.map(l => l.id));

  const toAdd = mappedLogs.filter(l => !existingIds.has(l.id));

  if (toAdd.length > 0) {
    const updated = [...toAdd, ...currentLogs];
    await postToSupabase('attendance_logs', updated);
    await postToSupabase('attendance_logs_BRANCH-001', updated);
    console.log(`✅ Upserted ${toAdd.length} new biometric events to Supabase!`);
  } else {
    console.log('✅ Supabase is already 100% up to date with device logs.');
  }
}

runTestSync();
