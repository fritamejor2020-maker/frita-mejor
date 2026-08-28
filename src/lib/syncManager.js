import { supabase } from './supabase';
import { safeLocalStorage } from '../utils/safeStorage';

// ==============================================================================
// SYNC MANAGER — Motor de sincronización Offline-First (Multisede)
// Responsabilidades:
//   1. Escribir cambios en Supabase cuando hay internet
//   2. Encolar cambios localmente cuando no hay internet
//   3. Vaciar la cola cuando el internet regresa
//   4. Particionar llaves por sede (branchId) para aislar datos entre sucursales
// ==============================================================================

const QUEUE_KEY = 'frita-sync-queue';
const MAX_RETRIES = 3;
const SYNC_LISTENERS = new Set();

// Mutex por key para serializar escrituras y evitar race conditions
const _writeLocks = new Map();
export async function withWriteLock(key, fn) {
  while (_writeLocks.has(key)) {
    try { await _writeLocks.get(key); } catch (_) {}
  }
  const promise = fn();
  _writeLocks.set(key, promise);
  try { return await promise; } finally { _writeLocks.delete(key); }
}

/**
 * Actualiza atómicamente un solo ítem por ID dentro de una llave de Supabase.
 * Evita pisar cambios de otros dispositivos y protege la integridad de los datos.
 */
