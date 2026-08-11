import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Maximize2, Minimize2, RefreshCw, Building, Database, Trash2 } from 'lucide-react';
import { useBranchStore } from '../../../store/useBranchStore';
import { useAuthStore } from '../../../store/useAuthStore';

interface AttendanceToolbarProps {
  viewMode: 'week' | 'day';
  setViewMode: (mode: 'week' | 'day') => void;
  activeDate: Date;
  setActiveDate: (d: Date) => void;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  onSyncTerminal: () => void;
  onClearLogs?: () => void;
  onOpenShiftTemplates?: () => void;
  isSyncing: boolean;
}

export function AttendanceToolbar({
  viewMode,
  setViewMode,
  activeDate,
  setActiveDate,
  selectedBranchId,
  setSelectedBranchId,
  isFullscreen,
  toggleFullscreen,
  onSyncTerminal,
  onClearLogs,
  onOpenShiftTemplates,
  isSyncing,
}: AttendanceToolbarProps) {
  const { branches = [] } = useBranchStore();
  const { user } = useAuthStore();
  const isManager = user?.role === 'MANAGER';
  const allowedBranches: string[] = isManager
    ? (user?.allowedBranches?.length > 0 ? user.allowedBranches : user?.branchId ? [user.branchId] : [])
    : [];
  const filteredBranches = isManager
    ? branches.filter((b: any) => allowedBranches.includes(b.id))
    : branches;

  // Navegar semana/día previo o siguiente
  const handlePrev = () => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 1));
    setActiveDate(d);
  };

  const handleNext = () => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 1));
    setActiveDate(d);
  };

  const handleToday = () => {
    setActiveDate(new Date());
  };

  // Rango formateado ej. "Viernes, 31 de Julio de 2026"
  const getFormattedRange = () => {
    if (viewMode === 'day') {
      const formatted = activeDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    const day = activeDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(activeDate);
    monday.setDate(activeDate.getDate() - diff);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDay = monday.getDate();
    const startMonth = monday.toLocaleDateString('es-CO', { month: 'short' });
    const endDay = sunday.getDate();
    const endMonth = sunday.toLocaleDateString('es-CO', { month: 'short' });
    const year = sunday.getFullYear();

    return `De ${startDay} ${startMonth} a ${endDay} ${endMonth} (${year})`;
  };

  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3 mb-4">
      {/* Controles de Navegación de Fecha */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
          <button
            onClick={handlePrev}
            className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors cursor-pointer"
            title="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-xs font-black text-gray-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            Hoy
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-colors cursor-pointer"
            title="Siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <span className="text-xs sm:text-sm font-black text-gray-900 capitalize hidden sm:inline-block">
          {getFormattedRange()}
        </span>
      </div>

      {/* Selector de Vista: Semana / Día */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              viewMode === 'week' ? 'bg-amber-400 text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              viewMode === 'day' ? 'bg-amber-400 text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Día
          </button>
        </div>

        {/* Selector de Sede */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
          <Building size={14} className="text-gray-400" />
          <select
            value={selectedBranchId || ''}
            onChange={(e) => setSelectedBranchId(e.target.value || null)}
            className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer"
          >
            {!isManager && <option value="">🏢 Todas las Sedes</option>}
            {filteredBranches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name || b.id}
              </option>
            ))}
          </select>
        </div>

        {/* Botón Limpiar Registros */}
        {onClearLogs && (
          <button
            onClick={onClearLogs}
            className="h-10 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Borrar todas las marcaciones mostradas"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Borrar Registros</span>
          </button>
        )}

        {/* Botón Pantalla Completa */}
        <button
          onClick={toggleFullscreen}
          className="h-10 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200 text-xs"
          title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}
