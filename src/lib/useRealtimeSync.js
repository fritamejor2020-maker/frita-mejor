import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { unstable_batchedUpdates } from 'react-dom';
import { supabase } from './supabase';
import { pullAll } from './syncManager';
import { useInventoryStore } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePayrollStore } from '../store/usePayrollStore';

// ==============================================================================
// useRealtimeSync — Hook que suscribe a los cambios remotos de Supabase Realtime
// Cuando otro dispositivo hace un cambio, este hook lo recibe y actualiza el
// store local automáticamente, sin recargar la página.
// ==============================================================================

// Flag para evitar que los updates de Supabase Realtime disparen re-broadcasts al crossTabSync.
let _isApplyingRealtimeState = false;
export function isApplyingRealtimeState() { return _isApplyingRealtimeState; }

// Flag para evitar loops: cuando nosotros mismos hacemos un push, Supabase nos
// devuelve el evento. Este flag lo ignora durante 500ms.
let _ignoreRemoteKeys = new Set();

export function markLocalWrite(key) {
  _ignoreRemoteKeys.add(key);
  setTimeout(() => _ignoreRemoteKeys.delete(key), 2000);
}

// Mapa de key → función que aplica el valor remoto al store correspondiente
function getApplicators() {
  return {
    warehouses:        (v) => useInventoryStore.setState({ warehouses: v }),
    inventory:         (v) => useInventoryStore.setState({ inventory: v }),
    movements:         (v) => useInventoryStore.setState({ movements: v }),
    products:          (v) => useInventoryStore.setState({ products: v }),
    recipes:           (v) => useInventoryStore.setState({ recipes: v }),
    fritadoRecipes:    (v) => useInventoryStore.setState({ fritadoRecipes: v }),
    posCategories:     (v) => useInventoryStore.setState({ posCategories: v }),
    posSettings:       (v) => useInventoryStore.setState({ posSettings: v }),
    posRegisters:      (v) => useInventoryStore.setState({ posRegisters: v }),
    posShifts:         (v) => useInventoryStore.setState({ posShifts: v }),
    posSales:          (v) => useInventoryStore.setState({ posSales: v }),
    posExpenses:       (v) => useInventoryStore.setState({ posExpenses: v }),
    customers:         (v) => useInventoryStore.setState({ customers: v }),
    customerTypes:     (v) => useInventoryStore.setState({ customerTypes: v }),
    loadTemplates:     (v) => useInventoryStore.setState({ loadTemplates: v }),
    vehicles:          (v) => useVehicleStore.setState({ vehicles: v }),
    suppliers:         (v) => useSupplierStore.setState({ suppliers: v }),
    pendingRequests:   (v) => useLogisticsStore.setState({ pendingRequests: v }),
    completedRequests: (v) => useLogisticsStore.setState({ completedRequests: v }),
    rejectedRequests:  (v) => useLogisticsStore.setState({ rejectedRequests: v }),
    loadHistory:       (v) => useLogisticsStore.setState({ loadHistory: v }),
    users:             (v) => useAuthStore.setState({ users: v }),
    payrollEmployees:  (v) => usePayrollStore.setState({ payrollEmployees: v }),
    payrollRecords:    (v) => usePayrollStore.setState({ payrollRecords: v }),
  };
}

/**
 * Aplica un mapa { key: value } agrupando TODOS los setState en un único
 * render de React usando unstable_batchedUpdates.
 * Esto evita el crash "insertBefore" que ocurría cuando múltiples setState
 * en secuencia disparaban renders de React solapados.
 */
function applyRemoteSnapshot(snapshot) {
  const applicators = getApplicators();
  _isApplyingRealtimeState = true;
  try {
    unstable_batchedUpdates(() => {
      Object.entries(snapshot).forEach(([key, value]) => {
        const apply = applicators[key];
        if (apply) {
          console.log(`[Realtime] Aplicando estado remoto (pull): "${key}"`);
          apply(value);
        }
      });
    });
  } finally {
    _isApplyingRealtimeState = false;
  }
}

/**
 * Fuerza una re-lectura de todo el estado desde Supabase y lo aplica localmente.
 */
export async function refreshAllFromSupabase() {
  try {
    const snapshot = await pullAll();
    if (snapshot && Object.keys(snapshot).length > 0) {
      applyRemoteSnapshot(snapshot);
      console.log('[Realtime] Estado fresco obtenido desde Supabase ✅');
    }
  } catch (err) {
    console.warn('[Realtime] Error al re-leer estado remoto:', err.message);
  }
}

// ── Batching de eventos individuales de Realtime ──────────────────────────────
// Supabase puede disparar varios eventos en ráfaga (uno por key).
// Los acumulamos en un objeto y los aplicamos todos juntos con un setTimeout(0),
// garantizando un único render de React por ráfaga de cambios remotos.
let _pendingBatch = {};
let _batchTimer = null;

function scheduleBatch(key, value) {
  _pendingBatch[key] = value;
  if (_batchTimer) return; // ya hay un flush programado
  _batchTimer = setTimeout(() => {
    const batch = _pendingBatch;
    _pendingBatch = {};
    _batchTimer = null;
    applyRemoteSnapshot(batch);
  }, 0); // flush en el siguiente macrotask (fuera del render actual)
}

export function useRealtimeSync() {
  const channelRef = useRef(null);
  const pullDebounceRef = useRef(null);

  useEffect(() => {
    const channel = supabase
      .channel('app-state-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state' },
        (payload) => {
          const { new: newRow } = payload;
          if (!newRow) return;

          const { key, value } = newRow;

          // Ignorar si fuimos nosotros quienes escribimos (evita parpadeo)
          if (_ignoreRemoteKeys.has(key)) return;

          const applicators = getApplicators();
          if (applicators[key]) {
            console.log(`[Realtime] Actualización remota recibida: "${key}"`);
            // Acumular y aplicar en batch para evitar renders concurrentes
            scheduleBatch(key, value);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(pullDebounceRef.current);
          pullDebounceRef.current = setTimeout(() => {
            refreshAllFromSupabase();
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
