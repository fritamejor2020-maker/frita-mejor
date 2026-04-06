import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global store to manage points of sale/vehicles (Tricycles)
 * Contains the abbreviations (T1, T2) and handles CRUD for admin configuration.
 */
export const useVehicleStore = create(
  persist(
    (set, get) => ({
      vehicles: [
        { id: '1', type: 'Triciclo', name: 'Triciclo 1', abbreviation: 'T1', active: true },
        { id: '2', type: 'Triciclo', name: 'Triciclo 2', abbreviation: 'T2', active: true },
        { id: '3', type: 'Triciclo', name: 'Triciclo 3', abbreviation: 'T3', active: true },
        { id: '4', type: 'Triciclo', name: 'Triciclo 4', abbreviation: 'T4', active: true },
        { id: '5', type: 'Triciclo', name: 'Triciclo 5', abbreviation: 'T5', active: true },
        { id: '6', type: 'Triciclo', name: 'Triciclo 6', abbreviation: 'T6', active: true },
      ],

      addVehicle: (vehicleData) => {
        const newVehicle = {
          id: Date.now().toString(),
          active: true,
          type: 'Triciclo', // Default type for now
          ...vehicleData
        };
        set((state) => ({ vehicles: [...state.vehicles, newVehicle] }));
      },

      updateVehicle: (id, updatedData) => {
        set((state) => ({
          vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...updatedData } : v)
        }));
      },

      removeVehicle: (id) => {
        set((state) => ({
          vehicles: state.vehicles.filter(v => v.id !== id)
        }));
      },

      // Use this selector to get the abbreviations for the Income tables
      getActiveTricycleAbbreviations: () => {
        return get().vehicles
          .filter(v => v.type === 'Triciclo' && v.active)
          .map(v => v.abbreviation || v.name);
      }
    }),
    {
      name: 'frita-mejor-vehicles',
      version: 1,
    }
  )
);
