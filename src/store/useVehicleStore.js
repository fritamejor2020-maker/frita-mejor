import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

function syncVehicles(vehicles) {
  markLocalWrite('vehicles');
  push('vehicles', vehicles).catch(err => console.warn('[Sync] vehicles:', err.message));
}

/**
 * Global store to manage points of sale/vehicles (Tricycles)
 * Contains the abbreviations (T1, T2) and handles CRUD for admin configuration.
 */
export const useVehicleStore = create(
  persist(
    (set, get) => ({
      vehicles: [
        { id: '1',  type: 'Triciclo', name: 'Triciclo 1', abbreviation: 'T1', active: true },
        { id: '2',  type: 'Triciclo', name: 'Triciclo 2', abbreviation: 'T2', active: true },
        { id: '3',  type: 'Triciclo', name: 'Triciclo 3', abbreviation: 'T3', active: true },
        { id: '4',  type: 'Triciclo', name: 'Triciclo 4', abbreviation: 'T4', active: true },
        { id: '5',  type: 'Triciclo', name: 'Triciclo 5', abbreviation: 'T5', active: true },
        { id: '6',  type: 'Triciclo', name: 'Triciclo 6', abbreviation: 'T6', active: true },
        { id: '7',  type: 'Local',    name: 'Local 1',    abbreviation: 'L1', active: true },
        { id: '8',  type: 'Local',    name: 'Local 2',    abbreviation: 'L2', active: true },
        { id: '9',  type: 'Local',    name: 'Local 3',    abbreviation: 'L3', active: true },
        { id: '10', type: 'Carrito',  name: 'Carrito 1',  abbreviation: 'C1', active: true },
        { id: '11', type: 'Carrito',  name: 'Carrito 2',  abbreviation: 'C2', active: true },
        { id: '12', type: 'Carrito',  name: 'Carrito 3',  abbreviation: 'C3', active: true },
      ],

      addVehicle: (vehicleData) => {
        const newVehicle = {
          id: Date.now().toString(),
          active: true,
          type: 'Triciclo', // Default type for now
          ...vehicleData
        };
        set((state) => ({ vehicles: [...state.vehicles, newVehicle] }));
        syncVehicles(useVehicleStore.getState().vehicles);
      },

      updateVehicle: (id, updatedData) => {
        set((state) => ({
          vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...updatedData } : v)
        }));
        syncVehicles(useVehicleStore.getState().vehicles);
      },

      removeVehicle: (id) => {
        set((state) => ({
          vehicles: state.vehicles.filter(v => v.id !== id)
        }));
        syncVehicles(useVehicleStore.getState().vehicles);
      },

      // Returns ALL active point abbreviations (Triciclos + Locales + Carritos)
      getAllActivePoints: () => {
        return get().vehicles
          .filter(v => v.active)
          .map(v => v.abbreviation || v.name);
      },

      // Returns only active Triciclo abbreviations (for legacy compatibility)
      getActiveTricycleAbbreviations: () => {
        return get().vehicles
          .filter(v => v.type === 'Triciclo' && v.active)
          .map(v => v.abbreviation || v.name);
      }
    }),
    {
      name: 'frita-mejor-vehicles',
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          const existing = persisted.vehicles || [];
          const hasLocal = existing.some(v => v.type === 'Local');
          const hasCarrito = existing.some(v => v.type === 'Carrito');
          if (!hasLocal) {
            existing.push(
              { id: '7',  type: 'Local',   name: 'Local 1',   abbreviation: 'L1', active: true },
              { id: '8',  type: 'Local',   name: 'Local 2',   abbreviation: 'L2', active: true },
              { id: '9',  type: 'Local',   name: 'Local 3',   abbreviation: 'L3', active: true }
            );
          }
          if (!hasCarrito) {
            existing.push(
              { id: '10', type: 'Carrito', name: 'Carrito 1', abbreviation: 'C1', active: true },
              { id: '11', type: 'Carrito', name: 'Carrito 2', abbreviation: 'C2', active: true },
              { id: '12', type: 'Carrito', name: 'Carrito 3', abbreviation: 'C3', active: true }
            );
          }
          persisted.vehicles = existing;
        }
        return persisted;
      }
    }
  )
);
