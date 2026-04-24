import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

// =============================================================================
// BASE DE USUARIOS LOCAL (mientras no está conectado a Supabase)
// El Admin puede agregar/editar/eliminar estos usuarios desde el panel.
// La contraseña está en texto plano solo para demo — en producción usa hashing.
// =============================================================================

const DEFAULT_USERS = [
  {
    id: 'USR-001',
    name: 'Administrador',
    email: 'admin@fritamejor.com',
    password: '1',
    role: 'ADMIN',
    active: true,
    access: ['produccion', 'bodega', 'admin', 'pos', 'vendedor-setup', 'dejador', 'tracking', 'cierres'],
  },
  {
    id: 'USR-002',
    name: 'Operario',
    email: 'operario@fritamejor.com',
    password: '2',
    role: 'OPERARIO',
    active: true,
    access: ['produccion'],
  },
  {
    id: 'USR-003',
    name: 'Bodeguero',
    email: 'bodega@fritamejor.com',
    password: '3',
    role: 'BODEGUERO',
    active: true,
    access: ['bodega'],
  },
  {
    id: 'USR-004',
    name: 'Cajero Principal',
    email: 'caja@fritamejor.com',
    password: '4',
    role: 'CAJERO',
    active: true,
    access: ['pos'],
  },
  {
    id: 'USR-005',
    name: 'Vendedor Móvil',
    email: 'vendedor@fritamejor.com',
    password: '5',
    role: 'VENDEDOR',
    active: true,
    access: ['vendedor-setup', 'vendedor'],
  },
  {
    id: 'USR-006',
    name: 'Dejador Logística',
    email: 'dejador@fritamejor.com',
    password: '6',
    role: 'DEJADOR',
    active: true,
    access: ['dejador', 'tracking'],
  },
  {
    id: 'USR-007',
    name: 'Ingresos',
    email: 'ingresos@fritamejor.com',
    password: '7',
    role: 'FINANZAS',
    active: true,
    access: ['finanzas-ingresos'],
  },
  {
    id: 'USR-008',
    name: 'Gastos',
    email: 'gastos@fritamejor.com',
    password: '8',
    role: 'FINANZAS',
    active: true,
    access: ['finanzas-gastos'],
  },
  {
    id: 'USR-009',
    name: 'Operario Fritado',
    email: 'fritado@fritamejor.com',
    password: '9',
    role: 'FRITADOR',
    active: true,
    access: ['fritado'],
  },
];

// Acceso de ruta por rol (para guardia de rutas)
export const ROLE_ACCESS = {
  ADMIN:     ['produccion', 'bodega', 'admin', 'pos', 'vendedor-setup', 'vendedor', 'dejador', 'tracking', 'finanzas-ingresos', 'finanzas-gastos', 'finanzas-nomina', 'fritado', 'cierres'],
  OPERARIO:  ['produccion'],
  FRITADOR:  ['fritado'],
  BODEGUERO: ['bodega'],
  CAJERO:    ['pos'],
  VENDEDOR:  ['vendedor-setup', 'vendedor'],
  DEJADOR:   ['dejador', 'tracking'],
  // FINANZAS por defecto tiene ambos; el admin puede personalizar cuál de los tres
  FINANZAS:  ['finanzas-ingresos', 'finanzas-gastos', 'finanzas-nomina'],
};

