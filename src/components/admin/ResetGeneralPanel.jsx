import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

// ── Tablas de Supabase que se deben limpiar ────────────────────────────────────
const SUPABASE_TABLES = ['app_state', 'incomes', 'expenses'];

const MASTER_PASSWORD = 'Anamonica99';

const RESET_SECTIONS = [
  { icon: '🛒', label: 'Productos POS y Precios',         keys: ['Productos del catálogo de venta'] },
  { icon: '💰', label: 'Cierres de Finanzas',             keys: ['Cierres de vendedores, efectivo, transferencias'] },
  { icon: '📦', label: 'Logística y Cargas',              keys: ['Historial de cargas, surtidos, sobrantes'] },
  { icon: '📋', label: 'Pedidos Pendientes',              keys: ['Solicitudes de surtido en cola'] },
  { icon: '🛵', label: 'Vehículos y Triciclos',           keys: ['Registro de vehículos operativos'] },
  { icon: '👥', label: 'Sesiones Activas',                keys: ['Sesión de vendedor y dejador activos'] },
  { icon: '📊', label: 'Historial de Ingresos y Egresos', keys: ['Registros financieros históricos'] },
  { icon: '🔐', label: 'Configuración de Sistema',        keys: ['Usuarios, permisos y configuración'] },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url.length > 0 && !url.includes('placeholder');
}

