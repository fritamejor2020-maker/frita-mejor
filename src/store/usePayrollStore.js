import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { useAuthStore } from './useAuthStore';

function syncKey(key, value) {
  const user = useAuthStore.getState().user;
  const branchId = user?.branchId ?? null;
  markLocalWrite(key, branchId);
  push(key, value, branchId).catch(err => console.warn('[Payroll Sync]', key, err.message));
}

/**
 * Store de Nómina — Offline-first (Zustand persist + Supabase app_state)
 *
 * Estado:
 *   payrollEmployees  — lista de empleados fijos reutilizables entre períodos
 *   payrollRecords    — historial de registros de nómina guardados
 *
 * Tipos de pago por empleado:
 *   nomina, extras, vacaciones, liquidacion
 */
export const usePayrollStore = create(
  persist(
    (set, get) => ({

      // ── Lista de empleados fijos ──────────────────────────────────────────────
      // [{ id: string, name: string, documentId: string, department: string, hourlyRate: number, baseSalary: number, biometricUserId: string, active: boolean, branchId: string }]
      payrollEmployees: [],

      addEmployee: (empData) => {
        const nameTrimmed = typeof empData === 'string' ? empData.trim() : empData.name?.trim();
        if (!nameTrimmed) return;
        const branchId = typeof empData === 'string' 
          ? (useAuthStore.getState().user?.branchId ?? null)
          : (empData.branchId || useAuthStore.getState().user?.branchId || null);

        const newEmp = typeof empData === 'string' 
          ? {
              id: `EMP-${Date.now()}`,
              name: nameTrimmed,
              documentId: '',
              department: 'Otros',
              hourlyRate: 0,
              baseSalary: 0,
              biometricUserId: '',
              active: true,
              branchId
            }
          : {
              id: `EMP-${Date.now()}`,
              name: nameTrimmed,
              documentId: empData.documentId?.trim() || '',
              department: empData.department || 'Otros',
              hourlyRate: Number(empData.hourlyRate) || 0,
              baseSalary: Number(empData.baseSalary) || 0,
              biometricUserId: empData.biometricUserId?.trim() || '',
              active: empData.active !== false,
              branchId
            };

        const updated = [...(get().payrollEmployees || []), newEmp];
        set({ payrollEmployees: updated });
        syncKey('payrollEmployees', updated);
      },

      updateEmployee: (id, updates) => {
        const updated = (get().payrollEmployees || []).map(e => {
          if (e.id !== id) return e;
          return {
            ...e,
            ...updates,
            name: updates.name ? updates.name.trim() : e.name,
            documentId: updates.documentId !== undefined ? updates.documentId.trim() : e.documentId,
            hourlyRate: updates.hourlyRate !== undefined ? Number(updates.hourlyRate) : e.hourlyRate,
            baseSalary: updates.baseSalary !== undefined ? Number(updates.baseSalary) : e.baseSalary,
          };
        });
        set({ payrollEmployees: updated });
        syncKey('payrollEmployees', updated);
      },

      removeEmployee: (id) => {
        const updated = (get().payrollEmployees || []).filter(e => e.id !== id);
        set({ payrollEmployees: updated });
        syncKey('payrollEmployees', updated);
      },

      renameEmployee: (id, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        get().updateEmployee(id, { name: trimmed });
      },

      // ── Registros de nómina ───────────────────────────────────────────────────
      // [{
      //   id: string,
      //   periodo: string,           // 'Abril 2026'
      //   savedAt: string,           // ISO timestamp
      //   creadoPor: string,
      //   filas: [{
      //     empleadoId: string,
      //     empleadoNombre: string,
      //     nomina: number,
      //     extras: number,
      //     vacaciones: number,
      //     liquidacion: number,
      //     observacion: string,
      //   }]
      // }]
      payrollRecords: [],

      /**
       * Guarda (o reemplaza) la nómina de un período.
       * Si ya existe un registro para ese período, lo sobreescribe.
       */
      savePayroll: (periodo, filas, creadoPor = '') => {
        const branchId = useAuthStore.getState().user?.branchId ?? null;
        const existing = get().payrollRecords.find(r => r.periodo === periodo
          && (!r.branchId || !branchId || r.branchId === branchId));
        const newRecord = {
          id: existing?.id || `PAY-${Date.now()}`,
          periodo,
          branchId,  // BUG-03 FIX: associate record with branch
          savedAt: new Date().toISOString(),
          creadoPor,
          filas: filas.map((f, idx) => ({
            id: f.id || `FILA-${Date.now()}-${idx}`,
            ...f,
            nomina:      Number(f.nomina)      || 0,
            extras:      Number(f.extras)      || 0,
            vacaciones:  Number(f.vacaciones)  || 0,
            liquidacion: Number(f.liquidacion) || 0,
          })),
        };
        const updated = existing
          ? get().payrollRecords.map(r => r.id === existing.id ? newRecord : r)
          : [newRecord, ...get().payrollRecords];
        set({ payrollRecords: updated });
        syncKey('payrollRecords', updated);
      },

      deletePayroll: (id) => {
        const updated = get().payrollRecords.filter(r => r.id !== id);
        set({ payrollRecords: updated });
        syncKey('payrollRecords', updated);
      },

      // Alias para el admin (mismo comportamiento)
      deletePayrollRecord: (id) => {
        const updated = get().payrollRecords.filter(r => r.id !== id);
        set({ payrollRecords: updated });
        syncKey('payrollRecords', updated);
      },

      /**
       * Edita campos de una fila individual dentro de un registro ya guardado.
       * Permite al admin corregir valores sin tener que re-guardar todo el período.
       */
      updatePayrollRow: (recordId, filaId, changes) => {
        const updated = get().payrollRecords.map(rec => {
          if (rec.id !== recordId) return rec;
          return {
            ...rec,
            filas: rec.filas.map((f, idx) => {
              const key = f.id || `idx-${idx}`;
              return key === filaId ? { ...f, ...changes } : f;
            }),
          };
        });
        set({ payrollRecords: updated });
        syncKey('payrollRecords', updated);
      },

      deletePayrollRow: (recordId, filaId) => {
        const updated = get().payrollRecords.map(rec => {
          if (rec.id !== recordId) return rec;
          return {
            ...rec,
            filas: rec.filas.filter((f, idx) => {
              const key = f.id || `idx-${idx}`;
              return key !== filaId;
            }),
          };
        });
        set({ payrollRecords: updated });
        syncKey('payrollRecords', updated);
      },

      /** Devuelve el registro del período dado, filtrado por sede. */
      getPayrollByPeriod: (periodo) => {
        const branchId = useAuthStore.getState().user?.branchId ?? null;
        return get().payrollRecords.find(r => r.periodo === periodo
          && (!r.branchId || !branchId || r.branchId === branchId)) || null;
      },
    }),
    {
      name: 'frita-mejor-payroll',
      version: 2, // v2: separación por sede
      migrate: (persisted) => {
        // Los datos migrados se re-sincronizarán a la llave de sede en el próximo push
        return persisted;
      },
      partialize: (state) => ({
        payrollEmployees: state.payrollEmployees,
        payrollRecords:   state.payrollRecords,
      }),
    }
  )
);
