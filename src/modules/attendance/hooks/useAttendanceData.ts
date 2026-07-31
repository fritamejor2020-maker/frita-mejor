import { useMemo } from 'react';
import { useAttendanceStore, ShiftTemplate, EmployeeContract, RawAttendanceLog } from '../../../store/useAttendanceStore';

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

// Format minutes to "HH:mm"
function formatMinutesToHHMM(mins: number): string {
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
    attendanceLogs,
    shiftOverrides,
  } = useAttendanceStore();

  return useMemo(() => {
    // 1. Generar los 7 días de la semana (Lunes a Domingo)
    const weekDays: { dateStr: string; dayLabel: string; dayName: string; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    const monday = new Date(weekStartDate);
    monday.setHours(0, 0, 0, 0);

    const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
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

      // Obtener logs del empleado en el rango de la semana (o del día de hoy)
      const empLogs = attendanceLogs.filter((l) => l.employeeNo === contract.employeeNo || l.employeeId === contract.employeeId);

      // Verificar si está "En Turno" hoy (última marca de hoy fue ENTRY)
      const todayLogs = empLogs
        .filter((l) => (l.timestamp || '').startsWith(todayStr))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (todayLogs.length > 0) {
        const lastLog = todayLogs[todayLogs.length - 1];
        if (lastLog.type === 'ENTRY') {
          isPresentNow = true;
        }
      }

      // Procesar cada día de la semana
      weekDays.forEach((wDay) => {
        const dayLogs = empLogs
          .filter((l) => (l.timestamp || '').startsWith(wDay.dateStr))
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
          let currentPair: { firstIn?: string; lastOut?: string; logs: RawAttendanceLog[] } | null = null;

          dayLogs.forEach((log) => {
            if (log.type === 'ENTRY') {
              if (currentPair && !currentPair.lastOut) {
                shiftPairs.push(currentPair);
              }
              currentPair = {
                firstIn: log.timestamp.slice(11, 19),
                logs: [log],
              };
            } else if (log.type === 'EXIT') {
              if (currentPair && currentPair.firstIn && !currentPair.lastOut) {
                currentPair.lastOut = log.timestamp.slice(11, 19);
                currentPair.logs.push(log);
                shiftPairs.push(currentPair);
                currentPair = null;
              } else {
                shiftPairs.push({
                  lastOut: log.timestamp.slice(11, 19),
                  logs: [log],
                });
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
              let closestDist = Infinity;
              shiftTemplates.forEach((st) => {
                const stStartMins = timeToMinutes(st.startTime);
                const dist = Math.abs(firstInMins - stStartMins);
                if (dist < closestDist) {
                  closestDist = dist;
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
          const isMissingMarks = !rawFirstIn || !rawLastOut;
          let isTardy = false;

          if (rawFirstIn && assignedShift) {
            const actualInMins = timeToMinutes(rawFirstIn.slice(0, 5));
            const shiftStartMins = timeToMinutes(assignedShift.startTime);
            if (actualInMins - shiftStartMins > 5) {
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

      // Cálculo de Nómina Semanal acumulada
      const grossHours = +(totalGrossMins / 60).toFixed(2);
      const deductedTardinessHours = +(totalTardyDeductedMins / 60).toFixed(2);
      const deductedMissingMarksHours = +(totalMissingDeductedMins / 60).toFixed(2);
      const netHoursWorked = +((totalGrossMins - totalTardyDeductedMins - totalMissingDeductedMins) / 60).toFixed(2);

      const targetHours = contract.weeklyTargetHours || 44;
      const regularHours = Math.min(netHoursWorked, targetHours);
      const overtimeHours = Math.max(0, +(netHoursWorked - targetHours).toFixed(2));

      const regularPay = Math.round(regularHours * (contract.baseHourlyRate || 6500));
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
        regularPay,
        overtimePay,
        totalPay,
        dailyBlocks,
      };
    });

    return {
      weekDays,
      startWeekStr,
      endWeekStr,
      payrollList,
    };
  }, [selectedBranchId, weekStartDate, employeeContracts, shiftTemplates, attendanceLogs, shiftOverrides]);
}
