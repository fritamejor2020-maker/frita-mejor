import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useBranchStore } from '../../store/useBranchStore';

// ─── Rutas por módulo ─────────────────────────────────────────────────────────
const MODULE_ROUTES = {
  produccion:          '/produccion',
  bodega:              '/bodega',
  fritado:             '/fritado',
  pos:                 '/pos',
  'finanzas-ingresos': '/finanzas',
  'finanzas-gastos':   '/finanzas',
  'finanzas-nomina':   '/finanzas',
  finanzas:            '/finanzas',
  admin:               '/admin',
  tracking:            '/tracking',
  cierres:             '/cierres',
};

const getVendedorRoute = () => {
  try {
    const raw = localStorage.getItem('frita-seller-session');
    if (raw && JSON.parse(raw)?.state?.isSetupComplete) return '/vendedor';
  } catch (_) {}
  return '/vendedor-setup';
};

const getDejadorRoute = () => {
  try {
    const raw = localStorage.getItem('frita-dejador-session');
    if (raw && JSON.parse(raw)?.state?.isSetupComplete) return '/dejador';
  } catch (_) {}
  return '/dejador-setup';
};

// Estilos por tipo de sede
const BRANCH_STYLE = {
  pos:         { gradient: 'from-amber-400 to-orange-500',  icon: '🏪' },
  fabricacion: { gradient: 'from-blue-500  to-indigo-600',  icon: '🏭' },
  bodega:      { gradient: 'from-emerald-500 to-teal-600',  icon: '📦' },
  __global__:  { gradient: 'from-purple-500 to-violet-700', icon: '🌐' },
};

const GLOBAL_OPTION = { id: '__global__', name: 'Acceso Global', type: '__global__' };

// ─── Componente principal ─────────────────────────────────────────────────────
export function LoginView() {
  const { signIn, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const allBranches = useBranchStore(s => s.branches);
  const activeBranches = allBranches.filter(b => b.active !== false);
  const options = [...activeBranches, GLOBAL_OPTION];

  // Sede seleccionada por defecto: la primera activa
  const [selectedBranch, setSelectedBranch] = useState(options[0] || GLOBAL_OPTION);
  const [password, setPassword]             = useState('');
  const [loading,  setLoading]              = useState(false);
  const [open,     setOpen]                 = useState(false);   // dropdown abierto

  // Si las sedes cargan después, actualizar selección
  useEffect(() => {
    if (activeBranches.length > 0 && selectedBranch?.id === '__global__') {
      setSelectedBranch(activeBranches[0]);
    }
  }, [activeBranches.length]);

  useEffect(() => { clearError?.(); }, []);

  const handleSelectOption = (branch) => {
    setSelectedBranch(branch);
    setOpen(false);
    clearError?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    clearError?.();
    setLoading(true);
    const result = signIn(password);
    setLoading(false);

    if (!result.ok) return;

    const user = result.user;

    // Validar sede
    const isGlobalBranch = selectedBranch?.id === '__global__';
    const isGlobalUser   = !user.branchId;

    if (!isGlobalBranch && !isGlobalUser && user.branchId !== selectedBranch?.id) {
      useAuthStore.getState().signOut?.();
      useAuthStore.setState({
        error: `Este PIN no pertenece a "${selectedBranch?.name}". Verifica tu sede.`,
      });
      setPassword('');
      return;
    }

    // Redirigir
    const access = user.access || [];
    if (access.length > 1) { navigate('/selector', { replace: true }); return; }
    if (access.length === 1) {
      const key = access[0];
      if (key === 'vendedor-setup' || key === 'vendedor') navigate(getVendedorRoute(), { replace: true });
      else if (key === 'dejador') navigate(getDejadorRoute(), { replace: true });
      else navigate(MODULE_ROUTES[key] ?? '/selector', { replace: true });
      return;
    }
    navigate('/selector', { replace: true });
  };

  const style = BRANCH_STYLE[selectedBranch?.type] || BRANCH_STYLE.pos;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 font-sans w-full page-enter"
      style={{ background: '#FFD56B' }}
      onClick={() => setOpen(false)}
    >
      <div className="w-full max-w-sm">

        {/* ── Logo ──────────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Frita Mejor"
            className="w-44 mx-auto object-contain drop-shadow-lg"
          />
          <p className="text-amber-900/60 font-black mt-3 text-xs tracking-widest uppercase">
            Sistema de Gestión
          </p>
        </div>

        {/* ── Tarjeta ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-[40px] p-8 shadow-sm">

          {/* Dropdown de sede */}
          <div className="relative mb-7" onClick={e => e.stopPropagation()}>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
              Sede
            </label>

            {/* Trigger */}
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-gray-100 hover:border-gray-200 transition-all text-left focus:outline-none focus:border-amber-400"
            >
              {/* Badge con gradiente */}
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                {style.icon}
              </div>
              <span className="flex-1 font-black text-gray-900 text-sm truncate">
                {selectedBranch?.name}
              </span>
              {/* Chevron */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16" height="16"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                {options.map((branch) => {
                  const s = BRANCH_STYLE[branch.type] || BRANCH_STYLE.pos;
                  const isActive = branch.id === selectedBranch?.id;
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => handleSelectOption(branch)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${isActive ? 'bg-amber-50' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-base flex-shrink-0 shadow-sm`}>
                        {s.icon}
                      </div>
                      <span className={`font-black text-sm truncate ${isActive ? 'text-amber-700' : 'text-gray-800'}`}>
                        {branch.name}
                      </span>
                      {isActive && (
                        <svg className="ml-auto text-amber-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input contraseña */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative pt-5">
              <div className="absolute top-0 left-5 z-10 bg-[#FFB700] text-white font-black text-[10px] px-4 py-1.5 rounded-t-lg tracking-widest">
                CONTRASEÑA
              </div>
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                className="w-full bg-white border-2 border-gray-100 rounded-[24px] py-5 px-5 font-black text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors text-center"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-100 rounded-2xl px-4 py-3 text-red-500 font-bold text-center text-sm">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#FF4040] text-white font-black text-xl py-5 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? 'INGRESANDO...' : 'ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
