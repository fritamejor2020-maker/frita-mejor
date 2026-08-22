const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');

// ── Solución a Bug de Windows/Electron: Prevenir pérdida de foco y congelamiento del cursor de texto (caret) ──
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

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

        let contractsChanged = 0;

        deviceUsers.forEach(u => {
          const empNo = String(u.employeeNo || '').trim();
          const devName = String(u.name || u.userName || u.employeeName || u.displayName || '').trim();
          const hasRealName = devName && !devName.toLowerCase().startsWith('empleado #');

          if (!empNo || empNo === '0') return;

          const existingIdx = currentContracts.findIndex(c => String(c.employeeNo || '').trim() === empNo);

          if (existingIdx >= 0) {
            const existingContract = currentContracts[existingIdx];
            const isGeneric = !existingContract.fullName || existingContract.fullName.toLowerCase().startsWith('empleado #');
            if (hasRealName && (isGeneric || existingContract.fullName !== devName)) {
              currentContracts[existingIdx] = {
                ...existingContract,
                fullName: devName,
                pinPassword: existingContract.pinPassword || u.password || ''
              };
              contractsChanged++;
              console.log(`[Electron Sync Daemon] 🔄 Actualizado nombre de empleado #${empNo}: '${existingContract.fullName}' -> '${devName}'`);
            }
          } else {
            currentContracts.push({
              employeeId: `EMP-${empNo}`,
              employeeNo: empNo,
              fullName: hasRealName ? devName : `Empleado #${empNo}`,
              branchId: 'BRANCH-001',
              shiftType: 'VARIABLE',
              weeklyTargetHours: 44,
              baseHourlyRate: 6500,
              overtimeHourlyRate: 9750,
              avatarColor: '#3B82F6',
              pinPassword: u.password || '',
              cardNo: u.cardNo || ''
            });
            contractsChanged++;
            console.log(`[Electron Sync Daemon] 🆕 Auto-creado nuevo empleado de biométrico: #${empNo} (${hasRealName ? devName : 'Sin nombre'})`);
          }
        });

        if (contractsChanged > 0) {
          await supabase.from('app_state').upsert({ key: 'attendance_contracts', value: currentContracts }, { onConflict: 'key' });
          await supabase.from('app_state').upsert({ key: 'attendance_contracts_BRANCH-001', value: currentContracts }, { onConflict: 'key' });
          console.log(`[Electron Sync Daemon] 🟢 Sincronizados ${contractsChanged} cambios de nombres/contratos en Supabase.`);
        }

        // Auto-sincronizar cambios pendientes de Supabase hacia el biométrico físico
        const deviceUserMap = new Map(deviceUsers.map(u => [String(u.employeeNo || '').trim(), u]));
        for (const contract of currentContracts) {
          const empNo = String(contract.employeeNo || '').trim();
          if (!empNo || empNo === '0') continue;
          
          const expectedName = String(contract.fullName || '').trim();
          const expectedPin = String(contract.pinPassword || '').trim();
          const devUser = deviceUserMap.get(empNo);

          if (devUser) {
            const actualName = String(devUser.name || '').trim();
            const actualPin = String(devUser.password || '').trim();

            if ((expectedName && expectedName !== actualName) || (expectedPin && expectedPin !== actualPin)) {
              console.log(`[Electron Sync Daemon] 🔄 Sincronizando cambio detectado en Supabase hacia biométrico para Empleado #${empNo}: Nombre ("${actualName}" -> "${expectedName}"), Clave ("${actualPin}" -> "${expectedPin}")`);
              await pushContractToBiometricDevice(empNo, expectedName, expectedPin);
            }
          }
        }
      }
    } catch (userErr) {
      console.warn('[Electron Sync Daemon] Warning auto-syncing users:', userErr.message);
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

    // 3. Sincronización automática de usuarios del biométrico (busca nuevos usuarios como Emily #45 y actualiza sus nombres)
    try {
      const bioUsersRes = await fetchBiometricUsersFromDevice();
      if (bioUsersRes && bioUsersRes.ok && Array.isArray(bioUsersRes.users) && bioUsersRes.users.length > 0) {
        const { data: contractState } = await supabase.from('app_state').select('value').eq('key', 'attendance_contracts').single();
        let currentContracts = contractState?.value || [];
        if (Array.isArray(currentContracts)) {
          const contractMap = new Map();
          currentContracts.forEach((c, idx) => contractMap.set(String(c.employeeNo || '').trim(), idx));
          let contractsChanged = false;

          bioUsersRes.users.forEach((u, idx) => {
            const empNo = String(u.employeeNo || '').trim();
            const devName = String(u.name || '').trim();
            const isRealName = devName && !devName.toLowerCase().startsWith('empleado #');

            if (!empNo || empNo === '0') return;

            if (contractMap.has(empNo)) {
              const existingIdx = contractMap.get(empNo);
              const existingContract = currentContracts[existingIdx];
              const isGeneric = !existingContract.fullName || existingContract.fullName.toLowerCase().startsWith('empleado #');

              if (isRealName && (isGeneric || existingContract.fullName !== devName)) {
                currentContracts[existingIdx] = {
                  ...existingContract,
                  fullName: devName
                };
                contractsChanged = true;
              }
            } else {
              contractMap.set(empNo, currentContracts.length);
              currentContracts.push({
                employeeId: `EMP-${empNo}`,
                employeeNo: empNo,
                fullName: isRealName ? devName : `Empleado #${empNo}`,
                branchId: 'BRANCH-001',
                shiftType: 'VARIABLE',
                weeklyTargetHours: 44,
                baseHourlyRate: 6500,
                overtimeHourlyRate: 9750,
                avatarColor: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899'][idx % 5]
              });
              contractsChanged = true;
            }
          });

          // También mapear marcaciones crudas si aún no están en contratos
          mappedLogs.forEach(log => {
            const empNo = String(log.employeeNo || '').trim();
            if (empNo && empNo !== '0' && !contractMap.has(empNo)) {
              contractMap.set(empNo, currentContracts.length);
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
              contractsChanged = true;
            }
          });

          if (contractsChanged) {
            await supabase.from('app_state').upsert({ key: 'attendance_contracts', value: currentContracts }, { onConflict: 'key' });
            await supabase.from('app_state').upsert({ key: 'attendance_contracts_BRANCH-001', value: currentContracts }, { onConflict: 'key' });
            console.log(`[Electron Sync Daemon] 🟢 Actualizados automáticamente ${currentContracts.length} contratos en Supabase.`);
          }
        }
      }
    } catch (uErr) {
      console.warn('[Electron Sync Daemon User Sync Warning]:', uErr.message);
    }

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
    focusable: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permite peticiones directas HTTP local sin bloqueos CORS
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Garantizar foco nativo al restaurar o mostrar
  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });
  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
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

