const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase Config ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://uevcotmnffftoelscjua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldmNvdG1uZmZmdG9lbHNjanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk3NjMsImV4cCI6MjA5MTIzNTc2M30.c8q811qfvwOvenGk4mwt1HVTBsD7cPYiTM-2orqz3pM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HIKVISION_CONFIG = {
  ipAddress: '192.168.3.220',
  port: 80,
  username: 'admin',
  password: 'Control.1'
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let syncInterval = null;

// ── ISAPI Digest Fetch ──────────────────────────────────────────────────────────
async function isapiDigestFetch(pathStr, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const bodyData = options.body ? Buffer.from(options.body, 'utf-8') : null;

  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: HIKVISION_CONFIG.ipAddress,
      port: HIKVISION_CONFIG.port,
      path: pathStr,
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
        const ha2 = crypto.createHash('md5').update(`${method}:${pathStr}`).digest('hex');
        
        let respStr;
        if (qop) {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
        } else {
          respStr = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let authHeader = `Digest username="${HIKVISION_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${pathStr}", response="${respStr}"`;
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

// ── Motor de Sincronización Biométrico en Segundo Plano ───────────────────────
async function runBiometricSync() {
  try {
    // 1. Lectura paginada de TODOS los usuarios del biométrico para auto-registrar personas nuevas
    try {
      let posicion = 0;
      let deviceUsers = [];
      let totalEnMemoria = 0;

      do {
        const payload = JSON.stringify({
          UserInfoSearchCond: {
            searchID: "1",
            searchResultPosition: posicion,
            maxResults: 10
          }
        });

        const userRes = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/Search?format=json', { method: 'POST', body: payload });
        if (!userRes.ok || !userRes.text) break;

        const userData = JSON.parse(userRes.text);
        const searchRes = userData.UserInfoSearch || {};
        totalEnMemoria = searchRes.totalMatches || 0;
        let listaLote = searchRes.UserInfo || [];
        if (!Array.isArray(listaLote)) listaLote = [listaLote];

        if (listaLote.length === 0) break;

        deviceUsers.push(...listaLote);
        posicion += listaLote.length;
      } while (posicion < totalEnMemoria);

      if (deviceUsers.length > 0) {
        const { data: contractState1 } = await supabase.from('app_state').select('value').eq('key', 'attendance_contracts_BRANCH-001').single();
        const { data: contractState2 } = await supabase.from('app_state').select('value').eq('key', 'attendance_contracts').single();
        let currentContracts = (contractState1?.value && Array.isArray(contractState1.value) && contractState1.value.length > 0)
          ? contractState1.value
          : (contractState2?.value || []);
        if (!Array.isArray(currentContracts)) currentContracts = [];

        const existingEmpNos = new Set(currentContracts.map(c => String(c.employeeNo || '').trim()));
        let newContractsAdded = 0;

        deviceUsers.forEach(u => {
          const empNo = String(u.employeeNo || '').trim();
          if (empNo && empNo !== '0' && !existingEmpNos.has(empNo)) {
            newContractsAdded++;
            existingEmpNos.add(empNo);
            currentContracts.push({
              employeeId: `EMP-${empNo}`,
              employeeNo: empNo,
              fullName: (u.name && u.name.trim() !== '') ? u.name.trim() : `Empleado #${empNo}`,
              branchId: 'BRANCH-001',
              shiftType: 'VARIABLE',
              weeklyTargetHours: 44,
              baseHourlyRate: 6500,
              overtimeHourlyRate: 9750,
              avatarColor: '#3B82F6',
              pinPassword: u.password || '',
              cardNo: u.cardNo || ''
            });
            console.log(`[Electron Sync Daemon] 🆕 Auto-creado nuevo empleado de biométrico: #${empNo} (${u.name || 'Sin nombre'})`);
          }
        });

        if (newContractsAdded > 0) {
          await supabase.from('app_state').upsert({ key: 'attendance_contracts', value: currentContracts }, { onConflict: 'key' });
          await supabase.from('app_state').upsert({ key: 'attendance_contracts_BRANCH-001', value: currentContracts }, { onConflict: 'key' });
          console.log(`[Electron Sync Daemon] 🟢 Registradas ${newContractsAdded} personas nuevas automáticamente en la Nube.`);
        }
      }
    } catch (userErr) {
      console.warn('[Electron Sync Daemon] Warning auto-fetching users:', userErr.message);
    }

    // 2. Consultar eventos de marcación (asistencias)
    const pathStr = '/ISAPI/AccessControl/AcsEvent?format=json';
    const initCond = { searchID: "1", searchResultPosition: 0, maxResults: 10, major: 0, minor: 0 };
    const res1 = await isapiDigestFetch(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: initCond }) });
    
    if (!res1.ok || !res1.text) {
      console.log(`[Electron Sync Daemon] [${new Date().toLocaleTimeString()}] ⚠️ Biométrico local offline (${HIKVISION_CONFIG.ipAddress})`);
      return { ok: false, count: 0, message: 'No se pudo conectar al biométrico local.' };
    }

    const data1 = JSON.parse(res1.text);
    const totalEnMemoria = data1.AcsEvent?.totalMatches || 0;

    const startPos = Math.max(0, totalEnMemoria - 200);
    const batchCond = { searchID: "1", searchResultPosition: startPos, maxResults: 200, major: 0, minor: 0 };
    const res2 = await isapiDigestFetch(pathStr, { method: 'POST', body: JSON.stringify({ AcsEventCond: batchCond }) });

    if (!res2.ok || !res2.text) return { ok: false, count: 0, message: 'Error al consultar lote de eventos.' };

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

    // 3. Auto-crear cualquier empleado detectado en los eventos que aún no exista en contratos
    try {
      const { data: contractState } = await supabase.from('app_state').select('value').eq('key', 'attendance_contracts').single();
      let currentContracts = contractState?.value || [];
      if (Array.isArray(currentContracts)) {
        const existingNos = new Set(currentContracts.map(c => String(c.employeeNo || '').trim()));
        let addedFromLogs = 0;
        mappedLogs.forEach(log => {
          const empNo = String(log.employeeNo || '').trim();
          if (empNo && empNo !== '0' && !existingNos.has(empNo)) {
            addedFromLogs++;
            existingNos.add(empNo);
            currentContracts.push({
              employeeId: `EMP-${empNo}`,
              employeeNo: empNo,
              fullName: `Empleado #${empNo}`,
              branchId: 'BRANCH-001',
              shiftType: 'VARIABLE',
              weeklyTargetHours: 44,
              baseHourlyRate: 6500,
              overtimeHourlyRate: 9750,
              avatarColor: '#3B82F6'
            });
          }
        });
        if (addedFromLogs > 0) {
          await supabase.from('app_state').upsert({ key: 'attendance_contracts', value: currentContracts }, { onConflict: 'key' });
          await supabase.from('app_state').upsert({ key: 'attendance_contracts_BRANCH-001', value: currentContracts }, { onConflict: 'key' });
        }
      }
    } catch { /* ignore */ }

    const { data: existingState } = await supabase.from('app_state').select('value').eq('key', 'attendance_logs').single();
    const currentLogs = existingState?.value || [];
    const existingIds = new Set(currentLogs.map(l => l.id));

    const toAdd = mappedLogs.filter(l => !existingIds.has(l.id));

    if (toAdd.length > 0) {
      const updated = [...toAdd, ...currentLogs];
      await supabase.from('app_state').upsert({ key: 'attendance_logs', value: updated }, { onConflict: 'key' });
      await supabase.from('app_state').upsert({ key: 'attendance_logs_BRANCH-001', value: updated }, { onConflict: 'key' });
      console.log(`[Electron Sync Daemon] [${new Date().toLocaleTimeString()}] 🟢 Sincronizadas ${toAdd.length} nuevas asistencias a Supabase.`);
    } else {
      if (currentLogs.length === 0 && mappedLogs.length > 0) {
        await supabase.from('app_state').upsert({ key: 'attendance_logs', value: mappedLogs }, { onConflict: 'key' });
        await supabase.from('app_state').upsert({ key: 'attendance_logs_BRANCH-001', value: mappedLogs }, { onConflict: 'key' });
      }
      console.log(`[Electron Sync Daemon] [${new Date().toLocaleTimeString()}] 🟢 Asistencias 100% al día en la Nube.`);
    }

    return { ok: true, count: mappedLogs.length, message: `Sincronización nativa exitosa. Se procesaron ${mappedLogs.length} marcaciones.` };
  } catch (err) {
    console.error('[Electron Sync Daemon Error]:', err.message);
    return { ok: false, count: 0, message: err.message };
  }
}

