import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store global para administrar el estado del Dejador (jornada activa).
 * PERSISTE en localStorage: la sesión sobrevive navegación y recargas
 * hasta que el dejador hace su cierre (endShift).
 *
 * Cada jornada tiene DOS personas:
 *   - anotadorName: quien recibe y anota los pedidos
 *   - dejadorName:  quien transporta y entrega los pedidos
 */
export const useDejadorSessionStore = create(
  persist(
    (set) => ({
      isSetupComplete: false,
      shift: null,          // 'AM' | 'MD' | 'PM'
      anotadorName: null,
      dejadorName: null,
      openedAt: null,

      startShift: (sessionData) => {
        set({
          isSetupComplete: true,
          shift: sessionData.shift,
          anotadorName: sessionData.anotadorName,
          dejadorName: sessionData.dejadorName,
          openedAt: sessionData.openedAt || new Date().toISOString(),
        });
      },

      endShift: () => {
        set({
          isSetupComplete: false,
          shift: null,
          anotadorName: null,
          dejadorName: null,
          openedAt: null,
        });
      },
    }),
    {
      name: 'frita-dejador-session',
      partialize: (state) => ({
        isSetupComplete: state.isSetupComplete,
        shift: state.shift,
        anotadorName: state.anotadorName,
        dejadorName: state.dejadorName,
        openedAt: state.openedAt,
      }),
    }
  )
);
