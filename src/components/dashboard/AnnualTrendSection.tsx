import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useGoalStore } from '../../store/useGoalStore';

interface Props {
  incomes: any[];
  branchId: string | null;
  viewYear: number;
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const SHORT = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n}`;

export function AnnualTrendSection({ incomes, branchId, viewYear }: Props) {
  const { monthlyGoals } = useGoalStore();

  const data = useMemo(() => {
    // Aggregate by month
    const byMonth: number[] = Array(12).fill(0);
    incomes.forEach((inc: any) => {
      const dateStr = (inc.fecha || inc.created_at || '').slice(0, 10);
      if (!dateStr) return;
      const d = new Date(dateStr + 'T12:00:00');
      if (d.getFullYear() !== viewYear) return;
      const branchOk = !branchId || !inc.branch_id || inc.branch_id === branchId;
      if (!branchOk) return;
      byMonth[d.getMonth()] += inc.total || 0;
    });

    return MONTHS_SHORT.map((label, i) => {
      const yearMonthKey = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
      const goal = monthlyGoals[yearMonthKey] ?? 0;
      return {
        label,
        ventas: byMonth[i],
        meta: goal,
        mes: i,
      };
    });
  }, [incomes, branchId, viewYear, monthlyGoals]);

  const hasGoals = data.some(d => d.meta > 0);
  const hasData  = data.some(d => d.ventas > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 min-w-[160px]">
        <p className="text-xs font-black text-gray-500 mb-2">{label} {viewYear}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="font-bold text-gray-600">{p.name}:</span>
            <span className="font-black text-gray-900">{SHORT(p.value)}</span>
          </div>
        ))}
        {payload.length === 2 && payload[1].value > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs font-black text-gray-400">
              Alcance: {((payload[0].value / payload[1].value) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-gray-900">📈 Ventas del Año {viewYear}</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs font-bold text-gray-500">Ventas</span>
          </div>
          {hasGoals && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 bg-amber-400 rounded" />
              <span className="text-xs font-bold text-gray-500">Meta</span>
            </div>
          )}
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fontWeight: 700, fill: '#9CA3AF' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={SHORT}
              tick={{ fontSize: 11, fontWeight: 700, fill: '#9CA3AF' }}
              axisLine={false} tickLine={false}
              width={62}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="ventas"
              name="Ventas"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
            {hasGoals && (
              <Line
                type="monotone"
                dataKey="meta"
                name="Meta"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <span className="text-4xl">📭</span>
          <p className="text-sm font-bold text-gray-400">Sin datos de ventas para {viewYear}</p>
        </div>
      )}

      {/* Month summary table */}
      {hasData && (
        <div className="mt-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {data.filter(d => d.ventas > 0).map((d) => (
              <div key={d.mes} className={`text-center px-3 py-2 rounded-xl min-w-[64px] border ${
                d.meta > 0 && d.ventas >= d.meta
                  ? 'bg-green-50 border-green-100'
                  : d.meta > 0
                  ? 'bg-amber-50/50 border-amber-100'
                  : 'bg-gray-50 border-gray-100'
              }`}>
                <p className="text-[10px] font-black text-gray-400 uppercase">{d.label}</p>
                <p className="text-xs font-black text-gray-800 mt-0.5">{SHORT(d.ventas)}</p>
                {d.meta > 0 && (
                  <p className={`text-[10px] font-bold mt-0.5 ${
                    d.ventas >= d.meta ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {((d.ventas / d.meta) * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
