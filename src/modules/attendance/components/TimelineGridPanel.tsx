import React from 'react';
import { DailyShiftBlock, EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface TimelineGridPanelProps {
  weekDays: { dateStr: string; dayLabel: string; dayName: string; isToday: boolean }[];
  payrollList: EmployeeWeeklyPayroll[];
  onSelectBlock: (emp: EmployeeWeeklyPayroll, dateStr: string, block: DailyShiftBlock) => void;
  onAddBlock: (emp: EmployeeWeeklyPayroll, dateStr: string) => void;
}

export function TimelineGridPanel({
  weekDays,
  payrollList,
  onSelectBlock,
  onAddBlock,
}: TimelineGridPanelProps) {
  return (
    <div className="flex-1 overflow-x-auto min-w-0 bg-white">
      <div className="inline-block min-w-full align-middle">
        {/* Encabezado de la Cuadrícula (Fechas) */}
        <div className="h-12 border-b border-gray-200 flex bg-gray-50/90 sticky top-0 z-10">
          {weekDays.map((day) => (
            <div
              key={day.dateStr}
              className={`flex-1 min-w-[130px] border-r border-gray-200 px-3 flex flex-col justify-center items-center text-center font-black text-xs ${
                day.isToday ? 'bg-amber-100/60 text-amber-900' : 'text-gray-600'
              }`}
            >
              <span className="capitalize">{day.dayName}</span>
              <span className="text-[10px] text-gray-500 font-bold">{day.dateStr.slice(8, 10)}</span>
            </div>
          ))}
        </div>

        {/* Filas de la Cuadrícula (Sincronizadas con la lista izquierda) */}
        <div className="divide-y divide-gray-100">
          {payrollList.map((emp) => (
            <div key={emp.employeeId} className="h-[68px] flex hover:bg-amber-50/20 transition-colors">
              {weekDays.map((day) => {
                const blocks = emp.dailyBlocks[day.dateStr] || [];

                return (
                  <div
                    key={day.dateStr}
                    className={`flex-1 min-w-[130px] border-r border-gray-100 p-1.5 flex flex-col justify-center gap-1 relative group/cell ${
                      day.isToday ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {blocks.map((b, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectBlock(emp, day.dateStr, b)}
                        className={`rounded-xl px-2.5 py-1 flex items-center justify-between text-xs font-black transition-all cursor-pointer shadow-2xs select-none border truncate ${
                          b.isTardy || b.isMissingMarks
                            ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                            : 'bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200'
                        }`}
                        title={`${b.shiftName}: ${b.displayPillText}`}
                      >
                        {/* Formato del Texto: 08:09 (06:07:54 - 14:16:27) con truncado */}
                        <span className="truncate leading-tight font-extrabold">
                          {b.displayPillText}
                        </span>

                        {/* Badges de Alerta de Penalización */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {b.isTardy && (
                            <AlertTriangle size={13} className="text-amber-600 shrink-0" title="Tardanza (>5 min) -> -30m" />
                          )}
                          {b.isMissingMarks && (
                            <HelpCircle size={13} className="text-red-500 shrink-0" title="Falta marca -> -30m" />
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Botón rápido para agregar turno en celda vacía */}
                    {blocks.length === 0 && (
                      <button
                        onClick={() => onAddBlock(emp, day.dateStr)}
                        className="w-full h-full rounded-lg border border-dashed border-transparent group-hover/cell:border-gray-300 text-gray-300 group-hover/cell:text-gray-500 font-bold text-[10px] flex items-center justify-center transition-all opacity-0 group-hover/cell:opacity-100 cursor-pointer"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
