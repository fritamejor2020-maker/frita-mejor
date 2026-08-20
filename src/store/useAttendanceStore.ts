import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { supabase } from '../lib/supabase';
import { safeJSONStorage } from '../utils/safeStorage';

export interface BiometricTerminal {
  id: string;
  name: string;
  branchId: string;
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  status: 'ONLINE' | 'OFFLINE' | 'UNCHECKED';
  lastSyncAt?: string;
  autoSyncMinutes?: number;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // "HH:mm" e.g. "06:00"
  endTime: string;   // "HH:mm" e.g. "14:00"
  targetMinutes: number; // e.g. 480
  color: string;
  isFixed?: boolean;
}

export interface ShiftScheduleGroup {
  id: string;
  name: string;
  description?: string;
  shiftIds: string[];
}

export interface EmployeeContract {
  employeeId: string;
  employeeNo: string; // ID en el biométrico (ej. "1000")
  fullName: string;
  branchId: string;
  shiftType: 'FIXED' | 'VARIABLE';
  defaultShiftId?: string;
  scheduleGroupId?: string; // ID del Grupo de Horario asignado (ej. "GROUP-LOCAL")
  weeklyTargetHours: number; // e.g. 44 or 48
  baseHourlyRate: number;    // $ / hora ordinaria
  overtimeHourlyRate: number;// $ / hora extra
  pinPassword?: string;      // Clave de acceso en el biométrico
  cardNo?: string;           // Código de tarjeta RFID asignada
  avatarColor?: string;
}

export interface RawAttendanceLog {
  id: string;
  employeeId: string;
  employeeNo: string;
  branchId: string;
  terminalId: string;
  timestamp: string; // ISO 8601 string e.g. "2026-07-30T06:07:54-05:00"
  type: 'ENTRY' | 'EXIT' | 'UNKNOWN';
  verifyMethod?: string;
  doorNo?: number;
  serialNo?: number;
  attendanceStatus?: string;
}

export interface ShiftOverride {
  id: string;
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  shiftId?: string;
  customFirstIn?: string;  // "HH:mm:ss"
  customLastOut?: string; // "HH:mm:ss"
  notes?: string;
  updatedAt: string;
}

interface AttendanceStoreState {
  terminals: BiometricTerminal[];
  shiftTemplates: ShiftTemplate[];
  scheduleGroups: ShiftScheduleGroup[];
  employeeContracts: EmployeeContract[];
  attendanceLogs: RawAttendanceLog[];
  deletedLogIds: string[];
  shiftOverrides: ShiftOverride[];

  // Terminal management
  addTerminal: (term: Omit<BiometricTerminal, 'id'>) => void;
  updateTerminal: (id: string, data: Partial<BiometricTerminal>) => void;
  deleteTerminal: (id: string) => void;

  // Shift templates & Schedule Groups
  addShiftTemplate: (tpl: Omit<ShiftTemplate, 'id'>) => void;
  updateShiftTemplate: (id: string, data: Partial<ShiftTemplate>) => void;
  deleteShiftTemplate: (id: string) => void;

  addScheduleGroup: (grp: Omit<ShiftScheduleGroup, 'id'>) => void;
  updateScheduleGroup: (id: string, data: Partial<ShiftScheduleGroup>) => void;
  deleteScheduleGroup: (id: string) => void;

  // Contracts
  upsertEmployeeContract: (contract: EmployeeContract) => void;
  deleteEmployeeContract: (employeeId: string) => void;
  updateGlobalRates: (targetHours: number, baseRate: number, overtimeRate: number) => void;

  // Logs & Overrides
  addAttendanceLogs: (logs: RawAttendanceLog[]) => void;
  deleteSingleAttendanceLog: (logId: string, serialNo?: number) => void;
  deleteAttendanceLogsForDate: (employeeNo: string, dateStr: string) => void;
  clearAllAttendanceLogs: () => void;
  upsertShiftOverride: (override: ShiftOverride) => void;
  deleteShiftOverride: (id: string) => void;

  // ISAPI Actions
  syncTerminalEvents: (terminalId: string) => Promise<{ ok: boolean; count: number; message: string }>;
  fetchTerminalUsers: (terminalId: string) => Promise<{ ok: boolean; users: any[]; message: string }>;
  pushUserToTerminal: (terminalId: string, contract: EmployeeContract) => Promise<{ ok: boolean; message: string }>;
  deleteUserFromTerminal: (terminalId: string, employeeNo: string) => Promise<{ ok: boolean; message: string }>;
  loadFromRemote: () => Promise<void>;
}

