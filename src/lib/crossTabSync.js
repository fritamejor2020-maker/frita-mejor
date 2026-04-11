/**
 * crossTabSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronización en tiempo real entre pestañas del mismo origen usando
 * BroadcastChannel (no requiere Supabase ni internet).
 *
 * Usa versiones (timestamp) para que las eliminaciones siempre ganen sobre
 * estados obsoletos de otras pestañas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CHANNEL_NAME = 'frita-cross-tab-sync';

// BroadcastChannel singleton
let channel = null;

function getChannel() {
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      console.warn('[CrossTabSync] BroadcastChannel no soportado en este navegador.');
    }
  }
  return channel;
}

// Registro de stores: key de localStorage → setter de estado
const storeRegistry = new Map();

// Versión local por clave (timestamp del último write propio)
const localVersions = new Map();

/**
 * Registra un store de Zustand para la sincronización entre pestañas.
 */
export function registerStore(localStorageKey, setState, getState) {
  storeRegistry.set(localStorageKey, { setState, getState });
}

/**
 * Emite el estado actual de un store a todas las otras pestañas.
 * El timestamp actúa como versión — el más reciente SIEMPRE gana.
 */
export function broadcastState(localStorageKey, state) {
  const ch = getChannel();
  if (!ch) return;
  const ts = Date.now();
  localVersions.set(localStorageKey, ts);
  try {
    ch.postMessage({ key: localStorageKey, state, ts });
  } catch (err) {
    console.warn('[CrossTabSync] Error al emitir:', err.message);
  }
}

// ─── Listener global de mensajes entrantes ───────────────────────────────────

let initialized = false;

export function initCrossTabSync() {
  if (initialized) return;
  initialized = true;

  const ch = getChannel();
  if (!ch) return;

  ch.onmessage = (event) => {
    const { key, state, ts } = event.data || {};
    if (!key || !state) return;

    const store = storeRegistry.get(key);
    if (!store) return;

    // Solo aplicar si el mensaje es MÁS RECIENTE que nuestro último write propio
    const myTs = localVersions.get(key) || 0;
    if (ts <= myTs) {
      // Nuestro estado es igual o más nuevo → ignorar (evita que otra tab
      // restaure datos que acabamos de eliminar)
      return;
    }

    try {
      store.setState(state, true); // true = replace, no merge
    } catch (err) {
      console.warn(`[CrossTabSync] Error aplicando estado de "${key}":`, err.message);
    }
  };

  // El evento 'storage' ya NO se usa para sincronizar estado directamente,
  // porque no podemos saber si el cambio es más reciente que el nuestro.
  // Solo lo usamos como señal para pedir el estado actualizado via BroadcastChannel.
  // (Deshabilitado para evitar restaurar datos eliminados desde otras tabs)

  console.log('[CrossTabSync] Sincronización entre pestañas activada ✅');
}
