import { create } from 'zustand';

/**
 * Store global para administrar el estado del Vendedor (Módulo Candado)
 */
export const useSellerSessionStore = create((set) => ({
  // Estado base de la sesión activa
  isSetupComplete: false,
  pointId: null,      // VARCHAR, ej: 'T1'
  shift: null,        // 'AM' | 'PM'
  pointType: null,    // 'fija' | 'variable' | 'local'
  responsibleName: null,

  /**
   * Inicializa el candado. Ningún vendedor puede operar si isSetupComplete es false.
   */
  startShift: (sessionData) => {
    set({
      isSetupComplete: true,
      pointId: sessionData.pointId,
      shift: sessionData.shift,
      pointType: sessionData.pointType,
      responsibleName: sessionData.responsibleName
    });
  },

  /**
   * Limpia el estado del candado al finalizar el día o cambiar de usuario.
   */
  endShift: () => {
    set({
      isSetupComplete: false,
      pointId: null,
      shift: null,
      pointType: null,
      responsibleName: null
    });
  }
}));
