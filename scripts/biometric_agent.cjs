const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const crypto = require('crypto');

const SUPABASE_URL = 'https://uevcotmnffftoelscjua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HIKVISION_CONFIG = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

async function isapiDigestFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const bodyData = options.body ? Buffer.from(options.body, 'utf-8') : null;

  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: HIKVISION_CONFIG.ipAddress,
      port: HIKVISION_CONFIG.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
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
        const ha1 = crypto.createHash('md5').update(`${HIKVISION_CONFIG.username}:${realm}:${HIKVISION_CONFIG.password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');
        
        let respStr;
        if (qop) {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let authHeader = `Digest username="${HIKVISION_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${respStr}"`;
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

async function runSyncCycle() {
  try {
    const path = '/ISAPI/AccessControl/AcsEvent?format=json';
    const initCond = { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 };
    const res1 = await isapiDigestFetch(path, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });
    
    if (!res1.ok || !res1.text) {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Esperando conexión con el biométrico 192.168.3.220...`);
      return;
    }

    const data1 = JSON.parse(res1.text);
    const totalEnMemoria = data1.AcsEvent?.totalMatches || 0;

    const startPos = Math.max(0, totalEnMemoria - 200);
    const batchCond = { searchID: "1", searchResultPosition: startPos, maxResults: 200, major: 0, minor: 0 };
    const res2 = await isapiDigestFetch(path, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });

    if (!res2.ok || !res2.text) return;

    const data2 = JSON.parse(res2.text);
    let lote = data2.AcsEvent?.InfoList || [];
    if (!Array.isArray(lote)) lote = [lote];

    const mappedLogs = lote
      .filter(ev => {
        let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
        const isAuthEvent = ev.minor === 21 || ev.minor === 22 || ev.minor === 38 || ev.minor === 1 || ev.minor === 75;
        if ((!rawNo || rawNo === '0') && isAuthEvent) rawNo = '24';
        if (rawNo === '18446744073709551613' || rawNo === '') return false;
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
          branchId: 'BRANCH-001',
          terminalId: 'TERM-001',
          timestamp: finalTimestamp,
          type: isExit ? 'EXIT' : 'ENTRY',
          verifyMethod: ev.currentVerifyMode || 'BIOMETRIC',
          doorNo: ev.doorNo || 1,
          serialNo: ev.serialNo ? Number(ev.serialNo) : undefined,
          attendanceStatus: isExit ? 'checkOut' : 'checkIn'
        };
      });

    const { data: existingState } = await supabase.from('app_state').select('value').eq('key', 'attendance_logs').single();
    const currentLogs = existingState?.value || [];
    const existingIds = new Set(currentLogs.map(l => l.id));

    const toAdd = mappedLogs.filter(l => !existingIds.has(l.id));

    if (toAdd.length > 0) {
      const updated = [...toAdd, ...currentLogs];
      await supabase.from('app_state').upsert({ key: 'attendance_logs', value: updated }, { onConflict: 'key' });
      await supabase.from('app_state').upsert({ key: 'attendance_logs_BRANCH-001', value: updated }, { onConflict: 'key' });
      console.log(`[${new Date().toLocaleTimeString()}] 🟢 Sincronizadas ${toAdd.length} nuevas asistencias a la Nube (Total: ${updated.length}).`);
    } else {
      if (currentLogs.length === 0 && mappedLogs.length > 0) {
        await supabase.from('app_state').upsert({ key: 'attendance_logs', value: mappedLogs }, { onConflict: 'key' });
        await supabase.from('app_state').upsert({ key: 'attendance_logs_BRANCH-001', value: mappedLogs }, { onConflict: 'key' });
      }
      console.log(`[${new Date().toLocaleTimeString()}] 🟢 Nube 100% al día (${currentLogs.length || mappedLogs.length} marcaciones).`);
    }
  } catch (err) {
    console.error('Error en ciclo de sincronización:', err.message);
  }
}

console.log('🚀 Agente de Sincronización Biométrico -> Supabase Nube iniciado (Ejecutándose cada 30s)...');
runSyncCycle();
setInterval(runSyncCycle, 30000);
