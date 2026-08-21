import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

function syncVehicles(statePayload) {
  const payload = {
    vehicles: statePayload.vehicles || [],
    sellerViewEnabled: statePayload.sellerViewEnabled ?? true,
    dejadorViewEnabled: statePayload.dejadorViewEnabled ?? true,
    enabledPointTypes: statePayload.enabledPointTypes || { Triciclo: true, Carrito: true, Local: false },
  };
  markLocalWrite('vehicles');
  markLocalWrite('vehicles_BRANCH-001');
  push('vehicles', payload).catch(err => console.warn('[Sync] vehicles:', err.message));
  push('vehicles_BRANCH-001', payload).catch(err => console.warn('[Sync] vehicles_BRANCH-001:', err.message));
}

/**
 * Global store to manage points of sale/vehicles (Tricycles)
 * Contains the abbreviations (T1, T2) and handles CRUD for admin configuration.
 */
export const useVehicleStore = create(
  persist(
    (set, get) => ({
      vehicles: [
        { id: '1',  type: 'Triciclo', name: 'Triciclo 1', abbreviation: 'T1', active: true, branchId: 'BRANCH-001' },
        { id: '2',  type: 'Triciclo', name: 'Triciclo 2', abbreviation: 'T2', active: true, branchId: 'BRANCH-001' },
        { id: '3',  type: 'Triciclo', name: 'Triciclo 3', abbreviation: 'T3', active: true, branchId: 'BRANCH-001' },
        { id: '4',  type: 'Triciclo', name: 'Triciclo 4', abbreviation: 'T4', active: true, branchId: 'BRANCH-001' },
        { id: '5',  type: 'Triciclo', name: 'Triciclo 5', abbreviation: 'T5', active: true, branchId: 'BRANCH-001' },
        { id: '6',  type: 'Triciclo', name: 'Triciclo 6', abbreviation: 'T6', active: true, branchId: 'BRANCH-001' },
        { id: '7',  type: 'Local',    name: 'Local 1',    abbreviation: 'L1', active: true, branchId: 'BRANCH-001' },
        { id: '8',  type: 'Local',    name: 'Local 2',    abbreviation: 'L2', active: true, branchId: 'BRANCH-001' },
        { id: '9',  type: 'Local',    name: 'Local 3',    abbreviation: 'L3', active: true, branchId: 'BRANCH-001' },
        { id: '10', type: 'Carrito',  name: 'Carrito 1',  abbreviation: 'C1', active: true, branchId: 'BRANCH-001' },
        { id: '11', type: 'Carrito',  name: 'Carrito 2',  abbreviation: 'C2', active: true, branchId: 'BRANCH-001' },
        { id: '12', type: 'Carrito',  name: 'Carrito 3',  abbreviation: 'C3', active: true, branchId: 'BRANCH-001' },
      ],

      // Controla si la vista del Vendedor y del Dejador están habilitadas
      sellerViewEnabled: true,
      dejadorViewEnabled: true,

      // Controla qué tipos de punto aparecen como botones en el setup del Vendedor
      enabledPointTypes: { Triciclo: true, Carrito: true, Local: false },

      toggleSellerView: () => {
        set((state) => ({ sellerViewEnabled: !state.sellerViewEnabled }));
        syncVehicles(get());
      },

      toggleDejadorView: () => {
        set((state) => ({ dejadorViewEnabled: !state.dejadorViewEnabled }));
        syncVehicles(get());
      },

      togglePointType: (type) => {
        set((state) => ({
          enabledPointTypes: {
            ...state.enabledPointTypes,
            [type]: !state.enabledPointTypes?.[type],
          },
        }));
        syncVehicles(get());
      },

      addVehicle: (vehicleData) => {
        const user = useAuthStore.getState().user;
        const newVehicle = {
          id: Date.now().toString(),
          active: true,
          type: 'Triciclo',
          branchId: vehicleData.branchId || user?.branchId || 'BRANCH-001',
          ...vehicleData
        };
        set((state) => ({ vehicles: [...state.vehicles, newVehicle] }));
        syncVehicles(get());
      },

      updateVehicle: (id, updatedData) => {
        set((state) => ({
          vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...updatedData } : v)
        }));
        syncVehicles(get());
      },

      removeVehicle: (id) => {
        set((state) => ({
          vehicles: state.vehicles.filter(v => v.id !== id)
        }));
        syncVehicles(get());
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
      },

      // ─── Carga remota ──────────────────────────────────────────────────────
      loadFromRemote: async (remotePayload = null) => {
        let payload = remotePayload;
        if (!payload) {
          try {
            const { data } = await supabase
              .from('app_state')
              .select('value')
              .eq('key', 'vehicles')
              .maybeSingle();
            if (data && data.value) {
              payload = data.value;
            }
          } catch (e) {}
        }

        if (Array.isArray(payload)) {
          set({ vehicles: payload });
        } else if (payload && typeof payload === 'object') {
          set({
            vehicles: Array.isArray(payload.vehicles) ? payload.vehicles : (get().vehicles || []),
            sellerViewEnabled: payload.sellerViewEnabled ?? true,
            dejadorViewEnabled: payload.dejadorViewEnabled ?? true,
            enabledPointTypes: payload.enabledPointTypes || { Triciclo: true, Carrito: true, Local: false },
          });
        }
      },
    }),
    {
      name: 'frita-mejor-vehicles',
      version: 3, // v3: branchId en cada vehículo
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
        if (version < 3) {
          // Asignar BRANCH-001 a todos los vehículos sin sede
          persisted.vehicles = (persisted.vehicles || []).map(v =>
            v.branchId ? v : { ...v, branchId: 'BRANCH-001' }
          );
        }
        return persisted;
      }
    }
  )
);
