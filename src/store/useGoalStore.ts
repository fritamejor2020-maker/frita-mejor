import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GoalStoreState {
  // monthly goals: { 'YYYY-MM': amount }
  monthlyGoals: Record<string, number>;
  setMonthlyGoal: (yearMonth: string, amount: number) => void;
  getMonthlyGoal: (yearMonth: string) => number;
}

export const useGoalStore = create<GoalStoreState>()(
  persist(
    (set, get) => ({
      monthlyGoals: {},

      setMonthlyGoal: (yearMonth, amount) => {
        set(s => ({ monthlyGoals: { ...s.monthlyGoals, [yearMonth]: amount } }));
      },

      getMonthlyGoal: (yearMonth) => {
        return get().monthlyGoals[yearMonth] ?? 0;
      },
    }),
    { name: 'frita-dashboard-goals' }
  )
);
