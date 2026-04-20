import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { pullAll } from './syncManager';
import { useInventoryStore } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useLogisticsStore } from '../store/useLogisticsStore';

// ==============================================================================
// useRealtimeSync — Hook que suscribe a los cambios remotos de Supabase Realtime
// Cuando otro dispositivo hace un cambio, este hook lo recibe y actualiza el
// store local automáticamente, sin recargar la página.
// ==============================================================================

// Flag para evitar que los updates de Supabase Realtime disparen re-broadcasts al crossTabSync.
// Cada pestaña recibe los eventos de Supabase directamente — no hay que retransmitirlos.
let _isApplyingRealtimeState = false;
export function isApplyingRealtimeState() { return _isApplyingRealtimeState; }

// Flag para evitar loops: cuando nosotros mismos hacemos un push, Supabase nos
// devuelve el evento. Este flag lo ignora durante 500ms.
let _ignoreRemoteKeys = new Set();

export function markLocalWrite(key) {
  _ignoreRemoteKeys.add(key);
  setTimeout(() => _ignoreRemoteKeys.delete(key), 500);
}

// Mapa de key → función que aplica el valor remoto al store correspondiente
function getApplicators() {
  const inv = useInventoryStore.getState();
  const veh = useVehicleStore.getState();
  const sup = useSupplierStore.getState();
  const log = useLogisticsStore.getState();

  return {
    warehouses:      (v) => useInventoryStore.setState({ warehouses: v }),
    inventory:       (v) => useInventoryStore.setState({ inventory: v }),
    movements:       (v) => useInventoryStore.setState({ movements: v }),
    products:        (v) => useInventoryStore.setState({ products: v }),
    recipes:         (v) => useInventoryStore.setState({ recipes: v }),
    fritadoRecipes:  (v) => useInventoryStore.setState({ fritadoRecipes: v }),
    posCategories:   (v) => useInventoryStore.setState({ posCategories: v }),
    posSettings:     (v) => useInventoryStore.setState({ posSettings: v }),
    posShifts:       (v) => useInventoryStore.setState({ posShifts: v }),
    posSales:        (v) => useInventoryStore.setState({ posSales: v }),
    posExpenses:     (v) => useInventoryStore.setState({ posExpenses: v }),
    customers:       (v) => useInventoryStore.setState({ customers: v }),
    customerTypes:   (v) => useInventoryStore.setState({ customerTypes: v }),
    loadTemplates:   (v) => useInventoryStore.setState({ loadTemplates: v }),
    vehicles:        (v) => useVehicleStore.setState({ vehicles: v }),
    suppliers:       (v) => useSupplierStore.setState({ suppliers: v }),
    pendingRequests: (v) => useLogisticsStore.setState({ pendingRequests: v }),
    completedRequests: (v) => useLogisticsStore.setState({ completedRequests: v }),
    rejectedRequests: (v) => useLogisticsStore.setState({ rejectedRequests: v }),
    loadHistory:     (v) => useLogisticsStore.setState({ loadHistory: v }),
  };
}

// Aplica un mapa { key: value } usando los applicators registrados
async function applyRemoteSnapshot(snapshot) {
  const applicators = getApplicators();
  _isApplyingRealtimeState = true;
  try {
    Object.entries(snapshot).forEach(([key, value]) => {
      const apply = applicators[key];
      if (apply) {
        console.log(`[Realtime] Aplicando estado remoto (pull): "${key}"`);
        apply(value);
      }
    });
  } finally {
    _isApplyingRealtimeState = false;
  }
}

/**
 * Fuerza una re-lectura de todo el estado desde Supabase y lo aplica localmente.
 * Útil para el admin, o cuando se detecta que el canal reconectó.
 */
export async function refreshAllFromSupabase() {
  try {
    const snapshot = await pullAll();
    if (snapshot && Object.keys(snapshot).length > 0) {
      await applyRemoteSnapshot(snapshot);
      console.log('[Realtime] Estado fresco obtenido desde Supabase ✅');
    }
  } catch (err) {
    console.warn('[Realtime] Error al re-leer estado remoto:', err.message);
  }
}

export function useRealtimeSync() {
  const channelRef = useRef(null);
  // Debounce para no hacer pull múltiple si reconecta varias veces seguidas
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
          const apply = applicators[key];
          if (apply) {
            console.log(`[Realtime] Actualización remota recibida: "${key}"`);
            _isApplyingRealtimeState = true;
            apply(value);
            _isApplyingRealtimeState = false;
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal status:', status);
        // Al conectar o reconectar: hacer pull completo para sincronizar estado perdido
        if (status === 'SUBSCRIBED') {
          clearTimeout(pullDebounceRef.current);
          pullDebounceRef.current = setTimeout(() => {
            refreshAllFromSupabase();
          }, 800); // espera 800ms para que los stores estén listos
        }
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(pullDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, []);
}
