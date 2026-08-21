import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useDejadorSessionStore } from './useDejadorSessionStore';
import { useAuthStore } from './useAuthStore';
import { useVehicleStore } from './useVehicleStore';
import { safeJSONStorage } from '../utils/safeStorage';

// Acceso lazy a useInventoryStore para evitar import circular
// (logistics ←→ inventory). Se resuelve en runtime cuando ya están todos cargados.
function getPosShifts() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (globalThis.__inventoryStore__ || { getState: () => ({}) }).getState().posShifts || [];
  } catch { return []; }
}

function syncKey(key, value) {
  const user = useAuthStore.getState().user;
  const branchId = user?.branchId ?? null;
  markLocalWrite(key, branchId);
  push(key, value, branchId).catch(err => console.warn('[Sync]', key, err.message));
}

/**
 * Variante de syncKey con branchId explícito.
 * Necesario cuando el usuario activo (AuthStore) no tiene branchId pero el
 * dato pertenece a una sede específica (ej: Vendedor haciendo un pedido).
 */
function syncKeyWithBranch(key, value, branchId) {
  markLocalWrite(key, branchId);
  push(key, value, branchId).catch(err => console.warn('[Sync]', key, err.message));
}

/**
 * Sincroniza las particiones de logística de una sede específica.
 * El Dejador tiene branchId:null y maneja pedidos de TODAS las sedes.
 * Para no contaminar la partición global ni otras sedes, este helper
 * filtra el array completo y escribe solo el slice de la sede afectada.
 *
 * @param {string}  affectedBranchId - Sede del pedido que fue procesado
 * @param {Array}   pendingReqs      - Array completo de pendingRequests
 * @param {Array}   [completedReqs]  - Array completo de completedRequests
 * @param {Array}   [rejectedReqs]   - Array completo de rejectedRequests
 * @param {object}  opts             - { syncCompleted, syncRejected }
 */
function syncLogisticsPartition(
  affectedBranchId,
  pendingReqs,
  completedReqs,
  rejectedReqs,
  { syncCompleted = false, syncRejected = false } = {}
) {
  const bid = affectedBranchId || 'BRANCH-001';
  const pendingSlice = (pendingReqs || []).filter(r => (r.branchId || 'BRANCH-001') === bid);
  
  markLocalWrite('pendingRequests', bid);
  markLocalWrite('pendingRequests', null);

  const pushes = [
    push('pendingRequests', pendingSlice, bid),
    push('pendingRequests', pendingSlice, null),
  ];

  if (syncCompleted) {
    const completedSlice = (completedReqs || []).filter(r => (r.branchId || 'BRANCH-001') === bid);
    markLocalWrite('completedRequests', bid);
    markLocalWrite('completedRequests', null);
    pushes.push(push('completedRequests', completedSlice, bid));
    pushes.push(push('completedRequests', completedSlice, null));
  }

  if (syncRejected) {
    const rejectedSlice = (rejectedReqs || []).filter(r => (r.branchId || 'BRANCH-001') === bid);
    markLocalWrite('rejectedRequests', bid);
    markLocalWrite('rejectedRequests', null);
    pushes.push(push('rejectedRequests', rejectedSlice, bid));
    pushes.push(push('rejectedRequests', rejectedSlice, null));
  }

  Promise.allSettled(pushes).catch(() => {});
}

/**
 * Resuelve el branchId de un vehículo por su ID/abreviación.
 * Usado por Dejador para saber a qué partición escribir loadHistory.
 */
function getVehicleBranchId(vehicleId) {
  const vehicle = useVehicleStore.getState().vehicles
    .find(v => (v.abbreviation || v.name) === vehicleId);
  return vehicle?.branchId || 'BRANCH-001';
}

/**
 * Store global para administrar flujos Logísticos y de Surtido
 */
