import React, { useState, useEffect } from 'react';
import { Toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';

// ─── Hook: tamaño de pantalla reactivo ───────────────────────────────────────
function useScreenSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

// ─── Selección de Punto ────────────────────────────────────────────────────────
function SelectFritadoPoint({ onSelect, signOut }) {
  const { productionPoints } = useInventoryStore();
  const active = productionPoints.filter((p) => p.active);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-[40px] p-8 shadow-sm mb-6">
          <div className="text-center mb-8">
            <span className="text-6xl block mb-4">🍳</span>
            <h1 className="text-3xl font-black text-chunky-dark">Línea de Fritado</h1>
            <p className="text-gray-400 font-bold mt-2">Selecciona tu puesto de fritado</p>
          </div>
          <div className="space-y-3">
            {active.map((pp) => (
              <button key={pp.id} className="w-full border-2 border-gray-100 rounded-3xl p-5 text-left hover:border-chunky-secondary hover:shadow-sm transition-all group" onClick={() => onSelect(pp)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-2xl border border-yellow-100 shrink-0">🍳</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-chunky-dark text-lg">{pp.name}</h3>
                    <p className="text-gray-400 font-bold text-sm">{pp.location}</p>
                  </div>
                  <svg className="text-gray-300 group-hover:text-chunky-secondary shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button className="w-full text-center text-gray-400 font-bold text-sm hover:text-gray-600 py-2" onClick={signOut}>← Cambiar de rol</button>
      </div>
    </div>
  );
}

// ─── Modal de Acción ───────────────────────────────────────────────────────────
function ActionModal({ config, wasteMode, onClose, onConfirm }) {
  const [qty, setQty]     = useState(config.amount ? String(config.amount) : '');
  const [mode, setMode]   = useState(config.isWasteFast || wasteMode ? 'WASTE' : 'FRY');
  const [reason, setReason] = useState('Dañado / Defectuoso');
  const handleSubmit = () => {
    const amount = parseFloat(qty);
    if (isNaN(amount) || amount <= 0) return;
    onConfirm(amount, mode, reason);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-chunky-dark mb-1">{config.isWasteFast ? 'Confirmar Merma' : 'Cantidad Manual'}</h2>
        <p className="text-gray-400 font-bold text-sm mb-5">{config.pair.frito.name}</p>
        {!config.isWasteFast && (
          <div className="flex gap-3 mb-6">
            <button className={`flex-1 py-2 rounded-full font-bold text-sm ${mode === 'FRY' ? 'bg-chunky-secondary text-white' : 'bg-gray-100 text-gray-500'}`} onClick={() => setMode('FRY')}>Fritar</button>
            <button className={`flex-1 py-2 rounded-full font-bold text-sm ${mode === 'WASTE' ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-500'}`} onClick={() => setMode('WASTE')}>Merma</button>
          </div>
        )}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cantidad en unidades</p>
        <input type="number" min="0" step="1" placeholder="0" autoFocus={!config.isWasteFast} disabled={config.isWasteFast}
          className="w-full text-5xl font-black text-center border-2 border-gray-200 rounded-2xl p-4 mb-4 outline-none focus:border-chunky-main disabled:bg-gray-50 disabled:text-gray-400"
          value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }} />
        {mode === 'WASTE' && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Motivo</p>
            <select className="w-full border-2 border-gray-200 rounded-2xl p-3 font-bold text-chunky-dark outline-none focus:border-red-400 bg-white" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Dañado / Defectuoso</option>
              <option>Quemado</option>
              <option>Masa mala / Mal estado</option>
              <option>Caída al piso</option>
              <option>Otro</option>
            </select>
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button className="flex-1 border border-gray-200 text-gray-400 font-bold py-3 rounded-full" onClick={onClose}>Cancelar</button>
          <button className={`flex-1 text-white font-bold py-3 rounded-full ${mode === 'FRY' ? 'bg-chunky-secondary' : 'bg-red-400'}`} onClick={handleSubmit}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta NORMAL de Fritado (hay espacio) ───────────────────────────────────
function FritadoCard({ pair, wasteMode, onFry, onManual }) {
  const presets = pair.presets || [10, 20, 50, 100, 200];
  const [bigPreset, ...smallPresets] = presets;
  const isDisabled = pair.crudo.qty === 0 && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : pair.crudo.qty > 0 ? 'border border-gray-100 bg-white'
    : 'border border-red-200 bg-red-50/20';

  const btnCls = wasteMode ? 'bg-red-400 hover:bg-red-500 text-white border-2 border-red-500'
    : isDisabled ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed'
    : 'bg-chunky-main hover:bg-chunky-secondary text-chunky-dark hover:text-white border-2 border-chunky-secondary shadow-sm';

  return (
    <div className={`rounded-2xl p-3 flex flex-col gap-2 h-full ${cardCls}`}>
      {/* Nombre */}
      <div className="text-center shrink-0">
        <div className="font-black text-chunky-dark text-sm leading-tight truncate">{pair.frito.name}</div>
        <div className="text-[9px] text-gray-400 font-bold truncate">Masa: {pair.crudo.name}</div>
      </div>

      {/* Crudo → Frito compacto */}
      <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-2 py-1.5 shrink-0 border border-gray-100">
        <div className="flex-1 text-center">
          <div className="text-[8px] font-black text-gray-400 uppercase">Crudo</div>
          {pair.crudo.qty === 0 && !wasteMode
            ? <div className="text-[10px] font-black text-red-500">Agotado</div>
            : <div className="font-black text-green-600 text-sm leading-none">{pair.crudo.qty}<span className="text-[8px] text-gray-400 ml-0.5">uds</span></div>
          }
        </div>
        <div className="text-gray-300 text-xs">➡️</div>
        <div className="flex-1 text-center">
          <div className="text-[8px] font-black text-yellow-600 uppercase">Fritas</div>
          <div className="font-black text-chunky-dark text-sm leading-none">{pair.frito.qty}<span className="text-[8px] text-gray-400 ml-0.5">uds</span></div>
        </div>
      </div>

      {wasteMode && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 text-center shrink-0">
          <span className="text-[9px] font-bold text-red-500">🗑️ MERMA</span>
        </div>
      )}

      {/* Botón principal */}
      <button disabled={isDisabled} onClick={() => onFry(pair, bigPreset)}
        className={`w-full rounded-xl flex-1 min-h-0 flex flex-col items-center justify-center font-black transition-all active:scale-[0.97] select-none ${btnCls}`}>
        <span className="text-2xl leading-none font-black">{bigPreset}</span>
        <span className="text-xs font-bold opacity-80">uds</span>
      </button>

      {/* Botones pequeños */}
      <div className="grid grid-cols-4 gap-1 shrink-0">
        {smallPresets.slice(0, 4).map((amount, idx) => (
          <button key={idx} disabled={isDisabled} onClick={() => onFry(pair, amount)}
            className={`rounded-lg py-1.5 flex flex-col items-center font-black transition-all active:scale-95 select-none ${btnCls}`}>
            <span className="text-xs leading-none">{amount}</span>
            <span className="text-[8px] font-bold opacity-70">uds</span>
          </button>
        ))}
      </div>

      {/* Manual */}
      <button onClick={() => onManual(pair)}
        className="w-full shrink-0 border border-dashed border-gray-300 rounded-lg py-1 flex items-center justify-center text-gray-400 font-bold text-[10px] hover:border-chunky-main hover:text-chunky-dark transition-colors">
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Tarjeta COMPACTA de Fritado (poco espacio) ────────────────────────────────
function FritadoCardCompact({ pair, wasteMode, onFry, onManual }) {
  const presets    = pair.presets || [10, 20, 50, 100, 200];
  const isDisabled = pair.crudo.qty === 0 && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : pair.crudo.qty > 0 ? 'border border-gray-100 bg-white'
    : 'border border-red-200 bg-red-50/20';

  const btnCls = wasteMode ? 'bg-red-400 text-white'
    : isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
    : 'bg-chunky-main hover:bg-chunky-secondary text-chunky-dark hover:text-white shadow-sm';

  return (
    <div className={`rounded-xl px-2 py-1.5 flex flex-col gap-1 h-full ${cardCls}`}>
      {/* Nombre + stocks en una línea */}
      <div className="flex items-center justify-between shrink-0 gap-1">
        <span className="font-black text-chunky-dark text-[11px] leading-tight truncate flex-1">{pair.frito.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[9px] font-black ${pair.crudo.qty > 0 ? 'text-green-600' : 'text-red-500'}`}>{pair.crudo.qty}</span>
          <span className="text-gray-300 text-[8px]">➡</span>
          <span className="text-[9px] font-black text-chunky-dark">{pair.frito.qty}</span>
          <span className="text-[8px] font-bold text-gray-400">uds</span>
        </div>
      </div>

      {/* 5 botones en fila */}
      <div className="grid grid-cols-5 gap-1 flex-1 min-h-0">
        {presets.slice(0, 5).map((amount, i) => (
          <button key={i} disabled={isDisabled} onClick={() => onFry(pair, amount)}
            className={`rounded-lg flex items-center justify-center font-black transition-colors select-none text-[12px] ${btnCls} ${i === 0 ? 'ring-2 ring-chunky-secondary/60' : ''}`}>
            {amount}
          </button>
        ))}
      </div>

      {/* Manual */}
      <button onClick={() => onManual(pair)}
        className="w-full shrink-0 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 font-bold text-[8px] py-0.5 hover:border-chunky-main hover:text-chunky-dark transition-colors">
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Panel Principal de Fritado ────────────────────────────────────────────────
function FritadoPanel({ productionPoint, onBack }) {
  const { inventory, fritadoRecipes, fryItem, reportWaste } = useInventoryStore();
  const signOut = useAuthStore((s) => s.signOut);
  const [toast, setToast]         = useState({ visible: false, message: '', type: 'success' });
  const [wasteMode, setWasteMode] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ visible: true, message: msg, type });

  const pairs = (fritadoRecipes || [])
    .filter((r) => !r.productionPointIds?.length || r.productionPointIds.includes(productionPoint.id))
    .map((recipe) => {
      const crudo = inventory.find((i) => i.id === recipe.crudoId) || { id: null, qty: 0, name: 'Inválido' };
      const frito = inventory.find((i) => i.id === recipe.fritoId) || { id: null, qty: 0, name: 'Inválido' };
      return { crudo, frito, presets: recipe.presets };
    })
    .filter((p) => p.crudo.id && p.frito.id);

  const count = pairs.length;
  const { width: screenWidth, height: screenHeight } = useScreenSize();

  // Misma lógica de pantalla que Producción
  const aspectRatio    = screenHeight / screenWidth;
  const isMobile       = screenWidth <= 600;
  const isVeryVertical = aspectRatio > 1.4;

  let cols, allowScroll;
  if (isVeryVertical || isMobile) {
    allowScroll = true;
    cols        = 1;
  } else {
    allowScroll = false;
    if      (count <= 2)  { cols = count || 1; }
    else if (count <= 4)  { cols = 2; }
    else if (count <= 6)  { cols = 3; }
    else if (count <= 12) { cols = 4; }
    else                   { cols = 5; }
  }
  const rows = Math.ceil(count / cols);

  const HEADER_H   = 52;
  const pad        = allowScroll ? 8 : 6;
  const gap        = allowScroll ? 10 : 6;
  const availableH = screenHeight - HEADER_H - 2 * pad - (rows - 1) * gap;
  const cardH      = availableH / rows;
  const compact    = !allowScroll && cardH < 140;

  const handleFry = (pair, amount) => {
    if (wasteMode) { setModalConfig({ pair, amount, isWasteFast: true }); return; }
    const result = fryItem(pair.crudo.id, pair.frito.id, amount, productionPoint.id);
    showToast(result.message, result.ok ? 'success' : 'error');
  };

  const handleModalConfirm = (amount, mode, reason) => {
    const pair = modalConfig.pair;
    if (mode === 'WASTE') {
      if (pair.crudo.id) reportWaste(pair.crudo.id, amount, `Merma en fritado: ${reason}`, productionPoint.id);
      showToast(`🗑️ Merma: -${amount} de ${pair.crudo.name} (${reason})`, 'warning');
    } else {
      const result = fryItem(pair.crudo.id, pair.frito.id, amount, productionPoint.id);
      showToast(result.message, result.ok ? 'success' : 'error');
    }
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {modalConfig && (
        <ActionModal config={modalConfig} wasteMode={wasteMode}
          onClose={() => setModalConfig(null)} onConfirm={handleModalConfirm} />
      )}

      {/* Header */}
      <header style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1f2937', lineHeight: 1 }}>🍳 {productionPoint.name}</div>
            <div style={{ fontWeight: 700, fontSize: 10, color: '#9ca3af' }}>Panel de Fritado · Operario</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setWasteMode(!wasteMode)}
            style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20, border: wasteMode ? '1px solid #fca5a5' : '1px solid #e5e7eb', background: wasteMode ? '#fee2e2' : 'white', color: wasteMode ? '#dc2626' : '#6b7280', cursor: 'pointer' }}>
            {wasteMode ? '⚠️ SALIR MERMA' : '🗑️ MERMA'}
          </button>
          <button onClick={signOut} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        </div>
      </header>

      {wasteMode && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '3px 16px', textAlign: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 11, color: '#dc2626' }}>⚠️ MODO MERMA — Descuenta del inventario CRUDO</span>
        </div>
      )}

      {/* Grid de tarjetas */}
      <div style={{ flex: 1, overflow: allowScroll ? 'auto' : 'hidden', padding: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: count <= 4 && !isMobile ? 'center' : 'flex-start' }}>
        {pairs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 40 }}>🧊</span>
            <p style={{ fontWeight: 900, fontSize: 18, color: '#1f2937', marginTop: 12 }}>No hay crudos vinculados</p>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#9ca3af' }}>Configura recetas de fritado en el panel Admin.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: (isVeryVertical || isMobile) ? '1fr' : `repeat(${cols}, minmax(0, ${compact ? '1fr' : '300px'}))`,
            gridTemplateRows: !allowScroll && count > 4 ? `repeat(${rows}, minmax(0, 1fr))` : 'auto',
            gap,
            width: '100%',
            maxWidth: (!isVeryVertical && !isMobile && count <= 4) ? cols * 300 + (cols - 1) * gap : '100%',
            height: !allowScroll && count > 4 ? '100%' : 'auto',
          }}>
            {pairs.map((pair, i) =>
              compact ? (
                <FritadoCardCompact key={i} pair={pair} wasteMode={wasteMode} onFry={handleFry} onManual={(p) => setModalConfig({ pair: p })} />
              ) : (
                <FritadoCard key={i} pair={pair} wasteMode={wasteMode} onFry={handleFry} onManual={(p) => setModalConfig({ pair: p })} />
              )
            )}
          </div>
        )}
      </div>

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────
export function FritadoView() {
  const signOut = useAuthStore((s) => s.signOut);
  const [selectedPoint, setSelectedPoint] = useState(null);
  if (!selectedPoint) return <SelectFritadoPoint onSelect={setSelectedPoint} signOut={signOut} />;
  return <FritadoPanel productionPoint={selectedPoint} onBack={() => setSelectedPoint(null)} />;
}
