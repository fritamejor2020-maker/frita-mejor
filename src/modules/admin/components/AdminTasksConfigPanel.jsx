import React, { useState } from 'react';
import { useTaskStore } from '../../../store/useTaskStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useBranchStore } from '../../../store/useBranchStore';
import { 
  CheckCircle2, Circle, Clock, AlertTriangle, Camera, Plus, 
  Trash2, Edit2, Layers, ShieldAlert, FolderPlus, RefreshCw, 
  Users, CheckSquare, Sparkles, Sliders, Save, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminTasksConfigPanel() {
  const { users } = useAuthStore();
  const rawBranches = useBranchStore(s => s.branches) || [];
  const realBranches = rawBranches.filter(b => b.active !== false);

  const { 
    tasks, projects, taskTemplates, addTaskTemplate, updateTaskTemplate, 
    deleteTaskTemplate, addProject, deleteProject, addTask 
  } = useTaskStore();

  const [activeTab, setActiveTab] = useState('SUPERVISION'); // 'SUPERVISION' | 'PLANTILLAS' | 'PROYECTOS'
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formulario Nueva Plantilla Recurrente
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || 'PROJ-OPERACION');
  const [priority, setPriority] = useState('P2');
  const [assignedToRole, setAssignedToRole] = useState('pos');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [branchId, setBranchId] = useState('GLOBAL');
  const [dueTime, setDueTime] = useState('');
  const [enforcementLevel, setEnforcementLevel] = useState('OBLIGATORIA');
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireNote, setRequireNote] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('DAILY');
  const [subtasksInput, setSubtasksInput] = useState(['']);

  // Proyectos Form
  const [newProjName, setNewProjName] = useState('');
  const [newProjIcon, setNewProjIcon] = useState('📁');
  const [newProjColor, setNewProjColor] = useState('#f59e0b');

  const todayStr = new Date().toISOString().split('T')[0];

  const handleAddSubtask = () => setSubtasksInput([...subtasksInput, '']);
  const handleRemoveSubtask = (idx) => setSubtasksInput(subtasksInput.filter((_, i) => i !== idx));
  const handleSubtaskChange = (idx, val) => {
    const arr = [...subtasksInput];
    arr[idx] = val;
    setSubtasksInput(arr);
  };

  const handleCreateTemplate = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanSubtasks = subtasksInput.filter(s => s.trim().length > 0).map(s => ({ title: s.trim() }));

    addTaskTemplate({
      title: title.trim(),
      description: description.trim(),
      projectId,
      priority,
      assignedToRole: assignedToRole || null,
      assignedToUserId: assignedToUserId || null,
      branchId: branchId || 'GLOBAL',
      dueTime: dueTime || null,
      enforcementLevel,
      requirePhoto,
      requireNote,
      subtasks: cleanSubtasks,
      recurrence: { type: recurrenceType },
    });

    // Crear tarea inmediata para el día de hoy
    addTask({
      title: title.trim(),
      description: description.trim(),
      projectId,
      priority,
      assignedToRole: assignedToRole || null,
      assignedToUserId: assignedToUserId || null,
      branchId: branchId || 'GLOBAL',
      dueDate: todayStr,
      dueTime: dueTime || null,
      enforcementLevel,
      requirePhoto,
      requireNote,
      subtasks: cleanSubtasks,
    });

    setTitle('');
    setDescription('');
    setDueTime('');
    setSubtasksInput(['']);
    setShowCreateModal(false);
    toast.success('🎉 Plantilla programada y desplegada para hoy');
  };

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    addProject({
      name: newProjName.trim(),
      icon: newProjIcon,
      color: newProjColor,
    });
    setNewProjName('');
    toast.success('Proyecto creado correctamente');
  };

  return (
    <div className="bg-[#16171d] border border-gray-800 rounded-[28px] p-6 space-y-6">
      
      {/* Header del Panel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl">
            📋
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Configuración & Supervisión de Tareas</h2>
            <p className="text-xs text-gray-400 font-medium">
              Administra asignaciones, plantillas recurrentes, evidencia y bloqueo de cierre
            </p>
          </div>
        </div>

        {/* Tabs internas del Panel */}
        <div className="flex items-center gap-1 bg-[#121318] p-1.5 rounded-2xl border border-gray-800">
          {[
            { id: 'SUPERVISION', label: '📊 Avance en Vivo' },
            { id: 'PLANTILLAS', label: '📝 Tareas Recurrentes' },
            { id: 'PROYECTOS', label: '📁 Proyectos & Categorías' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-amber-500 text-gray-950 font-black shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: SUPERVISIÓN EN VIVO ── */}
      {activeTab === 'SUPERVISION' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <span className="text-2xl font-black text-white">{tasks.filter(t => t.dueDate === todayStr).length}</span>
                <p className="text-xs text-gray-400 font-bold">Tareas de Hoy</p>
              </div>
            </div>

            <div className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <span className="text-2xl font-black text-emerald-400">{tasks.filter(t => t.dueDate === todayStr && t.completed).length}</span>
                <p className="text-xs text-gray-400 font-bold">Completadas</p>
              </div>
            </div>

            <div className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl">🔴</span>
              <div>
                <span className="text-2xl font-black text-red-400">{tasks.filter(t => !t.completed && t.dueDate < todayStr).length}</span>
                <p className="text-xs text-gray-400 font-bold">Atrasadas</p>
              </div>
            </div>
          </div>

          {/* Avance por Usuario / Rol */}
          <div className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="text-amber-400" size={18} />
              Cumplimiento por Empleado / Rol (Hoy)
            </h3>

            <div className="space-y-3">
              {(users || []).map(u => {
                const uTasks = tasks.filter(t => t.dueDate === todayStr && (t.assignedToUserId === u.id || t.assignedToRole === u.role));
                const completedCount = uTasks.filter(t => t.completed).length;
                const totalCount = uTasks.length;
                const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
                const pendingObligatory = uTasks.filter(t => !t.completed && t.enforcementLevel === 'OBLIGATORIA').length;

                if (totalCount === 0) return null;

                return (
                  <div key={u.id} className="bg-[#16171d] border border-gray-800/80 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{u.name || u.username}</span>
                        <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {u.role}
                        </span>
                        {pendingObligatory > 0 && (
                          <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                            🚫 {pendingObligatory} Obligatoria(s) Pendientes
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-amber-400">{completedCount}/{totalCount} ({percent}%)</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-400' : 'bg-amber-500'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: TAREAS RECURRENTES ── */}
      {activeTab === 'PLANTILLAS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white">Plantillas Programadas</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs px-4 py-2 rounded-xl flex items-center gap-2"
            >
              <Plus size={16} /> Programar Tarea Recurrente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taskTemplates.map(tpl => (
              <div key={tpl.id} className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-5 space-y-3 relative group">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-white text-base">{tpl.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{tpl.description}</p>
                  </div>
                  <button
                    onClick={() => deleteTaskTemplate(tpl.id)}
                    className="text-gray-600 hover:text-red-400 p-1 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-gray-300 pt-2 border-t border-gray-800">
                  <span className="bg-gray-800 px-2.5 py-1 rounded-lg">
                    ⏰ {tpl.dueTime || 'Todo el día'}
                  </span>

                  <span className={`px-2.5 py-1 rounded-lg border ${
                    tpl.enforcementLevel === 'OBLIGATORIA' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {tpl.enforcementLevel}
                  </span>

                  {tpl.requirePhoto && (
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                      📷 Foto Req.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: PROYECTOS & CATEGORÍAS ── */}
      {activeTab === 'PROYECTOS' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateProject} className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FolderPlus className="text-amber-400" size={18} /> Crear Proyecto o Categoría
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Auditoría de Inventario"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Ícono Emoji</label>
                <input
                  type="text"
                  value={newProjIcon}
                  onChange={(e) => setNewProjIcon(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Color</label>
                <input
                  type="color"
                  value={newProjColor}
                  onChange={(e) => setNewProjColor(e.target.value)}
                  className="w-full h-9 bg-transparent border border-gray-700 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs px-5 py-2.5 rounded-xl active:scale-95 transition-all"
            >
              + Guardar Proyecto
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map(p => (
              <div key={p.id} className="bg-[#1d1e26] border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <h4 className="font-bold text-white text-sm" style={{ color: p.color }}>{p.name}</h4>
                    <span className="text-[10px] text-gray-500 font-bold">Categoría Activa</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteProject(p.id)}
                  className="text-gray-600 hover:text-red-400 p-1 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CREAR PLANTILLA RECURRENTE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateTemplate} className="bg-[#181920] border border-gray-800 rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white">Programar Tarea Recurrente</h3>

            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Título de la Tarea</label>
              <input
                type="text"
                placeholder="Ej: Limpieza de freidoras"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Descripción / Instrucciones</label>
              <textarea
                placeholder="Detalla lo que debe hacer el empleado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Proyecto</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Rol Asignado</label>
                <select
                  value={assignedToRole}
                  onChange={(e) => setAssignedToRole(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="pos">Cajero (POS)</option>
                  <option value="dejador">Dejador / Repartidor</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Sede</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="GLOBAL">Todas las Sedes (Global)</option>
                  {realBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Hora Programada (Opcional)</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Exigencia Cierre</label>
                <select
                  value={enforcementLevel}
                  onChange={(e) => setEnforcementLevel(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="NORMAL">ℹ️ Normal</option>
                  <option value="IMPORTANTE">🔑 Importante (PIN Admin)</option>
                  <option value="OBLIGATORIA">🚫 Obligatoria (Bloqueo Estricto)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Recurrencia</label>
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="DAILY">Diaria (Todos los días)</option>
                  <option value="WEEKLY">Semanal (Días laborales)</option>
                  <option value="MONTHLY">Mensual (Día 1 del mes)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-300">
                <input
                  type="checkbox"
                  checked={requirePhoto}
                  onChange={(e) => setRequirePhoto(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>📷 Requiere Foto Evidencia</span>
              </label>
            </div>

            {/* Subtareas */}
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <label className="text-xs text-gray-400 font-bold block">Subtareas Checklist</label>
              {subtasksInput.map((st, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Paso #${idx + 1}`}
                    value={st}
                    onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                    className="flex-1 bg-[#121318] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  {subtasksInput.length > 1 && (
                    <button type="button" onClick={() => handleRemoveSubtask(idx)} className="text-gray-500 hover:text-red-400 p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddSubtask} className="text-amber-400 text-xs font-bold hover:underline">
                + Agregar paso
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-800 text-gray-300 font-bold text-xs px-4 py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-amber-500 text-gray-950 font-black text-xs px-5 py-2.5 rounded-xl"
              >
                Programar & Desplegar
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
