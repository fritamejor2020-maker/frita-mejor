import { useEffect, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { supabase } from './supabase';
import { pullAll, GLOBAL_KEYS, BRANCH_KEYS, getBranchKey, getBaseKey } from './syncManager';
import { useInventoryStore } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePayrollStore } from '../store/usePayrollStore';
import { useBranchStore } from '../store/useBranchStore';
import { useTransferStore } from '../store/useTransferStore';

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
  applicators['transfers']         = (v) => useTransferStore.getState().loadFromRemote(v);

  // ── Locales por sede ──
  // Si es Admin (branchId=null), suscribe a TODAS las sedes.
  // Si es operativo, solo a su sede.
  const effectiveBranches = branchId === null
    ? (allBranchIds.length > 0 ? allBranchIds : ['BRANCH-001'])
    : [branchId];

  for (const bid of effectiveBranches) {
    applicators[`posSettings_${bid}`]      = (v) => useInventoryStore.setState({ posSettings: { ...useInventoryStore.getState().posSettings, [bid]: v } });
    applicators[`posRegisters_${bid}`]     = (v) => useInventoryStore.setState({ posRegisters: v });
    applicators[`posShifts_${bid}`]        = (v) => useInventoryStore.setState({ posShifts: v });
    applicators[`posSales_${bid}`]         = (v) => useInventoryStore.setState({ posSales: v });
    applicators[`posExpenses_${bid}`]      = (v) => useInventoryStore.setState({ posExpenses: v });
    applicators[`inventory_${bid}`]        = (v) => useInventoryStore.setState({ inventory: v });
    applicators[`contrataPayments_${bid}`] = (v) => useInventoryStore.setState({ contrataPayments: v });
    applicators[`deletedShiftIds_${bid}`]  = (v) => useInventoryStore.setState({ deletedShiftIds: v });

    // Legacy: llaves sin sufijo (para migración inicial desde versión anterior)
    if (!applicators['posShifts'])    applicators['posShifts']    = (v) => useInventoryStore.setState({ posShifts: v });
    if (!applicators['posSales'])     applicators['posSales']     = (v) => useInventoryStore.setState({ posSales: v });
    if (!applicators['posExpenses'])  applicators['posExpenses']  = (v) => useInventoryStore.setState({ posExpenses: v });
    if (!applicators['posRegisters']) applicators['posRegisters'] = (v) => useInventoryStore.setState({ posRegisters: v });
    if (!applicators['posSettings'])  applicators['posSettings']  = (v) => useInventoryStore.setState({ posSettings: v });
    if (!applicators['inventory'])    applicators['inventory']    = (v) => useInventoryStore.setState({ inventory: v });
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

  useEffect(() => {
    // Obtener el branchId del usuario activo en el momento de montar
    const user = useAuthStore.getState().user;
    const branchId = user?.branchId ?? null;
    const allBranchIds = useBranchStore.getState().branches.map(b => b.id);

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
          const currentApplicators = getApplicators(branchId, allBranchIds);
          if (currentApplicators[key]) {
            console.log(`[Realtime] Actualización remota recibida: "${key}"`);
            scheduleBatch(key, value, branchId, allBranchIds);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(pullDebounceRef.current);
          pullDebounceRef.current = setTimeout(() => {
            refreshAllFromSupabase(branchId, allBranchIds);
          }, 800);
        }
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(pullDebounceRef.current);
      if (_batchTimer) { clearTimeout(_batchTimer); _batchTimer = null; }
      supabase.removeChannel(channel);
    };
  }, []);
}