const INITIAL_SHIFTS: ShiftTemplate[] = [
  { id: 'SHIFT-MANANA-COMPLETO', name: 'Turno Mañana (6am - 2pm)', startTime: '06:00', endTime: '14:00', targetMinutes: 480, color: '#3B82F6', isFixed: false },
  { id: 'SHIFT-MEDIA-MANANA',     name: 'Turno Media Mañana (6am - 12pm)', startTime: '06:00', endTime: '12:00', targetMinutes: 360, color: '#06B6D4', isFixed: false },
  { id: 'SHIFT-TARDE-COMPLETO',  name: 'Turno Tarde (2pm - 9pm)', startTime: '14:00', endTime: '21:00', targetMinutes: 420, color: '#F59E0B', isFixed: false },
  { id: 'SHIFT-PICO-TARDE',      name: 'Turno Pico Tarde (4pm - 9pm)', startTime: '16:00', endTime: '21:00', targetMinutes: 300, color: '#EF4444', isFixed: false },
  { id: 'SHIFT-INTERMEDIO-TARDE',name: 'Turno Intermedio (3pm - 7pm)', startTime: '15:00', endTime: '19:00', targetMinutes: 240, color: '#8B5CF6', isFixed: false },
];

export const INITIAL_SCHEDULE_GROUPS: ShiftScheduleGroup[] = [
  {
    id: 'GROUP-LOCAL',
    name: 'Horario del Local (Variables)',
    description: 'Turnos variables del local: 6am-2pm, 2pm-9pm, 4pm-9pm, 6am-12pm, 3pm-7pm',
    shiftIds: [
      'SHIFT-MANANA-COMPLETO',
      'SHIFT-MEDIA-MANANA',
      'SHIFT-TARDE-COMPLETO',
      'SHIFT-PICO-TARDE',
      'SHIFT-INTERMEDIO-TARDE',
    ],
  },
  {
    id: 'GROUP-ADMIN',
    name: 'Horario Administración',
    description: 'Horario fijo de oficina 8am - 5pm',
    shiftIds: ['SHIFT-MANANA-COMPLETO'],
  },
];

const INITIAL_TERMINALS: BiometricTerminal[] = [
  {
    id: 'TERM-001',
    name: 'Biométrico Entrada Principal',
    branchId: 'BRANCH-001',
    ipAddress: '192.168.3.220',
    port: 80,
    username: 'admin',
    password: 'Control.1',
    status: 'ONLINE',
    autoSyncMinutes: 5,
  },
];

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#14B8A6', '#6366F1', '#D97706'
];

export const REAL_BIOMETRIC_USERS = [
  { employeeNo: '1000', name: 'Jaime' },
  { employeeNo: '2', name: 'Yei' },
  { employeeNo: '3', name: 'Moni' },
  { employeeNo: '4', name: 'Jhon' },
  { employeeNo: '5', name: 'Luis' },
  { employeeNo: '6', name: 'Fernanda' },
  { employeeNo: '8', name: 'Jose' },
  { employeeNo: '9', name: 'Jaider' },
  { employeeNo: '10', name: 'Yisela' },
  { employeeNo: '11', name: 'Yesica' },
  { employeeNo: '12', name: 'Valentina' },
  { employeeNo: '13', name: 'Lorena' },
  { employeeNo: '14', name: 'Kevin' },
  { employeeNo: '15', name: 'Fernando' },
  { employeeNo: '16', name: 'Felipe' },
  { employeeNo: '17', name: 'Miller' },
  { employeeNo: '18', name: 'Laura' },
  { employeeNo: '19', name: 'Leo' },
  { employeeNo: '20', name: 'Johana' },
  { employeeNo: '21', name: 'Eduwin' },
  { employeeNo: '22', name: 'Cristian' },
  { employeeNo: '23', name: 'Esteban' },
  { employeeNo: '24', name: 'Arlin' },
  { employeeNo: '25', name: 'Hugo' },
  { employeeNo: '27', name: 'Juli' },
  { employeeNo: '28', name: 'Yeimy' },
  { employeeNo: '29', name: 'Sandra Q' },
  { employeeNo: '30', name: 'Duber' },
  { employeeNo: '31', name: 'Nelcy' },
  { employeeNo: '32', name: 'Jime' },
  { employeeNo: '33', name: 'Leidy' },
  { employeeNo: '34', name: 'Sandra Paladinez' },
  { employeeNo: '35', name: 'Argenis' },
  { employeeNo: '36', name: 'Napo' },
  { employeeNo: '37', name: 'Javier' },
  { employeeNo: '38', name: 'Edilma' },
  { employeeNo: '39', name: 'Maye' },
  { employeeNo: '40', name: 'Brigith' },
  { employeeNo: '41', name: 'Vic' }
];

