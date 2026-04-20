import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export const useFinanceStore = create(
  persist(
    (set, get) => ({
      incomes:  [],
      expenses: [],
      isLoading: false,
      error: null,

      // Intenta traer datos de Supabase (si las tablas existen).
      // Si fallan, NO sobreescribe los datos locales para preservar el caché.
      fetchFinances: async () => {
        set({ isLoading: true });
        try {
          const [incomesRes, expensesRes] = await Promise.all([
            supabase.from('incomes').select('*').order('created_at', { ascending: false }),
            supabase.from('expenses').select('*').order('created_at', { ascending: false }),
          ]);

          // Solo actualizar si vinieron datos reales (no sobreescribir con array vacío por error de tabla)
          if (!incomesRes.error && incomesRes.data?.length > 0) {
            set({ incomes: incomesRes.data });
          }
          if (!expensesRes.error && expensesRes.data?.length > 0) {
            set({ expenses: expensesRes.data });
          }
        } catch (error) {
          console.warn('[FinanceStore] fetchFinances falló — usando datos locales:', error.message);
        } finally {
          set({ isLoading: false });
        }
      },

      addIncome: async (incomeData) => {
        const newIncome = {
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          ...incomeData,
        };
        // Actualización optimista
        set((state) => ({ incomes: [newIncome, ...state.incomes] }));

        // Intentar persistir en Supabase (silencioso si falla)
        try {
          const { data, error } = await supabase.from('incomes').insert([incomeData]).select();
          if (!error && data?.[0]) {
            set((state) => ({
              incomes: state.incomes.map((i) => (i.id === newIncome.id ? data[0] : i)),
            }));
          }
        } catch (e) {
          console.warn('[FinanceStore] addIncome Supabase falló — guardado localmente.');
        }
      },

      addMultipleIncomes: async (incomesArray) => {
        const timestamp = new Date().toISOString();
        const newIncomes = incomesArray.map((inc, idx) => ({
          id: `${Date.now()}-${idx}`,
          created_at: timestamp,
          ...inc,
        }));

        set((state) => ({ incomes: [...newIncomes, ...state.incomes] }));

        try {
          const { data, error } = await supabase.from('incomes').insert(incomesArray).select();
          if (!error && data?.length) {
            set((state) => {
              const updated = [...state.incomes];
              newIncomes.forEach((opt) => {
                const idx = updated.findIndex((i) => i.id === opt.id);
                const dbEntry = data.find(
                  (d) => d.ubicacion === opt.ubicacion && d.jornada === opt.jornada && d.tipo === opt.tipo
                );
                if (idx !== -1 && dbEntry) updated[idx] = dbEntry;
              });
              return { incomes: updated };
            });
          }
        } catch (e) {
          console.warn('[FinanceStore] addMultipleIncomes Supabase falló — guardado localmente.');
        }
      },

      addExpense: async (expenseData) => {
        const newExpense = {
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          ...expenseData,
        };
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));

        try {
          const { data, error } = await supabase.from('expenses').insert([expenseData]).select();
          if (!error && data?.[0]) {
            set((state) => ({
              expenses: state.expenses.map((e) => (e.id === newExpense.id ? data[0] : e)),
            }));
          }
        } catch (e) {
          console.warn('[FinanceStore] addExpense Supabase falló — guardado localmente.');
        }
      },
    }),
    {
      name: 'frita-mejor-finances',
      // Solo persistir los arrays de datos (no isLoading, error)
      partialize: (state) => ({
        incomes:  state.incomes,
        expenses: state.expenses,
      }),
    }
  )
);
