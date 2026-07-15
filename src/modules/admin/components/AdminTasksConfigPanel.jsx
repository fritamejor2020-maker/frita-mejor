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
    <div className="bg-white border border-gray-200 rounded-[28px] p-6 space-y-6 shadow-sm">
      
      {/* Header del Panel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl text-amber-600">
            📋
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800">Configuración & Supervisión de Tareas</h2>
            <p className="text-xs text-gray-500 font-medium">
              Administra asignaciones, plantillas recurrentes, evidencia y bloqueo de cierre
            </p>
          </div>
        </div>

        {/* Tabs internas del Panel */}
        <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
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
                  ? 'bg-amber-500 text-white font-black shadow'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
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
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-3xl">📋</span>
              <div>
                <span className="text-2xl font-black text-gray-800">{tasks.filter(t => t.dueDate === todayStr).length}</span>
                <p className="text-xs text-gray-500 font-bold">Tareas de Hoy</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-3xl">✅</span>
              <div>
                <span className="text-2xl font-black text-emerald-600">{tasks.filter(t => t.dueDate === todayStr && t.completed).length}</span>
                <p className="text-xs text-gray-500 font-bold">Completadas</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-3xl">🔴</span>
              <div>
                <span className="text-2xl font-black text-red-650">{tasks.filter(t => !t.completed && t.dueDate < todayStr).length}</span>
                <p className="text-xs text-gray-500 font-bold">Atrasadas</p>
              </div>
            </div>
          </div>

          {/* Avance por Usuario / Rol */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
              <Users className="text-amber-600" size={18} />
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
                  <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm">{u.name || u.username}</span>
                        <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {u.role}
                        </span>
                        {pendingObligatory > 0 && (
                          <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">
                            🚫 {pendingObligatory} Obligatoria(s) Pendientes
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-amber-600">{completedCount}/{totalCount} ({percent}%)</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
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
            <h3 className="text-base font-black text-gray-800">Plantillas Programadas</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-all"
            >
              <Plus size={16} /> Programar Tarea Recurrente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taskTemplates.map(tpl => (
              <div key={tpl.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3 relative group shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">{tpl.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                  </div>
                  <button
                    onClick={() => deleteTaskTemplate(tpl.id)}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-gray-600 pt-2 border-t border-gray-200">
                  <span className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">
                    ⏰ {tpl.dueTime || 'Todo el día'}
                  </span>

                  <span className={`px-2.5 py-1 rounded-lg border ${
                    tpl.enforcementLevel === 'OBLIGATORIA' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {tpl.enforcementLevel}
                  </span>

                  {tpl.requirePhoto && (
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg">
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
          <form onSubmit={handleCreateProject} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
              <FolderPlus className="text-amber-600" size={18} /> Crear Proyecto o Categoría
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Auditoría de Inventario"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Ícono Emoji</label>
                <input
                  type="text"
                  value={newProjIcon}
                  onChange={(e) => setNewProjIcon(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 text-center focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Color</label>
                <input
                  type="color"
                  value={newProjColor}
                  onChange={(e) => setNewProjColor(e.target.value)}
                  className="w-full h-9 bg-transparent border border-gray-200 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-5 py-2.5 rounded-xl active:scale-95 transition-all shadow-sm"
            >
              + Guardar Proyecto
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map(p => (
              <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm" style={{ color: p.color }}>{p.name}</h4>
                    <span className="text-[10px] text-gray-400 font-bold">Categoría Activa</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteProject(p.id)}
                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
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
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateTemplate} className="bg-white border border-gray-200 rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-black text-gray-800 border-b border-gray-100 pb-2">Programar Tarea Recurrente</h3>

            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1">Título de la Tarea</label>
              <input
                type="text"
                placeholder="Ej: Limpieza de freidoras"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1">Descripción / Instrucciones</label>
              <textarea
                placeholder="Detalla lo que debe hacer el empleado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Proyecto</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Rol Asignado</label>
                <select
                  value={assignedToRole}
                  onChange={(e) => setAssignedToRole(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
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
                <label className="text-xs text-gray-500 font-bold block mb-1">Sede</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                >
                  <option value="GLOBAL">Todas las Sedes (Global)</option>
                  {realBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Hora Programada (Opcional)</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Exigencia Cierre</label>
                <select
                  value={enforcementLevel}
                  onChange={(e) => setEnforcementLevel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                >
                  <option value="NORMAL">ℹ️ Normal</option>
                  <option value="IMPORTANTE">🔑 Importante (PIN Admin)</option>
                  <option value="OBLIGATORIA">🚫 Obligatoria (Bloqueo Estricto)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">Recurrencia</label>
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-amber-500 outline-none"
                >
                  <option value="DAILY">Diaria (Todos los días)</option>
                  <option value="WEEKLY">Semanal (Días laborales)</option>
                  <option value="MONTHLY">Mensual (Día 1 del mes)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-650">
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
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <label className="text-xs text-gray-500 font-bold block">Subtareas Checklist</label>
              {subtasksInput.map((st, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Paso #${idx + 1}`}
                    value={st}
                    onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 focus:border-amber-500 outline-none"
                  />
                  {subtasksInput.length > 1 && (
                    <button type="button" onClick={() => handleRemoveSubtask(idx)} className="text-gray-400 hover:text-red-500 p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddSubtask} className="text-amber-600 text-xs font-bold hover:underline">
                + Agregar paso
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-5 py-2.5 rounded-xl active:scale-95 transition-all shadow"
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
