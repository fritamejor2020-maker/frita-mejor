import React, { useState, useEffect } from 'react';
import { useGoalStore } from '../../store/useGoalStore';

interface Props {
  year: number;
  onClose: () => void;
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const SHORT = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
  : String(Math.round(n));

const CURRENT_YEAR = new Date().getFullYear();

export function GoalsConfigModal({ year: initialYear, onClose }: Props) {
  const [year, setYear] = useState(initialYear);
  const { monthlyGoals, setMonthlyGoal } = useGoalStore();

  // Local draft state: 12 values for the year
  const [drafts, setDrafts] = useState<string[]>(() =>
    MONTHS.map((_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const existing = monthlyGoals[key];
      return existing ? String(existing) : '';
    })
  );

  // Re-sync if year changes
  useEffect(() => {
    setDrafts(MONTHS.map((_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const existing = monthlyGoals[key];
      return existing ? String(existing) : '';
    }));
  }, [year, monthlyGoals]);

  const totalAnual = drafts.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const handleSave = () => {
    drafts.forEach((v, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      setMonthlyGoal(key, parseFloat(v) || 0);
    });
    onClose();
  };

  // Copy a single value to all months
  const fillAll = (value: string) => {
    setDrafts(Array(12).fill(value));
  };

  // Copy month 0 value to all
  const [fillInput, setFillInput] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-amber-300 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">🎯</span>
              <span className="text-lg font-black text-gray-900">Metas</span>
              {/* Year selector */}
              <div className="flex items-center gap-1 bg-white/40 rounded-xl px-1 py-0.5">
                <button
                  onClick={() => setYear(y => y - 1)}
                  className="w-7 h-7 rounded-lg bg-white/50 hover:bg-white/80 font-black text-gray-800 flex items-center justify-center transition-all"
                >‹</button>
                <span className="font-black text-gray-900 text-base px-2 min-w-[46px] text-center">{year}</span>
                <button
                  onClick={() => setYear(y => y + 1)}
                  className="w-7 h-7 rounded-lg bg-white/50 hover:bg-white/80 font-black text-gray-800 flex items-center justify-center transition-all"
                >›</button>
              </div>
            </div>
            <p className="text-amber-800/70 font-bold text-xs">Configura la meta de ventas para cada mes</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/30 hover:bg-white/50 text-gray-900 font-black flex items-center justify-center transition-all"
          >✕</button>
        </div>

        {/* Fill all shortcut */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3 shrink-0">
          <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Aplicar igual a todos:</span>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="number"
              min="0"
              placeholder="Ej: 300000000"
              value={fillInput}
              onChange={e => setFillInput(e.target.value)}
              className="flex-1 min-w-0 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-amber-400"
            />
            <button
              onClick={() => { if (fillInput) fillAll(fillInput); }}
              className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-black text-sm px-4 py-2 rounded-xl active:scale-95 transition-all whitespace-nowrap"
            >
              Llenar todos
            </button>
          </div>
        </div>

        {/* Month grid */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {MONTHS.map((month, i) => {
              const key = `${year}-${String(i + 1).padStart(2, '0')}`;
              const saved = monthlyGoals[key] ?? 0;
              const draft = parseFloat(drafts[i]) || 0;
              const changed = draft !== saved;

              return (
                <div
                  key={i}
                  className={`rounded-2xl border-2 p-4 transition-all ${
                    changed && draft > 0
                      ? 'border-amber-300 bg-amber-50'
                      : draft > 0
                      ? 'border-gray-100 bg-white'
                      : 'border-dashed border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-gray-700">{month}</span>
                    {saved > 0 && !changed && (
                      <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        ✓ {SHORT(saved)}
                      </span>
                    )}
                    {changed && draft > 0 && (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        ● Editado
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={drafts[i]}
                      onChange={e => {
                        const updated = [...drafts];
                        updated[i] = e.target.value;
                        setDrafts(updated);
                      }}
                      className="w-full pl-7 pr-3 py-2.5 text-sm font-black text-gray-900 border-2 border-gray-200 rounded-xl outline-none focus:border-amber-400 bg-white transition-colors"
                    />
                  </div>
                  {draft > 0 && (
                    <p className="text-[10px] font-bold text-gray-400 mt-1 text-right">
                      {fmt(draft)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Total anual</p>
            <p className="text-base sm:text-lg font-black text-amber-600">{totalAnual > 0 ? fmt(totalAnual) : '—'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-500 text-gray-900 font-black text-sm shadow-sm active:scale-95 transition-all"
            >
              💾 Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
