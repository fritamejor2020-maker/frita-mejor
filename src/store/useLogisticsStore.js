import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

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

    set({ pendingRequests: [...pendingRequests, newRequest] });
    get().clearRestockCart();
  },

  // ===============================
  // ACCIONES LOGÍSTICA (DEJADOR)
  // ===============================

  fetchPendingRequests: async () => {
    // Local Mock: Do nothing, state already holds it
    const { pendingRequests } = get();
    console.log("Fetched pending requests locally:", pendingRequests.length);
  },

  /**
   * Acción Crítica 'Dejador'
   */
  commitRestock: async (requestId) => {
    // Local Mock: remove from pendingRequests and add to completedRequests
    const { pendingRequests, completedRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    set({
      pendingRequests: pendingRequests.filter(req => req.id !== requestId),
      completedRequests: [{ ...req, status: 'completed', completed_at: new Date().toISOString() }, ...completedRequests]
    });
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
