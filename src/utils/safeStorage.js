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
        // Identificar y purgar llaves secundarias/antiguas o temporales
        const keysToPrune = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key !== name && (key.includes('chat') || key.includes('temp') || key.includes('cache') || key.includes('old'))) {
            keysToPrune.push(key);
          }
        }
        keysToPrune.forEach(k => localStorage.removeItem(k));
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

export const safeJSONStorage = createJSONStorage(() => safeLocalStorage);
