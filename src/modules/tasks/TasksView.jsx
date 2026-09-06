import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { 
  CheckCircle2, Circle, Clock, AlertTriangle, Camera, Plus, ChevronRight, 
  ChevronDown, X, Sparkles, Filter, Lock, ShieldAlert, Tag, Calendar, 
  FolderPlus, Flag, CheckSquare, Layers, Trash2, Edit2, ArrowLeft,
  QrCode, UserCheck, Phone, Video, Wrench, ExternalLink, Repeat,
  Thermometer, Droplets
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { TaskEvidenceModal } from './components/TaskEvidenceModal';

const MODULE_ROUTES = {
  pos: { route: '/pos', name: 'Punto de Venta (POS)', icon: '💻' },
  bodega: { route: '/bodega', name: 'Bodega / Inventario', icon: '📦' },
  produccion: { route: '/produccion', name: 'Producción', icon: '🏭' },
  fritado: { route: '/fritado', name: 'Fritado / Cocina', icon: '🍳' },
  tareas: { route: '/tareas', name: 'Gestión de Tareas', icon: '📋' },
  asistencia: { route: '/asistencia', name: 'Asistencia y Turnos', icon: '⏱️' },
  cierres: { route: '/cierres', name: 'Auditor de Cierres', icon: '🧾' },
};

function TaskCard({ 
  task, userId, userName, todayStr, proj, pBadge, 
  onToggle, onDelete, onToggleSubtask, onReassign, 
  allAssignableEmployees = [], onNavigateModule, onOpenEvidence 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const isOverdue = !task.completed && task.dueDate < todayStr;
  const completedSubtasks = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
  const totalSubtasks = task.subtasks ? task.subtasks.length : 0;

  const handleSelfAssign = () => {
    onReassign(task.id, userId, userName || 'Administrador', null);
    setShowAssignDropdown(false);
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
          onClick={() => {
            if (!task.completed && task.requirePhoto && !task.photoUrl) {
              onOpenEvidence && onOpenEvidence(task);
            } else {
              onToggle(task.id);
            }
          }}
          className="mt-0.5 shrink-0 text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
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
              {/* Botón Asignar Interactivo */}
              <div className="relative">
                <button
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="Cambiar persona o rol asignado"
                >
                  <UserCheck size={12} />
                  <span>{task.assignedToUserName ? `Asignado: ${task.assignedToUserName}` : 'Sin Asignar'}</span>
                  <ChevronDown size={11} />
                </button>

                {showAssignDropdown && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-[#1e202b] border border-gray-700 rounded-2xl p-2 shadow-2xl z-50 animate-fadeIn text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-2 py-1">Reasignar a:</p>
                    <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                      <button
                        onClick={handleSelfAssign}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-300 hover:bg-amber-500/20 flex items-center gap-2"
                      >
                        <span>👤 Asignarme a mí ({userName})</span>
                      </button>
                      <button
                        onClick={() => { onReassign(task.id, null, 'Todos', null); setShowAssignDropdown(false); toast.success('👥 Asignada a todos en turno'); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span>👥 Todos en turno (Sin asignar)</span>
                      </button>

                      <div className="h-px bg-gray-800 my-1"></div>
                      <p className="text-[9px] font-bold text-gray-500 px-2">Cargos / Roles:</p>
                      {[
                        { key: 'pos', label: '💻 Cajero (POS)' },
                        { key: 'fritado', label: '🍳 Cocina / Fritador' },
                        { key: 'vendedor', label: '🛵 Vendedor Móvil' },
                        { key: 'dejador', label: '📦 Dejador / Repartidor' },
                        { key: 'bodeguero', label: '📦 Bodega' },
                      ].map(r => (
                        <button
                          key={r.key}
                          onClick={() => { onReassign(task.id, null, r.label.replace(/^[^\s]+\s/, ''), r.key); setShowAssignDropdown(false); toast.success(`Asignada a ${r.label}`); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                        >
                          <span>{r.label}</span>
                        </button>
                      ))}

                      {allAssignableEmployees.length > 0 && (
                        <React.Fragment>
                          <div className="h-px bg-gray-800 my-1"></div>
                          <p className="text-[9px] font-bold text-gray-500 px-2">Empleados:</p>
                          {allAssignableEmployees.map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => { onReassign(task.id, emp.id, emp.name, emp.role); setShowAssignDropdown(false); toast.success(`Asignada a ${emp.name}`); }}
                              className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                            >
                              <span>👤 {emp.name}</span>
                            </button>
                          ))}
                        </React.Fragment>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Evidencia */}
              {(task.requirePhoto || task.photoUrl || task.evidence) && (
                <button
                  onClick={() => onOpenEvidence && onOpenEvidence(task)}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="Ver o adjuntar evidencia fotográfica y BPM"
                >
                  <Camera size={12} />
                  <span>{task.photoUrl ? 'Evidencia ✓' : 'Subir Foto'}</span>
                </button>
              )}

              {/* Botón Directo al Módulo si aplica */}
              {task.targetModule && task.targetModule !== 'none' && MODULE_ROUTES[task.targetModule] && (
                <button
                  onClick={() => onNavigateModule && onNavigateModule(task.targetModule)}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="Abrir módulo en la app para resolver la tarea"
                >
                  <ExternalLink size={12} />
                  <span>{MODULE_ROUTES[task.targetModule].icon} {MODULE_ROUTES[task.targetModule].name}</span>
                </button>
              )}

              <button
                onClick={() => onDelete(task.id)}
                className="text-gray-600 hover:text-red-400 p-1 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
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

          {/* Evidencias BPM (Temperaturas y Aceite) */}
          {task.evidence && (
            <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-bold">
              {task.evidence.fryerTemp && (
                <span className="px-2 py-0.5 rounded-lg bg-orange-950/70 text-orange-300 border border-orange-500/40 flex items-center gap-1">
                  <Thermometer size={11} /> Freidora: {task.evidence.fryerTemp}°C
                </span>
              )}
              {task.evidence.freezerTemp && (
                <span className="px-2 py-0.5 rounded-lg bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <Thermometer size={11} /> Nevera: {task.evidence.freezerTemp}°C
                </span>
              )}
              {task.evidence.oilCondition && (
                <span className="px-2 py-0.5 rounded-lg bg-yellow-950/70 text-yellow-300 border border-yellow-500/40 flex items-center gap-1">
                  <Droplets size={11} /> Aceite: {task.evidence.oilCondition === 'OPTIMO' ? 'Óptimo' : task.evidence.oilCondition === 'NORMAL' ? 'Normal' : task.evidence.oilCondition === 'REQUIERE_FILTRADO' ? 'Requiere Filtrado' : 'Cambio Urgente'}
                </span>
              )}
            </div>
          )}

          {/* Nota del operario */}
          {task.note && (
            <div className="mt-2 text-[11px] text-gray-300 bg-[#121318] p-2 rounded-xl border border-gray-800 flex items-start gap-2">
              <span className="text-amber-400 font-bold shrink-0">📝 Nota:</span>
              <span className="italic">{task.note}</span>
            </div>
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
  const { user, users } = useAuthStore();
  const employeeContracts = useAttendanceStore((s) => s.employeeContracts) || [];
  const { 
    tasks, projects, addTask, toggleTaskCompleted, toggleSubtaskCompleted, 
    deleteTask, addProject, deleteProject, reassignTask, checkAndGenerateRecurrentTasks 
  } = useTaskStore();

  const [activeNav, setActiveNav] = useState('HOY'); // 'HOY' | 'ATRASADAS' | 'PROXIMO' | 'DANOS' | projectId
  const [activeAreaFilter, setActiveAreaFilter] = useState('ALL'); // 'ALL' | 'MINE' | 'pos' | 'fritado' | 'bodeguero' | 'dejador'
  const [evidenceTask, setEvidenceTask] = useState(null);
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
  const [assigneeSelect, setAssigneeSelect] = useState('role:all');
  const [targetModule, setTargetModule] = useState('none');
  const [recurrenceType, setRecurrenceType] = useState('NONE'); // 'NONE' | 'DAILY' | 'WEEKLY'
  const [enforcementLevel, setEnforcementLevel] = useState('NORMAL');
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [subtasksInput, setSubtasksInput] = useState(['']);

  // Modal para proyecto nuevo
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectIcon, setNewProjectIcon] = useState('📁');
  const [newProjectColor, setNewProjectColor] = useState('#f59e0b');

  const userId = user?.id || null;
  const userName = user?.name || 'Administrador';
  const userRole = (user?.role || 'pos').toLowerCase();
  const userBranchId = user?.branchId || null;
  const todayStr = new Date().toISOString().split('T')[0];

  const publicReportUrl = window.location.origin + '/reportar-dano';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(publicReportUrl);

  const ROLES_LIST = [
    { key: 'all', label: '👥 Todos los roles (Cualquiera en turno)' },
    { key: 'pos', label: '💻 Cajero (POS)' },
    { key: 'fritado', label: '🍳 Cocina / Fritador' },
    { key: 'vendedor', label: '🛵 Vendedor Móvil / Triciclo' },
    { key: 'dejador', label: '📦 Dejador / Repartidor' },
    { key: 'bodeguero', label: '📦 Bodega / Inventario' },
    { key: 'gerente', label: '👔 Gerente' },
    { key: 'admin', label: '👑 Administrador' },
  ];

  const MODULE_OPTIONS = [
    { key: 'none', label: '🏠 Tarea Física / Local (Sin módulo)', icon: '🏠' },
    { key: 'pos', label: '💻 Punto de Venta (POS)', icon: '💻' },
    { key: 'bodega', label: '📦 Bodega / Inventario', icon: '📦' },
    { key: 'produccion', label: '🏭 Producción', icon: '🏭' },
    { key: 'fritado', label: '🍳 Fritado / Cocina', icon: '🍳' },
    { key: 'tareas', label: '📋 Gestión de Tareas', icon: '📋' },
    { key: 'asistencia', label: '⏱️ Asistencia y Turnos', icon: '⏱️' },
    { key: 'cierres', label: '🧾 Auditor de Cierres', icon: '🧾' },
  ];

  const allAssignableEmployees = React.useMemo(() => {
    const list = [];
    const seen = new Set();

    (users || []).forEach(u => {
      if (u.name) {
        list.push({
          id: u.id,
          name: u.name,
          role: u.role,
          label: `${u.name} (${u.role || 'Usuario'})`
        });
        seen.add(u.name.trim().toLowerCase());
      }
    });

    (employeeContracts || []).forEach(c => {
      const cleanName = String(c.fullName || '').trim();
      if (cleanName && !seen.has(cleanName.toLowerCase()) && !cleanName.toLowerCase().startsWith('empleado #')) {
        list.push({
          id: c.employeeId || `EMP-${c.employeeNo}`,
          name: cleanName,
          role: null,
          label: `${cleanName} (Personal)`
        });
        seen.add(cleanName.toLowerCase());
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [users, employeeContracts]);

  useEffect(() => {
    checkAndGenerateRecurrentTasks();
  }, []);

  // Filtrar mis tareas (Admins y Gerentes ven todo; otros ven lo asignado a ellos, a su rol o a todos)
  const myTasks = tasks.filter(t => {
    if (userRole === 'admin' || userRole === 'gerente') return true;

    const matchesUser = (!t.assignedToUserId && !t.assignedToRole) ||
                        t.assignedToUserId === userId ||
                        t.assignedToUserName?.toLowerCase() === userName?.toLowerCase() ||
                        t.assignedToRole === userRole ||
                        (t.assignedToRole === 'pos' && (userRole === 'cajero' || userRole === 'pos'));
    const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
    return matchesUser && matchesBranch;
  });

  const damageTasks = tasks.filter(t => t.isDamageReport || t.projectId === 'PROJ-MANTENIMIENTO');
  const overdueTasks = myTasks.filter(t => !t.completed && t.dueDate < todayStr);
  const todayTasks = myTasks.filter(t => t.dueDate === todayStr);

  // Métricas de Cumplimiento Ejecutivo del Día (Semáforo de Cumplimiento)
  const todayBaseTasks = tasks.filter(t => {
    const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
    return matchesBranch && (t.dueDate === todayStr || (!t.completed && t.dueDate < todayStr));
  });

  const metricsTotal = todayBaseTasks.length;
  const metricsCompleted = todayBaseTasks.filter(t => t.completed).length;
  const metricsPending = metricsTotal - metricsCompleted;
  const metricsObligatoryTotal = todayBaseTasks.filter(t => t.enforcementLevel === 'OBLIGATORIA').length;
  const metricsObligatoryCompleted = todayBaseTasks.filter(t => t.enforcementLevel === 'OBLIGATORIA' && t.completed).length;
  const metricsObligatoryPending = metricsObligatoryTotal - metricsObligatoryCompleted;
  const metricsWithEvidence = todayBaseTasks.filter(t => t.photoUrl || t.mediaUrl || t.evidence?.fryerTemp || t.evidence?.freezerTemp || t.evidence?.oilCondition).length;
  const completionRate = metricsTotal > 0 ? Math.round((metricsCompleted / metricsTotal) * 100) : 100;

  const getFilteredTasks = () => {
    let baseList = [];
    if (activeNav === 'ATRASADAS') baseList = overdueTasks;
    else if (activeNav === 'HOY') baseList = myTasks.filter(t => t.dueDate === todayStr || (!t.completed && t.dueDate < todayStr));
    else if (activeNav === 'PROXIMO') baseList = myTasks.filter(t => t.dueDate > todayStr);
    else if (activeNav === 'DANOS') baseList = damageTasks;
    else baseList = myTasks.filter(t => t.projectId === activeNav);

    if (activeAreaFilter === 'ALL') return baseList;
    if (activeAreaFilter === 'MINE') {
      return baseList.filter(t => {
        return (!t.assignedToUserId && !t.assignedToRole) ||
               t.assignedToUserId === userId ||
               t.assignedToUserName?.toLowerCase() === userName?.toLowerCase() ||
               t.assignedToRole === userRole;
      });
    }
    return baseList.filter(t => {
      const r = (t.assignedToRole || '').toLowerCase();
      const m = (t.targetModule || '').toLowerCase();
      if (activeAreaFilter === 'pos') {
        return r === 'pos' || r === 'cajero' || m === 'pos';
      }
      if (activeAreaFilter === 'fritado') {
        return r === 'fritado' || r === 'cocina' || m === 'fritado';
      }
      if (activeAreaFilter === 'bodeguero') {
        return r === 'bodeguero' || r === 'bodega' || m === 'bodega';
      }
      if (activeAreaFilter === 'dejador') {
        return r === 'dejador' || r === 'vendedor' || m === 'dejador' || m === 'vendedor';
      }
      return r === activeAreaFilter || m === activeAreaFilter;
    });
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

    let assignedRole = null;
    let assignedUserId = null;
    let assignedUserName = null;

    if (assigneeSelect.startsWith('role:')) {
      const r = assigneeSelect.replace('role:', '');
      if (r !== 'all') {
        assignedRole = r;
        const matched = ROLES_LIST.find(x => x.key === r);
        assignedUserName = matched ? matched.label.replace(/^[^\s]+\s/, '') : r;
      } else {
        assignedUserName = 'Todos';
      }
    } else if (assigneeSelect.startsWith('person:')) {
      const personId = assigneeSelect.replace('person:', '');
      const person = allAssignableEmployees.find(p => p.id === personId);
      if (person) {
        assignedUserId = person.id;
        assignedUserName = person.name;
        assignedRole = person.role || null;
      }
    }

    addTask({
      title: title.trim(),
      description: description.trim(),
      projectId,
      priority,
      assignedToUserId: assignedUserId,
      assignedToUserName: assignedUserName,
      assignedToRole: assignedRole,
      branchId: userBranchId,
      dueDate,
      dueTime: dueTime || null,
      targetModule,
      enforcementLevel,
      requirePhoto,
      subtasks: cleanSubtasks,
      recurrence: recurrenceType !== 'NONE' ? { type: recurrenceType } : null,
    });

    setTitle('');
    setDescription('');
    setDueTime('');
    setRequirePhoto(false);
    setRecurrenceType('NONE');
    setTargetModule('none');
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

  const handleNavigateModule = (modKey) => {
    const target = MODULE_ROUTES[modKey];
    if (!target) return;
    if (user && user.access && !user.access.includes(modKey) && user.access.indexOf('*') === -1) {
      user.access.push(modKey);
    }
    navigate(target.route);
  };

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

          {/* ── SEMÁFORO Y MÉTRICAS DE CUMPLIMIENTO OPERATIVO ── */}
          <div className="bg-[#16171e] border border-gray-800 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>📊</span> Cumplimiento Operativo del Día
                </span>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                  completionRate >= 80 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50' 
                    : completionRate >= 50 
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50' 
                    : 'bg-red-950/80 text-red-300 border border-red-500/50'
                }`}>
                  {completionRate >= 80 ? '🟢 Excelente' : completionRate >= 50 ? '🟡 Regular' : '🔴 Crítico'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">Progreso diario:</span>
                <span className="text-base font-black font-mono text-amber-400">
                  {completionRate}%
                </span>
              </div>
            </div>

            {/* Barra de Progreso Visual */}
            <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-gray-800">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  completionRate >= 80 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                    : completionRate >= 50 
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
                    : 'bg-gradient-to-r from-red-600 to-orange-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
              />
            </div>

            {/* Indicadores Clave en Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="bg-[#121318] p-2.5 rounded-2xl border border-gray-800/80">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Completadas</span>
                <span className="text-sm font-black text-white font-mono mt-0.5 block">{metricsCompleted} / {metricsTotal}</span>
              </div>
              <div className="bg-[#121318] p-2.5 rounded-2xl border border-gray-800/80">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Pendientes</span>
                <span className="text-sm font-black text-amber-400 font-mono mt-0.5 block">{metricsPending}</span>
              </div>
              <div className="bg-[#121318] p-2.5 rounded-2xl border border-gray-800/80">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Obligatorias</span>
                <span className={`text-sm font-black font-mono mt-0.5 block ${metricsObligatoryPending > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {metricsObligatoryCompleted} / {metricsObligatoryTotal} {metricsObligatoryPending > 0 ? '⚠️' : '✓'}
                </span>
              </div>
              <div className="bg-[#121318] p-2.5 rounded-2xl border border-gray-800/80">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Con Evidencia</span>
                <span className="text-sm font-black text-blue-400 font-mono mt-0.5 block">📷 {metricsWithEvidence}</span>
              </div>
            </div>
          </div>

          {/* ── FILTROS RÁPIDOS POR ROL / ÁREA ── */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { key: 'ALL', label: 'Todas las áreas', icon: '🌐' },
              { key: 'MINE', label: 'Mis Tareas', icon: '👤' },
              { key: 'pos', label: 'Caja (POS)', icon: '💻' },
              { key: 'fritado', label: 'Cocina / Fritado', icon: '🍳' },
              { key: 'bodeguero', label: 'Bodega', icon: '📦' },
              { key: 'dejador', label: 'Reparto / Domicilios', icon: '🛵' },
            ].map(f => {
              const isSelected = activeAreaFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveAreaFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-gray-950 shadow-md font-black'
                      : 'bg-[#181920] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
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

                {/* Asignado A (Rol o Empleado) */}
                <select
                  value={assigneeSelect}
                  onChange={(e) => setAssigneeSelect(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-amber-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                  title="Asignar a un rol o a un empleado en específico"
                >
                  <optgroup label="Cargos / Roles">
                    {ROLES_LIST.map(r => (
                      <option key={r.key} value={`role:${r.key}`}>{r.label}</option>
                    ))}
                  </optgroup>
                  {allAssignableEmployees.length > 0 && (
                    <optgroup label="Personas / Empleados">
                      {allAssignableEmployees.map(emp => (
                        <option key={emp.id} value={`person:${emp.id}`}>👤 {emp.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Fecha Límite */}
                <div className="flex items-center gap-1 bg-[#22242e] border border-gray-700 rounded-xl px-2 py-1">
                  <Calendar size={13} className="text-gray-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-transparent text-gray-200 text-xs font-bold focus:outline-none"
                  />
                  <div className="flex items-center gap-1 ml-1 border-l border-gray-700 pl-1">
                    <button
                      type="button"
                      onClick={() => setDueDate(todayStr)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${dueDate === todayStr ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setDueDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold text-gray-400 hover:text-white transition-colors"
                    >
                      Mañana
                    </button>
                  </div>
                </div>

                {/* Hora Específica */}
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                  title="Hora límite opcional"
                />

                {/* Recurrencia */}
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-purple-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                  title="Repetición automática de la tarea"
                >
                  <option value="NONE">⏱️ Sin Repetición (Una vez)</option>
                  <option value="DAILY">🔁 Repetir Diario</option>
                  <option value="WEEKLY">📅 Repetir Semanal</option>
                </select>

                {/* Módulo / Destino en la App */}
                <select
                  value={targetModule}
                  onChange={(e) => setTargetModule(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-blue-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                  title="Módulo de la app donde se resuelve esta tarea"
                >
                  {MODULE_OPTIONS.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>

                {/* Nivel de Exigencia */}
                <select
                  value={enforcementLevel}
                  onChange={(e) => setEnforcementLevel(e.target.value)}
                  className="bg-[#22242e] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
                  title="Nivel de exigencia al finalizar turno"
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
                  onReassign={(tId, uId, uName, uRole) => reassignTask(tId, uId, uName, uRole)}
                  allAssignableEmployees={allAssignableEmployees}
                  onNavigateModule={handleNavigateModule}
                  onOpenEvidence={(task) => setEvidenceTask(task)}
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

      {/* ── MODAL EVIDENCIA Y BPM ── */}
      {evidenceTask && (
        <TaskEvidenceModal
          task={evidenceTask}
          onClose={() => setEvidenceTask(null)}
          onComplete={(tId, evData) => {
            toggleTaskCompleted(tId, userId, evData);
          }}
        />
      )}

    </div>
  );
}
