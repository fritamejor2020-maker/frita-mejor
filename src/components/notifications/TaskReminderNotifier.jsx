import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, Clock, ArrowRight, ShieldAlert, Check } from 'lucide-react';

const MODULE_ROUTES = {
  pos: '/pos',
  bodega: '/bodega',
  produccion: '/produccion',
  fritado: '/fritado',
  tareas: '/tareas',
  asistencia: '/asistencia',
  cierres: '/cierres',
};

export function TaskReminderNotifier() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tasks, toggleTaskCompleted, setDrawerOpen } = useTaskStore();

  // Registro de notificaciones emitidas hoy para evitar spam repetitivo
  const notifiedEventsRef = useRef(new Set());

  // Sonidos de notificación
  const playSound = (soundType = 'notify') => {
    try {
      const src = soundType === 'bell' ? '/sounds/mixkit_bell.wav' : '/sounds/mixkit_notify.wav';
      const audio = new Audio(src);
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch (_) {}
  };

  // Enviar notificación del sistema operativo / PWA
  const sendSystemNotification = (title, body, taskId) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            tag: `task-${taskId}`,
            badge: '/pwa-192x192.png',
          });
        } catch (_) {}
      }
    }
  };

  // Mostrar Toast Interactivo en Pantalla
  const showReminderToast = (task, alertType) => {
    const isExact = alertType === 'exact';
    const isOverdue = alertType === 'overdue';

    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-fadeIn' : 'animate-fadeOut'
        } max-w-md w-full bg-[#1b1c24] border-2 ${
          task.enforcementLevel === 'OBLIGATORIA' ? 'border-red-500 shadow-red-950/60' : 'border-amber-500 shadow-amber-950/50'
        } rounded-3xl p-4 shadow-2xl text-gray-200 pointer-events-auto flex items-start gap-3`}
      >
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white ${
          isOverdue ? 'bg-red-600' : isExact ? 'bg-amber-500 text-gray-950' : 'bg-blue-600'
        }`}>
          {task.enforcementLevel === 'OBLIGATORIA' ? <ShieldAlert size={22} /> : <Bell size={22} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
              isOverdue ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'
            }`}>
              {isOverdue ? '⚠️ Tarea Atrasada' : isExact ? '🔔 ¡Es hora de la tarea!' : '⏰ Próxima en 15m'}
            </span>
            {task.dueTime && (
              <span className="text-[11px] font-mono font-bold text-gray-400 flex items-center gap-1">
                <Clock size={11} /> {task.dueTime}
              </span>
            )}
          </div>

          <p className="text-sm font-black text-white truncate leading-tight">
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {task.description}
            </p>
          )}

          {/* Botones de acción rápida */}
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                if (task.targetModule && MODULE_ROUTES[task.targetModule]) {
                  navigate(MODULE_ROUTES[task.targetModule]);
                } else {
                  navigate('/tareas');
                }
              }}
              className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-950 font-black text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Ir a Resolver</span>
              <ArrowRight size={13} />
            </button>

            {!task.requirePhoto && (
              <button
                onClick={() => {
                  toggleTaskCompleted(task.id, user?.id);
                  toast.dismiss(t.id);
                  toast.success('✓ Tarea completada');
                }}
                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <Check size={13} />
                <span>Marcar Lista</span>
              </button>
            )}

            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-gray-500 hover:text-gray-300 text-xs font-bold px-2 py-1.5 transition-colors cursor-pointer ml-auto"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    ), { duration: 8000 });
  };

  // Motor de verificación periódica
  useEffect(() => {
    if (!user) return;

    const checkReminders = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      const userId = user.id;
      const userName = (user.name || '').trim().toLowerCase();
      const userRole = (user.role || '').trim().toLowerCase();
      const userBranchId = user.branchId;

      const roleMatches = (tRole) => {
        if (!tRole || tRole === 'all') return true;
        if (tRole === userRole) return true;
        if ((tRole === 'pos' || tRole === 'cajero') && (userRole === 'cajero' || userRole === 'pos')) return true;
        if ((tRole === 'fritado' || tRole === 'cocina' || tRole === 'fritador') && (userRole === 'fritado' || userRole === 'cocina' || userRole === 'fritador')) return true;
        if ((tRole === 'bodeguero' || tRole === 'bodega' || tRole === 'inventario') && (userRole === 'bodeguero' || userRole === 'bodega' || userRole === 'inventario')) return true;
        if ((tRole === 'dejador' || tRole === 'vendedor' || tRole === 'repartidor' || tRole === 'domicilio') && (userRole === 'dejador' || userRole === 'vendedor' || userRole === 'repartidor' || userRole === 'domicilio')) return true;
        if ((tRole === 'admin' || tRole === 'gerente') && (userRole === 'admin' || userRole === 'gerente')) return true;
        return false;
      };

      const isUserTaskMatch = (t) => {
        const matchesBranch = !t.branchId || t.branchId === 'GLOBAL' || t.branchId === userBranchId;
        if (!matchesBranch) return false;

        const tRole = (t.assignedToRole || '').toLowerCase();
        const tUserName = (t.assignedToUserName || '').toLowerCase();

        return (!t.assignedToUserId && !t.assignedToRole) ||
               t.assignedToUserId === userId ||
               (userName && tUserName && (tUserName === userName || userName.includes(tUserName) || tUserName.includes(userName))) ||
               roleMatches(tRole);
      };

      // 0. Alerta de tareas atrasadas de días anteriores (solo una vez por sesión/día)
      const pastOverdueTasks = (tasks || []).filter(t => !t.completed && t.dueDate < todayStr && isUserTaskMatch(t));
      if (pastOverdueTasks.length > 0) {
        const pastKey = `${todayStr}-past-overdue-summary`;
        if (!notifiedEventsRef.current.has(pastKey)) {
          notifiedEventsRef.current.add(pastKey);
          playSound('bell');
          const topTask = pastOverdueTasks[0];
          showReminderToast({
            ...topTask,
            title: pastOverdueTasks.length === 1 ? `Atrasada: ${topTask.title}` : `Tienes ${pastOverdueTasks.length} tareas atrasadas pendientes`,
            description: pastOverdueTasks.length === 1 ? (topTask.description || `Venció el ${topTask.dueDate}`) : 'Revisa tus tareas pendientes de días anteriores para poder cerrar turno sin bloqueos',
            enforcementLevel: pastOverdueTasks.some(x => x.enforcementLevel === 'OBLIGATORIA') ? 'OBLIGATORIA' : 'IMPORTANTE'
          }, 'overdue');
          sendSystemNotification(
            `Frita Mejor • ⚠️ ${pastOverdueTasks.length} Tarea(s) Atrasada(s)`,
            `Tienes tareas sin completar asignadas a tu cargo. Resuélvelas hoy.`,
            'past-overdue'
          );
        }
      }

      // Filtrar tareas que corresponden al usuario conectado para hoy con hora
      const userTodayTasks = (tasks || []).filter(t => {
        if (t.completed) return false;
        if (t.dueDate !== todayStr) return false;
        if (!t.dueTime) return false;
        return isUserTaskMatch(t);
      });

      userTodayTasks.forEach(task => {
        const [taskH, taskM] = task.dueTime.split(':').map(Number);
        if (isNaN(taskH) || isNaN(taskM)) return;
        const taskTotalMinutes = taskH * 60 + taskM;
        const diffMinutes = taskTotalMinutes - currentTotalMinutes;

        // 1. Hito de 15 minutos antes: [10 a 16 minutos restantes]
        const upcomingKey = `${todayStr}-${task.id}-upcoming`;
        if (diffMinutes >= 10 && diffMinutes <= 16 && !notifiedEventsRef.current.has(upcomingKey)) {
          notifiedEventsRef.current.add(upcomingKey);
          playSound('notify');
          showReminderToast(task, 'upcoming');
          sendSystemNotification(
            `Frita Mejor • Tarea próxima (${task.dueTime})`,
            `En 15 minutos: ${task.title}`,
            task.id
          );
        }

        // 2. Hito exacto de la hora: [0 a 2 minutos]
        const exactKey = `${todayStr}-${task.id}-exact`;
        if (diffMinutes >= 0 && diffMinutes <= 2 && !notifiedEventsRef.current.has(exactKey)) {
          notifiedEventsRef.current.add(exactKey);
          playSound('bell');
          showReminderToast(task, 'exact');
          sendSystemNotification(
            `Frita Mejor • ¡Es hora de realizar la tarea!`,
            `${task.title} (Hora: ${task.dueTime})`,
            task.id
          );
        }

        // 3. Hito de atrasada: [pasados 10 a 20 minutos de la hora]
        const overdueKey = `${todayStr}-${task.id}-overdue`;
        if (diffMinutes <= -10 && diffMinutes >= -25 && !notifiedEventsRef.current.has(overdueKey)) {
          notifiedEventsRef.current.add(overdueKey);
          if (task.enforcementLevel === 'OBLIGATORIA') {
            playSound('bell');
            showReminderToast(task, 'overdue');
            sendSystemNotification(
              `Frita Mejor • ⚠️ Tarea OBLIGATORIA pendiente`,
              `Atrasada: ${task.title}. Debes resolverla en tu turno.`,
              task.id
            );
          }
        }
      });
    };

    // Correr de inmediato y cada 25 segundos
    checkReminders();
    const interval = setInterval(checkReminders, 25000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkReminders();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, tasks]);

  return null; // Componente de efecto global silencioso
}
