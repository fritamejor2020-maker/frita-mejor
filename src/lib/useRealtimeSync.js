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
import { useChatStore } from '../store/useChatStore';
import { useAttendanceStore, isLogDeleted, isExplicitAttendancePunch } from '../store/useAttendanceStore';
import { useIncomeConfigStore } from '../store/useIncomeConfigStore';
import { useGoalStore } from '../store/useGoalStore';

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
  setTimeout(() => _ignoreRemoteKeys.delete(supabaseKey), 300);
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
  applicators['customer_delivery_requests'] = (v) => useLogisticsStore.setState({ customerDeliveryRequests: v });
  applicators['inventory']         = (v) => {
    if (Array.isArray(v)) {
      const DEMO_PRD_SET = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);
      const deletedInvIds = new Set(useInventoryStore.getState().deletedInventoryIds || []);
      const filtered = v.filter(i => {
        if (!i?.id || DEMO_PRD_SET.has(i.id)) return false;
        if (i.inTricycles === true || String(i.inTricycles) === 'true' || i.showInTricicloPos === true) return true;
        return !deletedInvIds.has(i.id);
      });
      useInventoryStore.setState({ inventory: filtered });
    }
  };
  applicators['warehouses']        = (v) => useInventoryStore.setState({ warehouses: v });
  applicators['products']          = (v) => useInventoryStore.setState({ products: v });
  applicators['movements']         = (v) => useInventoryStore.setState({ movements: v });
  applicators['recipes']           = (v) => useInventoryStore.setState({ recipes: v });
  applicators['fritadoRecipes']    = (v) => useInventoryStore.setState({ fritadoRecipes: v });
  applicators['posCategories']     = (v) => useInventoryStore.setState({ posCategories: v });
  applicators['customers']         = (v) => { if (Array.isArray(v) && v.length > 0) useInventoryStore.setState({ customers: v }); };
  applicators['customerTypes']     = (v) => { if (Array.isArray(v) && v.length > 0) useInventoryStore.setState({ customerTypes: v }); };
  applicators['loadTemplates']     = (v) => useInventoryStore.setState({ loadTemplates: v });
  applicators['users']             = (v) => { if (Array.isArray(v) && v.length > 0) useAuthStore.setState({ users: v }); };
  applicators['vehicles']          = (v) => {
    if (Array.isArray(v)) {
      useVehicleStore.setState({ vehicles: v });
    } else if (v && typeof v === 'object') {
      useVehicleStore.setState({
        vehicles: v.vehicles || [],
        sellerViewEnabled: v.sellerViewEnabled ?? true,
        dejadorViewEnabled: v.dejadorViewEnabled ?? true,
        enabledPointTypes: v.enabledPointTypes || { Triciclo: true, Carrito: true, Local: false },
      });
    }
  };
  applicators['incomeConfig']      = (v) => {
    if (v && typeof v === 'object') {
      useIncomeConfigStore.setState({
        hierarchy: v.hierarchy || {},
        descarguesEnabled: v.descarguesEnabled || {},
      });
    }
  };
  applicators['monthlyGoals']      = (v) => {
    if (v && typeof v === 'object') {
      useGoalStore.setState({ monthlyGoals: v });
    }
  };
  applicators['branches']          = (v) => { if (Array.isArray(v) && v.length > 0) useBranchStore.getState().loadFromRemote(v); };
  applicators['tasks_data']        = (v) => useTaskStore.getState().loadFromRemote(v);
  applicators['suppliers']         = (v) => useSupplierStore.getState().loadFromRemote(v);
  const mergeLogisticsList = (currentList, incomingList, isPendingOnly = false) => {
    if (!Array.isArray(incomingList)) return currentList || [];
    const nowMs = Date.now();
    const map = new Map();

    const isKeepable = (item) => {
      if (!item) return false;
      if (isPendingOnly) {
        const today = new Date().toISOString().slice(0, 10);
        const d = (item.created_at || item.timestamp || item.fecha || item.date || '').slice(0, 10);
        return !d || d >= today;
      }
      // Para completedRequests, rejectedRequests y loadHistory: conservar los últimos 60 días (historial completo)
      const rawDate = item.completed_at || item.created_at || item.timestamp || item.fecha || item.date || '';
      if (!rawDate) return true;
      const itemTime = new Date(rawDate).getTime();
      if (isNaN(itemTime)) return true;
      return (nowMs - itemTime) <= 60 * 24 * 60 * 60 * 1000;
    };

    // 1. Añadir elementos locales primero
    (currentList || []).filter(isKeepable).forEach(item => {
      if (item?.id) map.set(item.id, item);
    });

    // 2. Fusionar elementos entrantes preservando escrituras locales recientes
    incomingList.filter(isKeepable).forEach(item => {
      if (!item?.id) return;
      const local = map.get(item.id);
      if (!local) {
        map.set(item.id, item);
      } else {
        const localTime = new Date(local.created_at || local.completed_at || local.timestamp || 0).getTime();
        const incomingTime = new Date(item.created_at || item.completed_at || item.timestamp || 0).getTime();
        if (nowMs - localTime < 15000 && incomingTime < localTime) {
          map.set(item.id, local);
        } else {
          map.set(item.id, { ...local, ...item });
        }
      }
    });

    // 3. Garantizar que ningún pedido pendiente local creado recientemente se pierda por desfase de red
    (currentList || []).forEach(localItem => {
      if (localItem?.id && !map.has(localItem.id)) {
        const localTime = new Date(localItem.created_at || localItem.timestamp || 0).getTime();
        if (nowMs - localTime < 60000) {
          map.set(localItem.id, localItem);
        }
      }
    });

    return Array.from(map.values());
  };

  applicators['pendingRequests']   = (v) => useLogisticsStore.setState(s => ({ pendingRequests: mergeLogisticsList(s.pendingRequests, v, true) }));
  applicators['completedRequests'] = (v) => useLogisticsStore.setState(s => ({ completedRequests: mergeLogisticsList(s.completedRequests, v, false) }));
  applicators['rejectedRequests']  = (v) => useLogisticsStore.setState(s => ({ rejectedRequests: mergeLogisticsList(s.rejectedRequests, v, false) }));
  applicators['loadHistory']       = (v) => useLogisticsStore.setState(s => ({ loadHistory: mergeLogisticsList(s.loadHistory, v, false) }));
  applicators['deletedUserIds']    = (v) => {
    const local = useAuthStore.getState().deletedUserIds || [];
    const merged = [...new Set([...local, ...(v || [])])];
    const deletedSet = new Set(merged);
    const currentUsers = useAuthStore.getState().users || [];
    useAuthStore.setState({
      deletedUserIds: merged,
      users: currentUsers.filter(u => !deletedSet.has(u.id))
    });
  };
  applicators['users']             = (v) => {
    const deletedSet = new Set(useAuthStore.getState().deletedUserIds || []);
    const filtered = (v || []).filter(u => u?.id && !deletedSet.has(u.id));
    useAuthStore.setState({ users: filtered });
  };
  applicators['payrollEmployees']  = (v) => usePayrollStore.setState({ payrollEmployees: v });
  applicators['payrollRecords']    = (v) => usePayrollStore.setState({ payrollRecords: v });
  applicators['branches']          = (v) => useBranchStore.getState().loadFromRemote(v);
  applicators['deletedBranchIds']  = (v) => {
    const local = useBranchStore.getState().deletedBranchIds || [];
    const merged = [...new Set([...local, ...(v || [])])];
    useBranchStore.setState({ deletedBranchIds: merged });
    const currentBranches = useBranchStore.getState().branches || [];
    useBranchStore.getState().loadFromRemote(currentBranches);
  };
  applicators['vendorLocations']   = (v) => useInventoryStore.setState({ vendorLocations: v });
  applicators['posRegisters']      = (v) => {
    const deleted = new Set(useInventoryStore.getState().deletedPosRegisterIds || []);
    const filtered = (v || []).filter(r => !deleted.has(r.id));
    useInventoryStore.setState({ posRegisters: filtered });
  };
  applicators['deletedPosRegisterIds'] = (v) => {
    const local = useInventoryStore.getState().deletedPosRegisterIds || [];
    const merged = [...new Set([...local, ...(v || [])])];
    useInventoryStore.setState({ deletedPosRegisterIds: merged });
    const currentRegs = useInventoryStore.getState().posRegisters || [];
    const setDeleted = new Set(merged);
    useInventoryStore.setState({ posRegisters: currentRegs.filter(r => !setDeleted.has(r.id)) });
  };
  applicators['transfers']         = (v) => useTransferStore.getState().loadFromRemote(v);
  applicators['tasks_data']        = (v) => useTaskStore.getState().loadFromRemote(v);
  applicators['salesGoals']        = (v) => useInventoryStore.setState({ salesGoals: v });
  applicators['chatMessages']      = (v) => useChatStore.setState({ messages: (v || []).slice(0, 50) });
  applicators['posShifts']        = (v) => {
    const state = useInventoryStore.getState();
    const deleted = new Set(state.deletedShiftIds || []);
    const localShifts = (state.posShifts || []).filter(s => !deleted.has(s.id));
    const remote = (v || []).filter(s => !deleted.has(s.id));
    const merged = mergeArrays(localShifts, remote, 'posShifts');
    useInventoryStore.setState({ posShifts: merged });
  };

  // ── Locales por sede ──
  // Si es Admin (branchId=null), suscribe a TODAS las sedes.
  // Si es operativo, solo a su sede.
  const effectiveBranches = (branchId === null || branchId === undefined)
    ? (allBranchIds.length > 0 ? allBranchIds : ['BRANCH-001'])
    : [branchId || 'BRANCH-001'];

  for (const bid of effectiveBranches) {
    // ── POS & Inventario ──
    applicators[`inventory_${bid}`]        = (v) => {
      if (Array.isArray(v)) {
        const DEMO_PRD_SET = new Set(['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006', 'PRD-RAW-005', 'PRD-RAW-006']);
        const deletedInvIds = new Set(useInventoryStore.getState().deletedInventoryIds || []);
        const filtered = v.filter(i => i?.id && !deletedInvIds.has(i.id) && !DEMO_PRD_SET.has(i.id));
        useInventoryStore.setState({ inventory: filtered });
      }
    };
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
      const deletedSales = new Set(state.deletedPosSaleIds || []);
      const localSales = (state.posSales || []).filter(s => !deletedSales.has(s.id) && (!s.originalOlaClickId || !deletedSales.has(s.originalOlaClickId)));
      const remoteSales = (v || []).filter(s => !deletedSales.has(s.id) && (!s.originalOlaClickId || !deletedSales.has(s.originalOlaClickId)));
      const merged = mergeArrays(localSales, remoteSales, 'posSales');
      useInventoryStore.setState({ posSales: merged });
    };
    applicators[`posExpenses_${bid}`]      = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.posExpenses || [], v || [], 'posExpenses');
      useInventoryStore.setState({ posExpenses: merged });
    };
    applicators[`attendance_logs_${bid}`] = (v) => {
      if (Array.isArray(v)) {
        const deletedIds = new Set(useAttendanceStore.getState().deletedLogIds || []);
        const filtered = (v || []).filter(l => !isLogDeleted(l, deletedIds) && isExplicitAttendancePunch(l));
        useAttendanceStore.setState({ attendanceLogs: filtered });
      }
    };
    applicators[`attendance_contracts_${bid}`] = (v) => {
      if (Array.isArray(v) && v.length > 0) {
        const current = useAttendanceStore.getState().employeeContracts || [];
        const map = new Map(current.map(c => [c.employeeId || c.employeeNo, c]));
        v.forEach(c => {
          const key = c.employeeId || c.employeeNo;
          if (key) {
            const ex = map.get(key);
            map.set(key, ex ? { ...ex, ...c } : c);
          }
        });
        useAttendanceStore.setState({ employeeContracts: Array.from(map.values()) });
      }
    };
    applicators[`attendance_shifts_${bid}`] = (v) => {
      if (Array.isArray(v) && v.length > 0) useAttendanceStore.setState({ shiftTemplates: v });
    };
    applicators[`attendance_groups_${bid}`] = (v) => {
      if (Array.isArray(v) && v.length > 0) useAttendanceStore.setState({ scheduleGroups: v });
    };
    applicators[`attendance_overrides_${bid}`] = (v) => {
      if (Array.isArray(v)) {
        useAttendanceStore.setState({ shiftOverrides: v });
      }
    };
    applicators[`deleted_attendance_log_ids_${bid}`] = (v) => {
      if (Array.isArray(v)) {
        const current = useAttendanceStore.getState().deletedLogIds || [];
        const merged = Array.from(new Set([...current, ...v]));
        useAttendanceStore.setState({ deletedLogIds: merged });
      }
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
    applicators[`pendingRequests_${bid}`]   = (v) => useLogisticsStore.setState(s => ({ pendingRequests: mergeLogisticsList(s.pendingRequests, v, true) }));
    applicators[`completedRequests_${bid}`] = (v) => useLogisticsStore.setState(s => ({ completedRequests: mergeLogisticsList(s.completedRequests, v, false) }));
    applicators[`rejectedRequests_${bid}`]  = (v) => useLogisticsStore.setState(s => ({ rejectedRequests: mergeLogisticsList(s.rejectedRequests, v, false) }));
    applicators[`loadHistory_${bid}`]       = (v) => useLogisticsStore.setState(s => ({ loadHistory: mergeLogisticsList(s.loadHistory, v, false) }));
    applicators[`customerTypes_${bid}`]   = (v) => { if (Array.isArray(v) && v.length > 0) useInventoryStore.setState({ customerTypes: v }); };
    applicators[`customers_${bid}`]       = (v) => { if (Array.isArray(v) && v.length > 0) useInventoryStore.setState({ customers: v }); };
    applicators[`posSettings_${bid}`]     = (v) => {
      if (v && typeof v === 'object') {
        const current = useInventoryStore.getState().posSettings || {};
        useInventoryStore.setState({ posSettings: { ...current, ...v } });
      }
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
    applicators[`vehicles_${bid}`] = (v) => {
      if (Array.isArray(v)) {
        useVehicleStore.setState({ vehicles: v });
      } else if (v && typeof v === 'object') {
        useVehicleStore.setState({
          vehicles: v.vehicles || [],
          sellerViewEnabled: v.sellerViewEnabled ?? true,
          dejadorViewEnabled: v.dejadorViewEnabled ?? true,
          enabledPointTypes: v.enabledPointTypes || { Triciclo: true, Carrito: true, Local: false },
        });
      }
    };


    // ── Otros BRANCH_KEYS que syncManager escribe con sufijo ──
    applicators[`loadTemplates_${bid}`]     = (v) => {
      const state = useInventoryStore.getState();
      const merged = mergeArrays(state.loadTemplates || [], v || [], 'loadTemplates');
      useInventoryStore.setState({ loadTemplates: merged });
    };
    applicators[`vendorLocations_${bid}`]   = (v) => useInventoryStore.setState({ vendorLocations: v });
    applicators[`chatMessages_${bid}`]      = (v) => {
      const state = useChatStore.getState();
      const merged = mergeArrays(state.messages || [], v || [], 'chatMessages');
      useChatStore.setState({ messages: (merged || []).slice(0, 50) });
    };
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
    applicators[`posRegisters_${bid}`]     = (v) => {
      const state = useInventoryStore.getState();
      const deletedRegs = new Set(state.deletedPosRegisterIds || []);
      const filtered = (v || []).filter(r => !deletedRegs.has(r.id));
      const current = state.posRegisters || [];
      const otherBranch = current.filter(r => (r.branchId || 'BRANCH-001') !== bid && !deletedRegs.has(r.id));
      useInventoryStore.setState({ posRegisters: [...otherBranch, ...filtered] });
    };
    applicators[`deletedPosRegisterIds_${bid}`] = (v) => {
      const local = useInventoryStore.getState().deletedPosRegisterIds || [];
      const merged = [...new Set([...local, ...(v || [])])];
      useInventoryStore.setState({ deletedPosRegisterIds: merged });
      const currentRegs = useInventoryStore.getState().posRegisters || [];
      const setDeleted = new Set(merged);
      useInventoryStore.setState({ posRegisters: currentRegs.filter(r => !setDeleted.has(r.id)) });
    };

    // Legacy: llaves sin sufijo (para migración inicial desde versión anterior)
    if (!applicators['posShifts'])        applicators['posShifts']        = (v) => {
      const deleted = new Set(useInventoryStore.getState().deletedShiftIds || []);
      useInventoryStore.setState({ posShifts: (v || []).filter(s => !deleted.has(s.id)) });
    };
    if (!applicators['posSales'])         applicators['posSales']         = (v) => {
      const state = useInventoryStore.getState();
      const deletedSales = new Set(state.deletedPosSaleIds || []);
      const localSales = (state.posSales || []).filter(s => !deletedSales.has(s.id) && (!s.originalOlaClickId || !deletedSales.has(s.originalOlaClickId)));
      const remoteSales = (v || []).filter(s => !deletedSales.has(s.id) && (!s.originalOlaClickId || !deletedSales.has(s.originalOlaClickId)));
      const merged = mergeArrays(localSales, remoteSales, 'posSales');
      useInventoryStore.setState({ posSales: merged });
    };
    if (!applicators['posExpenses'])      applicators['posExpenses']      = (v) => useInventoryStore.setState({ posExpenses: v });
    if (!applicators['posRegisters'])     applicators['posRegisters']     = (v) => {
      const deleted = new Set(useInventoryStore.getState().deletedPosRegisterIds || []);
      useInventoryStore.setState({ posRegisters: (v || []).filter(r => !deleted.has(r.id)) });
    };
    if (!applicators['deletedPosRegisterIds']) applicators['deletedPosRegisterIds'] = (v) => {
      const local = useInventoryStore.getState().deletedPosRegisterIds || [];
      const merged = [...new Set([...local, ...(v || [])])];
      useInventoryStore.setState({ deletedPosRegisterIds: merged });
      const currentRegs = useInventoryStore.getState().posRegisters || [];
      const setDeleted = new Set(merged);
      useInventoryStore.setState({ posRegisters: currentRegs.filter(r => !setDeleted.has(r.id)) });
    };
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
    if (!applicators['attendance_logs'])   applicators['attendance_logs']   = (v) => {
      if (Array.isArray(v)) {
        const deletedIds = new Set(useAttendanceStore.getState().deletedLogIds || []);
        const filtered = (v || []).filter(l => !isLogDeleted(l, deletedIds) && isExplicitAttendancePunch(l));
        useAttendanceStore.setState({ attendanceLogs: filtered });
      }
    };
    if (!applicators['attendance_contracts']) applicators['attendance_contracts'] = (v) => {
      if (Array.isArray(v) && v.length > 0) {
        const current = useAttendanceStore.getState().employeeContracts || [];
        const map = new Map(current.map(c => [c.employeeId || c.employeeNo, c]));
        v.forEach(c => {
          const key = c.employeeId || c.employeeNo;
          if (key) {
            const ex = map.get(key);
            map.set(key, ex ? { ...ex, ...c } : c);
          }
        });
        useAttendanceStore.setState({ employeeContracts: Array.from(map.values()) });
      }
    };
    if (!applicators['attendance_overrides']) applicators['attendance_overrides'] = (v) => { if (Array.isArray(v)) useAttendanceStore.setState({ shiftOverrides: v }); };
    if (!applicators['attendance_shifts'])    applicators['attendance_shifts']    = (v) => { if (Array.isArray(v) && v.length > 0) useAttendanceStore.setState({ shiftTemplates: v }); };
    if (!applicators['attendance_groups'])    applicators['attendance_groups']    = (v) => { if (Array.isArray(v) && v.length > 0) useAttendanceStore.setState({ scheduleGroups: v }); };
    if (!applicators['attendance_terminals']) applicators['attendance_terminals'] = (v) => { if (Array.isArray(v) && v.length > 0) useAttendanceStore.setState({ terminals: v }); };
  }

  return applicators;
}

// ─── Aplicación de snapshot remoto ────────────────────────────────────────────

export function applyRemoteSnapshot(snapshot, branchId, allBranchIds) {
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
    const user = useAuthStore.getState().user;
    const activeBranchId = useAuthStore.getState().activeBranchId;
    const isAdmin = user?.role === 'ADMIN';

    // Para ADMIN, targetBranchId debe ser explícitamente null para refrescar todas las sedes
    const targetBranchId = branchId !== undefined 
      ? branchId 
      : (isAdmin ? null : (user?.branchId || activeBranchId || 'BRANCH-001'));
      
    const branches = useBranchStore.getState().branches || [];
    const targetAllBranchIds = (allBranchIds && Array.isArray(allBranchIds) && allBranchIds.length > 0)
      ? allBranchIds
      : (branches.length > 0 ? branches.map(b => b.id) : ['BRANCH-001']);

    const snapshot = await pullAll(targetBranchId, targetAllBranchIds);
    if (snapshot && Object.keys(snapshot).length > 0) {
      applyRemoteSnapshot(snapshot, targetBranchId, targetAllBranchIds);
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
