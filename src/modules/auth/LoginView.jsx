import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

const ROLE_ROUTES = {
  ADMIN:     '/admin',
  BODEGUERO: '/bodega',
  OPERARIO:  '/produccion',
  FRITADOR:  '/fritado',
  CAJERO:    '/pos',
  VENDEDOR:  '/vendedor-setup',
  DEJADOR:   '/dejador',
  FINANZAS:  '/finanzas'
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
      const route = ROLE_ROUTES[result.user.role] ?? '/produccion';
      navigate(route, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#FFD56B] font-sans w-full">
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
