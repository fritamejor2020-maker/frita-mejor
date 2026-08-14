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
            k.includes('backup')
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

export const safeJSONStorage = createJSONStorage(() => safeLocalStorage);
