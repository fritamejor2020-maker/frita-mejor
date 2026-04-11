import React, { useState } from 'react';

// Claves de localStorage que usa la app (una por cada store persistido)
const STORAGE_KEYS = [
  'frita-mejor-inventory',     // posShifts, posProducts, posSales, posExpenses, users, etc.
  'frita-mejor-logistics',     // loadHistory, completedRequests, pendingRequests
  'frita-mejor-auth-v2',       // usuarios autenticados
  'frita-mejor-income-config', // fuentes de ingreso
  'frita-mejor-suppliers',     // proveedores
  'frita-mejor-vehicles',      // vehículos / triciclos
  'frita-seller-session',      // sesión activa del vendedor
  'frita-dejador-session',     // sesión activa del dejador
];

// También limpiar la clave de sincronización de Supabase si existe
const EXTRA_KEYS = ['frita-sync-queue', 'frita-pos-store'];

const MASTER_PASSWORD = 'Anamonica99';

const RESET_SECTIONS = [
  { icon: '🛒', label: 'Productos POS y Precios', keys: ['Productos del catálogo de venta'] },
  { icon: '💰', label: 'Cierres de Finanzas', keys: ['Cierres de vendedores, efectivo, transferencias'] },
  { icon: '📦', label: 'Logística y Cargas', keys: ['Historial de cargas, surtidos, sobrantes'] },
  { icon: '📋', label: 'Pedidos Pendientes', keys: ['Solicitudes de surtido en cola'] },
  { icon: '🛵', label: 'Vehículos y Triciclos', keys: ['Registro de vehículos operativos'] },
  { icon: '👥', label: 'Sesiones Activas', keys: ['Sesión de vendedor y dejador activos'] },
  { icon: '📊', label: 'Historial de Ingresos y Egresos', keys: ['Registros financieros históricos'] },
  { icon: '🔐', label: 'Configuración de Sistema', keys: ['Usuarios, permisos y configuración'] },
];

export const ResetGeneralPanel = () => {
  const [step, setStep]           = useState('warning');  // 'warning' | 'confirm' | 'password' | 'done'
  const [password, setPassword]   = useState('');
  const [passError, setPassError]  = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const CONFIRM_WORD = 'RESETEAR';

  const handleGoToConfirm = () => {
    setStep('confirm');
    setConfirmText('');
  };

  const handleGoToPassword = () => {
    if (confirmText !== CONFIRM_WORD) return;
    setStep('password');
    setPassword('');
    setPassError('');
  };

  const handleReset = () => {
    if (password !== MASTER_PASSWORD) {
      setPassError('Contraseña incorrecta. Intenta de nuevo.');
      setPassword('');
      return;
    }
    // Borrar todas las claves de localStorage
    [...STORAGE_KEYS, ...EXTRA_KEYS].forEach(key => {
      localStorage.removeItem(key);
    });
    setStep('done');
    // Recargar después de 2.5 segundos para que los stores se reinicialicen
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  };

  // ── Screen: Done ──────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-5xl">✅</div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800">¡Reset Completado!</h2>
          <p className="text-gray-500 font-bold mt-2">Todos los datos han sido eliminados.</p>
          <p className="text-gray-400 text-sm mt-1">La aplicación se recargará en un momento...</p>
        </div>
        <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full animate-[progress_2.5s_linear_forwards]"
               style={{ animation: 'progress 2.5s linear forwards' }} />
        </div>
        <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  // ── Screen: Password ─────────────────────────────────────
  if (step === 'password') {
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-red-100 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl mx-auto mb-4">🔐</div>
            <h2 className="text-xl font-black text-gray-800">Contraseña Maestra</h2>
            <p className="text-sm text-gray-500 font-bold mt-1">Ingresa la contraseña para autorizar el reset</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Contraseña Maestra</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPassError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="••••••••••••"
                autoFocus
                className={`w-full border-2 ${passError ? 'border-red-400 bg-red-50' : 'border-gray-100 bg-gray-50'} focus:border-red-400 rounded-2xl py-4 px-5 text-lg font-bold text-gray-800 outline-none transition-colors pr-12`}
              />
              <button
                onClick={() => setShowPass(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            {passError && (
              <p className="text-red-500 text-xs font-bold mt-2 flex items-center gap-1">
                ⚠️ {passError}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('confirm')}
              className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleReset}
              disabled={!password}
              className="flex-[2] py-3.5 rounded-2xl bg-red-500 text-white font-black hover:bg-red-600 transition-colors shadow-lg shadow-red-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Ejecutar Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Screen: Confirm typing RESETEAR ──────────────────────
  if (step === 'confirm') {
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-orange-100 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
            <h2 className="text-xl font-black text-gray-800">Confirmar Reset</h2>
            <p className="text-sm text-gray-500 font-bold mt-1">
              Escribe <span className="text-red-500 font-black">{CONFIRM_WORD}</span> para continuar
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Escribe "{CONFIRM_WORD}"</label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && confirmText === CONFIRM_WORD && handleGoToPassword()}
              placeholder={CONFIRM_WORD}
              autoFocus
              className={`w-full border-2 ${confirmText === CONFIRM_WORD ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50'} focus:border-orange-400 rounded-2xl py-4 px-5 text-lg font-black text-gray-800 outline-none transition-colors tracking-widest text-center`}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('warning')}
              className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGoToPassword}
              disabled={confirmText !== CONFIRM_WORD}
              className="flex-[2] py-3.5 rounded-2xl bg-orange-500 text-white font-black hover:bg-orange-600 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Screen: Warning (default) ─────────────────────────────
  return (
    <div className="max-w-xl mx-auto py-6 flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">

      {/* Header de advertencia */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-[2rem] p-8 text-white shadow-xl shadow-red-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl flex-shrink-0">🗑️</div>
          <div>
            <h2 className="text-2xl font-black">Reset General</h2>
            <p className="text-red-100 font-bold text-sm">Acción irreversible — Lee con atención</p>
          </div>
        </div>
        <p className="text-red-100 text-sm font-bold leading-relaxed">
          Esta acción <span className="text-white font-black underline">borrará permanentemente</span> toda la información
          almacenada en la aplicación. No se puede deshacer.
        </p>
      </div>

      {/* Qué se borrará */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Datos que serán eliminados</p>
        <div className="grid grid-cols-1 gap-2">
          {RESET_SECTIONS.map((section, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-xl flex-shrink-0">{section.icon}</span>
              <div>
                <p className="font-black text-gray-800 text-sm">{section.label}</p>
                <p className="text-gray-400 text-xs font-bold">{section.keys[0]}</p>
              </div>
              <svg className="ml-auto flex-shrink-0 text-red-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          ))}
        </div>
      </div>

      {/* Lo que NO se borra */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">✓ Qué NO se pierde</p>
        <ul className="space-y-1">
          <li className="text-blue-700 text-sm font-bold">• El código de la aplicación (siempre disponible)</li>
          <li className="text-blue-700 text-sm font-bold">• Las plantillas y configuración de producción</li>
        </ul>
      </div>

      {/* Botón de inicio */}
      <button
        onClick={handleGoToConfirm}
        className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-base hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-95 flex items-center justify-center gap-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Iniciar Reset General
      </button>
    </div>
  );
};
