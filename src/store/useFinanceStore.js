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

      // ── Fetch inicial desde Supabase (datos compartidos de todos los usuarios) ──
      fetchFinances: async () => {
        set({ isLoading: true });
        try {
          const [incomesRes, expensesRes] = await Promise.all([
            supabase.from('incomes').select('*').order('created_at', { ascending: false }),
            supabase.from('expenses').select('*').order('created_at', { ascending: false }),
          ]);

          // Actualizar siempre que no haya error (aunque el array esté vacío)
          if (!incomesRes.error) {
            set({ incomes: incomesRes.data || [] });
          }
          if (!expensesRes.error) {
            set({ expenses: expensesRes.data || [] });
          }
        } catch (error) {
          console.warn('[FinanceStore] fetchFinances falló — usando datos locales:', error.message);
        } finally {
          set({ isLoading: false });
        }
      },

      // ── Realtime: escuchar cambios en incomes de todos los usuarios ────────────
      subscribeToIncomes: () => {
        const channel = supabase
          .channel('incomes-realtime')
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'incomes' },
            (payload) => {
              const newRow = payload.new;
              set((state) => {
                // Reemplazar optimistic local o agregar nuevo
                const exists = state.incomes.some((i) => i.id === newRow.id);
                if (exists) {
                  return { incomes: state.incomes.map((i) => i.id === newRow.id ? newRow : i) };
                }
                // También reemplazar el entry local temporal (id: local-...)
                const withoutOptimistic = state.incomes.filter(
                  (i) => !String(i.id).startsWith('local-')
                    || i.ubicacion !== newRow.ubicacion
                    || i.created_at?.slice(0, 16) !== newRow.created_at?.slice(0, 16)
                );
                return { incomes: [newRow, ...withoutOptimistic] };
              });
            }
          )
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'incomes' },
            (payload) => {
              set((state) => ({
                incomes: state.incomes.map((i) => i.id === payload.new.id ? payload.new : i),
              }));
            }
          )
          .on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'incomes' },
            (payload) => {
              set((state) => ({
                incomes: state.incomes.filter((i) => i.id !== payload.old.id),
              }));
            }
          )
          .subscribe();

        // Devolver función de cleanup para useEffect
        return () => supabase.removeChannel(channel);
      },

      addIncome: async (incomeData) => {
        const newIncome = {
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...incomeData,
        };
        // Actualización optimista local
        set((state) => ({ incomes: [newIncome, ...state.incomes] }));

        // Persistir en Supabase — el Realtime propagará el INSERT a los demás
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
          id: `local-${Date.now()}-${idx}`,
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
          id: `local-${Date.now()}`,
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
      partialize: (state) => ({
        incomes:  state.incomes,
        expenses: state.expenses,
      }),
    }
  )
);
