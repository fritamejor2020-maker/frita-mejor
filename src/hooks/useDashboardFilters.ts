import { create } from 'zustand';

export type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

const now = new Date();

interface DashboardFiltersState {
  period: Period;
  branchId: string | null;
  customStart: string;
  customEnd: string;
  // Selectors for specific month/year navigation
  selectedMonth: number;  // 0-indexed (0=Jan)
  selectedYear: number;
  setPeriod: (p: Period) => void;
  setBranchId: (id: string | null) => void;
  setCustomRange: (start: string, end: string) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  getRange: () => { start: Date; end: Date };
}

export const useDashboardFilters = create<DashboardFiltersState>((set, get) => ({
  period: 'month',
  branchId: null,
  customStart: '',
  customEnd: '',
  selectedMonth: now.getMonth(),
  selectedYear: now.getFullYear(),

  setPeriod: (period) => set({ period }),
  setBranchId: (branchId) => set({ branchId }),
  setCustomRange: (customStart, customEnd) => set({ customStart, customEnd }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setSelectedYear: (selectedYear) => set({ selectedYear }),

  getRange: () => {
    const { period, customStart, customEnd, selectedMonth, selectedYear } = get();
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    switch (period) {
      case 'day': {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        return { start: s, end };
      }
      case 'week': {
        const s = new Date();
        const day = s.getDay();
        const diff = day === 0 ? 6 : day - 1;
        s.setDate(s.getDate() - diff);
        s.setHours(0, 0, 0, 0);
        return { start: s, end };
      }
      case 'month': {
        const s = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
        const e = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
        return { start: s, end: e };
      }
      case 'year': {
        const s = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
        const e = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        return { start: s, end: e };
      }
      case 'custom':
        if (customStart) {
          const s = new Date(customStart); s.setHours(0, 0, 0, 0);
          const e = customEnd ? (() => { const x = new Date(customEnd); x.setHours(23,59,59,999); return x; })() : end;
          return { start: s, end: e };
        }
        return { start: new Date(new Date().setHours(0,0,0,0)), end };
    }
  },
}));