async function pushContractToBiometricDevice(employeeNo, name, password) {
  const empNoStr = String(employeeNo).trim();
  const nameStr = String(name).trim();
  const pinStr = String(password).trim();

  if (!empNoStr || empNoStr === '0') return { ok: false, message: 'ID de empleado no válido' };

  console.log(`[Biometric Push] 🚀 Enviando a biométrico #${empNoStr} -> Nombre: "${nameStr}", Clave: "${pinStr}"...`);

  const payload = JSON.stringify({
    UserInfo: {
      employeeNo: empNoStr,
      name: nameStr,
      userType: 'normal',
      password: pinStr || '1234',
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
      Valid: {
        enable: true,
        beginTime: '2020-01-01T00:00:00',
        endTime: '2037-12-31T23:59:59'
      }
    }
  });

  function isResponseOk(res) {
    if (!res || !res.ok || !res.text) return false;
    try {
      const json = JSON.parse(res.text);
      return (json.statusCode === 1 || json.statusString === 'OK' || json.subStatusCode === 'ok');
    } catch {
      return false;
    }
  }

  // 1. Ejecutar intento de actualización en el biométrico (SetUp -> Modify -> Record)
  let writeOk = false;
  let bioResText = '';
  try {
    const res1 = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/SetUp?format=json', { method: 'PUT', body: payload });
    bioResText = res1.text || '';
    writeOk = isResponseOk(res1);

    if (!writeOk) {
      const res2 = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/Modify?format=json', { method: 'PUT', body: payload });
      bioResText = res2.text || bioResText;
      writeOk = isResponseOk(res2);

      if (!writeOk) {
        const res3 = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/Record?format=json', { method: 'POST', body: payload });
        bioResText = res3.text || bioResText;
        writeOk = isResponseOk(res3);
      }
    }
  } catch (e) {
    console.warn('[Biometric Push write attempt warning]:', e.message);
  }

  // 2. VERIFICACIÓN OBLIGATORIA DE SEGURIDAD: Consultar a la máquina real lo que tiene grabado para este ID
  try {
    console.log(`[Biometric Push] 🔍 Verificando lectura real devuelta por el biométrico para ID #${empNoStr}...`);
    const searchCond = {
      UserInfoSearchCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 10,
        EmployeeNoList: [{ employeeNo: empNoStr }]
      }
    };

    const verifyRes = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/Search?format=json', {
      method: 'POST',
      body: JSON.stringify(searchCond)
    });

    if (verifyRes.ok && verifyRes.text) {
      const verifyData = JSON.parse(verifyRes.text);
      const searchRes = verifyData.UserInfoSearch || {};
      let usersFound = searchRes.UserInfo || [];
      if (!Array.isArray(usersFound)) usersFound = [usersFound];

      const actualBioUser = usersFound.find(u => String(u.employeeNo).trim() === empNoStr) || usersFound[0];

      if (actualBioUser) {
        const actualName = String(actualBioUser.name || '').trim();
        const actualPin = String(actualBioUser.password || '').trim();

        console.log(`[Biometric Push Verify #${empNoStr}] Biométrico devolvió: Name="${actualName}", Password="${actualPin}"`);

        const nameMatches = (actualName.toLowerCase() === nameStr.toLowerCase());
        const pinMatches = (!pinStr || actualPin === pinStr);

        if (nameMatches && pinMatches) {
          console.log(`[Biometric Push Verify] ✅ ¡VERIFICACIÓN EXITOSA! Los datos en el biométrico coinciden 100%.`);
          return {
            ok: true,
            message: `✅ ¡Éxito Verificado! El biométrico devolvió Nombre: "${actualName}" y Clave: "${actualPin || 'Sin clave'}".`
          };
        } else {
          console.warn(`[Biometric Push Verify] ❌ VERIFICACIÓN FALLIDA. Se envió Name="${nameStr}" Pin="${pinStr}", pero la máquina devolvió Name="${actualName}" Pin="${actualPin}"`);
          return {
            ok: false,
            message: `❌ Error de Verificación: Se envió Name="${nameStr}" y Clave="${pinStr}", pero el biométrico devolvió Name="${actualName}" y Clave="${actualPin}".`
          };
        }
      }
    }
  } catch (vErr) {
    console.error('[Biometric Push Verify Error]:', vErr.message);
  }

  return { ok: false, message: `❌ Error de Verificación: El biométrico no devolvió datos legibles para el empleado #${empNoStr}. (HTTP: ${bioResText})` };
}

