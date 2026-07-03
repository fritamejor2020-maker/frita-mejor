import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';

// Proyectos iniciales por defecto (Estilo Todoist)
const DEFAULT_PROJECTS = [
  { id: 'PROJ-APERTURA', name: 'Apertura de Punto', icon: '🌅', color: '#f59e0b' },
  { id: 'PROJ-OPERACION', name: 'Operación & Servicio', icon: '⚡', color: '#3b82f6' },
  { id: 'PROJ-LIMPIEZA', name: 'Limpieza & Aseo', icon: '🧹', color: '#10b981' },
  { id: 'PROJ-CIERRE', name: 'Cierre de Turno', icon: '🌙', color: '#8b5cf6' },
  { id: 'PROJ-MANTENIMIENTO', name: 'Mantenimiento', icon: '🛠️', color: '#ef4444' },
];

// Plantillas de tareas recurrentes por defecto
const DEFAULT_TEMPLATES = [
  {
    id: 'TPL-001',
    title: 'Checklist de Apertura de Caja y Punto',
    description: 'Verificar aseo, contar base de dinero e encender equipos',
    projectId: 'PROJ-APERTURA',
    priority: 'P1',
    assignedToRole: 'pos',
    dueTime: '07:00',
    enforcementLevel: 'OBLIGATORIA',
    requirePhoto: false,
    requireNote: false,
    subtasks: [
      { id: 'ST-1', title: 'Verificar aseo del área de atención', completed: false },
      { id: 'ST-2', title: 'Contar base de efectivo en caja', completed: false },
      { id: 'ST-3', title: 'Encender freidoras y mostradores', completed: false },
    ],
    recurrence: { type: 'DAILY' },
    active: true,
  },
  {
    id: 'TPL-002',
    title: 'Limpieza y Desinfección de Freidoras',
    description: 'Filtrar aceite o cambiarlo, desengrasar tinas y secar',
    projectId: 'PROJ-LIMPIEZA',
    priority: 'P1',
    assignedToRole: 'pos',
    dueTime: '15:00',
    enforcementLevel: 'OBLIGATORIA',
    requirePhoto: true,
    requireNote: false,
    subtasks: [
      { id: 'ST-10', title: 'Desocupar aceite en contenedor de reciclaje', completed: false },
      { id: 'ST-11', title: 'Lavar tinas con desengrasante', completed: false },
      { id: 'ST-12', title: 'Tomar foto de la freidora limpia y seca', completed: false },
    ],
    recurrence: { type: 'DAILY' },
    active: true,
  },
  {
    id: 'TPL-003',
    title: 'Cierre Z y Arqueo de Caja Registradora',
    description: 'Realizar cuadre en POS y guardar efectivo en sobre de recaudo',
    projectId: 'PROJ-CIERRE',
    priority: 'P1',
    assignedToRole: 'pos',
    dueTime: '21:00',
    enforcementLevel: 'OBLIGATORIA',
    requirePhoto: true,
    requireNote: true,
    subtasks: [
      { id: 'ST-20', title: 'Realizar cuadre en POS', completed: false },
      { id: 'ST-21', title: 'Guardar efectivo en sobre de recaudo', completed: false },
    ],
    recurrence: { type: 'DAILY' },
    active: true,
  }
];

function syncTasks(state) {
  markLocalWrite('tasks_data');
  push('tasks_data', {
    tasks: state.tasks,
    projects: state.projects,
    taskTemplates: state.taskTemplates,
  }).catch(() => {});
}

