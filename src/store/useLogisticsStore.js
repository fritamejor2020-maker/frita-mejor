import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { push, getBranchKey } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useDejadorSessionStore } from './useDejadorSessionStore';
import { useSellerSessionStore } from './useSellerSessionStore';
import { useAuthStore } from './useAuthStore';
import { useBranchStore } from './useBranchStore';
import { useVehicleStore } from './useVehicleStore';
import { safeJSONStorage } from '../utils/safeStorage';
import { broadcastLogisticsUpdate } from '../lib/logisticsBroadcast';

// Helper: append atómico que lee el array remoto, agrega/actualiza el item, y escribe de vuelta
// Evita el problema de sobrescribir todo el array cuando 2 dispositivos escriben al mismo tiempo
async function atomicAppend(key, branchId, newItem, removeIds = []) {
  const supabaseKey = getBranchKey(key, branchId);
  try {
    const { data } = await supabase.from('app_state').select('value').eq('key', supabaseKey).maybeSingle();
    const existing = Array.isArray(data?.value) ? data.value : [];
    // Filtrar items a remover y el propio item (para no duplicar)
    const filtered = existing.filter(r => r?.id && !removeIds.includes(r.id) && r.id !== newItem?.id);
    const merged = newItem ? [newItem, ...filtered] : filtered;
    await supabase.from('app_state').upsert(
      { key: supabaseKey, value: merged, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch (e) {
    console.warn(`[LogisticsStore] atomicAppend failed for ${supabaseKey}:`, e?.message);
  }
}

async function atomicRemoveAndAppend(removeKey, appendKey, branchId, itemId, completedItem) {
  try {
    // 1. Remove from source key
    const srcKey = getBranchKey(removeKey, branchId);
    const { data: srcData } = await supabase.from('app_state').select('value').eq('key', srcKey).maybeSingle();
    const srcList = Array.isArray(srcData?.value) ? srcData.value.filter(r => r?.id !== itemId) : [];
    const nowIso = new Date().toISOString();
    await supabase.from('app_state').upsert({ key: srcKey, value: srcList, updated_at: nowIso }, { onConflict: 'key' });
    
    // 2. Append to destination key  
    if (completedItem) {
      const dstKey = getBranchKey(appendKey, branchId);
      const { data: dstData } = await supabase.from('app_state').select('value').eq('key', dstKey).maybeSingle();
      const dstList = Array.isArray(dstData?.value) ? dstData.value : [];
      const merged = [completedItem, ...dstList.filter(r => r?.id && r.id !== completedItem?.id)];
      await supabase.from('app_state').upsert({ key: dstKey, value: merged, updated_at: nowIso }, { onConflict: 'key' });
    }
  } catch (e) {
    console.warn(`[LogisticsStore] atomicRemoveAndAppend failed:`, e?.message);
  }
}

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
    push('pendingRequests', pendingReqs, null),
  ];

  if (syncCompleted) {
    const completedSlice = (completedReqs || []).filter(r => (r.branchId || 'BRANCH-001') === bid);
    markLocalWrite('completedRequests', bid);
    markLocalWrite('completedRequests', null);
    pushes.push(push('completedRequests', completedSlice, bid));
    pushes.push(push('completedRequests', completedReqs, null));
  }

  if (syncRejected) {
    const rejectedSlice = (rejectedReqs || []).filter(r => (r.branchId || 'BRANCH-001') === bid);
    markLocalWrite('rejectedRequests', bid);
    markLocalWrite('rejectedRequests', null);
    pushes.push(push('rejectedRequests', rejectedSlice, bid));
    pushes.push(push('rejectedRequests', rejectedReqs, null));
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

function isRecentItem(item, days = 60) {
  if (!item) return false;
  const rawDate = item.completed_at || item.created_at || item.timestamp || item.fecha || item.date || '';
  if (!rawDate) return true;
  const itemTime = new Date(rawDate).getTime();
  if (isNaN(itemTime)) return true;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return itemTime >= cutoff;
}

export const useLogisticsStore = create(
  persist(
    (set, get) => ({

      // Estado Vendedor: Array Temporal para crear una solicitud de surtido
      // Estructura: [{ productId: number, qty: number, name: string }]
      restockCart: [],
  
  // Estado Auxiliar Logística: View pending requests & Customer Delivery Orders
  pendingRequests: [],
  completedRequests: [],
  rejectedRequests: [],
  customerDeliveryRequests: [],

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

    // Capturar última ubicación GPS conocida del vendedor desde el store de forma instantánea (0ms)
    let location = null;
    try {
      const locMap = (globalThis.__inventoryStore__ || { getState: () => ({}) }).getState().vendorLocations || {};
      const knownLoc = locMap[pointId] || Object.values(locMap).find((l) => l?.pointId === pointId || l?.name === pointId);
      if (knownLoc?.lat && knownLoc?.lng) {
        location = { lat: knownLoc.lat, lng: knownLoc.lng };
      }
    } catch (_) {}

    // Capturar sesión activa del vendedor para vincular el surtido a su turno único
    const sellerSession = useSellerSessionStore.getState();
    const activeShiftId = sellerSession.isSetupComplete ? (sellerSession.shiftId || null) : null;
    const activeShiftJornada = sellerSession.isSetupComplete ? (sellerSession.shift || null) : null;

    const newRequest = {
      id: `REQ-${Date.now()}`,
      requester_point_id: pointId,
      requester_name: requesterName || 'Desconocido',
      shiftId: activeShiftId,
      jornada: activeShiftJornada || (new Date().getHours() < 12 ? 'AM' : new Date().getHours() < 17 ? 'MD' : 'PM'),
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
    broadcastLogisticsUpdate({ pendingRequests: updated });

    const branchSlice = updated.filter(r => (r.branchId || 'BRANCH-001') === (senderBranchId || 'BRANCH-001'));
    markLocalWrite('pendingRequests', senderBranchId);
    markLocalWrite('pendingRequests', null);

    Promise.allSettled([
      push('pendingRequests', updated, null),
      push('pendingRequests', branchSlice, senderBranchId),
    ]).catch(() => {});

    // Backup atómico para evitar pérdida por race condition
    atomicAppend('pendingRequests', null, newRequest);
    atomicAppend('pendingRequests', senderBranchId, newRequest);

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
      const user = useAuthStore.getState().user;
      const userBranchId = user?.branchId || 'BRANCH-001';
      const branches = useBranchStore.getState().branches || [];
      const branchIds = new Set(['BRANCH-001', userBranchId, ...branches.map(b => b.id)]);

      const keysToFetch = [
        'pendingRequests', 'completedRequests', 'rejectedRequests', 'loadHistory'
      ];
      branchIds.forEach(bid => {
        if (bid) {
          keysToFetch.push(`pendingRequests_${bid}`);
          keysToFetch.push(`completedRequests_${bid}`);
          keysToFetch.push(`rejectedRequests_${bid}`);
          keysToFetch.push(`loadHistory_${bid}`);
        }
      });

      const { data } = await supabase
        .from('app_state')
        .select('key, value')
        .in('key', keysToFetch);

      if (!data) return;

      const pendingMap = new Map();
      const completedMap = new Map();
      const rejectedMap = new Map();
      const historyMap = new Map();

      data.forEach(row => {
        const k = row.key || '';
        const val = Array.isArray(row.value) ? row.value : [];
        if (k.startsWith('pendingRequests')) {
          val.forEach(item => {
            if (!item?.id) return;
            const existing = pendingMap.get(item.id);
            if (!existing || new Date(item.created_at || 0).getTime() >= new Date(existing.created_at || 0).getTime()) {
              pendingMap.set(item.id, item);
            }
          });
        } else if (k.startsWith('completedRequests')) {
          val.forEach(item => {
            if (!item?.id) return;
            const existing = completedMap.get(item.id);
            if (!existing || new Date(item.completed_at || item.created_at || 0).getTime() >= new Date(existing.completed_at || existing.created_at || 0).getTime()) {
              completedMap.set(item.id, item);
            }
          });
        } else if (k.startsWith('rejectedRequests')) {
          val.forEach(item => {
            if (!item?.id) return;
            const existing = rejectedMap.get(item.id);
            if (!existing || new Date(item.rejected_at || item.created_at || 0).getTime() >= new Date(existing.rejected_at || existing.created_at || 0).getTime()) {
              rejectedMap.set(item.id, item);
            }
          });
        } else if (k.startsWith('loadHistory')) {
          val.forEach(item => {
            if (!item?.id) return;
            const existing = historyMap.get(item.id);
            if (!existing || new Date(item.timestamp || 0).getTime() >= new Date(existing.timestamp || 0).getTime()) {
              historyMap.set(item.id, item);
            }
          });
        }
      });

      const freshCompletedRaw = Array.from(completedMap.values()).filter(x => isRecentItem(x, 60));
      const freshRejectedRaw = Array.from(rejectedMap.values()).filter(x => isRecentItem(x, 60));
      const freshHistory = Array.from(historyMap.values()).filter(x => isRecentItem(x, 60)).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      // 🛡️ PRESERVAR los ítems completados o rechazados localmente en los últimos 15 minutos
      // Esto evita que la latencia de red de Supabase los resucite temporalmente como pendientes (flicker)
      const nowMs = Date.now();
      const localCompleted = (get().completedRequests || []).filter(r => {
        if (!r?.id) return false;
        const compTime = new Date(r.completed_at || r.created_at || 0).getTime();
        return (nowMs - compTime) < 15 * 60 * 1000;
      });

      const localRejected = (get().rejectedRequests || []).filter(r => {
        if (!r?.id) return false;
        const rejTime = new Date(r.rejected_at || r.created_at || 0).getTime();
        return (nowMs - rejTime) < 15 * 60 * 1000;
      });

      const mergedCompletedMap = new Map();
      [...freshCompletedRaw, ...localCompleted].forEach(item => {
        if (item?.id) mergedCompletedMap.set(item.id, item);
      });

      const mergedRejectedMap = new Map();
      [...freshRejectedRaw, ...localRejected].forEach(item => {
        if (item?.id) mergedRejectedMap.set(item.id, item);
      });

      const freshCompleted = Array.from(mergedCompletedMap.values()).sort((a, b) => new Date(b.completed_at || b.created_at || 0).getTime() - new Date(a.completed_at || a.created_at || 0).getTime());
      const freshRejected = Array.from(mergedRejectedMap.values()).sort((a, b) => new Date(b.rejected_at || b.created_at || 0).getTime() - new Date(a.rejected_at || a.created_at || 0).getTime());

      const processedSet = new Set([
        ...freshCompleted.map(x => x.id),
        ...freshRejected.map(x => x.id),
      ]);

      const freshPending = Array.from(pendingMap.values())
        .filter(isTodayItem)
        .filter(item => item?.id && !processedSet.has(item.id));

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
    const activeShift = req.shiftId 
      ? posShifts.find(s => s && s.id === req.shiftId) 
      : posShifts.find(s => {
          if (!s || s.closedAt) return false;
          const cleanPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanPoint && cleanRequester && (cleanPoint === cleanRequester || cleanPoint.includes(cleanRequester) || cleanRequester.includes(cleanPoint));
        });

    const newPending = pendingRequests.filter(req => req.id !== requestId);
    const newCompleted = [{
      ...req,
      shiftId: req.shiftId || activeShift?.id || null,
      jornada: req.jornada || activeShift?.shift || dejadorShift || 'AM',
      status: 'completed',
      completed_at: new Date().toISOString(),
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
    }, ...completedRequests];
    set({ pendingRequests: newPending, completedRequests: newCompleted });
    broadcastLogisticsUpdate({ pendingRequests: newPending, completedRequests: newCompleted });
    syncLogisticsPartition(affectedBranchId, newPending, newCompleted, get().rejectedRequests, { syncCompleted: true });

    // Backup atómico para mover de pending a completed sin sobreescribir arrays
    atomicRemoveAndAppend('pendingRequests', 'completedRequests', null, requestId, newCompleted[0]);
    atomicRemoveAndAppend('pendingRequests', 'completedRequests', affectedBranchId, requestId, newCompleted[0]);
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
    const activeShift = req.shiftId 
      ? posShifts.find(s => s && s.id === req.shiftId) 
      : posShifts.find(s => {
          if (!s || s.closedAt) return false;
          const cleanPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanPoint && cleanRequester && (cleanPoint === cleanRequester || cleanPoint.includes(cleanRequester) || cleanRequester.includes(cleanPoint));
        });

    // Quitar el request original de pendientes
    const newPending = pendingRequests.filter(r => r.id !== requestId);

    // Marcar como completado solo los ítems disponibles
    const newCompleted = [{
      ...req,
      shiftId: req.shiftId || activeShift?.id || null,
      jornada: req.jornada || activeShift?.shift || dejadorShift || 'AM',
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
        shiftId: req.shiftId || activeShift?.id || null,
        jornada: req.jornada || activeShift?.shift || dejadorShift || 'AM',
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
    broadcastLogisticsUpdate({ pendingRequests: finalPending, completedRequests: newCompleted });
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
    broadcastLogisticsUpdate({ pendingRequests: newPending, rejectedRequests: newRejected });
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
    broadcastLogisticsUpdate({ loadHistory: newHistory });
    const loadSlice = newHistory.filter(e => (e.branchId || 'BRANCH-001') === affectedBranchId);
    markLocalWrite('loadHistory', affectedBranchId);
    markLocalWrite('loadHistory', null);
    Promise.allSettled([
      push('loadHistory', loadSlice, affectedBranchId),
      push('loadHistory', loadSlice, null)
    ]).catch(() => {});

    // Backup atómico para evitar pérdida por race condition
    atomicAppend('loadHistory', affectedBranchId, entry);
    atomicAppend('loadHistory', null, entry);
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
    const today = new Date().toISOString().slice(0, 10);
    
    // Buscar turnos de hoy para este vehículo
    const vehicleShiftsToday = (posShifts || []).filter(s => {
      if (!s) return false;
      const cleanPoint = String(s.pointId || s.vehicle || s.point_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanPoint || !cleanVehicle) return false;
      const pointMatches = cleanPoint === cleanVehicle || cleanPoint.includes(cleanVehicle) || cleanVehicle.includes(cleanPoint);
      const sDate = (s.fecha || s.openedAt || s.closedAt || s.createdAt || '').slice(0, 10);
      return pointMatches && (!sDate || sDate === today);
    });

    // Prioridad: 1. Turno abierto actualmente. 2. Turno más reciente de hoy (aunque esté recién cerrado)
    const activeShift = vehicleShiftsToday.find(s => !s.closedAt) ||
      vehicleShiftsToday.sort((a, b) => new Date(b.closedAt || b.openedAt || 0).getTime() - new Date(a.closedAt || a.openedAt || 0).getTime())[0];

    // Sincronizar sobrantes directamente en el turno si existe
    if (activeShift) {
      try {
        const invStore = globalThis.__inventoryStore__;
        if (invStore && typeof invStore.getState === 'function') {
          const currentSobrantes = { ...(activeShift.sobrantes || {}) };
          items.forEach(item => {
            currentSobrantes[item.productId] = (currentSobrantes[item.productId] || 0) + item.qty;
          });
          const allShifts = invStore.getState().posShifts || [];
          const updatedShifts = allShifts.map(s => s.id === activeShift.id ? { ...s, sobrantes: currentSobrantes } : s);
          invStore.setState({ posShifts: updatedShifts });
        }
      } catch (err) {
        console.warn('[commitReception] Sync shift sobrantes error:', err);
      }
    }

    const entry = {
      id: `RECV-${now}`,
      type: 'recepcion',
      vehicleId,
      branchId: affectedBranchId,
      shiftId: activeShift?.id || null,   // ← ID del turno activo o recién cerrado al momento de la recepción
      jornada: activeShift?.shift || dejadorJornada,
      items,
      anotadorName: anotadorName || null,
      dejadorName: dejadorName || null,
      timestamp: new Date().toISOString()
    };
    const newHistory = [entry, ...get().loadHistory];
    set({ loadHistory: newHistory });
    broadcastLogisticsUpdate({ loadHistory: newHistory });
    const loadSlice = newHistory.filter(e => (e.branchId || 'BRANCH-001') === affectedBranchId);
    markLocalWrite('loadHistory', affectedBranchId);
    markLocalWrite('loadHistory', null);
    Promise.allSettled([
      push('loadHistory', loadSlice, affectedBranchId),
      push('loadHistory', loadSlice, null)
    ]).catch(() => {});

    // Backup atómico para evitar pérdida por race condition
    atomicAppend('loadHistory', affectedBranchId, entry);
    atomicAppend('loadHistory', null, entry);
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
  /**
   * Calcula las unidades vendidas por vehículo usando el modelo de inventario:
   * Vendido = (Carga Inicial + Surtidos Entregados) - Sobrantes al Cierre
   *
   * @param {string} vehicleId - ej. 'T2'
   * @param {object} productPrices - { [productId]: price } mapa de precios
   * @param {string} [sinceTimestamp] - Filtrar solo desde esta fecha/hora (ISO)
   * @param {string} [untilTimestamp] - Filtrar hasta esta fecha/hora (ISO)
   * @param {string} [targetShiftId] - ID exacto del turno a calcular
   * @param {string} [targetJornada] - Jornada 'AM' | 'PM' | 'MD'
   * @returns {{ soldItems: Record<string, {qty, name, price}>, theoretical: number }}
   */
  calcSoldByVehicle: (vehicleId, productPrices, sinceTimestamp = null, untilTimestamp = null, targetShiftId = null, targetJornada = null) => {
    const { loadHistory, completedRequests } = get();
    const cleanVeh = String(vehicleId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Delimitar ventana de tiempo estricta del turno (hasta 30 min antes de apertura para capturar la carga de bodega)
    const startTime = sinceTimestamp ? new Date(sinceTimestamp).getTime() - 30 * 60 * 1000 : 0;
    const endTime = untilTimestamp ? new Date(untilTimestamp).getTime() + 15 * 60 * 1000 : Infinity;

    const isMatch = (item, isCargaOrRecv = true) => {
      if (!item) return false;
      const itemVeh = String(item.vehicleId || item.pointId || item.requester_point_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (itemVeh && cleanVeh && !(itemVeh === cleanVeh || itemVeh.includes(cleanVeh) || cleanVeh.includes(itemVeh))) {
        return false;
      }

      // 1. Si ambos tienen shiftId definido: regla estricta 1 a 1
      if (item.shiftId && targetShiftId) {
        return item.shiftId === targetShiftId;
      }

      // 2. Si el item tiene un shiftId asignado pero este cálculo pertenece a otro shiftId explícito: descartar
      if (item.shiftId && targetShiftId && item.shiftId !== targetShiftId) {
        return false;
      }

      // 3. Si se especifica jornada (AM vs PM) y el item tiene jornada incompatible: descartar
      if (targetJornada && item.jornada && targetJornada !== 'COMPLETA' && item.jornada !== 'COMPLETA' && targetJornada !== item.jornada) {
        return false;
      }

      // 4. Ventana de tiempo estricta
      const ts = new Date(item.timestamp || item.completed_at || item.created_at || 0).getTime();
      return ts >= startTime && ts <= endTime;
    };

    // Acumula cantidades { [productId]: qty }
    const totals = {};

    // 1. Carga inicial
    loadHistory
      .filter(e => e.type === 'carga' && isMatch(e, true))
      .forEach(e => {
        e.items.forEach(({ productId, qty }) => {
          totals[productId] = (totals[productId] || 0) + qty;
        });
      });

    // 2. Surtidos entregados durante el turno
    completedRequests
      .filter(r => isMatch(r, false))
      .forEach(r => {
        (r.items_payload || []).forEach(({ productId, qty }) => {
          totals[productId] = (totals[productId] || 0) + qty;
        });
      });

    // 3. Restar sobrantes (recepciones del dejador al cierre)
    loadHistory
      .filter(e => e.type === 'recepcion' && isMatch(e, true))
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
          state.completedRequests = (state.completedRequests || []).filter(x => isRecentItem(x, 60));
          state.rejectedRequests = (state.rejectedRequests || []).filter(x => isRecentItem(x, 60));
          state.loadHistory = (state.loadHistory || []).filter(x => isRecentItem(x, 60));
        }
      },
      partialize: (state) => ({ 
        pendingRequests: (state.pendingRequests || []).filter(isTodayItem), 
        completedRequests: (state.completedRequests || []).filter(x => isRecentItem(x, 60)).slice(-100),
        rejectedRequests: (state.rejectedRequests || []).filter(x => isRecentItem(x, 60)).slice(-50),
        loadHistory: (state.loadHistory || []).filter(x => isRecentItem(x, 60)).slice(-100) 
      }),
    }
  )
);
