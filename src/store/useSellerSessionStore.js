import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store global para administrar el estado del Vendedor (Módulo Candado).
 * PERSISTE en localStorage: la sesión sobrevive navegación y recargas
 * hasta que el vendedor hace su cierre (endShift).
 */
export const useSellerSessionStore = create(
  persist(
    (set) => ({
      // Estado base de la sesión activa
      isSetupComplete: false,
      pointId: null,        // VARCHAR, ej: 'T1'
      shift: null,          // 'AM' | 'PM' | 'MD'
      pointType: null,      // 'fija' | 'variable' | 'local'
      responsibleName: null,
      openedAt: null,       // ISO timestamp del inicio del turno

      /**
       * Inicializa el candado. Ningún vendedor puede operar si isSetupComplete es false.
       */
      startShift: (sessionData) => {
        set({
          isSetupComplete: true,
          pointId: sessionData.pointId,
          shift: sessionData.shift,
          pointType: sessionData.pointType,
          responsibleName: sessionData.responsibleName,
          openedAt: new Date().toISOString(),
        });
      },

      /**
       * Limpia el estado del candado al finalizar el día o cambiar de usuario.
       * Solo se llama al hacer el cierre de jornada.
       */
      endShift: () => {
        set({
          isSetupComplete: false,
          pointId: null,
          shift: null,
          pointType: null,
          responsibleName: null,
          openedAt: null,
        });
      }
    }),
    {
      name: 'frita-seller-session', // clave en localStorage
      // Solo persistir el estado de sesión, NO las funciones
      partialize: (state) => ({
        isSetupComplete: state.isSetupComplete,
        pointId: state.pointId,
        shift: state.shift,
        pointType: state.pointType,
        responsibleName: state.responsibleName,
        openedAt: state.openedAt,
      }),
    }
  )
);

