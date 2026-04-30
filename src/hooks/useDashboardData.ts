import { useMemo } from 'react';
import { useDashboardFilters } from './useDashboardFilters';
import { useFinanceStore } from '../store/useFinanceStore';
import { usePayrollStore } from '../store/usePayrollStore';
import { useInventoryStore } from '../store/useInventoryStore';

function inRange(dateStr: string, start: Date, end: Date) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

export function useDashboardData() {
  const { getRange, branchId } = useDashboardFilters();

  const incomes  = (useFinanceStore as any)((s: any) => s.incomes)  || [];
  const expenses = (useFinanceStore as any)((s: any) => s.expenses) || [];
  const payrollRecords = (usePayrollStore as any)((s: any) => s.payrollRecords) || [];
  const movements = (useInventoryStore as any)((s: any) => s.movements) || [];

  return useMemo(() => {
    const { start, end } = getRange();
    // ── Filtros de período ────────────────────────────────────────────────────
    const filterIncome = (i: any) => {
      const dateOk = inRange(i.fecha || i.created_at, start, end);
      const branchOk = !branchId || !i.branch_id || i.branch_id === branchId;
      return dateOk && branchOk;
    };
    const filterExpense = (e: any) => {
      const dateOk = inRange(e.fecha || e.created_at, start, end);
      const branchOk = !branchId || !e.branch_id || e.branch_id === branchId;
      return dateOk && branchOk;
    };
    const filterMovement = (m: any) => inRange(m.timestamp, start, end);

    // BUG-02 FIX: payroll filtered by branchId AND by period date
    const filterPayroll = (r: any) => {
      // Filter by branchId if present
      const branchOk = !branchId || !r.branchId || r.branchId === branchId;
      if (!branchOk) return false;
      // INC-03 FIX: try to parse the period string (e.g. "Abril 2026") as a date
      // for range filtering; fall back to savedAt
      const MONTHS_ES: Record<string, number> = {
        enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5,
        julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11,
      };
      let dateOk = false;
      if (r.periodo) {
        const parts = r.periodo.toLowerCase().split(' ');
        if (parts.length === 2) {
          const m = MONTHS_ES[parts[0]];
          const y = parseInt(parts[1], 10);
          if (m !== undefined && !isNaN(y)) {
            const periodStart = new Date(y, m, 1);
            const periodEnd   = new Date(y, m + 1, 0, 23, 59, 59);
            // Period overlaps with filter range
            dateOk = periodStart <= end && periodEnd >= start;
          }
        }
      }
      // Fallback: use savedAt
      if (!dateOk) dateOk = inRange(r.savedAt, start, end);
      return dateOk;
    };

    const filteredIncomes  = incomes.filter(filterIncome);
    const filteredExpenses = expenses.filter(filterExpense);

    // ── KPIs Financieros ─────────────────────────────────────────────────────
    const totalSales = filteredIncomes.reduce((s: number, i: any) => s + (i.total || 0), 0);

    const gastosFijos     = filteredExpenses.filter((e: any) => e.tipoGasto === 'fijo')
                             .reduce((s: number, e: any) => s + (e.monto ?? e.valor ?? 0), 0);
    const gastosVariables = filteredExpenses.filter((e: any) => e.tipoGasto === 'variable')
                             .reduce((s: number, e: any) => s + (e.monto ?? e.valor ?? 0), 0);
    const gastosInsumos   = filteredExpenses.filter((e: any) => e.tipoGasto === 'insumo')
                             .reduce((s: number, e: any) => s + (e.monto ?? e.valor ?? 0), 0);
    const gastosSinClasif = filteredExpenses.filter((e: any) => !e.tipoGasto || e.tipoGasto === 'por_definir')
                             .reduce((s: number, e: any) => s + (e.monto ?? e.valor ?? 0), 0);

    // Nómina: filtrada por sede y período
    const payrollInPeriod = payrollRecords.filter(filterPayroll);
    const gastoNomina = payrollInPeriod.reduce((sum: number, record: any) => {
      return sum + (record.filas || []).reduce((s2: number, f: any) => {
        return s2 + (f.nomina || 0) + (f.extras || 0) + (f.vacaciones || 0) + (f.liquidacion || 0);
      }, 0);
    }, 0);

    // BUG-01 FIX: gastosSinClasif ya incluye los gastos sin tipo; no sumar insumos dos veces
    const totalGastos = gastosFijos + gastosVariables + gastosInsumos + gastoNomina + gastosSinClasif;

    // Margen Bruto = solo descuenta insumos (costo directo de producción)
    const margenBruto = totalSales > 0
      ? ((totalSales - gastosInsumos) / totalSales) * 100
      : 0;
    // Margen Neto = usa totalGastos completo para que los gastos sin clasificar
    // (ni insumo, ni fijo, ni variable) también bajen el margen correctamente.
    // Resultado puede ser negativo si hay pérdidas.
    const margenNeto = totalSales > 0
      ? ((totalSales - totalGastos) / totalSales) * 100
      : totalGastos > 0 ? -100 : 0;
    const puntoEquilibrio = margenBruto > 0 ? gastosFijos / (margenBruto / 100) : 0;

    // ── Tendencia de Ventas por día ───────────────────────────────────────────
    const salesByDay: Record<string, number> = {};
    filteredIncomes.forEach((i: any) => {
      const key = (i.fecha || i.created_at || '').slice(0, 10);
      if (key) salesByDay[key] = (salesByDay[key] || 0) + (i.total || 0);
    });
    const expensesByDay: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      const key = (e.fecha || e.created_at || '').slice(0, 10);
      if (key) expensesByDay[key] = (expensesByDay[key] || 0) + (e.monto ?? e.valor ?? 0);
    });

    const allDays = Array.from(new Set([...Object.keys(salesByDay), ...Object.keys(expensesByDay)])).sort();
    const salesTrend = allDays.map(date => ({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      ventas: salesByDay[date] || 0,
      gastos: expensesByDay[date] || 0,
    }));

    // ── Top Proveedores ───────────────────────────────────────────────────────
    const supplierMap: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      if (e.proveedor) {
        supplierMap[e.proveedor] = (supplierMap[e.proveedor] || 0) + (e.monto ?? e.valor ?? 0);
      }
    });
    const topSuppliers = Object.entries(supplierMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, total]) => ({ name, total }));

    // ── Producción & Fritado ─────────────────────────────────────────────────
    const fritadoMovs  = movements.filter((m: any) => m.type === 'FRITADO' && filterMovement(m));
    const mermaMovs    = movements.filter((m: any) => m.type === 'MERMA'   && filterMovement(m));
    const producMovs   = movements.filter((m: any) => m.type === 'PRODUCCION' && filterMovement(m));

    const totalFritado  = fritadoMovs.reduce((s: number, m: any) => s + (m.qty || 0), 0);
    const totalMerma    = mermaMovs.reduce((s: number, m: any) => s + (m.qty || 0), 0);
    const totalProduc   = producMovs.reduce((s: number, m: any) => s + (m.qty || 0), 0);
    const pctMerma      = totalFritado > 0 ? (totalMerma / totalFritado) * 100 : 0;

    // Fritado por día
    const fritByDay: Record<string, { fritado: number; merma: number }> = {};
    [...fritadoMovs, ...mermaMovs].forEach((m: any) => {
      const key = (m.timestamp || '').slice(0, 10);
      if (!key) return;
      if (!fritByDay[key]) fritByDay[key] = { fritado: 0, merma: 0 };
      if (m.type === 'FRITADO') fritByDay[key].fritado += m.qty || 0;
      if (m.type === 'MERMA')   fritByDay[key].merma   += m.qty || 0;
    });
    const productionTrend = Object.entries(fritByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        ...v,
      }));

    // ── Nómina detalle ───────────────────────────────────────────────────────
    const payrollDetail: { name: string; total: number; periodo: string }[] = [];
    payrollInPeriod.forEach((record: any) => {
      (record.filas || []).forEach((f: any) => {
        const total = (f.nomina||0) + (f.extras||0) + (f.vacaciones||0) + (f.liquidacion||0);
        if (total > 0) payrollDetail.push({ name: f.empleadoNombre || '—', total, periodo: record.periodo || '—' });
      });
    });

    return {
      // KPIs
      totalSales, totalGastos,
      gastosFijos, gastosVariables, gastosInsumos, gastoNomina, gastosSinClasif,
      margenBruto, margenNeto, puntoEquilibrio,
      // Trends
      salesTrend, productionTrend,
      // Suppliers
      topSuppliers,
      // Production
      totalFritado, totalMerma, totalProduc, pctMerma,
      // Payroll
      payrollDetail,
      // Raw counts
      incomeCount: filteredIncomes.length,
      expenseCount: filteredExpenses.length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, incomes, expenses, payrollRecords, movements, getRange]);
}
