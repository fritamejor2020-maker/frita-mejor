import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

const MASTER_PASSWORD = 'Anamonica99';

// ─────────────────────────────────────────────────────────────────────────────
// QUÉ SE BORRA vs QUÉ SE CONSERVA
// ─────────────────────────────────────────────────────────────────────────────
//
// BORRA (datos operativos del día a día):
//   • movements          — movimientos de inventario (producciones, mermas, etc.)
//   • posShifts          — cierres de vendedores
//   • posSales           — ventas POS
//   • posExpenses        — gastos registrados
//   • deletedShiftIds    — tombstones de cierres
//   • pendingRequests    — solicitudes de surtido pendientes
//   • completedRequests  — surtidos entregados
//   • rejectedRequests   — surtidos rechazados
//   • loadHistory        — historial de cargas del dejador
//   • frita-seller-session / frita-dejador-session — sesiones activas
//   • frita-sync-queue   — cola de sincronización offline
//
// CONSERVA (configuración del sistema):
//   • inventory (cantidades se resetean a 0, items se mantienen)
//   • warehouses, productionPoints, fryKitchens
//   • products, recipes, fritadoRecipes
//   • posCategories, posSettings, loadTemplates
//   • customers, customerTypes
//   • users (auth)
//   • vehicles / triciclos
//   • income config (fuentes de ingreso)
//   • suppliers
// ─────────────────────────────────────────────────────────────────────────────

// Claves de app_state en Supabase que se eliminan
const SUPABASE_OPERATIONAL_KEYS = [
  'movements',
  'posShifts',
  'posSales',
  'posExpenses',
  'deletedShiftIds',
  'pendingRequests',
  'completedRequests',
  'rejectedRequests',
  'loadHistory',
];

// Lo que se muestra en la UI como "qué se borrará"
const RESET_SECTIONS = [
  { icon: '📈', label: 'Movimientos de inventario',    desc: 'Producciones, mermas, recepciones, despachos' },
  { icon: '💰', label: 'Cierres y turnos de venta',    desc: 'Turnos AM/PM, ventas POS, gastos registrados' },
  { icon: '📦', label: 'Historial de cargas',          desc: 'Cargas del dejador, surtidos entregados' },
  { icon: '📋', label: 'Solicitudes pendientes',       desc: 'Pedidos de surtido en cola' },
  { icon: '👥', label: 'Sesiones activas',             desc: 'Sesión del vendedor y dejador' },
  { icon: '🔄', label: 'Cola de sincronización',       desc: 'Cambios offline pendientes de subir' },
];

const KEEP_SECTIONS = [
  { icon: '🛒', label: 'Catálogo de productos y precios' },
  { icon: '🏭', label: 'Bodegas y puntos de producción' },
  { icon: '🛵', label: 'Vehículos y triciclos configurados' },
  { icon: '👤', label: 'Usuarios y permisos' },
  { icon: '⚙️',  label: 'Configuración del sistema (POS, recetas, etc.)' },
];

// ─────────────────────────────────────────────────────────────────────────────

function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url.length > 0 && !url.includes('placeholder');
}

/** Borra solo las claves operativas de app_state en Supabase */
async function clearSupabaseOperationalKeys() {
  const errors = [];
  for (const key of SUPABASE_OPERATIONAL_KEYS) {
    const { error } = await supabase
      .from('app_state')
      .delete()
      .eq('key', key);
    if (error) {
      // Ignorar "not found" (la fila simplemente no existía)
      if (!error.message?.includes('schema cache') && !error.message?.includes('not found')) {
        errors.push(`${key}: ${error.message}`);
      }
    }
  }
  return errors; // vacío = éxito
}

/** Lee un store de localStorage, aplica la función de limpieza y lo guarda de vuelta */
function patchLocalStore(storeName, patchFn) {
  try {
    const raw = localStorage.getItem(storeName);
    if (!raw) return; // ya está vacío, no hay nada que limpiar
    const parsed = JSON.parse(raw);
    // Zustand persist almacena { state: {...}, version: N }
    if (parsed && parsed.state) {
      parsed.state = patchFn(parsed.state);
      localStorage.setItem(storeName, JSON.stringify(parsed));
    }
  } catch (e) {
    // Si el ítem está corrupto, simplemente lo eliminamos
    localStorage.removeItem(storeName);
  }
}

