import React, { useState } from 'react';
import { X, DollarSign, Clock, AlertTriangle, ShieldCheck, Save, Calendar, CheckCircle2, FileSpreadsheet, Download } from 'lucide-react';
import { EmployeeWeeklyPayroll, roundToCustomHalfHour } from '../hooks/useAttendanceData';
import { useAttendanceStore, EmployeeContract } from '../../../store/useAttendanceStore';
import * as XLSX from 'xlsx';

interface WeekDayInfo {
  dateStr: string;
  dayLabel: string;
  dayName: string;
  isToday: boolean;
}

interface WeeklyPayrollModalProps {
  payrollList: EmployeeWeeklyPayroll[];
  weekDays?: WeekDayInfo[];
  selectedEmployee?: EmployeeWeeklyPayroll;
  onClose: () => void;
}

export interface CardStateData {
  dailyHours: Record<string, number>;
  tardinessCount: number;
  missingMarksCount: number;
  weeklyTargetHours: number;
  baseHourlyRate: number;
  overtimeHourlyRate: number;
  payBaseSalary: boolean;
  includeInPayroll: boolean;
  grossHours: number;
  deductedTardinessHours: number;
  deductedMissingMarksHours: number;
  netHoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

// ── Componente de Fila Editable por Empleado ──────────────────────────────────
function EditableEmployeePayrollCard({
  emp,
  weekDays = [],
  onUpdateCardState,
}: {
  emp: EmployeeWeeklyPayroll;
  weekDays: WeekDayInfo[];
  onUpdateCardState: (empId: string, state: CardStateData) => void;
}) {
  const { employeeContracts, upsertEmployeeContract } = useAttendanceStore();
  const contract = employeeContracts.find((c) => c.employeeId === emp.employeeId);

  // Generar fechas por defecto si no vienen weekDays
  const daysList: WeekDayInfo[] = weekDays.length > 0 ? weekDays : (() => {
    const dates: WeekDayInfo[] = [];
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = SHORT_DAYS[d.getDay()];
      dates.push({ dateStr, dayName, dayLabel: `${dayName} ${d.getDate()}`, isToday: false });
    }
    return dates;
  })();

