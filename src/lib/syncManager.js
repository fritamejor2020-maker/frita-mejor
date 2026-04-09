import { supabase } from './supabase';

// ==============================================================================
// SYNC MANAGER — Motor de sincronización Offline-First
// Responsabilidades:
//   1. Escribir cambios en Supabase cuando hay internet
//   2. Encolar cambios localmente cuando no hay internet
//   3. Vaciar la cola cuando el internet regresa
//   4. Notificar al resto de la app sobre el estado de conexión
// ==============================================================================

const QUEUE_KEY = 'frita-sync-queue';
const SYNC_LISTENERS = new Set();

// ─── Estado interno ────────────────────────────────────────────────────────────

let isSyncing = false;
// Asumimos online=true al inicio. navigator.onLine es poco confiable en móviles
// (puede reportar false aunque haya conexión). Lo validamos con un probe real.
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

function enqueue(key, value) {
  const queue = getQueue();
  // Si ya hay un item pendiente para esta key, reemplazarlo (solo el último importa)
  const existingIndex = queue.findIndex(item => item.key === key);
  if (existingIndex !== -1) {
    queue[existingIndex] = { key, value, timestamp: Date.now() };
  } else {
    queue.push({ key, value, timestamp: Date.now() });
  }
  saveQueue(queue);
  notifyListeners({ online: false, pendingCount: queue.length, syncing: false });
}

// ─── Escritura a Supabase ─────────────────────────────────────────────────────

async function writeToSupabase(key, value) {
  const { error } = await supabase
    .from('app_state')
    .upsert({ key, value }, { onConflict: 'key' });
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
        console.warn(`[SyncManager] Error syncing "${item.key}":`, err.message);
        remaining.push(item);
      }
    }
  } finally {
    // SIEMPRE reseteamos isSyncing, aunque ocurra un error inesperado
    saveQueue(remaining);
    isSyncing = false;
    notifyListeners({ online: isOnline, pendingCount: remaining.length, syncing: false });
  }
}

// ─── API pública de escritura ─────────────────────────────────────────────────

/**
 * Escribe un valor al store de Supabase.
 * Si no hay internet, lo encola para cuando vuelva la conexión.
 * @param {string} key — clave en app_state
 * @param {any} value — valor (array u objeto)
 */
export async function push(key, value) {
  if (!isOnline) {
    enqueue(key, value);
    return;
  }

  try {
    await writeToSupabase(key, value);
    notifyListeners({ online: true, pendingCount: getQueue().length, syncing: false });
  } catch (err) {
    console.warn(`[SyncManager] Falló sync de "${key}", encolando:`, err.message);
    // Solo marcamos offline si es un error de red real, no un error de Supabase (RLS, etc.)
    const isNetworkError = err.message?.includes('fetch') ||
      err.message?.includes('network') ||
      err.message?.includes('Failed to fetch') ||
      err.name === 'TypeError';
    if (isNetworkError) {
      isOnline = false;
      notifyListeners({ online: false, pendingCount: getQueue().length + 1, syncing: false });
    }
    enqueue(key, value);
  }
}

/**
 * Lee una clave del estado remoto en Supabase.
 * @param {string} key
 * @returns {any} value o null si no existe
 */
export async function pull(key) {
  const { data, error } = await supabase
    .from('app_state')
    .select('value')
    .eq('key', key)
    .single();
  if (error || !data) return null;
  return data.value;
}

/**
 * Lee todas las claves de app_state de una vez (bulk pull al inicio).
 * @returns {Object} mapa key → value
 */
export async function pullAll() {
  const { data, error } = await supabase
    .from('app_state')
    .select('key, value');
  if (error || !data) return {};
  return Object.fromEntries(data.map(row => [row.key, row.value]));
}

// ─── Inicialización de listeners de red ──────────────────────────────────────

window.addEventListener('online', () => {
  isOnline = true;
  console.log('[SyncManager] Conexión restaurada. Sincronizando cola...');
  // Pequeño delay para que la red realmente esté disponible antes de intentar sync
  setTimeout(() => flushQueue(), 1000);
});

window.addEventListener('offline', () => {
  isOnline = false;
  const queue = getQueue();
  notifyListeners({ online: false, pendingCount: queue.length, syncing: false });
  console.log('[SyncManager] Sin conexión. Los cambios se guardarán localmente.');
});

// Probe de conectividad: verifica la conexión real con Supabase al arrancar.
// Resuelve el problema de navigator.onLine = false en móviles aunque haya internet.
async function probeConnectivity() {
  try {
    const { error } = await supabase.from('app_state').select('key').limit(1);
    if (!error) {
      if (!isOnline) {
        isOnline = true;
        notifyListeners({ online: true, pendingCount: getQueue().length, syncing: false });
      }
      // Si hay cola pendiente, vaciarla
      flushQueue();
    }
  } catch {
    // Si el probe falla, confiamos en navigator.onLine
    isOnline = navigator.onLine;
  }
}

// Ejecutar probe al cargar
probeConnectivity();

// Re-probar cada 30 segundos para recuperarse de falsos negativos
setInterval(probeConnectivity, 30_000);

export function getSyncStatus() {
  return {
    online: isOnline,
    pendingCount: getQueue().length,
    syncing: isSyncing,
  };
}
