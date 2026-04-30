import { supabase } from './supabase';

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

// ─── Clasificación de llaves ───────────────────────────────────────────────────

/**
 * Llaves GLOBALES — compartidas entre todas las sedes.
 * Solo catálogos y configuración maestros que son idénticos en todas las sedes.
 */
export const GLOBAL_KEYS = [
  // Catálogos de productos (los mismos en todas las sedes)
  'products', 'recipes', 'fritadoRecipes', 'posCategories',
  // Administración global del sistema
  'users', 'branches', 'suppliers',
  // Traslados (son cross-sede por diseño)
  'transfers',
];

/**
 * Llaves LOCALES — específicas de cada sede.
 * Se almacenan en Supabase como `<key>_<branchId>` (ej: `posSales_BRANCH-001`).
 */
export const BRANCH_KEYS = [
  // Inventario y bodega
  'inventory', 'movements', 'warehouses',
  // POS
  'posShifts', 'posSales', 'posExpenses', 'posRegisters', 'posSettings',
  'contrataPayments', 'deletedShiftIds',
  // Logística (Dejador / Vendedor) — por sede
  'pendingRequests', 'completedRequests', 'rejectedRequests', 'loadHistory',
  // Vehículos / Triciclos — por sede
  'vehicles',
  // Plantillas de carga — por sede
  'loadTemplates',
  // Clientes — por sede
  'customers', 'customerTypes',
  // Nómina — por sede
  'payrollEmployees', 'payrollRecords',
  // GPS vendedores — por sede
  'vendorLocations',
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

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(supabaseKey, value) {
  const queue = getQueue();
  const existingIndex = queue.findIndex(item => item.key === supabaseKey);
  if (existingIndex !== -1) {
    queue[existingIndex] = { key: supabaseKey, value, timestamp: Date.now(), retries: 0 };
  } else {
    queue.push({ key: supabaseKey, value, timestamp: Date.now(), retries: 0 });
  }
  saveQueue(queue);
  notifyListeners({ online: isOnline, pendingCount: queue.length, syncing: false });
}

// ─── Escritura a Supabase ─────────────────────────────────────────────────────

function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url.length > 0 && !url.includes('placeholder');
}

async function writeToSupabase(supabaseKey, value) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado: faltan variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }
  const { error } = await supabase
    .from('app_state')
    .upsert({ key: supabaseKey, value }, { onConflict: 'key' });
  if (error) throw error;
}

// ─── Vaciado de cola ──────────────────────────────────────────────────────────

export async function flushQueue() {
  if (isSyncing) return;
  const queue = getQueue();
  if (queue.length === 0) {
    notifyListeners({ online: true, pendingCount: 0, syncing: false });
    return;
  }

  isSyncing = true;
  notifyListeners({ online: true, pendingCount: queue.length, syncing: true });

  const remaining = [];
  try {
    for (const item of queue) {
      try {
        await writeToSupabase(item.key, item.value);
      } catch (err) {
        const retries = (item.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          console.warn(`[SyncManager] "${item.key}" descartado tras ${MAX_RETRIES} intentos fallidos:`, err.message);
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

// ─── API pública de escritura ─────────────────────────────────────────────────

/**
 * Escribe un valor al store de Supabase.
 * @param {string} key — nombre BASE de la llave (ej: 'posSales', no 'posSales_BRANCH-001')
 * @param {any} value — valor (array u objeto)
 * @param {string|null} branchId — ID de la sede. null = llave global o Admin.
 */
export async function push(key, value, branchId = null) {
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
    .single();
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
  const keysToFetch = [...GLOBAL_KEYS];

  if (branchId === null) {
    // Admin: descarga llaves de todas las sedes conocidas
    const effectiveBranches = allBranchIds.length > 0 ? allBranchIds : ['BRANCH-001'];
    for (const bid of effectiveBranches) {
      for (const bk of BRANCH_KEYS) {
        keysToFetch.push(`${bk}_${bid}`);
      }
    }
    // También incluir las llaves legacy (sin sufijo) para la migración inicial
    for (const bk of BRANCH_KEYS) {
      if (!keysToFetch.includes(bk)) keysToFetch.push(bk);
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
