import { useEffect, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { supabase } from './supabase';
import { pullAll, GLOBAL_KEYS, BRANCH_KEYS, getBranchKey, getBaseKey } from './syncManager';
import { useInventoryStore, mergeArrays } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePayrollStore } from '../store/usePayrollStore';
import { useBranchStore } from '../store/useBranchStore';
import { useTaskStore } from '../store/useTaskStore';
import { useTransferStore } from '../store/useTransferStore';
import { useVendorTransferStore } from '../store/useVendorTransferStore';

// ==============================================================================
// useRealtimeSync — Hook que suscribe a los cambios remotos de Supabase Realtime
// Soporte Multisede: los applicators se generan dinámicamente según el branchId
// del usuario activo, de modo que cada dispositivo solo aplica cambios de su sede.
// ==============================================================================

let _isApplyingRealtimeState = false;
export function isApplyingRealtimeState() { return _isApplyingRealtimeState; }

let _ignoreRemoteKeys = new Set();

export function markLocalWrite(key, branchId = null) {
  const supabaseKey = getBranchKey(key, branchId);
  _ignoreRemoteKeys.add(supabaseKey);
  setTimeout(() => _ignoreRemoteKeys.delete(supabaseKey), 2000);
}

// ─── Applicators dinámicos ────────────────────────────────────────────────────

/**
 * Genera el mapa { supabaseKey → función aplicadora } para un branchId dado.
 * - Las llaves globales siempre se incluyen.
 * - Las llaves locales se incluyen con el sufijo del branchId del usuario.
 * - Si branchId es null (Admin), se incluyen llaves de TODAS las sedes activas.
 */
