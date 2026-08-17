import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

interface GoalStoreState {
  // monthly goals: { 'YYYY-MM': amount }
  monthlyGoals: Record<string, number>;
  setMonthlyGoal: (yearMonth: string, amount: number) => void;
  getMonthlyGoal: (yearMonth: string) => number;
}

function syncMonthlyGoals(goals: Record<string, number>) {
  markLocalWrite('monthlyGoals');
  push('monthlyGoals', goals).catch(err => console.warn('[Sync] monthlyGoals:', err.message));
}

export const useGoalStore = create<GoalStoreState>()(
  persist(
    (set, get) => ({
      monthlyGoals: {},

      setMonthlyGoal: (yearMonth, amount) => {
        set(s => {
          const updated = { ...s.monthlyGoals, [yearMonth]: amount };
          syncMonthlyGoals(updated);
          return { monthlyGoals: updated };
        });
      },

      getMonthlyGoal: (yearMonth) => {
        return get().monthlyGoals[yearMonth] ?? 0;
      },
    }),
    { name: 'frita-dashboard-goals' }
  )
);
