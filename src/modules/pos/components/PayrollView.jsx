import React, { useState, useMemo } from 'react';
import { usePayrollStore } from '../../../store/usePayrollStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatMoney as fmt } from '../../../utils/formatUtils';

const TIPOS = [
  { key: 'nomina',      label: 'Nómina',      color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', placeholder: '0' },
  { key: 'extras',      label: 'Extras',       color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   placeholder: '0' },
  { key: 'vacaciones',  label: 'Vacaciones',   color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200',placeholder: '0' },
  { key: 'liquidacion', label: 'Liquidación',  color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    placeholder: '0' },
];

const EMPTY_FILA = (emp) => ({
  empleadoId: emp?.id || `TEMP-${Date.now()}`,
  empleadoNombre: emp?.name || '',
  nomina: '', extras: '', vacaciones: '', liquidacion: '', observacion: '',
});

const rowTotal = (f) =>
  (Number(f.nomina)||0) + (Number(f.extras)||0) + (Number(f.vacaciones)||0) + (Number(f.liquidacion)||0);

// ─── Tarjeta colapsable del historial (necesita su propio estado) ─────────────
function HistorialCard({ rec, deletePayroll, fmt }) {
  const [open, setOpen] = React.useState(false);
  const total = rec.filas.reduce((s, f) => s + rowTotal(f), 0);
  return (
    <div className="bg-[#1a1b25] rounded-3xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-800/20 transition-colors" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600/20 rounded-2xl flex items-center justify-center">
            <span className="text-lg">📅</span>
          </div>
          <div>
            <p className="font-black text-white text-base">{rec.periodo}</p>
            <p className="text-xs text-gray-500 font-bold">{rec.filas.length} empleados · {rec.creadoPor || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-violet-300">{fmt(total)}</span>
          <button
            onClick={e => { e.stopPropagation(); if (window.confirm(`¿Eliminar nómina de ${rec.periodo}?`)) deletePayroll(rec.id); }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
          >🗑️</button>
          <span className={`text-gray-500 text-sm transition-transform duration-200 inline-block ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>
      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-gray-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-800/30">
                <th className="py-2 px-4 text-left text-[10px] font-bold text-gray-500 uppercase">Empleado</th>
                {TIPOS.map(t => <th key={t.key} className={`py-2 px-3 text-right text-[10px] font-bold uppercase ${t.color}`}>{t.label}</th>)}
                <th className="py-2 px-3 text-right text-[10px] font-bold text-violet-400 uppercase">Total</th>
                <th className="py-2 px-3 text-left text-[10px] font-bold text-gray-500 uppercase">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {rec.filas.map((f, i) => (
                <tr key={i} className="hover:bg-gray-800/10">
                  <td className="py-2.5 px-4 font-bold text-white text-sm">{f.empleadoNombre || f.nombre || '—'}</td>
                  {TIPOS.map(t => (
                    <td key={t.key} className={`py-2.5 px-3 text-right font-black text-sm ${t.color}`}>
                      {f[t.key] > 0 ? fmt(f[t.key]) : <span className="text-gray-700">—</span>}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right font-black text-violet-300">{fmt(rowTotal(f))}</td>
                  <td className="py-2.5 px-3 text-gray-500 text-xs font-bold">{f.observacion || f.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-violet-800/30 bg-violet-900/10">
                <td className="py-2 px-4 text-xs font-black text-violet-400 uppercase">Total</td>
                {TIPOS.map(t => (
                  <td key={t.key} className={`py-2 px-3 text-right font-black text-sm ${t.color}`}>
                    {fmt(rec.filas.reduce((s, f) => s + (Number(f[t.key]) || 0), 0))}
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-black text-violet-300 text-base">{fmt(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function PayrollView({ onClose }) {
  const { user } = useAuthStore();
  const { payrollEmployees, payrollRecords, addEmployee, removeEmployee, renameEmployee, savePayroll, deletePayroll } = usePayrollStore();

  const todayISO = new Date().toISOString().split('T')[0];
  const [fechaDesde, setFechaDesde] = useState(todayISO);
  const [fechaHasta, setFechaHasta] = useState(todayISO);
  const [vista, setVista] = useState('editor');

  const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const periodo = fechaDesde === fechaHasta
    ? fmtFecha(fechaDesde)
    : `${fmtFecha(fechaDesde)} — ${fmtFecha(fechaHasta)}`;

  const [filas, setFilas] = useState(() => payrollEmployees.map(EMPTY_FILA));
  const [toast, setToast] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevoEmp, setNuevoEmp] = useState('');
  const [editEmpId, setEditEmpId] = useState(null);
  const [editEmpName, setEditEmpName] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const updateFila = (idx, campo, val) => setFilas(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: val } : f));
  const agregarFilaLibre = () => setFilas(prev => [...prev, EMPTY_FILA()]);
  const eliminarFila = (idx) => setFilas(prev => prev.filter((_, i) => i !== idx));

  const handleGuardar = () => {
    const filasValidas = filas.filter(f => f.empleadoNombre.trim());
    if (!filasValidas.length) { showToast('⚠️ Agrega al menos un empleado'); return; }
    if (!fechaDesde) { showToast('⚠️ Elige una fecha'); return; }
    setGuardando(true);
    try {
      savePayroll(periodo, filasValidas, user?.name || '');
      showToast(`✅ Nómina del ${periodo} guardada`);
      setFilas(payrollEmployees.map(EMPTY_FILA));
    } finally {
      setGuardando(false);
    }
  };

  const totales = useMemo(() => TIPOS.reduce((acc, t) => {
    acc[t.key] = filas.reduce((s, f) => s + (Number(f[t.key]) || 0), 0);
    return acc;
  }, { total: filas.reduce((s, f) => s + rowTotal(f), 0) }), [filas]);


  return (
    <div className="fixed inset-0 z-[100] bg-[#0f0f17] flex flex-col font-sans">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999] bg-gray-900 text-white font-black text-sm px-5 py-3 rounded-2xl shadow-2xl border border-gray-700">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-[#1a1b25] border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600/20 rounded-2xl flex items-center justify-center">
            <span className="text-xl">👥</span>
          </div>
          <div>
            <h1 className="text-base font-black text-white">Nómina y Pago a Personal</h1>
            <p className="text-[10px] font-bold text-gray-500">Frita Mejor · {user?.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors text-lg font-black">✕</button>
      </header>

      {/* ── Sub-tabs ── */}
      <div className="bg-[#1a1b25] border-b border-gray-800 px-4 pb-3 flex gap-2 shrink-0">
        {[
          { id: 'editor',    label: '📝 Nómina' },
          { id: 'historial', label: '📋 Historial' },
          { id: 'empleados', label: '👤 Empleados' },
        ].map(t => (
          <button key={t.id} onClick={() => setVista(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${vista === t.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EDITOR ── */}
      {vista === 'editor' && (
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

          {/* Selector de fechas */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1a1b25] border border-gray-700 rounded-2xl px-4 py-2.5">
              <span className="text-xs font-bold text-gray-400 uppercase">Desde</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                className="bg-transparent text-white font-black text-sm outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#1a1b25] border border-gray-700 rounded-2xl px-4 py-2.5">
              <span className="text-xs font-bold text-gray-400 uppercase">Hasta</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                className="bg-transparent text-white font-black text-sm outline-none cursor-pointer"
              />
            </div>
            {periodo && (
              <span className="text-xs font-bold text-violet-400 bg-violet-900/20 border border-violet-800/40 px-3 py-1.5 rounded-full">
                📅 {periodo}
              </span>
            )}
            <button onClick={handleGuardar} disabled={guardando}
              className="ml-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-black text-sm px-5 py-2.5 rounded-2xl shadow-lg shadow-violet-900/30 transition-all active:scale-95">
              {guardando ? '💾 Guardando...' : '💾 Guardar Nómina'}
            </button>
          </div>

          {/* Tabla */}
          <div className="bg-[#1a1b25] rounded-3xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-3 px-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest w-40">Empleado</th>
                    {TIPOS.map(t => (
                      <th key={t.key} className={`py-3 px-3 text-right text-[10px] font-bold uppercase tracking-widest ${t.color}`}>{t.label}</th>
                    ))}
                    <th className="py-3 px-3 text-right text-[10px] font-bold text-violet-400 uppercase tracking-widest">Total</th>
                    <th className="py-3 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Obs.</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filas.length === 0 && (
                    <tr><td colSpan={8} className="py-10 text-center text-gray-600 font-bold text-sm">
                      Sin filas. Agrega empleados o usa la lista.
                    </td></tr>
                  )}
                  {filas.map((fila, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/20 transition-colors">
                      {/* Nombre */}
                      <td className="py-2 px-4">
                        <input
                          value={fila.empleadoNombre}
                          onChange={e => updateFila(idx, 'empleadoNombre', e.target.value)}
                          placeholder="Nombre..."
                          className="w-full bg-transparent text-white font-bold text-sm outline-none placeholder-gray-600 border-b border-transparent focus:border-violet-500 transition-colors pb-0.5"
                        />
                      </td>
                      {/* Montos */}
                      {TIPOS.map(t => (
                        <td key={t.key} className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            value={fila[t.key]}
                            onChange={e => updateFila(idx, t.key, e.target.value)}
                            placeholder="—"
                            className={`w-full text-right font-black text-sm bg-transparent outline-none placeholder-gray-700 border-b border-transparent focus:border-current pb-0.5 ${t.color} transition-colors`}
                          />
                        </td>
                      ))}
                      {/* Total fila */}
                      <td className="py-2 px-3 text-right font-black text-violet-300 text-sm whitespace-nowrap">
                        {rowTotal(fila) > 0 ? fmt(rowTotal(fila)) : <span className="text-gray-700">—</span>}
                      </td>
                      {/* Observación */}
                      <td className="py-2 px-3">
                        <input
                          value={fila.observacion}
                          onChange={e => updateFila(idx, 'observacion', e.target.value)}
                          placeholder="—"
                          className="w-full bg-transparent text-gray-400 font-bold text-xs outline-none placeholder-gray-700 border-b border-transparent focus:border-gray-500 pb-0.5 transition-colors"
                        />
                      </td>
                      {/* Eliminar */}
                      <td className="py-2 px-2">
                        <button onClick={() => eliminarFila(idx)}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-red-400 hover:bg-red-500/20 transition-all text-sm font-black">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totales */}
                {filas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-violet-800/40 bg-violet-900/10">
                      <td className="py-3 px-4 text-xs font-black text-violet-400 uppercase tracking-wider">
                        Totales ({filas.filter(f=>f.empleadoNombre).length})
                      </td>
                      {TIPOS.map(t => (
                        <td key={t.key} className={`py-3 px-3 text-right font-black text-sm ${t.color}`}>
                          {totales[t.key] > 0 ? fmt(totales[t.key]) : <span className="text-gray-700">—</span>}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right font-black text-violet-300 text-base">
                        {fmt(filas.reduce((s,f)=>s+rowTotal(f),0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Botón agregar fila */}
          <button onClick={agregarFilaLibre}
            className="self-start flex items-center gap-2 text-sm font-black text-gray-500 hover:text-violet-400 border border-dashed border-gray-700 hover:border-violet-600 px-4 py-2.5 rounded-2xl transition-all">
            + Agregar fila
          </button>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {vista === 'historial' && (
        <div className="flex-1 overflow-auto p-4">
          {payrollRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-600">
              <span className="text-5xl">📋</span>
              <p className="font-bold">No hay nóminas guardadas aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payrollRecords.map(rec => (
                <HistorialCard key={rec.id} rec={rec} deletePayroll={deletePayroll} fmt={fmt} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GESTIÓN DE EMPLEADOS ── */}
      {vista === 'empleados' && (
        <div className="flex-1 overflow-auto p-4 max-w-lg mx-auto w-full">
          <div className="bg-[#1a1b25] rounded-3xl border border-gray-800 p-5 space-y-4">
            <h2 className="font-black text-white text-base">Lista de Empleados</h2>
            <p className="text-xs text-gray-500 font-bold">Estos empleados aparecen automáticamente al crear una nómina nueva.</p>

            {/* Agregar */}
            <div className="flex gap-2">
              <input
                value={nuevoEmp}
                onChange={e=>setNuevoEmp(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&nuevoEmp.trim()){addEmployee(nuevoEmp);setNuevoEmp('');}}}
                placeholder="Nombre del empleado..."
                className="flex-1 bg-gray-800 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none placeholder-gray-600 transition-colors"
              />
              <button
                onClick={()=>{if(nuevoEmp.trim()){addEmployee(nuevoEmp);setNuevoEmp('');}}}
                className="bg-violet-600 hover:bg-violet-500 text-white font-black text-sm px-4 py-2.5 rounded-xl transition-colors active:scale-95">
                + Agregar
              </button>
            </div>

            {/* Lista */}
            {payrollEmployees.length === 0 ? (
              <p className="text-center text-gray-600 font-bold py-6 text-sm">Sin empleados registrados</p>
            ) : (
              <div className="space-y-2">
                {payrollEmployees.map(emp => (
                  <div key={emp.id} className="flex items-center gap-2 bg-gray-800/50 rounded-2xl px-4 py-3 border border-gray-700/50 group">
                    {editEmpId === emp.id ? (
                      <>
                        <input
                          value={editEmpName}
                          onChange={e=>setEditEmpName(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter'){renameEmployee(emp.id,editEmpName);setEditEmpId(null);}if(e.key==='Escape')setEditEmpId(null);}}
                          autoFocus
                          className="flex-1 bg-gray-700 border border-violet-500 rounded-lg px-3 py-1.5 text-white font-bold text-sm outline-none"
                        />
                        <button onClick={()=>{renameEmployee(emp.id,editEmpName);setEditEmpId(null);}} className="text-violet-400 font-black text-xs px-2 py-1 rounded-lg bg-violet-600/20">✓</button>
                        <button onClick={()=>setEditEmpId(null)} className="text-gray-500 font-black text-xs px-2 py-1">✕</button>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-black text-xs flex-shrink-0">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 font-bold text-white text-sm">{emp.name}</span>
                        <button onClick={()=>{setEditEmpId(emp.id);setEditEmpName(emp.name);}} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-violet-400 text-xs font-black px-2 py-1 transition-all">✏️</button>
                        <button onClick={()=>{if(confirm(`¿Eliminar a ${emp.name}?`))removeEmployee(emp.id);}} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs font-black px-2 py-1 transition-all">🗑️</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
