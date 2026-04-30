import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useDejadorSessionStore } from './useDejadorSessionStore';
import { useAuthStore } from './useAuthStore';

function syncKey(key, value) {
  const user = useAuthStore.getState().user;
  const branchId = user?.branchId ?? null;
  markLocalWrite(key, branchId);
  push(key, value, branchId).catch(err => console.warn('[Sync]', key, err.message));
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
  rejectedRequests: [],

  // ===============================
  // ACCIONES VENDEDOR
  // ===============================
  
  addToRestockCart: (productId, qty, name, abbreviation, stringValue) => {
    const currentCart = get().restockCart;
    const existing = currentCart.find(i => i.productId === productId);
    if (existing) {
      set({
        restockCart: currentCart.map(i =>
          i.productId === productId
            ? {
                ...i,
                qty: i.qty + qty,
                ...(abbreviation !== undefined && { abbreviation }),
                ...(stringValue !== undefined && { stringValue }),
              }
            : i
        )
      });
    } else {
      set({ restockCart: [...currentCart, { productId, qty, name, abbreviation, stringValue }] });
    }
  },

  clearRestockCart: () => {
    set({ restockCart: [] });
  },

  /**
   * Acción Vendedor
   * Hace un INSERT en restock_requests con estado pending y limpia el restockCart.
   */
  sendRestockRequest: async (pointId, requesterName, observacion) => {
    const { restockCart, pendingRequests } = get();
    if (!pointId) throw new Error("Acceso denegado: pointId vacío.");
    if (restockCart.length === 0) throw new Error("Carrito de surtido vacío.");

    // Capturar branchId del vendedor para filtrado por sede
    const senderBranchId = useAuthStore.getState().user?.branchId ?? null;

    // Intentar capturar ubicación GPS del vendedor al momento del pedido
    let location = null;
    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000,
          });
        });
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      }
    } catch (_) {
      // GPS no disponible o denegado — se envía sin ubicación
    }

    const newRequest = {
      id: `REQ-${Date.now()}`,
      requester_point_id: pointId,
      requester_name: requesterName || 'Desconocido',
      items_payload: restockCart.filter(item => item.qty > 0),
      observacion: observacion?.trim() || null,
      location,
      branchId: senderBranchId,  // ← sede del vendedor
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const updated = [...pendingRequests, newRequest];
    set({ pendingRequests: updated });
    get().clearRestockCart();
    syncKey('pendingRequests', updated);

    // Notificar a los Dejadores via Web Push (funciona aunque tengan el celular bloqueado)
    try {
      const itemsSummary = newRequest.items_payload
        .map(i => `${i.abbreviation || i.name} ×${i.qty}`)
        .join(', ');

      supabase.functions.invoke('notify-dejadors', {
        body: {
          pointId:   pointId,
          requestId: newRequest.id,
          body:      `📦 ${pointId} necesita surtido`,
          items:     itemsSummary,
        },
      }).catch(err => console.warn('[Push] No se pudo enviar notificación:', err?.message));
    } catch (_) {
      // No interrumpir el flujo si la notificación falla
    }
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

  /**
   * Acción Dejador: Surtido parcial.
   * - availableItems: ítems que SÍ se surten → van a completedRequests
   * - postponedItems: ítems NO disponibles → se reenqueulan como nuevo pendingRequest con isPostponed:true
   */
  commitPartialRestock: async (requestId, availableItems, postponedItems) => {
    const { pendingRequests, completedRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const { anotadorName, dejadorName } = useDejadorSessionStore.getState();

    // Quitar el request original de pendientes
    const newPending = pendingRequests.filter(r => r.id !== requestId);

    // Marcar como completado solo los ítems disponibles
    const newCompleted = [{
      ...req,
      items_payload: availableItems,
      status: 'completed',
      completed_at: new Date().toISOString(),
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
    }, ...completedRequests];

    // Reencolar los ítems pospuestos como nuevo pedido pendiente
    let finalPending = newPending;
    if (postponedItems.length > 0) {
      const postponedRequest = {
        id: `REQ-POST-${Date.now()}`,
        requester_point_id: req.requester_point_id,
        requester_name: req.requester_name,
        items_payload: postponedItems,
        location: req.location || null,
        observacion: req.observacion || null,
        status: 'pending',
        isPostponed: true,
        created_at: new Date().toISOString(),
        original_request_id: requestId,
      };
      finalPending = [...newPending, postponedRequest];
    }

    set({ pendingRequests: finalPending, completedRequests: newCompleted });
    syncKey('pendingRequests', finalPending);
    syncKey('completedRequests', newCompleted);
  },

  rejectRequest: (requestId) => {
    const { pendingRequests, rejectedRequests = [] } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const { anotadorName, dejadorName } = useDejadorSessionStore.getState();
    const newPending = pendingRequests.filter(r => r.id !== requestId);
    const newRejected = [{
      ...req,
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
    }, ...rejectedRequests];
    set({ pendingRequests: newPending, rejectedRequests: newRejected });
    syncKey('pendingRequests', newPending);
    syncKey('rejectedRequests', newRejected);
  },

  /**
   * Acción Dejador: Marcar un pedido como leído.
   * El vendedor verá "Leído" en lugar de "En espera".
   * Esto también sirve como señal para detener el loop de sonido.
   */
  markRequestRead: (requestId) => {
    const { pendingRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req || req.readAt) return; // Ya estaba leído

    const { dejadorName } = useDejadorSessionStore.getState();
    const updated = pendingRequests.map(r =>
      r.id === requestId
        ? { ...r, readAt: new Date().toISOString(), readByDejador: dejadorName || 'Dejador' }
        : r
    );
    set({ pendingRequests: updated });
    syncKey('pendingRequests', updated);
  },

  /**
   * Acción Dejador: Posponer un pedido completo.
   * Re-encola el pedido como nuevo pendiente con isPostponed: true
   */
  postponeRequest: (requestId) => {
    const { pendingRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const newPending = pendingRequests.filter(r => r.id !== requestId);
    const postponedRequest = {
      ...req,
      id: `REQ-POST-${Date.now()}`,
      isPostponed: true,
      created_at: new Date().toISOString(),
      original_request_id: requestId,
    };
    const finalPending = [...newPending, postponedRequest];
    set({ pendingRequests: finalPending });
    syncKey('pendingRequests', finalPending);
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
        rejectedRequests: state.rejectedRequests || [],
        loadHistory: state.loadHistory 
      }),
    }
  )
);
