import { supabase } from './supabase';
import { safeLocalStorage } from '../utils/safeStorage';
import { useBranchStore } from '../store/useBranchStore';

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

// Si la RPC atómica no está desplegada en Supabase, se recuerda para no reintentarla
// en cada escritura (y usar directamente el fallback read-modify-write).
let _rpcAtomicMissing = false;

function _rpcLooksMissing(err) {
  const m = String(err?.message || err?.hint || err?.code || '').toLowerCase();
  return m.includes('does not exist') || m.includes('not find') || m.includes('pgrst202') || m.includes('42883') || m.includes('function public.app_state');
}

// Fallback: SELECT -> merge en JS -> UPSERT del array completo (comportamiento previo).
async function _fallbackWholeArray(supabaseKey, transform) {
  const { data } = await supabase.from('app_state').select('value').eq('key', supabaseKey).maybeSingle();
  const existing = Array.isArray(data?.value) ? data.value : [];
  const merged = transform(existing);
  await supabase.from('app_state').upsert(
    { key: supabaseKey, value: merged, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}

/**
 * Actualiza atómicamente un solo ítem por ID dentro de una llave de app_state.
 * Usa la RPC app_state_upsert_item (merge server-side bajo FOR UPDATE) y, si no
 * está desplegada, cae al read-modify-write anterior.
 */
export async function atomicUpdateItem(key, branchId, itemId, patch) {
  const supabaseKey = getBranchKey(key, branchId);
  return withWriteLock(supabaseKey, async () => {
    try {
      // Para la RPC necesitamos el ítem completo: leer el actual y aplicar el patch.
      let fullItem = { id: itemId, ...(patch || {}) };
      if (!_rpcAtomicMissing) {
        try {
          const { data } = await supabase.from('app_state').select('value').eq('key', supabaseKey).maybeSingle();
          const existing = Array.isArray(data?.value) ? data.value : [];
          const cur = existing.find(i => i?.id === itemId);
          if (cur) fullItem = { ...cur, ...patch };
          const { error } = await supabase.rpc('app_state_upsert_item', { p_key: supabaseKey, p_item: fullItem });
          if (error) throw error;
          return;
        } catch (e) {
          if (_rpcLooksMissing(e)) { _rpcAtomicMissing = true; }
          else throw e;
        }
      }
      await _fallbackWholeArray(supabaseKey, (existing) => {
        let updated = false;
        const merged = existing.map(item => {
          if (item?.id === itemId) { updated = true; return { ...item, ...patch }; }
          return item;
        });
        if (!updated && patch) merged.unshift({ id: itemId, ...patch });
        return merged;
      });
    } catch (e) {
      console.warn(`[SyncManager] atomicUpdateItem error (${supabaseKey}):`, e?.message);
    }
  });
}

/**
 * Agrega/reemplaza un ítem completo atómicamente al inicio del arreglo remoto.
 */
export async function atomicAppendItem(key, branchId, newItem) {
  if (!newItem?.id) return;
  const supabaseKey = getBranchKey(key, branchId);
  return withWriteLock(supabaseKey, async () => {
    try {
      if (!_rpcAtomicMissing) {
        try {
          const { error } = await supabase.rpc('app_state_upsert_item', { p_key: supabaseKey, p_item: newItem });
          if (error) throw error;
          return;
        } catch (e) {
          if (_rpcLooksMissing(e)) { _rpcAtomicMissing = true; }
          else throw e;
        }
      }
      await _fallbackWholeArray(supabaseKey, (existing) => [newItem, ...existing.filter(i => i?.id !== newItem.id)]);
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
      if (!_rpcAtomicMissing) {
        try {
          const { error } = await supabase.rpc('app_state_remove_item', { p_key: supabaseKey, p_item_id: String(itemId) });
          if (error) throw error;
          return;
        } catch (e) {
          if (_rpcLooksMissing(e)) { _rpcAtomicMissing = true; }
          else throw e;
        }
      }
      await _fallbackWholeArray(supabaseKey, (existing) => existing.filter(i => i?.id !== itemId));
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
  'posShifts', 'posSales', 'posExpenses', 'posDescargues', 'posSettings',
  'contrataPayments', 'deletedShiftIds', 'deletedPosSaleIds',
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

// firma de la última escritura por clave, para saltar re-escrituras idénticas inmediatas
const _lastPushSig = new Map();

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

  // 🛡️ Ventas POS (posSales): NUNCA permitir que una escritura sobreescriba ventas concurrentes NI resucite ventas eliminadas
  //
  // LIMITACIÓN CONOCIDA (#7): este SELECT→merge→UPSERT no es atómico entre DISPOSITIVOS.
  // withWriteLock serializa solo dentro de una pestaña. Si dos cajas escriben posSales en
  // el mismo milisegundo, la que leyó primero puede no ver la venta de la otra. La ventana
  // es de pocos ms y el merge por id (con PAID-gana) lo hace raro, pero no imposible.
  // Fix real pendiente: RPC en Postgres (p. ej. app_state_append_sale) que haga el append
  // server-side en una sola sentencia.
  if ((key === 'posSales' || key.startsWith('posSales_')) && Array.isArray(value)) {
    try {
      const branchSuffix = key.includes('_') ? key.split('_')[1] : 'BRANCH-001';
      const { data: delRows } = await supabase
        .from('app_state')
        .select('key, value')
        .in('key', ['deletedPosSaleIds', `deletedPosSaleIds_${branchSuffix}`]);
      
      const deletedSalesSet = new Set();
      (delRows || []).forEach(r => {
        if (Array.isArray(r.value)) {
          r.value.forEach(id => { if (id) deletedSalesSet.add(id); });
        }
      });

      // Recopilar todos los identificadores de ventas PAGADAS (locales y remotas)
      const allPaidIds = new Set();
      const allPaidOlaIds = new Set();
      const allPaidPublicIds = new Set();

      value.forEach(s => {
        if (s?.status === 'PAID') {
          if (s.id) {
            allPaidIds.add(s.id);
            if (typeof s.id === 'string' && s.id.startsWith('HELD-OLA-')) {
              allPaidOlaIds.add(s.id.replace('HELD-OLA-', ''));
            }
          }
          if (s.originalHeldId) allPaidIds.add(s.originalHeldId);
          if (s.originalOlaClickId) allPaidOlaIds.add(s.originalOlaClickId);
          if (s.publicId) allPaidPublicIds.add(s.publicId);
        }
      });

      const { data } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle();
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        data.value.forEach(s => {
          if (s?.status === 'PAID') {
            if (s.id) {
              allPaidIds.add(s.id);
              if (typeof s.id === 'string' && s.id.startsWith('HELD-OLA-')) {
                allPaidOlaIds.add(s.id.replace('HELD-OLA-', ''));
              }
            }
            if (s.originalHeldId) allPaidIds.add(s.originalHeldId);
            if (s.originalOlaClickId) allPaidOlaIds.add(s.originalOlaClickId);
            if (s.publicId) allPaidPublicIds.add(s.publicId);
          }
        });

        const isSaleDeadOrPaid = (item) => {
          if (!item || !item.id) return true;
          const itemId = String(item.id);
          // Si el ID directo de la venta fue eliminado expresamente, está eliminada
          if (deletedSalesSet.has(itemId)) return true;

          // 🛡️ Ventas PAGADAS representan dinero real: JAMÁS se descartan por IDs de pedidos o borradores previos
          if (item.status === 'PAID') {
            return false;
          }

          if (item.originalOlaClickId && deletedSalesSet.has(item.originalOlaClickId)) return true;
          if (item.publicId && deletedSalesSet.has(item.publicId)) return true;
          if (item.originalHeldId && deletedSalesSet.has(item.originalHeldId)) return true;

          // Si es una venta en espera/suspendida pero ya fue cobrada con cualquier identificador, está procesada
          if (item.status === 'SUSPENDED') {
            if (allPaidIds.has(itemId)) return true;
            if (item.originalHeldId && allPaidIds.has(item.originalHeldId)) return true;
            if (item.originalOlaClickId && allPaidOlaIds.has(item.originalOlaClickId)) return true;
            if (item.publicId && allPaidPublicIds.has(item.publicId)) return true;
            if (itemId.startsWith('HELD-OLA-') && allPaidOlaIds.has(itemId.replace('HELD-OLA-', ''))) return true;
          }
          return false;
        };

        const saleMap = new Map();
        // 1. Cargar ventas remotas existentes SOLO si no fueron eliminadas ni pagadas
        data.value.forEach(item => {
          if (!isSaleDeadOrPaid(item)) {
            saleMap.set(item.id, item);
          }
        });
        // 2. Fusionar ventas locales asegurando que ventas PAID ganen sobre suspendidas
        value.forEach(item => {
          if (!isSaleDeadOrPaid(item)) {
            const existing = saleMap.get(item.id);
            if (existing) {
              if (item.status === 'PAID') {
                saleMap.set(item.id, { ...existing, ...item });
              } else if (existing.status === 'PAID') {
                saleMap.set(item.id, existing);
              } else {
                saleMap.set(item.id, { ...existing, ...item });
              }
            } else {
              saleMap.set(item.id, item);
            }
          }
        });
        value = Array.from(saleMap.values());
      }
    } catch (e) {
      console.warn('[SyncManager] Error merging posSales before write:', e);
    }
  }

  // 🛡️ Gastos de Caja POS (posExpenses): Fusión atómica para no perder gastos registrados
  if ((key === 'posExpenses' || key.startsWith('posExpenses_')) && Array.isArray(value)) {
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle();
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        const expMap = new Map();
        data.value.forEach(item => { if (item?.id) expMap.set(item.id, item); });
        value.forEach(item => { if (item?.id) expMap.set(item.id, item); });
        value = Array.from(expMap.values());
      }
    } catch (e) {
      console.warn('[SyncManager] Error merging posExpenses before write:', e);
    }
  }

  // 🛡️ Fichajes (attendance_logs), descargues y pagos a contrata: fusión por id con el
  // remoto para que dos dispositivos escribiendo a la vez no pierdan registros.
  // (attendance_logs recibe punches del biométrico Y del web al mismo tiempo.)
  if (
    (key === 'attendance_logs' || key.startsWith('attendance_logs_') ||
     key === 'posDescargues' || key.startsWith('posDescargues_') ||
     key === 'contrataPayments' || key.startsWith('contrataPayments_') ||
     key === 'movements' || key.startsWith('movements_')) &&
    Array.isArray(value)
  ) {
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle();
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        const m = new Map();
        data.value.forEach(item => { if (item?.id) m.set(item.id, item); });
        value.forEach(item => { if (item?.id) m.set(item.id, item); });
        value = Array.from(m.values());
      }
    } catch (e) {
      console.warn(`[SyncManager] Error merging ${key} before write:`, e);
    }
  }

  // 🛡️ Asistencias y Turnos (Contratos, Plantillas, Horarios Maestro): Propagar a todas las sedes y a la clave global
  const isAttendanceConfig = key.startsWith('attendance_contracts') || key.startsWith('attendance_shifts') || key.startsWith('attendance_groups') || key.startsWith('attendance_terminals');
  if (isAttendanceConfig && Array.isArray(value)) {
    try {
      const baseKey = getBaseKey(key);
      const nowIso = new Date().toISOString();
      const branchIds = ['BRANCH-001'];
      try {
        const branches = useBranchStore?.getState?.()?.branches || [];
        branches.forEach(b => { if (b?.id && !branchIds.includes(b.id)) branchIds.push(b.id); });
      } catch (_) {}

      const upserts = [
        supabase.from('app_state').upsert({ key: baseKey, value, updated_at: nowIso }, { onConflict: 'key' })
      ];
      branchIds.forEach(bid => {
        upserts.push(supabase.from('app_state').upsert({ key: `${baseKey}_${bid}`, value, updated_at: nowIso }, { onConflict: 'key' }));
      });

      await Promise.allSettled(upserts);
      return;
    } catch (e) {
      console.warn('[SyncManager] Error saving attendance configuration:', e);
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

  // Dedupe: muchas acciones llaman push(key, x, branchId) Y push(key, x, null),
  // que para BRANCH-001 resuelven a la MISMA supabaseKey con el MISMO valor.
  // Se salta la 2ª escritura idéntica si llega en < 3s.
  // EXCEPTO en claves con merge especial en _writeToSupabaseImpl, donde re-ejecutar
  // el merge sí puede recoger un cambio remoto concurrente.
  const hasSpecialMerge = (
    supabaseKey.startsWith('posShifts') || supabaseKey.startsWith('posSales') ||
    supabaseKey.startsWith('posExpenses') || supabaseKey.startsWith('posDescargues') ||
    supabaseKey.startsWith('pendingRequests') || supabaseKey.startsWith('completedRequests') ||
    supabaseKey.startsWith('rejectedRequests') || supabaseKey.startsWith('loadHistory') ||
    supabaseKey.startsWith('attendance_') || supabaseKey.startsWith('contrataPayments') ||
    supabaseKey.startsWith('movements')
  );
  if (!hasSpecialMerge) {
    try {
      const sig = JSON.stringify(value);
      const last = _lastPushSig.get(supabaseKey);
      if (last && last.sig === sig && (Date.now() - last.t) < 3000) {
        return;
      }
      _lastPushSig.set(supabaseKey, { sig, t: Date.now() });
    } catch (_) {}
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

  const uniqueKeys = [...new Set(keysToFetch)];

  // 🛡️ Un solo .in() con 100+ claves es lento y disparaba timeouts en Supabase.
  // Se trocea en lotes en paralelo: cada lote tiene su propio timeout y un lote
  // lento nunca bloquea a los demás -> se devuelve lo que sí llegó (parcial > nada).
  const CHUNK_SIZE = 40;
  const CHUNK_TIMEOUT_MS = 10000;
  const chunks = [];
  for (let i = 0; i < uniqueKeys.length; i += CHUNK_SIZE) {
    chunks.push(uniqueKeys.slice(i, i + CHUNK_SIZE));
  }

  const fetchChunk = (chunk, idx) => Promise.race([
    supabase.from('app_state').select('key, value').in('key', chunk),
    new Promise((resolve) => setTimeout(() => {
      console.warn(`[SyncManager] ⏱️ Timeout en pullAll lote ${idx + 1}/${chunks.length} (${CHUNK_TIMEOUT_MS}ms)`);
      resolve({ data: null, error: new Error('chunk timeout') });
    }, CHUNK_TIMEOUT_MS)),
  ]);

  const settled = await Promise.allSettled(chunks.map(fetchChunk));

  const out = {};
  let anyOk = false;
  for (const r of settled) {
    const rows = r.status === 'fulfilled' ? r.value?.data : null;
    if (Array.isArray(rows)) {
      anyOk = true;
      for (const row of rows) out[row.key] = row.value;
    }
  }
  if (!anyOk) console.warn('[SyncManager] pullAll: ningún lote respondió — se usa respaldo local');
  return out;
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
