import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Clock, UserCheck, Shield, Check, Save, Layers, ListChecks } from 'lucide-react';
import { useAttendanceStore, ShiftTemplate, ShiftScheduleGroup, EmployeeContract } from '../../../store/useAttendanceStore';

interface ShiftTemplatesModalProps {
  onClose: () => void;
}

export function ShiftTemplatesModal({ onClose }: ShiftTemplatesModalProps) {
  const {
    shiftTemplates,
    scheduleGroups = [],
    employeeContracts,
    addShiftTemplate,
    updateShiftTemplate,
    deleteShiftTemplate,
    addScheduleGroup,
    updateScheduleGroup,
    deleteScheduleGroup,
    updateEmployeeContract,
  } = useAttendanceStore();

  const [activeTab, setActiveTab] = useState<'groups' | 'templates' | 'employees'>('groups');

  // Form states for ShiftScheduleGroup
  const [editingGroup, setEditingGroup] = useState<ShiftScheduleGroup | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [grpName, setGrpName] = useState('');
  const [grpDescription, setGrpDescription] = useState('');
  const [grpSelectedShiftIds, setGrpSelectedShiftIds] = useState<string[]>([]);

  // Quick-Add Shift inline inside Group form
  const [quickTplName, setQuickTplName] = useState('');
  const [quickTplIn, setQuickTplIn] = useState('06:00');
  const [quickTplOut, setQuickTplOut] = useState('14:00');

  // Form states for ShiftTemplate
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplStartTime, setTplStartTime] = useState('06:00');
  const [tplEndTime, setTplEndTime] = useState('14:00');
  const [tplColor, setTplColor] = useState('#3B82F6');

  // Form states for EmployeeContract
  const [editingEmpContract, setEditingEmpContract] = useState<EmployeeContract | null>(null);
  const [empShiftType, setEmpShiftType] = useState<'FIXED' | 'VARIABLE'>('VARIABLE');
  const [empScheduleGroupId, setEmpScheduleGroupId] = useState<string>('GROUP-LOCAL');
  const [empDefaultShiftId, setEmpDefaultShiftId] = useState<string>('SHIFT-MANANA-COMPLETO');
  const [empWeeklyTargetHours, setEmpWeeklyTargetHours] = useState<number>(44);
  const [empBaseHourlyRate, setEmpBaseHourlyRate] = useState<number>(6500);

  const PRESET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];

  // Handlers for Groups
  const handleStartCreateGroup = () => {
    setEditingGroup(null);
    setGrpName('');
    setGrpDescription('');
    setGrpSelectedShiftIds(shiftTemplates.map((s) => s.id));
    setIsCreatingGroup(true);
  };

  const handleStartEditGroup = (grp: ShiftScheduleGroup) => {
    setIsCreatingGroup(false);
    setEditingGroup(grp);
    setGrpName(grp.name);
    setGrpDescription(grp.description || '');
    setGrpSelectedShiftIds(grp.shiftIds || []);
  };

  const handleToggleGroupShift = (shiftId: string) => {
    setGrpSelectedShiftIds((prev) =>
      prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]
    );
  };

  const handleQuickAddShiftToGroup = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickTplName.trim()) {
      alert('Ingresa el nombre del turno (ej. Turno Mañana 6am - 2pm).');
      return;
    }
    const startMins = parseMins(quickTplIn);
    const endMins = parseMins(quickTplOut);
    const targetMinutes = endMins >= startMins ? endMins - startMins : (1440 - startMins) + endMins;
    const newId = `SHIFT-${Date.now()}`;
    const newTpl: ShiftTemplate = {
      id: newId,
      name: quickTplName.trim(),
      startTime: quickTplIn,
      endTime: quickTplOut,
      targetMinutes,
      color: PRESET_COLORS[grpSelectedShiftIds.length % PRESET_COLORS.length],
    };

    addShiftTemplate(newTpl);
    setGrpSelectedShiftIds((prev) => [...prev, newId]);
    setQuickTplName('');
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grpName.trim()) {
      alert('Ingresa un nombre para el Horario / Grupo.');
      return;
    }
    if (grpSelectedShiftIds.length === 0) {
      alert('Selecciona al menos un turno para este Horario.');
      return;
    }

    if (editingGroup) {
      updateScheduleGroup(editingGroup.id, {
        name: grpName.trim(),
        description: grpDescription.trim(),
        shiftIds: grpSelectedShiftIds,
      });
    } else {
      addScheduleGroup({
        name: grpName.trim(),
        description: grpDescription.trim(),
        shiftIds: grpSelectedShiftIds,
      });
    }

    setIsCreatingGroup(false);
    setEditingGroup(null);
  };

  const handleDeleteGroup = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el horario "${name}"?`)) {
      deleteScheduleGroup(id);
    }
  };

  // Handlers for Templates
  const handleStartCreateTemplate = () => {
    setEditingTemplate(null);
    setTplName('');
    setTplStartTime('06:00');
    setTplEndTime('14:00');
    setTplColor('#3B82F6');
    setIsCreatingTemplate(true);
  };

  const handleStartEditTemplate = (st: ShiftTemplate) => {
    setIsCreatingTemplate(false);
    setEditingTemplate(st);
    setTplName(st.name);
    setTplStartTime(st.startTime);
    setTplEndTime(st.endTime);
    setTplColor(st.color || '#3B82F6');
  };

  const parseMins = (str: string) => {
    const [h, m] = (str || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) {
      alert('Por favor ingresa un nombre para el turno.');
      return;
    }

    const startMins = parseMins(tplStartTime);
    const endMins = parseMins(tplEndTime);
    const targetMinutes = endMins >= startMins ? endMins - startMins : (1440 - startMins) + endMins;

    if (editingTemplate) {
      updateShiftTemplate(editingTemplate.id, {
        name: tplName.trim(),
        startTime: tplStartTime,
        endTime: tplEndTime,
        targetMinutes,
        color: tplColor,
      });
    } else {
      addShiftTemplate({
        name: tplName.trim(),
        startTime: tplStartTime,
        endTime: tplEndTime,
        targetMinutes,
        color: tplColor,
      });
    }

    setIsCreatingTemplate(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el turno "${name}" del sistema?`)) {
      deleteShiftTemplate(id);
      setGrpSelectedShiftIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Handlers for Contracts
  const handleStartEditEmpContract = (emp: EmployeeContract) => {
    setEditingEmpContract(emp);
    setEmpShiftType(emp.shiftType || 'VARIABLE');
    setEmpScheduleGroupId(emp.scheduleGroupId || scheduleGroups[0]?.id || 'GROUP-LOCAL');
    setEmpDefaultShiftId(emp.defaultShiftId || shiftTemplates[0]?.id || 'SHIFT-MANANA-COMPLETO');
    setEmpWeeklyTargetHours(emp.weeklyTargetHours || 44);
    setEmpBaseHourlyRate(emp.baseHourlyRate || 6500);
  };

  const handleSaveEmpContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmpContract) return;

    updateEmployeeContract({
      ...editingEmpContract,
      shiftType: empShiftType,
      scheduleGroupId: empScheduleGroupId,
      defaultShiftId: empDefaultShiftId,
      weeklyTargetHours: Number(empWeeklyTargetHours) || 44,
      baseHourlyRate: Number(empBaseHourlyRate) || 6500,
    });

    setEditingEmpContract(null);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-gray-950 rounded-2xl">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Gestión de Horarios y Grupos de Turnos</h2>
              <p className="text-xs text-gray-400 font-medium">Crea conjuntos de turnos posibles y asígnalos a cada persona para auto-detección automática</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-100/90 px-6 py-3 gap-2 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('groups'); setEditingGroup(null); setIsCreatingGroup(false); }}
            className={`px-4 py-2.5 font-black text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'groups'
                ? 'bg-amber-400 text-gray-950 shadow-xs scale-[1.02]'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 border border-gray-200/80'
            }`}
          >
            <Layers size={16} /> 1. Horarios Maestro ({scheduleGroups.length})
          </button>

          <button
            onClick={() => { setActiveTab('templates'); setEditingTemplate(null); setIsCreatingTemplate(false); }}
            className={`px-4 py-2.5 font-black text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'templates'
                ? 'bg-amber-400 text-gray-950 shadow-xs scale-[1.02]'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 border border-gray-200/80'
            }`}
          >
            <Clock size={16} /> 2. Catálogo de Turnos ({shiftTemplates.length})
          </button>

          <button
            onClick={() => { setActiveTab('employees'); setEditingEmpContract(null); }}
            className={`px-4 py-2.5 font-black text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'employees'
                ? 'bg-amber-400 text-gray-950 shadow-xs scale-[1.02]'
                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 border border-gray-200/80'
            }`}
          >
            <UserCheck size={16} /> 3. Asignación por Persona ({employeeContracts.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          
          {/* TAB 1: GRUPOS DE HORARIOS */}
          {activeTab === 'groups' && (
            <div className="space-y-6">
              {(isCreatingGroup || editingGroup) ? (
                <form onSubmit={handleSaveGroup} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4">
                  <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <Layers size={16} className="text-amber-500" />
                    {editingGroup ? 'Editar Horario Maestro' : 'Crear Nuevo Horario Maestro'}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Horario Maestro</label>
                      <input
                        type="text"
                        value={grpName}
                        onChange={(e) => setGrpName(e.target.value)}
                        placeholder="Ej. Horario del Local (Variables)"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Descripción / Observación</label>
                      <input
                        type="text"
                        value={grpDescription}
                        onChange={(e) => setGrpDescription(e.target.value)}
                        placeholder="Ej. Aplica para personal de punto de venta"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Formulario rápido para agregar turnos directamente con sus horas */}
                  <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
                    <span className="block text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Plus size={14} className="text-amber-600" /> + Crear y Añadir un Nuevo Turno con Horas Exactas a este Horario:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={quickTplName}
                          onChange={(e) => setQuickTplName(e.target.value)}
                          placeholder="Nombre Ej. Mañana (6am - 2pm)"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-center gap-1">
                        <span className="text-[10px] font-black text-gray-500 shrink-0">Entrada:</span>
                        <input
                          type="time"
                          value={quickTplIn}
                          onChange={(e) => setQuickTplIn(e.target.value)}
                          className="w-full px-2 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-center gap-1">
                        <span className="text-[10px] font-black text-gray-500 shrink-0">Salida:</span>
                        <input
                          type="time"
                          value={quickTplOut}
                          onChange={(e) => setQuickTplOut(e.target.value)}
                          className="w-full px-2 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={handleQuickAddShiftToGroup}
                          className="w-full py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs cursor-pointer shadow-2xs flex items-center justify-center"
                          title="Añadir este turno"
                        >
                          + Añadir
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Selección de turnos que componen este grupo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-2">
                      Selecciona los Turnos Posibles que componen este Horario:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
                      {shiftTemplates.map((st) => {
                        const isChecked = grpSelectedShiftIds.includes(st.id);
                        return (
                          <label
                            key={st.id}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-amber-50 border-amber-300 shadow-2xs'
                                : 'bg-white border-gray-200 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleGroupShift(st.id)}
                                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                              />
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st.color || '#3B82F6' }} />
                              <div>
                                <span className="block font-black text-xs text-gray-900">{st.name}</span>
                                <span className="text-[10px] font-extrabold text-gray-500">🕒 {st.startTime} a {st.endTime}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(st.id, st.name);
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Eliminar este turno por completo"
                            >
                              <Trash2 size={15} />
                            </button>
                          </label>
                        );
                      })}
                      {shiftTemplates.length === 0 && (
                        <div className="col-span-2 text-center py-4 text-xs font-bold text-gray-400">
                          Aún no hay turnos guardados. Usa el formulario de arriba para añadir los turnos con sus horas exactas.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setIsCreatingGroup(false); setEditingGroup(null); }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save size={14} /> Guardar Horario Maestro
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500 font-bold">Grupos de horarios con sus turnos asignados para auto-detectar según hora de huella.</p>
                  <button
                    onClick={handleStartCreateGroup}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus size={16} /> Crear Horario Maestro
                  </button>
                </div>
              )}

              {/* Lista de Grupos */}
              <div className="space-y-3">
                {scheduleGroups.map((grp) => {
                  const shiftsInGroup = shiftTemplates.filter((s) => (grp.shiftIds || []).includes(s.id));
                  return (
                    <div
                      key={grp.id}
                      className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3 hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-base text-gray-900 flex items-center gap-2">
                            <Layers size={18} className="text-amber-500" />
                            {grp.name}
                          </h4>
                          {grp.description && <p className="text-xs text-gray-500 font-medium">{grp.description}</p>}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditGroup(grp)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 cursor-pointer"
                            title="Editar Horario"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(grp.id, grp.name)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg cursor-pointer"
                            title="Eliminar Horario"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Turnos posibles dentro de este grupo */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {shiftsInGroup.map((st) => (
                          <span
                            key={st.id}
                            className="px-2.5 py-1 rounded-xl text-xs font-black text-gray-900 border flex items-center gap-1.5 shadow-2xs"
                            style={{ backgroundColor: `${st.color}15`, borderColor: st.color }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                            {st.name} ({st.startTime} - {st.endTime})
                          </span>
                        ))}
                        {shiftsInGroup.length === 0 && (
                          <span className="text-xs text-gray-400 font-bold">Sin turnos asignados a este grupo.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CATÁLOGO DE TURNOS */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {(isCreatingTemplate || editingTemplate) ? (
                <form onSubmit={handleSaveTemplate} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4">
                  <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <Clock size={16} className="text-amber-500" />
                    {editingTemplate ? 'Editar Turno' : 'Crear Nuevo Turno'}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Turno</label>
                      <input
                        type="text"
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                        placeholder="Ej. Turno Mañana (06:00 - 14:00)"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Color Distintivo</label>
                      <div className="flex items-center gap-2">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setTplColor(c)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                              tplColor === c ? 'scale-110 border-gray-900 shadow-sm' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hora de Entrada (HH:mm)</label>
                      <input
                        type="time"
                        value={tplStartTime}
                        onChange={(e) => setTplStartTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Hora de Salida (HH:mm)</label>
                      <input
                        type="time"
                        value={tplEndTime}
                        onChange={(e) => setTplEndTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setIsCreatingTemplate(false); setEditingTemplate(null); }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save size={14} /> Guardar Turno
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500 font-bold">Catálogo individual de turnos para agrupar en horarios maestros.</p>
                  <button
                    onClick={handleStartCreateTemplate}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus size={16} /> Crear Nuevo Turno
                  </button>
                </div>
              )}

              {/* Lista de turnos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shiftTemplates.map((st) => {
                  const grossHours = (st.targetMinutes / 60).toFixed(1);
                  return (
                    <div
                      key={st.id}
                      className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between hover:border-amber-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-10 rounded-lg shrink-0" style={{ backgroundColor: st.color || '#3B82F6' }} />
                        <div>
                          <h4 className="font-black text-sm text-gray-900">{st.name}</h4>
                          <p className="text-xs font-bold text-gray-500 flex items-center gap-2 mt-0.5">
                            <span>🕒 {st.startTime} a {st.endTime}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[10px] text-gray-700 font-extrabold">{grossHours} hrs</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEditTemplate(st)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(st.id, st.name)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ASIGNACIÓN DE HORARIO POR TRABAJADOR */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              {editingEmpContract ? (
                <form onSubmit={handleSaveEmpContract} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4">
                  <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <UserCheck size={16} className="text-amber-500" />
                    Asignar Horario a {editingEmpContract.fullName} (#{editingEmpContract.employeeNo})
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Modalidad</label>
                      <select
                        value={empShiftType}
                        onChange={(e) => setEmpShiftType(e.target.value as 'FIXED' | 'VARIABLE')}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                      >
                        <option value="VARIABLE">🔄 Turno Variable (Auto-detectar dentro del Horario Maestro)</option>
                        <option value="FIXED">📌 Turno Fijo (Asignación fija obligatoria)</option>
                      </select>
                    </div>

                    {empShiftType === 'VARIABLE' ? (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Horario Maestro Asignado</label>
                        <select
                          value={empScheduleGroupId}
                          onChange={(e) => setEmpScheduleGroupId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                        >
                          {scheduleGroups.map((grp) => (
                            <option key={grp.id} value={grp.id}>
                              {grp.name} ({(grp.shiftIds || []).length} turnos posibles)
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Turno Fijo Asignado (Todos los días)</label>
                        <select
                          value={empDefaultShiftId}
                          onChange={(e) => setEmpDefaultShiftId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                        >
                          {shiftTemplates.map((st) => (
                            <option key={st.id} value={st.id}>
                              📌 {st.name} ({st.startTime} - {st.endTime})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Meta Horas Semanales</label>
                      <input
                        type="number"
                        value={empWeeklyTargetHours}
                        onChange={(e) => setEmpWeeklyTargetHours(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingEmpContract(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save size={14} /> Guardar Asignación
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-gray-500 font-bold">
                  Selecciona a cualquier persona para asignarle su Horario Maestro (ej. Horarios del Local).
                </p>
              )}

              {/* Tabla de trabajadores */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4"># ID</th>
                      <th className="py-3 px-4">Trabajador</th>
                      <th className="py-3 px-4">Modalidad</th>
                      <th className="py-3 px-4">Horario Maestro Asignado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-800">
                    {employeeContracts.map((emp) => {
                      const grp = scheduleGroups.find((g) => g.id === emp.scheduleGroupId);
                      return (
                        <tr key={emp.employeeId} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-3 px-4 font-black text-gray-500">#{emp.employeeNo}</td>
                          <td className="py-3 px-4 font-black text-gray-900">{emp.fullName}</td>
                          <td className="py-3 px-4">
                            {emp.shiftType === 'FIXED' ? (
                              <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-black text-[10px]">
                                📌 TURNO FIJO
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-black text-[10px]">
                                🔄 ROTATIVO / VARIABLE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {grp ? (
                              <span className="font-black text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                                📅 {grp.name}
                              </span>
                            ) : (
                              <span className="text-gray-400">Todos los turnos</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleStartEditEmpContract(emp)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-amber-100 text-gray-800 hover:text-amber-900 rounded-lg text-xs font-black transition-colors cursor-pointer"
                            >
                              ⚙️ Asignar Horario
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
