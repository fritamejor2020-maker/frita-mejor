import React, { useEffect, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { supabase } from '../../lib/supabase';
import { formatMoney as fmt } from '../../utils/formatUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const dateOf = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// ── Modal de foto ─────────────────────────────────────────────────────────────
function PhotoModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center gap-4" onClick={onClose}>
      <img src={src} alt="Foto sobre" className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
      <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/60 rounded-full w-10 h-10 flex items-center justify-center text-xl font-black hover:bg-red-600 transition-colors">✕</button>
      <p className="text-gray-400 text-sm font-bold">Toca para cerrar</p>
    </div>
  );
}

// ── Modal de edición de ingreso ───────────────────────────────────────────────
function EditIncomeModal({ income, onSave, onClose }: { income: any; onSave: (updated: any) => void; onClose: () => void }) {
  const [efectivo, setEfectivo]           = useState(String(income.efectivo || 0));
  const [transferencias, setTransferencias] = useState(String(income.transferencias || 0));
  const [salidas, setSalidas]             = useState(String(income.salidas || 0));
  const [vendedor, setVendedor]           = useState(income.vendedor || '');
  const [observaciones, setObservaciones] = useState(income.observaciones || '');

  const total = (parseFloat(efectivo) || 0) + (parseFloat(transferencias) || 0) + (parseFloat(salidas) || 0);

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-black text-gray-900">✏️ Editar Ingreso</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Vendedor / Responsable</label>
            <input value={vendedor} onChange={e => setVendedor(e.target.value)} className="w-full border-2 border-gray-200 focus:border-amber-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Efectivo</label>
              <input type="number" value={efectivo} onChange={e => setEfectivo(e.target.value)} className="w-full border-2 border-gray-200 focus:border-green-400 rounded-xl px-3 py-2.5 font-black text-gray-800 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Transfer.</label>
              <input type="number" value={transferencias} onChange={e => setTransferencias(e.target.value)} className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-xl px-3 py-2.5 font-black text-gray-800 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Salidas</label>
              <input type="number" value={salidas} onChange={e => setSalidas(e.target.value)} className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-xl px-3 py-2.5 font-black text-gray-800 outline-none" />
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center border border-amber-200">
            <span className="text-sm font-bold text-amber-600 uppercase">Total</span>
            <span className="text-2xl font-black text-amber-700">{fmt(total)}</span>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full border-2 border-gray-200 focus:border-gray-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 font-black text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button
            onClick={() => onSave({ efectivo: parseFloat(efectivo)||0, transferencias: parseFloat(transferencias)||0, salidas: parseFloat(salidas)||0, total, vendedor, observaciones })}
            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 font-black text-white transition-colors shadow-sm"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabla de Ingresos ─────────────────────────────────────────────────────────
function IncomesTable() {
  const { incomes, fetchFinances, subscribeToIncomes } = useFinanceStore() as any;
  const [filterDate, setFilterDate]   = useState('');
  const [filterUbic, setFilterUbic]   = useState('');
  const [photoSrc, setPhotoSrc]       = useState<string|null>(null);
  const [editIncome, setEditIncome]   = useState<any|null>(null);
  const [deleting, setDeleting]       = useState<string|null>(null);

  useEffect(() => {
    fetchFinances();
    const unsub = subscribeToIncomes();
    return () => unsub?.();
  }, []);

  const filtered = incomes
    .filter((i: any) => !filterDate || dateOf(i.fecha || i.created_at) === filterDate)
    .filter((i: any) => !filterUbic || (i.ubicacion || '').toLowerCase().includes(filterUbic.toLowerCase()));

  const ubicaciones = [...new Set(incomes.map((i: any) => i.ubicacion).filter(Boolean))] as string[];

  const totalFiltrado = filtered.reduce((s: number, i: any) => s + (i.total || 0), 0);

  const handleSave = async (income: any, updated: any) => {
    try {
      await supabase.from('incomes').update(updated).eq('id', income.id);
      await fetchFinances();
    } catch (e) {
      console.error(e);
    }
    setEditIncome(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.')) return;
    setDeleting(id);
    try {
      await supabase.from('incomes').delete().eq('id', id);
      await fetchFinances();
    } catch (e) {
      console.error(e);
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer" />
        <select value={filterUbic} onChange={e => setFilterUbic(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer">
          <option value="">Todas las ubicaciones</option>
          {ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {(filterDate || filterUbic) && (
          <button onClick={() => { setFilterDate(''); setFilterUbic(''); }}
            className="text-xs font-bold text-red-400 hover:text-red-600 transition-colors bg-red-50 px-3 py-2 rounded-xl border border-red-100">
            ✕ Limpiar
          </button>
        )}
        <div className="ml-auto bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <span className="text-xs font-bold text-amber-600 uppercase">Total filtrado </span>
          <span className="text-base font-black text-amber-700">{fmt(totalFiltrado)}</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Fecha</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Ubicación / Jornada</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Vendedor</th>
                <th className="py-3 px-4 text-[10px] font-bold text-green-500 uppercase tracking-widest text-right">Efectivo</th>
                <th className="py-3 px-4 text-[10px] font-bold text-blue-500 uppercase tracking-widest text-right">Transfer.</th>
                <th className="py-3 px-4 text-[10px] font-bold text-purple-500 uppercase tracking-widest text-right">Salidas</th>
                <th className="py-3 px-4 text-[10px] font-bold text-amber-500 uppercase tracking-widest text-right">Total</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Foto</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400 font-bold">Sin ingresos registrados</td></tr>
              ) : (
                filtered.map((income: any) => (
                  <tr key={income.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-600 text-xs whitespace-nowrap">{fmtDate(income.fecha || income.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-black text-gray-800 text-xs">{income.ubicacion || '—'}</span>
                        {income.jornada && <span className="text-[10px] font-bold text-gray-400">Jornada {income.jornada}{income.tipo && income.tipo !== income.jornada ? ` · ${income.tipo}` : ''}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-700 text-xs">{income.vendedor || income.creado_por || '—'}</span>
                        {income.observaciones && <span className="text-[10px] text-gray-400 italic truncate max-w-[120px]" title={income.observaciones}>📝 {income.observaciones}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-green-600 text-sm">{income.efectivo > 0 ? fmt(income.efectivo) : '—'}</td>
                    <td className="py-3 px-4 text-right font-black text-blue-600 text-sm">{income.transferencias > 0 ? fmt(income.transferencias) : '—'}</td>
                    <td className="py-3 px-4 text-right font-black text-purple-600 text-sm">{income.salidas > 0 ? fmt(income.salidas) : '—'}</td>
                    <td className="py-3 px-4 text-right font-black text-amber-600 text-base">{fmt(income.total || 0)}</td>
                    <td className="py-3 px-4 text-center">
                      {(income.photoUrl || income.photoBase64) ? (
                        <button
                          onClick={() => setPhotoSrc(income.photoUrl || income.photoBase64)}
                          className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200 transition-colors"
                        >
                          📷 Ver
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs font-bold">Sin foto</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setEditIncome(income)}
                          className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200 transition-colors"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(income.id)}
                          disabled={deleting === income.id}
                          className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full border border-red-200 transition-colors disabled:opacity-40"
                        >
                          {deleting === income.id ? '...' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-100">
                  <td colSpan={3} className="py-3 px-4 font-black text-amber-700 text-sm uppercase tracking-wider">Totales ({filtered.length} registros)</td>
                  <td className="py-3 px-4 text-right font-black text-green-700">{fmt(filtered.reduce((s: number, i: any) => s + (i.efectivo||0), 0))}</td>
                  <td className="py-3 px-4 text-right font-black text-blue-700">{fmt(filtered.reduce((s: number, i: any) => s + (i.transferencias||0), 0))}</td>
                  <td className="py-3 px-4 text-right font-black text-purple-700">{fmt(filtered.reduce((s: number, i: any) => s + (i.salidas||0), 0))}</td>
                  <td className="py-3 px-4 text-right font-black text-amber-700 text-base">{fmt(totalFiltrado)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {photoSrc && <PhotoModal src={photoSrc} onClose={() => setPhotoSrc(null)} />}
      {editIncome && (
        <EditIncomeModal
          income={editIncome}
          onSave={(updated) => handleSave(editIncome, updated)}
          onClose={() => setEditIncome(null)}
        />
      )}
    </div>
  );
}

// ── Tabla de Gastos ───────────────────────────────────────────────────────────
function ExpensesTable() {
  const { expenses, fetchFinances } = useFinanceStore() as any;
  const { setTipoGasto } = useSupplierStore() as any;

  const TIPOS = [
    { value: 'por_definir', label: '⬜ Por definir', bg: 'bg-gray-100', text: 'text-gray-500' },
    { value: 'fijo',        label: '📌 Fijo',        bg: 'bg-blue-50',  text: 'text-blue-600' },
    { value: 'variable',    label: '📈 Variable',    bg: 'bg-amber-50', text: 'text-amber-600' },
    { value: 'insumo',      label: '🧂 Insumo',      bg: 'bg-green-50', text: 'text-green-600' },
  ];
  const tipoLabel = (v: string) => TIPOS.find(t => t.value === v) || TIPOS[0];
  const [filterDate, setFilterDate]   = useState('');
  const [filterProv, setFilterProv]   = useState('');
  const [filterProd, setFilterProd]   = useState('');
  const [photoSrc, setPhotoSrc]       = useState<string|null>(null);
  const [deleting, setDeleting]       = useState<string|null>(null);
  const [editExpense, setEditExpense] = useState<any|null>(null);
  const [editDesc, setEditDesc]       = useState('');
  const [editMonto, setEditMonto]     = useState('');
  const [editCantidad, setEditCantidad] = useState('');
  const [editUnidades, setEditUnidades] = useState('');
  const [editObservacion, setEditObservacion] = useState('');
  const [editTipo, setEditTipo]         = useState('por_definir');

  const proveedores = [...new Set(expenses.map((e: any) => e.proveedor).filter(Boolean))] as string[];

  const filtered = expenses
    .filter((e: any) => !filterDate || dateOf(e.fecha || e.created_at) === filterDate)
    .filter((e: any) => !filterProv || (e.proveedor || '').toLowerCase().includes(filterProv.toLowerCase()))
    .filter((e: any) => !filterProd || (e.descripcion || '').toLowerCase().includes(filterProd.toLowerCase()));

  const total = filtered.reduce((s: number, e: any) => s + (e.monto ?? e.valor ?? e.amount ?? 0), 0);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    setDeleting(id);
    try {
      await supabase.from('expenses').delete().eq('id', id);
      await fetchFinances();
    } catch (e) { console.error(e); }
    setDeleting(null);
  };

  const handleSave = async () => {
    try {
      await supabase.from('expenses').update({
        descripcion: editDesc,
        monto: parseFloat(editMonto) || 0,
        cantidad: editCantidad ? parseFloat(editCantidad) : null,
        unidades: editUnidades.trim() || null,
        observacion: editObservacion.trim() || null,
        tipoGasto: editTipo,
      }).eq('id', editExpense.id);
      // Aprender: guardar el tipo para futuros gastos del mismo producto
      if (editTipo !== 'por_definir' && editDesc.trim()) {
        setTipoGasto(editDesc.toLowerCase().trim(), editTipo);
      }
      await fetchFinances();
    } catch (e) { console.error(e); }
    setEditExpense(null);
  };

  const openEdit = (expense: any) => {
    setEditExpense(expense);
    setEditDesc(expense.descripcion || '');
    setEditMonto(String(expense.monto ?? expense.valor ?? expense.amount ?? 0));
    setEditCantidad(expense.cantidad != null ? String(expense.cantidad) : '');
    setEditUnidades(expense.unidades || '');
    setEditObservacion(expense.observacion || '');
    setEditTipo(expense.tipoGasto || 'por_definir');
  };

  const hasFilters = filterDate || filterProv || filterProd;

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer" />

        <select value={filterProv} onChange={e => setFilterProv(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer">
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <input
          type="text"
          placeholder="🔍 Buscar producto..."
          value={filterProd}
          onChange={e => setFilterProd(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none shadow-sm min-w-[180px]"
        />

        {hasFilters && (
          <button onClick={() => { setFilterDate(''); setFilterProv(''); setFilterProd(''); }}
            className="text-xs font-bold text-red-400 hover:text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
            ✕ Limpiar
          </button>
        )}
        <div className="ml-auto bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          <span className="text-xs font-bold text-red-500 uppercase">Total gastos </span>
          <span className="text-base font-black text-red-600">{fmt(total)}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Fecha</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Descripción / Producto</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Proveedor</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Tipo</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Cantidad</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Registrado por</th>
                <th className="py-3 px-4 text-[10px] font-bold text-red-500 uppercase tracking-widest text-right">Monto</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Foto</th>
                <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400 font-bold">Sin gastos registrados</td></tr>
              ) : (
                filtered.map((expense: any) => (
                  <tr key={expense.id} className="hover:bg-red-50/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-600 text-xs whitespace-nowrap">{fmtDate(expense.fecha || expense.created_at)}</td>
                    <td className="py-3 px-4 max-w-[180px]">
                      <p className="font-bold text-gray-800 text-sm truncate">{expense.descripcion || '—'}</p>
                      {expense.observacion && <p className="text-[10px] text-gray-400 font-bold truncate mt-0.5">📝 {expense.observacion}</p>}
                    </td>
                    <td className="py-3 px-4">
                      {expense.proveedor ? (
                        <span className="text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          🏪 {expense.proveedor}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {/* Columna Tipo */}
                    <td className="py-3 px-4 text-center">
                      {(() => { const t = tipoLabel(expense.tipoGasto || 'por_definir'); return (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${t.bg} ${t.text} whitespace-nowrap`}>{t.label}</span>
                      ); })()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {expense.cantidad != null ? (
                        <span className="text-xs font-bold text-gray-700">
                          {expense.cantidad} <span className="text-gray-400">{expense.unidades || ''}</span>
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-500 text-xs">{expense.creado_por || '—'}</td>
                    <td className="py-3 px-4 text-right font-black text-red-600 text-base">{fmt(expense.monto ?? expense.valor ?? expense.amount ?? 0)}</td>
                    <td className="py-3 px-4 text-center">
                      {(expense.facturaUrl || expense.factura_url) ? (
                        <button
                          onClick={() => setPhotoSrc(expense.facturaUrl || expense.factura_url)}
                          className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200 transition-colors"
                        >
                          📷 Ver
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs font-bold">Sin foto</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(expense)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200 transition-colors"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deleting === expense.id}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full border border-red-200 transition-colors disabled:opacity-40"
                        >{deleting === expense.id ? '...' : '🗑️'}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-red-50 border-t-2 border-red-100">
                  <td colSpan={4} className="py-3 px-4 font-black text-red-600 text-sm uppercase">Total ({filtered.length} gastos)</td>
                  <td className="py-3 px-4 text-right font-black text-red-700 text-base">{fmt(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {photoSrc && <PhotoModal src={photoSrc} onClose={() => setPhotoSrc(null)} />}

      {editExpense && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={() => setEditExpense(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-900">✏️ Editar Gasto</h3>
              <button onClick={() => setEditExpense(null)} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Descripción</label>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full border-2 border-gray-200 focus:border-amber-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Monto</label>
                <input type="number" value={editMonto} onChange={e => setEditMonto(e.target.value)} className="w-full border-2 border-gray-200 focus:border-red-400 rounded-xl px-3 py-2.5 font-black text-gray-800 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cantidad</label>
                  <input type="number" value={editCantidad} onChange={e => setEditCantidad(e.target.value)} placeholder="—" className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Unidades</label>
                  <input type="text" value={editUnidades} onChange={e => setEditUnidades(e.target.value)} placeholder="kg, unid..." className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Tipo de Gasto</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map((t: any) => (
                    <button key={t.value} type="button" onClick={() => setEditTipo(t.value)}
                      className={`py-2 px-3 rounded-xl border-2 font-black text-xs transition-all ${
                        editTipo === t.value ? `${t.bg} ${t.text} border-current` : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Observación</label>
                <textarea value={editObservacion} onChange={e => setEditObservacion(e.target.value)} rows={2} placeholder="Notas..." className="w-full border-2 border-gray-200 focus:border-amber-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditExpense(null)} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 font-black text-gray-500 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 font-black text-white shadow-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal exportado ────────────────────────────────────────────
export const AdminIncomesExpensesTab = ({ defaultTab = 'ingresos' }: { defaultTab?: 'ingresos' | 'gastos' }) => {
  return (
    <div className="flex flex-col gap-6">
      {defaultTab === 'ingresos' ? <IncomesTable /> : <ExpensesTable />}
    </div>
  );
};
