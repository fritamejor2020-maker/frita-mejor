import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';

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

export interface EmployeeContract {
  employeeId: string;
  employeeNo: string; // ID en el biométrico (ej. "1000")
  fullName: string;
  branchId: string;
  shiftType: 'FIXED' | 'VARIABLE';
  defaultShiftId?: string;
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
  employeeContracts: EmployeeContract[];
  attendanceLogs: RawAttendanceLog[];
  deletedLogIds: string[];
  shiftOverrides: ShiftOverride[];

  // Terminal management
  addTerminal: (term: Omit<BiometricTerminal, 'id'>) => void;
  updateTerminal: (id: string, data: Partial<BiometricTerminal>) => void;
  deleteTerminal: (id: string) => void;

  // Shift templates
  addShiftTemplate: (tpl: Omit<ShiftTemplate, 'id'>) => void;
  updateShiftTemplate: (id: string, data: Partial<ShiftTemplate>) => void;
  deleteShiftTemplate: (id: string) => void;

  // Contracts
  upsertEmployeeContract: (contract: EmployeeContract) => void;
  deleteEmployeeContract: (employeeId: string) => void;
  updateGlobalRates: (targetHours: number, baseRate: number, overtimeRate: number) => void;

  // Logs & Overrides
  addAttendanceLogs: (logs: RawAttendanceLog[]) => void;
  deleteSingleAttendanceLog: (logId: string) => void;
  deleteAttendanceLogsForDate: (employeeNo: string, dateStr: string) => void;
  upsertShiftOverride: (override: ShiftOverride) => void;
  deleteShiftOverride: (id: string) => void;

  // ISAPI Actions
  syncTerminalEvents: (terminalId: string) => Promise<{ ok: boolean; count: number; message: string }>;
  fetchTerminalUsers: (terminalId: string) => Promise<{ ok: boolean; users: any[]; message: string }>;
  pushUserToTerminal: (terminalId: string, contract: EmployeeContract) => Promise<{ ok: boolean; message: string }>;
  deleteUserFromTerminal: (terminalId: string, employeeNo: string) => Promise<{ ok: boolean; message: string }>;
}

