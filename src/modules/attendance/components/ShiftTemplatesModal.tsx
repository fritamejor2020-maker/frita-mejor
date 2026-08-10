import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Clock, UserCheck, Shield, Check, Save } from 'lucide-react';
import { useAttendanceStore, ShiftTemplate, EmployeeContract } from '../../../store/useAttendanceStore';

interface ShiftTemplatesModalProps {
  onClose: () => void;
}

export function ShiftTemplatesModal({ onClose }: ShiftTemplatesModalProps) {
  const {
    shiftTemplates,
    employeeContracts,
    addShiftTemplate,
    updateShiftTemplate,
    deleteShiftTemplate,
    updateEmployeeContract,
  } = useAttendanceStore();

  const [activeTab, setActiveTab] = useState<'templates' | 'employees'>('templates');

  // Form states for creating/editing template
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplStartTime, setTplStartTime] = useState('06:00');
  const [tplEndTime, setTplEndTime] = useState('14:00');
  const [tplColor, setTplColor] = useState('#3B82F6');

  // Form states for editing employee contract
  const [editingEmpContract, setEditingEmpContract] = useState<EmployeeContract | null>(null);
  const [empShiftType, setEmpShiftType] = useState<'FIXED' | 'VARIABLE'>('VARIABLE');
  const [empDefaultShiftId, setEmpDefaultShiftId] = useState<string>('SHIFT-MANANA');
  const [empWeeklyTargetHours, setEmpWeeklyTargetHours] = useState<number>(44);
  const [empBaseHourlyRate, setEmpBaseHourlyRate] = useState<number>(6500);

  // Colors preset
  const PRESET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];

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
      alert('Por favor ingresa un nombre para la plantilla.');
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
    if (confirm(`¿Estás seguro de eliminar la plantilla "${name}"?`)) {
      deleteShiftTemplate(id);
    }
  };

  const handleStartEditEmpContract = (emp: EmployeeContract) => {
    setEditingEmpContract(emp);
    setEmpShiftType(emp.shiftType || 'VARIABLE');
    setEmpDefaultShiftId(emp.defaultShiftId || shiftTemplates[0]?.id || 'SHIFT-MANANA');
    setEmpWeeklyTargetHours(emp.weeklyTargetHours || 44);
    setEmpBaseHourlyRate(emp.baseHourlyRate || 6500);
  };

  const handleSaveEmpContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmpContract) return;

    updateEmployeeContract({
      ...editingEmpContract,
      shiftType: empShiftType,
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
              <Clock size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Gestión de Turnos y Plantillas de Horario</h2>
              <p className="text-xs text-gray-400 font-medium">Configura catálogos de turnos y asigna tipos de turno a cada trabajador</p>
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
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2">
          <button
            onClick={() => { setActiveTab('templates'); setEditingTemplate(null); setIsCreatingTemplate(false); }}
            className={`px-5 py-3 font-black text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-white text-amber-700 border-t-2 border-amber-500 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Clock size={16} /> Plantillas de Horarios ({shiftTemplates.length})
          </button>

          <button
            onClick={() => { setActiveTab('employees'); setEditingEmpContract(null); }}
            className={`px-5 py-3 font-black text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'employees'
                ? 'bg-white text-amber-700 border-t-2 border-amber-500 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <UserCheck size={16} /> Asignación por Trabajador ({employeeContracts.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          
          {/* TAB 1: PLANTILLAS DE TURNOS */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              
              {/* Form de creación / edición */}
              {(isCreatingTemplate || editingTemplate) ? (
                <form onSubmit={handleSaveTemplate} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4">
                  <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <Clock size={16} className="text-amber-500" />
                    {editingTemplate ? 'Editar Plantilla de Turno' : 'Crear Nueva Plantilla de Turno'}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Turno</label>
                      <input
                        type="text"
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                        placeholder="Ej. Mañana (06:00 - 14:00)"
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
                  <p className="text-xs text-gray-500 font-bold">Plantillas de turno maestras disponibles para auto-detección y asignación fija.</p>
                  <button
                    onClick={handleStartCreateTemplate}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus size={16} /> Crear Nueva Plantilla
                  </button>
                </div>
              )}

              {/* Lista de plantillas existentes */}
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

          {/* TAB 2: ASIGNACIÓN DE TURNO POR TRABAJADOR */}
          {activeTab === 'employees' && (
            <div className="space-y-6">

              {/* Form de edición de contrato de trabajador */}
              {editingEmpContract ? (
                <form onSubmit={handleSaveEmpContract} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4">
                  <h3 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <UserCheck size={16} className="text-amber-500" />
                    Configurar Turno para {editingEmpContract.fullName} (#{editingEmpContract.employeeNo})
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Turno</label>
                      <select
                        value={empShiftType}
                        onChange={(e) => setEmpShiftType(e.target.value as 'FIXED' | 'VARIABLE')}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                      >
                        <option value="VARIABLE">🔄 Turno Variable / Rotativo (Auto-detectar huella)</option>
                        <option value="FIXED">📌 Turno Fijo (Asignación fija obligatoria)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Plantilla de Turno por Defecto</label>
                      <select
                        value={empDefaultShiftId}
                        onChange={(e) => setEmpDefaultShiftId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                      >
                        {shiftTemplates.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.startTime} - {st.endTime})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Horas Meta Semanales (ej. 44 u 48)</label>
                      <input
                        type="number"
                        value={empWeeklyTargetHours}
                        onChange={(e) => setEmpWeeklyTargetHours(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tarifa por Hora ($)</label>
                      <input
                        type="number"
                        value={empBaseHourlyRate}
                        onChange={(e) => setEmpBaseHourlyRate(Number(e.target.value))}
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
                      <Save size={14} /> Guardar Configuración
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-gray-500 font-bold">
                  Selecciona cualquier trabajador para definir si tiene Turno Fijo o Turno Rotativo y asignarle su horario oficial.
                </p>
              )}

              {/* Tabla de trabajadores */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4"># ID</th>
                      <th className="py-3 px-4">Trabajador</th>
                      <th className="py-3 px-4">Tipo de Turno</th>
                      <th className="py-3 px-4">Horario por Defecto</th>
                      <th className="py-3 px-4">Meta Semanal</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-800">
                    {employeeContracts.map((emp) => {
                      const defaultShift = shiftTemplates.find((s) => s.id === emp.defaultShiftId);
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
                            {defaultShift ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: defaultShift.color || '#3B82F6' }} />
                                <span>{defaultShift.name} ({defaultShift.startTime} - {defaultShift.endTime})</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">Sin asignar</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{emp.weeklyTargetHours || 44} hrs/sem</td>
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
