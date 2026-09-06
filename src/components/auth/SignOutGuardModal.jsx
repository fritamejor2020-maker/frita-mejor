import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, CheckCircle2, ArrowRight, Lock, KeyRound, 
  X, Clock, Camera, AlertTriangle, ExternalLink 
} from 'lucide-react';
import toast from 'react-hot-toast';

const MODULE_ROUTES = {
  pos: { route: '/pos', name: 'Punto de Venta (POS)', icon: '💻' },
  bodega: { route: '/bodega', name: 'Bodega / Inventario', icon: '📦' },
  produccion: { route: '/produccion', name: 'Producción', icon: '🏭' },
  fritado: { route: '/fritado', name: 'Fritado / Cocina', icon: '🍳' },
  tareas: { route: '/tareas', name: 'Gestión de Tareas', icon: '📋' },
  asistencia: { route: '/asistencia', name: 'Asistencia y Turnos', icon: '⏱️' },
  cierres: { route: '/cierres', name: 'Auditor de Cierres', icon: '🧾' },
};

export function SignOutGuardModal() {
  const navigate = useNavigate();
  const { isSignOutBlocked, pendingBlockingTasks, closeSignOutGuard } = useTaskStore();
  const { user, signOut, users } = useAuthStore();

  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  if (!isSignOutBlocked) return null;

  const handleGoToTask = (task) => {
    closeSignOutGuard();
    const target = task.targetModule || 'tareas';
    const modConfig = MODULE_ROUTES[target] || MODULE_ROUTES.tareas;

    // Si el usuario no tiene acceso formal al módulo pero la tarea lo requiere, otorgar acceso temporal
    if (modConfig.route !== '/tareas' && user && !user.access?.includes(target)) {
      useAuthStore.setState((s) => ({
        user: s.user ? { ...s.user, access: [...(s.user.access || []), target] } : s.user
      }));
      toast(`🔓 Acceso temporal concedido a ${modConfig.name} para resolver tu tarea obligatoria.`, {
        icon: '🔑',
        duration: 4500
      });
    }

    navigate(modConfig.route);
  };

  const handleEmergencyExit = (e) => {
    e.preventDefault();
    setPinError('');

    // Validar PIN contra admin users o PIN maestro de emergencia ('1', '7')
    const cleanPin = pinInput.trim();
    const adminUsers = (users || []).filter(u => u.role === 'ADMIN');
    const isValidAdminPin = cleanPin === '1' || cleanPin === '7' || adminUsers.some(u => String(u.password).trim() === cleanPin);

    if (isValidAdminPin) {
      toast.success('⚠️ Salida de emergencia autorizada por Administrador');
      closeSignOutGuard();
      signOut(true);
      navigate('/login', { replace: true });
    } else {
      setPinError('PIN de Administrador incorrecto');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-[#16171e] border-2 border-red-500/80 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl shadow-red-950/60 text-gray-200 relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Glow decorativo superior */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>

        {/* Encabezado */}
        <div className="flex items-start gap-4 mb-5 shrink-0">
          <div className="w-13 h-13 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-950/50">
            <ShieldAlert size={30} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-red-400 bg-red-950/60 border border-red-500/30 px-2.5 py-0.5 rounded-full">
                Bloqueo de Cierre de Sesión
              </span>
              <button 
                onClick={closeSignOutGuard} 
                className="text-gray-500 hover:text-gray-300 p-1 rounded-lg transition-colors"
                title="Volver"
              >
                <X size={18} />
              </button>
            </div>
            <h2 className="text-xl font-black text-white mt-1.5 leading-tight">
              ¡Tienes tareas indispensables pendientes!
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              No puedes salir del turno hasta completar tus tareas obligatorias del día.
            </p>
          </div>
        </div>

        {/* Lista de Tareas Bloqueantes (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-5">
          {pendingBlockingTasks.map((t) => {
            const mod = MODULE_ROUTES[t.targetModule] || null;
            return (
              <div 
                key={t.id}
                className="bg-[#1f202a] border border-red-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-red-500/60 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-sm truncate">
                      {t.title}
                    </span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/50">
                      🚫 Obligatoria
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                    {t.dueTime && (
                      <span className="flex items-center gap-1 bg-[#16171e] px-2 py-0.5 rounded text-amber-300 font-mono">
                        <Clock size={11} /> {t.dueTime}
                      </span>
                    )}
                    {t.requirePhoto && (
                      <span className="flex items-center gap-1 bg-purple-950/60 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                        <Camera size={11} /> Foto Req.
                      </span>
                    )}
                    {mod && (
                      <span className="flex items-center gap-1 bg-blue-950/60 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                        {mod.icon} {mod.name}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleGoToTask(t)}
                  className="shrink-0 bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-amber-950/40 cursor-pointer"
                >
                  <span>Completar</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sección de Bypass de Emergencia (PIN Admin) */}
        {showPinPrompt ? (
          <form onSubmit={handleEmergencyExit} className="bg-[#1b1c24] border border-amber-500/40 rounded-2xl p-4 mb-4 space-y-3 animate-fadeIn shrink-0">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <KeyRound size={16} />
              <span>Autorización de Emergencia por Supervisor</span>
            </div>
            <p className="text-[11px] text-gray-400">
              Ingresa el PIN de Administrador para forzar la salida sin completar las tareas:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="PIN o contraseña Admin"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                className="flex-1 bg-[#121318] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Autorizar Salida
              </button>
            </div>
            {pinError && <p className="text-[11px] text-red-400 font-bold">{pinError}</p>}
          </form>
        ) : null}

        {/* Botones del Footer */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-800 shrink-0 flex-wrap">
          {!showPinPrompt ? (
            <button
              onClick={() => setShowPinPrompt(true)}
              className="text-xs text-gray-400 hover:text-amber-400 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <KeyRound size={13} />
              <span>Salida de Emergencia (PIN Admin)</span>
            </button>
          ) : (
            <button
              onClick={() => { setShowPinPrompt(false); setPinInput(''); setPinError(''); }}
              className="text-xs text-gray-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancelar PIN
            </button>
          )}

          <button
            onClick={closeSignOutGuard}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer ml-auto"
          >
            Volver a trabajar
          </button>
        </div>

      </div>
    </div>
  );
}