// ── Ventana Principal de Electron ──────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'Frita Mejor POS & Control de Asistencias',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permite peticiones directas HTTP local sin bloqueos CORS
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Prevenir cierre accidental para mantener la sincronización activa 24/7 en segundo plano
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Crear Tray System Icon (Barra de tareas junto al reloj) ─────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    // Fallback si no hay icono
    tray = new Tray(path.join(__dirname, 'default_icon.png'));
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '🖥️ Abrir Frita Mejor POS', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: '🔄 Sincronizar Biométrico Ahora', click: () => runBiometricSync() },
    { type: 'separator' },
    { label: '❌ Salir', click: () => { isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip('Frita Mejor POS - Sincronizador Activo 24/7');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ── Manejo de Eventos IPC ──────────────────────────────────────────────────────
ipcMain.handle('sync-biometric-manual', async () => {
  return await runBiometricSync();
});

ipcMain.handle('modify-biometric-user', async (event, { employeeNo, name, password }) => {
  try {
    const payload = JSON.stringify({
      UserInfo: {
        employeeNo: String(employeeNo),
        name: String(name),
        userType: 'normal',
        password: String(password),
        doorRight: '1',
        RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
        Valid: {
          enable: true,
          beginTime: '2020-01-01T00:00:00',
          endTime: '2037-12-31T23:59:59'
        }
      }
    });

    let res = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/SetUp?format=json', { method: 'PUT', body: payload });
    if (!res.ok) {
      res = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/Modify?format=json', { method: 'PUT', body: payload });
    }

    if (res.ok && res.text) {
      const jsonRes = JSON.parse(res.text);
      if (jsonRes.statusString === 'OK' || jsonRes.statusCode === 1) {
        return { ok: true, message: `✅ ¡Éxito! Usuario #${employeeNo} actualizado a '${name}' con clave '${password}'.` };
      }
    }
    return { ok: false, message: `❌ Error al actualizar en biométrico (HTTP ${res.status}): ${res.text}` };
  } catch (err) {
    return { ok: false, message: `❌ Error de red biométrico: ${err.message}` };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ── Ciclo de Vida de la App ────────────────────────────────────────────────────
app.whenReady().then(() => {
  createMainWindow();
  createTray();

  // Iniciar sincronización nativa en segundo plano cada 30 segundos
  runBiometricSync();
  syncInterval = setInterval(runBiometricSync, 30000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (syncInterval) clearInterval(syncInterval);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // En Windows se mantiene en segundo plano en el Tray
  }
});
