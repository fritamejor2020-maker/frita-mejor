import React from 'react';
import { DailyShiftBlock, EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';
import { AlertTriangle, HelpCircle, Clock } from 'lucide-react';

interface TimelineGridPanelProps {
  viewMode: 'week' | 'day';
  selectedDateStr?: string;
  weekDays: { dateStr: string; dayLabel: string; dayName: string; isToday: boolean }[];
  payrollList: EmployeeWeeklyPayroll[];
  onSelectEmployee: (emp: EmployeeWeeklyPayroll) => void;
  onManageEmployees?: () => void;
  onSelectBlock: (emp: EmployeeWeeklyPayroll, dateStr: string, block: DailyShiftBlock) => void;
  onAddBlock: (emp: EmployeeWeeklyPayroll, dateStr: string) => void;
}

// Convierte "HH:mm" o "HH:mm:ss" a minutos desde las 00:00
function parseTimeToMinutes(tStr?: string): number {
  if (!tStr) return 0;
  const parts = tStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// 24 horas del día para el diagrama de Gantt
const HOURS_24 = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export function TimelineGridPanel({
  viewMode,
  selectedDateStr,
  weekDays,
  payrollList,
  onSelectEmployee,
  onManageEmployees,
  onSelectBlock,
  onAddBlock,
}: TimelineGridPanelProps) {
  const isDayView = viewMode === 'day';
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDateStr = selectedDateStr || weekDays.find((d) => d.isToday)?.dateStr || todayStr;
  const targetDay = weekDays.find((d) => d.dateStr === targetDateStr) || { dateStr: targetDateStr, isToday: targetDateStr === todayStr };

  // Minutos actuales para la línea roja de hora actual
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentLeftPercent = Math.min(100, Math.max(0, (currentMinutes / 1440) * 100));

  if (isDayView) {
    return (
      <div className="w-full overflow-auto max-h-[calc(100vh-210px)] min-h-[500px] bg-white rounded-3xl shadow-xs border border-gray-200">
        <div className="inline-block min-w-[1776px] w-full align-middle relative">
          {/* Header Row */}
          <div className="h-12 border-b border-gray-200 flex bg-gray-100 sticky top-0 z-30">
            {/* Sticky Left Corner Header */}
            <div className="w-60 min-w-[240px] shrink-0 border-r border-gray-200 px-3 flex items-center justify-between bg-gray-100 font-black text-xs text-gray-600 uppercase tracking-wider sticky left-0 z-40">
              <span>Personal ({payrollList.length})</span>
              {onManageEmployees && (
                <button
                  onClick={onManageEmployees}
                  className="text-[10px] font-black bg-amber-400 hover:bg-amber-500 text-gray-950 px-2 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                  title="Editar o eliminar personas del biométrico y del sistema"
                >
                  ⚙️ Editar
                </button>
              )}
            </div>

            {/* 24 Hours Headers */}
            <div className="flex-1 flex">
              {HOURS_24.map((hour, idx) => (
                <div
                  key={idx}
                  className="w-[64px] shrink-0 border-r border-gray-200/70 flex flex-col justify-center items-center text-center font-black text-[11px] text-gray-600 select-none"
                >
                  <span>{hour}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current Time Red Line */}
          {targetDay?.isToday && (
            <div
              className="absolute top-12 bottom-0 z-20 pointer-events-none border-l-2 border-red-500 shadow-sm"
              style={{ left: `calc(240px + (100% - 240px) * ${currentLeftPercent / 100})` }}
            >
              <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-xs absolute -top-2.5 -translate-x-1/2 uppercase tracking-tighter flex items-center gap-0.5">
                <Clock size={10} /> Ahora
              </span>
            </div>
          )}

          {/* Employee Rows */}
          <div className="divide-y divide-gray-100">
            {payrollList.map((emp) => {
              const blocks = emp.dailyBlocks[targetDateStr] || [];

              return (
                <div key={emp.employeeId} className="min-h-[44px] flex items-stretch hover:bg-amber-50/20 transition-colors group/row">
                  {/* Sticky Left Employee Cell */}
                  <div
                    onClick={() => onSelectEmployee(emp)}
                    className={`w-60 min-w-[240px] shrink-0 border-r border-gray-200 px-3 py-1.5 flex items-center justify-between transition-all cursor-pointer select-none sticky left-0 z-20 ${
                      emp.isPresentNow ? 'bg-emerald-50/95 border-l-4 border-l-emerald-500' : 'bg-white group-hover/row:bg-amber-50/90'
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <span className="font-black text-xs text-gray-900 truncate leading-none group-hover/row:text-amber-700">
                        {emp.fullName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-extrabold text-gray-400">#{emp.employeeNo}</span>
                        {emp.isPresentNow ? (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 leading-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            En Turno
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md leading-none">
                            {emp.netHoursWorked}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gantt Timeline Cell */}
                  <div className="flex-1 flex relative min-h-[44px] items-center">
                    {HOURS_24.map((_, hIdx) => (
                      <div key={hIdx} className="w-[64px] shrink-0 border-r border-gray-100/80 h-full" />
                    ))}

                    {blocks.map((b, bIdx) => {
                      const startMins = parseTimeToMinutes(b.firstIn || '06:00');
                      const nowMins = now.getHours() * 60 + now.getMinutes();
                      const endMins = b.lastOut
                        ? parseTimeToMinutes(b.lastOut)
                        : (targetDay.isToday ? Math.max(startMins + 15, nowMins) : Math.min(1440, startMins + 480));

                      const leftPct = (startMins / 1440) * 100;
                      const durationMins = Math.max(15, endMins >= startMins ? endMins - startMins : (1440 - startMins) + endMins);
                      const widthPct = Math.min(100 - leftPct, Math.max(2, (durationMins / 1440) * 100));

                      return (
                        <div
                          key={bIdx}
                          onClick={() => onSelectBlock(emp, targetDateStr, b)}
                          className={`absolute top-1.5 bottom-1.5 rounded-xl px-2.5 flex items-center justify-between text-xs font-black transition-all cursor-pointer shadow-2xs border select-none overflow-hidden z-10 hover:scale-[1.01] ${
                            b.isTardy || b.isMissingMarks
                              ? 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200'
                              : 'bg-emerald-100 border-emerald-300 text-emerald-950 hover:bg-emerald-200'
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          title={`${b.shiftName}: ${b.displayPillText}`}
                        >
                          <div className="flex items-center gap-1.5 truncate min-w-0">
                            {emp.isPresentNow && !b.lastOut && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                            )}
                            <span className="truncate font-black text-xs">
                              {b.firstIn ? b.firstIn.slice(0, 5) : '??:??'} - {b.lastOut ? b.lastOut.slice(0, 5) : 'Sin Salida'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {b.isTardy && (
                              <AlertTriangle size={13} className="text-amber-600 shrink-0" title="Tardanza (>5 min) -> -30m" />
                            )}
                            {b.isMissingMarks && (
                              <HelpCircle size={13} className="text-red-500 shrink-0" title="Falta marca de salida -> -30m" />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {blocks.length === 0 && (
                      <button
                        onClick={() => onAddBlock(emp, targetDateStr)}
                        className="absolute inset-x-2 top-1.5 bottom-1.5 rounded-lg border border-dashed border-transparent group-hover/row:border-gray-300 text-gray-300 group-hover/row:text-gray-500 font-bold text-xs flex items-center justify-center transition-all opacity-0 group-hover/row:opacity-100 cursor-pointer bg-white/60 z-10"
                      >
                        + Registrar Marcación / Asignar Turno
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Vista Semanal (7 Días) Unificada ───────────────────────────────────────
  return (
    <div className="w-full overflow-auto max-h-[calc(100vh-210px)] min-h-[500px] bg-white rounded-3xl shadow-xs border border-gray-200">
      <div className="inline-block min-w-full align-middle relative">
        {/* Header Row */}
        <div className="h-12 border-b border-gray-200 flex bg-gray-100 sticky top-0 z-30">
          {/* Sticky Left Corner Header */}
          <div className="w-60 min-w-[240px] shrink-0 border-r border-gray-200 px-3 flex items-center justify-between bg-gray-100 font-black text-xs text-gray-600 uppercase tracking-wider sticky left-0 z-40">
            <span>Personal ({payrollList.length})</span>
            {onManageEmployees && (
              <button
                onClick={onManageEmployees}
                className="text-[10px] font-black bg-amber-400 hover:bg-amber-500 text-gray-950 px-2 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                title="Editar o eliminar personas del biométrico y del sistema"
              >
                ⚙️ Editar
              </button>
            )}
          </div>

          {/* 7 Days Column Headers */}
          <div className="flex-1 flex min-w-[840px]">
            {weekDays.map((day) => (
              <div
                key={day.dateStr}
                className={`flex-1 min-w-[120px] border-r border-gray-200 px-2 flex flex-col justify-center items-center text-center font-black text-xs ${
                  day.isToday ? 'bg-amber-100/90 text-amber-950' : 'text-gray-600'
                }`}
              >
                <span className="font-black text-xs">{day.dayName}</span>
                <span className="text-[10px] text-gray-500 font-bold">{day.dateStr.slice(8, 10)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Rows */}
        <div className="divide-y divide-gray-100">
          {payrollList.map((emp) => (
            <div key={emp.employeeId} className="min-h-[44px] flex items-stretch hover:bg-amber-50/20 transition-colors group/row">
              {/* Sticky Left Employee Cell */}
              <div
                onClick={() => onSelectEmployee(emp)}
                className={`w-60 min-w-[240px] shrink-0 border-r border-gray-200 px-3 py-1.5 flex items-center justify-between transition-all cursor-pointer select-none sticky left-0 z-20 ${
                  emp.isPresentNow ? 'bg-emerald-50/95 border-l-4 border-l-emerald-500' : 'bg-white group-hover/row:bg-amber-50/90'
                }`}
              >
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                  <span className="font-black text-xs text-gray-900 truncate leading-none group-hover/row:text-amber-700">
                    {emp.fullName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-extrabold text-gray-400">#{emp.employeeNo}</span>
                    {emp.isPresentNow ? (
                      <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 leading-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        En Turno
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md leading-none">
                        {emp.netHoursWorked}h
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 7 Days Cells */}
              <div className="flex-1 flex min-w-[840px]">
                {weekDays.map((day) => {
                  const blocks = emp.dailyBlocks[day.dateStr] || [];

                  return (
                    <div
                      key={day.dateStr}
                      className={`flex-1 min-w-[120px] border-r border-gray-100 px-1.5 py-1.5 flex items-center gap-1 flex-wrap relative group/cell ${
                        day.isToday ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {blocks.map((b, idx) => {
                        const firstTime = b.firstIn ? b.firstIn.slice(0, 5) : '';
                        const lastTime = b.lastOut ? b.lastOut.slice(0, 5) : '';
                        const pillLabel = lastTime 
                          ? `${firstTime || '??:??'} - ${lastTime}`
                          : `${firstTime || '??:??'}`;

                        return (
                          <div
                            key={idx}
                            onClick={() => onSelectBlock(emp, day.dateStr, b)}
                            className={`rounded-md px-1.5 py-1 flex items-center gap-1 text-[10px] font-black transition-all cursor-pointer shadow-2xs select-none border shrink-0 ${
                              b.isTardy || b.isMissingMarks
                                ? 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200'
                                : 'bg-gray-200/90 border-gray-300/90 text-gray-800 hover:bg-gray-300'
                            }`}
                            title={`${b.shiftName}: ${b.displayPillText}`}
                          >
                            <span className="font-extrabold whitespace-nowrap leading-none">{pillLabel}</span>

                            {b.isTardy && (
                              <AlertTriangle size={11} className="text-amber-600 shrink-0" title="Tardanza (>5 min) -> -30m" />
                            )}
                            {b.isMissingMarks && (
                              <HelpCircle size={11} className="text-red-500 shrink-0" title="Falta marca -> -30m" />
                            )}
                          </div>
                        );
                      })}

                      {blocks.length === 0 && (
                        <button
                          onClick={() => onAddBlock(emp, day.dateStr)}
                          className="w-full h-full min-h-[28px] rounded-lg border border-dashed border-transparent group-hover/cell:border-gray-300 text-gray-300 group-hover/cell:text-gray-500 font-bold text-[10px] flex items-center justify-center transition-all opacity-0 group-hover/cell:opacity-100 cursor-pointer"
                        >
                          + Agregar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
