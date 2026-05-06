import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push, BRANCH_KEYS } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useAuthStore } from './useAuthStore';

/**
 * Store de Transferencias Bancarias del Vendedor
 * ─────────────────────────────────────────────
 * Cada vendedor registra aquí las transferencias que recibe de clientes
 * durante su turno. Se persiste localmente y se sincroniza con Supabase.
 *
 * Estructura de cada transfer:
 *   {
 *     id:           string,          // 'VTRF-1234567890'
 *     pointId:      string,          // 'T1', 'T2', etc
 *     shiftOpenedAt: string,         // ISO - timestamp del inicio del turno
 *     amount:       number,          // Valor en COP
 *     photoBase64:  string | null,   // Foto del comprobante (base64)
 *     note:         string,          // Observación opcional
 *     vendorName:   string,          // Nombre del vendedor
 *     vendorId:     string,          // userId
 *     createdAt:    string,          // ISO - timestamp de la transferencia
 *     branchId:     string | null,   // Sede
 *   }
 */

function syncTransfers(transfers) {
  const user = useAuthStore.getState().user;
  const branchId = user?.branchId ?? null;
  const effectiveBranch = branchId || 'BRANCH-001';
  markLocalWrite('vendorTransfers', effectiveBranch);
  push('vendorTransfers', transfers, effectiveBranch).catch(err =>
    console.warn('[Sync] vendorTransfers:', err.message)
  );
}

export const useVendorTransferStore = create(
  persist(
    (set, get) => ({
      transfers: [],

      /**
       * Registra una nueva transferencia bancaria.
       */
      addTransfer: ({ pointId, shiftOpenedAt, amount, photoBase64, note }) => {
        const user = useAuthStore.getState().user;
        const newTransfer = {
          id: `VTRF-${Date.now()}`,
          pointId,
          shiftOpenedAt,
          amount: Number(amount) || 0,
          photoBase64: photoBase64 || null,
          note: note?.trim() || '',
          vendorName: user?.name || 'Vendedor',
          vendorId: user?.id || 'unknown',
          branchId: user?.branchId || 'BRANCH-001',
          createdAt: new Date().toISOString(),
        };

        const updated = [newTransfer, ...get().transfers];
        set({ transfers: updated });
        syncTransfers(updated);
        return newTransfer;
      },

      /**
       * Elimina una transferencia (solo la propia, por si se equivocó).
       */
      deleteTransfer: (id) => {
        const updated = get().transfers.filter(t => t.id !== id);
        set({ transfers: updated });
        syncTransfers(updated);
      },

      /**
       * Edita una transferencia existente (monto, nota, foto).
       */
      updateTransfer: (id, updates) => {
        const updated = get().transfers.map(t =>
          t.id === id ? { ...t, ...updates, editedAt: new Date().toISOString() } : t
        );
        set({ transfers: updated });
        syncTransfers(updated);
      },

      /**
       * Retorna las transferencias del turno actual de un punto.
       */
      getShiftTransfers: (pointId, shiftOpenedAt) => {
        if (!pointId || !shiftOpenedAt) return [];
        const shiftStart = new Date(shiftOpenedAt).getTime();
        return get().transfers.filter(t =>
          t.pointId === pointId &&
          new Date(t.createdAt).getTime() >= shiftStart
        );
      },

      /**
       * Suma total de transferencias del turno actual.
       */
      getShiftTransferTotal: (pointId, shiftOpenedAt) => {
        const shiftTransfers = get().getShiftTransfers(pointId, shiftOpenedAt);
        return shiftTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
      },

      /**
       * Admin: obtener todas las transferencias de un vendedor/punto en un rango.
       */
      getByVendor: (vendorId) => {
        return get().transfers.filter(t => t.vendorId === vendorId);
      },

      /**
       * Carga remota desde Supabase (via Realtime o pullAll).
       */
      loadFromRemote: (remoteTransfers) => {
        if (Array.isArray(remoteTransfers) && remoteTransfers.length > 0) {
          // Smart merge: mantener locales no presentes en remote
          const localOnly = get().transfers.filter(
            t => !remoteTransfers.some(r => r.id === t.id)
          );
          set({ transfers: [...localOnly, ...remoteTransfers] });
        }
      },
    }),
    {
      name: 'frita-vendor-transfers',
      version: 1,
      partialize: (state) => ({
        transfers: state.transfers,
      }),
    }
  )
);