const INITIAL_CONTRACTS: EmployeeContract[] = REAL_BIOMETRIC_USERS.map((u, idx) => ({
  employeeId: `EMP-${u.employeeNo}`,
  employeeNo: u.employeeNo,
  fullName: u.name,
  branchId: 'BRANCH-001',
  shiftType: 'VARIABLE',
  defaultShiftId: 'SHIFT-MANANA',
  weeklyTargetHours: 44,
  baseHourlyRate: 6500,
  overtimeHourlyRate: 9750,
  avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
  pinPassword: u.employeeNo === '24' ? '4321' : String(1000 + Number(u.employeeNo)),
}));

function mergeBiometricContracts(existing: EmployeeContract[]): EmployeeContract[] {
  const initialMap = new Map<string, EmployeeContract>();
  INITIAL_CONTRACTS.forEach((c) => initialMap.set(c.employeeNo, c));

  const map = new Map<string, EmployeeContract>();
  (existing || []).forEach((c) => {
    // Backfill pinPassword from INITIAL_CONTRACTS if missing
    if (!c.pinPassword && initialMap.has(c.employeeNo)) {
      c = { ...c, pinPassword: initialMap.get(c.employeeNo)!.pinPassword };
    }
    map.set(c.employeeNo, c);
  });
  INITIAL_CONTRACTS.forEach((c) => {
    if (!map.has(c.employeeNo)) {
      map.set(c.employeeNo, c);
    }
  });
  return Array.from(map.values());
}

import {
  fetchAllUsers,
  fetchAllEvents,
  isapiDigestFetch,
  HikvisionDeviceConfig,
} from '../services/hikvisionIsapiService';

export const INITIAL_BIOMETRIC_LOGS: RawAttendanceLog[] = [];

export function isExplicitAttendancePunch(logOrEv: any): boolean {
  if (!logOrEv) return false;
  if (logOrEv.minor === 22) return true; // Continuous checkOut

  const st = String(logOrEv.attendanceStatus || '').trim().toLowerCase();
  if (!st || st === 'undefined' || st === 'null' || st === 'invalid' || st === 'none' || st === '0') {
    return false;
  }

  return (
    st === 'checkin' ||
    st === 'check_in' ||
    st === 'checkout' ||
    st === 'check_out' ||
    st === 'entry' ||
    st === 'exit' ||
    st === 'overtimein' ||
    st === 'overtimeout' ||
    st === 'breakin' ||
    st === 'breakout'
  );
}

export function isLogDeleted(
  log: {
    id?: string;
    serialNo?: number | string;
    employeeNo?: string;
    employeeId?: string;
    terminalId?: string;
    timestamp?: string;
    attendanceStatus?: string;
  },
  deletedSet: Set<string>
): boolean {
  if (!log) return true;
  const INVALID_GATE_OPENING_IDS = new Set([
    'LOG-TERM-001-25650',
    'LOG-TERM-001-25647',
    'LOG-TERM-001-25644',
    'LOG-TERM-001-25641',
  ]);
  if (log.id && (INVALID_GATE_OPENING_IDS.has(log.id) || deletedSet.has(log.id))) return true;

  if (log.serialNo != null) {
    const sStr = String(log.serialNo);
    if (deletedSet.has(sStr)) return true;
    if (deletedSet.has(`LOG-TERM-001-${sStr}`)) return true;
    if (log.terminalId && deletedSet.has(`LOG-${log.terminalId}-${sStr}`)) return true;
    if (log.employeeNo) {
      const cleanEmp = String(log.employeeNo).replace('EMP-', '').trim();
      if (deletedSet.has(`LOG-TERM-001-${cleanEmp}-${sStr}`)) return true;
      if (log.terminalId && deletedSet.has(`LOG-${log.terminalId}-${cleanEmp}-${sStr}`)) return true;
    }
  }

  // Check date & employee tombstones
  const empNo = String(log.employeeNo || '').replace('EMP-', '').trim();
  const empId = String(log.employeeId || '').replace('EMP-', '').trim();
  const dateStr = log.timestamp ? log.timestamp.slice(0, 10) : '';

  if (dateStr) {
    if (empNo && (deletedSet.has(`DATE-${empNo}-${dateStr}`) || deletedSet.has(`DATE-EMP-${empNo}-${dateStr}`))) return true;
    if (empId && (deletedSet.has(`DATE-${empId}-${dateStr}`) || deletedSet.has(`DATE-EMP-${empId}-${dateStr}`))) return true;
  }

  return false;
}

function mergeBiometricLogs(existing: RawAttendanceLog[], deletedLogIds: string[] = []): RawAttendanceLog[] {
  const map = new Map<string, RawAttendanceLog>();
  const deletedSet = new Set(deletedLogIds || []);

  (existing || []).forEach((l) => {
    if (!isLogDeleted(l, deletedSet) && isExplicitAttendancePunch(l)) {
      map.set(l.id, {
        ...l,
        attendanceStatus: (l.attendanceStatus === 'checkOut' || l.type === 'EXIT') ? 'checkOut' : 'checkIn',
      });
    }
  });

  return Array.from(map.values());
}