/** Ejecuta el borrado local de datos operativos */
function clearLocalOperationalData() {
  // ── useInventoryStore ('frita-mejor-inventory') ──────────────────────────
  // Borra: movements, posShifts, posSales, posExpenses, deletedShiftIds
  // Resetea: inventario qty a 0 (opcionales — dejamos cantidades en 0 para empezar limpio)
  patchLocalStore('frita-mejor-inventory', (state) => ({
    ...state,
    movements:       [],
    posShifts:       [],
    posSales:        [],
    posExpenses:     [],
    deletedShiftIds: [],
    // Resetear cantidades del inventario a 0 (los ítems se conservan)
    inventory: (state.inventory || []).map(item => ({ ...item, qty: 0 })),
  }));

  // ── useLogisticsStore ('frita-mejor-logistics') ──────────────────────────
  patchLocalStore('frita-mejor-logistics', (state) => ({
    ...state,
    pendingRequests:   [],
    completedRequests: [],
    rejectedRequests:  [],
    loadHistory:       [],
  }));

  // ── Sesiones activas (se eliminan completamente) ─────────────────────────
  localStorage.removeItem('frita-seller-session');
  localStorage.removeItem('frita-dejador-session');

  // ── Cola de sincronización offline ───────────────────────────────────────
  localStorage.removeItem('frita-sync-queue');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export const ResetGeneralPanel = () => {
  const [step, setStep]               = useState('warning');
  const [password, setPassword]       = useState('');
  const [passError, setPassError]     = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress]       = useState({ step: '', pct: 0 });
  const [supabaseErrors, setSupabaseErrors] = useState([]);

  const CONFIRM_WORD = 'RESETEAR';

  const handleGoToConfirm = () => { setStep('confirm'); setConfirmText(''); };
  const handleGoToPassword = () => {
    if (confirmText !== CONFIRM_WORD) return;
    setStep('password'); setPassword(''); setPassError('');
  };

  const handleReset = async () => {
    if (password !== MASTER_PASSWORD) {
      setPassError('Contraseña incorrecta. Intenta de nuevo.');
      setPassword('');
      return;
    }

    setStep('deleting');

    // ── Paso 1: Supabase (solo claves operativas de app_state) ───────────
    setProgress({ step: 'Borrando datos en Supabase (app_state)...', pct: 20 });
    if (isSupabaseConfigured()) {
      const errors = await clearSupabaseOperationalKeys();
      if (errors.length > 0) {
        setSupabaseErrors(errors);
        // No bloqueamos — continuamos con el local.
        // Los errores se avisarán en la pantalla de "done".
      }
    }

    // ── Paso 2: localStorage (quirúrgico) ────────────────────────────────
    setProgress({ step: 'Limpiando datos locales...', pct: 65 });
    await new Promise(r => setTimeout(r, 200));
    clearLocalOperationalData();

    // ── Paso 3: Marcar reset para que loadFromRemote no revierta nada ────
    sessionStorage.setItem('__reset_done__', '1');

    setProgress({ step: '¡Listo! Recargando...', pct: 100 });
    await new Promise(r => setTimeout(r, 400));
    setStep('done');

    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname;
    }, 3000);
  };

  // ── Screen: Deleting ────────────────────────────────────────────────────
  if (step === 'deleting') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center text-5xl animate-pulse">🗑️</div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800">Eliminando Datos...</h2>
          <p className="text-gray-500 font-bold mt-2 text-sm">{progress.step}</p>
        </div>
        <div className="w-72 flex flex-col gap-2">
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-700"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="text-xs font-bold text-gray-400 text-right">{progress.pct}%</p>
        </div>
      </div>
    );
  }

  // ── Screen: Done ────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-5 max-w-md mx-auto animate-[fadeIn_0.3s_ease-out]">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-5xl">✅</div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800">¡Reset Completado!</h2>
          <p className="text-gray-500 font-bold mt-1 text-sm">La configuración fue conservada. Solo se borraron los datos operativos.</p>
          <p className="text-gray-400 text-xs mt-1">Recargando en un momento...</p>
        </div>

        {supabaseErrors.length > 0 && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">⚠️ Advertencias (no críticas)</p>
            {supabaseErrors.map((e, i) => (
              <p key={i} className="text-amber-700 text-xs font-bold">{e}</p>
            ))}
          </div>
        )}

        <div className="w-56 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ animation: 'progress 3s linear forwards' }} />
        </div>
        <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  // ── Screen: Password ────────────────────────────────────────────────────
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
              <button onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            {passError && <p className="text-red-500 text-xs font-bold mt-2">⚠️ {passError}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('confirm')} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Volver</button>
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

  // ── Screen: Confirm ─────────────────────────────────────────────────────
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
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && confirmText === CONFIRM_WORD && handleGoToPassword()}
            placeholder={CONFIRM_WORD}
            autoFocus
            className={`w-full border-2 ${confirmText === CONFIRM_WORD ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50'} focus:border-orange-400 rounded-2xl py-4 px-5 text-lg font-black text-gray-800 outline-none transition-colors tracking-widest text-center`}
          />
          <div className="flex gap-3">
            <button onClick={() => setStep('warning')} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
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

  // ── Screen: Warning (default) ───────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto py-6 flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">

      {/* Header */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-[2rem] p-7 text-white shadow-xl shadow-red-200">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl flex-shrink-0">🗑️</div>
          <div>
            <h2 className="text-2xl font-black">Reset de Datos</h2>
            <p className="text-red-100 font-bold text-sm">Solo datos operativos — la configuración se conserva</p>
          </div>
        </div>
        <p className="text-red-100 text-sm font-bold leading-relaxed">
          Borra el historial de operaciones para empezar de cero, <span className="text-white font-black underline">sin perder</span> la configuración de productos, vehículos ni usuarios.
        </p>
      </div>

      {/* Qué se borra */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-red-50">
        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">🗑️ Se borrará</p>
        <div className="flex flex-col gap-2">
          {RESET_SECTIONS.map((s, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-lg flex-shrink-0">{s.icon}</span>
              <div>
                <p className="font-black text-gray-800 text-sm">{s.label}</p>
                <p className="text-gray-400 text-xs font-bold">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Qué se conserva */}
      <div className="bg-green-50 rounded-[2rem] p-6 border border-green-100">
        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3">✅ Se conservará</p>
        <div className="flex flex-col gap-2">
          {KEEP_SECTIONS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <span className="text-lg flex-shrink-0">{s.icon}</span>
              <p className="font-bold text-green-800 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Botón */}
      <button
        onClick={handleGoToConfirm}
        className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-base hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-95 flex items-center justify-center gap-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Iniciar Reset de Datos
      </button>
    </div>
  );
};
