import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

// =============================================================================
// BRANCH STORE — Gestión de Sedes (Multisede)
// Llave de sync: 'branches' (GLOBAL — todos los dispositivos la comparten)
// =============================================================================

// Tipos de sede permitidos
export const BRANCH_TYPES = {
  pos:         { label: 'Punto de Venta',  icon: '🏪' },
  fabricacion: { label: 'Fabricación',     icon: '🏭' },
  bodega:      { label: 'Bodega Central',  icon: '📦' },
};

// Sede Principal por defecto — representa la operación actual antes de multisede.
// Todos los datos históricos quedan asociados a este branchId.
const DEFAULT_BRANCHES = [
  {
    id: 'BRANCH-001',
    name: 'Sede Principal',
    type: 'pos',
    active: true,
    settings: {
      // Configuración del ticket de impresión para esta sede
      businessName: 'Frita Mejor',
      nit: '900.000.000-1',
      phone: '300 123 4567',
      address: 'Cali, Colombia',
      printerName: 'POS-58',
      paymentMethods: ['EFECTIVO', 'TARJETA', 'NEQUI', 'BANCOLOMBIA'],
      // Tipos de traslado habilitados para esta sede
      allowedTransferTypes: ['fritos', 'crudos', 'insumos', 'productos'],
    },
  },
];

function syncBranches(branches) {
  markLocalWrite('branches');
  push('branches', branches).catch(err =>
    console.warn('[Sync] branches:', err.message)
  );
}

export const useBranchStore = create(
  persist(
    (set, get) => ({
      branches: DEFAULT_BRANCHES,

      // ─── Getters ───────────────────────────────────────────────────────────

      getBranchById: (id) =>
        get().branches.find(b => b.id === id) || null,

      getActiveBranches: () =>
        get().branches.filter(b => b.active !== false),

      getBranchesByType: (type) =>
        get().branches.filter(b => b.type === type && b.active !== false),

      getBranchSettings: (branchId) => {
        const branch = get().branches.find(b => b.id === branchId);
        return branch?.settings || DEFAULT_BRANCHES[0].settings;
      },

      // ─── CRUD (solo Admin) ─────────────────────────────────────────────────

      addBranch: (branchData) => {
        const newBranch = {
          ...branchData,
          id: `BRANCH-${Date.now()}`,
          active: true,
          settings: {
            businessName: branchData.name || 'Nueva Sede',
            nit: '',
            phone: '',
            address: '',
            printerName: 'POS-58',
            paymentMethods: ['EFECTIVO', 'NEQUI'],
            allowedTransferTypes: ['fritos', 'crudos', 'insumos', 'productos'],
            ...branchData.settings,
          },
        };
        set(s => ({ branches: [...s.branches, newBranch] }));
        syncBranches(useBranchStore.getState().branches);
        return newBranch;
      },

      updateBranch: (id, updates) => {
        set(s => ({
          branches: s.branches.map(b => b.id === id ? { ...b, ...updates } : b),
        }));
        syncBranches(useBranchStore.getState().branches);
      },

      updateBranchSettings: (id, settingsUpdates) => {
        set(s => ({
          branches: s.branches.map(b =>
            b.id === id
              ? { ...b, settings: { ...b.settings, ...settingsUpdates } }
              : b
          ),
        }));
        syncBranches(useBranchStore.getState().branches);
      },

      // No se elimina una sede, solo se desactiva para no perder datos históricos
      deactivateBranch: (id) => {
        if (id === 'BRANCH-001') {
          console.warn('[BranchStore] No se puede desactivar la Sede Principal.');
          return { ok: false, error: 'No puedes desactivar la Sede Principal.' };
        }
        set(s => ({
          branches: s.branches.map(b =>
            b.id === id ? { ...b, active: false } : b
          ),
        }));
        syncBranches(useBranchStore.getState().branches);
        return { ok: true };
      },

      reactivateBranch: (id) => {
        set(s => ({
          branches: s.branches.map(b =>
            b.id === id ? { ...b, active: true } : b
          ),
        }));
        syncBranches(useBranchStore.getState().branches);
      },

      // ─── Carga remota ──────────────────────────────────────────────────────
      loadFromRemote: (remoteBranches) => {
        if (Array.isArray(remoteBranches) && remoteBranches.length > 0) {
          // Garantizar que BRANCH-001 siempre exista
          const hasPrincipal = remoteBranches.some(b => b.id === 'BRANCH-001');
          const merged = hasPrincipal
            ? remoteBranches
            : [DEFAULT_BRANCHES[0], ...remoteBranches];
          set({ branches: merged });
        }
      },
    }),
    {
      name: 'frita-mejor-branches',
      version: 1,
    }
  )
);
