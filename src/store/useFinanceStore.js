import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Default Income Hierarchy matching the provided image
const defaultIncomeHierarchy = {
  Local: {
    AM: ['6-10 am', '10-12 pm'],
    PM: ['12-2 pm', '2-4 pm', '4-7 pm', '7-9 pm']
  },
  Triciclo: {
    AM: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
    MD: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
    PM: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
  },
  Contratas: {
    AM: ['6-10 am', '10-12 pm'],
    PM: ['12-2 pm', '2-4 pm', '4-7 pm', '7-9 pm']
  },
  Venta: {
    Extra: ['Extra']
  }
};

export const useFinanceStore = create((set, get) => ({
  incomes: [],
  expenses: [],
  incomeHierarchy: defaultIncomeHierarchy,
  isLoading: false,
  error: null,

  fetchFinances: async () => {
    set({ isLoading: true });
    try {
      const [incomesRes, expensesRes] = await Promise.all([
        supabase.from('incomes').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false })
      ]);

      if (incomesRes.error) throw incomesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      set({ 
        incomes: incomesRes.data || [], 
        expenses: expensesRes.data || [],
        isLoading: false 
      });
    } catch (error) {
      console.error('Error fetching finances:', error);
      // Fallback for local dev if tables don't exist yet
      set({ error: error.message, isLoading: false });
    }
  },

  addIncome: async (incomeData) => {
    try {
      // Optistic UI update for local dev
      const newIncome = { id: Date.now().toString(), created_at: new Date().toISOString(), ...incomeData };
      set((state) => ({ incomes: [newIncome, ...state.incomes] }));

      // Try inserting to DB
      const { data, error } = await supabase.from('incomes').insert([incomeData]).select();
      if (!error && data) {
         set((state) => ({ incomes: state.incomes.map(i => i.id === newIncome.id ? data[0] : i) }));
      }
    } catch (error) {
      console.error("Error adding income", error);
    }
  },

  addMultipleIncomes: async (incomesArray) => {
    try {
      const timestamp = new Date().toISOString();
      const newIncomes = incomesArray.map((inc, index) => ({
        id: `${Date.now()}-${index}`,
        created_at: timestamp,
        ...inc
      }));

      // Optistic UI update for local dev
      set((state) => ({ incomes: [...newIncomes, ...state.incomes] }));

      // Try batch inserting to DB
      const { data, error } = await supabase.from('incomes').insert(incomesArray).select();
      
      if (!error && data) {
         // Replace optimistic entries with real DB entries
         // This is a naive replacement for demo purposes
         set((state) => {
           const currentIncomes = [...state.incomes];
           newIncomes.forEach(optInc => {
             const index = currentIncomes.findIndex(i => i.id === optInc.id);
             if (index !== -1) {
               // Assuming the order of returned data matches the inserted array
               const dbEntry = data.find(d => d.ubicacion === optInc.ubicacion && d.jornada === optInc.jornada && d.tipo === optInc.tipo);
               if (dbEntry) currentIncomes[index] = dbEntry;
             }
           });
           return { incomes: currentIncomes };
         });
      }
    } catch (error) {
      console.error("Error adding multiple incomes", error);
    }
  },

  addExpense: async (expenseData) => {
    try {
      // Optistic UI update for local dev
      const newExpense = { id: Date.now().toString(), created_at: new Date().toISOString(), ...expenseData };
      set((state) => ({ expenses: [newExpense, ...state.expenses] }));

      // Try inserting to DB
      const { data, error } = await supabase.from('expenses').insert([expenseData]).select();
      if (!error && data) {
         set((state) => ({ expenses: state.expenses.map(e => e.id === newExpense.id ? data[0] : e) }));
      }
    } catch (error) {
      console.error("Error adding expense", error);
    }
  }
}));
