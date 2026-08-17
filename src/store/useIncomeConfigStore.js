import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

const defaultIncomeHierarchy = {
  Local: {
    AM: ['6-10 am', '10-12 pm'],
    PM: ['12-2 pm', '2-4 pm', '4-7 pm', '7-9 pm']
  },
  Triciclo: {
    AM: [],  // The actual tricycle list comes from useVehicleStore dynamically
    MD: [],
    PM: []
  },
  Contratas: {
    AM: ['6-10 am', '10-12 pm'],
    PM: ['12-2 pm', '2-4 pm', '4-7 pm', '7-9 pm']
  },
  Venta: {
    Extra: ['Extra']
  }
};

function syncIncomeConfig(state) {
  const payload = {
    hierarchy: state.hierarchy || defaultIncomeHierarchy,
    descarguesEnabled: state.descarguesEnabled || {},
  };
  markLocalWrite('incomeConfig');
  push('incomeConfig', payload).catch(err => console.warn('[Sync] incomeConfig:', err.message));
}

export const useIncomeConfigStore = create(
  persist(
    (set, get) => ({
      hierarchy: defaultIncomeHierarchy,

      // Mapa de franjas con descargues activos: "Ubicacion|Jornada|slot" → boolean
      // Por defecto activo para Local PM jornadas 4-7pm y 7-9pm
      descarguesEnabled: {
        'Local|PM|4-7 pm': true,
        'Local|PM|7-9 pm': true,
      },

      /** Activa o desactiva descargues para una franja horaria */
      toggleDescargues: (ubicacion, jornada, slot) => {
        const key = `${ubicacion}|${jornada}|${slot}`;
        set(state => ({
          descarguesEnabled: {
            ...state.descarguesEnabled,
            [key]: !state.descarguesEnabled[key],
          },
        }));
        syncIncomeConfig(get());
      },

      /** Retorna true si la franja tiene descargues activos */
      isDescarguesEnabled: (ubicacion, jornada, slot) => {
        const key = `${ubicacion}|${jornada}|${slot}`;
        return !!get().descarguesEnabled[key];
      },

      updateHierarchy: (newHierarchy) => {
        set({ hierarchy: newHierarchy });
        syncIncomeConfig(get());
      },

      addLocation: (locationName) => {
        set((state) => {
          if (state.hierarchy[locationName]) return state; // Already exists
          return {
            hierarchy: {
              ...state.hierarchy,
              [locationName]: {}
            }
          };
        });
        syncIncomeConfig(get());
      },

      removeLocation: (locationName) => {
        set((state) => {
          const newHierarchy = { ...state.hierarchy };
          delete newHierarchy[locationName];
          return { hierarchy: newHierarchy };
        });
        syncIncomeConfig(get());
      },

      addShift: (locationName, shiftName) => {
        set((state) => {
          if (!state.hierarchy[locationName] || state.hierarchy[locationName][shiftName]) return state;
          
          const newHierarchy = { ...state.hierarchy };
          newHierarchy[locationName] = { ...newHierarchy[locationName], [shiftName]: [] };
          return { hierarchy: newHierarchy };
        });
        syncIncomeConfig(get());
      },

      removeShift: (locationName, shiftName) => {
        set((state) => {
           if (!state.hierarchy[locationName]) return state;
           const newHierarchy = { ...state.hierarchy };
           newHierarchy[locationName] = { ...newHierarchy[locationName] };
           delete newHierarchy[locationName][shiftName];
           return { hierarchy: newHierarchy };
        });
        syncIncomeConfig(get());
      },

      addTimeSlot: (locationName, shiftName, timeSlot) => {
        set((state) => {
          if (!state.hierarchy[locationName] || !state.hierarchy[locationName][shiftName]) return state;
          const currentSlots = state.hierarchy[locationName][shiftName];
          if (currentSlots.includes(timeSlot)) return state;

          const newHierarchy = { ...state.hierarchy };
          newHierarchy[locationName] = {
            ...newHierarchy[locationName],
            [shiftName]: [...currentSlots, timeSlot]
          };
          return { hierarchy: newHierarchy };
        });
        syncIncomeConfig(get());
      },

      removeTimeSlot: (locationName, shiftName, timeSlot) => {
        set((state) => {
           if (!state.hierarchy[locationName] || !state.hierarchy[locationName][shiftName]) return state;
           const currentSlots = state.hierarchy[locationName][shiftName];
           
           const newHierarchy = { ...state.hierarchy };
           newHierarchy[locationName] = {
             ...newHierarchy[locationName],
             [shiftName]: currentSlots.filter(s => s !== timeSlot)
           };
           return { hierarchy: newHierarchy };
        });
        syncIncomeConfig(get());
      }
    }),
    {
      name: 'frita-mejor-income-config',
      version: 1,
    }
  )
);
