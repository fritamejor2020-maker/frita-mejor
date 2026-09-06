import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { push } from '../lib/syncManager';
import { markLocalWrite } from '../lib/useRealtimeSync';
import { supabase } from '../lib/supabase';

// Proyectos iniciales por defecto (Estilo Todoist)
const DEFAULT_PROJECTS = [
  { id: 'PROJ-APERTURA', name: 'Apertura de Punto', icon: '🌅', color: '#f59e0b' },
  { id: 'PROJ-OPERACION', name: 'Operación & Servicio', icon: '⚡', color: '#3b82f6' },
  { id: 'PROJ-LIMPIEZA', name: 'Limpieza & Aseo', icon: '🧹', color: '#10b981' },
  { id: 'PROJ-CIERRE', name: 'Cierre de Turno', icon: '🌙', color: '#8b5cf6' },
  { id: 'PROJ-MANTENIMIENTO', name: 'Mantenimiento', icon: '🛠️', color: '#ef4444' },
];

// Plantillas de tareas recurrentes por defecto (vacio por defecto)
const DEFAULT_TEMPLATES = [];

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
      taskTemplates: [],
      lastRecurrenceCheckDate: null,
      isDrawerOpen: false,
      isSignOutBlocked: false,
      pendingBlockingTasks: [],

      setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
      openSignOutGuard: (tasks) => set({ isSignOutBlocked: true, pendingBlockingTasks: tasks }),
      closeSignOutGuard: () => set({ isSignOutBlocked: false, pendingBlockingTasks: [] }),

      // --- Carga remota ---
      loadFromRemote: async (remoteData = null) => {
        let data = remoteData;
        if (!data) {
          try {
            const { data: row } = await supabase
              .from('app_state')
              .select('value')
              .eq('key', 'tasks_data')
              .maybeSingle();
            if (row && row.value) data = row.value;
          } catch (e) {}
        }
        if (!data) return;
        set({
          tasks: Array.isArray(data.tasks) ? data.tasks : [],
          projects: data.projects && data.projects.length > 0 ? data.projects : get().projects,
          taskTemplates: Array.isArray(data.taskTemplates) ? data.taskTemplates : [],
        });
      },

      clearAllTasks: () => {
        set(state => {
          const updated = { tasks: [], taskTemplates: [] };
          syncTasks({ ...state, ...updated });
          return updated;
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
          projectId: taskData.projectId || null,
          priority: taskData.priority || 'P3',
          assignedToUserId: taskData.assignedToUserId || null,
          assignedToUserName: taskData.assignedToUserName || null,
          assignedToRole: taskData.assignedToRole || null,
          branchId: taskData.branchId || null,
          dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
          dueTime: taskData.dueTime || null,
          targetModule: taskData.targetModule || 'none',
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

        // Si se configuró recurrencia, registrar o mantener la plantilla para futuros días
        let newTemplates = null;
        if (taskData.recurrence && taskData.recurrence.type && taskData.recurrence.type !== 'NONE') {
          const tpl = {
            id: `TPL-${Date.now()}`,
            title: taskData.title,
            description: taskData.description || '',
            projectId: taskData.projectId || 'PROJ-OPERACION',
            priority: taskData.priority || 'P3',
            assignedToUserId: taskData.assignedToUserId || null,
            assignedToUserName: taskData.assignedToUserName || null,
            assignedToRole: taskData.assignedToRole || null,
            branchId: taskData.branchId || null,
            dueTime: taskData.dueTime || null,
            targetModule: taskData.targetModule || 'none',
            enforcementLevel: taskData.enforcementLevel || 'NORMAL',
            requirePhoto: !!taskData.requirePhoto,
            requireNote: !!taskData.requireNote,
            subtasks: taskData.subtasks || [],
            recurrence: taskData.recurrence,
            active: true,
          };
          newTask.templateId = tpl.id;
          newTemplates = tpl;
        }

        set(state => {
          const updated = {
            tasks: [newTask, ...state.tasks],
            ...(newTemplates ? { taskTemplates: [...state.taskTemplates, newTemplates] } : {})
          };
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

      reassignTask: (id, userId, userName = null, role = null) => {
        set(state => {
          const updated = {
            tasks: state.tasks.map(t => t.id === id ? { 
              ...t, 
              assignedToUserId: userId || null,
              assignedToUserName: userName || (userId ? 'Usuario' : (role ? `Rol: ${role}` : 'Sin Asignar')),
              assignedToRole: role !== undefined ? role : t.assignedToRole,
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

      toggleTaskCompleted: (id, userId = null, photoOrEvidence = null, note = null) => {
        const today = new Date().toISOString();
        let photoUrl = null;
        let finalNote = note;
        let bpmData = {};

        if (typeof photoOrEvidence === 'string') {
          photoUrl = photoOrEvidence;
        } else if (photoOrEvidence && typeof photoOrEvidence === 'object') {
          photoUrl = photoOrEvidence.photoUrl || null;
          finalNote = photoOrEvidence.note || note;
          bpmData = {
            fryerTemp: photoOrEvidence.fryerTemp || null,
            freezerTemp: photoOrEvidence.freezerTemp || null,
            oilCondition: photoOrEvidence.oilCondition || null,
          };
        }

        set(state => {
          const updatedTasks = state.tasks.map(task => {
            if (task.id !== id) return task;
            const willBeCompleted = !task.completed;

            // Verificar si todas las subtareas deben marcarse
            const updatedSubtasks = (task.subtasks || []).map(st => ({
              ...st,
              completed: willBeCompleted
            }));

            return {
              ...task,
              completed: willBeCompleted,
              completedAt: willBeCompleted ? today : null,
              completedByUserId: willBeCompleted ? userId : null,
              photoUrl: willBeCompleted ? (photoUrl || task.photoUrl) : task.photoUrl,
              note: willBeCompleted ? (finalNote || task.note) : task.note,
              evidence: willBeCompleted ? { ...(task.evidence || {}), ...bpmData } : task.evidence,
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
          } else if (rec.type === 'WEEKLY' || rec.type === 'WEEKLY_CUSTOM') {
            const days = rec.daysOfWeek && rec.daysOfWeek.length > 0 ? rec.daysOfWeek : [1, 2, 3, 4, 5, 6, 0];
            if (days.includes(dayOfWeek)) shouldGenerate = true;
          } else if (rec.type === 'MONTHLY' || rec.type === 'MONTHLY_DAY') {
            if (rec.isLastDay) {
              const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              if (dayOfMonth === lastDayOfMonth) shouldGenerate = true;
            } else {
              const targetDay = parseInt(rec.dayOfMonth, 10) || 1;
              if (dayOfMonth === targetDay) shouldGenerate = true;
            }
          } else if (rec.type === 'INTERVAL' || rec.type === 'INTERVAL_DAYS') {
            const interval = Math.max(1, parseInt(rec.intervalDays, 10) || 1);
            const startEpoch = rec.startDate ? new Date(rec.startDate + 'T00:00:00').getTime() : now.getTime();
            const todayEpoch = new Date(todayStr + 'T00:00:00').getTime();
            const diffDays = Math.floor((todayEpoch - startEpoch) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays % interval === 0) shouldGenerate = true;
          }

          if (shouldGenerate) {
            addTask({
              title: tpl.title,
              description: tpl.description,
              projectId: tpl.projectId,
              priority: tpl.priority,
              assignedToUserId: tpl.assignedToUserId,
              assignedToUserName: tpl.assignedToUserName || null,
              assignedToRole: tpl.assignedToRole,
              branchId: tpl.branchId,
              dueDate: todayStr,
              dueTime: tpl.dueTime,
              targetModule: tpl.targetModule || 'none',
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

      getPendingObligatoryTasks: (user = null) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const userId = user?.id || null;
        const userRole = (user?.role || '').toLowerCase();
        const userBranchId = user?.branchId || null;

        return (get().tasks || []).filter(t => {
          if (t.completed) return false;
          if (t.enforcementLevel !== 'OBLIGATORIA') return false;
          if (t.dueDate > todayStr) return false; // Solo hoy o atrasadas

          // Coincidencia por sede
          const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
          if (!matchesBranch) return false;

          // Si no tiene asignación específica, es obligatoria para cualquier operario de la sede
          if (!t.assignedToUserId && !t.assignedToRole) return true;
          if (userId && t.assignedToUserId === userId) return true;
          if (user?.name && t.assignedToUserName && t.assignedToUserName.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
          if (userRole && t.assignedToRole) {
            const r = String(t.assignedToRole).toLowerCase();
            if (r === userRole || (r === 'pos' && userRole === 'cajero') || (r === 'cajero' && userRole === 'pos')) return true;
          }
          return false;
        });
      },
    }),
    {
      name: 'frita-mejor-tasks-storage',
    }
  )
);
