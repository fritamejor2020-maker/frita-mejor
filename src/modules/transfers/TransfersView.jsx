import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransferStore, TRANSFER_STATUS, TRANSFER_ITEM_TYPES } from '../../store/useTransferStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useBranchStore } from '../../store/useBranchStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = TRANSFER_STATUS[status] || TRANSFER_STATUS.SOLICITADO;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts));
}

// ─── Formulario de nueva solicitud ────────────────────────────────────────────
function NewTransferForm({ userBranchId, isAdmin, allBranches, onSave, onCancel }) {
  const inventory = useInventoryStore(s => s.inventory);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId,   setToBranchId]   = useState(userBranchId || '');
  const [category, setCategory] = useState('fritos');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  // Solo mostrar tipos de traslado habilitados para la sede destino
  const effectiveToBranchId = userBranchId || toBranchId;
  const myBranch = allBranches.find(b => b.id === effectiveToBranchId);
  const allowedTypes = myBranch?.settings?.allowedTransferTypes ?? ['fritos', 'crudos', 'insumos', 'productos'];
  const visibleTransferTypes = Object.fromEntries(
    Object.entries(TRANSFER_ITEM_TYPES).filter(([key]) => allowedTypes.includes(key))
  );

  const activeBranches  = allBranches.filter(b => b.active !== false);
  const sourceBranches  = activeBranches.filter(b => b.id !== effectiveToBranchId);
  const destBranches    = activeBranches.filter(b => b.id !== fromBranchId);

  const handleSave = () => {
    const resolvedTo = userBranchId || toBranchId;
    if (!fromBranchId)  { alert('Selecciona la sede de origen'); return; }
    if (!resolvedTo)    { alert('Selecciona la sede destino'); return; }
    if (!items.length)  { alert('Agrega al menos un ítem'); return; }
    onSave({ fromBranchId, toBranchId: resolvedTo, category, items, notes });
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-orange-300 p-5 space-y-4 animate-fade-in">
      <h3 className="font-black text-gray-900 text-lg">📋 Nueva Solicitud de Traslado</h3>

      {/* Sede destino (solo Admin) */}
      {isAdmin && !userBranchId && (
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Sede destino (quien recibe)</label>
          <select
            className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none"
            value={toBranchId}
            onChange={e => { setToBranchId(e.target.value); setItems([]); }}
          >
            <option value="">— Elegir sede destino —</option>
            {destBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Origen */}
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Solicitar a (sede origen)</label>
        <select
          className="w-full border-2 border-gray-100 focus:border-orange-400 rounded-xl px-3 py-2.5 font-bold text-gray-800 outline-none"
          value={fromBranchId}
          onChange={e => setFromBranchId(e.target.value)}
        >
          <option value="">— Elegir sede —</option>
          {sourceBranches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Tipo de traslado */}
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Tipo de mercancía</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(visibleTransferTypes).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setCategory(key); setItems([]); }}
              className={`px-3 py-2 rounded-xl font-black text-sm flex items-center gap-1.5 transition-all border-2 ${
                category === key
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-100 text-gray-600 hover:border-orange-300'
              }`}
            >
              {val.icon} {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de ítems */}
      <ItemSelector
        inventory={inventory}
        category={category}
        items={items}
        setItems={setItems}
      />

      {/* Ítems agregados */}
      {items.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Cantidades solicitadas</label>
          {items.map(item => (
            <div key={item.inventoryId} className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2">
              <span className="flex-1 font-bold text-gray-800 text-sm">{item.name}</span>
              <input
                type="number"
                min="1"
                className="w-20 border border-orange-200 rounded-lg px-2 py-1 text-center font-black text-sm outline-none focus:border-orange-400"
                value={item.qty}
                onChange={e => setItems(prev => prev.map(i => i.inventoryId === item.inventoryId ? { ...i, qty: Number(e.target.value) } : i))}
              />
              <span className="text-xs text-gray-500 font-bold">{item.unit}</span>
              <button onClick={() => setItems(prev => prev.filter(i => i.inventoryId !== item.inventoryId))} className="text-red-400 hover:text-red-600 font-black ml-1">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Observaciones (opcional)</label>
        <textarea
          className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-orange-400 resize-none"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Urgente para turno de la tarde..."
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 bg-orange-500 text-white font-black py-2.5 rounded-xl hover:bg-orange-600 transition-colors"
        >
          Enviar Solicitud
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border-2 border-gray-100 text-gray-500 font-bold hover:border-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Helper subcomponent for item selection
function ItemSelector({ inventory, category, items, setItems }) {
  const cat = TRANSFER_ITEM_TYPES[category];
  const availableItems = cat ? inventory.filter(i => cat.types.includes(i.type) && i.qty > 0) : [];

  const addItem = (invItem) => {
    if (items.find(i => i.inventoryId === invItem.id)) return;
    setItems(prev => [...prev, { inventoryId: invItem.id, name: invItem.name, unit: invItem.unit, qty: 1 }]);
  };

  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">
        Productos disponibles ({availableItems.length})
      </label>
      <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
        {availableItems.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">Sin ítems de este tipo</p>
        )}
        {availableItems.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => addItem(item)}
            disabled={!!items.find(i => i.inventoryId === item.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-orange-50 disabled:opacity-40 transition-colors"
          >
            <span className="flex-1 font-bold text-gray-800 text-sm">{item.name}</span>
            <span className="text-xs text-gray-400 font-bold">{item.qty} {item.unit}</span>
            <span className="text-orange-500 font-black text-lg">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tarjeta de traslado ──────────────────────────────────────────────────────
function TransferCard({ transfer, userBranchId, userRole, allBranches }) {
  const { acceptTransfer, rejectTransfer, markInTransit, confirmReceipt, cancelTransfer } = useTransferStore();
  const [showQty, setShowQty] = useState(false);
  const [actualQtys, setActualQtys] = useState({});
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const fromBranch = allBranches.find(b => b.id === transfer.fromBranchId);
  const toBranch   = allBranches.find(b => b.id === transfer.toBranchId);
  const isAdmin    = userRole === 'ADMIN' || userRole === 'MANAGER';
  const isOrigin   = userBranchId === transfer.fromBranchId;
  const isDest     = userBranchId === transfer.toBranchId;

  const handleMarkInTransit = () => {
    const items = transfer.items.map(i => ({
      inventoryId: i.inventoryId,
      qtySent: Number(actualQtys[i.inventoryId] ?? i.qtyRequested),
    }));
    markInTransit(transfer.id, items);
    setShowQty(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-gray-900 text-sm">{fromBranch?.name || transfer.fromBranchId}</span>
            <span className="text-gray-400">→</span>
            <span className="font-black text-gray-900 text-sm">{toBranch?.name || transfer.toBranchId}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={transfer.status} />
            <span className="text-xs text-gray-400 font-medium">
              {TRANSFER_ITEM_TYPES[transfer.category]?.icon} {TRANSFER_ITEM_TYPES[transfer.category]?.label}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <div className="font-bold">{transfer.id.slice(-8)}</div>
          <div>{formatDate(transfer.createdAt)}</div>
        </div>
      </div>

      {/* Solicitado por */}
      <p className="text-xs text-gray-400 font-medium">
        Solicitado por <span className="text-gray-700 font-bold">{transfer.requestedByName || transfer.requestedBy}</span>
      </p>

      {/* Ítems */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
        {transfer.items.map(item => (
          <div key={item.inventoryId} className="flex items-center justify-between text-sm">
            <span className="font-bold text-gray-800">{item.name}</span>
            <div className="flex items-center gap-2 text-gray-500 font-bold">
              <span>Pedido: {item.qtyRequested} {item.unit}</span>
              {item.qtySent != null && (
                <span className="text-green-600">· Enviado: {item.qtySent}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Notas */}
      {transfer.notes && (
        <p className="text-xs text-gray-500 italic bg-yellow-50 rounded-lg px-3 py-1.5">
          💬 {transfer.notes}
        </p>
      )}

      {/* Razón de rechazo */}
      {transfer.rejectReason && (
        <p className="text-xs text-red-500 font-bold bg-red-50 rounded-lg px-3 py-1.5">
          ❌ {transfer.rejectReason}
        </p>
      )}

      {/* Acciones según estado y rol */}
      <div className="flex flex-wrap gap-2 pt-1">

        {/* Sede origen puede ACEPTAR o RECHAZAR si está SOLICITADO */}
        {transfer.status === 'SOLICITADO' && (isOrigin || isAdmin) && (
          <>
            <button
              onClick={() => acceptTransfer(transfer.id)}
              className="px-4 py-2 bg-green-500 text-white rounded-xl font-black text-sm hover:bg-green-600 transition-colors"
            >
              ✅ Aceptar
            </button>
            {!showReject ? (
              <button
                onClick={() => setShowReject(true)}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-black text-sm hover:bg-red-200 transition-colors"
              >
                ❌ Rechazar
              </button>
            ) : (
              <div className="flex gap-2 w-full">
                <input
                  className="flex-1 border border-red-200 rounded-xl px-3 py-1.5 text-sm font-medium outline-none"
                  placeholder="Motivo del rechazo..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
                <button
                  onClick={() => { rejectTransfer(transfer.id, rejectReason); setShowReject(false); }}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-xl font-black text-sm"
                >
                  Confirmar
                </button>
              </div>
            )}
          </>
        )}

        {/* Dejador marca EN_CAMINO con cantidades reales */}
        {transfer.status === 'ACEPTADO' && (isOrigin || isAdmin) && (
          <>
            {!showQty ? (
              <button
                onClick={() => setShowQty(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl font-black text-sm hover:bg-orange-600 transition-colors"
              >
                🚛 Salir con este pedido
              </button>
            ) : (
              <div className="w-full space-y-2">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wide">Confirmar cantidades reales a enviar:</p>
                {transfer.items.map(item => (
                  <div key={item.inventoryId} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-bold text-gray-700">{item.name}</span>
                    <input
                      type="number"
                      min="0"
                      max={item.qtyRequested}
                      defaultValue={item.qtyRequested}
                      className="w-20 border border-orange-200 rounded-lg px-2 py-1 text-center font-black text-sm"
                      onChange={e => setActualQtys(prev => ({ ...prev, [item.inventoryId]: e.target.value }))}
                    />
                    <span className="text-xs text-gray-400 font-bold">{item.unit}</span>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkInTransit}
                    className="flex-1 bg-orange-500 text-white font-black py-2 rounded-xl text-sm hover:bg-orange-600"
                  >
                    🚛 Confirmar salida
                  </button>
                  <button onClick={() => setShowQty(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Sede destino confirma recepción */}
        {transfer.status === 'EN_CAMINO' && (isDest || isAdmin) && (
          <button
            onClick={() => confirmReceipt(transfer.id)}
            className="px-4 py-2 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition-colors"
          >
            📬 Confirmar recepción
          </button>
        )}

        {/* Cancelar si aún no salió */}
        {['SOLICITADO', 'ACEPTADO'].includes(transfer.status) && (isDest || isAdmin) && (
          <button
            onClick={() => cancelTransfer(transfer.id)}
            className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl font-black text-sm hover:border-gray-300 transition-colors"
          >
            🚫 Cancelar
          </button>
        )}
      </div>

      {/* Timeline bottom */}
      {(transfer.acceptedAt || transfer.sentAt || transfer.receivedAt) && (
        <div className="flex items-center gap-3 pt-1 flex-wrap text-xs text-gray-400 font-medium">
          {transfer.acceptedAt  && <span>✅ Aceptado {formatDate(transfer.acceptedAt)}</span>}
          {transfer.sentAt      && <span>🚛 Salida {formatDate(transfer.sentAt)}</span>}
          {transfer.receivedAt  && <span>📬 Recibido {formatDate(transfer.receivedAt)}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function TransfersView() {
  const user      = useAuthStore(s => s.user);
  const transfers = useTransferStore(s => s.transfers);
  const { createTransfer } = useTransferStore();
  const allBranches = useBranchStore(s => s.branches);

  const [tab,      setTab]      = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  if (!user) return null;

  const isAdmin     = user.role === 'ADMIN' || user.role === 'MANAGER';
  const userBranchId = user.branchId;

  // Filtrar traslados según pestaña
  const filtered = useMemo(() => {
    let list = [...transfers].sort((a, b) => b.createdAt - a.createdAt);

    if (!isAdmin) {
      // Usuarios de sede solo ven sus traslados
      list = list.filter(t => t.fromBranchId === userBranchId || t.toBranchId === userBranchId);
    }

    if (tab === 'incoming')  list = list.filter(t => t.toBranchId === userBranchId);
    if (tab === 'outgoing')  list = list.filter(t => t.fromBranchId === userBranchId);
    if (tab === 'pending')   list = list.filter(t => t.status === 'SOLICITADO' && t.fromBranchId === userBranchId);
    if (tab === 'transit')   list = list.filter(t => t.status === 'EN_CAMINO');

    if (statusFilter) list = list.filter(t => t.status === statusFilter);

    return list;
  }, [transfers, tab, statusFilter, userBranchId, isAdmin]);

  const handleCreate = (data) => {
    const result = createTransfer(data);
    if (result.ok) { setShowForm(false); }
    else alert(result.error);
  };

  const TABS = [
    { key: 'all',      label: '📋 Todos' },
    { key: 'incoming', label: '📥 Entrantes' },
    { key: 'outgoing', label: '📤 Salientes' },
    ...(isAdmin ? [{ key: 'transit', label: '🚛 En camino' }] : []),
    { key: 'pending',  label: '⏳ Por despachar' },
  ];

  return (
    <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(160deg, #FFF8EE 0%, #FFF3E0 100%)' }}>

      {/* Header */}
      <div className="bg-white border-b border-orange-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-xl shadow-sm">
            🚛
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 leading-tight">Traslados</h1>
            <p className="text-xs text-gray-400 font-medium">Inter-sede · {transfers.length} registros</p>
          </div>
        </div>
        {(userBranchId || isAdmin) && (
          <button
            onClick={() => setShowForm(v => !v)}
            className={`font-black px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm ${
              showForm
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90'
            }`}
          >
            {showForm ? '✕ Cancelar' : '+ Solicitar'}
          </button>
        )}
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4">

        {/* Formulario */}
        {showForm && (userBranchId || isAdmin) && (
          <NewTransferForm
            userBranchId={userBranchId}
            isAdmin={isAdmin}
            allBranches={allBranches}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Tabs + Filtro — separados en dos filas */}
        <div className="space-y-2">
          {/* Fila 1: tabs de vista */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl font-black text-sm transition-all ${
                  tab === t.key
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Fila 2: filtro de estado — siempre visible */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 flex-shrink-0">Estado:</span>
            <select
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 outline-none bg-white focus:border-orange-400 transition-colors"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(TRANSFER_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-orange-100 flex items-center justify-center text-4xl mx-auto mb-4 shadow-sm">
              🚛
            </div>
            <p className="font-black text-gray-700 text-lg">Sin traslados</p>
            <p className="text-sm text-gray-400 font-medium mt-1">
              {(userBranchId || isAdmin) ? 'Usa "+ Solicitar" para crear el primero.' : 'Aún no hay traslados registrados.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <TransferCard
                key={t.id}
                transfer={t}
                userBranchId={userBranchId}
                userRole={user.role}
                allBranches={allBranches}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