/** Borra TODOS los registros de una tabla. Devuelve { ok, error } */
async function clearSupabaseTable(table) {
  try {
    if (table === 'app_state') {
      const { error } = await supabase
        .from('app_state')
        .delete()
        .neq('key', '__keep__');
      if (error) return { ok: false, error: error.message };
      // Verificar que quedó vacío
      const { data: remaining } = await supabase.from('app_state').select('key').limit(5);
      if (remaining && remaining.length > 0) {
        return { ok: false, error: `Quedan ${remaining.length} registro(s) en app_state tras el delete (posible restricción RLS)` };
      }
      return { ok: true, error: null };
    } else {
      const { error } = await supabase
        .from(table)
        .delete()
        .gte('created_at', '2000-01-01');
      if (error) return { ok: false, error: error.message };
      // Verificar que quedó vacío
      const { data: remaining } = await supabase.from(table).select('id').limit(5);
      if (remaining && remaining.length > 0) {
        return { ok: false, error: `Quedan ${remaining.length} registro(s) en ${table} tras el delete (posible restricción RLS)` };
      }
      return { ok: true, error: null };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const ResetGeneralPanel = () => {
  const [step, setStep]               = useState('warning'); // 'warning'|'confirm'|'password'|'deleting'|'done'|'error'
  const [password, setPassword]       = useState('');
  const [passError, setPassError]     = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress]       = useState({ step: '', total: 0, done: 0 });
  const [supabaseResults, setSupabaseResults] = useState([]); // [{ table, ok, error }]
  const [localDone, setLocalDone]     = useState(false);

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

  const handleReset = async () => {
    if (password !== MASTER_PASSWORD) {
      setPassError('Contraseña incorrecta. Intenta de nuevo.');
      setPassword('');
      return;
    }

    setStep('deleting');
    const supabaseOk = isSupabaseConfigured();
    const results = [];

    // ── 1. Limpiar Supabase PRIMERO (antes del localStorage) ─────────────────
    // Razón: si Supabase falla, el usuario puede ver exactamente qué falló.
    // Si primero limpiamos localStorage y Supabase falla, al recargar los datos
    // de Supabase vuelven a cargar en el store.
    if (supabaseOk) {
      const totalSupa = SUPABASE_TABLES.length;
      for (let i = 0; i < SUPABASE_TABLES.length; i++) {
        const table = SUPABASE_TABLES[i];
        setProgress({
          step: `Borrando tabla: ${table}...`,
          total: totalSupa + 2,
          done: i,
        });
        const result = await clearSupabaseTable(table);
        results.push({ table, ...result });
        await new Promise(r => setTimeout(r, 150));
      }
      setSupabaseResults(results);

      const failedTables = results.filter(r => !r.ok);
      if (failedTables.length > 0) {
        // Hay tablas que no se pudieron borrar → detener y mostrar error detallado
        setStep('error');
        return;
      }
    }

    // ── 2. Limpiar TODO el localStorage (no solo claves conocidas) ────────────
    setProgress({ step: 'Limpiando almacenamiento local...', total: supabaseOk ? SUPABASE_TABLES.length + 2 : 2, done: supabaseOk ? SUPABASE_TABLES.length : 0 });
    await new Promise(r => setTimeout(r, 200));

    // Marcar que el reset ya fue ejecutado para que al recargar
    // loadFromRemote no sobreescriba el estado vacío
    sessionStorage.setItem('__reset_done__', '1');

    // Borrar absolutamente todo el localStorage (más seguro que key por key)
    localStorage.clear();
    setLocalDone(true);

    setProgress({ step: '¡Listo! Recargando en 3 segundos...', total: supabaseOk ? SUPABASE_TABLES.length + 2 : 2, done: supabaseOk ? SUPABASE_TABLES.length + 2 : 2 });

    setStep('done');
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname;
    }, 3000);
  };

  // ── Screen: Error detallado ────────────────────────────────────────────────
  if (step === 'error') {
    const failed  = supabaseResults.filter(r => !r.ok);
    const success = supabaseResults.filter(r => r.ok);
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-6 max-w-lg mx-auto">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl">🚨</div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800">Error al Borrar Supabase</h2>
          <p className="text-gray-500 font-bold mt-2 text-sm leading-relaxed">
            El reset <span className="text-red-600 font-black">no se completó</span> porque Supabase rechazó el borrado.<br/>
            Los datos locales <span className="text-green-600 font-black">NO fueron eliminados</span> (seguro).
          </p>
        </div>

        {/* Detalle por tabla */}
        <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resultado por tabla</p>
          {supabaseResults.map(r => (
            <div key={r.table} className={`flex items-start gap-3 p-3 rounded-xl ${r.ok ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
              <span className="text-xl flex-shrink-0">{r.ok ? '✅' : '❌'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 text-sm font-mono">{r.table}</p>
                {!r.ok && <p className="text-red-600 text-xs font-bold mt-0.5 break-words">{r.error}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">¿Qué hacer?</p>
          <ul className="space-y-1.5">
            <li className="text-amber-800 text-sm font-bold">1. Ve a tu panel de Supabase → Table Editor</li>
            <li className="text-amber-800 text-sm font-bold">2. Borra manualmente las filas de las tablas marcadas con ❌</li>
            <li className="text-amber-800 text-sm font-bold">3. Verifica que las políticas RLS permiten DELETE</li>
            <li className="text-amber-800 text-sm font-bold">4. Vuelve e intenta el reset nuevamente</li>
          </ul>
        </div>

        <button
          onClick={() => { setStep('warning'); setSupabaseResults([]); }}
          className="w-full py-3.5 rounded-2xl bg-gray-700 text-white font-black hover:bg-gray-800 transition-colors"
        >
          ← Volver e Intentar de Nuevo
        </button>
      </div>
    );
  }

  // ── Screen: Deleting (progress) ──────────────────────────────────────────────
  if (step === 'deleting') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 5;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center text-5xl animate-pulse">🗑️</div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800">Eliminando Datos...</h2>
          <p className="text-gray-500 font-bold mt-2 text-sm">{progress.step}</p>
        </div>
        <div className="w-72 flex flex-col gap-2">
          <div className="flex justify-between text-xs font-bold text-gray-400">
            <span>{progress.done} / {progress.total} pasos</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {/* Resultados parciales de Supabase */}
        {supabaseResults.length > 0 && (
          <div className="flex flex-col gap-1.5 w-64">
            {supabaseResults.map(r => (
              <div key={r.table} className="flex items-center gap-2 text-sm">
                <span>{r.ok ? '✅' : '❌'}</span>
                <span className="font-mono font-bold text-gray-600">{r.table}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Screen: Done ─────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-5xl">✅</div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-800">¡Reset Completado!</h2>
          <p className="text-gray-500 font-bold mt-2">Todos los datos han sido eliminados.</p>
          <p className="text-gray-400 text-sm mt-1">La aplicación se recargará en un momento...</p>
        </div>

        {/* Resumen de lo borrado */}
        <div className="flex flex-col gap-1.5 w-64">
          <div className="flex items-center gap-2 text-sm">
            <span>✅</span>
            <span className="font-bold text-gray-600">localStorage completo</span>
          </div>
          {supabaseResults.map(r => (
            <div key={r.table} className="flex items-center gap-2 text-sm">
              <span>{r.ok ? '✅' : '⚠️'}</span>
              <span className="font-mono font-bold text-gray-600">Supabase: {r.table}</span>
            </div>
          ))}
        </div>

        <div className="w-56 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ animation: 'progress 3s linear forwards' }} />
        </div>
        <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  // ── Screen: Password ─────────────────────────────────────────────────────────
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

  // ── Screen: Confirm typing RESETEAR ──────────────────────────────────────────
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

  // ── Screen: Warning (default) ─────────────────────────────────────────────────
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
          almacenada en la aplicación, <span className="text-white font-black underline">tanto local como en la nube (Supabase)</span>. No se puede deshacer.
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

      {/* Proceso del reset */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">📋 Cómo funciona el reset</p>
        <ol className="space-y-1">
          <li className="text-blue-700 text-sm font-bold">1. Borra datos en Supabase (app_state, incomes, expenses)</li>
          <li className="text-blue-700 text-sm font-bold">2. Verifica que quedaron vacíos</li>
          <li className="text-blue-700 text-sm font-bold">3. Limpia TODO el almacenamiento local</li>
          <li className="text-blue-700 text-sm font-bold">4. Recarga la aplicación desde cero</li>
        </ol>
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