// ── Manejo de Eventos IPC ──────────────────────────────────────────────────────
ipcMain.handle('modify-biometric-user', async (event, { employeeNo, name, password }) => {
  try {
    const empNoStr = String(employeeNo).trim();
    const nameStr = String(name).trim();
    const pinStr = String(password).trim();

    const pushRes = await pushContractToBiometricDevice(empNoStr, nameStr, pinStr);

    // Sincronizar actualización de contrato inmediatamente en Supabase
    try {
      const { data: contractState } = await supabase.from('app_state').select('value').eq('key', 'attendance_contracts_BRANCH-001').single();
      let currentContracts = contractState?.value || [];
      if (Array.isArray(currentContracts)) {
        let found = false;
        currentContracts = currentContracts.map(c => {
          if (String(c.employeeNo).trim() === empNoStr) {
            found = true;
            return { ...c, fullName: nameStr, pinPassword: pinStr };
          }
          return c;
        });

        if (!found) {
          currentContracts.push({
            employeeId: `EMP-${empNoStr}`,
            employeeNo: empNoStr,
            fullName: nameStr,
            branchId: 'BRANCH-001',
            shiftType: 'VARIABLE',
            weeklyTargetHours: 44,
            baseHourlyRate: 6500,
            overtimeHourlyRate: 9750,
            pinPassword: pinStr,
            avatarColor: '#3B82F6'
          });
        }

        await supabase.from('app_state').upsert({ key: 'attendance_contracts', value: currentContracts }, { onConflict: 'key' });
        await supabase.from('app_state').upsert({ key: 'attendance_contracts_BRANCH-001', value: currentContracts }, { onConflict: 'key' });
        console.log(`[Electron Native IPC] 🟢 Contrato del usuario #${empNoStr} guardado en Supabase.`);
      }
    } catch (dbErr) {
      console.warn('[Electron Native IPC Supabase update error]:', dbErr.message);
    }

    return pushRes;
  } catch (err) {
    console.error('[Electron Native IPC Error]:', err.message);
    return { ok: false, message: `❌ Error de red biométrico: ${err.message}` };
  }
});