  // Estado local por empleado
  const [dailyHours, setDailyHours] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    daysList.forEach((d) => {
      const blocks = emp.dailyBlocks[d.dateStr] || [];
      const grossMins = blocks.reduce((acc, b) => acc + (b.grossMinutes || 0), 0);
      map[d.dateStr] = roundToCustomHalfHour(grossMins / 60);
    });
    return map;
  });

  const initialTardinessCount = Math.round(emp.deductedTardinessHours / 0.5);
  const initialMissingMarksCount = Math.round(emp.deductedMissingMarksHours / 0.5);

  const [tardinessCount, setTardinessCount] = useState<number>(initialTardinessCount);
  const [missingMarksCount, setMissingMarksCount] = useState<number>(initialMissingMarksCount);
  const [weeklyTargetHours, setWeeklyTargetHours] = useState<number>(contract?.weeklyTargetHours || emp.weeklyTargetHours || 44);
  const [baseHourlyRate, setBaseHourlyRate] = useState<number>(contract?.baseHourlyRate || emp.baseHourlyRate || 6500);
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState<number>(contract?.overtimeHourlyRate || emp.overtimeHourlyRate || 9750);
  
  // 99% de trabajadores tienen Sueldo Fijo (payBaseSalary: false por defecto) -> Pagar solo Extras
  const [payBaseSalary, setPayBaseSalary] = useState<boolean>(contract?.payBaseSalary ?? emp.payBaseSalary ?? false);
  const [includeInPayroll, setIncludeInPayroll] = useState<boolean>(contract?.includeInPayroll ?? emp.includeInPayroll ?? true);

  const [isSaved, setIsSaved] = useState(false);

  // Sincronizar automáticamente si se actualizan las tarifas globales
  React.useEffect(() => {
    if (contract) {
      setWeeklyTargetHours(contract.weeklyTargetHours || 44);
      setBaseHourlyRate(contract.baseHourlyRate || 6500);
      setOvertimeHourlyRate(contract.overtimeHourlyRate || 9750);
    }
  }, [contract?.weeklyTargetHours, contract?.baseHourlyRate, contract?.overtimeHourlyRate]);

  // ── Recálculo en tiempo real ──────────────────────────────────────────────
  const grossHours = Number(Object.values(dailyHours).reduce((acc, h) => acc + Number(h || 0), 0).toFixed(2));
  const deductedTardinessHours = Number((tardinessCount * 0.5).toFixed(2));
  const deductedMissingMarksHours = Number((missingMarksCount * 0.5).toFixed(2));
  const netHoursWorked = Number(Math.max(0, grossHours - deductedTardinessHours - deductedMissingMarksHours).toFixed(2));

  const regularHours = Number(Math.min(netHoursWorked, weeklyTargetHours).toFixed(2));
  const overtimeHours = Number(Math.max(0, netHoursWorked - weeklyTargetHours).toFixed(2));

  // Si payBaseSalary es false (Sueldo Fijo), regularPay es $0
  const regularPay = payBaseSalary ? Math.round(regularHours * baseHourlyRate) : 0;
  const overtimePay = Math.round(overtimeHours * overtimeHourlyRate);
  const totalPay = includeInPayroll ? (regularPay + overtimePay) : 0;

  // Notificar al componente padre de los cambios completos para la exportación a Excel y resumenes
  React.useEffect(() => {
    onUpdateCardState(emp.employeeId, {
      dailyHours,
      tardinessCount,
      missingMarksCount,
      weeklyTargetHours,
      baseHourlyRate,
      overtimeHourlyRate,
      payBaseSalary,
      includeInPayroll,
      grossHours,
      deductedTardinessHours,
      deductedMissingMarksHours,
      netHoursWorked,
      regularHours,
      overtimeHours,
      regularPay,
      overtimePay,
      totalPay,
    });
  }, [
    JSON.stringify(dailyHours),
    tardinessCount,
    missingMarksCount,
    weeklyTargetHours,
    baseHourlyRate,
    overtimeHourlyRate,
    payBaseSalary,
    includeInPayroll,
    grossHours,
    totalPay,
  ]);

  // ── Auto-Guardado Inmediato y Persistente en Supabase ──────────────────────
  React.useEffect(() => {
    if (!contract) return;
    const hasChanged = contract.payBaseSalary !== payBaseSalary ||
                       contract.includeInPayroll !== includeInPayroll ||
                       contract.weeklyTargetHours !== weeklyTargetHours ||
                       contract.baseHourlyRate !== baseHourlyRate ||
                       contract.overtimeHourlyRate !== overtimeHourlyRate;

    if (hasChanged) {
      const updatedContract: EmployeeContract = {
        ...contract,
        weeklyTargetHours: Number(weeklyTargetHours),
        baseHourlyRate: Number(baseHourlyRate),
        overtimeHourlyRate: Number(overtimeHourlyRate),
        payBaseSalary,
        includeInPayroll,
      };
      upsertEmployeeContract(updatedContract);
      setIsSaved(true);
      const timer = setTimeout(() => setIsSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [payBaseSalary, includeInPayroll, weeklyTargetHours, baseHourlyRate, overtimeHourlyRate]);

  const handleDayHourChange = (dateStr: string, valueStr: string) => {
    const val = Math.max(0, Number(valueStr) || 0);
    setDailyHours((prev) => ({ ...prev, [dateStr]: val }));
    setIsSaved(false);
  };

  const handleSaveContractChanges = () => {
    if (!contract) return;
    const updatedContract: EmployeeContract = {
      ...contract,
      weeklyTargetHours: Number(weeklyTargetHours),
      baseHourlyRate: Number(baseHourlyRate),
      overtimeHourlyRate: Number(overtimeHourlyRate),
      payBaseSalary,
      includeInPayroll,
    };
    upsertEmployeeContract(updatedContract);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 space-y-3.5 transition-all hover:border-amber-300">
      {/* Empleado Header, Penalizaciones (Tardanza/Olvidos) Al Lado del Nombre & Pago Total */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
        {/* Nombre e Info del Empleado */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={includeInPayroll}
            onChange={(e) => setIncludeInPayroll(e.target.checked)}
            title="Incluir a este trabajador en la liquidación semanal"
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
          />
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm shrink-0"
            style={{ backgroundColor: emp.avatarColor }}
          >
            {emp.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm text-gray-900 leading-tight">{emp.fullName}</h4>
              {!payBaseSalary && (
                <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-blue-200">
                  Sueldo Fijo
                </span>
              )}
              {!includeInPayroll && (
                <span className="bg-gray-200 text-gray-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                  Excluido
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              ID #{emp.employeeNo} • Sede: {emp.branchId}
            </span>
          </div>
        </div>

        {/* Controles de Penalización (Llegadas Tarde y Olvidos Marca) Al Lado del Nombre */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Llegadas Tarde */}
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-2.5 py-1 flex items-center gap-2 shadow-2xs">
            <div>
              <span className="text-[9px] font-black text-amber-900 uppercase block leading-none">Llegadas Tarde</span>
              <span className="text-[8px] text-amber-700 font-bold leading-none">-30m (-{deductedTardinessHours}h)</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={tardinessCount}
                onChange={(e) => setTardinessCount(Math.max(0, Number(e.target.value) || 0))}
                className="w-10 bg-white border border-amber-300 rounded-lg py-0.5 px-1 text-center text-xs font-black text-amber-950 outline-none focus:border-amber-500"
              />
              <span className="text-[10px] font-bold text-amber-800">x</span>
            </div>
          </div>

          {/* Olvidos Marca */}
          <div className="bg-red-50/90 border border-red-200 rounded-xl px-2.5 py-1 flex items-center gap-2 shadow-2xs">
            <div>
              <span className="text-[9px] font-black text-red-900 uppercase block leading-none">Olvidos Marca</span>
              <span className="text-[8px] text-red-700 font-bold leading-none">-30m (-{deductedMissingMarksHours}h)</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={missingMarksCount}
                onChange={(e) => setMissingMarksCount(Math.max(0, Number(e.target.value) || 0))}
                className="w-10 bg-white border border-red-300 rounded-lg py-0.5 px-1 text-center text-xs font-black text-red-950 outline-none focus:border-red-500"
              />
              <span className="text-[10px] font-bold text-red-800">x</span>
            </div>
          </div>
        </div>

        {/* Pago Total Calculado */}
        <div className="text-right shrink-0">
          <span className="text-[10px] text-gray-400 block font-bold uppercase">Pago Total Calculado</span>
          <span className={`text-lg font-black ${includeInPayroll ? 'text-emerald-600' : 'text-gray-400 line-through'}`}>
            ${totalPay.toLocaleString('es-CO')}
          </span>
        </div>
      </div>

      {/* ── 1. Línea de Tiempo de la Semana (Horas por Día Editable) ────────── */}
      <div>
        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5 flex items-center gap-1">
          <Calendar size={12} className="text-amber-500" />
          Línea de Tiempo Semanal — Ajustar Horas por Día:
        </label>

        <div className="grid grid-cols-7 gap-1.5 bg-white p-2 rounded-2xl border border-gray-200">
          {daysList.map((d) => {
            const blocks = emp.dailyBlocks[d.dateStr] || [];
            const b = blocks[0];
            const firstIn = b?.firstIn ? b.firstIn.slice(0, 5) : null;
            const lastOut = b?.lastOut ? b.lastOut.slice(0, 5) : null;
            const hasPunches = firstIn || lastOut;

            return (
              <div
                key={d.dateStr}
                className={`flex flex-col items-center p-1.5 rounded-xl border text-center space-y-1 transition-all ${
                  hasPunches
                    ? 'bg-amber-50/40 border-amber-200/90'
                    : 'bg-gray-50/60 border-gray-200/60'
                }`}
              >
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[10px] font-black text-gray-700">{d.dayName}</span>
                  <span className="text-[9px] font-bold text-gray-400">{d.dateStr.slice(8, 10)}</span>
                </div>

                {/* Horas de Llegada (Entrada) y Salida (Soporta Múltiples Turnos) */}
                <div className="w-full bg-white rounded-lg p-1 border border-gray-200/90 text-[9px] font-extrabold flex flex-col gap-0.5 shadow-2xs max-h-16 overflow-y-auto">
                  {blocks.length === 0 ? (
                    <div className="flex items-center justify-between text-gray-300 font-normal py-1">
                      <span className="text-[8px]">Ent:</span>
                      <span>--:--</span>
                    </div>
                  ) : (
                    blocks.map((blk, idx) => (
                      <div key={idx} className="flex flex-col border-b border-gray-100 last:border-0 pb-0.5">
                        <div className="flex items-center justify-between text-emerald-800">
                          <span className="text-gray-400 font-bold text-[8px]">Ent{blocks.length > 1 ? `${idx+1}` : ''}:</span>
                          <span className={blk.firstIn ? 'text-emerald-700 font-black' : 'text-gray-300 font-normal'}>
                            {blk.firstIn ? blk.firstIn.slice(0, 5) : '--:--'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-amber-800">
                          <span className="text-gray-400 font-bold text-[8px]">Sal{blocks.length > 1 ? `${idx+1}` : ''}:</span>
                          <span className={blk.lastOut ? 'text-amber-700 font-black' : 'text-gray-300 font-normal'}>
                            {blk.lastOut ? blk.lastOut.slice(0, 5) : '--:--'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input Horas Trabajadas */}
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={dailyHours[d.dateStr] ?? 0}
                  onChange={(e) => handleDayHourChange(d.dateStr, e.target.value)}
                  className="w-full bg-amber-100/60 border border-amber-300 focus:border-amber-500 rounded-lg py-1 px-0.5 text-center text-xs font-black text-amber-950 outline-none"
                  title="Horas trabajadas calculadas para la nómina"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Parámetros de Contrato & Tarifas ──────────────────────────────── */}
      <div className="bg-white p-2.5 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold">
        <label className="flex items-center gap-2 cursor-pointer bg-amber-50/70 border border-amber-200/90 p-2 rounded-xl text-xs font-extrabold text-amber-950 col-span-1 sm:col-span-3 hover:bg-amber-100/60 transition-all">
          <input
            type="checkbox"
            checked={payBaseSalary}
            onChange={(e) => setPayBaseSalary(e.target.checked)}
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
          />
          <span>Pagar Horas Ordinarias por valor hora (Si está desmarcado = Sueldo Fijo, solo liquida Horas Extras)</span>
        </label>

        <div>
          <label className="text-[9px] text-gray-400 block uppercase">Meta Semanal (h)</label>
          <input
            type="number"
            value={weeklyTargetHours}
            onChange={(e) => setWeeklyTargetHours(Math.max(1, Number(e.target.value) || 0))}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-black text-gray-900 outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[9px] text-gray-400 block uppercase">Valor Hora Base ($)</label>
          <input
            type="number"
            step="100"
            disabled={!payBaseSalary}
            value={baseHourlyRate}
            onChange={(e) => setBaseHourlyRate(Math.max(0, Number(e.target.value) || 0))}
            className={`w-full border rounded-lg px-2 py-1 text-xs font-black outline-none focus:border-amber-500 ${
              payBaseSalary ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          />
        </div>

        <div>
          <label className="text-[9px] text-gray-400 block uppercase">Valor Hora Extra ($)</label>
          <input
            type="number"
            step="100"
            value={overtimeHourlyRate}
            onChange={(e) => setOvertimeHourlyRate(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-black text-gray-900 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Desglose de Horas Resultante */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold bg-gray-100/60 p-2 rounded-xl">
        <div>
          <span className="text-gray-400 block text-[9px]">BRUTO TRABAJADO</span>
          <span className="text-gray-900 font-black">{grossHours} h</span>
        </div>
        <div>
          <span className="text-gray-400 block text-[9px]">DESCUENTO TOTAL</span>
          <span className="text-amber-700 font-black">
            -{(deductedTardinessHours + deductedMissingMarksHours).toFixed(1)} h
          </span>
        </div>
        <div>
          <span className="text-gray-400 block text-[9px]">NETO APROBADO</span>
          <span className="text-emerald-700 font-black">{netHoursWorked} h</span>
        </div>
        <div>
          <span className="text-gray-400 block text-[9px]">ORDINARIAS / EXTRAS</span>
          <span className="text-gray-900 font-black">{regularHours}h / {overtimeHours}h</span>
        </div>
      </div>

      {/* Cálculo Financiero & Guardar Contrato */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
        <div className="grid grid-cols-2 gap-2 text-xs font-bold flex-1 w-full sm:w-auto">
          <div className="bg-gray-200/60 rounded-xl p-2 flex justify-between items-center">
            <span>Ordinarias ({regularHours}h x ${baseHourlyRate.toLocaleString('es-CO')}):</span>
            <span className={`font-black ${payBaseSalary ? 'text-gray-900' : 'text-gray-400'}`}>
              {payBaseSalary ? `$${regularPay.toLocaleString('es-CO')}` : '$0 (Sueldo Fijo)'}
            </span>
          </div>
          <div className="bg-emerald-100/70 rounded-xl p-2 flex justify-between items-center text-emerald-900">
            <span>Extras ({overtimeHours}h x ${overtimeHourlyRate.toLocaleString('es-CO')}):</span>
            <span className="font-black">${overtimePay.toLocaleString('es-CO')}</span>
          </div>
        </div>

        {contract && (
          <button
            onClick={handleSaveContractChanges}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-400 hover:bg-amber-500 text-gray-950 shadow-2xs'
            }`}
          >
            {isSaved ? (
              <><CheckCircle2 size={14} /> Guardado</>
            ) : (
              <><Save size={14} /> Guardar Tarifas</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Componente Principal del Modal ─────────────────────────────────────────────
export function WeeklyPayrollModal({
  payrollList,
  weekDays = [],
  selectedEmployee,
  onClose,
}: WeeklyPayrollModalProps) {
  const { updateGlobalRates, employeeContracts } = useAttendanceStore();
  const firstContract = employeeContracts[0];

  const [globalTargetHours, setGlobalTargetHours] = useState<number>(firstContract?.weeklyTargetHours || 44);
  const [globalBaseRate, setGlobalBaseRate] = useState<number>(firstContract?.baseHourlyRate || 6500);
  const [globalOvertimeRate, setGlobalOvertimeRate] = useState<number>(firstContract?.overtimeHourlyRate || 9750);
  const [isGlobalSaved, setIsGlobalSaved] = useState(false);

  const handleApplyGlobalRates = () => {
    updateGlobalRates(globalTargetHours, globalBaseRate, globalOvertimeRate);
    setIsGlobalSaved(true);
    setTimeout(() => setIsGlobalSaved(false), 3000);
  };

  const displayList = selectedEmployee ? [selectedEmployee] : payrollList;

  // Mapa de estados completos recibidos de las filas editables
  const [cardsStateMap, setCardsStateMap] = useState<Record<string, CardStateData>>({});

  const handleUpdateCardState = (empId: string, state: CardStateData) => {
    setCardsStateMap((prev) => ({ ...prev, [empId]: state }));
  };

  // Solo incluir en los totales y reporte Excel a los trabajadores que tengan includeInPayroll === true
  const activeLiquidationList = displayList.filter((emp) => {
    const state = cardsStateMap[emp.employeeId];
    return state ? state.includeInPayroll : (emp.includeInPayroll ?? true);
  });

  const totalPayrollAmount = activeLiquidationList.reduce((acc, curr) => {
    const updated = cardsStateMap[curr.employeeId];
    return acc + (updated ? updated.totalPay : curr.totalPay);
  }, 0);

  const totalRegularHours = activeLiquidationList.reduce((acc, curr) => {
    const updated = cardsStateMap[curr.employeeId];
    return acc + (updated ? updated.regularHours : curr.regularHours);
  }, 0);

  const totalOvertimeHours = activeLiquidationList.reduce((acc, curr) => {
    const updated = cardsStateMap[curr.employeeId];
    return acc + (updated ? updated.overtimeHours : curr.overtimeHours);
  }, 0);

  // ── Generar Excel con Formato Exacto de la Imagen ────────────────────────────
  const handleExportExcel = () => {
    const headers = [
      'Empleado',
      'Tarde',
      'No Reg',
      'Lun',
      'Mar',
      'Mi',
      'Jue',
      'Vier',
      'Sab',
      'Dom',
      'Total',
      'Extras',
      'Descuento Horas',
      'Extras a Pagar',
      'DEBE',
      'Pagar',
      'Observaciones',
      'Pagado',
    ];

    const rows: any[][] = [headers];

    // Exportar únicamente los empleados seleccionados para la liquidación
    activeLiquidationList.forEach((emp) => {
      const state = cardsStateMap[emp.employeeId];

      const dailyMap = state?.dailyHours || {};
      const daysHours = (weekDays.length === 7 ? weekDays : []).map((d) => {
        if (dailyMap[d.dateStr] !== undefined) return Number(dailyMap[d.dateStr]) || 0;
        const blocks = emp.dailyBlocks[d.dateStr] || [];
        const mins = blocks.reduce((acc, b) => acc + (b.grossMinutes || 0), 0);
        return Number((mins / 60).toFixed(2));
      });

      while (daysHours.length < 7) daysHours.push(0);

      const [lun, mar, mi, jue, vier, sab, dom] = daysHours;

      const tardeCount = state?.tardinessCount ?? Math.round(emp.deductedTardinessHours / 0.5);
      const noRegCount = state?.missingMarksCount ?? Math.round(emp.deductedMissingMarksHours / 0.5);
      const targetH = state?.weeklyTargetHours ?? emp.weeklyTargetHours ?? 44;

      const totalGross = state?.grossHours ?? Number((lun + mar + mi + jue + vier + sab + dom).toFixed(2));
      const extras = Number((totalGross - targetH).toFixed(2));
      const descuentoHoras = -Number(((tardeCount * 0.5) + (noRegCount * 0.5)).toFixed(2));
      const extrasAPagar = Number((extras + descuentoHoras).toFixed(2));
      const pagarVal = state?.totalPay ?? emp.totalPay;

      rows.push([
        emp.fullName,
        tardeCount > 0 ? tardeCount : '',
        noRegCount > 0 ? noRegCount : '',
        lun > 0 ? lun : '',
        mar > 0 ? mar : '',
        mi > 0 ? mi : '',
        jue > 0 ? jue : '',
        vier > 0 ? vier : '',
        sab > 0 ? sab : '',
        dom > 0 ? dom : '',
        totalGross,
        extras,
        descuentoHoras,
        extrasAPagar,
        '', // DEBE
        pagarVal > 0 ? `$ ${pagarVal.toLocaleString('es-CO')}` : '-',
        '', // Observaciones
        '', // Pagado
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Ajustar anchos de columnas
    ws['!cols'] = [
      { wch: 30 }, // Empleado
      { wch: 8 },  // Tarde
      { wch: 8 },  // No Reg
      { wch: 7 },  // Lun
      { wch: 7 },  // Mar
      { wch: 7 },  // Mi
      { wch: 7 },  // Jue
      { wch: 7 },  // Vier
      { wch: 7 },  // Sab
      { wch: 7 },  // Dom
      { wch: 9 },  // Total
      { wch: 9 },  // Extras
      { wch: 15 }, // Descuento Horas
      { wch: 15 }, // Extras a Pagar
      { wch: 8 },  // DEBE
      { wch: 16 }, // Pagar
      { wch: 20 }, // Observaciones
      { wch: 10 }, // Pagado
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Liquidacion_Semanal');
    const todayIso = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Liquidacion_Nomina_Semanal_${todayIso}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
              <DollarSign className="text-amber-500" size={20} />
              Liquidación de Nómina Semanal
            </h3>
            <p className="text-xs font-bold text-gray-400">
              Ajusta las horas por día, penalizaciones por tardanza/falta y exporta a Excel en el formato oficial.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="bg-green-600 hover:bg-green-500 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Descargar reporte Excel idéntico al formato oficial"
            >
              <FileSpreadsheet size={16} />
              Exportar Excel (.xlsx)
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Resumen Superior Dinámico */}
        <div className="grid grid-cols-3 gap-3 my-4 shrink-0">
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-black text-amber-800 uppercase block">TOTAL A PAGAR</span>
            <span className="text-xl font-black text-amber-950">${totalPayrollAmount.toLocaleString('es-CO')}</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-black text-gray-500 uppercase block">HORAS ORDINARIAS</span>
            <span className="text-lg font-black text-gray-800">{totalRegularHours.toFixed(1)} h</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-black text-emerald-700 uppercase block">HORAS EXTRAS</span>
            <span className="text-lg font-black text-emerald-800">{totalOvertimeHours.toFixed(1)} h</span>
          </div>
        </div>

        {/* ── BARRA DE CONFIGURACIÓN GLOBAL DE TARIFAS (APLICA A TODOS) ──────────────── */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-3.5 mb-4 shrink-0 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
              ⚙️ Configuración Global de la Semana (Aplica a todos los trabajadores)
            </span>
            {isGlobalSaved && (
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 size={12} /> Guardado para todos
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[10px] font-black text-gray-500 block uppercase mb-1">META SEMANAL (H)</label>
              <input
                type="number"
                value={globalTargetHours}
                onChange={(e) => setGlobalTargetHours(Math.max(1, Number(e.target.value) || 0))}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-black text-gray-900 outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 block uppercase mb-1">VALOR HORA BASE ($)</label>
              <input
                type="number"
                step="100"
                value={globalBaseRate}
                onChange={(e) => setGlobalBaseRate(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-black text-gray-900 outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 block uppercase mb-1">VALOR HORA EXTRA ($)</label>
              <input
                type="number"
                step="100"
                value={globalOvertimeRate}
                onChange={(e) => setGlobalOvertimeRate(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-black text-gray-900 outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>

            <button
              onClick={handleApplyGlobalRates}
              className="w-full bg-amber-400 hover:bg-amber-500 text-gray-950 font-black text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer border border-amber-300"
            >
              <Save size={15} /> Aplicar a Todos
            </button>
          </div>
        </div>

        {/* Lista de Empleados con Tarjetas Editables */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {displayList.map((emp) => (
            <EditableEmployeePayrollCard
              key={emp.employeeId}
              emp={emp}
              weekDays={weekDays}
              onUpdateCardState={handleUpdateCardState}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 font-black text-xs rounded-xl cursor-pointer transition-all border border-green-300 flex items-center gap-1.5"
          >
            <Download size={14} />
            Descargar Plantilla Excel (.xlsx)
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-black text-xs rounded-xl cursor-pointer transition-all shadow-xs"
          >
            Cerrar Nómina
          </button>
        </div>
      </div>
    </div>
  );
}
