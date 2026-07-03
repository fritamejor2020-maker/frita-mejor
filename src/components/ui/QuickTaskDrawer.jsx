import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  CheckCircle2, Circle, Clock, AlertTriangle, Camera, Plus, ChevronRight, 
  ChevronDown, X, Sparkles, Filter, Lock, ShieldAlert, Tag, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

function QuickTaskCard({ task, userId, todayStr, proj, onToggleTask, toggleSubtaskCompleted, handleFileUpload, uploadingTaskId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOverdue = !task.completed && task.dueDate < todayStr;

  const getPriorityColor = (p) => {
    if (p === 'P1') return 'text-red-500 border-red-500 bg-red-950';
    if (p === 'P2') return 'text-orange-400 border-orange-400 bg-orange-950';
    if (p === 'P3') return 'text-blue-400 border-blue-400 bg-blue-950';
    return 'text-gray-400 border-gray-600 bg-gray-800';
  };

  return (
    <div
      className={
        task.completed
          ? 'border rounded-2xl p-4 transition-all bg-[#181920] border-gray-800 opacity-60'
          : isOverdue
          ? 'border rounded-2xl p-4 transition-all bg-red-950 border-red-500'
          : 'border rounded-2xl p-4 transition-all bg-[#1d1e26] border-gray-800 hover:border-gray-700'
      }
    >
      <div className="flex items-start gap-3">
        {/* Checkbox redonda estilo Todoist */}
        <button
          onClick={() => onToggleTask(task)}
          className="mt-0.5 shrink-0 text-gray-400 hover:text-amber-400 transition-colors"
        >
          {task.completed ? (
            <CheckCircle2 className="text-emerald-400" size={22} />
          ) : (
            <Circle size={22} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={task.completed ? 'font-bold text-sm leading-snug line-through text-gray-500' : 'font-bold text-sm leading-snug text-white'}>
              {task.title}
            </span>

            {/* Priority Badge */}
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>

            {/* Enforcement Level */}
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

          {task.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Footer de Tarea */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-[11px] font-bold text-gray-400">
            {proj && (
              <span className="flex items-center gap-1" style={{ color: proj.color }}>
                <span>{proj.icon}</span> {proj.name}
              </span>
            )}

            {task.dueTime && (
              <span className={isOverdue ? 'flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950 text-red-400' : 'flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-gray-300'}>
                <Clock size={12} /> {task.dueTime}
              </span>
            )}

            {task.requirePhoto && (
              <span className={task.photoUrl ? 'flex items-center gap-1 text-emerald-400' : 'flex items-center gap-1 text-amber-400'}>
                <Camera size={12} /> {task.photoUrl ? 'Foto adjunta' : 'Requiere Foto'}
              </span>
            )}

            {task.subtasks?.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-white flex items-center gap-1 ml-auto"
              >
                {task.subtasks.filter(s => s.completed).length} de {task.subtasks.length} sub-tareas
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>

          {/* Foto de Evidencia Preview o Carga */}
          {task.photoUrl && (
            <div className="mt-3">
              <img 
                src={task.photoUrl} 
                alt="Evidencia" 
                className="w-full h-32 object-cover rounded-xl border border-gray-700" 
              />
            </div>
          )}

          {/* Subtareas Desplegables */}
          {(isExpanded || task.requirePhoto) && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
              {/* Subtareas Checklist */}
              {task.subtasks?.map(st => (
                <div 
                  key={st.id} 
                  onClick={() => toggleSubtaskCompleted(task.id, st.id)}
                  className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-300 hover:text-white"
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

              {/* Botón de Cargar Foto Evidencia */}
              {task.requirePhoto && !task.photoUrl && (
                <div className="pt-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-amber-500 bg-opacity-20 hover:bg-opacity-30 text-amber-300 font-bold text-xs px-3 py-2 rounded-xl border border-amber-500 transition-colors">
                    <Camera size={14} />
                    <span>{uploadingTaskId === task.id ? 'Subiendo...' : 'Tomar / Adjuntar Foto'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(task.id, e)}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export function QuickTaskDrawer() {
  const { user } = useAuthStore();
  const { 
    tasks, projects, toggleTaskCompleted, toggleSubtaskCompleted, 
    addTask, checkAndGenerateRecurrentTasks, isDrawerOpen, setDrawerOpen 
  } = useTaskStore();

  const [activeFilter, setActiveFilter] = useState('HOY'); // 'HOY' | 'ATRASADAS' | 'TODAS'
  const [newTitle, setNewTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [uploadingTaskId, setUploadingTaskId] = useState(null);

  // Ejecutar verificación de tareas recurrentes al cargar
  useEffect(() => {
    checkAndGenerateRecurrentTasks();
  }, []);

  const userId = user?.id || null;
  const userRole = user?.role || 'pos';
  const userBranchId = user?.branchId || null;
  const todayStr = new Date().toISOString().split('T')[0];

  // Filtrar tareas correspondientes al usuario
  const myTasks = tasks.filter(t => {
    const matchesUser = (!t.assignedToUserId && !t.assignedToRole) ||
                        t.assignedToUserId === userId ||
                        t.assignedToRole === userRole;
    const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
    return matchesUser && matchesBranch;
  });

  const overdueTasks = myTasks.filter(t => !t.completed && t.dueDate < todayStr);
  const todayTasks = myTasks.filter(t => t.dueDate === todayStr);
  const pendingObligatory = myTasks.filter(t => !t.completed && t.enforcementLevel === 'OBLIGATORIA');
  const pendingCount = myTasks.filter(t => !t.completed).length;

  const filteredTasks = myTasks.filter(t => {
    if (activeFilter === 'ATRASADAS') return !t.completed && t.dueDate < todayStr;
    if (activeFilter === 'HOY') return t.dueDate === todayStr || (!t.completed && t.dueDate < todayStr);
    return true;
  });

  const getProject = (pId) => {
    if (!pId) return null;
    return projects.find(p => p.id === pId) || null;
  };

  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle.trim(),
      projectId: selectedProjectId || null,
      assignedToUserId: userId,
      assignedToRole: userRole,
      branchId: userBranchId,
      dueDate: todayStr,
      priority: 'P3',
      enforcementLevel: 'NORMAL',
    });

    setNewTitle('');
    toast.success('Tarea agregada exitosamente');
  };

  const handleFileUpload = (taskId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTaskId(taskId);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      toggleTaskCompleted(taskId, userId, dataUrl);
      setUploadingTaskId(null);
      toast.success('📷 Foto adjuntada y tarea completada');
    };
    reader.readAsDataURL(file);
  };

  const handleToggleTask = (task) => {
    if (!task.completed && task.requirePhoto && !task.photoUrl) {
      toast.error('📷 Esta tarea requiere adjuntar foto evidencia antes de completar');
      return;
    }
    toggleTaskCompleted(task.id, userId);
  };

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black bg-opacity-75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#16171d] border-l border-gray-800 flex flex-col h-full shadow-2xl animate-slide-left">
        
        {/* Header del Drawer */}
        <div className="p-5 border-b border-gray-800 bg-[#1e1f26] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 bg-opacity-20 border border-amber-500 flex items-center justify-center text-xl">
              📋
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Mis Tareas
                {overdueTasks.length > 0 && (
                  <span className="bg-red-500 bg-opacity-20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500">
                    {overdueTasks.length} atrasada(s)
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                {pendingCount === 0 ? '🎉 Todo completado por hoy' : `${pendingCount} tarea(s) pendiente(s)`}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setDrawerOpen(false)} 
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Alerta de Tareas Obligatorias */}
        {pendingObligatory.length > 0 && (
          <div className="bg-red-500 bg-opacity-10 border-b border-red-500 px-5 py-3 flex items-center gap-3">
            <ShieldAlert className="text-red-400 shrink-0" size={18} />
            <p className="text-xs font-bold text-red-300">
              Tienes <span className="underline">{pendingObligatory.length} tarea(s) obligatoria(s)</span> pendientes antes de cerrar el turno.
            </p>
          </div>
        )}

        {/* Filtros estilo Todoist */}
        <div className="px-5 py-3 border-b border-gray-800 bg-[#181920] flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'HOY', label: 'Hoy', count: todayTasks.length },
            { id: 'ATRASADAS', label: 'Atrasadas', count: overdueTasks.length },
            { id: 'TODAS', label: 'Todas', count: myTasks.length },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={
                activeFilter === f.id
                  ? 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-amber-500 text-gray-950 font-black shadow-md'
                  : 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }
            >
              {f.label}
              {f.count > 0 && (
                <span className={activeFilter === f.id ? 'px-1.5 py-0.2 rounded-full text-[10px] bg-gray-950 text-amber-400' : 'px-1.5 py-0.2 rounded-full text-[10px] bg-gray-700 text-gray-300'}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista de Tareas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="font-bold text-sm text-gray-400">¡No hay tareas en esta lista!</p>
              <p className="text-xs mt-1">Estás completamente al día con tus actividades.</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <QuickTaskCard
                key={task.id}
                task={task}
                userId={userId}
                todayStr={todayStr}
                proj={getProject(task.projectId)}
                onToggleTask={handleToggleTask}
                toggleSubtaskCompleted={toggleSubtaskCompleted}
                handleFileUpload={handleFileUpload}
                uploadingTaskId={uploadingTaskId}
              />
            ))
          )}
        </div>

        {/* Quick Add Form en el footer */}
        <form onSubmit={handleQuickAdd} className="p-4 border-t border-gray-800 bg-[#1e1f26] space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="+ Añadir tarea rápida..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-gray-950 font-black text-xs px-4 py-2 rounded-xl active:scale-95 transition-all"
            >
              Añadir
            </button>
          </div>

          {/* Categoría Opcional */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold">Categoría (Opcional):</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-[#121318] border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none"
            >
              <option value="">Sin Categoría</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>
        </form>

      </div>
    </div>
  );
}
