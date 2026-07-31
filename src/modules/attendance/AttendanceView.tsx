import React, { useState, useRef, useMemo } from 'react';
import { AttendanceToolbar } from './components/AttendanceToolbar';
import { EmployeeStickyPanel } from './components/EmployeeStickyPanel';
import { TimelineGridPanel } from './components/TimelineGridPanel';
import { ShiftDetailModal } from './components/ShiftDetailModal';
import { WeeklyPayrollModal } from './components/WeeklyPayrollModal';
import { AdminEmployeeBiometricsModal } from '../admin/AdminEmployeeBiometricsModal';
import { useAttendanceData, EmployeeWeeklyPayroll, DailyShiftBlock } from './hooks/useAttendanceData';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, CheckCircle2, AlertCircle, LogOut, ArrowLeft } from 'lucide-react';

export function AttendanceView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<Date>(new Date());

  const selectedDateStr = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = String(activeDate.getMonth() + 1).padStart(2, '0');
    const day = String(activeDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [activeDate]);

  const weekStartDate = useMemo(() => {
    const day = activeDate.getDay();
    const diff = day === 0 ? 6 : day - 1; // Lunes como primer día de la semana
    const monday = new Date(activeDate);
    monday.setDate(activeDate.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [activeDate]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Modales
  const [activeDetail, setActiveDetail] = useState<{
    emp: EmployeeWeeklyPayroll;
    dateStr: string;
    block?: DailyShiftBlock;
  } | null>(null);

  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedPayrollEmp, setSelectedPayrollEmp] = useState<EmployeeWeeklyPayroll | undefined>(undefined);

  const [showBioModal, setShowBioModal] = useState(false);
  const [selectedBioEmpNo, setSelectedBioEmpNo] = useState<string | undefined>(undefined);

  const { weekDays, payrollList } = useAttendanceData(selectedBranchId, weekStartDate);
  const { terminals, syncTerminalEvents, fetchTerminalUsers } = useAttendanceStore();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSyncTerminal = async () => {
    setIsSyncing(true);
    setSyncToast('Conectando y realizando extracción completa del biométrico (Usuarios + Marcaciones ISAPI Digest)...');

    const term = terminals[0];
    if (term) {
      // 1. Sincronizar usuarios completos
      const userRes = await fetchTerminalUsers(term.id);
      // 2. Sincronizar marcaciones de asistencia (entradas/salidas manuales)
      const eventRes = await syncTerminalEvents(term.id);

      const currentContracts = useAttendanceStore.getState().employeeContracts;
      const currentLogs = useAttendanceStore.getState().attendanceLogs;

      const usersCount = userRes.users?.length || currentContracts.length;
      const eventsCount = typeof eventRes.count === 'number' ? eventRes.count : currentLogs.length;

      setSyncToast(`✅ Sincronización completa exitosa con ${term.name}: ${usersCount} usuarios y ${eventsCount} marcaciones de asistencia cargadas.`);
    } else {
      setSyncToast('No hay biométricos registrados en esta sede.');
    }

    setIsSyncing(false);
    setTimeout(() => setSyncToast(null), 5000);
  };

  return (
    <div ref={containerRef} className="p-3 sm:p-6 max-w-[1700px] mx-auto min-h-screen bg-gray-50/60 font-sans">
      {/* Header Superior con Botón de Nómina */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-white hover:bg-gray-100 rounded-xl text-gray-700 font-bold border border-gray-200 flex items-center gap-1.5 text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft size={16} /> Menú
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Clock className="text-amber-500" size={26} /> Control de Asistencia y Turnos
            </h1>
            <p className="text-xs text-gray-500 font-medium hidden sm:block">
              Visualización Timeline/Gantt, auto-detección de turnos, penalizaciones y liquidación semanal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedPayrollEmp(undefined);
              setShowPayrollModal(true);
            }}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer border border-amber-300"
          >
            <DollarSign size={18} /> Ver Liquidación Semanal ($)
          </button>
          <button
            onClick={signOut}
            className="p-2.5 text-red-600 hover:bg-red-50 rounded-2xl transition-colors border border-red-200 cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Cerrar Sesión"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Banner de Estado de Sincronización */}
      {syncToast && (
        <div className="mb-4 bg-emerald-600 text-white font-black text-xs sm:text-sm p-3.5 rounded-2xl shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{syncToast}</span>
          </div>
        </div>
      )}

      {/* Toolbar de Navegación y Filtros */}
      <AttendanceToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeDate={activeDate}
        setActiveDate={setActiveDate}
        selectedBranchId={selectedBranchId}
        setSelectedBranchId={setSelectedBranchId}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        onSyncTerminal={handleSyncTerminal}
        isSyncing={isSyncing}
      />

      {/* Layout Split-Pane Principal (Panel Izquierdo Sticky + Cuadrícula Derecha Scrollable) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row relative">
        <EmployeeStickyPanel
          payrollList={payrollList}
          onSelectEmployee={(emp) => {
            setSelectedBioEmpNo(emp.employeeNo);
            setShowBioModal(true);
          }}
          onManageEmployees={() => {
            setSelectedBioEmpNo(undefined);
            setShowBioModal(true);
          }}
        />

        <TimelineGridPanel
          viewMode={viewMode}
          selectedDateStr={selectedDateStr}
          weekDays={viewMode === 'week' ? weekDays : [weekDays[0]]}
          payrollList={payrollList}
          onSelectBlock={(emp, dateStr, block) => {
            setActiveDetail({ emp, dateStr, block });
          }}
          onAddBlock={(emp, dateStr) => {
            setActiveDetail({ emp, dateStr });
          }}
        />
      </div>

      {/* Modales */}
      {showBioModal && (
        <AdminEmployeeBiometricsModal
          initialSelectedEmployeeNo={selectedBioEmpNo}
          onClose={() => setShowBioModal(false)}
        />
      )}

      {activeDetail && (
        <ShiftDetailModal
          employee={activeDetail.emp}
          dateStr={activeDetail.dateStr}
          block={activeDetail.block}
          onClose={() => setActiveDetail(null)}
        />
      )}

      {showPayrollModal && (
        <WeeklyPayrollModal
          payrollList={payrollList}
          weekDays={weekDays}
          selectedEmployee={selectedPayrollEmp}
          onClose={() => setShowPayrollModal(false)}
        />
      )}
    </div>
  );
}

export default AttendanceView;
