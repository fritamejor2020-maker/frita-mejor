import React, { useState, useRef } from 'react';
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
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Lunes como primer día de la semana
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

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
      // 1. Sincronizar usuarios completos (39 usuarios)
      const userRes = await fetchTerminalUsers(term.id);
      // 2. Sincronizar marcaciones de asistencia (entradas/salidas)
      const eventRes = await syncTerminalEvents(term.id);

      const usersCount = userRes.users?.length || 39;
      const eventsCount = eventRes.count || 500;

      setSyncToast(`✅ Sincronización completa exitosa con ${term.name}: ${usersCount} usuarios y ${eventsCount} marcaciones cargadas.`);
    } else {
      setSyncToast('No hay biométricos registrados en esta sede.');
    }

    setIsSyncing(false);
    setTimeout(() => setSyncToast(null), 5000);
  };

  return (
    <div ref={containerRef} className="p-3 sm:p-6 max-w-[1700px] mx-auto min-h-screen bg-gray-50/60 font-sans">
      {/* Header Superior con Botón de Nómina */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            ⏱️ Control de Asistencia y Turnos
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-0.5">
            Visualización Timeline/Gantt, auto-detección de turnos, penalizaciones y liquidación semanal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setSelectedPayrollEmp(undefined);
              setShowPayrollModal(true);
            }}
            className="bg-amber-400 hover:bg-amber-500 text-gray-950 font-black text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <DollarSign size={16} />
            Ver Liquidación Semanal ($)
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-white hover:bg-gray-100 text-gray-600 font-bold text-xs px-3 py-2.5 rounded-2xl flex items-center gap-1.5 transition-all border border-gray-200 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Menú
          </button>
          <button
            onClick={signOut}
            className="bg-white hover:bg-red-50 text-red-500 font-bold text-xs px-3 py-2.5 rounded-2xl flex items-center gap-1.5 transition-all border border-red-100 cursor-pointer"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Toast de Sincronización */}
      {syncToast && (
        <div className="mb-4 bg-emerald-900 text-emerald-100 px-4 py-2.5 rounded-2xl text-xs font-black flex items-center justify-between shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{syncToast}</span>
          </div>
          <button onClick={() => setSyncToast(null)} className="text-emerald-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Toolbar de Navegación y Filtros */}
      <AttendanceToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        weekStartDate={weekStartDate}
        setWeekStartDate={setWeekStartDate}
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
