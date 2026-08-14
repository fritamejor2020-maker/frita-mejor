import React, { useState, useRef, useMemo } from 'react';
import { AttendanceToolbar } from './components/AttendanceToolbar';
import { TimelineGridPanel } from './components/TimelineGridPanel';
import { ShiftDetailModal } from './components/ShiftDetailModal';
import { WeeklyPayrollModal } from './components/WeeklyPayrollModal';
import { ShiftTemplatesModal } from './components/ShiftTemplatesModal';
import { AdminEmployeeBiometricsModal } from '../admin/AdminEmployeeBiometricsModal';
import { useAttendanceData, EmployeeWeeklyPayroll, DailyShiftBlock } from './hooks/useAttendanceData';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, CheckCircle2, AlertCircle, LogOut, ArrowLeft, RefreshCw, Calendar } from 'lucide-react';

export function AttendanceView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<Date>(new Date());
  
  const weekStartDate = useMemo(() => {
    const d = new Date(activeDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [activeDate]);

  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedBlock, setSelectedBlock] = useState<DailyShiftBlock | null>(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showShiftTemplatesModal, setShowShiftTemplatesModal] = useState(false);
  const [selectedPayrollEmp, setSelectedPayrollEmp] = useState<EmployeeWeeklyPayroll | undefined>(undefined);

  const [showBioModal, setShowBioModal] = useState(false);
  const [selectedBioEmpNo, setSelectedBioEmpNo] = useState<string | undefined>(undefined);

  const selectedDateStr = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = String(activeDate.getMonth() + 1).padStart(2, '0');
    const day = String(activeDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [activeDate]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modales
  const [activeDetail, setActiveDetail] = useState<{
    emp: EmployeeWeeklyPayroll;
    dateStr: string;
    block?: DailyShiftBlock;
  } | null>(null);

  const { weekDays, payrollList } = useAttendanceData(selectedBranchId, weekStartDate);
  const { terminals, syncTerminalEvents, fetchTerminalUsers, clearAllAttendanceLogs, loadFromRemote } = useAttendanceStore();

  React.useEffect(() => {
    loadFromRemote();
  }, [loadFromRemote]);

  const handleClearLogs = () => {
    if (window.confirm('¿Estás seguro de borrar todos los registros de asistencia mostrados? Se limpiará la pantalla.')) {
      clearAllAttendanceLogs();
    }
  };

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

    try {
      // 0. Si se ejecuta dentro de la app de escritorio Electron, ejecutar extracción nativa IPC y finalizar de inmediato
      if ((window as any).cajeroAPI?.syncBiometric) {
        console.log('[AttendanceView] Invocando extracción nativa de biométrico vía cajeroAPI IPC...');
        const res = await (window as any).cajeroAPI.syncBiometric();
        console.log('[AttendanceView IPC Result]', res);
        setIsSyncing(false);
        return;
      }

      const term = terminals[0];
      if (term) {
        // 1. Sincronizar usuarios completos del biométrico
        await fetchTerminalUsers(term.id);
        // 2. Sincronizar marcaciones de asistencia en tiempo real
        const res = await syncTerminalEvents(term.id);
        if (res && res.message) {
          console.log('[Sync Terminal Result]', res);
        }
      }
    } catch (err: any) {
      console.error('[AttendanceView Sync Error]', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-Sincronizar Biométrico de forma transparente al entrar al módulo Asistencia & Turnos
  React.useEffect(() => {
    handleSyncTerminal();
  }, []);

  return (
    <div ref={containerRef} className="p-3 sm:p-6 max-w-[1700px] mx-auto min-h-screen bg-gray-50/60 font-sans">
      {/* Header Superior */}
      <div className="flex items-center justify-between gap-4 mb-3">
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

        {/* Botón Cerrar Sesión Arriba */}
        <button
          onClick={signOut}
          className="h-8 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs flex-shrink-0"
          title="Cerrar Sesión"
        >
          <LogOut size={14} />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* Toolbar de Navegación y Filtros (Cápsula Unificada) */}
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
        onClearLogs={handleClearLogs}
        onOpenShiftTemplates={() => setShowShiftTemplatesModal(true)}
        onOpenPayrollModal={() => {
          setSelectedPayrollEmp(undefined);
          setShowPayrollModal(true);
        }}
        onOpenBioModal={() => {
          setSelectedBioEmpNo(undefined);
          setShowBioModal(true);
        }}
        isSyncing={isSyncing}
      />

      {/* Layout de Cuadrícula Unificado (Nombres + Fechas Sincronizados al 100%) */}
      <TimelineGridPanel
        viewMode={viewMode}
        selectedDateStr={selectedDateStr}
        weekDays={viewMode === 'week' ? weekDays : [weekDays[0]]}
        payrollList={payrollList}
        onSelectEmployee={(emp) => {
          setSelectedBioEmpNo(emp.employeeNo);
          setShowBioModal(true);
        }}
        onManageEmployees={() => {
          setSelectedBioEmpNo(undefined);
          setShowBioModal(true);
        }}
        onSelectBlock={(emp, dateStr, block) => {
          setActiveDetail({ emp, dateStr, block });
        }}
        onAddBlock={(emp, dateStr) => {
          setActiveDetail({ emp, dateStr });
        }}
      />

      {/* Modales */}
      {showShiftTemplatesModal && (
        <ShiftTemplatesModal
          onClose={() => setShowShiftTemplatesModal(false)}
        />
      )}

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
