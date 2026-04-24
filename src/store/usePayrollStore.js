import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

function syncKey(key, value) {
  markLocalWrite(key);
  push(key, value).catch(err => console.warn('[Payroll Sync]', key, err.message));
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
      // [{ id: string, name: string }]
      payrollEmployees: [],

      addEmployee: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const already = get().payrollEmployees.find(
          e => e.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (already) return;
        const updated = [
          ...get().payrollEmployees,
          { id: `EMP-${Date.now()}`, name: trimmed },
        ];
        set({ payrollEmployees: updated });
        syncKey('payrollEmployees', updated);
      },

      removeEmployee: (id) => {
        const updated = get().payrollEmployees.filter(e => e.id !== id);
        set({ payrollEmployees: updated });
        syncKey('payrollEmployees', updated);
      },

      renameEmployee: (id, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        const updated = get().payrollEmployees.map(e =>
          e.id === id ? { ...e, name: trimmed } : e
        );
        set({ payrollEmployees: updated });
        syncKey('payrollEmployees', updated);
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
        const existing = get().payrollRecords.find(r => r.periodo === periodo);
        const newRecord = {
          id: existing?.id || `PAY-${Date.now()}`,
          periodo,
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
          ? get().payrollRecords.map(r => r.periodo === periodo ? newRecord : r)
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

      /** Devuelve el registro del período dado, o null si no existe. */
      getPayrollByPeriod: (periodo) => {
        return get().payrollRecords.find(r => r.periodo === periodo) || null;
      },
    }),
    {
      name: 'frita-mejor-payroll',
      partialize: (state) => ({
        payrollEmployees: state.payrollEmployees,
        payrollRecords:   state.payrollRecords,
      }),
    }
  )
);