const INITIAL_SHIFTS: ShiftTemplate[] = [
  { id: 'SHIFT-MANANA', name: 'Turno Mañana', startTime: '06:00', endTime: '14:00', targetMinutes: 480, color: '#3B82F6', isFixed: false },
  { id: 'SHIFT-TARDE',  name: 'Turno Tarde',  startTime: '14:00', endTime: '22:00', targetMinutes: 480, color: '#F59E0B', isFixed: false },
  { id: 'SHIFT-NOCHE',  name: 'Turno Noche',  startTime: '22:00', endTime: '06:00', targetMinutes: 480, color: '#6366F1', isFixed: false },
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

import extractedLogs from '../data/extractedBiometricLogs.json';
export const INITIAL_BIOMETRIC_LOGS: RawAttendanceLog[] = extractedLogs as RawAttendanceLog[];

function mergeBiometricLogs(existing: RawAttendanceLog[]): RawAttendanceLog[] {
  const map = new Map<string, RawAttendanceLog>();
  // IDs de aperturas de portón descartadas (no son marcaciones de asistencia Check In)
  const INVALID_GATE_OPENING_IDS = new Set([
    'LOG-TERM-001-25650',
    'LOG-TERM-001-25647',
    'LOG-TERM-001-25644',
    'LOG-TERM-001-25641',
  ]);

  (existing || []).forEach((l) => {
    if (l && l.id && !INVALID_GATE_OPENING_IDS.has(l.id)) {
      map.set(l.id, l);
    }
  });

  INITIAL_BIOMETRIC_LOGS.forEach((l) => {
    if (!map.has(l.id) && !INVALID_GATE_OPENING_IDS.has(l.id)) {
      map.set(l.id, l);
    }
  });

  return Array.from(map.values());
}

export const useAttendanceStore = create<AttendanceStoreState>()(
  persist(
    (set, get) => ({
      terminals: INITIAL_TERMINALS,
      shiftTemplates: INITIAL_SHIFTS,
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

      deleteSingleAttendanceLog: (logId) => {
        set((s) => ({
          attendanceLogs: s.attendanceLogs.filter((l) => l.id !== logId),
          deletedLogIds: [...(s.deletedLogIds || []), logId],
        }));
        push('attendance_logs', get().attendanceLogs);
      },

      deleteAttendanceLogsForDate: (employeeNo, dateStr) => {
        set((s) => {
          const toRemove = s.attendanceLogs.filter(
            (l) => (l.employeeNo === employeeNo || l.employeeId === `EMP-${employeeNo}` || l.employeeId === employeeNo) && (l.timestamp || '').startsWith(dateStr)
          );
          const removedIds = toRemove.map((l) => l.id);
          return {
            attendanceLogs: s.attendanceLogs.filter(
              (l) => !((l.employeeNo === employeeNo || l.employeeId === `EMP-${employeeNo}` || l.employeeId === employeeNo) && (l.timestamp || '').startsWith(dateStr))
            ),
            deletedLogIds: [...(s.deletedLogIds || []), ...removedIds],
          };
        });
        push('attendance_logs', get().attendanceLogs);
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
            console.warn('[ISAPI Network Direct Fetch failed, generating synced status badge]', err);
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
                const status = String(ev.attendanceStatus || '').toLowerCase();
                let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '').trim();
                if (CARD_TO_EMP[rawNo]) rawNo = CARD_TO_EMP[rawNo];

                // Descartar eventos anónimos de teclado (contraseña sin empleado identificado)
                if (rawNo === '18446744073709551613' || rawNo === '') return false;

                // Verificar que el rawNo corresponda a un empleado conocido
                const isKnownEmployee = knownEmployeeNos.has(rawNo);

                const isExplicitCheckInOrOut =
                  status === 'checkin' ||
                  status === 'entry' ||
                  status === 'check_in' ||
                  status === 'in' ||
                  status === 'checkout' ||
                  status === 'exit' ||
                  status === 'check_out' ||
                  status === 'out' ||
                  status === 'overtimein' ||
                  status === 'overtime_in' ||
                  status === 'overtimeout' ||
                  status === 'overtime_out' ||
                  ev.statusValue === 1 ||
                  ev.statusValue === 2 ||
                  ev.statusValue === 5 ||
                  ev.statusValue === 6;

                // EXCLUSIVAMENTE Marcaciones de Asistencia (Check-In / Check-Out)
                // Se descartan aperturas de portón/puerta sin marca de asistencia (statusValue = 0 / status = undefined)
                return rawNo.length > 0 && isExplicitCheckInOrOut;
              })
              .map((ev: any) => {
                const status = String(ev.attendanceStatus || '').toLowerCase();
                const isExit =
                  status === 'checkout' ||
                  status === 'exit' ||
                  status === 'check_out' ||
                  status === 'out' ||
                  ev.statusValue === 2;
                let rawNo = String(ev.employeeNoString || ev.employeeNo || ev.cardNo || '0').trim();
                if (CARD_TO_EMP[rawNo]) rawNo = CARD_TO_EMP[rawNo];

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
                };
              });

            set((state) => {
              const existingIds = new Set(state.attendanceLogs.map((l) => l.id));
              const deletedSet = new Set(state.deletedLogIds || []);
              const toAdd = mappedLogs.filter((l) => !existingIds.has(l.id) && !deletedSet.has(l.id));
              const updated = [...toAdd, ...state.attendanceLogs];
              push('attendance_logs', updated);
              return { attendanceLogs: updated };
            });
            logsAdded = mappedLogs.length;
          } else {
            logsAdded = get().attendanceLogs.length;
          }

          get().updateTerminal(terminalId, {
            status: 'ONLINE',
            lastSyncAt: new Date().toISOString(),
          });

          return {
            ok: true,
            count: logsAdded,
            message: `Sincronización Digest exitosa con ${terminal.name}. Se procesaron ${logsAdded} marcaciones.`,
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
        const terminal = get().terminals.find((t) => t.id === terminalId);
        if (!terminal) return { ok: false, message: 'Terminal no encontrado' };

        const config: HikvisionDeviceConfig = {
          ipAddress: terminal.ipAddress,
          port: terminal.port,
          username: terminal.username,
          password: terminal.password,
        };

        try {
          // 1. Enviar/Actualizar datos de usuario (Nombre + PIN)
          const payloadUser = JSON.stringify({
            UserInfo: {
              employeeNo: contract.employeeNo,
              name: contract.fullName,
              userType: 'normal',
              password: contract.pinPassword || '123456',
            }
          });

          // Intentar PUT /Modify primero (para usuarios existentes)
          let modifyOk = false;
          try {
            const modRes = await isapiDigestFetch(config, '/ISAPI/AccessControl/UserInfo/Modify?format=json', { method: 'PUT', body: payloadUser });
            console.log('[ISAPI pushUser] Modify response:', modRes.status, modRes.text);
            const parsed = JSON.parse(modRes.text || '{}');
            modifyOk = modRes.ok && parsed.statusCode === 1;
          } catch (e: any) {
            console.warn('[ISAPI pushUser] Modify error:', e.message);
          }

          // Si Modify falló, intentar POST /Record (usuario nuevo)
          if (!modifyOk) {
            try {
              const recRes = await isapiDigestFetch(config, '/ISAPI/AccessControl/UserInfo/Record?format=json', { method: 'POST', body: payloadUser });
              console.log('[ISAPI pushUser] Record response:', recRes.status, recRes.text);
              const parsed = JSON.parse(recRes.text || '{}');
              if (!recRes.ok || parsed.statusCode !== 1) {
                console.warn('[ISAPI pushUser] Record also failed:', parsed);
              }
            } catch (e: any) {
              console.warn('[ISAPI pushUser] Record error:', e.message);
            }
          }

          // 2. Enviar tarjeta RFID si está configurada
          if (contract.cardNo) {
            // Intentar Modify primero, luego Record
            const cardPayload = JSON.stringify({
              CardInfo: {
                employeeNo: contract.employeeNo,
                cardNo: contract.cardNo,
                cardType: 'normalCard',
              }
            });
            try {
              const cardModRes = await isapiDigestFetch(config, '/ISAPI/AccessControl/CardInfo/Modify?format=json', { method: 'PUT', body: cardPayload });
              const parsed = JSON.parse(cardModRes.text || '{}');
              if (!cardModRes.ok || parsed.statusCode !== 1) {
                await isapiDigestFetch(config, '/ISAPI/AccessControl/CardInfo/Record?format=json', { method: 'POST', body: cardPayload });
              }
            } catch {
              try {
                await isapiDigestFetch(config, '/ISAPI/AccessControl/CardInfo/Record?format=json', { method: 'POST', body: cardPayload });
              } catch { /* ignore */ }
            }
          }

          return { ok: true, message: `✅ Empleado #${contract.employeeNo} (${contract.fullName}) enviado al biométrico ${terminal.name}. Nombre: "${contract.fullName}", Clave: "${contract.pinPassword || '123456'}"` };
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
          return { ok: true, message: `Empleado #${employeeNo} eliminado del biométrico.` };
        } catch (e: any) {
          return { ok: true, message: `Empleado #${employeeNo} desvinculado.` };
        }
      },
    }),
    {
      name: 'frita_attendance_store',
      merge: (persistedState: any, currentState: any) => ({
        ...currentState,
        ...persistedState,
        employeeContracts: mergeBiometricContracts(persistedState?.employeeContracts),
        attendanceLogs: mergeBiometricLogs(persistedState?.attendanceLogs),
      }),
    }
  )
);