function getApplicators(branchId, allBranchIds = ['BRANCH-001']) {
  const applicators = {};

  // ── Globales (sin sufijo) ──
  applicators['warehouses']        = (v) => useInventoryStore.setState({ warehouses: v });
  applicators['products']          = (v) => useInventoryStore.setState({ products: v });
  applicators['movements']         = (v) => useInventoryStore.setState({ movements: v });
  applicators['recipes']           = (v) => useInventoryStore.setState({ recipes: v });
  applicators['fritadoRecipes']    = (v) => useInventoryStore.setState({ fritadoRecipes: v });
  applicators['posCategories']     = (v) => useInventoryStore.setState({ posCategories: v });
  applicators['customers']         = (v) => useInventoryStore.setState({ customers: v });
  applicators['customerTypes']     = (v) => useInventoryStore.setState({ customerTypes: v });
  applicators['loadTemplates']     = (v) => useInventoryStore.setState({ loadTemplates: v });
  applicators['vehicles']          = (v) => useVehicleStore.setState({ vehicles: v });
  applicators['suppliers']         = (v) => useSupplierStore.setState({ suppliers: v });
  applicators['pendingRequests']   = (v) => useLogisticsStore.setState({ pendingRequests: v });
  applicators['completedRequests'] = (v) => useLogisticsStore.setState({ completedRequests: v });
  applicators['rejectedRequests']  = (v) => useLogisticsStore.setState({ rejectedRequests: v });
  applicators['loadHistory']       = (v) => useLogisticsStore.setState({ loadHistory: v });
  applicators['users']             = (v) => useAuthStore.setState({ users: v });
  applicators['payrollEmployees']  = (v) => usePayrollStore.setState({ payrollEmployees: v });
  applicators['payrollRecords']    = (v) => usePayrollStore.setState({ payrollRecords: v });
  applicators['branches']          = (v) => useBranchStore.getState().loadFromRemote(v);
  applicators['vendorLocations']   = (v) => useInventoryStore.setState({ vendorLocations: v });
  applicators['posRegisters']      = (v) => useInventoryStore.setState({ posRegisters: v });
  applicators['transfers']         = (v) => useTransferStore.getState().loadFromRemote(v);
  applicators['tasks_data']        = (v) => useTaskStore.getState().loadFromRemote(v);
  applicators['salesGoals']        = (v) => useInventoryStore.setState({ salesGoals: v });

  // ── Locales por sede ──
  // Si es Admin (branchId=null), suscribe a TODAS las sedes.
  // Si es operativo, solo a su sede.
  const effectiveBranches = branchId === null
    ? (allBranchIds.length > 0 ? allBranchIds : ['BRANCH-001'])
    : [branchId];

  for (const bid of effectiveBranches) {
    // ── POS ──
    applicators[`posSettings_${bid}`]      = (v) => useInventoryStore.setState({ posSettings: v });
    applicators[`posShifts_${bid}`]        = (v) => {
      const state = useInventoryStore.getState();
      const deleted = new Set(state.deletedShiftIds || []);
      const localShifts = (state.posShifts || []).filter(s => !deleted.has(s.id));
      const remote = (v || []).filter(s => !deleted.has(s.id));
      const merged = mergeArrays(localShifts, remote, 'posShifts');
      useInventoryStore.setState({ posShifts: merged });
    };
    applicators[`posSales_${bid}`]         = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.posSales || [], v || [], 'posSales');
      useInventoryStore.setState({ posSales: merged });
    };
    applicators[`posExpenses_${bid}`]      = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.posExpenses || [], v || [], 'posExpenses');
      useInventoryStore.setState({ posExpenses: merged });
    };
    applicators[`inventory_${bid}`]        = (v) => {
      const state = useInventoryStore.getState();
      const deletedInv = new Set(state.deletedInventoryIds || []);
      const localInv = (state.inventory || []).filter(i => !deletedInv.has(i.id));
      const remote = (v || []).filter(i => !deletedInv.has(i.id));
      const merged = mergeArrays(localInv, remote, 'inventory');
      useInventoryStore.setState({ inventory: merged });
    };
    applicators[`contrataPayments_${bid}`] = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.contrataPayments || [], v || [], 'contrataPayments');
      useInventoryStore.setState({ contrataPayments: merged });
    };
    applicators[`deletedShiftIds_${bid}`]  = (v) => {
      // MERGE: no perder tombstones locales al recibir los de otra sede
      const local = useInventoryStore.getState().deletedShiftIds || [];
      useInventoryStore.setState({ deletedShiftIds: [...new Set([...local, ...(v || [])])] });
    };
    applicators[`deletedInventoryIds_${bid}`] = (v) => {
      // MERGE: no perder tombstones locales al recibir los de otra sede
      const local = useInventoryStore.getState().deletedInventoryIds || [];
      useInventoryStore.setState({ deletedInventoryIds: [...new Set([...local, ...(v || [])])] });
    };

    // ── Logística (Dejador / Vendedor) ──
    // MERGE por sede: al recibir datos de una sede, conservar pedidos de otras sedes
    // y reemplazar solo los de la sede que se actualizó. Esto evita que un update
    // de BRANCH-001 borre los pedidos de BRANCH-002 en el estado local del Dejador.
    applicators[`pendingRequests_${bid}`]   = (v) => {
      const current = useLogisticsStore.getState().pendingRequests || [];
      const otherBranch = current.filter(r => (r.branchId || 'BRANCH-001') !== bid);
      useLogisticsStore.setState({ pendingRequests: [...otherBranch, ...(v || [])] });
    };
    applicators[`completedRequests_${bid}`] = (v) => {
      const current = useLogisticsStore.getState().completedRequests || [];
      const otherBranch = current.filter(r => (r.branchId || 'BRANCH-001') !== bid);
      useLogisticsStore.setState({ completedRequests: [...otherBranch, ...(v || [])] });
    };
    applicators[`rejectedRequests_${bid}`]  = (v) => {
      const current = useLogisticsStore.getState().rejectedRequests || [];
      const otherBranch = current.filter(r => (r.branchId || 'BRANCH-001') !== bid);
      useLogisticsStore.setState({ rejectedRequests: [...otherBranch, ...(v || [])] });
    };
    applicators[`loadHistory_${bid}`]       = (v) => {
      const current = useLogisticsStore.getState().loadHistory || [];
      const otherBranch = current.filter(e => (e.branchId || 'BRANCH-001') !== bid);
      useLogisticsStore.setState({ loadHistory: [...otherBranch, ...(v || [])] });
    };

    // ── Otros BRANCH_KEYS que syncManager escribe con sufijo ──
    applicators[`vehicles_${bid}`]          = (v) => {
      const state = useVehicleStore.getState();
      const merged = mergeArrays(state.vehicles || [], v || [], 'vehicles');
      useVehicleStore.setState({ vehicles: merged });
    };
    applicators[`loadTemplates_${bid}`]     = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.loadTemplates || [], v || [], 'loadTemplates');
      useInventoryStore.setState({ loadTemplates: merged });
    };
    applicators[`vendorLocations_${bid}`]   = (v) => useInventoryStore.setState({ vendorLocations: v });
    applicators[`payrollRecords_${bid}`]    = (v) => {
      const state = usePayrollStore.getState();
      const merged = mergeArrays(state.payrollRecords || [], v || [], 'payrollRecords');
      usePayrollStore.setState({ payrollRecords: merged });
    };
    applicators[`movements_${bid}`]         = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.movements || [], v || [], 'movements');
      useInventoryStore.setState({ movements: merged });
    };
    applicators[`warehouses_${bid}`]        = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.warehouses || [], v || [], 'warehouses');
      useInventoryStore.setState({ warehouses: merged });
    };
    applicators[`vendorTransfers_${bid}`]   = (v) => useVendorTransferStore.getState().loadFromRemote(v);

    // Legacy: llaves sin sufijo (para migración inicial desde versión anterior)
    if (!applicators['posShifts'])        applicators['posShifts']        = (v) => {
      const deleted = new Set(useInventoryStore.getState().deletedShiftIds || []);
      useInventoryStore.setState({ posShifts: (v || []).filter(s => !deleted.has(s.id)) });
    };
    if (!applicators['posSales'])         applicators['posSales']         = (v) => useInventoryStore.setState({ posSales: v });
    if (!applicators['posExpenses'])      applicators['posExpenses']      = (v) => useInventoryStore.setState({ posExpenses: v });
    if (!applicators['posRegisters'])     applicators['posRegisters']     = (v) => useInventoryStore.setState({ posRegisters: v });
    if (!applicators['posSettings'])      applicators['posSettings']      = (v) => useInventoryStore.setState({ posSettings: v });
    if (!applicators['inventory'])        applicators['inventory']        = (v) => {
      const state = useInventoryStore.getState();
      const deletedInv = new Set(state.deletedInventoryIds || []);
      const localInv = (state.inventory || []).filter(i => !deletedInv.has(i.id));
      const remote = (v || []).filter(i => !deletedInv.has(i.id));
      const merged = mergeArrays(localInv, remote, 'inventory');
      useInventoryStore.setState({ inventory: merged });
    };
    if (!applicators['contrataPayments']) applicators['contrataPayments'] = (v) => useInventoryStore.setState({ contrataPayments: v });
  }

  return applicators;
}

