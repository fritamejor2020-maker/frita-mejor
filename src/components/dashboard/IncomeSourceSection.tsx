import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useInventoryStore } from '../../store/useInventoryStore';

interface Props {
  incomes: any[];
  branchId: string | null;
  start: Date;
  end: Date;
}

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const SHORT = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n}`;

// Categorize income by source: Local, Triciclos, Contratas, Otros
function categorizeSource(inc: any, vehicleNames: Set<string>): 'Local' | 'Triciclos' | 'Contratas' | 'Otros' {
  const ubicacion = (inc.ubicacion || '').trim().toLowerCase();
  const subtipo   = (inc.subtipo   || '').trim().toLowerCase();
  const fuente    = (inc.fuente    || '').trim().toLowerCase();

  if (fuente === 'contratas' || subtipo.includes('contrata')) return 'Contratas';
  if (ubicacion === 'local') return 'Local';
  // If ubicacion matches a known vehicle name
  if (vehicleNames.has(ubicacion)) return 'Triciclos';
  // Generic vehicle patterns T1, T2, Triciclo X, etc.
  if (/^t\d+$/.test(ubicacion) || ubicacion.startsWith('triciclo') || ubicacion.startsWith('moto')) return 'Triciclos';
  if (ubicacion === 'local' || ubicacion.includes('local')) return 'Local';
  // If has a vehicle-like ubicacion that's not local → Triciclos
  if (ubicacion && ubicacion !== '') return 'Triciclos';
  return 'Otros';
}

const SOURCE_CONFIG: Record<string, { color: string; emoji: string; label: string }> = {
  Local:     { color: '#F59E0B', emoji: '🏪', label: 'Local' },
  Triciclos: { color: '#EF4444', emoji: '🛺', label: 'Triciclos' },
  Contratas: { color: '#6366F1', emoji: '🤝', label: 'Contratas' },
  Otros:     { color: '#9CA3AF', emoji: '📦', label: 'Otros' },
};

export function IncomeSourceSection({ incomes, branchId, start, end }: Props) {
  const vehicles = (useInventoryStore as any).getState().vehicles || [];
  const vehicleNames = useMemo(() =>
    new Set(vehicles.map((v: any) => (v.name || '').trim().toLowerCase())),
    [vehicles]
  );

  const sourceData = useMemo(() => {
    const totals: Record<string, number> = { Local: 0, Triciclos: 0, Contratas: 0, Otros: 0 };

    incomes.forEach((inc: any) => {
      const dateStr = (inc.fecha || inc.created_at || '').slice(0, 10);
      if (!dateStr) return;
      const d = new Date(dateStr + 'T12:00:00');
      if (d < start || d > end) return;
      const branchOk = !branchId || !inc.branch_id || inc.branch_id === branchId;
      if (!branchOk) return;

      const cat = categorizeSource(inc, vehicleNames);
      totals[cat] = (totals[cat] || 0) + (inc.total || 0);
    });

    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        key,
        name: SOURCE_CONFIG[key].label,
        value,
        pct: grandTotal > 0 ? (value / grandTotal) * 100 : 0,
        color: SOURCE_CONFIG[key].color,
        emoji: SOURCE_CONFIG[key].emoji,
      }))
      .sort((a, b) => b.value - a.value);
  }, [incomes, branchId, start, end, vehicleNames]);

  const grandTotal = sourceData.reduce((s, d) => s + d.value, 0);

  // Custom label for pie
  const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, pct }: any) => {
    if (pct < 5) return null;
    const RADIAN = Math.PI / 180;
    const r = outerRadius + 16;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700 }}>
        {pct.toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-black text-gray-900 mb-4">📊 Ingresos por Fuente</h2>

      {sourceData.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut */}
          <div className="shrink-0 w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {sourceData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [COP(val), '']}
                  contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontWeight: 700, fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend + amounts */}
          <div className="flex-1 space-y-3 w-full">
            {sourceData.map((src) => (
              <div key={src.key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: src.color + '22' }}>
                  {src.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-black text-gray-800">{src.name}</span>
                    <span className="text-sm font-black text-gray-900">{SHORT(src.value)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${src.pct}%`, background: src.color }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 mt-0.5 text-right">{src.pct.toFixed(1)}%</p>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm font-black text-gray-500 uppercase tracking-wider">Total</span>
              <span className="text-lg font-black text-amber-600">{SHORT(grandTotal)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <span className="text-4xl">📭</span>
          <p className="text-sm font-bold text-gray-400">Sin ingresos en este período</p>
        </div>
      )}
    </div>
  );
}