export const useTaskStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      projects: DEFAULT_PROJECTS,
      taskTemplates: DEFAULT_TEMPLATES,
      lastRecurrenceCheckDate: null,

      // --- Carga remota ---
      loadFromRemote: (data) => {
        if (!data) return;
        set({
          tasks: data.tasks || get().tasks,
          projects: data.projects && data.projects.length > 0 ? data.projects : get().projects,
          taskTemplates: data.taskTemplates && data.taskTemplates.length > 0 ? data.taskTemplates : get().taskTemplates,
        });
      },

      // --- Gestión de Proyectos ---
      addProject: (projectData) => {
        const newProj = {
          id: `PROJ-${Date.now()}`,
          name: projectData.name,
          icon: projectData.icon || '📁',
          color: projectData.color || '#6b7280',
        };
        set(state => {
          const updated = { projects: [...state.projects, newProj] };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      updateProject: (id, updates) => {
        set(state => {
          const updated = {
            projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      deleteProject: (id) => {
        set(state => {
          const updated = {
            projects: state.projects.filter(p => p.id !== id)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      // --- Gestión de Plantillas Recurrentes ---
      addTaskTemplate: (tplData) => {
        const newTpl = {
          id: `TPL-${Date.now()}`,
          title: tplData.title,
          description: tplData.description || '',
          projectId: tplData.projectId || 'PROJ-OPERACION',
          priority: tplData.priority || 'P3',
          assignedToUserId: tplData.assignedToUserId || null,
          assignedToRole: tplData.assignedToRole || 'pos',
          branchId: tplData.branchId || null,
          dueTime: tplData.dueTime || null,
          enforcementLevel: tplData.enforcementLevel || 'NORMAL',
          requirePhoto: !!tplData.requirePhoto,
          requireNote: !!tplData.requireNote,
          subtasks: (tplData.subtasks || []).map((st, idx) => ({
            id: st.id || `ST-${Date.now()}-${idx}`,
            title: typeof st === 'string' ? st : st.title,
            completed: false
          })),
          recurrence: tplData.recurrence || { type: 'DAILY' },
          active: true,
        };

        set(state => {
          const updated = { taskTemplates: [...state.taskTemplates, newTpl] };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      updateTaskTemplate: (id, updates) => {
        set(state => {
          const updated = {
            taskTemplates: state.taskTemplates.map(t => t.id === id ? { ...t, ...updates } : t)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      deleteTaskTemplate: (id) => {
        set(state => {
          const updated = {
            taskTemplates: state.taskTemplates.filter(t => t.id !== id)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      // --- Gestión de Tareas Instanciadas ---
      addTask: (taskData) => {
        const newTask = {
          id: `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: taskData.title,
          description: taskData.description || '',
          projectId: taskData.projectId || 'PROJ-OPERACION',
          priority: taskData.priority || 'P3',
          assignedToUserId: taskData.assignedToUserId || null,
          assignedToRole: taskData.assignedToRole || null,
          branchId: taskData.branchId || null,
          dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
          dueTime: taskData.dueTime || null,
          enforcementLevel: taskData.enforcementLevel || 'NORMAL',
          requirePhoto: !!taskData.requirePhoto,
          requireNote: !!taskData.requireNote,
          subtasks: (taskData.subtasks || []).map((st, idx) => ({
            id: st.id || `ST-${Date.now()}-${idx}`,
            title: typeof st === 'string' ? st : st.title,
            completed: false
          })),
          photoUrl: taskData.photoUrl || null,
          note: taskData.note || null,
          completed: false,
          completedAt: null,
          completedByUserId: null,
          templateId: taskData.templateId || null,
          createdAt: new Date().toISOString(),
        };

        set(state => {
          const updated = { tasks: [newTask, ...state.tasks] };
          syncTasks({ ...state, ...updated });
          return updated;
        });
        return newTask;
      },

      updateTask: (id, updates) => {
        set(state => {
          const updated = {
            tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      reassignTask: (id, userId, userName = null) => {
        set(state => {
          const updated = {
            tasks: state.tasks.map(t => t.id === id ? { 
              ...t, 
              assignedToUserId: userId,
              assignedToUserName: userName || (userId ? 'Usuario' : 'Sin Asignar')
            } : t)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      addDamageReport: (reportData) => {
        const newTask = {
          id: `DAMAGE-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: `🚨 DAÑO: ${reportData.equipmentName || 'Equipo / Instalación'}`,
          description: reportData.description || '',
          projectId: 'PROJ-MANTENIMIENTO',
          priority: 'P1',
          assignedToUserId: reportData.assignedToUserId || null,
          assignedToUserName: reportData.assignedToUserName || null,
          assignedToRole: 'admin',
          branchId: reportData.branchId || 'GLOBAL',
          dueDate: new Date().toISOString().split('T')[0],
          dueTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          enforcementLevel: 'IMPORTANTE',
          requirePhoto: true,
          requireNote: false,
          isDamageReport: true,
          equipmentName: reportData.equipmentName || '',
          reportedBy: reportData.reportedBy || 'Anónimo / QR Público',
          contactPhone: reportData.contactPhone || '',
          mediaUrl: reportData.mediaUrl || null,
          mediaType: reportData.mediaType || 'photo', // 'photo' | 'video'
          photoUrl: reportData.mediaType !== 'video' ? reportData.mediaUrl : null,
          subtasks: [
            { id: `ST-DMG-1`, title: 'Inspeccionar equipo y evaluar daño', completed: false },
            { id: `ST-DMG-2`, title: 'Contactar técnico o proveedor de repuesto', completed: false },
            { id: `ST-DMG-3`, title: 'Prueba de funcionamiento y cierre de reporte', completed: false },
          ],
          completed: false,
          completedAt: null,
          completedByUserId: null,
          createdAt: new Date().toISOString(),
        };

        set(state => {
          const updated = { tasks: [newTask, ...state.tasks] };
          syncTasks({ ...state, ...updated });
          return updated;
        });
        return newTask;
      },

      deleteTask: (id) => {
        set(state => {
          const updated = {
            tasks: state.tasks.filter(t => t.id !== id)
          };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      toggleTaskCompleted: (id, userId = null, photoUrl = null, note = null) => {
        const today = new Date().toISOString();
        set(state => {
          const updatedTasks = state.tasks.map(task => {
            if (task.id !== id) return task;
            const willBeCompleted = !task.completed;

            // Verificar si todas las subtareas deben marcarse
            const updatedSubtasks = task.subtasks.map(st => ({
              ...st,
              completed: willBeCompleted
            }));

            return {
              ...task,
              completed: willBeCompleted,
              completedAt: willBeCompleted ? today : null,
              completedByUserId: willBeCompleted ? userId : null,
              photoUrl: photoUrl || task.photoUrl,
              note: note || task.note,
              subtasks: updatedSubtasks,
            };
          });

          const updated = { tasks: updatedTasks };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      toggleSubtaskCompleted: (taskId, subtaskId) => {
        set(state => {
          const updatedTasks = state.tasks.map(task => {
            if (task.id !== taskId) return task;
            const updatedSubtasks = task.subtasks.map(st =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st
            );
            const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);

            return {
              ...task,
              subtasks: updatedSubtasks,
              completed: allDone,
              completedAt: allDone ? new Date().toISOString() : task.completedAt
            };
          });

          const updated = { tasks: updatedTasks };
          syncTasks({ ...state, ...updated });
          return updated;
        });
      },

      // --- Generador Nocturno / En Vivo de Tareas Recurrentes ---
      checkAndGenerateRecurrentTasks: () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0: Dom, 1: Lun ... 6: Sáb
        const dayOfMonth = now.getDate();

        const { lastRecurrenceCheckDate, taskTemplates, tasks, addTask } = get();

        // Si ya revisamos hoy, omitir
        if (lastRecurrenceCheckDate === todayStr) return;

        set({ lastRecurrenceCheckDate: todayStr });

        (taskTemplates || []).forEach(tpl => {
          if (!tpl.active) return;

          // Verificar si ya existe una tarea instanciada hoy para esta plantilla
          const alreadyExistsToday = tasks.some(t => t.templateId === tpl.id && t.dueDate === todayStr);
          if (alreadyExistsToday) return;

          let shouldGenerate = false;
          const rec = tpl.recurrence || { type: 'DAILY' };

          if (rec.type === 'DAILY') {
            shouldGenerate = true;
          } else if (rec.type === 'WEEKLY') {
            const days = rec.daysOfWeek || [1, 2, 3, 4, 5, 6, 0];
            if (days.includes(dayOfWeek)) shouldGenerate = true;
          } else if (rec.type === 'MONTHLY') {
            const targetDay = rec.dayOfMonth || 1;
            if (dayOfMonth === targetDay) shouldGenerate = true;
          }

          if (shouldGenerate) {
            addTask({
              title: tpl.title,
              description: tpl.description,
              projectId: tpl.projectId,
              priority: tpl.priority,
              assignedToUserId: tpl.assignedToUserId,
              assignedToRole: tpl.assignedToRole,
              branchId: tpl.branchId,
              dueDate: todayStr,
              dueTime: tpl.dueTime,
              enforcementLevel: tpl.enforcementLevel,
              requirePhoto: tpl.requirePhoto,
              requireNote: tpl.requireNote,
              subtasks: tpl.subtasks,
              templateId: tpl.id,
            });
          }
        });
      },

      // --- Consultas Helper ---
      getTasksForUser: (userId, userRole = 'pos', userBranchId = null) => {
        const todayStr = new Date().toISOString().split('T')[0];
        return (get().tasks || []).filter(t => {
          const matchesUser = (!t.assignedToUserId && !t.assignedToRole) ||
                              t.assignedToUserId === userId ||
                              t.assignedToRole === userRole;
          const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
          return matchesUser && matchesBranch;
        });
      },
    }),
    {
      name: 'frita-mejor-tasks-storage',
    }
  )
);
