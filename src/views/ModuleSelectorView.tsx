import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore, ROLE_ACCESS } from '../store/useAuthStore';

// ── Mapa de módulos: cómo se ve cada uno en la pantalla ───────────────────────
const MODULE_CARDS: Record<string, { label: string; icon: string; route: string; color: string; bg: string }> = {
  'produccion':       { label: 'Producción',      icon: '🏭', route: '/produccion',    color: 'from-blue-500 to-blue-600',    bg: 'bg-blue-50' },
  'bodega':           { label: 'Bodega',           icon: '📦', route: '/bodega',        color: 'from-amber-500 to-amber-600',  bg: 'bg-amber-50' },
  'fritado':          { label: 'Fritado',          icon: '🍳', route: '/fritado',       color: 'from-yellow-500 to-orange-500',bg: 'bg-yellow-50' },
  'pos':              { label: 'Caja POS',         icon: '🛒', route: '/pos',           color: 'from-green-500 to-green-600',  bg: 'bg-green-50' },
  'finanzas-ingresos':{ label: 'Ingresos',         icon: '💵', route: '/finanzas',      color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
  'finanzas-gastos':  { label: 'Gastos',           icon: '💸', route: '/finanzas',      color: 'from-red-500 to-rose-600',     bg: 'bg-red-50' },
  'vendedor-setup':   { label: 'Vendedor Móvil',  icon: '🛵', route: '/vendedor-setup',color: 'from-red-500 to-rose-600',    bg: 'bg-red-50' },
  'dejador':          { label: 'Dejador',          icon: '🚚', route: '/dejador-setup', color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50' },
  'admin':            { label: 'Administración',   icon: '🔧', route: '/admin',         color: 'from-purple-500 to-purple-700',bg: 'bg-purple-50' },
  'tracking':         { label: 'Rutas y Mapa',     icon: '🗺️', route: '/tracking',      color: 'from-cyan-500 to-sky-600',    bg: 'bg-cyan-50' },
  'cierres':          { label: 'Auditor Cierres',  icon: '🧐', route: '/cierres',       color: 'from-teal-500 to-teal-700',    bg: 'bg-teal-50' },
};

export const ModuleSelectorView = () => {
  const navigate  = useNavigate();
  const { user, signOut } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;

  // Es "solo Dejador" si tiene el módulo dejador pero NO tiene admin ni es rol ADMIN.
  const hasAdmin = (user.access || []).includes('admin') || user.role === 'ADMIN';
  const isDejadorOnly = (user.access || []).includes('dejador') && !hasAdmin;

  // Acceso efectivo: respetar el access[] del usuario (permisos granulares).
  // Solo excepción: si el rol es ADMIN, siempre incluir 'tracking' aunque el caché esté desactualizado.
  const storedAccess: string[] = user.access || [];
  const effectiveAccess = user.role === 'ADMIN' && !storedAccess.includes('tracking')
    ? [...storedAccess, 'tracking']
    : storedAccess;

  const userModules = effectiveAccess
    .filter((key: string) => !(isDejadorOnly && key === 'tracking')) // Dejadores puros no ven Rutas y Mapa
    .map((key: string) => ({ key, ...MODULE_CARDS[key] }))
    .filter((m: any) => m.label); // filtrar claves sin tarjeta definida

  // Si solo tiene un módulo, redirigir directo (no mostrar selector)
  if (userModules.length === 1) {
    return <Navigate to={userModules[0].route} replace />;
  }

  const handleSelect = (route: string, key: string) => {
    // Para vendedor-setup: revisar si ya hay sesión activa
    if (key === 'vendedor-setup' || key === 'vendedor') {
      try {
        const raw = localStorage.getItem('frita-seller-session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.isSetupComplete) {
            navigate('/vendedor', { replace: true });
            return;
          }
        }
      } catch (_) {}
      navigate('/vendedor-setup', { replace: true });
      return;
    }
    if (key === 'dejador') {
      try {
        const raw = localStorage.getItem('frita-dejador-session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.isSetupComplete) {
            navigate('/dejador', { replace: true });
            return;
          }
        }
      } catch (_) {}
      navigate('/dejador-setup', { replace: true });
      return;
    }
    navigate(route, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg, #FFF9F0)' }}>
      {/* Header — franja blanca con esquinas redondeadas */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8 pb-5 sm:pb-6 px-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Bienvenido</p>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-0.5 leading-tight">{user.name}</h1>
            </div>
            <button
              onClick={() => { signOut(); navigate('/login', { replace: true }); }}
              className="flex items-center gap-2 bg-red-50 text-red-500 font-black text-xs sm:text-sm px-4 py-2.5 rounded-full border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95 shrink-0"
            >
              Cerrar sesión
            </button>
          </div>
          <p className="text-sm font-bold text-gray-400 mt-3">Selecciona el módulo al que deseas acceder</p>
        </div>
      </div>

      {/* Grid de módulos */}
      <div className="flex-1 px-4 pb-8 mt-6 sm:mt-8">
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto sm:max-w-xl sm:grid-cols-3">
          {userModules.map((m: any) => (
            <button
              key={m.key}
              onClick={() => handleSelect(m.route, m.key)}
              className={`${m.bg} rounded-[1.5rem] p-5 flex flex-col items-center gap-3 
                border-2 border-transparent hover:border-opacity-30 
                transition-all duration-200 hover:scale-105 active:scale-95 
                shadow-sm hover:shadow-md group`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.color} 
                flex items-center justify-center text-3xl shadow-lg
                group-hover:shadow-xl transition-shadow`}>
                {m.icon}
              </div>
              <span className="font-black text-gray-800 text-sm text-center leading-tight">
                {m.label}
              </span>
            </button>
          ))}
        </div>

        {userModules.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <span className="text-5xl">🔒</span>
            <p className="font-black text-gray-600 text-lg">Sin módulos asignados</p>
            <p className="text-gray-400 font-bold text-sm max-w-xs">
              Contacta al administrador para que te asigne acceso a los módulos correspondientes.
            </p>
            <button
              onClick={() => { signOut(); navigate('/login', { replace: true }); }}
              className="mt-2 px-6 py-3 rounded-2xl bg-gray-800 text-white font-black hover:bg-gray-700 transition-colors"
            >
              Volver al login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
