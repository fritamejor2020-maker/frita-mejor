import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  CheckCircle2, Circle, Clock, AlertTriangle, Camera, Plus, ChevronRight, 
  ChevronDown, X, Sparkles, Filter, Lock, ShieldAlert, Tag, Calendar, 
  FolderPlus, Flag, CheckSquare, Layers, Trash2, Edit2, ArrowLeft,
  QrCode, UserCheck, Phone, Video, Wrench
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function TaskCard({ task, userId, userName, todayStr, proj, pBadge, onToggle, onDelete, onToggleSubtask, onReassign }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const isOverdue = !task.completed && task.dueDate < todayStr;
  const completedSubtasks = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
  const totalSubtasks = task.subtasks ? task.subtasks.length : 0;

  const handleSelfAssign = () => {
    onReassign(task.id, userId, userName || 'Administrador');
    setShowAssignModal(false);
    toast.success('👤 Te has asignado esta tarea');
  };

  return (
    <div
      className={
        task.completed
          ? 'border rounded-2xl p-4 transition-all bg-[#14151b] opacity-60 border-gray-800'
          : task.isDamageReport
          ? 'border-2 rounded-2xl p-4 transition-all bg-red-950/20 border-red-500/80 shadow-lg shadow-red-950/40'
          : isOverdue
          ? 'border rounded-2xl p-4 transition-all bg-red-950/40 border-red-500'
          : 'border rounded-2xl p-4 transition-all bg-[#181920] border-gray-800 hover:border-gray-700'
      }
    >
      <div className="flex items-start gap-3">
        {/* Checkbox redonda Todoist */}
        <button
          onClick={() => onToggle(task.id)}
          className="mt-0.5 shrink-0 text-gray-400 hover:text-amber-400 transition-colors"
        >
          {task.completed ? (
            <CheckCircle2 className="text-emerald-400" size={24} />
          ) : (
            <Circle size={24} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={task.completed ? 'font-bold text-base leading-snug line-through text-gray-500' : 'font-bold text-base leading-snug text-white'}>
                {task.title}
              </span>

              {/* Priority */}
              <span className={'text-[10px] font-black px-2 py-0.5 rounded-md border ' + pBadge.color}>
                {pBadge.label}
              </span>

              {/* Damage Report Badge */}
              {task.isDamageReport && (
                <span className="bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-red-500/40 flex items-center gap-1">
                  <Wrench size={10} /> Reporte de Falla
                </span>
              )}

              {/* Enforcement */}
              {task.enforcementLevel === 'OBLIGATORIA' && (
                <span className="bg-red-950 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-red-500">
                  🚫 Obligatoria
                </span>
              )}
              {task.enforcementLevel === 'IMPORTANTE' && (
                <span className="bg-amber-950 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-500">
                  🔑 Importante
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Botón Asignar */}
              <button
                onClick={() => handleSelfAssign()}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1"
                title="Asignarme a mí mismo"
              >
                <UserCheck size={12} />
                <span>{task.assignedToUserName ? `Asignado: ${task.assignedToUserName}` : 'Asignarme'}</span>
              </button>

              <button
                onClick={() => onDelete(task.id)}
                className="text-gray-600 hover:text-red-400 p-1 opacity-0 hover:opacity-100 transition-opacity"
                title="Eliminar tarea"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Información del Reportante si aplica */}
          {(task.reportedBy || task.contactPhone) && (
            <div className="mt-2 text-[11px] text-gray-400 bg-[#121318] p-2 rounded-xl border border-gray-800 flex items-center gap-4 flex-wrap">
              {task.reportedBy && (
                <span>👤 Reportado por: <strong className="text-white">{task.reportedBy}</strong></span>
              )}
              {task.contactPhone && (
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <Phone size={10} /> {task.contactPhone}
                </span>
              )}
            </div>
          )}

          {/* Previsualización Media (Foto o Video) */}
          {(task.mediaUrl || task.photoUrl) && (
            <div className="mt-3">
              {task.mediaType === 'video' ? (
                <video src={task.mediaUrl || task.photoUrl} controls className="w-full max-h-48 object-cover rounded-xl border border-gray-700 bg-black" />
              ) : (
                <img src={task.mediaUrl || task.photoUrl} alt="Evidencia de Daño" className="w-full max-h-48 object-cover rounded-xl border border-gray-700" />
              )}
            </div>
          )}

          {/* Footer Badges */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs font-bold text-gray-400">
            <span className="flex items-center gap-1" style={{ color: proj.color }}>
              <span>{proj.icon}</span> {proj.name}
            </span>

            {task.dueTime && (
              <span className={
                isOverdue
                  ? 'flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-red-950 text-red-400 border border-red-500'
                  : 'flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gray-800 text-gray-300'
              }>
                <Clock size={12} /> {task.dueTime}
              </span>
            )}

            {task.requirePhoto && (
              <span className={task.photoUrl || task.mediaUrl ? 'flex items-center gap-1 text-emerald-400' : 'flex items-center gap-1 text-amber-400'}>
                <Camera size={12} /> {task.photoUrl || task.mediaUrl ? 'Foto/Video adjunto' : 'Requiere Foto'}
              </span>
            )}

            {totalSubtasks > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-amber-400 hover:underline flex items-center gap-1 ml-auto"
              >
                <span>{completedSubtasks} de {totalSubtasks} sub-tareas</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>

          {/* Subtareas Desplegables */}
          {isExpanded && totalSubtasks > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
              {task.subtasks.map(st => (
                <div
                  key={st.id}
                  onClick={() => onToggleSubtask(task.id, st.id)}
                  className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-gray-300 hover:text-white"
                >
                  {st.completed ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={16} className="text-gray-500 shrink-0" />
                  )}
                  <span className={st.completed ? 'line-through text-gray-500' : ''}>
                    {st.title}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export function TasksView() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    tasks, projects, addTask, toggleTaskCompleted, toggleSubtaskCompleted, 
    deleteTask, addProject, deleteProject, reassignTask, checkAndGenerateRecurrentTasks 
  } = useTaskStore();

  const [activeNav, setActiveNav] = useState('HOY'); // 'HOY' | 'ATRASADAS' | 'PROXIMO' | 'DANOS' | projectId
  const [showAddBox, setShowAddBox] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Formulario Inline de Tarea Nueva (Estilo Todoist)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState('P3');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('');
  const [enforcementLevel, setEnforcementLevel] = useState('NORMAL');
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [subtasksInput, setSubtasksInput] = useState(['']);

  // Modal para proyecto nuevo
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectIcon, setNewProjectIcon] = useState('📁');
  const [newProjectColor, setNewProjectColor] = useState('#f59e0b');

  const userId = user?.id || null;
  const userName = user?.name || 'Administrador';
  const userRole = user?.role || 'pos';
  const userBranchId = user?.branchId || null;
  const todayStr = new Date().toISOString().split('T')[0];

  const publicReportUrl = window.location.origin + '/reportar-dano';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(publicReportUrl);

  useEffect(() => {
    checkAndGenerateRecurrentTasks();
  }, []);

  // Filtrar mis tareas
  const myTasks = tasks.filter(t => {
    const matchesUser = (!t.assignedToUserId && !t.assignedToRole) ||
                        t.assignedToUserId === userId ||
                        t.assignedToRole === userRole;
    const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
    return matchesUser && matchesBranch;
  });

  const damageTasks = tasks.filter(t => t.isDamageReport || t.projectId === 'PROJ-MANTENIMIENTO');
  const overdueTasks = myTasks.filter(t => !t.completed && t.dueDate < todayStr);
  const todayTasks = myTasks.filter(t => t.dueDate === todayStr);

  const getFilteredTasks = () => {
    if (activeNav === 'ATRASADAS') return overdueTasks;
    if (activeNav === 'HOY') return myTasks.filter(t => t.dueDate === todayStr || (!t.completed && t.dueDate < todayStr));
    if (activeNav === 'PROXIMO') return myTasks.filter(t => t.dueDate > todayStr);
    if (activeNav === 'DANOS') return damageTasks;
    return myTasks.filter(t => t.projectId === activeNav);
  };

  const currentTaskList = getFilteredTasks();

  const handleAddSubtaskField = () => {
    setSubtasksInput([...subtasksInput, '']);
  };

  const handleSubtaskChange = (index, value) => {
    const updated = [...subtasksInput];
    updated[index] = value;
    setSubtasksInput(updated);
  };

  const handleRemoveSubtaskField = (index) => {
    setSubtasksInput(subtasksInput.filter((_, i) => i !== index));
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Escribe el título de la tarea');
      return;
    }

    const cleanSubtasks = subtasksInput
      .filter(s => s.trim().length > 0)
      .map(s => ({ title: s.trim() }));

    addTask({
      title: title.trim(),
      description: description.trim(),
      projectId,
      priority,
      assignedToUserId: userId,
      assignedToUserName: userName,
      assignedToRole: userRole,
      branchId: userBranchId,
      dueDate,
      dueTime: dueTime || null,
      enforcementLevel,
      requirePhoto,
      subtasks: cleanSubtasks,
    });

    setTitle('');
    setDescription('');
    setDueTime('');
    setRequirePhoto(false);
    setSubtasksInput(['']);
    setShowAddBox(false);
    toast.success('🎉 Tarea creada exitosamente');
  };

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    addProject({
      name: newProjectName.trim(),
      icon: newProjectIcon,
      color: newProjectColor,
    });
    setNewProjectName('');
    setShowAddProjectModal(false);
    toast.success('Proyecto creado');
  };

  const getPriorityBadge = (p) => {
    if (p === 'P1') return { label: 'P1 Urgente', color: 'text-red-400 bg-red-950 border-red-500' };
    if (p === 'P2') return { label: 'P2 Alta', color: 'text-orange-400 bg-orange-950 border-orange-400' };
    if (p === 'P3') return { label: 'P3 Media', color: 'text-blue-400 bg-blue-950 border-blue-400' };
    return { label: 'P4 Normal', color: 'text-gray-400 bg-gray-800 border-gray-700' };
  };

  const getProject = (pId) => projects.find(p => p.id === pId) || { name: 'General', icon: '📁', color: '#6b7280' };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-gray-200 flex flex-col font-sans">
      
      {/* ── TOPBAR NAV ── */}
      <header className="bg-[#16171d] border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <h1 className="text-xl font-black text-white tracking-tight">Gestión de Tareas</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón QR Reportes de Daños */}
          <button
            onClick={() => setShowQRModal(true)}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-red-500/40 transition-all flex items-center gap-2"
          >
            <QrCode size={16} />
            <span className="hidden sm:inline">QR Reportar Daño</span>
          </button>

          <button
            onClick={() => setShowAddBox(true)}
            className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Añadir Tarea</span>
          </button>
        </div>
      </header>

      {/* ── BODY DOS COLUMNAS (SIDEBAR + MAIN) ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ── SIDEBAR NAVEGACIÓN ESTILO TODOIST ── */}
        <aside className="w-64 bg-[#14151b] border-r border-gray-800 p-4 flex flex-col justify-between hidden md:flex shrink-0">
          <div className="space-y-6">
            
            {/* Vistas Inteligentes */}
            <div className="space-y-1">
              <button
                onClick={() => setActiveNav('HOY')}
                className={
                  activeNav === 'HOY'
                    ? 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between bg-amber-500 text-amber-300 border border-amber-500'
                    : 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              >
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-amber-400" />
                  <span>Hoy</span>
                </div>
                {todayTasks.length > 0 && (
                  <span className="bg-amber-500 text-gray-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {todayTasks.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveNav('ATRASADAS')}
                className={
                  activeNav === 'ATRASADAS'
                    ? 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between bg-red-500 text-red-300 border border-red-500'
                    : 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span>Atrasadas</span>
                </div>
                {overdueTasks.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {overdueTasks.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveNav('DANOS')}
                className={
                  activeNav === 'DANOS'
                    ? 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between bg-red-600/30 text-red-300 border border-red-500'
                    : 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              >
                <div className="flex items-center gap-2.5">
                  <Wrench size={16} className="text-red-400" />
                  <span>Equipos Dañados</span>
                </div>
                {damageTasks.length > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {damageTasks.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveNav('PROXIMO')}
                className={
                  activeNav === 'PROXIMO'
                    ? 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between bg-blue-500 text-blue-300 border border-blue-500'
                    : 'w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              >
                <div className="flex items-center gap-2.5">
                  <Clock size={16} className="text-blue-400" />
                  <span>Próximo</span>
                </div>
              </button>
            </div>

            {/* Proyectos */}
            <div>
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Proyectos</span>
                <button
                  onClick={() => setShowAddProjectModal(true)}
                  className="text-gray-400 hover:text-amber-400 p-1 transition-colors"
                  title="Nuevo Proyecto"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="space-y-1">
                {projects.map(p => {
                  const pTasks = myTasks.filter(t => t.projectId === p.id && !t.completed);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActiveNav(p.id)}
                      className={
                        activeNav === p.id
                          ? 'w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between bg-gray-800 text-white'
                          : 'w-full px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span>{p.icon}</span>
                        <span className="truncate">{p.name}</span>
                      </div>
                      {pTasks.length > 0 && (
                        <span className="text-[10px] text-gray-500 font-bold">{pTasks.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="text-[11px] text-gray-500 font-medium px-3">
            Frita Mejor • Tareas v1.0
          </div>
        </aside>

        {/* ── ÁREA PRINCIPAL ── */}
        <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          
          {/* Header de la Sección Actual */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white capitalize flex items-center gap-2">
                {activeNav === 'HOY' && '📅 Hoy'}
                {activeNav === 'ATRASADAS' && '🔴 Tareas Atrasadas'}
                {activeNav === 'DANOS' && '🚨 Reportes de Equipos Dañados'}
                {activeNav === 'PROXIMO' && '📆 Próximos Días'}
                {activeNav !== 'HOY' && activeNav !== 'ATRASADAS' && activeNav !== 'DANOS' && activeNav !== 'PROXIMO' && (
                  <React.Fragment>
                    <span>{getProject(activeNav).icon}</span>
                    <span>{getProject(activeNav).name}</span>
                  </React.Fragment>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {currentTaskList.length} tarea(s) en esta lista
              </p>
            </div>

            {/* Enlace a formulario público de reporte */}
            <button
              onClick={() => window.open(publicReportUrl, '_blank')}
              className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1"
            >
              <span>Abrir Formulario QR</span>
              <QrCode size={14} />
            </button>
          </div>

          {/* ── CAJA DE CREACIÓN INLINE ESTILO TODOIST ── */}
          {showAddBox ? (
            <form onSubmit={handleCreateTask} className="bg-[#181920] border-2 border-amber-500 rounded-2xl p-5 space-y-4 shadow-xl">
              <input
                type="text"
                placeholder="Nombre de la tarea (ej: Limpieza de freidoras)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-white font-bold text-base placeholder-gray-500 focus:outline-none"
                autoFocus
              />

              <textarea
                placeholder="Descripción o instrucciones adicionales..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-transparent text-gray-300 text-xs placeholder-gray-500 focus:outline-none resize-none"
              />

              {/* Fila de Controles & Badges estilo Todoist */}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-800">
                
                {/* Selector de Proyecto */}
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                >
                  <option value="">📂 Sin Categoría</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                  ))}
                </select>

                {/* Selector de Prioridad */}
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                >
                  <option value="P1">🚩 P1 (Urgente)</option>
                  <option value="P2">🚩 P2 (Alta)</option>
                  <option value="P3">🚩 P3 (Media)</option>
                  <option value="P4">🚩 P4 (Normal)</option>
                </select>

                {/* Hora Específica */}
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                />

                {/* Nivel de Exigencia */}
                <select
                  value={enforcementLevel}
                  onChange={(e) => setEnforcementLevel(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                >
                  <option value="NORMAL">ℹ️ Exigencia Normal</option>
                  <option value="IMPORTANTE">🔑 Importante (PIN Admin)</option>
                  <option value="OBLIGATORIA">🚫 Obligatoria (Bloqueo Cierre)</option>
                </select>

                {/* Check Foto Requerida */}
                <label className="flex items-center gap-1.5 bg-[#22242e] border border-gray-700 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-bold text-gray-300">
                  <input
                    type="checkbox"
                    checked={requirePhoto}
                    onChange={(e) => setRequirePhoto(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span>📷 Requiere Foto</span>
                </label>
              </div>

              {/* Subtareas Checklist Form */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <span className="text-xs font-bold text-gray-400">Subtareas (Checklist):</span>
                {subtasksInput.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={'Subtarea #' + (idx + 1)}
                      value={st}
                      onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                      className="flex-1 bg-[#121318] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                    {subtasksInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtaskField(idx)}
                        className="text-gray-500 hover:text-red-400 p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddSubtaskField}
                  className="text-amber-400 hover:underline text-xs font-bold flex items-center gap-1"
                >
                  + Agregar subtarea
                </button>
              </div>

              {/* Acciones de Guardar / Cancelar */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddBox(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs px-5 py-2 rounded-xl active:scale-95 transition-all shadow-lg"
                >
                  Añadir Tarea
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddBox(true)}
              className="w-full bg-[#16171d] hover:bg-[#1c1d26] border border-dashed border-gray-700 rounded-2xl py-3.5 px-4 text-gray-400 hover:text-amber-400 font-bold text-xs flex items-center gap-2 transition-all group"
            >
              <Plus size={16} className="group-hover:scale-110 transition-transform" />
              <span>Añadir tarea...</span>
            </button>
          )}

          {/* ── LISTADO DE TAREAS ── */}
          <div className="space-y-3">
            {currentTaskList.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <span className="text-5xl block mb-3">🎉</span>
                <p className="font-black text-base text-gray-300">¡Sin tareas pendientes!</p>
                <p className="text-xs mt-1">Disfruta tu día u opera con normalidad.</p>
              </div>
            ) : (
              currentTaskList.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userId={userId}
                  userName={userName}
                  todayStr={todayStr}
                  proj={getProject(task.projectId)}
                  pBadge={getPriorityBadge(task.priority)}
                  onToggle={(tId) => toggleTaskCompleted(tId, userId)}
                  onDelete={(tId) => deleteTask(tId)}
                  onToggleSubtask={(tId, stId) => toggleSubtaskCompleted(tId, stId)}
                  onReassign={(tId, uId, uName) => reassignTask(tId, uId, uName)}
                />
              ))
            )}
          </div>

        </main>
      </div>

      {/* ── MODAL PROYECTO NUEVO ── */}
      {showAddProjectModal && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateProject} className="bg-[#181920] border border-gray-800 rounded-3xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FolderPlus className="text-amber-400" size={18} />
              Nuevo Proyecto
            </h3>

            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Nombre del Proyecto</label>
              <input
                type="text"
                placeholder="Ej: Mantenimiento de Equipos"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-400 font-bold block mb-1">Ícono</label>
                <input
                  type="text"
                  value={newProjectIcon}
                  onChange={(e) => setNewProjectIcon(e.target.value)}
                  className="w-full bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 font-bold block mb-1">Color</label>
                <input
                  type="color"
                  value={newProjectColor}
                  onChange={(e) => setNewProjectColor(e.target.value)}
                  className="w-full h-9 bg-transparent border border-gray-700 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProjectModal(false)}
                className="bg-gray-800 text-gray-300 font-bold text-xs px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-amber-500 text-gray-950 font-black text-xs px-4 py-2 rounded-xl"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL MOSTRAR QR PARA IMPRIMIR Y PEGAR EN LA COCINA */}
      {showQRModal && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181920] border border-gray-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white flex items-center justify-center gap-2">
              <QrCode className="text-amber-400" size={20} />
              QR de Reportes de Daños
            </h3>

            <p className="text-xs text-gray-300">
              Imprime o escanea este código para acceder directamente al formulario donde cualquiera puede tomar fotos o grabar videos de equipos averiados.
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
              <img src={qrUrl} alt="Código QR Reportes" className="w-52 h-52 object-contain mx-auto" />
            </div>

            <p className="text-[11px] text-amber-400 font-mono break-all bg-gray-900 p-2 rounded-xl border border-gray-800">
              {publicReportUrl}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publicReportUrl);
                  toast.success('📋 Enlace copiado al portapapeles');
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs py-2.5 rounded-xl transition-all"
              >
                Copiar Link
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs py-2.5 rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
