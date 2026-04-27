import React, { useState } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatMoney } from '../../utils/formatUtils';

// ── Colores disponibles para niveles ──────────────────────────────────────────
const COLORS = [
  { value: 'bg-blue-500',   label: 'Azul'     },
  { value: 'bg-green-500',  label: 'Verde'    },
  { value: 'bg-purple-500', label: 'Morado'   },
  { value: 'bg-red-500',    label: 'Rojo'     },
  { value: 'bg-orange-500', label: 'Naranja'  },
  { value: 'bg-pink-500',   label: 'Rosa'     },
  { value: 'bg-indigo-500', label: 'Índigo'   },
  { value: 'bg-teal-500',   label: 'Teal'     },
];

// ── Helper: badge de deuda ────────────────────────────────────────────────────
const DebtBadge = ({ amount }: { amount: number }) => {
  if (amount <= 0) return <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Al día ✓</span>;
  return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Debe {formatMoney(amount)}</span>;
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: NIVELES DE CONTRATA
// ══════════════════════════════════════════════════════════════════════════════
function NivelesTab() {
  const { customerTypes, addCustomerType, updateCustomerType, deleteCustomerType } = useInventoryStore();
  const contrataTypes = (customerTypes || []);

  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState('bg-blue-500');
  const [editId, setEditId]     = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const handleAdd = () => {
    if (!newName.trim()) return;
    addCustomerType({ name: newName.trim(), productDiscounts: [], allowCredit: false, globalDiscountPercent: 0, color: newColor });
    setNewName(''); setNewColor('bg-blue-500');
  };

  const startEdit = (t: any) => { setEditId(t.id); setEditData({ name: t.name, allowCredit: !!t.allowCredit, globalDiscountPercent: t.globalDiscountPercent || 0, color: t.color || 'bg-blue-500' }); };
  const saveEdit  = () => { if (!editId) return; updateCustomerType(editId, editData); setEditId(null); };

  return (
    <div className="space-y-6">
      {/* Crear nivel */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-black text-gray-800 text-lg mb-4">Crear Nuevo Nivel</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Ej: Nivel 1, Restaurantes..."
            className="flex-1 min-w-[200px] border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-800 outline-none focus:border-yellow-400 bg-gray-50"
          />
          <select value={newColor} onChange={e => setNewColor(e.target.value)}
            className="border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-700 outline-none focus:border-yellow-400 bg-gray-50">
            {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button onClick={handleAdd} className="bg-yellow-400 text-gray-900 font-black px-6 py-3 rounded-2xl hover:bg-yellow-300 active:scale-95 transition-all shadow-sm">
            + Crear
          </button>
        </div>
      </div>

      {/* Lista de niveles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {contrataTypes.map((t: any) => (
          <div key={t.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header del nivel */}
            <div className={`${t.color || 'bg-blue-500'} p-4`}>
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-lg">{t.name}</span>
                <span className="bg-white/30 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {(t.productDiscounts || []).length} precios especiales
                </span>
              </div>
            </div>

            {/* Cuerpo */}
            {editId === t.id ? (
              <div className="p-4 space-y-3">
                <input value={editData.name} onChange={e => setEditData((d: any) => ({ ...d, name: e.target.value }))}
                  className="w-full border-2 border-yellow-300 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none text-sm" />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editData.allowCredit}
                      onChange={e => setEditData((d: any) => ({ ...d, allowCredit: e.target.checked }))}
                      className="w-4 h-4 accent-yellow-400" />
                    <span className="font-bold text-sm text-gray-700">Permite Crédito</span>
                  </label>
                </div>
                {editData.allowCredit && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Descuento Global (%)</label>
                    <input type="number" min="0" max="100" value={editData.globalDiscountPercent}
                      onChange={e => setEditData((d: any) => ({ ...d, globalDiscountPercent: parseFloat(e.target.value) || 0 }))}
                      className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none text-sm" />
                  </div>
                )}
                <select value={editData.color} onChange={e => setEditData((d: any) => ({ ...d, color: e.target.value }))}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 font-bold text-gray-700 outline-none text-sm">
                  {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditId(null)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95">Cancelar</button>
                  <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-yellow-400 text-gray-900 font-black text-sm active:scale-95">Guardar</button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-500">Crédito</span>
                  {t.allowCredit
                    ? <span className="text-green-600 font-black text-xs bg-green-50 px-2 py-0.5 rounded-full">✓ Habilitado</span>
                    : <span className="text-gray-400 font-bold text-xs bg-gray-100 px-2 py-0.5 rounded-full">No</span>}
                </div>
                {(t.globalDiscountPercent || 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-gray-500">Dto. Global</span>
                    <span className="font-black text-yellow-600">{t.globalDiscountPercent}%</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => startEdit(t)} className="flex-1 text-sm font-bold py-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95 transition-all">
                    ✏️ Editar
                  </button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${t.name}"?`)) deleteCustomerType(t.id); }}
                    className="text-sm font-bold py-2 px-3 rounded-xl text-red-400 hover:bg-red-50 active:scale-95 transition-all">
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {contrataTypes.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🏷️</p>
            <p className="font-bold">No hay niveles de contrata aún.</p>
            <p className="text-sm">Crea el primero arriba.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: CLIENTES CONTRATA
// ══════════════════════════════════════════════════════════════════════════════
function ClientesTab() {
  const {
    customers, customerTypes, posSales, contrataPayments,
    addCustomer, updateCustomer, deleteCustomer, addContrataPayment, getContrataBalance,
  } = useInventoryStore() as any;

  const contrataTypes = (customerTypes || []);
  const contrataCustomers = (customers || []).filter((c: any) => c.typeId);

  const [tab, setTab]     = useState<'lista' | 'nuevo'>('lista');
  const [selected, setSelected] = useState<any>(null);
  const [payAmt, setPayAmt]     = useState('');
  const [payMethod, setPayMethod] = useState<'cash'|'transfer'>('cash');
  const [payNote, setPayNote]   = useState('');

  // Nuevo cliente
  const [nName, setNName] = useState('');
  const [nDoc, setNDoc]   = useState('');
  const [nPhone, setNPhone] = useState('');
  const [nAddress, setNAddress] = useState('');
  const [nType, setNType] = useState('');
  const [nLimit, setNLimit] = useState('');
  const [nNotes, setNNotes] = useState('');

  const handleAddCustomer = () => {
    if (!nName.trim() || !nType) { alert('Nombre y nivel son obligatorios'); return; }
    addCustomer({ name: nName.trim(), document: nDoc.trim(), phone: nPhone.trim(), address: nAddress.trim(), typeId: nType, creditLimit: parseInt(nLimit) || 0, notes: nNotes.trim(), discountPercent: 0 });
    setNName(''); setNDoc(''); setNPhone(''); setNAddress(''); setNType(''); setNLimit(''); setNNotes('');
    setTab('lista');
  };

  const handlePay = () => {
    if (!selected || !parseFloat(payAmt)) return;
    addContrataPayment({ customerId: selected.id, customerName: selected.name, amount: parseFloat(payAmt), method: payMethod, note: payNote });
    setPayAmt(''); setPayNote('');
  };

  // Historial del cliente seleccionado
  const clientSales = selected
    ? (posSales || []).filter((s: any) => s.customerId === selected.id && s.status === 'PAID').slice(0, 30)
    : [];
  const clientPayments = selected
    ? (contrataPayments || []).filter((p: any) => p.customerId === selected.id).slice(0, 20)
    : [];
  const balance = selected ? (getContrataBalance ? getContrataBalance(selected.id) : 0) : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">

      {/* Panel izquierdo: lista o nuevo */}
      <div className="xl:col-span-1 space-y-4">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1">
          {(['lista','nuevo'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl font-black text-sm transition-all ${tab===t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
              {t === 'lista' ? '📋 Clientes' : '+ Nuevo'}
            </button>
          ))}
        </div>

        {tab === 'nuevo' ? (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-black text-gray-800">Nuevo Cliente Contrata</h3>
            {[
              { val: nName,    setVal: setNName,    placeholder: 'Nombre *', type: 'text' },
              { val: nDoc,     setVal: setNDoc,     placeholder: 'NIT / CC', type: 'text' },
              { val: nPhone,   setVal: setNPhone,   placeholder: 'Teléfono', type: 'tel' },
              { val: nAddress, setVal: setNAddress, placeholder: 'Dirección', type: 'text' },
            ].map((f, i) => (
              <input key={i} type={f.type} value={f.val} onChange={e => f.setVal(e.target.value)}
                placeholder={f.placeholder}
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-800 text-sm outline-none focus:border-yellow-400 bg-gray-50" />
            ))}
            <select value={nType} onChange={e => setNType(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-700 text-sm outline-none focus:border-yellow-400 bg-gray-50">
              <option value="" disabled>Nivel de Contrata *</option>
              {contrataTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Límite de Crédito ($)</label>
              <input type="number" value={nLimit} onChange={e => setNLimit(e.target.value)} placeholder="0"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-800 text-sm outline-none focus:border-yellow-400 bg-gray-50" />
            </div>
            <textarea value={nNotes} onChange={e => setNNotes(e.target.value)} placeholder="Observaciones..."
              rows={2} className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-800 text-sm outline-none focus:border-yellow-400 bg-gray-50 resize-none" />
            <button onClick={handleAddCustomer}
              className="w-full bg-yellow-400 text-gray-900 font-black py-3 rounded-2xl hover:bg-yellow-300 active:scale-95 transition-all">
              Registrar Cliente
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {contrataCustomers.map((c: any) => {
              const type  = contrataTypes.find((t: any) => t.id === c.typeId);
              const debt  = getContrataBalance ? getContrataBalance(c.id) : 0;
              const limit = c.creditLimit || 0;
              const overLimit = limit > 0 && debt >= limit;
              return (
                <button key={c.id} onClick={() => setSelected(c)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selected?.id === c.id ? 'border-yellow-400 bg-yellow-50' : overLimit ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${type?.color || 'bg-gray-400'} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 truncate text-sm">{c.name}</p>
                      <p className="text-xs font-bold text-gray-400">{type?.name || '—'}</p>
                    </div>
                    <DebtBadge amount={debt} />
                  </div>
                  {overLimit && (
                    <p className="text-xs font-bold text-red-500 mt-1.5 pl-11">⚠️ Límite de crédito alcanzado</p>
                  )}
                </button>
              );
            })}
            {contrataCustomers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">👥</p>
                <p className="font-bold text-sm">Sin clientes contrata.</p>
                <p className="text-xs">Créalos en la pestaña "+ Nuevo".</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel derecho: detalle del cliente */}
      <div className="xl:col-span-2">
        {!selected ? (
          <div className="h-full bg-white rounded-3xl border border-gray-100 flex flex-col items-center justify-center text-gray-400 shadow-sm">
            <p className="text-5xl mb-3">👆</p>
            <p className="font-black text-lg text-gray-500">Selecciona un cliente</p>
            <p className="text-sm">para ver su cuenta corriente e historial.</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Header del cliente */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${contrataTypes.find((t: any) => t.id === selected.typeId)?.color || 'bg-gray-400'} flex items-center justify-center text-white font-black text-2xl shadow-sm`}>
                    {selected.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-black text-gray-900 text-xl leading-tight">{selected.name}</h2>
                    <p className="text-sm font-bold text-gray-400">
                      {contrataTypes.find((t: any) => t.id === selected.typeId)?.name}
                      {selected.document ? ` · ${selected.document}` : ''}
                      {selected.phone ? ` · ${selected.phone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Saldo Pendiente</p>
                  <p className={`text-2xl font-black ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {balance > 0 ? formatMoney(balance) : 'Al día ✓'}
                  </p>
                  {(selected.creditLimit || 0) > 0 && (
                    <p className="text-xs font-bold text-gray-400 mt-0.5">Límite: {formatMoney(selected.creditLimit)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Registrar Abono */}
            {balance > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-green-100">
                <h3 className="font-black text-gray-800 mb-3">💳 Registrar Abono / Pago</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="number" placeholder="Monto del pago" value={payAmt}
                    onChange={e => setPayAmt(e.target.value)}
                    className="border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-800 text-sm outline-none focus:border-green-400 bg-gray-50" />
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value as any)}
                    className="border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-700 text-sm outline-none focus:border-green-400 bg-gray-50">
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                  <input placeholder="Nota opcional" value={payNote} onChange={e => setPayNote(e.target.value)}
                    className="border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-800 text-sm outline-none focus:border-green-400 bg-gray-50" />
                </div>
                <button onClick={handlePay}
                  className="mt-3 w-full bg-green-500 text-white font-black py-3 rounded-2xl hover:bg-green-400 active:scale-95 transition-all">
                  Registrar Pago de {payAmt ? formatMoney(parseFloat(payAmt)) : '$—'}
                </button>
              </div>
            )}

            {/* Historial */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ventas */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-black text-gray-800 mb-3 text-sm uppercase tracking-widest">Últimas Ventas</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {clientSales.length === 0 && <p className="text-gray-400 text-sm font-bold text-center py-4">Sin ventas</p>}
                  {clientSales.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{formatMoney(s.total)}</p>
                        <p className="text-xs text-gray-400">{new Date(s.timestamp).toLocaleDateString('es-CO')}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        s.contrataPaymentMethod === 'credit' ? 'bg-red-100 text-red-600' :
                        s.paymentMethod === 'EFECTIVO' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {s.contrataPaymentMethod === 'credit' ? 'Crédito' : s.paymentMethod}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagos */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-black text-gray-800 mb-3 text-sm uppercase tracking-widest">Pagos / Abonos</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {clientPayments.length === 0 && <p className="text-gray-400 text-sm font-bold text-center py-4">Sin pagos</p>}
                  {clientPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-green-50 rounded-xl">
                      <div>
                        <p className="font-black text-green-700 text-sm">+{formatMoney(p.amount)}</p>
                        <p className="text-xs text-gray-400">{new Date(p.date).toLocaleDateString('es-CO')}</p>
                        {p.note && <p className="text-xs text-gray-400 italic">{p.note}</p>}
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-green-100 text-green-600">
                        {p.method === 'cash' ? 'Efectivo' : 'Transfer'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export function AdminContratasTab() {
  const [activeTab, setActiveTab] = useState<'niveles' | 'clientes'>('clientes');

  return (
    <div className="p-4 flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-black text-gray-800">Gestión de Contratas</h2>
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          {([['clientes','👥 Clientes'],['niveles','🏷️ Niveles']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-5 py-2 rounded-xl font-black text-sm transition-all ${activeTab===id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'niveles' ? <NivelesTab /> : <ClientesTab />}
    </div>
  );
}
