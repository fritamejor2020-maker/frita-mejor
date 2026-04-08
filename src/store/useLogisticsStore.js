import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

function syncKey(key, value) {
  markLocalWrite(key);
  push(key, value).catch(err => console.warn('[Sync]', key, err.message));
}

/**
 * Store global para administrar flujos Logísticos y de Surtido
 */
export const useLogisticsStore = create(
  persist(
    (set, get) => ({

      // Estado Vendedor: Array Temporal para crear una solicitud de surtido
      // Estructura: [{ productId: number, qty: number, name: string }]
      restockCart: [],
  
  // Estado Auxiliar Logística: View pending requests
  pendingRequests: [],
  completedRequests: [],

  // ===============================
  // ACCIONES VENDEDOR
  // ===============================
  
  addToRestockCart: (productId, qty, name) => {
    const currentCart = get().restockCart;
    const existing = currentCart.find(i => i.productId === productId);
    if (existing) {
      set({
        restockCart: currentCart.map(i =>
          i.productId === productId ? { ...i, qty: i.qty + qty } : i
        )
      });
    } else {
      set({ restockCart: [...currentCart, { productId, qty, name }] });
    }
  },

  clearRestockCart: () => {
    set({ restockCart: [] });
  },

  /**
   * Acción Vendedor
   * Hace un INSERT en restock_requests con estado pending y limpia el restockCart.
   */
  sendRestockRequest: async (pointId) => {
    const { restockCart, pendingRequests } = get();
    if (!pointId) throw new Error("Acceso denegado: pointId vacío.");
    if (restockCart.length === 0) throw new Error("Carrito de surtido vacío.");

    // Local Mock: Add to pendingRequests
    const newRequest = {
      id: `REQ-${Date.now()}`,
      requester_point_id: pointId,
      items_payload: restockCart,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const updated = [...pendingRequests, newRequest];
    set({ pendingRequests: updated });
    get().clearRestockCart();
    syncKey('pendingRequests', updated);
  },

  // ===============================
  // ACCIONES LOGÍSTICA (DEJADOR)
  // ===============================

  fetchPendingRequests: async () => {
    // Local Mock: Do nothing, state already holds it
    const { pendingRequests } = get();
    console.log("Fetched pending requests locally:", pendingRequests.length);
  },

  commitRestock: async (requestId) => {
    // Local Mock: remove from pendingRequests and add to completedRequests
    const { pendingRequests, completedRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const newPending = pendingRequests.filter(req => req.id !== requestId);
    const newCompleted = [{ ...req, status: 'completed', completed_at: new Date().toISOString() }, ...completedRequests];
    set({
      pendingRequests: newPending,
      completedRequests: newCompleted
    });
    syncKey('pendingRequests', newPending);
  },

  updatePendingRequest: (requestId, newPayload) => {
    const { pendingRequests } = get();
    const updated = pendingRequests.map(req => 
      req.id === requestId ? { ...req, items_payload: newPayload } : req
    );
    set({ pendingRequests: updated });
    syncKey('pendingRequests', updated);
  },

  // ===============================
  // CARGAS Y RECEPCIONES (DEJADOR)
  // ===============================
  loadHistory: [],

  /**
   * Registrar una carga inicial enviada a un vehículo
   */
  commitLoad: (vehicleId, quantities, products) => {
    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => {
        const prod = products.find(p => p.id === prodId);
        return { productId: prodId, name: prod?.name || prodId, qty };
      });
    if (items.length === 0) return false;

    const entry = {
      id: `LOAD-${Date.now()}`,
      type: 'carga',
      vehicleId,
      items,
      timestamp: new Date().toISOString()
    };
    set(state => ({ loadHistory: [entry, ...state.loadHistory] }));
    syncKey('loadHistory', [entry, ...get().loadHistory]);
    return true;
  },

  /**
   * Registrar una recepción de sobrantes de un vehículo
   */
  commitReception: (vehicleId, quantities, products) => {
    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => {
        const prod = products.find(p => p.id === prodId);
        return { productId: prodId, name: prod?.name || prodId, qty };
      });
    if (items.length === 0) return false;

    const entry = {
      id: `RECV-${Date.now()}`,
      type: 'recepcion',
      vehicleId,
      items,
      timestamp: new Date().toISOString()
    };
    set(state => ({ loadHistory: [entry, ...state.loadHistory] }));
    syncKey('loadHistory', [entry, ...get().loadHistory]);
    return true;
  }

    }),
    {
      name: 'frita-mejor-logistics',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          persistedState.completedRequests = persistedState.completedRequests || [];
          persistedState.loadHistory = persistedState.loadHistory || [];
        }
        return persistedState;
      },
      partialize: (state) => ({ 
        pendingRequests: state.pendingRequests, 
        completedRequests: state.completedRequests,
        loadHistory: state.loadHistory 
      }),
    }
  )
);
