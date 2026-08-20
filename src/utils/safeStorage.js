import { createJSONStorage } from 'zustand/middleware';

/**
 * Wrapper de LocalStorage Anti-Crash (QuotaExceededError Protection)
 * ──────────────────────────────────────────────────────────────────
 * Previene pantallas rojas de "QuotaExceededError: The quota has been exceeded."
 * capturando cualquier fallo de cuota en navegadores móviles/escritorio,
 * limpiando automáticamente datos pesados/temporales y reintentando la escritura.
 */
export const safeLocalStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.warn(`[SafeStorage] Error leyendo "${name}":`, e);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn(`[SafeStorage] QuotaExceededError capturado en "${name}". Iniciando autolimpieza...`, e);
      try {
        // Identificar y purgar llaves pesadas o secundarias (logs de asistencia antiguos, mensajes de chat, caché)
        const keysToPrune = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key !== name) {
            keysToPrune.push(key);
          }
        }
        
        // Purgar primero registros no esenciales
        keysToPrune.forEach(k => {
          if (
            k.includes('chat') ||
            k.includes('temp') ||
            k.includes('cache') ||
            k.includes('old') ||
            k.includes('logs') ||
            k.includes('backup') ||
            k.includes('logistics')
          ) {
            try { localStorage.removeItem(k); } catch (_) {}
          }
        });

        // Reintentar guardar
        localStorage.setItem(name, value);
      } catch (err2) {
        console.error(`[SafeStorage] No se pudo liberar suficiente cuota para "${name}":`, err2);
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn(`[SafeStorage] Error eliminando "${name}":`, e);
    }
  },
};

// ─── Adaptador de Alta Capacidad con IndexedDB ────────────────────────────────
// Amplía el límite de almacenamiento del iPad de 5 MB a 1 GB+ en IndexedDB
const DB_NAME = 'FritaMejorStorageDB';
const STORE_NAME = 'kv_store';

function getDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const idbStorage = {
  async getItem(name) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(name);
        req.onsuccess = () => {
          if (req.result !== undefined && req.result !== null) {
            resolve(req.result);
          } else {
            // Fallback de migración: buscar en localStorage si aún no está en IndexedDB
            resolve(safeLocalStorage.getItem(name));
          }
        };
        req.onerror = () => resolve(safeLocalStorage.getItem(name));
      });
    } catch {
      return safeLocalStorage.getItem(name);
    }
  },
  async setItem(name, value) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, name);
        req.onsuccess = () => resolve();
        req.onerror = () => {
          safeLocalStorage.setItem(name, value);
          resolve();
        };
      });
    } catch {
      safeLocalStorage.setItem(name, value);
    }
  },
  async removeItem(name) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(name);
        req.onsuccess = () => {
          safeLocalStorage.removeItem(name);
          resolve();
        };
        req.onerror = () => {
          safeLocalStorage.removeItem(name);
          resolve();
        };
      });
    } catch {
      safeLocalStorage.removeItem(name);
    }
  }
};

export const safeJSONStorage = createJSONStorage(() => idbStorage);
