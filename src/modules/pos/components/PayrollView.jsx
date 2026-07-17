import React, { useState, useMemo } from 'react';
import { usePayrollStore } from '../../../store/usePayrollStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useBranchStore } from '../../../store/useBranchStore';
import { useInventoryStore } from '../../../store/useInventoryStore';
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
  const { payrollEmployees = [], addEmployee, removeEmployee, updateEmployee, payrollRecords = [], savePayroll, deletePayroll } = usePayrollStore();
  const { branches = [] } = useBranchStore();
  const { posShifts = [], posRegisters = [], addPosExpense } = useInventoryStore();

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branchId || '__all__');

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
          { id: 'editor',         label: '📝 Nómina' },
          { id: 'historial',      label: '📋 Historial' },
          { id: 'empleados',      label: '👤 Empleados' },
          { id: 'bonificaciones', label: '🎯 Liquidación de Bonos' },
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
        <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
          <div className="bg-[#1a1b25] rounded-3xl border border-gray-800 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-black text-white text-base">Base de Empleados</h2>
                <p className="text-xs text-gray-500 font-bold">Configura el personal de la empresa, departamentos y tarifas de nómina.</p>
              </div>
              <button
                onClick={() => { setEditingEmp(null); setShowEmpModal(true); }}
                className="bg-violet-600 hover:bg-violet-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                + Nuevo Empleado
              </button>
            </div>

            {/* List */}
            {payrollEmployees.length === 0 ? (
              <p className="text-center text-gray-600 font-bold py-12 text-sm">Sin empleados registrados</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {payrollEmployees.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between gap-3 bg-gray-800/30 rounded-2xl px-4 py-3.5 border border-gray-800/80 hover:border-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-black text-sm">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-white text-sm flex items-center gap-2">
                          {emp.name}
                          {emp.active === false && <span className="bg-red-500/20 text-red-400 font-bold text-[9px] px-2 py-0.5 rounded-full">Inactivo</span>}
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                          {emp.department || 'Otros'} · C.C. {emp.documentId || '—'}
                        </p>
                        <p className="text-[9px] text-violet-400 font-bold mt-0.5">
                          Sede: {branches.find(b => b.id === emp.branchId)?.name || 'Principal'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingEmp(emp); setShowEmpModal(true); }}
                        className="w-8 h-8 rounded-xl bg-gray-800 text-gray-400 hover:text-violet-400 flex items-center justify-center transition-colors text-xs"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar a ${emp.name}?`)) removeEmployee(emp.id); }}
                        className="w-8 h-8 rounded-xl bg-gray-800 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors text-xs"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIQUIDACIÓN DE BONOS ── */}
      {vista === 'bonificaciones' && (
        <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
          <div className="bg-[#1a1b25] rounded-3xl border border-gray-800 p-5 space-y-4">
            
            {/* Header / Filtro */}
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-800 pb-4">
              <div>
                <h2 className="font-black text-white text-base">🎯 Liquidación de Bonificaciones</h2>
                <p className="text-xs text-gray-500 font-bold">Consulta y paga las metas dinámicas superadas por sucursal.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase">Sede:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white font-bold text-xs outline-none cursor-pointer"
                >
                  <option value="__all__">Todas las sedes</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="flex flex-wrap items-center gap-3 bg-[#11121a] p-4 rounded-2xl border border-gray-800/40">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-500 uppercase">Desde</span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)}
                  className="bg-transparent text-white font-black text-xs outline-none cursor-pointer"
                />
              </div>
              <div className="w-px h-4 bg-gray-800 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-500 uppercase">Hasta</span>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)}
                  className="bg-transparent text-white font-black text-xs outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Table */}
            <BonusesList
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              selectedBranchId={selectedBranchId}
              posShifts={posShifts}
              payrollEmployees={payrollEmployees}
              branches={branches}
              posRegisters={posRegisters}
              addPosExpense={addPosExpense}
              fmt={fmt}
            />
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmpModal && (
        <EmployeeModal
          employee={editingEmp}
          branches={branches}
          onClose={() => { setShowEmpModal(false); setEditingEmp(null); }}
          onSave={(data) => {
            if (editingEmp?.id) {
              updateEmployee(editingEmp.id, data);
            } else {
              addEmployee(data);
            }
            setShowEmpModal(false);
            setEditingEmp(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, branches = [], onClose, onSave }) {
  const [name, setName] = useState(employee?.name || '');
  const [documentId, setDocumentId] = useState(employee?.documentId || '');
  const [department, setDepartment] = useState(employee?.department || 'Caja');
  const [hourlyRate, setHourlyRate] = useState(employee?.hourlyRate || '');
  const [baseSalary, setBaseSalary] = useState(employee?.baseSalary || '');
  const [biometricUserId, setBiometricUserId] = useState(employee?.biometricUserId || '');
  const [branchId, setBranchId] = useState(employee?.branchId || branches[0]?.id || 'BRANCH-001');
  const [active, setActive] = useState(employee ? employee.active !== false : true);

  const handleSave = () => {
    if (!name.trim()) { alert("Ingresa el nombre del empleado"); return; }
    onSave({
      name: name.trim(),
      documentId: documentId.trim(),
      department,
      hourlyRate: Number(hourlyRate) || 0,
      baseSalary: Number(baseSalary) || 0,
      biometricUserId: biometricUserId.trim(),
      branchId,
      active
    });
  };

  const DEPARTMENTS = ['Caja', 'Ventas Calle', 'Cocina', 'Bodega', 'Administración', 'Otros'];

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1b25] border border-gray-800 rounded-[32px] p-6 w-full max-w-md shadow-2xl animate-[scaleIn_0.2s_ease-out] flex flex-col gap-5 text-left">
        <div>
          <h2 className="text-lg font-black text-white">{employee ? '👤 Editar Empleado' : '👤 Nuevo Empleado'}</h2>
          <p className="text-[10px] text-gray-500 font-bold mt-1">Configura los detalles del empleado para la nómina y biométrico.</p>
        </div>

        {/* Name */}
        <div>
          <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Nombre Completo</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none transition-colors"
            placeholder="Ej. Juan Pérez"
          />
        </div>

        {/* Document & Department */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Cédula / DNI</label>
            <input
              type="text"
              value={documentId}
              onChange={e => setDocumentId(e.target.value)}
              className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none transition-colors"
              placeholder="101824..."
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Departamento</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none cursor-pointer"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Branch & Biometric ID */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Sede de Trabajo</label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">ID Biométrico (Opcional)</label>
            <input
              type="text"
              value={biometricUserId}
              onChange={e => setBiometricUserId(e.target.value)}
              className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none transition-colors"
              placeholder="Hikvision ID"
            />
          </div>
        </div>

        {/* Hourly Rate & Salary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Pago por Hora ($)</label>
            <input
              type="number"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none transition-colors"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Salario Base ($)</label>
            <input
              type="number"
              value={baseSalary}
              onChange={e => setBaseSalary(e.target.value)}
              className="w-full bg-[#11121a] border border-gray-800 focus:border-violet-500 rounded-xl p-3 text-white font-bold text-sm outline-none transition-colors"
              placeholder="0"
            />
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            id="emp_active"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
          />
          <label htmlFor="emp_active" className="text-sm font-bold text-white cursor-pointer select-none">
            Empleado Activo
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-black py-3.5 rounded-xl transition-colors shadow-lg shadow-violet-900/30"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function BonusesList({ fechaDesde, fechaHasta, selectedBranchId, posShifts = [], payrollEmployees = [], branches = [], posRegisters = [], addPosExpense, fmt }) {
  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [registering, setRegistering] = useState(false);

  const activeShifts = useMemo(() => {
    return posShifts.filter(s => {
      if (!s.closedAt) return false;
      const date = s.openedAt.slice(0, 10);
      const inRange = date >= fechaDesde && date <= fechaHasta;
      if (!inRange) return false;
      if (selectedBranchId !== '__all__' && s.branchId !== selectedBranchId) return false;
      return true;
    });
  }, [posShifts, fechaDesde, fechaHasta, selectedBranchId]);

  const bonusesByEmployee = useMemo(() => {
    const map = {};
    activeShifts.forEach(shift => {
      if (shift.bonusRecipients && Array.isArray(shift.bonusRecipients)) {
        shift.bonusRecipients.forEach(rec => {
          const empId = rec.employeeId;
          if (!map[empId]) {
            const empDetails = payrollEmployees.find(e => e.id === empId);
            map[empId] = {
              id: empId,
              name: rec.name,
              documentId: rec.documentId || empDetails?.documentId || '—',
              department: empDetails?.department || 'Otros',
              branchName: branches.find(b => b.id === (shift.branchId || empDetails?.branchId))?.name || 'Principal',
              totalBonus: 0,
              shiftsCount: 0
            };
          }
          map[empId].totalBonus += rec.bonusAmount || 0;
          map[empId].shiftsCount += 1;
        });
      }
    });
    return Object.values(map);
  }, [activeShifts, payrollEmployees, branches]);

  const totalPayout = bonusesByEmployee.reduce((s, e) => s + e.totalBonus, 0);

  // Filter registers of the active branch
  const activeRegisters = posRegisters.filter(r => r.active !== false && (selectedBranchId === '__all__' || r.branchId === selectedBranchId));

  React.useEffect(() => {
    if (activeRegisters.length > 0 && !selectedRegisterId) {
      setSelectedRegisterId(activeRegisters[0].id);
    }
  }, [activeRegisters]);

  const handleRegisterExpense = () => {
    if (totalPayout <= 0) return;
    if (!selectedRegisterId) {
      alert("Por favor selecciona una caja para registrar el egreso");
      return;
    }
    const reg = activeRegisters.find(r => r.id === selectedRegisterId);
    
    setRegistering(true);
    try {
      addPosExpense({
        description: `Pago de Bonos por Metas (${fmtFecha(fechaDesde)} - ${fmtFecha(fechaHasta)})`,
        amount: totalPayout,
        type: 'egreso',
        category: 'Nómina',
        date: new Date().toISOString(),
        branchId: reg?.branchId || 'BRANCH-001',
        registerId: selectedRegisterId
      });
      alert(`✅ Egreso por ${fmt(totalPayout)} registrado con éxito en la caja "${reg?.name}"`);
    } finally {
      setRegistering(false);
    }
  };

  const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  return (
    <div className="space-y-4">
      {bonusesByEmployee.length === 0 ? (
        <p className="text-center text-gray-600 font-bold py-12 text-sm">No se encontraron comisiones o bonos en este rango de fechas.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#11121a]/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/40 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-left">Empleado</th>
                  <th className="py-3 px-3 text-left">Sede</th>
                  <th className="py-3 px-3 text-left">Rol</th>
                  <th className="py-3 px-3 text-right">Turnos Ganados</th>
                  <th className="py-3 px-4 text-right">Monto Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 text-gray-200">
                {bonusesByEmployee.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-800/10 font-bold">
                    <td className="py-3 px-4">
                      <p className="text-white">{emp.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold">C.C. {emp.documentId}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-400 text-xs">{emp.branchName}</td>
                    <td className="py-3 px-3 text-gray-400 text-xs">{emp.department}</td>
                    <td className="py-3 px-3 text-right text-gray-400">{emp.shiftsCount}</td>
                    <td className="py-3 px-4 text-right text-violet-400 font-black text-base">{fmt(emp.totalBonus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Liquidación Panel */}
          <div className="bg-[#11121a] border border-gray-800 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase">Total Liquidación de Bonos</p>
              <p className="text-2xl font-black text-violet-400">{fmt(totalPayout)}</p>
            </div>

            {activeRegisters.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedRegisterId}
                  onChange={e => setSelectedRegisterId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none cursor-pointer"
                >
                  {activeRegisters.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({branches.find(b => b.id === r.branchId)?.name || 'Principal'})</option>
                  ))}
                </select>
                <button
                  onClick={handleRegisterExpense}
                  disabled={registering}
                  className="bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-black text-xs py-3.5 px-6 rounded-xl transition-all"
                >
                  {registering ? 'Registrando...' : 'Registrar Gasto de Bonos'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