export async function atomicUpdateItem(key, branchId, itemId, patch) {
  const supabaseKey = getBranchKey(key, branchId);
  return withWriteLock(supabaseKey, async () => {
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', supabaseKey).maybeSingle();
      const existing = Array.isArray(data?.value) ? data.value : [];
      let updated = false;
      const merged = existing.map(item => {
        if (item?.id === itemId) {
          updated = true;
          return { ...item, ...patch };
        }
        return item;
      });
      if (!updated && patch) {
        merged.unshift({ id: itemId, ...patch });
      }
      await supabase.from('app_state').upsert(
        { key: supabaseKey, value: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn(`[SyncManager] atomicUpdateItem error (${supabaseKey}):`, e?.message);
    }
  });
}

/**
 * Agrega un nuevo ítem atómicamente al inicio del arreglo remoto.
 */
export async function atomicAppendItem(key, branchId, newItem) {
  if (!newItem?.id) return;
  const supabaseKey = getBranchKey(key, branchId);
  return withWriteLock(supabaseKey, async () => {
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', supabaseKey).maybeSingle();
      const existing = Array.isArray(data?.value) ? data.value : [];
      const filtered = existing.filter(i => i?.id !== newItem.id);
      const merged = [newItem, ...filtered];
      await supabase.from('app_state').upsert(
        { key: supabaseKey, value: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn(`[SyncManager] atomicAppendItem error (${supabaseKey}):`, e?.message);
    }
  });
}

/**
 * Remueve un ítem por ID atómicamente del arreglo remoto.
 */
export async function atomicRemoveItem(key, branchId, itemId) {
  if (!itemId) return;
  const supabaseKey = getBranchKey(key, branchId);
  return withWriteLock(supabaseKey, async () => {
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', supabaseKey).maybeSingle();
      const existing = Array.isArray(data?.value) ? data.value : [];
      const merged = existing.filter(i => i?.id !== itemId);
      await supabase.from('app_state').upsert(
        { key: supabaseKey, value: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn(`[SyncManager] atomicRemoveItem error (${supabaseKey}):`, e?.message);
    }
  });
}

// ─── Clasificación de llaves ───────────────────────────────────────────────────

/**
 * Llaves GLOBALES — compartidas entre todas las sedes.
 * Solo catálogos y configuración maestros que son idénticos en todas las sedes.
 */
export const GLOBAL_KEYS = [
  // Catálogos de productos (los mismos en todas las sedes)
  'products', 'recipes', 'fritadoRecipes', 'posCategories', 'itemTypes',
  // Administración global del sistema y configuraciones
  'users', 'deletedUserIds', 'branches', 'deletedBranchIds', 'suppliers', 'posRegisters', 'deletedPosRegisterIds', 'customers', 'customerTypes', 'payrollEmployees', 'salesGoals', 'monthlyGoals', 'incomeConfig', 'vehicles',
  // Traslados (son cross-sede por diseño) y Pedidos de Clientes
  'transfers', 'customer_delivery_requests',
];

/**
 * Llaves LOCALES — específicas de cada sede.
 * Se almacenan en Supabase como `<key>_<branchId>` (ej: `posSales_BRANCH-001`).
 */
export const BRANCH_KEYS = [
  // Inventario y bodega
  'inventory', 'movements', 'warehouses',
  // POS
  'posShifts', 'posSales', 'posExpenses', 'posSettings',
  'contrataPayments', 'deletedShiftIds',
  // Logística (Dejador / Vendedor) — por sede
  'pendingRequests', 'completedRequests', 'rejectedRequests', 'loadHistory',
  // Plantillas de carga — por sede
  'loadTemplates',
  // Nómina y Asistencias — por sede
  'payrollRecords', 'attendance_logs', 'attendance_contracts', 'attendance_overrides', 'deleted_attendance_log_ids', 'attendance_shifts', 'attendance_groups', 'attendance_terminals',
  // GPS vendedores — por sede
  'vendorLocations',
  // Transferencias bancarias del vendedor — por sede
  'vendorTransfers',
  // Chat e intercomunicador radio — por sede
  'chatMessages',
];

/**
 * Resuelve el nombre real de la llave en Supabase.
 * - Si es global: retorna la llave tal cual (ej: 'products').
 * - Si es local:  retorna 'llave_branchId' (ej: 'posSales_BRANCH-001').
 * - Si branchId es null (Admin global): retorna la llave sin sufijo para globales,
 *   o usa 'BRANCH-001' como fallback para llaves locales.
 */
export function getBranchKey(key, branchId) {
  if (GLOBAL_KEYS.includes(key)) return key;
  const effectiveBranch = branchId || 'BRANCH-001';
  return `${key}_${effectiveBranch}`;
}

/**
 * Dado un nombre de llave completo de Supabase (ej: 'posSales_BRANCH-001'),
 * retorna el nombre base del store (ej: 'posSales').
 */
export function getBaseKey(fullKey) {
  for (const k of BRANCH_KEYS) {
    if (fullKey === k || fullKey.startsWith(`${k}_`)) return k;
  }
  return fullKey; // es una llave global
}

// ─── Estado interno ────────────────────────────────────────────────────────────

let isSyncing = false;
let isOnline = true;

// ─── Listeners de estado ──────────────────────────────────────────────────────

export function onSyncStatusChange(fn) {
  SYNC_LISTENERS.add(fn);
  return () => SYNC_LISTENERS.delete(fn);
}

function notifyListeners(status) {
  SYNC_LISTENERS.forEach(fn => fn(status));
}

// ─── Cola de cambios pendientes ───────────────────────────────────────────────

export function getQueue() {
  try {
    const raw = safeLocalStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    safeLocalStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[SyncManager] Error al guardar cola:', e.message);
  }
}

export function getQueuedOfflineItemIds(key) {
  try {
    const queue = getQueue();
    const item = queue.find(q => q.key === key || q.key.startsWith(`${key}_`));
    if (item && Array.isArray(item.value)) {
      return new Set(item.value.map(i => i?.id).filter(Boolean));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export function enqueue(key, value) {
  const queue = getQueue();
  const existingIdx = queue.findIndex(item => item.key === key);
  if (existingIdx >= 0) {
    queue[existingIdx] = { key, value, timestamp: Date.now(), retries: 0 };
  } else {
    queue.push({ key, value, timestamp: Date.now(), retries: 0 });
  }
  saveQueue(queue);
  notifyListeners({ online: isOnline, pendingCount: queue.length, syncing: false });
}

// ─── Escritura en Supabase con Protección Anti-Truncamiento ───────────────────

async function _writeToSupabaseImpl(key, value) {
  // Para arrays críticos de historial (posShifts, loadHistory, completedRequests): NUNCA truncar datos remotos
  if ((key === 'posShifts' || key.startsWith('posShifts_')) && Array.isArray(value)) {
    try {
      const { data: remoteRows } = await supabase
        .from('app_state')
        .select('key,value')
        .in('key', ['posShifts', 'posShifts_BRANCH-001', 'posShifts_master_history', 'deletedShiftIds', 'deletedShiftIds_BRANCH-001']);
      
      const deletedSet = new Set();
      if (remoteRows && remoteRows.length > 0) {
        remoteRows.forEach(r => {
          if ((r.key === 'deletedShiftIds' || r.key === 'deletedShiftIds_BRANCH-001') && Array.isArray(r.value)) {
            r.value.forEach(id => { if (id) deletedSet.add(id); });
          }
        });
      }

      const shiftMap = new Map();
      if (remoteRows && remoteRows.length > 0) {
        remoteRows.forEach(r => {
          if ((r.key === 'posShifts' || r.key.startsWith('posShifts_')) && Array.isArray(r.value)) {
            r.value.forEach(s => {
              if (s?.id && !deletedSet.has(s.id)) {
                const existing = shiftMap.get(s.id);
                if (!existing || (!existing.closedAt && s.closedAt)) {
                  shiftMap.set(s.id, s);
                }
              }
            });
          }
        });
      }

      let maxRemoteLength = 0;
      if (remoteRows && remoteRows.length > 0) {
        remoteRows.forEach(r => {
          if (Array.isArray(r.value) && r.value.length > maxRemoteLength) {
            maxRemoteLength = r.value.length;
          }
        });
      }

      value.forEach(s => {
        if (s?.id && !deletedSet.has(s.id)) {
          const existing = shiftMap.get(s.id);
          if (!existing) {
            shiftMap.set(s.id, s);
          } else {
            // Si el remoto o local fue CERRADO FORZOSAMENTE por el Admin, ESE cierre forzado NUNCA se re-abre por sync de fondo
            if (existing.forcedByAdmin || existing._forcedClosedByAdmin) {
              shiftMap.set(s.id, existing);
            } else if (s.forcedByAdmin || s._forcedClosedByAdmin) {
              shiftMap.set(s.id, s);
            } else {
              const sTime = new Date(s.openedAt || s.closedAt || 0).getTime();
              const exTime = new Date(existing.openedAt || existing.closedAt || 0).getTime();

              if (!s.closedAt && existing.closedAt && sTime > exTime + 60000) {
                // Solo reapertura si s fue abierto al menos 1 min DESPUÉS del cierre anterior
                shiftMap.set(s.id, s);
              } else if (existing.closedAt && !s.closedAt) {
                shiftMap.set(s.id, { ...s, ...existing });
              } else if (!existing.closedAt && s.closedAt) {
                shiftMap.set(s.id, { ...existing, ...s });
              } else {
                shiftMap.set(s.id, { ...existing, ...s });
              }
            }
          }
        }
      });

      const mergedShifts = Array.from(shiftMap.values());

      // Proteccion anti-truncado: NUNCA permitir guardar menos turnos de los que ya existian en el servidor
      if (maxRemoteLength > 0 && mergedShifts.length < maxRemoteLength) {
        console.warn(`[SyncManager] Sobreescritura truncada rechazada: remote tenía ${maxRemoteLength} turnos, merged intentaba escribir ${mergedShifts.length}.`);
        return;
      }

      value = mergedShifts;

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('app_state')
        .upsert(
          { key, value: mergedShifts, updated_at: nowIso },
          { onConflict: 'key' }
        );
      if (error) throw error;

      // Escribir a todas las keys atómicamente con await
      await Promise.allSettled([
        supabase.from('app_state').upsert({ key: 'posShifts', value: mergedShifts, updated_at: nowIso }, { onConflict: 'key' }),
        supabase.from('app_state').upsert({ key: 'posShifts_BRANCH-001', value: mergedShifts, updated_at: nowIso }, { onConflict: 'key' }),
        supabase.from('app_state').upsert({ key: 'posShifts_master_history', value: mergedShifts, updated_at: nowIso }, { onConflict: 'key' }),
      ]);
      return;
    } catch (e) {
      console.warn('[SyncManager] Error merging shifts before write:', e);
    }
  }

  if ((key === 'pendingRequests' || key.startsWith('pendingRequests_') || key === 'loadHistory' || key.startsWith('loadHistory_') || key === 'completedRequests' || key.startsWith('completedRequests_')) && Array.isArray(value)) {
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle();
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        const itemMap = new Map();
        data.value.forEach(item => { if (item?.id) itemMap.set(item.id, item); });
        value.forEach(item => { if (item?.id) itemMap.set(item.id, item); });
        value = Array.from(itemMap.values());
      }
    } catch (e) {
      console.warn('[SyncManager] Error merging requests/history before write:', e);
    }
  }

  const { error } = await supabase
    .from('app_state')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw error;
}

async function writeToSupabase(key, value) {
  return withWriteLock(key, () => _writeToSupabaseImpl(key, value));
}

// ─── Vaciado de cola ──────────────────────────────────────────────────────────

export async function flushQueue() {
  if (isSyncing || !isOnline) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners({ online: isOnline, pendingCount: queue.length, syncing: true });

  const remaining = [];
  try {
    for (const item of queue) {
      try {
        await writeToSupabase(item.key, item.value);
      } catch (err) {
        const retries = (item.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          console.error(`[SyncManager] Descartando "${item.key}" tras ${MAX_RETRIES} intentos fallidos:`, err.message);
        } else {
          console.warn(`[SyncManager] Error syncing "${item.key}" (intento ${retries}/${MAX_RETRIES}):`, err.message);
          remaining.push({ ...item, retries });
        }
      }
    }
  } finally {
    saveQueue(remaining);
    isSyncing = false;
    notifyListeners({ online: isOnline, pendingCount: remaining.length, syncing: false });
  }
}

// ─── Gate centralizado de protección ──────────────────────────────────────────
// Bloquea TODAS las escrituras a Supabase hasta que la app haya descargado
// los datos reales de la nube. Esto previene que datos de plantilla/demo o
// estado obsoleto de localStorage sobreescriba la base de datos de producción.
let _appReady = false;
export function markAppReady() {
  _appReady = true;
  console.log('[SyncManager] ✅ App marcada como lista — escrituras a Supabase habilitadas.');
}
export function isAppReady() { return _appReady; }

export async function push(key, value, branchId = null) {
  // Protección 1: Modo Seguro manual (para pruebas de Antigravity)
  if (typeof window !== 'undefined' && window.__FRITA_SAFE_MODE__) {
    console.warn(`[SyncManager] Push de "${key}" omitido por Modo Seguro activo.`);
    return;
  }

  // Protección 2: Bloquear escrituras de estado general hasta que la app descargue los datos remotos
  // EXCEPCIÓN: posShifts y vendorLocations son acciones explícitas del usuario y writeToSupabase ya hace merge seguro con Supabase.
  const isShiftOrLocation = key === 'posShifts' || key.startsWith('posShifts_') || key === 'vendorLocations' || key.startsWith('vendorLocations_');
  if (!_appReady && !isShiftOrLocation) {
    console.warn(`[SyncManager] Push de "${key}" encolado/omitido: la app aún no terminó de cargar datos remotos.`);
    // Permitir si se ha forzado explicitamente
    if (typeof window === 'undefined' || !window.__FRITA_FORCE_SYNC__) {
      return;
    }
  }

  const supabaseKey = getBranchKey(key, branchId);

  if (!isOnline) {
    enqueue(supabaseKey, value);
    return;
  }

  try {
    await writeToSupabase(supabaseKey, value);
    notifyListeners({ online: true, pendingCount: getQueue().length, syncing: false });
  } catch (err) {
    console.warn(`[SyncManager] Falló sync de "${supabaseKey}", encolando:`, err.message);
    const isNetworkError = err.message?.includes('fetch') ||
      err.message?.includes('network') ||
      err.message?.includes('Failed to fetch') ||
      err.name === 'TypeError';
    if (isNetworkError) {
      isOnline = false;
      notifyListeners({ online: false, pendingCount: getQueue().length + 1, syncing: false });
    }
    enqueue(supabaseKey, value);
  }
}

/**
 * Lee una clave del estado remoto en Supabase.
 * @param {string} key — nombre base de la llave
 * @param {string|null} branchId
 */
export async function pull(key, branchId = null) {
  const supabaseKey = getBranchKey(key, branchId);
  const { data, error } = await supabase
    .from('app_state')
    .select('value')
    .eq('key', supabaseKey)
    .maybeSingle();
  if (error || !data) return null;
  return data.value;
}

/**
 * Lee todas las claves relevantes de app_state para una sede específica.
 * - Admin (branchId=null): descarga globales + llaves de TODAS las sedes activas.
 * - Operativo (branchId='BRANCH-XXX'): descarga globales + llaves de su sede.
 * @param {string|null} branchId
 * @param {string[]} allBranchIds — lista de todos los IDs de sedes (necesario para Admin)
 * @returns {Object} mapa { supabaseKey → value }
 */
export async function pullAll(branchId = null, allBranchIds = ['BRANCH-001']) {
  // Construir lista de llaves a descargar
  const keysToFetch = [...GLOBAL_KEYS, 'posShifts_master_history'];

  if (branchId === null) {
    // Admin: descarga llaves de todas las sedes conocidas
    const effectiveBranches = allBranchIds.length > 0 ? allBranchIds : ['BRANCH-001'];
    for (const bid of effectiveBranches) {
      for (const bk of BRANCH_KEYS) {
        keysToFetch.push(`${bk}_${bid}`);
      }
    }
  } else {
    // Operativo: solo su sede
    for (const bk of BRANCH_KEYS) {
      keysToFetch.push(`${bk}_${branchId}`);
    }
    // También incluir llaves legacy para migración inicial (primer arranque)
    for (const bk of BRANCH_KEYS) {
      if (!keysToFetch.includes(bk)) keysToFetch.push(bk);
    }
  }

  const { data, error } = await supabase
    .from('app_state')
    .select('key, value')
    .in('key', keysToFetch);

  if (error || !data) return {};
  return Object.fromEntries(data.map(row => [row.key, row.value]));
}

// ─── Inicialización de listeners de red ──────────────────────────────────────

window.addEventListener('online', () => {
  isOnline = true;
  console.log('[SyncManager] Conexión restaurada. Sincronizando cola...');
  setTimeout(() => flushQueue(), 1000);
});

window.addEventListener('offline', () => {
  isOnline = false;
  const queue = getQueue();
  notifyListeners({ online: false, pendingCount: queue.length, syncing: false });
  console.log('[SyncManager] Sin conexión. Los cambios se guardarán localmente.');
});

async function probeConnectivity() {
  try {
    const { error } = await supabase.from('app_state').select('key').limit(1);
    if (!error) {
      if (!isOnline) {
        isOnline = true;
        notifyListeners({ online: true, pendingCount: getQueue().length, syncing: false });
      }
      flushQueue();
    }
  } catch {
    isOnline = navigator.onLine;
  }
}

probeConnectivity();
setInterval(probeConnectivity, 30_000);

export function getSyncStatus() {
  return {
    online: isOnline,
    pendingCount: getQueue().length,
    syncing: isSyncing,
  };
}
