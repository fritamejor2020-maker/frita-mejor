/**
 * crossTabSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronización en tiempo real entre pestañas del mismo origen usando
 * BroadcastChannel (no requiere Supabase ni internet).
 *
 * Flujo:
 *   Tab A modifica un store → broadcast('frita-sync', { key, state })
 *   Tab B escucha → aplica el estado al store correspondiente
 *
 * Las stores que se sincronizan:
 *   - frita-mejor-logistics    (cargas, pedidos, recepciones)
 *   - frita-mejor-inventory    (inventario, productos, shifts)
 *   - frita-mejor-vehicles     (vehículos)
 *   - frita-seller-session     (sesión activa del vendedor)
 *   - frita-dejador-session    (sesión activa del dejador)
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

/**
 * Registra un store de Zustand para la sincronización entre pestañas.
 * @param {string} localStorageKey  - La clave del persist middleware (ej: 'frita-mejor-logistics')
 * @param {Function} setState       - Función para aplicar el estado (store.setState)
 * @param {Function} getState       - Función para obtener el estado actual (store.getState)
 */
export function registerStore(localStorageKey, setState, getState) {
  storeRegistry.set(localStorageKey, { setState, getState });
}

/**
 * Emite el estado actual de un store a todas las otras pestañas.
 * Llamar esta función DESPUÉS de cada mutación de estado.
 * @param {string} localStorageKey - clave del store
 * @param {Object} state           - nuevo estado a difundir
 */
export function broadcastState(localStorageKey, state) {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage({ key: localStorageKey, state, timestamp: Date.now() });
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
    const { key, state } = event.data || {};
    if (!key || !state) return;

    const store = storeRegistry.get(key);
    if (!store) return;

    // Solo aplicar si el estado recibido es diferente al actual
    // (evita loops con mensajes 'rebotados')
    try {
      store.setState(state, true); // true = replace, no merge
    } catch (err) {
      console.warn(`[CrossTabSync] Error aplicando estado de "${key}":`, err.message);
    }
  };

  // Fallback: escuchar eventos de storage (funciona en Safari donde BroadcastChannel
  // puede tener limitaciones). El evento 'storage' se dispara en otras pestañas
  // cuando localStorage cambia.
  window.addEventListener('storage', (event) => {
    // Solo las claves registradas
    if (!storeRegistry.has(event.key)) return;
    if (!event.newValue) return;

    try {
      const persisted = JSON.parse(event.newValue);
      const newState = persisted?.state;
      if (!newState) return;

      const store = storeRegistry.get(event.key);
      if (store) {
        store.setState(newState, true);
      }
    } catch {
      // JSON inválido, ignorar
    }
  });

  console.log('[CrossTabSync] Sincronización entre pestañas activada ✅');
}
