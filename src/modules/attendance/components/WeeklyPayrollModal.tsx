import React, { useState } from 'react';
import { X, DollarSign, Clock, AlertTriangle, ShieldCheck, Save, Calendar, CheckCircle2, FileSpreadsheet, Download } from 'lucide-react';
import { EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';
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
      map[d.dateStr] = Number((grossMins / 60).toFixed(2));
    });
    return map;
  });

  const initialTardinessCount = Math.round(emp.deductedTardinessHours / 0.5);
  const initialMissingMarksCount = Math.round(emp.deductedMissingMarksHours / 0.5);

  const [tardinessCount, setTardinessCount] = useState<number>(initialTardinessCount);
  const [missingMarksCount, setMissingMarksCount] = useState<number>(initialMissingMarksCount);
  const [weeklyTargetHours, setWeeklyTargetHours] = useState<number>(emp.weeklyTargetHours || 44);
  const [baseHourlyRate, setBaseHourlyRate] = useState<number>(emp.baseHourlyRate || 6500);
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState<number>(emp.overtimeHourlyRate || 9750);

  const [isSaved, setIsSaved] = useState(false);

  // ── Recálculo en tiempo real ──────────────────────────────────────────────
  const grossHours = Number(Object.values(dailyHours).reduce((acc, h) => acc + Number(h || 0), 0).toFixed(2));
  const deductedTardinessHours = Number((tardinessCount * 0.5).toFixed(2));
  const deductedMissingMarksHours = Number((missingMarksCount * 0.5).toFixed(2));
  const netHoursWorked = Number(Math.max(0, grossHours - deductedTardinessHours - deductedMissingMarksHours).toFixed(2));

  const regularHours = Number(Math.min(netHoursWorked, weeklyTargetHours).toFixed(2));
  const overtimeHours = Number(Math.max(0, netHoursWorked - weeklyTargetHours).toFixed(2));

  const regularPay = Math.round(regularHours * baseHourlyRate);
  const overtimePay = Math.round(overtimeHours * overtimeHourlyRate);
  const totalPay = regularPay + overtimePay;

  // Notificar al componente padre de los cambios completos para la exportación a Excel y resumenes
  React.useEffect(() => {
    onUpdateCardState(emp.employeeId, {
      dailyHours,
      tardinessCount,
      missingMarksCount,
      weeklyTargetHours,
      baseHourlyRate,
      overtimeHourlyRate,
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
    grossHours,
    totalPay,
  ]);

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
    };
    upsertEmployeeContract(updatedContract);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 space-y-3.5 transition-all hover:border-amber-300">
      {/* Empleado Header & Pago Total */}
      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2.5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm"
            style={{ backgroundColor: emp.avatarColor }}
          >
            {emp.initials}
          </div>
          <div>
            <h4 className="font-black text-sm text-gray-900">{emp.fullName}</h4>
            <span className="text-[10px] font-bold text-gray-400">
              ID #{emp.employeeNo} • Sede: {emp.branchId}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-gray-400 block font-bold uppercase">Pago Total Calculado</span>
          <span className="text-lg font-black text-emerald-600">
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

        <div className="grid grid-cols-7 gap-1.5 bg-white p-2 rounded-xl border border-gray-200">
          {daysList.map((d) => (
            <div key={d.dateStr} className="flex flex-col items-center">
              <span className="text-[10px] font-black text-gray-600">{d.dayName}</span>
              <span className="text-[9px] font-bold text-gray-400 mb-1">{d.dateStr.slice(8, 10)}</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={dailyHours[d.dateStr] ?? 0}
                onChange={(e) => handleDayHourChange(d.dateStr, e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 focus:border-amber-500 rounded-lg py-1 px-1 text-center text-xs font-black text-gray-900 outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Ajustes de Penalizaciones (Tardanzas y Faltas de Marca) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-amber-900 uppercase block">Llegadas Tarde (&gt;5m)</span>
            <span className="text-[10px] text-amber-700 font-bold">Descuento: -{deductedTardinessHours} h</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={tardinessCount}
              onChange={(e) => setTardinessCount(Math.max(0, Number(e.target.value) || 0))}
              className="w-14 bg-white border border-amber-300 rounded-lg px-2 py-1 text-center text-xs font-black text-amber-950 outline-none focus:border-amber-500"
            />
            <span className="text-xs font-bold text-amber-800">veces</span>
          </div>
        </div>

        <div className="bg-red-50/70 border border-red-200 rounded-xl p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-red-900 uppercase block">Olvidos Marca (Ent/Sal)</span>
            <span className="text-[10px] text-red-700 font-bold">Descuento: -{deductedMissingMarksHours} h</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={missingMarksCount}
              onChange={(e) => setMissingMarksCount(Math.max(0, Number(e.target.value) || 0))}
              className="w-14 bg-white border border-red-300 rounded-lg px-2 py-1 text-center text-xs font-black text-red-950 outline-none focus:border-red-500"
            />
            <span className="text-xs font-bold text-red-800">veces</span>
          </div>
        </div>
      </div>

      {/* ── 3. Parámetros de Contrato & Tarifas ──────────────────────────────── */}
      <div className="bg-white p-2.5 rounded-xl border border-gray-200 grid grid-cols-3 gap-2 text-xs font-bold">
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
            value={baseHourlyRate}
            onChange={(e) => setBaseHourlyRate(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-black text-gray-900 outline-none focus:border-amber-500"
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
            <span className="font-black text-gray-900">${regularPay.toLocaleString('es-CO')}</span>
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
  const displayList = selectedEmployee ? [selectedEmployee] : payrollList;

  // Mapa de estados completos recibidos de las filas editables
  const [cardsStateMap, setCardsStateMap] = useState<Record<string, CardStateData>>({});

  const handleUpdateCardState = (empId: string, state: CardStateData) => {
    setCardsStateMap((prev) => ({ ...prev, [empId]: state }));
  };

  const totalPayrollAmount = displayList.reduce((acc, curr) => {
    const updated = cardsStateMap[curr.employeeId];
    return acc + (updated ? updated.totalPay : curr.totalPay);
  }, 0);

  const totalRegularHours = displayList.reduce((acc, curr) => {
    const updated = cardsStateMap[curr.employeeId];
    return acc + (updated ? updated.regularHours : curr.regularHours);
  }, 0);

  const totalOvertimeHours = displayList.reduce((acc, curr) => {
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

    displayList.forEach((emp) => {
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
