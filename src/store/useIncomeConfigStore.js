import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useIncomeConfigStore = create(
  persist(
    (set) => ({
      hierarchy: defaultIncomeHierarchy,

      updateHierarchy: (newHierarchy) => {
        set({ hierarchy: newHierarchy });
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
      },

      removeLocation: (locationName) => {
        set((state) => {
          const newHierarchy = { ...state.hierarchy };
          delete newHierarchy[locationName];
          return { hierarchy: newHierarchy };
        });
      },

      addShift: (locationName, shiftName) => {
        set((state) => {
          if (!state.hierarchy[locationName] || state.hierarchy[locationName][shiftName]) return state;
          
          const newHierarchy = { ...state.hierarchy };
          newHierarchy[locationName] = { ...newHierarchy[locationName], [shiftName]: [] };
          return { hierarchy: newHierarchy };
        });
      },

      removeShift: (locationName, shiftName) => {
        set((state) => {
           if (!state.hierarchy[locationName]) return state;
           const newHierarchy = { ...state.hierarchy };
           newHierarchy[locationName] = { ...newHierarchy[locationName] };
           delete newHierarchy[locationName][shiftName];
           return { hierarchy: newHierarchy };
        });
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
      }
    }),
    {
      name: 'frita-mejor-income-config',
      version: 1,
    }
  )
);
