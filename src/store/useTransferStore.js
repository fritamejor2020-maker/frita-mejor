import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useInventoryStore } from './useInventoryStore';
import { useAuthStore } from './useAuthStore';

// =============================================================================
// TRANSFER STORE — Módulo de Traslados Inter-Sede
// Llave de sync: 'transfers' (GLOBAL — todos los dispositivos la ven)
// =============================================================================

// Tipos de ítem transferibles
export const TRANSFER_ITEM_TYPES = {
  insumos:   { label: 'Insumos / Materias primas', icon: '🧂', types: ['INSUMO'] },
  crudos:    { label: 'Productos Crudos',           icon: '🥩', types: ['PRODUCTO'], raw: true },
  productos: { label: 'Productos Terminados',       icon: '📦', types: ['PRODUCTO'] },
  fritos:    { label: 'Fritos / Listos para venta', icon: '🍟', types: ['FRITO'] },
};

// Estados del traslado
export const TRANSFER_STATUS = {
  SOLICITADO: { label: 'Solicitado',    color: 'bg-yellow-100 text-yellow-700',  icon: '📋' },
  ACEPTADO:   { label: 'Aceptado',      color: 'bg-blue-100 text-blue-700',      icon: '✅' },
  EN_CAMINO:  { label: 'En camino',     color: 'bg-orange-100 text-orange-700',  icon: '🚛' },
  RECIBIDO:   { label: 'Recibido',      color: 'bg-green-100 text-green-700',    icon: '📬' },
  RECHAZADO:  { label: 'Rechazado',     color: 'bg-red-100 text-red-700',        icon: '❌' },
  CANCELADO:  { label: 'Cancelado',     color: 'bg-gray-100 text-gray-500',      icon: '🚫' },
};

function syncTransfers(transfers) {
  markLocalWrite('transfers');
  push('transfers', transfers, null).catch(err =>
    console.warn('[Sync] transfers:', err.message)
  );
}