function isTodayItem(item) {
  if (!item) return false;
  const rawDate = item.completed_at || item.created_at || item.timestamp || item.fecha || item.date || '';
  if (!rawDate) return true;
  const itemDay = String(rawDate).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return itemDay >= today;
}

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

    // Capturar branchId del vendedor para filtrado por sede.
    // Primero intenta desde AuthStore (el Vendedor hizo login).
    // Fallback: busca el branchId del vehículo con ese pointId.
    const userBranchId = useAuthStore.getState().user?.branchId ?? null;
    const vehicleBranchId = useVehicleStore.getState().vehicles
      .find((v) => (v.abbreviation || v.name) === pointId)?.branchId ?? null;
    const senderBranchId = userBranchId ?? vehicleBranchId;

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

    const branchSlice = updated.filter(r => (r.branchId || 'BRANCH-001') === (senderBranchId || 'BRANCH-001'));
    markLocalWrite('pendingRequests', senderBranchId);
    markLocalWrite('pendingRequests', null);

    Promise.allSettled([
      push('pendingRequests', updated, null),
      push('pendingRequests', branchSlice, senderBranchId),
    ]).catch(() => {});

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

  loadFromRemote: async () => {
    try {
      const { data } = await supabase
        .from('app_state')
        .select('key, value')
        .or('key.ilike.pendingRequests%,key.ilike.completedRequests%,key.ilike.rejectedRequests%,key.ilike.loadHistory%');

      if (!data) return;

      const pendingMap = new Map();
      const completedMap = new Map();
      const rejectedMap = new Map();
      const historyMap = new Map();

      data.forEach(row => {
        const k = row.key || '';
        const val = Array.isArray(row.value) ? row.value : [];
        if (k.startsWith('pendingRequests')) {
          val.forEach(item => { if (item?.id) pendingMap.set(item.id, item); });
        } else if (k.startsWith('completedRequests')) {
          val.forEach(item => { if (item?.id) completedMap.set(item.id, item); });
        } else if (k.startsWith('rejectedRequests')) {
          val.forEach(item => { if (item?.id) rejectedMap.set(item.id, item); });
        } else if (k.startsWith('loadHistory')) {
          val.forEach(item => { if (item?.id) historyMap.set(item.id, item); });
        }
      });

      const freshPending = Array.from(pendingMap.values()).filter(isTodayItem);
      const freshCompleted = Array.from(completedMap.values()).filter(isTodayItem).sort((a, b) => new Date(b.completed_at || b.created_at || 0) - new Date(a.completed_at || a.created_at || 0));
      const freshRejected = Array.from(rejectedMap.values()).filter(isTodayItem).sort((a, b) => new Date(b.rejected_at || b.created_at || 0) - new Date(a.rejected_at || a.created_at || 0));
      const freshHistory = Array.from(historyMap.values()).filter(isTodayItem).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

      set({
        pendingRequests: freshPending,
        completedRequests: freshCompleted,
        rejectedRequests: freshRejected,
        loadHistory: freshHistory
      });
    } catch (err) {
      console.warn('[LogisticsStore] Error in loadFromRemote:', err);
    }
  },

  fetchPendingRequests: async () => {
    await get().loadFromRemote();
  },

  commitRestock: async (requestId) => {
    const { pendingRequests, completedRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const affectedBranchId = req.branchId || 'BRANCH-001';
    const { anotadorName, dejadorName, shift: dejadorShift } = useDejadorSessionStore.getState();
    const posShifts = getPosShifts();
    const cleanRequester = String(req.requester_point_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeShift = posShifts.find(s => {
      if (!s || s.closedAt) return false;
      const cleanPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanPoint && cleanRequester && (cleanPoint === cleanRequester || cleanPoint.includes(cleanRequester) || cleanRequester.includes(cleanPoint));
    });

    const newPending = pendingRequests.filter(req => req.id !== requestId);
    const newCompleted = [{
      ...req,
      shiftId: activeShift?.id || null,
      jornada: activeShift?.shift || dejadorShift || 'AM',
      status: 'completed',
      completed_at: new Date().toISOString(),
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
    }, ...completedRequests];
    set({ pendingRequests: newPending, completedRequests: newCompleted });
    syncLogisticsPartition(affectedBranchId, newPending, newCompleted, get().rejectedRequests, { syncCompleted: true });
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

    const affectedBranchId = req.branchId || 'BRANCH-001';
    const { anotadorName, dejadorName, shift: dejadorShift } = useDejadorSessionStore.getState();
    const posShifts = getPosShifts();
    const cleanRequester = String(req.requester_point_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeShift = posShifts.find(s => {
      if (!s || s.closedAt) return false;
      const cleanPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanPoint && cleanRequester && (cleanPoint === cleanRequester || cleanPoint.includes(cleanRequester) || cleanRequester.includes(cleanPoint));
    });

    // Quitar el request original de pendientes
    const newPending = pendingRequests.filter(r => r.id !== requestId);

    // Marcar como completado solo los ítems disponibles
    const newCompleted = [{
      ...req,
      shiftId: activeShift?.id || null,
      jornada: activeShift?.shift || dejadorShift || 'AM',
      items_payload: availableItems,
      status: 'completed',
      completed_at: new Date().toISOString(),
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
    }, ...completedRequests];

    // Reencolar los ítems pospuestos como nuevo pedido pendiente (heredan el branchId del original)
    let finalPending = newPending;
    if (postponedItems.length > 0) {
      const postponedRequest = {
        id: `REQ-POST-${Date.now()}`,
        requester_point_id: req.requester_point_id,
        requester_name: req.requester_name,
        items_payload: postponedItems,
        location: req.location || null,
        observacion: req.observacion || null,
        branchId: affectedBranchId,  // ← propagar branchId al pedido reencolado
        status: 'pending',
        isPostponed: true,
        created_at: new Date().toISOString(),
        original_request_id: requestId,
      };
      finalPending = [...newPending, postponedRequest];
    }

    set({ pendingRequests: finalPending, completedRequests: newCompleted });
    syncLogisticsPartition(affectedBranchId, finalPending, newCompleted, get().rejectedRequests, { syncCompleted: true });
  },

  rejectRequest: (requestId) => {
    const { pendingRequests, rejectedRequests = [] } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const affectedBranchId = req.branchId || 'BRANCH-001';
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
    syncLogisticsPartition(affectedBranchId, newPending, get().completedRequests, newRejected, { syncRejected: true });
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

    const affectedBranchId = req.branchId || 'BRANCH-001';
    const { dejadorName } = useDejadorSessionStore.getState();
    const updated = pendingRequests.map(r =>
      r.id === requestId
        ? { ...r, readAt: new Date().toISOString(), readByDejador: dejadorName || 'Dejador' }
        : r
    );
    set({ pendingRequests: updated });
    syncLogisticsPartition(affectedBranchId, updated, get().completedRequests, get().rejectedRequests);
  },

  /**
   * Acción Dejador: Posponer un pedido completo.
   * Re-encola el pedido como nuevo pendiente con isPostponed: true
   */
  postponeRequest: (requestId) => {
    const { pendingRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    if (!req) return;

    const affectedBranchId = req.branchId || 'BRANCH-001';
    const newPending = pendingRequests.filter(r => r.id !== requestId);
    const postponedRequest = {
      ...req,
      id: `REQ-POST-${Date.now()}`,
      branchId: affectedBranchId,  // ← propagar branchId al pedido pospuesto
      isPostponed: true,
      created_at: new Date().toISOString(),
      original_request_id: requestId,
    };
    const finalPending = [...newPending, postponedRequest];
    set({ pendingRequests: finalPending });
    syncLogisticsPartition(affectedBranchId, finalPending, get().completedRequests, get().rejectedRequests);
  },

  updatePendingRequest: (requestId, newPayload) => {
    const { pendingRequests } = get();
    const req = pendingRequests.find(r => r.id === requestId);
    const affectedBranchId = req?.branchId || 'BRANCH-001';
    const updated = pendingRequests.map(r =>
      r.id === requestId ? { ...r, items_payload: newPayload } : r
    );
    set({ pendingRequests: updated });
    syncLogisticsPartition(affectedBranchId, updated, get().completedRequests, get().rejectedRequests);
  },

  // Editar items de una entrada del historial de cargas/recepciones
  updateLoadEntry: (id, items) => {
    const { loadHistory } = get();
    const entry = loadHistory.find(e => e.id === id);
    const affectedBranchId = entry?.branchId || getVehicleBranchId(entry?.vehicleId) || 'BRANCH-001';
    const updated = loadHistory.map(e => e.id === id ? { ...e, items } : e);
    set({ loadHistory: updated });
    const loadSlice = updated.filter(e => (e.branchId || getVehicleBranchId(e.vehicleId) || 'BRANCH-001') === affectedBranchId);
    syncKeyWithBranch('loadHistory', loadSlice, affectedBranchId);
    syncKeyWithBranch('loadHistory', loadSlice, null);
  },

  // Editar items de un surtido completado
  updateCompletedRequestItems: (id, items_payload) => {
    const { completedRequests } = get();
    const req = completedRequests.find(r => r.id === id);
    const affectedBranchId = req?.branchId || 'BRANCH-001';
    const updated = completedRequests.map(r => r.id === id ? { ...r, items_payload } : r);
    set({ completedRequests: updated });
    const completedSlice = updated.filter(r => (r.branchId || 'BRANCH-001') === affectedBranchId);
    syncKeyWithBranch('completedRequests', completedSlice, affectedBranchId);
    syncKeyWithBranch('completedRequests', completedSlice, null);
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

    const affectedBranchId = getVehicleBranchId(vehicleId);

    // ── Asociar al turno activo del vehículo ──────────────────────────────────
    // Buscar el turno en curso (sin closedAt) cuyo pointId coincida con el vehículo y jornada
    const posShifts = getPosShifts();
    const cleanVehicle = String(vehicleId).toLowerCase().replace(/[^a-z0-9]/g, '');
    const now = Date.now();
    const { anotadorName, dejadorName, shift: dejadorShift } = useDejadorSessionStore.getState();
    const dejadorJornada = dejadorShift || (new Date().getHours() < 12 ? 'AM' : new Date().getHours() < 17 ? 'MD' : 'PM');

    const activeShift = posShifts.find(s => {
      if (!s || s.closedAt) return false;
      const cleanPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanPoint || !cleanVehicle) return false;
      const pointMatches = cleanPoint === cleanVehicle || cleanPoint.includes(cleanVehicle) || cleanVehicle.includes(cleanPoint);
      const shiftMatches = !s.shift || s.shift === dejadorJornada;
      return pointMatches && shiftMatches;
    });

    const entry = {
      id: `LOAD-${now}`,
      type: 'carga',
      vehicleId,
      branchId: affectedBranchId,
      shiftId: activeShift?.id || null,   // ← ID del turno activo al momento de la carga
      jornada: activeShift?.shift || dejadorJornada, // ← jornada del turno (AM/MD/PM)
      items,
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
      timestamp: new Date().toISOString()
    };
    const newHistory = [entry, ...get().loadHistory];
    set({ loadHistory: newHistory });
    const loadSlice = newHistory.filter(e => (e.branchId || 'BRANCH-001') === affectedBranchId);
    markLocalWrite('loadHistory', affectedBranchId);
    markLocalWrite('loadHistory', null);
    Promise.allSettled([
      push('loadHistory', loadSlice, affectedBranchId),
      push('loadHistory', loadSlice, null)
    ]).catch(() => {});
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

    const affectedBranchId = getVehicleBranchId(vehicleId);
    const { anotadorName, dejadorName, shift: dejadorShift } = useDejadorSessionStore.getState();
    const dejadorJornada = dejadorShift || (new Date().getHours() < 12 ? 'AM' : new Date().getHours() < 17 ? 'MD' : 'PM');

    // ── Asociar al turno del vehículo ──────────────────────────────────
    const posShifts = getPosShifts();
    const cleanVehicle = String(vehicleId).toLowerCase().replace(/[^a-z0-9]/g, '');
    const now = Date.now();
    const activeShift = posShifts.find(s => {
      if (!s) return false;
      const cleanPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanPoint || !cleanVehicle) return false;
      const pointMatches = cleanPoint === cleanVehicle || cleanPoint.includes(cleanVehicle) || cleanVehicle.includes(cleanPoint);
      const shiftMatches = !s.shift || s.shift === dejadorJornada;
      return pointMatches && shiftMatches;
    });

    const entry = {
      id: `RECV-${now}`,
      type: 'recepcion',
      vehicleId,
      branchId: affectedBranchId,
      shiftId: activeShift?.id || null,   // ← ID del turno activo al momento de la recepción
      jornada: activeShift?.shift || dejadorJornada,
      items,
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
      timestamp: new Date().toISOString()
    };
    const newHistory = [entry, ...get().loadHistory];
    set({ loadHistory: newHistory });
    const loadSlice = newHistory.filter(e => (e.branchId || 'BRANCH-001') === affectedBranchId);
    markLocalWrite('loadHistory', affectedBranchId);
    markLocalWrite('loadHistory', null);
    Promise.allSettled([
      push('loadHistory', loadSlice, affectedBranchId),
      push('loadHistory', loadSlice, null)
    ]).catch(() => {});
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
      storage: safeJSONStorage,
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          persistedState.completedRequests = persistedState.completedRequests || [];
          persistedState.loadHistory = persistedState.loadHistory || [];
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.pendingRequests = (state.pendingRequests || []).filter(isTodayItem);
          state.completedRequests = (state.completedRequests || []).filter(isTodayItem);
          state.rejectedRequests = (state.rejectedRequests || []).filter(isTodayItem);
          state.loadHistory = (state.loadHistory || []).filter(isTodayItem);
        }
      },
      partialize: (state) => ({ 
        pendingRequests: (state.pendingRequests || []).filter(isTodayItem), 
        completedRequests: (state.completedRequests || []).filter(isTodayItem).slice(-50),
        rejectedRequests: (state.rejectedRequests || []).filter(isTodayItem).slice(-30),
        loadHistory: (state.loadHistory || []).filter(isTodayItem).slice(-50) 
      }),
    }
  )
);
