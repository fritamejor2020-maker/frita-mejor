import { useMemo } from 'react';
import { useAttendanceStore, ShiftTemplate, EmployeeContract, RawAttendanceLog, isLogDeleted, isExplicitAttendancePunch } from '../../../store/useAttendanceStore';

export interface DailyShiftBlock {
  shiftId: string;
  shiftName: string;
  shiftColor: string;
  firstIn?: string;       // e.g. "06:07:54"
  lastOut?: string;      // e.g. "14:16:27"
  grossMinutes: number;  // minutos trabajados brutos
  deductedTardinessMinutes: number; // 30 mins si llego >5 min tarde
  deductedMissingMarksMinutes: number; // 30 mins si falta entrada o salida
  netMinutes: number;    // minutos trabajados netos aprobados
  formattedTotal: string;// e.g. "08:09" (HH:mm)
  displayPillText: string; // e.g. "08:09 (06:07:54 - 14:16:27)"
  isMissingMarks: boolean;
  isTardy: boolean;
  rawLogs: RawAttendanceLog[];
}

export interface EmployeeWeeklyPayroll {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  branchId: string;
  avatarColor: string;
  initials: string;
  isPresentNow: boolean;
  weeklyTargetHours: number;
  grossHours: number;
  deductedTardinessHours: number;
  deductedMissingMarksHours: number;
  netHoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  baseHourlyRate: number;
  overtimeHourlyRate: number;
  payBaseSalary: boolean;    // true: paga ordinarias por hora | false: sueldo fijo (solo liquida extras)
  includeInPayroll: boolean; // true: incluido en la liquidación semanal | false: excluido
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  // Mapa de bloques por día (YYYY-MM-DD -> Array de DailyShiftBlock)
  dailyBlocks: Record<string, DailyShiftBlock[]>;
}

// Convert "HH:mm" to minutes from midnight
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// Convert "HH:mm:ss" or "HH:mm" to seconds from midnight for exact precision
function timeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

// Format minutes to "HH:mm"
export function roundToCustomHalfHour(h: number): number {
  if (h <= 0) return 0;
  const floorVal = Math.floor(h);
  const frac = Number((h - floorVal).toFixed(4));

  if (frac >= 0.9) {
    return floorVal + 1.0;
  } else if (frac >= 0.4) {
    return floorVal + 0.5;
  } else {
    return floorVal + 0.0;
  }
}

