import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useInventoryStore } from '../store/useInventoryStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useLogisticsStore } from '../store/useLogisticsStore';

// ==============================================================================
// useRealtimeSync — Hook que suscribe a los cambios remotos de Supabase Realtime
// Cuando otro dispositivo hace un cambio, este hook lo recibe y actualiza el
// store local automáticamente, sin recargar la página.
// ==============================================================================

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
    loadHistory:     (v) => useLogisticsStore.setState({ loadHistory: v }),
  };
}

export function useRealtimeSync() {
  const channelRef = useRef(null);

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
            apply(value);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal status:', status);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