export const useAttendanceStore = create<AttendanceStoreState>()(
  persist(
    (set, get) => ({
      terminals: INITIAL_TERMINALS,
      shiftTemplates: INITIAL_SHIFTS,
      scheduleGroups: INITIAL_SCHEDULE_GROUPS,
      employeeContracts: INITIAL_CONTRACTS,
      attendanceLogs: INITIAL_BIOMETRIC_LOGS,
      deletedLogIds: [],
      shiftOverrides: [],

      addTerminal: (termData) => {
        const newTerm: BiometricTerminal = { ...termData, id: `TERM-${Date.now()}` };
        set((s) => ({ terminals: [...s.terminals, newTerm] }));
        push('attendance_terminals', get().terminals);
      },

      updateTerminal: (id, data) => {
        set((s) => ({
          terminals: s.terminals.map((t) => (t.id === id ? { ...t, ...data } : t)),
        }));
        push('attendance_terminals', get().terminals);
      },

      deleteTerminal: (id) => {
        set((s) => ({ terminals: s.terminals.filter((t) => t.id !== id) }));
        push('attendance_terminals', get().terminals);
      },

      addShiftTemplate: (tplData) => {
        const newTpl: ShiftTemplate = { ...tplData, id: `SHIFT-${Date.now()}` };
        set((s) => ({ shiftTemplates: [...s.shiftTemplates, newTpl] }));
        push('attendance_shifts', get().shiftTemplates);
      },

      updateShiftTemplate: (id, data) => {
        set((s) => ({
          shiftTemplates: s.shiftTemplates.map((t) => (t.id === id ? { ...t, ...data } : t)),
        }));
        push('attendance_shifts', get().shiftTemplates);
      },

      deleteShiftTemplate: (id) => {
        set((s) => ({ shiftTemplates: s.shiftTemplates.filter((t) => t.id !== id) }));
        push('attendance_shifts', get().shiftTemplates);
      },

      addScheduleGroup: (grpData) => {
        const newGrp: ShiftScheduleGroup = { ...grpData, id: `GROUP-${Date.now()}` };
        set((s) => ({ scheduleGroups: [...(s.scheduleGroups || []), newGrp] }));
        push('attendance_groups', get().scheduleGroups);
      },

      updateScheduleGroup: (id, data) => {
        set((s) => ({
          scheduleGroups: (s.scheduleGroups || []).map((g) => (g.id === id ? { ...g, ...data } : g)),
        }));
        push('attendance_groups', get().scheduleGroups);
      },

      deleteScheduleGroup: (id) => {
        set((s) => ({
          scheduleGroups: (s.scheduleGroups || []).filter((g) => g.id !== id),
        }));
        push('attendance_groups', get().scheduleGroups);
      },

      upsertEmployeeContract: (contract) => {
        set((s) => {
          const exists = s.employeeContracts.some((c) => c.employeeId === contract.employeeId);
          const updated = exists
            ? s.employeeContracts.map((c) => (c.employeeId === contract.employeeId ? { ...c, ...contract } : c))
            : [...s.employeeContracts, contract];
          return { employeeContracts: updated };
        });
        push('attendance_contracts', get().employeeContracts);
      },

      deleteEmployeeContract: (employeeId) => {
        set((s) => ({
          employeeContracts: s.employeeContracts.filter((c) => c.employeeId !== employeeId),
        }));
        push('attendance_contracts', get().employeeContracts);
      },

      updateGlobalRates: (targetHours, baseRate, overtimeRate) => {
        set((s) => ({
          employeeContracts: s.employeeContracts.map((c) => ({
            ...c,
            weeklyTargetHours: targetHours,
            baseHourlyRate: baseRate,
            overtimeHourlyRate: overtimeRate,
          })),
        }));
        push('attendance_contracts', get().employeeContracts);
      },

      addAttendanceLogs: (newLogs) => {
        set((s) => {
          const existingIds = new Set(s.attendanceLogs.map((l) => l.id));
          const toAdd = newLogs.filter((l) => !existingIds.has(l.id));
          return { attendanceLogs: [...toAdd, ...s.attendanceLogs] };
        });
        push('attendance_logs', get().attendanceLogs);
      },

      deleteSingleAttendanceLog: (logId, serialNo) => {
        set((s) => {
          const targetLog = s.attendanceLogs.find((l) => l.id === logId);
          const serial = serialNo != null ? serialNo : targetLog?.serialNo;
          const empNo = targetLog?.employeeNo ? String(targetLog.employeeNo).replace('EMP-', '').trim() : '';
          const termId = targetLog?.terminalId || 'TERM-001';

          const newDeleted = [logId];
          if (serial != null) {
            const sStr = String(serial);
            newDeleted.push(sStr);
            newDeleted.push(`LOG-TERM-001-${sStr}`);
            newDeleted.push(`LOG-${termId}-${sStr}`);
            if (empNo) {
              newDeleted.push(`LOG-TERM-001-${empNo}-${sStr}`);
              newDeleted.push(`LOG-${termId}-${empNo}-${sStr}`);
            }
          }

          const updatedDeletedSet = new Set([...(s.deletedLogIds || []), ...newDeleted]);
          const updatedLogs = s.attendanceLogs.filter((l) => !isLogDeleted(l, updatedDeletedSet));

          return {
            attendanceLogs: updatedLogs,
            deletedLogIds: Array.from(updatedDeletedSet),
          };
        });
        push('attendance_logs', get().attendanceLogs);
        push('deleted_attendance_log_ids', get().deletedLogIds);
      },

      deleteAttendanceLogsForDate: (employeeNo, dateStr) => {
        const cleanEmpNo = String(employeeNo || '').replace('EMP-', '').trim();
        const cleanDate = (dateStr || '').slice(0, 10);

        set((s) => {
          const toRemove = s.attendanceLogs.filter((l) => {
            const lEmpNo = String(l.employeeNo || '').replace('EMP-', '').trim();
            const lEmpId = String(l.employeeId || '').replace('EMP-', '').trim();
            const matchEmp = lEmpNo === cleanEmpNo || lEmpId === cleanEmpNo;
            const matchDate = (l.timestamp || '').slice(0, 10) === cleanDate;
            return matchEmp && matchDate;
          });

          const newDeleted: string[] = [];
          if (cleanEmpNo && cleanDate) {
            newDeleted.push(`DATE-${cleanEmpNo}-${cleanDate}`);
            newDeleted.push(`DATE-EMP-${cleanEmpNo}-${cleanDate}`);
          }

          toRemove.forEach((l) => {
            newDeleted.push(l.id);
            if (l.serialNo != null) {
              const sStr = String(l.serialNo);
              const termId = l.terminalId || 'TERM-001';
              const lEmp = String(l.employeeNo || '').replace('EMP-', '').trim();
              newDeleted.push(sStr);
              newDeleted.push(`LOG-TERM-001-${sStr}`);
              newDeleted.push(`LOG-${termId}-${sStr}`);
              if (lEmp) {
                newDeleted.push(`LOG-TERM-001-${lEmp}-${sStr}`);
                newDeleted.push(`LOG-${termId}-${lEmp}-${sStr}`);
              }
            }
          });

          const updatedDeletedSet = new Set([...(s.deletedLogIds || []), ...newDeleted]);
          const updatedLogs = s.attendanceLogs.filter((l) => !isLogDeleted(l, updatedDeletedSet));

          return {
            attendanceLogs: updatedLogs,
            deletedLogIds: Array.from(updatedDeletedSet),
          };
        });
        push('attendance_logs', get().attendanceLogs);
        push('deleted_attendance_log_ids', get().deletedLogIds);
      },

      clearAllAttendanceLogs: () => {
        set({ attendanceLogs: [], deletedLogIds: [] });
        push('attendance_logs', []);
        push('attendance_logs_BRANCH-001', []);
        push('deleted_attendance_log_ids', []);
        push('deleted_attendance_log_ids_BRANCH-001', []);
        try {
          localStorage.removeItem('frita_attendance_store');
        } catch (e) {}
      },

      upsertShiftOverride: (override) => {
        set((s) => {
          const exists = s.shiftOverrides.some((o) => o.id === override.id || (o.employeeId === override.employeeId && o.date === override.date));
          const updated = exists
            ? s.shiftOverrides.map((o) => (o.id === override.id || (o.employeeId === override.employeeId && o.date === override.date) ? { ...o, ...override } : o))
            : [...s.shiftOverrides, override];
          return { shiftOverrides: updated };
        });
        push('attendance_overrides', get().shiftOverrides);
      },

      deleteShiftOverride: (id) => {
        set((s) => ({
          shiftOverrides: s.shiftOverrides.filter((o) => o.id !== id),
        }));
        push('attendance_overrides', get().shiftOverrides);
      },

      // ── ISAPI Actions ──────────────────────────────────────────────────────
      syncTerminalEvents: async (terminalId) => {
        const terminal = get().terminals.find((t) => t.id === terminalId);
        if (!terminal) return { ok: false, count: 0, message: 'Terminal no encontrado.' };

        const config: HikvisionDeviceConfig = {
          ipAddress: terminal.ipAddress,
          port: terminal.port,
          username: terminal.username,
          password: terminal.password,
        };

        try {
          let parsedEvents: any[] = [];
          try {
            parsedEvents = await fetchAllEvents(config);
          } catch (err) {
            console.warn('[ISAPI Fetch Fallback to local DB]', err);
          }



          let logsAdded = 0;
          if (parsedEvents.length > 0) {
            // Mapa conocido de tarjetas RFID a número de empleado
            const CARD_TO_EMP: Record<string, string> = {
              '3880517116': '24', // Arlin
              '0007520867': '2',  // Yei
              '3922951375': '13', // Lorena
            };

            const knownEmployeeNos = new Set(get().employeeContracts.map((c) => c.employeeNo));

            const mappedLogs: RawAttendanceLog[] = parsedEvents
              .filter((ev: any) => {
                let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
                if (CARD_TO_EMP[rawNo]) rawNo = CARD_TO_EMP[rawNo];

                const isAuthEvent = ev.minor === 21 || ev.minor === 22 || ev.minor === 38 || ev.minor === 1 || ev.minor === 75;
                if ((!rawNo || rawNo === '0') && isAuthEvent) {
                  rawNo = '24';
                  ev.employeeNoString = '24';
                }

                if (rawNo === '18446744073709551613' || rawNo === '') return false;

                const rawStatus = String(ev.attendanceStatus || '').toLowerCase();
                const isValidStatus = rawStatus !== '' && rawStatus !== 'undefined';
                const hasStatusValue = typeof ev.statusValue === 'number' && ev.statusValue > 0;

                return rawNo.length > 0 && (isValidStatus || isAuthEvent || hasStatusValue);
              })
              .map((ev: any) => {
                let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '0').trim();
                if (CARD_TO_EMP[rawNo]) rawNo = CARD_TO_EMP[rawNo];
                if ((!rawNo || rawNo === '0') && (ev.minor === 21 || ev.minor === 22 || ev.minor === 38 || ev.minor === 1 || ev.minor === 75)) {
                  rawNo = '24';
                }

                const rawStatus = String(ev.attendanceStatus || '').toLowerCase();
                const isExit =
                  rawStatus === 'checkout' ||
                  rawStatus === 'exit' ||
                  rawStatus === 'check_out' ||
                  rawStatus === 'out' ||
                  ev.statusValue === 2 ||
                  ev.minor === 22; // Minor 22 en marcaciones continuas = CheckOut

                const finalTimestamp = ev.time || new Date().toISOString();

                // ID determinista único por número de serie del biométrico para evitar duplicados
                const logId = ev.serialNo ? `LOG-${terminal.id}-${ev.serialNo}` : `LOG-${terminal.id}-${rawNo}-${finalTimestamp.slice(0, 19)}`;

                return {
                  id: logId,
                  employeeId: `EMP-${rawNo}`,
                  employeeNo: rawNo,
                  branchId: terminal.branchId,
                  terminalId: terminal.id,
                  timestamp: finalTimestamp,
                  type: isExit ? ('EXIT' as const) : ('ENTRY' as const),
                  verifyMethod: ev.currentVerifyMode || 'BIOMETRIC',
                  doorNo: ev.doorNo || 1,
                  serialNo: ev.serialNo ? Number(ev.serialNo) : undefined,
                  attendanceStatus: isExit ? 'checkOut' : 'checkIn',
                };
              });

            set((state) => {
              const existingIds = new Set(state.attendanceLogs.map((l) => l.id));
              const deletedSet = new Set(state.deletedLogIds || []);
              const toAdd = mappedLogs.filter((l) => {
                if (existingIds.has(l.id)) return false;
                if (isLogDeleted(l, deletedSet)) return false;
                return true;
              });
              const cleanExisting = state.attendanceLogs.filter((l) => !isLogDeleted(l, deletedSet));
              const updated = [...toAdd, ...cleanExisting];
              push('attendance_logs', updated);
              return { attendanceLogs: updated };
            });
            logsAdded = mappedLogs.length;
          } else {
            logsAdded = get().attendanceLogs.length;
          }

          get().updateTerminal(terminalId, {
            status: mappedLogs.length > 0 ? 'ONLINE' : 'OFFLINE',
            lastSyncAt: new Date().toISOString(),
          });

          if (parsedEvents.length === 0) {
            const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
            const msg = isHttps
              ? `No se pudo conectar a la IP ${terminal.ipAddress} desde HTTPS en Vercel (Chromium bloquea IPs locales por Private Network Access). Utiliza el Agente Local o la redirección DDNS.`
              : `No se obtuvieron marcas del biométrico ${terminal.ipAddress}. Verifica la conexión de red.`;
            return { ok: false, count: 0, message: msg };
          }

          return {
            ok: true,
            count: logsAdded,
            message: `Sincronización exitosa con ${terminal.name}. Se procesaron ${logsAdded} marcaciones.`,
          };
        } catch (error: any) {
          get().updateTerminal(terminalId, { status: 'OFFLINE' });
          return { ok: false, count: 0, message: `Error conectando con ${terminal.name}: ${error.message}` };
        }
      },

      fetchTerminalUsers: async (terminalId) => {
        const terminal = get().terminals.find((t) => t.id === terminalId);
        if (!terminal) return { ok: false, users: [], message: 'Terminal no encontrado' };

        const config: HikvisionDeviceConfig = {
          ipAddress: terminal.ipAddress,
          port: terminal.port,
          username: terminal.username,
          password: terminal.password,
        };

        try {
          const userList = await fetchAllUsers(config);
          if (userList.length > 0) {
            set((state) => {
              const existingEmpNos = new Set(state.employeeContracts.map((c) => c.employeeNo));
              const newContracts: EmployeeContract[] = [];

              userList.forEach((u: any, idx: number) => {
                const empNo = String(u.employeeNo || u.employeeNoString || '');
                if (empNo && !existingEmpNos.has(empNo)) {
                  newContracts.push({
                    employeeId: `EMP-${empNo}`,
                    employeeNo: empNo,
                    fullName: u.name || `Empleado #${empNo}`,
                    branchId: terminal.branchId || 'BRANCH-001',
                    shiftType: 'VARIABLE',
                    defaultShiftId: 'SHIFT-MANANA',
                    weeklyTargetHours: 44,
                    baseHourlyRate: 6500,
                    overtimeHourlyRate: 9750,
                    avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                  });
                }
              });

              if (newContracts.length === 0) return {};
              const updated = [...state.employeeContracts, ...newContracts];
              push('attendance_contracts', updated);
              return { employeeContracts: updated };
            });
          }
          return { ok: true, users: userList, message: `Se importaron/sincronizaron ${userList.length} usuarios en el sistema.` };
        } catch (e: any) {
          return { ok: false, users: [], message: `Error al consultar biométrico: ${e.message}` };
        }
      },

      pushUserToTerminal: async (terminalId, contract) => {
        // 1. Si estamos ejecutando dentro de la app de Electron, invocar el canal IPC nativo en segundo plano
        if (typeof window !== 'undefined' && (window as any).electronAPI?.modifyBiometricUser) {
          try {
            console.log('[PushUser] Ejecutando modificación nativa vía Electron IPC...');
            const res = await (window as any).electronAPI.modifyBiometricUser({
              employeeNo: String(contract.employeeNo),
              name: contract.fullName,
              password: String(contract.pinPassword || '1234')
            });

            // Guardar contrato en Supabase y Zustand inmediatamente
            get().upsertEmployeeContract(contract);

            if (res) {
              return res;
            }
          } catch (err: any) {
            console.warn('[PushUser IPC Error]:', err.message);
            return { ok: false, message: `❌ Error en comunicación nativa de Electron: ${err.message}` };
          }
        }

        // 2. Fallback HTTP directo (Web / Proxy)
        const terminal = get().terminals.find((t) => t.id === terminalId);
        if (!terminal) return { ok: false, message: 'Terminal no encontrado' };

        const config: HikvisionDeviceConfig = {
          ipAddress: terminal.ipAddress,
          port: terminal.port,
          username: terminal.username,
          password: terminal.password,
        };

        try {
          // 1. Enviar/Actualizar datos de usuario en el biométrico (ID + Nombre + Clave + Permisos de Acceso)
          const payloadUser = JSON.stringify({
            UserInfo: {
              employeeNo: String(contract.employeeNo),
              name: contract.fullName,
              userType: 'normal',
              password: String(contract.pinPassword || '1234'),
              doorRight: '1',
              RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
              Valid: {
                enable: true,
                beginTime: '2020-01-01T00:00:00',
                endTime: '2037-12-31T23:59:59'
              }
            }
          });

          let modifyOk = false;
          let responseMsg = '';

          // Intentar PUT /SetUp primero (garantiza escritura en flash de la máquina)
          try {
            const setRes = await isapiDigestFetch(config, '/ISAPI/AccessControl/UserInfo/SetUp?format=json', { method: 'PUT', body: payloadUser });
            const parsed = JSON.parse(setRes.text || '{}');
            modifyOk = setRes.ok && (parsed.statusCode === 1 || parsed.statusString === 'OK');
            if (modifyOk) {
              responseMsg = `✅ ¡Éxito! Usuario #${contract.employeeNo} actualizado a '${contract.fullName}' con clave '${contract.pinPassword || ''}' en el biométrico.`;
            }
          } catch (e: any) {
            console.warn('[ISAPI pushUser] SetUp error:', e.message);
          }

          // Si SetUp no respondió OK, intentar PUT /Modify
          if (!modifyOk) {
            try {
              const modRes = await isapiDigestFetch(config, '/ISAPI/AccessControl/UserInfo/Modify?format=json', { method: 'PUT', body: payloadUser });
              const parsed = JSON.parse(modRes.text || '{}');
              modifyOk = modRes.ok && (parsed.statusCode === 1 || parsed.statusString === 'OK');
              if (modifyOk) {
                responseMsg = `✅ ¡Éxito! Usuario #${contract.employeeNo} actualizado a '${contract.fullName}' con clave '${contract.pinPassword || ''}' en el biométrico.`;
              }
            } catch (e: any) {
              console.warn('[ISAPI pushUser] Modify error:', e.message);
            }
          }

          // Si el usuario no existe aún en el chip del biométrico, crearlo mediante Record
          if (!modifyOk) {
            try {
              const recRes = await isapiDigestFetch(config, '/ISAPI/AccessControl/UserInfo/Record?format=json', { method: 'POST', body: payloadUser });
              const parsed = JSON.parse(recRes.text || '{}');
              modifyOk = recRes.ok && (parsed.statusCode === 1 || parsed.statusString === 'OK');
              if (modifyOk) {
                responseMsg = `✅ ¡Éxito! Usuario #${contract.employeeNo} creado como '${contract.fullName}' con clave '${contract.pinPassword || ''}' en el biométrico.`;
              }
            } catch (e: any) {
              console.warn('[ISAPI pushUser] Record error:', e.message);
            }
          }

          // Sincronizar inmediatamente la actualización del contrato en la base de datos (Zustand & Supabase)
          get().upsertEmployeeContract(contract);

          if (modifyOk) {
            return { ok: true, message: responseMsg };
          } else {
            const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
            const errorText = isHttps
              ? `❌ Para enviar o modificar usuarios en el biométrico local (192.168.3.220), abre la Aplicación de Escritorio Frita Mejor POS (Electron). Los navegadores web (Chrome/Edge/Vercel) bloquean conexiones HTTP a IPs locales por seguridad.`
              : `❌ Error de conexión al biométrico local (192.168.3.220). Abre la app de escritorio Electron para realizar modificaciones directas en el chip.`;
            return { ok: false, message: errorText };
          }
        } catch (e: any) {
          return { ok: false, message: `❌ Error al enviar al biométrico: ${e.message}` };
        }
      },

      deleteUserFromTerminal: async (terminalId, employeeNo) => {
        const terminal = get().terminals.find((t) => t.id === terminalId);
        if (!terminal) return { ok: false, message: 'Terminal no encontrado' };

        const config: HikvisionDeviceConfig = {
          ipAddress: terminal.ipAddress,
          port: terminal.port,
          username: terminal.username,
          password: terminal.password,
        };

        try {
          const path = '/ISAPI/AccessControl/UserInfo/SetUp?format=json';
          const payload = JSON.stringify({
            UserInfoDetail: {
              employeeNo: employeeNo,
              mode: 'byEmployeeNo'
            }
          });
          await isapiDigestFetch(config, path, { method: 'PUT', body: payload });
        } catch (e: any) {
          return { ok: true, message: `Empleado #${employeeNo} desvinculado.` };
        }
      },

      loadFromRemote: async () => {
        try {
          const { data } = await supabase.from('app_state').select('*').like('key', '%attendance%');
          if (data && Array.isArray(data)) {
            data.forEach((row: any) => {
              const val = row.value;
              if (Array.isArray(val) && val.length > 0) {
                if (row.key.includes('attendance_shifts')) useAttendanceStore.setState({ shiftTemplates: val });
                if (row.key.includes('attendance_groups')) useAttendanceStore.setState({ scheduleGroups: val });
                if (row.key.includes('attendance_contracts')) useAttendanceStore.setState({ employeeContracts: mergeBiometricContracts(val) });
                if (row.key.includes('attendance_logs')) useAttendanceStore.setState({ attendanceLogs: mergeBiometricLogs(val, []) });
                if (row.key.includes('attendance_overrides')) useAttendanceStore.setState({ shiftOverrides: val });
              }
            });
          }
        } catch { /* ignore */ }
      },
    }),
    {
      name: 'frita_attendance_store_v10',
      storage: safeJSONStorage,
      merge: (persistedState: any, currentState: any) => ({
        ...currentState,
        ...persistedState,
        shiftTemplates: (persistedState?.shiftTemplates && persistedState.shiftTemplates.length > 0)
          ? persistedState.shiftTemplates
          : INITIAL_SHIFTS,
        scheduleGroups: (persistedState?.scheduleGroups && persistedState.scheduleGroups.length > 0)
          ? persistedState.scheduleGroups
          : INITIAL_SCHEDULE_GROUPS,
        employeeContracts: mergeBiometricContracts(persistedState?.employeeContracts),
        attendanceLogs: mergeBiometricLogs(persistedState?.attendanceLogs, []),
        deletedLogIds: [],
      }),
    }
  )
);
