import React from 'react';
import { DailyShiftBlock, EmployeeWeeklyPayroll } from '../hooks/useAttendanceData';
import { AlertTriangle, HelpCircle, Clock } from 'lucide-react';

interface TimelineGridPanelProps {
  viewMode: 'week' | 'day';
  selectedDateStr?: string;
  weekDays: { dateStr: string; dayLabel: string; dayName: string; isToday: boolean }[];
  payrollList: EmployeeWeeklyPayroll[];
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
      <div className="flex-1 overflow-x-auto min-w-0 bg-white">
        <div className="inline-block min-w-[1536px] w-full align-middle relative">
          {/* ── Encabezado Gantt de 24 Horas ───────────────────────────────────── */}
          <div className="h-12 border-b border-gray-200 flex bg-gray-50/90 sticky top-0 z-10">
            {HOURS_24.map((hour, idx) => (
              <div
                key={idx}
                className="w-[64px] shrink-0 border-r border-gray-200/70 flex flex-col justify-center items-center text-center font-black text-[11px] text-gray-500 select-none"
              >
                <span>{hour}</span>
              </div>
            ))}
          </div>

          {/* Línea roja indicadora de "Hora Actual" (Si el día seleccionado es Hoy) */}
          {targetDay?.isToday && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none border-l-2 border-red-500 shadow-sm"
              style={{ left: `${currentLeftPercent}%` }}
            >
              <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-xs absolute -top-1 -translate-x-1/2 uppercase tracking-tighter flex items-center gap-0.5">
                <Clock size={10} /> Ahora
              </span>
            </div>
          )}

          {/* ── Filas Gantt para cada trabajador ──────────────────────────────── */}
          <div className="divide-y divide-gray-100">
            {payrollList.map((emp) => {
              const blocks = emp.dailyBlocks[targetDateStr] || [];

              return (
                <div key={emp.employeeId} className="h-[68px] flex relative hover:bg-amber-50/20 transition-colors group/row">
                  {/* Cuadrícula de fondo de 24 horas */}
                  {HOURS_24.map((_, hIdx) => (
                    <div
                      key={hIdx}
                      className="w-[64px] shrink-0 border-r border-gray-100/80 h-full"
                    />
                  ))}

                  {/* Barras de Turno / Marcaciones estilo Gantt */}
                  {blocks.map((b, bIdx) => {
                    const startMins = parseTimeToMinutes(b.firstIn || '06:00');
                    const endMins = b.lastOut
                      ? parseTimeToMinutes(b.lastOut)
                      : Math.min(1440, startMins + 480);

                    // Posicionamiento horizontal dinámico %
                    const leftPct = (startMins / 1440) * 100;
                    const durationMins = Math.max(30, endMins >= startMins ? endMins - startMins : (1440 - startMins) + endMins);
                    const widthPct = Math.min(100 - leftPct, Math.max(5, (durationMins / 1440) * 100));

                    return (
                      <div
                        key={bIdx}
                        onClick={() => onSelectBlock(emp, targetDateStr, b)}
                        className={`absolute top-2.5 bottom-2.5 rounded-2xl px-3 flex items-center justify-between text-xs font-black transition-all cursor-pointer shadow-sm border select-none overflow-hidden z-10 hover:scale-[1.01] hover:shadow-md ${
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
                        {/* Etiqueta de hora e información */}
                        <div className="flex items-center gap-2 truncate min-w-0">
                          {emp.isPresentNow && !b.lastOut && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          )}
                          <span className="truncate font-black text-xs">
                            {b.firstIn ? b.firstIn.slice(0, 5) : '??:??'} - {b.lastOut ? b.lastOut.slice(0, 5) : 'Sin Salida'}
                          </span>
                        </div>

                        {/* Indicadores de Penalización / Alerta */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {b.isTardy && (
                            <AlertTriangle size={14} className="text-amber-600 shrink-0" title="Tardanza (>5 min) -> -30m" />
                          )}
                          {b.isMissingMarks && (
                            <HelpCircle size={14} className="text-red-500 shrink-0" title="Falta marca de salida -> -30m" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Botón interactivo para agregar turno si no hay marca ese día */}
                  {blocks.length === 0 && (
                    <button
                      onClick={() => onAddBlock(emp, targetDateStr)}
                      className="absolute inset-x-2 top-2 bottom-2 rounded-xl border border-dashed border-transparent group-hover/row:border-gray-300 text-gray-300 group-hover/row:text-gray-500 font-bold text-xs flex items-center justify-center transition-all opacity-0 group-hover/row:opacity-100 cursor-pointer bg-white/60 z-10"
                    >
                      + Registrar Marcación / Asignar Turno
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Vista Semanal (7 Días) ───────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-x-auto min-w-0 bg-white">
      <div className="inline-block min-w-full align-middle">
        {/* Encabezado de la Cuadrícula (Fechas) */}
        <div className="h-12 border-b border-gray-200 flex bg-gray-50/90 sticky top-0 z-10">
          {weekDays.map((day) => (
            <div
              key={day.dateStr}
              className={`flex-1 min-w-[115px] border-r border-gray-200 px-2 flex flex-col justify-center items-center text-center font-black text-xs ${
                day.isToday ? 'bg-amber-100/60 text-amber-900' : 'text-gray-600'
              }`}
            >
              <span className="font-extrabold">{day.dayName}</span>
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
                    className={`flex-1 min-w-[115px] border-r border-gray-100 p-1.5 flex flex-col justify-center gap-1 relative group/cell ${
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
                        <span className="truncate leading-tight font-extrabold">
                          {b.displayPillText}
                        </span>

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