export const useTransferStore = create(
  persist(
    (set, get) => ({
      transfers: [],

      // ─── Getters ──────────────────────────────────────────────────────────

      getAll: () => get().transfers,

      getByBranch: (branchId) =>
        get().transfers.filter(t =>
          t.fromBranchId === branchId || t.toBranchId === branchId
        ),

      getPending: (branchId) =>
        get().transfers.filter(t =>
          t.fromBranchId === branchId && t.status === 'SOLICITADO'
        ),

      getIncoming: (branchId) =>
        get().transfers.filter(t =>
          t.toBranchId === branchId && ['ACEPTADO', 'EN_CAMINO'].includes(t.status)
        ),

      getForDejador: () =>
        get().transfers.filter(t => t.status === 'ACEPTADO'),

      // ─── Acciones ─────────────────────────────────────────────────────────

      // 1. Cualquier usuario con acceso crea una solicitud
      createTransfer: ({ fromBranchId, toBranchId, category, items, notes }) => {
        const user = useAuthStore.getState().user;
        if (!user) return { ok: false, error: 'No autenticado' };
        if (!fromBranchId || !toBranchId) return { ok: false, error: 'Sedes requeridas' };
        if (!items?.length) return { ok: false, error: 'Sin ítems' };

        const transfer = {
          id:           `TRF-${Date.now()}`,
          status:       'SOLICITADO',
          fromBranchId,
          toBranchId,
          category,                // insumos | crudos | productos | fritos
          items: items.map(i => ({
            inventoryId: i.inventoryId,
            name:        i.name,
            unit:        i.unit,
            qtyRequested: i.qty,
            qtySent:     null,    // lo pone el que despacha
          })),
          requestedBy:  user.id,
          requestedByName: user.name,
          acceptedBy:   null,
          deliveredBy:  null,
          receivedBy:   null,
          createdAt:    Date.now(),
          acceptedAt:   null,
          sentAt:       null,
          receivedAt:   null,
          notes:        notes || '',
          rejectReason: null,
        };

        set(s => ({ transfers: [...s.transfers, transfer] }));
        syncTransfers(useTransferStore.getState().transfers);
        return { ok: true, transfer };
      },

      // 2. Sede origen acepta la solicitud
      acceptTransfer: (id) => {
        const user = useAuthStore.getState().user;
        set(s => ({
          transfers: s.transfers.map(t =>
            t.id === id ? {
              ...t,
              status:     'ACEPTADO',
              acceptedBy: user?.id,
              acceptedAt: Date.now(),
            } : t
          ),
        }));
        syncTransfers(useTransferStore.getState().transfers);
      },

      // 3. Dejador sale con el pedido — especifica cantidades reales → descuenta inventario origen
      markInTransit: (id, actualItems) => {
        const user = useAuthStore.getState().user;
        const transfer = get().transfers.find(t => t.id === id);
        if (!transfer) return { ok: false, error: 'Traslado no encontrado' };

        // Descontar inventario del origen
        const { updateInventoryItem, inventory } = useInventoryStore.getState();
        actualItems.forEach(({ inventoryId, qtySent }) => {
          const item = inventory.find(i => i.id === inventoryId);
          if (item && qtySent > 0) {
            updateInventoryItem(inventoryId, { qty: Math.max(0, (item.qty || 0) - qtySent) });
          }
        });

        set(s => ({
          transfers: s.transfers.map(t =>
            t.id === id ? {
              ...t,
              status:      'EN_CAMINO',
              deliveredBy: user?.id,
              deliveredByName: user?.name,
              sentAt:      Date.now(),
              items:       t.items.map(item => {
                const actual = actualItems.find(a => a.inventoryId === item.inventoryId);
                return actual ? { ...item, qtySent: actual.qtySent } : item;
              }),
            } : t
          ),
        }));
        syncTransfers(useTransferStore.getState().transfers);
        return { ok: true };
      },

      // 4. Sede destino confirma recepción → suma inventario destino
      confirmReceipt: (id) => {
        const user = useAuthStore.getState().user;
        const transfer = get().transfers.find(t => t.id === id);
        if (!transfer) return { ok: false, error: 'Traslado no encontrado' };

        // Sumar inventario en destino
        // Busca el ítem por nombre si no existe en el inventario destino
        const { updateInventoryItem, addInventoryItem, inventory } = useInventoryStore.getState();
        transfer.items.forEach(({ inventoryId, name, unit, qtySent }) => {
          if (!qtySent) return;
          const existing = inventory.find(i => i.id === inventoryId);
          if (existing) {
            updateInventoryItem(inventoryId, { qty: (existing.qty || 0) + qtySent });
          } else {
            // Si no existe el item en este branch, lo crea
            addInventoryItem?.({
              id:          inventoryId,
              name,
              unit,
              qty:         qtySent,
              warehouseId: 'BOD-001',
              type:        'PRODUCTO',
              alert:       0,
            });
          }
        });

        set(s => ({
          transfers: s.transfers.map(t =>
            t.id === id ? {
              ...t,
              status:     'RECIBIDO',
              receivedBy: user?.id,
              receivedByName: user?.name,
              receivedAt: Date.now(),
            } : t
          ),
        }));
        syncTransfers(useTransferStore.getState().transfers);
        return { ok: true };
      },

      // Rechazar (sede origen o admin)
      rejectTransfer: (id, reason) => {
        set(s => ({
          transfers: s.transfers.map(t =>
            t.id === id ? { ...t, status: 'RECHAZADO', rejectReason: reason || '' } : t
          ),
        }));
        syncTransfers(useTransferStore.getState().transfers);
      },

      // Cancelar (quien solicitó o admin)
      cancelTransfer: (id) => {
        set(s => ({
          transfers: s.transfers.map(t =>
            t.id === id && ['SOLICITADO', 'ACEPTADO'].includes(t.status)
              ? { ...t, status: 'CANCELADO' }
              : t
          ),
        }));
        syncTransfers(useTransferStore.getState().transfers);
      },

      // Carga remota desde Supabase
      loadFromRemote: (remoteTransfers) => {
        if (Array.isArray(remoteTransfers) && remoteTransfers.length > 0) {
          set({ transfers: remoteTransfers });
        }
      },
    }),
    {
      name: 'frita-mejor-transfers',
      version: 1,
    }
  )
);
