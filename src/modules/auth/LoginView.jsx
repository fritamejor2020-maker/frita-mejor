import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

const ROLE_ROUTES = {
  ADMIN:     '/admin',
  BODEGUERO: '/bodega',
  OPERARIO:  '/produccion',
  FRITADOR:  '/fritado',
  CAJERO:    '/pos',
  DEJADOR:   '/dejador',
  FINANZAS:  '/finanzas'
};

// Para vendedores: si ya tienen un turno activo en localStorage, van directo al dashboard
const getVendedorRoute = () => {
  try {
    const raw = localStorage.getItem('frita-seller-session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.isSetupComplete) return '/vendedor';
    }
  } catch (_) {}
  return '/vendedor-setup';
};

// Para dejadores: ídem
const getDejadorRoute = () => {
  try {
    const raw = localStorage.getItem('frita-dejador-session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.isSetupComplete) return '/dejador';
    }
  } catch (_) {}
  return '/dejador-setup';
};

export function LoginView() {
  const { signIn, error, clearError } = useAuthStore();
  const navigate                       = useNavigate();

  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { clearError?.(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    clearError?.();
    setLoading(true);
    const result = signIn(password);
    setLoading(false);

    if (result.ok) {
      const user   = result.user;
      const access = user.access || [];

      // Más de un módulo → mostrar selector para que el usuario elija
      if (access.length > 1) {
        navigate('/selector', { replace: true });
        return;
      }

      // Un solo módulo → ir directo a él
      if (access.length === 1) {
        const key = access[0];
        if (key === 'vendedor-setup' || key === 'vendedor') {
          navigate(getVendedorRoute(), { replace: true });
        } else if (key === 'dejador') {
          navigate(getDejadorRoute(), { replace: true });
        } else {
          const MODULE_ROUTES = {
            produccion:          '/produccion',
            bodega:              '/bodega',
            fritado:             '/fritado',
            pos:                 '/pos',
            'finanzas-ingresos': '/finanzas',
            'finanzas-gastos':   '/finanzas',
            finanzas:            '/finanzas',
            admin:               '/admin',
            tracking:            '/tracking',
          };
          navigate(MODULE_ROUTES[key] ?? '/selector', { replace: true });
        }
        return;
      }

      // Sin módulos asignados → selector (mostrará mensaje de sin acceso)
      navigate('/selector', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFD56B] font-sans w-full page-enter">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="Frita Mejor"
            className="w-56 mx-auto object-contain drop-shadow-md"
          />
          <p className="text-amber-900/60 font-black mt-4 text-sm tracking-widest uppercase">Sistema de Gestión</p>
        </div>

        {/* Tarjeta de login */}
        <div className="bg-white rounded-[40px] p-8 sm:p-10 shadow-sm border border-white relative">
          <h2 className="text-3xl font-black text-gray-900 mb-8 tracking-tight text-center">Ingreso</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contraseña */}
            <div className="relative pt-6">
              <div className="absolute top-0 left-6 z-10 bg-[#FFB700] text-white font-black text-[10px] sm:text-xs px-4 py-1.5 rounded-t-lg tracking-widest">
                 CONTRASEÑA
              </div>
              <div className="relative">
                <input
                  type="password"
                  placeholder=""
                  className="w-full bg-white border-2 border-gray-100 rounded-[28px] py-5 px-6 font-black text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors text-center"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border-2 border-red-100 rounded-2xl px-4 py-4 text-red-500 font-bold text-center">
                ⚠️ {error}
              </div>
            )}

            {/* Botón de Ingresar */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#FF4040] text-white font-black text-xl py-6 rounded-[32px] mt-4 shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
            >
              {loading ? 'INGRESANDO...' : 'ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