export function formatMinutesToHHMM(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Calculate initials from full name
function getInitials(name: string): string {
  if (!name) return 'EM';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function useAttendanceData(selectedBranchId: string | null, weekStartDate: Date) {
  const {
    employeeContracts,
    shiftTemplates,
    scheduleGroups,
    attendanceLogs,
    deletedLogIds,
    shiftOverrides,
  } = useAttendanceStore();

  return useMemo(() => {
    const deletedSet = new Set(deletedLogIds || []);
    const validAttendanceLogs = (attendanceLogs || []).filter((l) => {
      if (!l) return false;
      if (isLogDeleted(l, deletedSet)) return false;
      return isExplicitAttendancePunch(l);
    });

    // 1. Generar los 7 días de la semana (Lunes a Domingo)
    const weekDays: { dateStr: string; dayLabel: string; dayName: string; isToday: boolean }[] = [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const monday = new Date(weekStartDate);
    monday.setHours(0, 0, 0, 0);

    const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = SHORT_DAYS[d.getDay()];
      const dayNum  = d.getDate();
      weekDays.push({
        dateStr,
        dayName,
        dayLabel: `${dayName} ${dayNum}`,
        isToday: dateStr === todayStr,
      });
    }

    const startWeekStr = weekDays[0].dateStr;
    const endWeekStr   = weekDays[6].dateStr;

    // 2. Filtrar contratos por Sede
    const filteredContracts = selectedBranchId
      ? employeeContracts.filter((c) => c.branchId === selectedBranchId)
      : employeeContracts;

    // 3. Procesar datos para cada empleado
    const payrollList: EmployeeWeeklyPayroll[] = filteredContracts.map((contract) => {
      const dailyBlocks: Record<string, DailyShiftBlock[]> = {};
      let totalGrossMins = 0;
      let totalTardyDeductedMins = 0;
      let totalMissingDeductedMins = 0;
      let isPresentNow = false;

      // Obtener logs del empleado en el rango de la semana (con coincidencia robusta de ID/número)
      const empLogs = validAttendanceLogs.filter((l) => {
        const logNo = String(l.employeeNo || '').trim();
        const contractNo = String(contract.employeeNo || '').trim();
        const logEmpId = String(l.employeeId || '').trim();
        const contractEmpId = String(contract.employeeId || '').trim();

        if (logNo === contractNo || logEmpId === contractEmpId) return true;
        const numA = parseInt(logNo, 10);
        const numB = parseInt(contractNo, 10);
        return numA > 0 && numA === numB;
      });

      const getTimeString = (ts?: string) => {
        if (!ts) return '';
        try {
          const d = new Date(ts);
          if (!isNaN(d.getTime())) {
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return `${h}:${m}:${s}`;
          }
        } catch {}
        if (ts.includes('T')) return ts.slice(11, 19);
        if (ts.includes(' ')) return ts.split(' ')[1] || ts.slice(11, 19);
        return ts.slice(11, 19);
      };

      const getLogDateStr = (ts?: string) => {
        if (!ts) return '';
        try {
          const d = new Date(ts);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          }
        } catch {}
        return ts.slice(0, 10);
      };

      // Verificar si está "En Turno" hoy (última marca de hoy fue ENTRY)
      const todayLogs = empLogs
        .filter((l) => getLogDateStr(l.timestamp) === todayStr)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (todayLogs.length > 0) {
        const lastLog = todayLogs[todayLogs.length - 1];
        if (lastLog.type === 'ENTRY' || (lastLog.type as string).toUpperCase() === 'CHECKIN') {
          isPresentNow = true;
        }
      }

      // Procesar cada día de la semana
      weekDays.forEach((wDay) => {
        const dayLogs = empLogs
          .filter((l) => getLogDateStr(l.timestamp) === wDay.dateStr)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Verificar si hay modificación manual de turno para este día
        const override = shiftOverrides.find((o) => (o.employeeId === contract.employeeId || o.employeeId === contract.employeeNo) && o.date === wDay.dateStr);

        if (dayLogs.length === 0 && !override) {
          dailyBlocks[wDay.dateStr] = [];
          return;
        }

        // ── Algoritmo de Pareo de Múltiples Turnos en el Mismo Día ───────────────
        const shiftPairs: { firstIn?: string; lastOut?: string; logs: RawAttendanceLog[] }[] = [];

        if (override) {
          shiftPairs.push({
            firstIn: override.customFirstIn,
            lastOut: override.customLastOut,
            logs: dayLogs,
          });
        } else {
          // Pareo secuencial inteligente de entradas y salidas para detectar MÚLTIPLES TURNOS en el mismo día
          let currentPair: { firstIn?: string; lastOut?: string; logs: RawAttendanceLog[] } | null = null;

          dayLogs.forEach((log) => {
            const timeStr = getTimeString(log.timestamp);
            const isExit = log.attendanceStatus === 'checkOut' || log.type === 'EXIT';

            if (!currentPair) {
              if (!isExit) {
                currentPair = { firstIn: timeStr, lastOut: undefined, logs: [log] };
              } else {
                currentPair = { firstIn: undefined, lastOut: timeStr, logs: [log] };
              }
            } else {
              if (isExit) {
                if (currentPair.lastOut) {
                  currentPair.logs.push(log);
                  currentPair.lastOut = timeStr;
                } else {
                  currentPair.lastOut = timeStr;
                  currentPair.logs.push(log);
                  shiftPairs.push(currentPair);
                  currentPair = null;
                }
              } else {
                // Nueva marca de Entrada (checkIn)
                if (currentPair.firstIn && !currentPair.lastOut) {
                  const prevMins = timeToMinutes(currentPair.firstIn.slice(0, 5));
                  const currMins = timeToMinutes(timeStr.slice(0, 5));
                  if (Math.abs(currMins - prevMins) <= 5) {
                    currentPair.logs.push(log);
                  } else {
                    shiftPairs.push(currentPair);
                    currentPair = { firstIn: timeStr, lastOut: undefined, logs: [log] };
                  }
                } else {
                  shiftPairs.push(currentPair);
                  currentPair = { firstIn: timeStr, lastOut: undefined, logs: [log] };
                }
              }
            }
          });

          if (currentPair) {
            shiftPairs.push(currentPair);
          }
        }

        const dayBlocks: DailyShiftBlock[] = [];

        shiftPairs.forEach((pair) => {
          const rawFirstIn = pair.firstIn || '';
          const rawLastOut = pair.lastOut || '';

          // Auto-Detección de Turno (o plantilla fija/override)
          let assignedShift: ShiftTemplate | undefined = shiftTemplates.find((s) => s.id === override?.shiftId);

          if (!assignedShift) {
            if (contract.shiftType === 'FIXED' && contract.defaultShiftId) {
              assignedShift = shiftTemplates.find((s) => s.id === contract.defaultShiftId);
            } else if (rawFirstIn) {
              const firstInMins = timeToMinutes(rawFirstIn.slice(0, 5));
              const lastOutMins = rawLastOut ? timeToMinutes(rawLastOut.slice(0, 5)) : null;

              // Filtrar únicamente los turnos que pertenecen al Grupo de Horarios asignado al trabajador
              const empGroup = scheduleGroups?.find((g) => g.id === contract.scheduleGroupId);
              const candidateTemplates = (empGroup && empGroup.shiftIds && empGroup.shiftIds.length > 0)
                ? shiftTemplates.filter((st) => empGroup.shiftIds.includes(st.id))
                : shiftTemplates;

              let bestScore = Infinity;
              candidateTemplates.forEach((st) => {
                const stStartMins = timeToMinutes(st.startTime);
                const stEndMins = timeToMinutes(st.endTime);

                // Distancia a hora de entrada
                const startDist = Math.abs(firstInMins - stStartMins);
                // Distancia a hora de salida si existe
                const endDist = lastOutMins !== null ? Math.abs(lastOutMins - stEndMins) : 0;

                // Score ponderado (la hora de entrada tiene peso 1.0 y salida 0.6)
                const totalScore = startDist + (lastOutMins !== null ? endDist * 0.6 : 0);

                if (totalScore < bestScore) {
                  bestScore = totalScore;
                  assignedShift = st;
                }
              });
            }
          }

          if (!assignedShift) {
            assignedShift = shiftTemplates[0] || {
              id: 'SHIFT-DEFAULT',
              name: 'Turno Regular',
              startTime: '06:00',
              endTime: '14:00',
              targetMinutes: 480,
              color: '#3B82F6',
            };
          }

          // Evaluación de Marcas Faltantes y Tardanza
          // Si el día es HOY y el empleado ya marcó entrada pero aún no marca salida (porque sigue en su turno), NO es olvido de marca
          const isMissingExitToday = wDay.isToday && !!rawFirstIn && !rawLastOut;
          const isMissingMarks = (!rawFirstIn || !rawLastOut) && !isMissingExitToday;

          let isTardy = false;

          if (rawFirstIn && assignedShift) {
            const actualInSecs = timeToSeconds(rawFirstIn);
            const shiftStartSecs = timeToSeconds(assignedShift.startTime);
            // Tolerancia estricta de 5:00 minutos exactos (300 segundos). Pasado de 5:00 min (ej. 06:05:01) es llegada tarde.
            if (actualInSecs - shiftStartSecs > 300) {
              isTardy = true;
            }
          }

          // Cálculo de Minutos Brutos
          let grossMins = 0;
          if (rawFirstIn && rawLastOut) {
            const inMins = timeToMinutes(rawFirstIn.slice(0, 5));
            const outMins = timeToMinutes(rawLastOut.slice(0, 5));
            grossMins = outMins >= inMins ? outMins - inMins : (1440 - inMins) + outMins;
          } else {
            grossMins = assignedShift.targetMinutes || 480;
          }

          const deductedTardinessMins = isTardy ? 30 : 0;
          const deductedMissingMins   = isMissingMarks ? 30 : 0;
          const netMins = Math.max(0, grossMins - deductedTardinessMins - deductedMissingMins);

          totalGrossMins += grossMins;
          totalTardyDeductedMins += deductedTardinessMins;
          totalMissingDeductedMins += deductedMissingMins;

          const formattedTotal = formatMinutesToHHMM(netMins);
          const displayPillText = `${formattedTotal} (${rawFirstIn || '??:??:??'} - ${rawLastOut || '??:??:??'})`;

          dayBlocks.push({
            shiftId: assignedShift.id,
            shiftName: assignedShift.name,
            shiftColor: assignedShift.color,
            firstIn: rawFirstIn,
            lastOut: rawLastOut,
            grossMinutes: grossMins,
            deductedTardinessMinutes: deductedTardinessMins,
            deductedMissingMarksMinutes: deductedMissingMins,
            netMinutes: netMins,
            formattedTotal,
            displayPillText,
            isMissingMarks,
            isTardy,
            rawLogs: pair.logs,
          });
        });

        dailyBlocks[wDay.dateStr] = dayBlocks;
      });

      // Cálculo de Nómina Semanal acumulada con regla de redondeo personalizado
      const grossHours = roundToCustomHalfHour(totalGrossMins / 60);
      const deductedTardinessHours = roundToCustomHalfHour(totalTardyDeductedMins / 60);
      const deductedMissingMarksHours = roundToCustomHalfHour(totalMissingDeductedMins / 60);
      const netHoursWorked = roundToCustomHalfHour(Math.max(0, (totalGrossMins - totalTardyDeductedMins - totalMissingDeductedMins) / 60));

      const targetHours = contract.weeklyTargetHours || 44;
      const regularHours = Math.min(netHoursWorked, targetHours);
      const overtimeHours = Math.max(0, +(netHoursWorked - targetHours).toFixed(2));

      // 99% de trabajadores tienen salario fijo (payBaseSalary: false por defecto) -> regularPay = 0
      const payBaseSalary = contract.payBaseSalary ?? false;
      const includeInPayroll = contract.includeInPayroll ?? true;

      const regularPay = payBaseSalary ? Math.round(regularHours * (contract.baseHourlyRate || 6500)) : 0;
      const overtimePay = Math.round(overtimeHours * (contract.overtimeHourlyRate || 9750));
      const totalPay = regularPay + overtimePay;

      return {
        employeeId: contract.employeeId,
        employeeNo: contract.employeeNo,
        fullName: contract.fullName,
        branchId: contract.branchId,
        avatarColor: contract.avatarColor || '#3B82F6',
        initials: getInitials(contract.fullName),
        isPresentNow,
        weeklyTargetHours: targetHours,
        grossHours,
        deductedTardinessHours,
        deductedMissingMarksHours,
        netHoursWorked,
        regularHours,
        overtimeHours,
        baseHourlyRate: contract.baseHourlyRate || 6500,
        overtimeHourlyRate: contract.overtimeHourlyRate || 9750,
        payBaseSalary,
        includeInPayroll,
        regularPay,
        overtimePay,
        totalPay,
        dailyBlocks,
      };
    });

    // Ordenar estrictamente por número de código de empleado (#1, #2, #3, #4...)
    payrollList.sort((a, b) => {
      const numA = parseInt(a.employeeNo, 10) || 9999;
      const numB = parseInt(b.employeeNo, 10) || 9999;
      return numA - numB;
    });

    return {
      weekDays,
      startWeekStr,
      endWeekStr,
      payrollList,
    };
  }, [selectedBranchId, weekStartDate, employeeContracts, shiftTemplates, attendanceLogs, shiftOverrides]);
}
