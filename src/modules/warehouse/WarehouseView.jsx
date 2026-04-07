import React, { useState, useRef } from 'react';
import { BarcodeScanner } from '../../components/ui/BarcodeScanner';
import { Toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';

// ─── Pantalla de Selección de Bodega ──────────────────────────────────────────
function SelectWarehouse({ onSelect, signOut }) {
  const { warehouses, inventory } = useInventoryStore();
  const active = warehouses.filter((w) => w.active);

  const getStats = (wid) => {
    const items = inventory.filter((i) => i.warehouseId === wid);
    const low   = items.filter((i) => i.qty <= i.alert).length;
    return { total: items.length, low };
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-[32px] sm:rounded-[40px] p-5 sm:p-8 shadow-sm mb-4 sm:mb-6">
          <div className="text-center mb-5 sm:mb-8">
            <img src="/logo.png" alt="Frita Mejor" className="w-28 sm:w-40 mx-auto object-contain mb-4" />
            <h1 className="text-2xl sm:text-3xl font-black text-chunky-dark">Selecciona Bodega</h1>
            <p className="text-gray-400 font-bold mt-2 text-sm">¿Desde dónde vas a trabajar?</p>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {active.map((w) => {
              const { total, low } = getStats(w.id);
              return (
                <button key={w.id}
                  className="w-full border-2 border-gray-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-left hover:border-chunky-secondary hover:shadow-sm transition-all active:scale-[0.98] group"
                  onClick={() => onSelect(w)}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl border border-blue-100 shrink-0">📦</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-chunky-dark text-base sm:text-lg leading-tight">{w.name}</h3>
                      <p className="text-gray-400 font-bold text-xs sm:text-sm mt-0.5">{w.location}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs font-bold bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">{total} ítems</span>
                        {low > 0 && <span className="text-xs font-bold bg-red-50 text-red-400 px-2 py-0.5 rounded-full">⚠️ {low} bajo stock</span>}
                      </div>
                    </div>
                    <svg className="text-gray-300 group-hover:text-chunky-secondary shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <button className="w-full text-center text-gray-400 font-bold text-sm hover:text-gray-600 py-2" onClick={signOut}>
          ← Cambiar de rol
        </button>
      </div>
    </div>
  );
}

// ─── MODO POS: Despacho tipo carrito ─────────────────────────────────────────
function PosDispatch({ warehouse }) {
  const { inventory, warehouses, dispatchItem, transferItem, movements } = useInventoryStore();
  const [cart, setCart]           = useState([]); // [{ item, qty }]
  const [showScanner, setShowScanner] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchData, setDispatchData] = useState({ person: '', reason: '' });
  const [toast, setToast]         = useState({ visible: false, message: '', type: 'success' });
  const [confirmed, setConfirmed] = useState(false);
  const [dispatchedCount, setDispatchedCount] = useState(0);
  const inputRefs = useRef({});
  const barcodeInputRef = useRef(null);
  const [barcodeVal, setBarcodeVal] = useState('');

  // Volver a enfocar el campo invisible tras cualquier acción
  const refocusBarcode = () => {
    setTimeout(() => {
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        barcodeInputRef.current?.focus();
      }
    }, 150);
  };

  // El lector escribe el código y envía Enter
  const handleBarcodeKey = (e) => {
    if (e.key === 'Enter') {
      const code = barcodeVal.trim();
      setBarcodeVal('');
      if (code) handleScan(code);
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  };

  const warehouseItems = inventory.filter((i) => i.warehouseId === warehouse.id);
  const showToast = (msg, type = 'success') => setToast({ visible: true, message: msg, type });

  // Al escanear o buscar un código
  const handleScan = (code) => {
    setShowScanner(false);
    const found = warehouseItems.find(
      (i) => i.id === code || i.barcode === code ||
             i.name.toLowerCase().includes(code.toLowerCase())
    );
    if (!found) {
      showToast(`⚠️ No se encontró: "${code}"`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === found.id);
      if (existing) {
        showToast(`+1 a ${found.name}`, 'success');
        return prev.map((c) => c.item.id === found.id ? { ...c, qty: c.qty + 1 } : c);
      }
      showToast(`✅ Agregado: ${found.name}`, 'success');
      return [...prev, { item: found, qty: 1 }];
    });
  };

  const updateQty = (itemId, val) => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return;
    setCart((prev) => prev.map((c) => c.item.id === itemId ? { ...c, qty: n } : c));
  };

  const removeFromCart = (itemId) => setCart((prev) => prev.filter((c) => c.item.id !== itemId));

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);

  const handleConfirm = () => {
    let hasError = false;
    cart.forEach(({ item, qty }) => {
      if (qty <= 0) return;
      const result = dispatchItem(item.id, qty, warehouse.id, dispatchData.reason, dispatchData.person);
      if (!result.ok) { showToast(result.message, 'error'); hasError = true; }
    });
    if (!hasError) {
      setShowDispatchModal(false);
      setDispatchedCount(cart.length);   // guardar cantidad antes de limpiar
      setConfirmed(true);
      setTimeout(() => { setCart([]); setConfirmed(false); setDispatchedCount(0); setDispatchData({ person: '', reason: '' }); }, 2500);
    }
  };

  const handleTransfer = () => {
    if (!transferTarget) { showToast('Selecciona una bodega destino', 'error'); return; }
    let hasError = false;
    cart.forEach(({ item, qty }) => {
      if (qty <= 0) return;
      const result = transferItem(item.id, qty, warehouse.id, transferTarget);
      if (!result.ok) { showToast(result.message, 'error'); hasError = true; }
    });
    if (!hasError) {
      setDispatchedCount(cart.length);
      setShowTransferModal(false);
      setConfirmed(true);
      setTimeout(() => { setCart([]); setConfirmed(false); setDispatchedCount(0); setTransferTarget(''); }, 2500);
    }
  };

  const recentDispatches = movements.filter((m) => m.type === 'DESPACHO' && m.warehouseId === warehouse.id).slice(0, 4);

  // Barra unificada: escaneo + búsqueda con dropdown
  const searchResults = barcodeVal.length > 1
    ? warehouseItems.filter((i) =>
        i.name.toLowerCase().includes(barcodeVal.toLowerCase()) ||
        (i.barcode && i.barcode.toLowerCase().includes(barcodeVal.toLowerCase())) ||
        i.id.toLowerCase().includes(barcodeVal.toLowerCase())
      ).slice(0, 5)
    : [];

  const BarcodeBar = () => (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1">
        {/* Icono de lector */}
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5v14"/><path d="M7 5v14"/><path d="M11 5v14"/><path d="M15 5v14"/><path d="M19 5v14"/>
        </svg>
        <input
          ref={barcodeInputRef}
          type="text"
          value={barcodeVal}
          onChange={(e) => setBarcodeVal(e.target.value)}
          onKeyDown={handleBarcodeKey}
          autoFocus
          placeholder="Escanea o escribe el nombre..."
          className="w-full pl-9 pr-4 h-12 bg-white border-2 border-chunky-main rounded-2xl text-sm font-bold text-chunky-dark outline-none focus:border-chunky-secondary placeholder:text-gray-300"
        />
        {/* Dropdown de resultados */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-10">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setBarcodeVal('');
                  handleScan(item.name);
                  setTimeout(() => barcodeInputRef.current?.focus(), 100);
                }}
              >
                <span className="font-bold text-chunky-dark">{item.name}</span>
                <span className="text-gray-400 font-bold text-sm">{item.qty} {item.unit}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="w-12 h-12 rounded-2xl bg-white border-2 border-gray-200 text-chunky-dark flex items-center justify-center hover:bg-yellow-50 active:scale-95 transition-all shadow-sm shrink-0"
        onMouseDown={(e) => { e.preventDefault(); setShowScanner(true); }}
        title="Usar cámara"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* BarcodeScanner (cámara opcional) */}
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => { setShowScanner(false); setTimeout(() => barcodeInputRef.current?.focus(), 100); }} />}

      {/* Pantalla de Éxito */}
      {confirmed && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-green-400" style={{ animation: 'fadeIn 0.2s ease' }}>
          <span className="text-6xl sm:text-8xl mb-4 sm:mb-6">✅</span>
          <h2 className="text-2xl sm:text-4xl font-black text-white text-center px-4">¡Movimiento Registrado!</h2>
          <p className="text-white/80 font-bold mt-2 text-center">{dispatchedCount} ítem(s) procesados</p>
        </div>
      )}

      {/* Modal Transferencia */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl sm:text-2xl font-black text-chunky-dark mb-1">Transferir a</h2>
            <p className="text-gray-400 font-bold text-sm mb-5">Selecciona la bodega destino</p>

            <select 
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-chunky-dark mb-6 focus:border-chunky-secondary outline-none"
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
            >
              <option value="">Seleccionar bodega...</option>
              {warehouses.filter(w => w.id !== warehouse.id && w.active).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button className="flex-1 font-bold text-gray-400 py-3 rounded-full hover:bg-gray-50" onClick={() => setShowTransferModal(false)}>Cancelar</button>
              <button 
                className="flex-1 font-black bg-purple-500 text-white rounded-full py-3 hover:bg-purple-600 disabled:opacity-50"
                disabled={!transferTarget}
                onClick={handleTransfer}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Despacho (con detalles opcionales) */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDispatchModal(false)}>
          <div className="bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 w-full max-w-sm shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-chunky-dark mb-1">Detalles de Despacho</h2>
              <p className="text-gray-400 font-bold text-sm">Ambos campos son opcionales.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Persona que retira</label>
              <input 
                autoFocus
                placeholder="Ej. Juan Pérez"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" 
                value={dispatchData.person} 
                onChange={(e) => setDispatchData(d => ({ ...d, person: e.target.value }))} 
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Uso / Destino</label>
              <textarea 
                placeholder="Ej. Para el evento del sábado..."
                rows={2}
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main resize-none" 
                value={dispatchData.reason} 
                onChange={(e) => setDispatchData(d => ({ ...d, reason: e.target.value }))} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirm(); } }}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button className="flex-1 border-2 border-gray-200 text-gray-400 font-bold py-3 rounded-full hover:bg-gray-50 transition-colors" onClick={() => setShowDispatchModal(false)}>Cancelar</button>
              <button className="flex-[1.5] bg-chunky-primary text-white font-black py-3 rounded-full hover:bg-red-500 transition-colors" onClick={handleConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {cart.length === 0 ? (
        /* ── Estado vacío: pantalla de escaneo ── */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-black text-chunky-dark mb-1">Listo para despachar</h2>
          <p className="text-gray-400 font-bold text-sm mb-6">Usa el lector de barras o la cámara</p>

          {/* Barra unificada: escaneo + nombre */}
          <div className="w-full max-w-sm mb-6">
            {BarcodeBar()}
          </div>

          {recentDispatches.length > 0 && (
            <div className="mt-8 w-full max-w-sm text-left px-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Último despacho</p>
              {recentDispatches.map((mv) => {
                const it = inventory.find((i) => i.id === mv.inventoryId);
                return (
                  <div key={mv.id} className="py-2 border-b border-gray-200/50 last:border-0">
                    <div className="flex justify-between text-sm text-chunky-dark font-bold">
                      <span>{it?.name ?? '—'}</span>
                      <span className="text-red-500">-{mv.qty} {it?.unit}</span>
                    </div>
                    {(mv.person || mv.reason) && (
                      <p className="text-[11px] font-bold text-gray-400 mt-0.5 leading-tight">
                        {mv.person ? `👤 ${mv.person}` : ''} {mv.reason ? `📝 ${mv.reason}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Carrito con ítems ── */
        <div className="flex-1 flex flex-col">
          {/* Barra de código de barras visible */}
          <div className="px-4 pt-3 shrink-0">
            {BarcodeBar()}
          </div>

          {/* Lista de ítems */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.map(({ item, qty }) => {
              const isOver = qty > item.qty;
              return (
                <div key={item.id} className={`flex items-center gap-3 border rounded-2xl p-3 transition-colors ${isOver ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-chunky-dark text-base leading-tight truncate">{item.name}</p>
                    <p className={`text-xs font-bold mt-0.5 ${isOver ? 'text-red-400' : 'text-gray-400'}`}>
                      {isOver ? `⚠️ Solo hay ${item.qty} ${item.unit}` : `Disponible: ${item.qty} ${item.unit}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="w-8 h-8 rounded-full bg-gray-100 font-black text-chunky-dark hover:bg-gray-200 active:scale-95 transition-all text-lg flex items-center justify-center"
                      onClick={() => qty <= 1 ? removeFromCart(item.id) : updateQty(item.id, qty - 1)}>−</button>
                    <input
                      ref={(el) => inputRefs.current[item.id] = el}
                      type="number" min="0" step="0.5"
                      className="w-16 text-center font-black text-chunky-dark text-lg border-2 border-gray-200 rounded-xl py-1 outline-none focus:border-chunky-main"
                      value={qty}
                      onChange={(e) => updateQty(item.id, e.target.value)}
                      onBlur={refocusBarcode}
                    />
                    <button className="w-8 h-8 rounded-full bg-gray-100 font-black text-chunky-dark hover:bg-gray-200 active:scale-95 transition-all text-lg flex items-center justify-center"
                      onClick={() => updateQty(item.id, qty + 1)}>+</button>
                    <span className="text-xs text-gray-400 font-bold w-6 shrink-0">{item.unit}</span>
                    <button className="w-8 h-8 rounded-full text-gray-200 hover:text-red-400 hover:bg-red-50 transition-all flex items-center justify-center"
                      onClick={() => removeFromCart(item.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>


          {/* Footer: total y confirmar */}
          <div className="bg-white border-t border-gray-100 p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400 font-bold text-sm">{cart.length} producto(s)</span>
              <span className="text-chunky-dark font-black text-lg">{totalItems.toFixed(1)} unidades total</span>
            </div>
            <div className="flex gap-2">
              <button className="w-12 h-12 rounded-2xl border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0" onClick={() => setCart([])}>🗑️</button>
              <button
                className="flex-1 bg-purple-500 text-white font-black text-sm md:text-base rounded-2xl py-3 shadow-sm hover:bg-purple-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                onClick={() => setShowTransferModal(true)}
                disabled={cart.some((c) => c.qty > c.item.qty) || cart.every((c) => c.qty <= 0)}
              >
                🔄 TRANSFERIR
              </button>
              <button
                className="flex-[1.5] bg-chunky-primary text-white font-black text-sm md:text-base rounded-2xl py-3 shadow-md hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                onClick={() => setShowDispatchModal(true)}
                disabled={cart.some((c) => c.qty > c.item.qty) || cart.every((c) => c.qty <= 0)}
              >
                📤 DESPACHAR
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

// ─── Modal para Agregar Insumo (Bodeguero) ───────────────────────────────────
function AddInsumoModal({ warehouseId, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', unit: 'kg', alert: 5, barcode: '' });
  
  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, qty: 0, type: 'INSUMO', warehouseId });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-chunky-dark mb-1">Nuevo Insumo</h2>
        <p className="text-gray-400 font-bold text-sm mb-5">Agrega un insumo inicial a la bodega. No se permite crear productos aquí.</p>
        
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre del Insumo</label>
          <input autoFocus className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} />
        </div>
        
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Unidad</label>
            <select className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={form.unit} onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}>
              {['kg', 'g', 'L', 'mL', 'm', 'unidades', 'piezas'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Alerta en</label>
            <input type="number" min="0" step="1" className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={form.alert} onChange={(e) => setForm(f => ({ ...f, alert: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Cód. Barras (Opcional)</label>
          <input className="w-full bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-bold outline-none focus:border-chunky-main" value={form.barcode} onChange={(e) => setForm(f => ({ ...f, barcode: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} />
        </div>

        <div className="flex gap-3 mt-6">
          <button className="flex-1 border-2 border-gray-200 text-gray-400 font-bold py-3 rounded-full hover:bg-gray-50 transition-colors" onClick={onClose}>Cancelar</button>
          <button className="flex-1 bg-chunky-secondary text-white font-bold py-3 rounded-full hover:opacity-90 transition-opacity" onClick={handleSave}>Guardar Insumo</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODO RECEPCIÓN (carrito manual) ─────────────────────────────────────────
function ReceiveMode({ warehouse }) {
  const { inventory, receiveItem, addInventoryItem } = useInventoryStore();
  const [cart, setCart]             = useState([]); // [{ item, qty: string }]
  const [search, setSearch]         = useState('');
  const [toast, setToast]           = useState({ visible: false, message: '', type: 'success' });
  const [confirmed, setConfirmed]   = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const searchRef = useRef(null);

  const allItems  = inventory.filter((i) => i.warehouseId === warehouse.id);
  const showToast = (msg, type = 'success') => setToast({ visible: true, message: msg, type });

  // Dropdown: artículos que NO están ya en el carrito
  const cartIds   = new Set(cart.map((c) => c.item.id));
  const dropItems = search.length > 0
    ? allItems.filter((i) =>
        !cartIds.has(i.id) && (
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          (i.barcode && i.barcode.toLowerCase().includes(search.toLowerCase()))
        )
      ).slice(0, 6)
    : [];

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        showToast(`+1 a ${item.name}`, 'success');
        return prev.map((c) => c.item.id === item.id ? { ...c, qty: String((parseFloat(c.qty) || 0) + 1) } : c);
      }
      showToast(`✅ ${item.name} agregado`, 'success');
      return [...prev, { item, qty: '1' }];
    });
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const updateQty = (id, val) =>
    setCart((prev) => prev.map((c) => c.item.id === id ? { ...c, qty: val } : c));

  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((c) => c.item.id !== id));

  const handleScan = (code) => {
    setShowScanner(false);
    const found = allItems.find(
      (i) => i.id === code || i.barcode === code || i.name.toLowerCase().includes(code.toLowerCase())
    );
    if (!found) { showToast(`⚠️ No encontrado: "${code}"`, 'error'); return; }
    addToCart(found);
  };

  const handleConfirm = () => {
    const valid = cart.filter((c) => parseFloat(c.qty) > 0);
    if (valid.length === 0) return;
    valid.forEach(({ item, qty }) => receiveItem(item.id, parseFloat(qty), warehouse.id));
    setConfirmedCount(valid.length);
    setCart([]);
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      
      {showAddModal && (
        <AddInsumoModal
          warehouseId={warehouse.id}
          onClose={() => setShowAddModal(false)}
          onSave={(newItem) => {
            addInventoryItem(newItem);
            showToast(`✅ Insumo "${newItem.name}" creado. Búscalo para agregarlo.`, 'success');
            setShowAddModal(false);
          }}
        />
      )}

      {confirmed && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-chunky-secondary" style={{ animation: 'fadeIn 0.2s ease' }}>
          <span className="text-8xl mb-6">📥</span>
          <h2 className="text-4xl font-black text-white">¡Recepción Registrada!</h2>
          <p className="text-white/80 font-bold mt-2">{confirmedCount} producto(s) ingresados</p>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="px-4 pt-3 pb-2 shrink-0 flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            ref={searchRef}
            autoFocus
            type="text"
            placeholder="Busca un artículo para agregar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                if (dropItems.length > 0) addToCart(dropItems[0]);
                else handleScan(search.trim());
              }
            }}
            className="w-full pl-9 pr-4 h-12 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-chunky-secondary placeholder:text-gray-300"
          />
          {dropItems.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-20">
              {dropItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full flex justify-between items-center px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 text-left transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); addToCart(item); }}
                >
                  <span className="font-bold text-chunky-dark">{item.name}</span>
                  <span className="text-gray-400 font-bold text-sm">{item.qty} {item.unit} en bodega</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="w-12 h-12 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-yellow-50 shrink-0 text-gray-500 transition-colors"
          onClick={() => setShowScanner(true)}
          title="Escanear"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
        </button>
        <button
          className="w-12 h-12 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center text-xl hover:bg-blue-50 shrink-0 text-blue-500 font-black"
          onClick={() => setShowAddModal(true)}
          title="Crear Nuevo Insumo"
        >+</button>
      </div>

      {/* Lista del carrito */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-10">
            <span className="text-6xl mb-4 opacity-60">📦</span>
            <p className="font-black text-chunky-dark text-lg">Sin artículos aún</p>
            <p className="text-gray-600 font-bold text-sm mt-1">Busca o escanea para agregar</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_130px_32px] gap-2 pl-4 pr-2 pb-1 text-xs font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
              <span>Artículo</span>
              <span className="text-center">Cantidad</span>
              <span />
            </div>
            <div className="space-y-1.5">
              {cart.map(({ item, qty }) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_130px_32px] gap-2 items-center pl-4 pr-2 py-2.5 rounded-[20px] bg-green-50 border border-green-200 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-black text-chunky-dark text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 font-bold">Stock actual: {item.qty} {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1 justify-center">
                    <button
                      className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-500 font-black text-base flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all shrink-0"
                      onClick={() => {
                        const n = Math.max(0, (parseFloat(qty) || 0) - 1);
                        if (n === 0) removeFromCart(item.id);
                        else updateQty(item.id, String(n));
                      }}
                    >−</button>
                    <input
                      type="number" min="0" step="0.5"
                      value={qty}
                      onChange={(e) => updateQty(item.id, e.target.value)}
                      className="w-14 text-center font-black text-base border-2 border-green-300 text-green-700 bg-white rounded-xl py-1 outline-none focus:border-chunky-secondary"
                    />
                    <button
                      className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-500 font-black text-base flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all shrink-0"
                      onClick={() => updateQty(item.id, String((parseFloat(qty) || 0) + 1))}
                    >+</button>
                    <span className="text-xs text-gray-400 font-bold w-6 shrink-0">{item.unit}</span>
                  </div>
                  <button
                    className="w-7 h-7 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-all"
                    onClick={() => removeFromCart(item.id)}
                  >✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0 shadow-xl">
        {cart.length > 0 ? (
          <div className="flex gap-2">
            <button
              className="w-11 h-11 rounded-2xl border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center shrink-0"
              onClick={() => setCart([])}
            >🗑️</button>
            <button
              className="flex-1 bg-chunky-secondary text-white font-black text-base rounded-2xl py-3 shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              onClick={handleConfirm}
              disabled={cart.every((c) => !(parseFloat(c.qty) > 0))}
            >
              RECIBIR {cart.length} ARTÍCULO{cart.length > 1 ? 'S' : ''} →
            </button>
          </div>
        ) : (
          <p className="text-center text-gray-300 font-bold text-sm py-1">
            Agrega artículos para registrar la recepción
          </p>
        )}
      </div>

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

// ─── MODO INVENTARIO FÍSICO ──────────────────────────────────────────────────
function InventoryMode({ warehouse }) {
  const { inventory, adjustInventory } = useInventoryStore();
  const [counts, setCounts]   = useState({}); // { itemId: string }
  const [saved, setSaved]     = useState({});  // { itemId: true }
  const [search, setSearch]   = useState('');
  const [toast, setToast]     = useState({ visible: false, message: '', type: 'success' });
  const [filterAdj, setFilterAdj] = useState(false);

  const items = inventory.filter((i) => i.warehouseId === warehouse.id);
  const withDiff = items.map((i) => {
    const input = counts[i.id];
    const counted = input !== undefined && input !== '' ? parseFloat(input) : null;
    const diff = counted !== null && !isNaN(counted) ? +(counted - i.qty).toFixed(3) : null;
    return { ...i, counted, diff };
  });

  const displayed = withDiff
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .filter((i) => !filterAdj || i.diff !== null);

  const showToast = (msg, type) => setToast({ visible: true, message: msg, type });

  const handleAdjust = (item) => {
    if (item.counted === null || isNaN(item.counted)) return;
    adjustInventory(item.id, item.counted, item.diff, warehouse.id);
    setCounts((p) => ({ ...p, [item.id]: '' }));
    setSaved((p) => ({ ...p, [item.id]: true }));
    setTimeout(() => setSaved((p) => ({ ...p, [item.id]: false })), 2000);
    showToast(`✅ ${item.name}: ajustado a ${item.counted} ${item.unit}`, 'success');
  };

  const adjustedCount = withDiff.filter((i) => i.diff !== null).length;

  return (
    <div className="flex-1 flex flex-col p-4 gap-4">
      {/* Header */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex justify-between items-start">
        <div>
          <p className="font-black text-chunky-dark">📋 Inventario Físico</p>
          <p className="text-xs font-bold text-gray-400 mt-0.5">Ingresa el conteo real para ajustar las cantidades del sistema</p>
        </div>
        {adjustedCount > 0 && (
          <span className="bg-chunky-main text-chunky-dark text-xs font-black px-2 py-1 rounded-full shrink-0">{adjustedCount} con conteo</span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Buscar ítem..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-bold outline-none focus:border-chunky-main" />
        </div>
        <button
          className={`px-4 py-2 rounded-full font-bold text-xs transition-all border ${filterAdj ? 'bg-chunky-main border-chunky-main text-chunky-dark' : 'bg-white border-gray-200 text-gray-400'}`}
          onClick={() => setFilterAdj((p) => !p)}
        >
          Con ajuste
        </button>
      </div>

      {/* Lista de conteo */}
      <div className="space-y-2 overflow-y-auto flex-1">
        {displayed.map((item) => {
          const hasChange = item.diff !== null;
          const isPositive = item.diff > 0;
          const isSaved = saved[item.id];

          return (
            <div key={item.id} className={`border rounded-2xl p-4 bg-white transition-all
              ${hasChange && item.diff !== 0 ? (isPositive ? 'border-green-200' : 'border-orange-200') : 'border-gray-100'}
              ${isSaved ? 'border-green-300 bg-green-50/30' : ''}
            `}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-chunky-dark truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-gray-400">Sistema:</span>
                    <span className={`font-black ${item.qty <= item.alert ? 'text-red-500' : 'text-chunky-dark'}`}>{item.qty} {item.unit}</span>
                    {hasChange && item.diff !== 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                        {isPositive ? '+' : ''}{item.diff} {item.unit}
                      </span>
                    )}
                    {hasChange && item.diff === 0 && (
                      <span className="text-xs font-bold text-green-500">✓ Coincide</span>
                    )}
                    {isSaved && <span className="text-xs font-bold text-green-500">✅ Guardado</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.5"
                      placeholder="?"
                      className={`w-20 text-center font-black text-lg border-2 rounded-xl py-2 outline-none transition-colors
                        ${hasChange && item.diff !== 0 ? (isPositive ? 'border-green-300 text-green-700' : 'border-orange-300 text-orange-600') : 'border-gray-200 text-chunky-dark focus:border-chunky-main'}`}
                      value={counts[item.id] ?? ''}
                      onChange={(e) => setCounts((p) => ({ ...p, [item.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAdjust(item); }}
                    />
                    <span className="absolute -bottom-4 left-0 right-0 text-center text-xs text-gray-300 font-bold">{item.unit}</span>
                  </div>
                  <button
                    className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center transition-all
                      ${hasChange && item.diff !== 0
                        ? 'bg-chunky-primary text-white hover:opacity-90 shadow-sm'
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                    onClick={() => handleAdjust(item)}
                    disabled={!hasChange || item.diff === 0}
                    title="Aplicar ajuste"
                  >
                    ✓
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

// ─── Panel Principal de Bodega ────────────────────────────────────────────────
const TABS = [
  { id: 'DESPACHO',   label: '📤 Despacho',   color: 'bg-chunky-primary text-white' },
  { id: 'RECEPCION',  label: '📥 Recepción',  color: 'bg-chunky-secondary text-white' },
  { id: 'INVENTARIO', label: '📋 Inventario', color: 'bg-yellow-400 text-chunky-dark' },
];

function WarehousePanel({ warehouse, onBack }) {
  const signOut = useAuthStore((s) => s.signOut);
  const [activeTab, setActiveTab] = useState('DESPACHO');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400" onClick={onBack}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-base font-black text-chunky-dark leading-none">{warehouse.name}</h1>
            <p className="text-xs font-bold text-gray-400">{warehouse.location}</p>
          </div>
        </div>
        <button className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50" onClick={signOut}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 pb-3 pt-1 shrink-0">
        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all
                ${activeTab === tab.id ? tab.color + ' shadow-sm' : 'text-gray-500 hover:bg-white/60'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'DESPACHO'   && <PosDispatch warehouse={warehouse} />}
        {activeTab === 'RECEPCION'  && <ReceiveMode warehouse={warehouse} />}
        {activeTab === 'INVENTARIO' && <InventoryMode warehouse={warehouse} />}
      </div>
    </div>
  );
}

// ─── Exportación Principal ────────────────────────────────────────────────────
export function WarehouseView() {
  const signOut = useAuthStore((s) => s.signOut);
  const [selected, setSelected] = useState(null);

  if (!selected) return <SelectWarehouse onSelect={setSelected} signOut={signOut} />;
  return <WarehousePanel warehouse={selected} onBack={() => setSelected(null)} />;
}