async function fetchBiometricUsersFromDevice() {
  try {
    let position = 0;
    let totalMatches = Infinity;
    const allUsersMap = new Map();

    while (position < totalMatches) {
      const searchBody = JSON.stringify({
        UserInfoSearchCond: {
          searchID: "1",
          searchResultPosition: position,
          maxResults: 10
        }
      });

      const res = await isapiDigestFetch('/ISAPI/AccessControl/UserInfo/Search?format=json', {
        method: 'POST',
        body: searchBody
      });

      if (!res || !res.ok || !res.text) break;

      let parsed = null;
      try {
        parsed = JSON.parse(res.text);
      } catch (err) {
        console.warn('[fetchBiometricUsersFromDevice] JSON parse error:', err.message);
        break;
      }

      const searchResult = parsed?.UserInfoSearch || {};
      if (typeof searchResult.totalMatches === 'number') {
        totalMatches = searchResult.totalMatches;
      }

      let userList = searchResult.UserInfo || [];
      if (!Array.isArray(userList)) userList = [userList];
      if (userList.length === 0) break;

      userList.forEach(u => {
        const empNo = String(u.employeeNo || u.employeeNoString || '').trim();
        const rawName = String(
          u.name || u.userName || u.employeeName || u.nameString || u.displayName || u.User?.name || u.UserInfo?.name || ''
        ).trim();

        if (empNo && empNo !== '0') {
          allUsersMap.set(empNo, {
            employeeNo: empNo,
            name: rawName || `Empleado #${empNo}`,
            userType: u.userType || 'normal'
          });
        }
      });

      position += userList.length;
      if (position >= totalMatches) break;
    }

    const finalUsers = Array.from(allUsersMap.values());
    console.log(`[fetchBiometricUsersFromDevice] 🟢 Extraídos ${finalUsers.length} de ${totalMatches} usuarios del biométrico.`);
    return { ok: true, users: finalUsers };
  } catch (err) {
    console.error('[fetchBiometricUsersFromDevice error]:', err.message);
    return { ok: false, users: [], message: err.message };
  }
}

ipcMain.handle('fetch-biometric-users', async () => {
  return await fetchBiometricUsersFromDevice();
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