// =============================================================================
// ZUSTAND STORE CON PERSISTENCIA (localStorage)
// La sesión se guarda automáticamente y sobrevive a recargas de página.
// Solo se borra cuando el usuario cierra sesión explícitamente.
// =============================================================================

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ─── Estado ─────────────────────────────────────────────────
      user:    null, // usuario autenticado actual
      loading: false,
      error:   null,
      users:   DEFAULT_USERS, // todos los usuarios del sistema

      // ─── Login solo por contraseña ────────────────────────────────
      signIn: (password) => {
        set({ loading: true, error: null });

        const users = get().users;
        const found = users.find((u) => u.password === password);

        if (!found) {
          set({ loading: false, error: 'Contraseña incorrecta.' });
          return { ok: false };
        }

        if (!found.active) {
          set({ loading: false, error: 'Esta cuenta está desactivada. Contacta al administrador.' });
          return { ok: false };
        }

        set({ user: found, loading: false, error: null });
        return { ok: true, user: found };
      },


      // ─── Cerrar sesión ───────────────────────────────────────────
      signOut: () => {
        set({ user: null, error: null });
      },

      // ─── Limpiar error ───────────────────────────────────────────
      clearError: () => set({ error: null }),

      // ─── CRUD de usuarios (solo Admin) ───────────────────────────
      addUser: (userData) => {
        const { users } = get();
        // Check if another user already has this password
        const hasDuplicatePassword = users.some(u => u.password === userData.password);
        if (hasDuplicatePassword) {
            return { ok: false, error: 'Esta contraseña ya está en uso por otro usuario. Elige una diferente.' };
        }

        const newUser = {
          ...userData,
          id: `USR-${Date.now()}`,
          active: true,
          access: (userData.access && userData.access.length > 0)
            ? userData.access
            : (ROLE_ACCESS[userData.role] || []),
        };
        set((state) => ({ users: [...state.users, newUser] }));
        // Sincronizar con Supabase para que todos los dispositivos lo reciban
        const updatedUsers = get().users;
        markLocalWrite('users');
        push('users', updatedUsers).catch(err => console.warn('[Sync] users', err.message));
        return { ok: true };
      },

      updateUser: (id, updates) => {
        const { users } = get();
        
        // If password is provided in updates, check for duplicates (excluding the current user being edited)
        if (updates.password) {
          const hasDuplicatePassword = users.some(u => u.id !== id && u.password === updates.password);
          if (hasDuplicatePassword) {
              return { ok: false, error: 'Esta contraseña ya está en uso por otro usuario. Elige una diferente.' };
          }
        }

        set((state) => {
          const updatedUsers = state.users.map((u) => {
            if (u.id !== id) return u;
            const updated = { ...u, ...updates };
            if (updates.role && updates.role !== u.role && !updates.access) {
              updated.access = ROLE_ACCESS[updates.role] ?? u.access;
            }
            return updated;
          });

          const updatedSelf = state.user?.id === id
            ? updatedUsers.find((u) => u.id === id)
            : state.user;

          return { users: updatedUsers, user: updatedSelf };
        });
        // Sincronizar con Supabase
        const updatedUsers = get().users;
        markLocalWrite('users');
        push('users', updatedUsers).catch(err => console.warn('[Sync] users', err.message));
        return { ok: true };
      },

      deleteUser: (id) => {
        const current = get().user;
        if (current?.id === id) return { ok: false, error: 'No puedes eliminar tu propio usuario.' };
        set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
        // Sincronizar con Supabase
        const updatedUsers = get().users;
        markLocalWrite('users');
        push('users', updatedUsers).catch(err => console.warn('[Sync] users', err.message));
        return { ok: true };
      },

      // ─── Presets de cantidad por usuario ──────────────
      updateUserPresets: (id, presets) => {
        set((state) => {
          const updatedUsers = state.users.map((u) =>
            u.id === id ? { ...u, productPresets: presets } : u
          );
          const updatedSelf = state.user?.id === id
            ? { ...state.user, productPresets: presets }
            : state.user;
          return { users: updatedUsers, user: updatedSelf };
        });
        // Persistir en Supabase para que sobreviva resyncs y funcione en otros dispositivos
        const updatedUsers = get().users;
        markLocalWrite('users');
        push('users', updatedUsers).catch(err => console.warn('[Sync] users presets', err.message));
      },

      toggleUserActive: (id) => {
        const current = get().user;
        if (current?.id === id) return;
        set((state) => ({
          users: state.users.map((u) => u.id === id ? { ...u, active: !u.active } : u),
        }));
        // Sincronizar con Supabase
        const updatedUsers = get().users;
        markLocalWrite('users');
        push('users', updatedUsers).catch(err => console.warn('[Sync] users', err.message));
      },
    }),
    {
      name: 'frita-mejor-auth-v2',
      version: 13, // v13: finanzas-nomina agregado a ADMIN y FINANZAS
      // Solo persistir estos campos (no todo el estado)
      partialize: (state) => ({
        user:  state.user,
        users: state.users,
      }),
      // Migración: asegurar módulos nuevos en access[]
      migrate: (persisted, fromVersion) => {
        const state = persisted;

        // v11: 'cierres' para ADMIN
        if (fromVersion < 11 && state.users) {
          state.users = state.users.map((u) => {
            if (u.role === 'ADMIN' && !u.access?.includes('cierres')) {
              return { ...u, access: [...(u.access || []), 'cierres'] };
            }
            return u;
          });
          if (state.user?.role === 'ADMIN' && !state.user?.access?.includes('cierres')) {
            state.user = { ...state.user, access: [...(state.user.access || []), 'cierres'] };
          }
        }

        // v12: 'tracking' para ADMIN y DEJADOR
        if (fromVersion < 12 && state.users) {
          state.users = state.users.map((u) => {
            const needsTracking =
              (u.role === 'ADMIN' || u.role === 'DEJADOR') && !u.access?.includes('tracking');
            return needsTracking
              ? { ...u, access: [...(u.access || []), 'tracking'] }
              : u;
          });
          if (state.user && (state.user.role === 'ADMIN' || state.user.role === 'DEJADOR')
            && !state.user.access?.includes('tracking')) {
            state.user = { ...state.user, access: [...(state.user.access || []), 'tracking'] };
          }
        }

        // v13: 'finanzas-nomina' para ADMIN
        if (fromVersion < 13 && state.users) {
          state.users = state.users.map((u) => {
            if (u.role === 'ADMIN' && !u.access?.includes('finanzas-nomina')) {
              return { ...u, access: [...(u.access || []), 'finanzas-nomina'] };
            }
            return u;
          });
          if (state.user?.role === 'ADMIN' && !state.user?.access?.includes('finanzas-nomina')) {
            state.user = { ...state.user, access: [...(state.user.access || []), 'finanzas-nomina'] };
          }
        }

        return state;
      },
    }
  )
);