// ─── Aplicación de snapshot remoto ────────────────────────────────────────────

function applyRemoteSnapshot(snapshot, branchId, allBranchIds) {
  const applicators = getApplicators(branchId, allBranchIds);
  _isApplyingRealtimeState = true;
  try {
    unstable_batchedUpdates(() => {
      Object.entries(snapshot).forEach(([key, value]) => {
        const apply = applicators[key];
        if (apply) {
          console.log(`[Realtime] Aplicando estado remoto: "${key}"`);
          apply(value);
        }
      });
    });
  } finally {
    _isApplyingRealtimeState = false;
  }
}

// ─── Refresh forzado desde Supabase ───────────────────────────────────────────

export async function refreshAllFromSupabase(branchId, allBranchIds) {
  try {
    const snapshot = await pullAll(branchId, allBranchIds);
    if (snapshot && Object.keys(snapshot).length > 0) {
      applyRemoteSnapshot(snapshot, branchId, allBranchIds);
      console.log('[Realtime] Estado fresco obtenido desde Supabase ✅');
    }
  } catch (err) {
    console.warn('[Realtime] Error al re-leer estado remoto:', err.message);
  }
}

// ─── Batching de eventos individuales de Realtime ────────────────────────────

let _pendingBatch = {};
let _batchTimer = null;

function scheduleBatch(key, value, branchId, allBranchIds) {
  _pendingBatch[key] = value;
  if (_batchTimer) return;
  _batchTimer = setTimeout(() => {
    const batch = _pendingBatch;
    _pendingBatch = {};
    _batchTimer = null;
    applyRemoteSnapshot(batch, branchId, allBranchIds);
  }, 0);
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useRealtimeSync() {
  const channelRef = useRef(null);
  const pullDebounceRef = useRef(null);

  // Reactivo: re-suscribir cuando se agregan/eliminan sedes o cambia el usuario/sede activa
  const branchIdsKey = useBranchStore(s => s.branches.map(b => b.id).join(','));
  const user = useAuthStore(s => s.user);
  const activeBranchId = useAuthStore(s => s.activeBranchId);
  const userId = user?.id ?? null;

  useEffect(() => {
    // Si es ADMIN, pasamos syncBranchId = null a pullAll y getApplicators para que descargue TODAS las sedes y llaves legacy.
    const isAdmin = user?.role === 'ADMIN';
    const syncBranchId = isAdmin ? null : (user?.branchId || activeBranchId || 'BRANCH-001');
    const allBranchIds = branchIdsKey ? branchIdsKey.split(',') : ['BRANCH-001'];

    const channel = supabase
      .channel('app-state-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state' },
        (payload) => {
          const { new: newRow } = payload;
          if (!newRow) return;

          const { key, value } = newRow;

          if (_ignoreRemoteKeys.has(key)) return;

          // Solo procesar llaves que le corresponden a este dispositivo
          const currentApplicators = getApplicators(syncBranchId, allBranchIds);
          if (currentApplicators[key]) {
            console.log(`[Realtime] Actualización remota recibida: "${key}"`);
            scheduleBatch(key, value, syncBranchId, allBranchIds);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal status:', status);
        if (status === 'SUBSCRIBED') {
          // Solo ejecutar loadFromRemote (que tiene todas las protecciones).
          // NO llamar refreshAllFromSupabase porque bypassa las protecciones de syncKey
          // y puede causar que los datos se reviertan a un estado anterior.
          clearTimeout(pullDebounceRef.current);
          pullDebounceRef.current = setTimeout(() => {
            useInventoryStore.getState().loadFromRemote().catch(e => console.warn('[Sync] loadFromRemote error:', e));
          }, 1500);
        }
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(pullDebounceRef.current);
      if (_batchTimer) { clearTimeout(_batchTimer); _batchTimer = null; }
      supabase.removeChannel(channel);
    };
  }, [branchIdsKey, user?.branchId, activeBranchId, userId]);
}
