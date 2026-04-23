import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

// ── Sube una foto base64 a Supabase Storage y devuelve la URL pública ──────────
async function uploadPhoto(base64) {
  if (!base64) return null;
  try {
    // Convertir base64 a Blob
    const res  = await fetch(base64);
    const blob = await res.blob();
    const ext  = blob.type.includes('png') ? 'png' : 'jpg';
    const path = `incomes/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('income-photos')
      .upload(path, blob, { contentType: blob.type, upsert: false });

    if (error) {
      console.warn('[FinanceStore] uploadPhoto error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('income-photos').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn('[FinanceStore] uploadPhoto falló:', e.message);
    return null;
  }
}

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

        // Subir foto a Storage y obtener URL pública (visible en todos los dispositivos)
        try {
          const photoUrl = await uploadPhoto(incomeData.photoBase64);
          const { photoBase64: _pb, ...incomeForDB } = incomeData;
          const incomeWithPhoto = { ...incomeForDB, ...(photoUrl ? { photoUrl } : {}) };

          const { data, error } = await supabase.from('incomes').insert([incomeWithPhoto]).select();
          if (error) {
            console.warn('[FinanceStore] addIncome error Supabase:', error.message);
          } else if (data?.[0]) {
            // Mantener base64 local Y agregar la URL remota
            set((state) => ({
              incomes: state.incomes.map((i) =>
                i.id === newIncome.id
                  ? { ...data[0], photoBase64: incomeData.photoBase64, photoUrl }
                  : i
              ),
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
          // Subir todas las fotos a Storage en paralelo
          const photosUrls = await Promise.all(
            incomesArray.map((inc) => uploadPhoto(inc.photoBase64))
          );
          const incomesForDB = incomesArray.map(({ photoBase64: _p, ...rest }, i) => ({
            ...rest,
            ...(photosUrls[i] ? { photoUrl: photosUrls[i] } : {}),
          }));
          const { data, error } = await supabase.from('incomes').insert(incomesForDB).select();
          if (error) {
            console.warn('[FinanceStore] addMultipleIncomes error Supabase:', error.message);
          } else if (data?.length) {
            set((state) => {
              const updated = [...state.incomes];
              newIncomes.forEach((opt, idx) => {
                const i = updated.findIndex((x) => x.id === opt.id);
                const dbEntry = data.find(
                  (d) => d.ubicacion === opt.ubicacion && d.jornada === opt.jornada && d.tipo === opt.tipo
                );
                if (i !== -1 && dbEntry) {
                  updated[i] = { ...dbEntry, photoBase64: opt.photoBase64, photoUrl: photosUrls[idx] };
                }
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
