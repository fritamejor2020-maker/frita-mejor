import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useDejadorSessionStore } from './useDejadorSessionStore';

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
  sendRestockRequest: async (pointId, requesterName) => {
    const { restockCart, pendingRequests } = get();
    if (!pointId) throw new Error("Acceso denegado: pointId vacío.");
    if (restockCart.length === 0) throw new Error("Carrito de surtido vacío.");

    // Local Mock: Add to pendingRequests
    const newRequest = {
      id: `REQ-${Date.now()}`,
      requester_point_id: pointId,
      requester_name: requesterName || 'Desconocido',
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
    const { pendingRequests, completedRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const { anotadorName, dejadorName } = useDejadorSessionStore.getState();
    const newPending = pendingRequests.filter(req => req.id !== requestId);
    const newCompleted = [{
      ...req,
      status: 'completed',
      completed_at: new Date().toISOString(),
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
    }, ...completedRequests];
    set({ pendingRequests: newPending, completedRequests: newCompleted });
    syncKey('pendingRequests', newPending);
    syncKey('completedRequests', newCompleted);
  },

  updatePendingRequest: (requestId, newPayload) => {
    const { pendingRequests } = get();
    const updated = pendingRequests.map(req => 
      req.id === requestId ? { ...req, items_payload: newPayload } : req
    );
    set({ pendingRequests: updated });
    syncKey('pendingRequests', updated);
  },

  // Editar items de una entrada del historial de cargas/recepciones
  updateLoadEntry: (id, items) => {
    const { loadHistory } = get();
    const updated = loadHistory.map(e => e.id === id ? { ...e, items } : e);
    set({ loadHistory: updated });
    syncKey('loadHistory', updated);
  },

  // Editar items de un surtido completado
  updateCompletedRequestItems: (id, items_payload) => {
    const { completedRequests } = get();
    const updated = completedRequests.map(r => r.id === id ? { ...r, items_payload } : r);
    set({ completedRequests: updated });
    syncKey('completedRequests', updated);
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

    const { anotadorName, dejadorName } = useDejadorSessionStore.getState();
    const entry = {
      id: `LOAD-${Date.now()}`,
      type: 'carga',
      vehicleId,
      items,
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
      timestamp: new Date().toISOString()
    };
    const newHistory = [entry, ...get().loadHistory];
    set({ loadHistory: newHistory });
    syncKey('loadHistory', newHistory);
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

    const { anotadorName, dejadorName } = useDejadorSessionStore.getState();
    const entry = {
      id: `RECV-${Date.now()}`,
      type: 'recepcion',
      vehicleId,
      items,
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
      timestamp: new Date().toISOString()
    };
    const newHistory = [entry, ...get().loadHistory];
    set({ loadHistory: newHistory });
    syncKey('loadHistory', newHistory);
    return true;
  },

  /**
   * Calcula las unidades vendidas por vehículo usando el modelo de inventario:
   * Vendido = (Carga Inicial + Surtidos Entregados) - Sobrantes al Cierre
   *
   * @param {string} vehicleId - ej. 'T2'
   * @param {object} productPrices - { [productId]: price } mapa de precios
   * @param {string} [sinceTimestamp] - Filtrar solo desde esta fecha (ISO)
   * @returns {{ soldItems: Record<string, {qty, name, price}>, theoretical: number }}
   */
  calcSoldByVehicle: (vehicleId, productPrices, sinceTimestamp = null) => {
    const { loadHistory, completedRequests } = get();
    
    // Filter by START OF DAY so loads made before the vendor opens their session
    // (which is the normal workflow) are still counted.
    let since = null;
    if (sinceTimestamp) {
      const d = new Date(sinceTimestamp);
      since = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // midnight local
    }
    const inRange = ts => !since || new Date(ts) >= since;

    // Acumula cantidades { [productId]: qty }
    const totals = {};

    // 1. Carga inicial
    loadHistory
      .filter(e => e.type === 'carga' && e.vehicleId === vehicleId && inRange(e.timestamp))
      .forEach(e => {
        e.items.forEach(({ productId, qty }) => {
          totals[productId] = (totals[productId] || 0) + qty;
        });
      });

    // 2. Surtidos entregados durante el día
    completedRequests
      .filter(r => r.requester_point_id === vehicleId && inRange(r.completed_at || r.created_at))
      .forEach(r => {
        (r.items_payload || []).forEach(({ productId, qty }) => {
          totals[productId] = (totals[productId] || 0) + qty;
        });
      });

    // 3. Restar sobrantes (recepciones del dejador al cierre)
    loadHistory
      .filter(e => e.type === 'recepcion' && e.vehicleId === vehicleId && inRange(e.timestamp))
      .forEach(e => {
        e.items.forEach(({ productId, qty }) => {
          totals[productId] = (totals[productId] || 0) - qty;
        });
      });

    // 4. Calcular monto y estructurar soldItems
    const soldItems = {};
    let theoretical = 0;
    Object.entries(totals).forEach(([productId, qty]) => {
      if (qty <= 0) return;
      const { price = 0, name = productId } = productPrices[productId] || {};
      soldItems[productId] = { qty, name, price };
      theoretical += qty * price;
    });

    return { soldItems, theoretical };
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
