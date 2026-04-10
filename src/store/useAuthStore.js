import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    access: ['produccion', 'bodega', 'admin', 'pos', 'vendedor-setup', 'dejador', 'tracking'],
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
    access: ['dejador'],
  },
  {
    id: 'USR-007',
    name: 'Ingresos',
    email: 'ingresos@fritamejor.com',
    password: '7',
    role: 'FINANZAS',
    active: true,
    access: ['finanzas'],
  },
  {
    id: 'USR-008',
    name: 'Gastos',
    email: 'gastos@fritamejor.com',
    password: '8',
    role: 'FINANZAS',
    active: true,
    access: ['finanzas'],
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
  ADMIN:     ['produccion', 'bodega', 'admin', 'pos', 'vendedor-setup', 'vendedor', 'dejador', 'tracking', 'finanzas', 'fritado'],
  OPERARIO:  ['produccion'],
  FRITADOR:  ['fritado'],
  BODEGUERO: ['bodega'],
  CAJERO:    ['pos'],
  VENDEDOR:  ['vendedor-setup', 'vendedor'],
  DEJADOR:   ['dejador'],
  FINANZAS:  ['finanzas'],
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
          access: ROLE_ACCESS[userData.role] || [],
        };
        set((state) => ({ users: [...state.users, newUser] }));
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
            // Si cambia el rol, actualizar el acceso automáticamente
            if (updates.role && updates.role !== u.role) {
              updated.access = ROLE_ACCESS[updates.role] ?? u.access;
            }
            return updated;
          });

          // Si el admin está editando su propio perfil, actualizar la sesión activa también
          const updatedSelf = state.user?.id === id
            ? updatedUsers.find((u) => u.id === id)
            : state.user;

          return { users: updatedUsers, user: updatedSelf };
        });
      },

      deleteUser: (id) => {
        const current = get().user;
        if (current?.id === id) return { ok: false, error: 'No puedes eliminar tu propio usuario.' };
        set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
        return { ok: true };
      },

      // ─── Presets de cantidad por usuario (Vendedor) ──────────────
      updateUserPresets: (id, presets) => {
        set((state) => {
          const updatedUsers = state.users.map((u) =>
            u.id === id ? { ...u, restockPresets: presets } : u
          );
          const updatedSelf = state.user?.id === id
            ? { ...state.user, restockPresets: presets }
            : state.user;
          return { users: updatedUsers, user: updatedSelf };
        });
      },

      toggleUserActive: (id) => {
        const current = get().user;
        if (current?.id === id) return;
        set((state) => ({
          users: state.users.map((u) => u.id === id ? { ...u, active: !u.active } : u),
        }));
      },
    }),
    {
      name: 'frita-mejor-auth-v2', // clave en localStorage (v2: claves simples por rol)
      version: 8, // Incrementamos versión
      // Solo persistir estos campos (no todo el estado)
      partialize: (state) => ({
        user:  state.user,
        users: state.users,
      }),
    }
  )
);
