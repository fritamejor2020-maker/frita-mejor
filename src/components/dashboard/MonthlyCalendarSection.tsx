import React, { useState, useMemo } from 'react';
import { useGoalStore } from '../../store/useGoalStore';

interface Props {
  incomes: any[];
  branchId: string | null;
  selectedMonth: number;  // 0-indexed
  selectedYear: number;
}

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const SHORT = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
  : `$${Math.round(n).toLocaleString('es-CO')}`;

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

export function MonthlyCalendarSection({ incomes, branchId, selectedMonth, selectedYear }: Props) {
  const today = new Date();
  const viewYear = selectedYear;
  const viewMonth = selectedMonth;

  const { monthlyGoals, setMonthlyGoal } = useGoalStore();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const yearMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthlyGoal = monthlyGoals[yearMonthKey] ?? 0;

  // Sales by day for this month/year
  const salesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    incomes.forEach((inc: any) => {
      const dateStr = (inc.fecha || inc.created_at || '').slice(0, 10);
      if (!dateStr) return;
      const d = new Date(dateStr + 'T12:00:00');
      if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) return;
      const branchOk = !branchId || !inc.branch_id || inc.branch_id === branchId;
      if (!branchOk) return;
      map[dateStr] = (map[dateStr] || 0) + (inc.total || 0);
    });
    return map;
  }, [incomes, viewYear, viewMonth, branchId]);

  // Build calendar grid (Monday-based)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday=0 offset
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Weekly totals
  const weeklyTotals = weeks.map(week =>
    week.reduce((s, d) => {
      if (!d) return s;
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return s + (salesByDay[key] || 0);
    }, 0)
  );

  const weeklyGoal = monthlyGoal > 0 ? Math.round(monthlyGoal / 4.33) : 0;
  const monthTotal = Object.values(salesByDay).reduce((a, b) => a + b, 0);
  const monthPct   = monthlyGoal > 0 ? Math.min(100, (monthTotal / monthlyGoal) * 100) : 0;

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-300 px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg font-black text-gray-900">{MONTHS_ES[viewMonth]} {viewYear}</h2>
        </div>
        {/* Monthly goal input */}
        <div className="flex items-center gap-2">
          {editingGoal ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="Meta mensual..."
                className="w-36 bg-white rounded-xl px-3 py-1.5 text-sm font-bold text-gray-800 outline-none shadow-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setMonthlyGoal(yearMonthKey, parseFloat(goalInput) || 0);
                    setEditingGoal(false);
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => { setMonthlyGoal(yearMonthKey, parseFloat(goalInput) || 0); setEditingGoal(false); }}
                className="bg-gray-900 text-amber-400 font-black text-xs px-3 py-1.5 rounded-xl"
              >✓</button>
              <button onClick={() => setEditingGoal(false)} className="text-gray-700 font-bold text-xs px-2 py-1.5 rounded-xl bg-white/40">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setGoalInput(monthlyGoal ? String(monthlyGoal) : ''); setEditingGoal(true); }}
              className="bg-white/30 hover:bg-white/50 text-gray-900 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
            >
              {monthlyGoal > 0 ? `🎯 Meta: ${SHORT(monthlyGoal)}` : '+ Fijar Meta'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Calendar Grid */}
        <div className="flex-1 p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-black text-gray-400 uppercase tracking-widest py-1">{d}</div>
            ))}
          </div>

          {/* Weeks */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayTotal = salesByDay[key] || 0;
                  const isToday = key === todayStr;
                  const isFuture = new Date(key + 'T12:00:00') > today;
                  return (
                    <div
                      key={di}
                      className={`rounded-lg sm:rounded-xl p-1 sm:p-1.5 min-h-[44px] sm:min-h-[56px] flex flex-col border transition-all ${
                        isToday ? 'border-amber-400 bg-amber-50' :
                        dayTotal > 0 ? 'border-gray-100 bg-green-50/30' :
                        isFuture ? 'border-gray-50 bg-gray-50/50' :
                        'border-gray-100 bg-white'
                      }`}
                    >
                      <span className={`text-[10px] sm:text-xs font-black ${
                        isToday ? 'text-amber-600' :
                        isFuture ? 'text-gray-300' : 'text-gray-500'
                      }`}>{day}</span>
                      {dayTotal > 0 && (
                        <span className="text-[9px] sm:text-[10px] font-black text-green-700 leading-tight mt-auto">
                          {SHORT(dayTotal)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly + Monthly Sidebar */}
        <div className="lg:w-56 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col">
          {/* Weekly breakdown */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Semanal</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 text-xs font-black text-gray-400 mb-2 px-1">
              <span>Venta</span>
              <span className="text-right">Meta</span>
            </div>
            <div className="space-y-2">
              {weeklyTotals.map((wTotal, i) => {
                const wGoal = weeklyGoal;
                const reached = wGoal > 0 && wTotal >= wGoal;
                return (
                  <div key={i} className={`rounded-xl p-2 ${reached ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className="grid grid-cols-2 gap-x-2">
                      <span className={`text-xs font-black ${wTotal > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {wTotal > 0 ? SHORT(wTotal) : '$—'}
                      </span>
                      <span className="text-xs font-bold text-gray-400 text-right">
                        {wGoal > 0 ? SHORT(wGoal) : '—'}
                      </span>
                    </div>
                    {wGoal > 0 && wTotal > 0 && (
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, (wTotal / wGoal) * 100)}%`,
                            background: reached ? '#10B981' : '#F59E0B',
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly achievement */}
          <div className={`p-4 border-t border-gray-100 ${monthPct >= 100 ? 'bg-green-50' : 'bg-amber-50'}`}>
            <p className="text-xs font-black text-amber-600 uppercase tracking-widest mb-2">Mes</p>
            <div className="grid grid-cols-2 gap-x-2 mb-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400">Venta</p>
                <p className="text-sm font-black text-gray-900">{SHORT(monthTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400">Meta</p>
                <p className="text-sm font-black text-gray-400">{monthlyGoal > 0 ? SHORT(monthlyGoal) : '—'}</p>
              </div>
            </div>
            {monthlyGoal > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 mb-1">Alcance de</p>
                <div className={`rounded-2xl py-2 text-center font-black text-lg ${
                  monthPct >= 100 ? 'bg-green-500 text-white' :
                  monthPct >= 70 ? 'bg-amber-400 text-gray-900' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {monthPct.toFixed(0)}%
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
