import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useDashboardFilters, Period } from '../../hooks/useDashboardFilters';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useBranchStore } from '../../store/useBranchStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MonthlyCalendarSection } from '../../components/dashboard/MonthlyCalendarSection';
import { IncomeSourceSection } from '../../components/dashboard/IncomeSourceSection';
import { AnnualTrendSection } from '../../components/dashboard/AnnualTrendSection';
import { GoalsConfigModal } from '../../components/dashboard/GoalsConfigModal';

// ── Utils ─────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const fmtShort = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n}`;

// ── Colores del sistema ───────────────────────────────────────────────────────
const C = {
  amber:  '#F59E0B',
  red:    '#EF4444',
  green:  '#10B981',
  blue:   '#3B82F6',
  indigo: '#6366F1',
  gray:   '#9CA3AF',
  purple: '#A855F7',
};

const EXPENSE_COLORS = [C.blue, C.amber, C.green, C.indigo, C.gray];
const EXPENSE_LABELS = ['Fijos', 'Variables', 'Insumos', 'Nómina', 'Sin clasificar'];

// ── Barra de filtros ──────────────────────────────────────────────────────────
const MONTHS_ES_SHORT = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function FilterBar() {
  const {
    period, setPeriod,
    branchId, setBranchId,
    customStart, customEnd, setCustomRange,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
  } = useDashboardFilters();
  const branches = useBranchStore(s => s.branches.filter(b => b.active !== false));

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'day',    label: 'Hoy'    },
    { key: 'week',   label: 'Semana' },
    { key: 'month',  label: 'Mes'    },
    { key: 'year',   label: 'Año'    },
    { key: 'custom', label: 'Rango'  },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Period pills */}
      <div className="flex items-center gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
              period === p.key
                ? 'bg-amber-400 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Month picker — visible when period = 'month' */}
      {period === 'month' && (
        <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-sm border border-amber-200">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
          >
            {MONTHS_ES_SHORT.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <span className="text-gray-300 font-bold">·</span>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
          >
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* Year picker — visible when period = 'year' */}
      {period === 'year' && (
        <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-sm border border-amber-200">
          <span className="text-xs font-black text-gray-400">AÑO:</span>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
          >
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-sm border border-amber-200">
          <input type="date" value={customStart} onChange={e => setCustomRange(e.target.value, customEnd)}
            className="text-sm font-bold text-gray-700 outline-none" />
          <span className="text-gray-400 font-bold">→</span>
          <input type="date" value={customEnd} onChange={e => setCustomRange(customStart, e.target.value)}
            className="text-sm font-bold text-gray-700 outline-none" />
        </div>
      )}

      {/* Sede filter */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Sede:</span>
        <select
          value={branchId || ''}
          onChange={e => setBranchId(e.target.value || null)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer"
        >
          <option value="">🏢 Todas</option>
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name || b.id}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Tarjeta KPI ───────────────────────────────────────────────────────────────
function KPICard({ title, value, sub, color, icon, bar }: any) {
  const isNegative = bar !== undefined && bar < 0;
  const barWidth = bar !== undefined ? Math.min(100, Math.abs(bar)) : 0;
  const barColor = isNegative ? C.red : bar < 15 ? C.red : bar < 30 ? C.amber : C.green;
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-sm border border-gray-100 flex flex-col gap-1 sm:gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">{title}</span>
        <span className="text-lg sm:text-2xl">{icon}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-black ${color || 'text-gray-900'} leading-none`}>{value}</p>
      {sub && <p className="text-[10px] sm:text-xs font-bold text-gray-400 leading-tight">{sub}</p>}
      {bar !== undefined && (
        <div className="relative h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barWidth}%`, background: barColor }}
          />
        </div>
      )}
    </div>
  );
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 min-w-[150px]">
      <p className="text-xs font-black text-gray-500 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-bold text-gray-600">{p.name}:</span>
          <span className="font-black text-gray-900">{fmtShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard Principal ───────────────────────────────────────────────────────
export function DashboardView() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { period, getRange } = useDashboardFilters();
  const [showGoals, setShowGoals] = useState(false);

  // Cargar finanzas al montar
  useEffect(() => {
    (useFinanceStore as any).getState().fetchFinances?.();
  }, []);

  const data = useDashboardData();
  const { branchId, selectedMonth, selectedYear } = useDashboardFilters();
  const incomes = (useFinanceStore as any)((s: any) => s.incomes) || [];
  const {
    totalSales, totalGastos,
    gastosFijos, gastosVariables, gastosInsumos, gastoNomina, gastosSinClasif,
    margenBruto, margenNeto, puntoEquilibrio,
    salesTrend, productionTrend,
    topSuppliers,
    totalFritado, totalMerma, pctMerma,
    payrollDetail,
    incomeCount, expenseCount,
  } = data;

  const expenseDonut = [
    { name: 'Fijos',          value: gastosFijos     },
    { name: 'Variables',      value: gastosVariables  },
    { name: 'Insumos',        value: gastosInsumos    },
    { name: 'Nómina',         value: gastoNomina      },
    { name: 'Sin clasificar', value: gastosSinClasif  },
  ].filter(d => d.value > 0);

  const { start, end } = getRange();
  const rangeLabel = `${start.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} → ${end.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  // Tabs sección inferior
  const [activeTab, setActiveTab] = useState<'suppliers' | 'production' | 'payroll'>('suppliers');

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg, #FFF8E7)' }}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-amber-400 shadow-sm px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-black text-gray-900 leading-none">📊 Dashboard</h1>
            <p className="text-amber-900/60 font-bold text-[10px] sm:text-xs mt-0.5">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGoals(true)}
              className="flex items-center gap-1.5 bg-gray-900/80 hover:bg-gray-900 text-amber-400 font-black text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-full shadow-sm transition-all active:scale-95"
            >
              🎯 <span className="hidden sm:inline">Metas</span>
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 bg-white/80 hover:bg-white text-gray-700 font-bold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-full shadow-sm transition-all active:scale-95"
            >
              ← <span className="hidden sm:inline">Admin</span>
            </button>
          </div>
        </div>
      </div>

      {showGoals && (
        <GoalsConfigModal year={selectedYear} onClose={() => setShowGoals(false)} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Filtros ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <FilterBar />
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-6">
          <KPICard
            title="Ventas Totales"
            value={fmtShort(totalSales)}
            sub={`${incomeCount} registros`}
            color="text-amber-600"
            icon="💰"
          />
          <KPICard
            title="Gastos Totales"
            value={fmtShort(totalGastos)}
            sub={`${expenseCount} transacciones`}
            color="text-red-500"
            icon="📉"
          />
          <KPICard
            title="Utilidades"
            value={(totalSales - totalGastos < 0 ? '-' : '') + fmtShort(Math.abs(totalSales - totalGastos))}
            sub={totalSales - totalGastos >= 0 ? '✅ Ganancia neta' : '⚠️ Pérdida'}
            color={totalSales - totalGastos >= 0 ? 'text-green-600' : 'text-red-500'}
            icon={totalSales - totalGastos >= 0 ? '🤑' : '🔻'}
          />
          <KPICard
            title="Margen Bruto"
            value={`${margenBruto.toFixed(1)}%`}
            sub={`Después de insumos (${fmtShort(gastosInsumos)})`}
            color={margenBruto < 0 ? 'text-red-500' : margenBruto < 20 ? 'text-red-500' : margenBruto < 40 ? 'text-amber-600' : 'text-green-600'}
            icon="📊"
            bar={margenBruto}
          />
          <KPICard
            title="Margen Neto"
            value={`${margenNeto.toFixed(1)}%`}
            sub={margenNeto < 0 ? '🔴 En pérdida' : `Pto. equilibrio: ${fmtShort(puntoEquilibrio)}`}
            color={margenNeto < 0 ? 'text-red-500' : margenNeto < 5 ? 'text-red-500' : margenNeto < 15 ? 'text-amber-600' : 'text-green-600'}
            icon="🎯"
            bar={margenNeto}
          />
        </div>

        {/* ── Gráfico Principal: Ventas vs Gastos ────────────────────────── */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-gray-900">Ventas vs. Gastos</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-gray-500">Ventas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-xs font-bold text-gray-500">Gastos</span>
              </div>
            </div>
          </div>
          {salesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.amber} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.amber} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.red} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={C.red} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fontWeight: 700, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ventas" name="Ventas" stroke={C.amber} strokeWidth={2.5} fill="url(#gradVentas)" dot={false} activeDot={{ r: 5, fill: C.amber }} />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke={C.red}   strokeWidth={2} strokeDasharray="5 3" fill="url(#gradGastos)" dot={false} activeDot={{ r: 5, fill: C.red }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="Sin datos en este período" />
          )}
        </div>

        {/* ── Calendario Mensual ─────────────────────────────────────────── */}
        <MonthlyCalendarSection
          incomes={incomes}
          branchId={branchId}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />

        {/* ── Tendencia Anual ────────────────────────────────────────────── */}
        <AnnualTrendSection
          incomes={incomes}
          branchId={branchId}
          viewYear={selectedYear}
        />

        {/* ── Distribución de Gastos + Desglose de Márgenes + Fuentes ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* Donut de gastos */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 mb-4">Distribución de Gastos</h2>
            {expenseDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={expenseDonut}
                    cx="50%" cy="50%"
                    innerRadius={65} outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {expenseDonut.map((_: any, i: number) => (
                      <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => fmt(val)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="Sin gastos clasificados" />
            )}
          </div>

          {/* Stacked bar de márgenes */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 mb-1">Desglose de Márgenes</h2>
            <p className="text-xs font-bold text-gray-400 mb-4">Composición sobre el total de ventas</p>
            {totalSales > 0 ? (
              <div className="space-y-4 mt-2">
                {[
                  { label: '🧂 Insumos',    val: gastosInsumos,   color: C.green,  pct: (gastosInsumos / totalSales) * 100 },
                  { label: '📌 Fijos',      val: gastosFijos,     color: C.blue,   pct: (gastosFijos / totalSales) * 100 },
                  { label: '📈 Variables',  val: gastosVariables, color: C.amber,  pct: (gastosVariables / totalSales) * 100 },
                  { label: '👥 Nómina',     val: gastoNomina,     color: C.indigo, pct: (gastoNomina / totalSales) * 100 },
                  { label: '💚 Ganancia',   val: Math.max(0, totalSales - totalGastos), color: C.green, pct: Math.max(0, margenNeto) },
                ].map((row, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-black text-gray-700">{row.label}</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-gray-900">{fmtShort(row.val)}</span>
                        <span className="text-xs font-bold text-gray-400 ml-2">{row.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, row.pct)}%`, background: row.color }}
                      />
                    </div>
                  </div>
                ))}
                {/* Separador margen neto */}
                <div className="pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm font-black text-gray-500">MARGEN NETO</span>
                  <span className={`text-lg font-black ${margenNeto < 5 ? 'text-red-500' : margenNeto < 15 ? 'text-amber-600' : 'text-green-600'}`}>
                    {margenNeto.toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState label="Sin ventas en este período" />
            )}
          </div>
        </div>

        {/* ── Ingresos por Fuente ─────────────────────────────────────────── */}
        <div className="mb-6">
          <IncomeSourceSection incomes={incomes} branchId={branchId} start={start} end={end} />
        </div>

        {/* ── Módulos Operativos (tabs) ───────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tab nav */}
          <div className="flex border-b border-gray-100">
            {[
              { key: 'suppliers',  label: '🏪 Proveedores' },
              { key: 'production', label: '🍳 Producción & Fritado' },
              { key: 'payroll',    label: '👥 Nómina' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`flex-1 py-3 px-2 text-sm font-black transition-all ${
                  activeTab === t.key
                    ? 'text-amber-600 border-b-2 border-amber-400 bg-amber-50/50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Proveedores */}
            {activeTab === 'suppliers' && (
              <div>
                <h3 className="text-base font-black text-gray-800 mb-4">Top Proveedores — Gasto en Período</h3>
                {topSuppliers.length > 0 ? (
                  <div className="space-y-3">
                    {topSuppliers.map((s: any, i: number) => {
                      const maxVal = topSuppliers[0]?.total || 1;
                      const pct = (s.total / maxVal) * 100;
                      return (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className="text-xs font-black text-gray-400 w-5 text-right">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-black text-gray-800">{s.name}</span>
                              <span className="text-sm font-black text-red-500">{fmtShort(s.total)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-300 transition-all duration-700"
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <EmptyState label="Sin gastos por proveedor en este período" />}
              </div>
            )}

            {/* Producción & Fritado */}
            {activeTab === 'production' && (
              <div>
                {/* KPI mini fila */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                    <p className="text-2xl font-black text-amber-600">{totalFritado.toFixed(0)}</p>
                    <p className="text-xs font-black text-amber-500 mt-1">UNIDADES FRITAS</p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                    <p className="text-2xl font-black text-red-500">{totalMerma.toFixed(0)}</p>
                    <p className="text-xs font-black text-red-400 mt-1">MERMA</p>
                  </div>
                  <div className={`${pctMerma > 10 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'} rounded-2xl p-4 text-center border`}>
                    <p className={`text-2xl font-black ${pctMerma > 10 ? 'text-red-500' : 'text-green-600'}`}>{pctMerma.toFixed(1)}%</p>
                    <p className={`text-xs font-black mt-1 ${pctMerma > 10 ? 'text-red-400' : 'text-green-500'}`}>% MERMA</p>
                  </div>
                </div>

                {productionTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={productionTrend} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="fritado" name="Fritado" fill={C.amber} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="merma"   name="Merma"   fill={C.red}   radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState label="Sin movimientos de fritado en este período" />}
              </div>
            )}

            {/* Nómina */}
            {activeTab === 'payroll' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black text-gray-800">Nómina del Período</h3>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5">
                    <span className="text-xs font-bold text-indigo-500">TOTAL </span>
                    <span className="text-base font-black text-indigo-700">{fmtShort(gastoNomina)}</span>
                  </div>
                </div>
                {payrollDetail.length > 0 ? (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {payrollDetail.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-2xl">
                        <div>
                          <p className="text-sm font-black text-gray-800">{p.name}</p>
                          <p className="text-xs font-bold text-gray-400">{p.periodo}</p>
                        </div>
                        <span className="text-sm font-black text-indigo-600">{fmt(p.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState label="Sin registros de nómina en este período" />}
              </div>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="h-12" />
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <span className="text-4xl">📭</span>
      <p className="text-sm font-bold text-gray-400">{label}</p>
    </div>
  );
}
