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
let isOnline = navigator.onLine;

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
  for (const item of queue) {
    try {
      await writeToSupabase(item.key, item.value);
    } catch (err) {
      console.warn(`[SyncManager] Error syncing "${item.key}":`, err.message);
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  isSyncing = false;
  notifyListeners({ online: true, pendingCount: remaining.length, syncing: false });
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
    isOnline = false;
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
  flushQueue();
});

window.addEventListener('offline', () => {
  isOnline = false;
  const queue = getQueue();
  notifyListeners({ online: false, pendingCount: queue.length, syncing: false });
  console.log('[SyncManager] Sin conexión. Los cambios se guardarán localmente.');
});

export function getSyncStatus() {
  return {
    online: isOnline,
    pendingCount: getQueue().length,
    syncing: isSyncing,
  };
}
