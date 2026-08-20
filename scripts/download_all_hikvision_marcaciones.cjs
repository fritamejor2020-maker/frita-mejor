const http = require('http');
const crypto = require('crypto');
const https = require('https');

const BIOMETRIC_CONFIG = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

const SUPABASE_URL = 'uevcotmnffftoelscjua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';

async function isapiDigestFetchSingle(pathStr, options = {}) {
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
        'Connection': 'close',
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
      hostname: SUPABASE_URL,
      path: '/rest/v1/app_state',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }));
    });
    
    req.on('error', () => resolve({ ok: false }));
    req.write(payload);
    req.end();
  });
}

async function descargarTodasLasMarcacionesHikvision(ip, usuario, clave) {
  const acsUrl = `/ISAPI/AccessControl/AcsEvent?format=json`;
  let posicion = 0;
  let marcacionesTotales = [];
  let totalEnMemoria = 0;

  do {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: posicion,
        maxResults: 30, // Paginación optimizada para no colapsar el biométrico
        major: 0,
        minor: 0
      }
    });

    try {
      const respuesta = await isapiDigestFetchSingle(acsUrl, { method: 'POST', body: payload });
      if (!respuesta.ok || !respuesta.text) break;

      const data = JSON.parse(respuesta.text);
      totalEnMemoria = data.AcsEvent?.totalMatches || 0;
      const loteActual = data.AcsEvent?.InfoList || [];

      if (!Array.isArray(loteActual) || loteActual.length === 0) break;

      marcacionesTotales.push(...loteActual);
      posicion += loteActual.length;

      // Pausa prudente de 40ms entre llamadas
      await new Promise(r => setTimeout(r, 40));
    } catch (e) {
      break;
    }

  } while (posicion < totalEnMemoria);

  return marcacionesTotales;
}

async function ejecutarProcesamientoMarcaciones() {
  console.log('🚀 Iniciando descargarTodasLasMarcacionesHikvision...');
  const marcacionesTotales = await descargarTodasLasMarcacionesHikvision('192.168.3.220', 'admin', 'Control.1');
  console.log(`✅ Descargadas ${marcacionesTotales.length} marcaciones brutas del biométrico.`);

  // Analizar eventos que contienen employeeNoString, serialNo, attendanceStatus, time
  const marcacionesFiltradas = marcacionesTotales
    .filter(ev => {
      // Filtrar marcaciones relevantes con employeeNoString
      const empNo = String(ev.employeeNoString || ev.employeeNo || '').trim();
      return empNo !== '' && empNo !== '18446744073709551613';
    })
    .map(ev => {
      const empNo = String(ev.employeeNoString || ev.employeeNo || '0').trim();
      const rawStatus = String(ev.attendanceStatus || '').toLowerCase();
      const isExit = rawStatus === 'checkout' || rawStatus === 'exit' || rawStatus === 'out' || ev.minor === 22 || ev.statusValue === 2;

      return {
        id: ev.serialNo ? `LOG-TERM-001-${ev.serialNo}` : `LOG-TERM-001-${empNo}-${ev.time}`,
        employeeId: `EMP-${empNo}`,
        employeeNo: empNo, // 1. employeeNoString
        serialNo: ev.serialNo ? Number(ev.serialNo) : undefined, // 2. serialNo
        attendanceStatus: isExit ? 'checkOut' : 'checkIn', // 3. attendanceStatus
        timestamp: ev.time || new Date().toISOString(), // 4. time
        type: isExit ? 'EXIT' : 'ENTRY',
        branchId: 'BRANCH-001',
        terminalId: 'TERM-001',
        verifyMethod: ev.currentVerifyMode || 'BIOMETRIC',
        doorNo: ev.doorNo || 1
      };
    });

  console.log(`📊 Total marcaciones válidas con ID de empleado: ${marcacionesFiltradas.length}`);
  if (marcacionesFiltradas.length > 0) {
    console.log('Muestra de marcaciones procesadas:', marcacionesFiltradas.slice(0, 5));
    await postToSupabase('attendance_logs', marcacionesFiltradas);
    await postToSupabase('attendance_logs_BRANCH-001', marcacionesFiltradas);
    console.log('✅ Subidas marcaciones procesadas a Supabase!');
  } else {
    console.log('⚠️ No se encontraron marcaciones con employeeNoString explícito en el escaneo completo.');
  }
}

ejecutarProcesamientoMarcaciones();
