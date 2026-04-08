import React, { useState, useEffect } from 'react';
import { Toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';

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
              <option>Dañado / Defectuoso</option><option>Quemado</option><option>Masa mala / Mal estado</option><option>Caída al piso</option><option>Otro</option>
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

// ─── Tarjeta PÍLDORA Fritado: móvil (sm) y tablet (md) ────────────────────────
function FritadoCardMobile({ pair, wasteMode, onFry, onManual, size = 'sm' }) {
  const presets    = pair.presets || [10, 20, 50, 100, 200];
  const isDisabled = pair.crudo.qty === 0 && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/10'
    : pair.crudo.qty > 0 ? 'border border-gray-200 bg-white'
    : 'border border-red-200 bg-red-50/10';

  const circleCls = isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
    : wasteMode ? 'bg-red-100 text-red-700 active:scale-95'
    : 'bg-chunky-main text-chunky-dark active:scale-90 shadow-sm';

  const nameW   = size === 'md' ? 120 : 90;
  const circleD = size === 'md' ? 46  : 38;
  const manualD = size === 'md' ? 36  : 30;
  const nameSz  = size === 'md' ? 14  : 13;
  const stockSz = size === 'md' ? 11  : 10;
  const btnSz   = size === 'md' ? 14  : 12;
  const maxCircles = size === 'md' ? 4 : 5;

  return (
    <div className={`rounded-2xl px-3 py-3 flex items-center gap-2 ${cardCls}`}
         style={{ overflow: 'hidden', minWidth: 0 }}>
      {/* Info */}
      <div style={{ minWidth: 0, width: nameW, flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: nameSz, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1f2937' }}>{pair.frito.name}</div>
        <div className="flex items-center gap-0.5 mt-0.5">
          <span style={{ fontWeight: 900, fontSize: stockSz, color: pair.crudo.qty > 0 ? '#16a34a' : '#ef4444' }}>{pair.crudo.qty}</span>
          <span style={{ fontSize: stockSz - 2, color: '#9ca3af', fontWeight: 700 }}>cr</span>
          <span style={{ fontSize: stockSz, color: '#d1d5db' }}>→</span>
          <span style={{ fontWeight: 900, fontSize: stockSz, color: '#1f2937' }}>{pair.frito.qty}</span>
          <span style={{ fontSize: stockSz - 2, color: '#9ca3af', fontWeight: 700 }}>fr</span>
        </div>
      </div>

      {/* Botones circulares — máx 4 en tablet para que no desborden */}
      <div style={{ display: 'flex', gap: 5, flex: 1, justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
        {presets.slice(0, maxCircles).map((amount, i) => (
          <button key={i} disabled={isDisabled} onClick={() => onFry(pair, amount)}
            style={{ width: circleD, height: circleD, minWidth: circleD, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: btnSz, fontWeight: 900 }}
            className={`transition-all select-none ${circleCls}`}>
            {amount}
          </button>
        ))}
      </div>

      <button onClick={() => onManual(pair)}
        style={{ width: manualD, height: manualD, minWidth: manualD, borderRadius: '50%', flexShrink: 0, border: '1.5px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', fontSize: size === 'md' ? 15 : 12, cursor: 'pointer' }}>
        ✏️
      </button>
    </div>
  );
}

// ─── Tarjeta TABLET: escala fuentes según espacio disponible ──────────────────
function FritadoCardTablet({ pair, wasteMode, onFry, onManual, cardH = 300 }) {
  const presets    = pair.presets || [10, 20, 50, 100, 200];
  const [big, ...smalls] = presets;
  const isDisabled = pair.crudo.qty === 0 && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : pair.crudo.qty > 0 ? 'border border-gray-200 bg-white'
    : 'border border-red-200 bg-red-50/20';
  const btnCls = wasteMode ? 'bg-red-400 hover:bg-red-500 text-white border-2 border-red-500'
    : isDisabled ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed'
    : 'bg-chunky-main hover:bg-chunky-secondary text-chunky-dark hover:text-white border-2 border-chunky-secondary shadow-sm';

  const big3  = cardH >= 260;
  const nameSz  = big3 ? 'text-xl'  : 'text-base';
  const stockSz = big3 ? 'text-xl'  : 'text-base';
  const bigSz   = big3 ? 'text-4xl' : 'text-2xl';
  const unitSz  = big3 ? 'text-sm'  : 'text-xs';
  const smSz    = big3 ? 'text-base': 'text-sm';
  const pad     = big3 ? 'p-4'      : 'p-3';
  const smPy    = big3 ? 'py-3'     : 'py-2';
  const boxPy   = big3 ? 'py-3 px-4': 'py-2 px-3';

  return (
    <div className={`rounded-2xl ${pad} flex flex-col gap-2 h-full ${cardCls}`}>
      <div className="text-center shrink-0">
        <div className={`font-black text-chunky-dark leading-tight truncate ${nameSz}`}>{pair.frito.name}</div>
        <div className={`font-bold text-gray-400 truncate ${unitSz}`}>Masa: {pair.crudo.name}</div>
      </div>

      <div className={`flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl shrink-0 ${boxPy}`}>
        <div className="flex-1 text-center">
          <div className="text-[9px] font-black text-gray-400 uppercase">Crudo</div>
          {pair.crudo.qty === 0 && !wasteMode
            ? <div className={`font-black text-red-500 ${stockSz}`}>Agotado</div>
            : <div className={`font-black text-green-600 leading-none ${stockSz}`}>{pair.crudo.qty}<span className={`text-gray-400 ml-0.5 ${unitSz}`}>uds</span></div>
          }
        </div>
        <div className="text-gray-300">➡️</div>
        <div className="flex-1 text-center">
          <div className="text-[9px] font-black text-yellow-600 uppercase">Fritas</div>
          <div className={`font-black text-chunky-dark leading-none ${stockSz}`}>{pair.frito.qty}<span className={`text-gray-400 ml-0.5 ${unitSz}`}>uds</span></div>
        </div>
      </div>

      <button disabled={isDisabled} onClick={() => onFry(pair, big)}
        className={`rounded-2xl flex-1 min-h-0 flex flex-col items-center justify-center font-black transition-all active:scale-[0.97] select-none ${btnCls}`}>
        <span className={`leading-none font-black ${bigSz}`}>{big}</span>
        <span className={`font-bold opacity-80 ${unitSz}`}>uds</span>
      </button>

      <div className="grid grid-cols-4 gap-1.5 shrink-0">
        {smalls.slice(0, 4).map((amount, idx) => (
          <button key={idx} disabled={isDisabled} onClick={() => onFry(pair, amount)}
            className={`rounded-xl ${smPy} flex flex-col items-center font-black transition-all active:scale-95 select-none ${btnCls}`}>
            <span className={`leading-none ${smSz}`}>{amount}</span>
            <span className="text-[9px] font-bold opacity-70">uds</span>
          </button>
        ))}
      </div>

      <button onClick={() => onManual(pair)}
        className={`w-full shrink-0 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 font-bold ${unitSz} hover:border-chunky-main transition-colors ${smPy}`}>
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Tarjeta COCINA normal: fuentes proporcionales a cardH ────────────────────
function FritadoCard({ pair, wasteMode, onFry, onManual, cardH = 180 }) {
  const presets = pair.presets || [10, 20, 50, 100, 200];
  const [big, ...smalls] = presets;
  const isDisabled = pair.crudo.qty === 0 && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : pair.crudo.qty > 0 ? 'border border-gray-100 bg-white'
    : 'border border-red-200 bg-red-50/20';
  const btnCls = wasteMode ? 'bg-red-400 hover:bg-red-500 text-white border-2 border-red-500'
    : isDisabled ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed'
    : 'bg-chunky-main hover:bg-chunky-secondary text-chunky-dark hover:text-white border-2 border-chunky-secondary shadow-sm';

  const bigSz  = Math.max(18, Math.min(60, Math.round(cardH * 0.34)));
  const smSz   = Math.max(9,  Math.min(15, Math.round(cardH * 0.08)));
  const nameSz = Math.max(10, Math.min(16, Math.round(cardH * 0.08)));
  const stockSz= Math.max(9,  Math.min(14, Math.round(cardH * 0.07)));
  const unitSz = Math.max(7,  Math.min(12, Math.round(cardH * 0.06)));
  const pad    = Math.max(4,  Math.min(12, Math.round(cardH * 0.05)));
  const smPy   = Math.max(3,  Math.min(8,  Math.round(cardH * 0.03)));
  const gap    = Math.max(3,  Math.min(8,  Math.round(cardH * 0.03)));

  return (
    <div style={{ borderRadius: 12, padding: pad, display: 'flex', flexDirection: 'column', gap, height: '100%', paddingBottom: pad }}
         className={cardCls}>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: nameSz, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1f2937' }}>{pair.frito.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <span style={{ fontWeight: 900, fontSize: stockSz, color: pair.crudo.qty > 0 ? '#16a34a' : '#ef4444' }}>{pair.crudo.qty}</span>
          <span style={{ fontSize: stockSz - 1, color: '#d1d5db' }}>→</span>
          <span style={{ fontWeight: 900, fontSize: stockSz, color: '#1f2937' }}>{pair.frito.qty}</span>
          <span style={{ fontSize: stockSz - 2, color: '#9ca3af', fontWeight: 700 }}>uds</span>
        </div>
      </div>

      <button disabled={isDisabled} onClick={() => onFry(pair, big)}
        style={{ borderRadius: 10, flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        className={`font-black transition-all select-none ${btnCls}`}>
        <span style={{ fontSize: bigSz, fontWeight: 900, lineHeight: 1 }}>{big}</span>
        <span style={{ fontSize: unitSz, fontWeight: 700, opacity: 0.75, marginTop: 2 }}>uds</span>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, flexShrink: 0 }}>
        {smalls.slice(0, 4).map((amount, idx) => (
          <button key={idx} disabled={isDisabled} onClick={() => onFry(pair, amount)}
            style={{ borderRadius: 8, paddingTop: smPy, paddingBottom: smPy, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
            className={`font-black transition-all active:scale-95 select-none ${btnCls}`}>
            <span style={{ fontSize: smSz, fontWeight: 900, lineHeight: 1 }}>{amount}</span>
            <span style={{ fontSize: unitSz - 2, fontWeight: 700, opacity: 0.7 }}>uds</span>
          </button>
        ))}
      </div>

      <button onClick={() => onManual(pair)}
        style={{ flexShrink: 0, border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', fontSize: unitSz, fontWeight: 700, color: '#9ca3af', cursor: 'pointer', minHeight: 18 }}>
        ✏️ Manual
      </button>
    </div>
  );
}


// ─── Tarjeta COMPACTA cocina ──────────────────────────────────────────────────
function FritadoCardCompact({ pair, wasteMode, onFry, onManual }) {
  const presets    = pair.presets || [10, 20, 50, 100, 200];
  const isDisabled = pair.crudo.qty === 0 && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : pair.crudo.qty > 0 ? 'border border-gray-100 bg-white'
    : 'border border-red-200 bg-red-50/20';
  const btnCls = isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
    : wasteMode ? 'bg-red-100 text-red-700'
    : 'bg-chunky-main hover:bg-chunky-secondary text-chunky-dark hover:text-white shadow-sm';

  return (
    <div className={`rounded-xl px-2 py-1.5 flex flex-col h-full ${cardCls}`} style={{ gap: 3 }}>
      <div className="flex items-center justify-between shrink-0">
        <span className="font-black text-chunky-dark text-[11px] truncate flex-1">{pair.frito.name}</span>
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <span className={`text-[9px] font-black ${pair.crudo.qty > 0 ? 'text-green-600' : 'text-red-500'}`}>{pair.crudo.qty}</span>
          <span className="text-gray-300 text-[8px]">→</span>
          <span className="text-[9px] font-black text-chunky-dark">{pair.frito.qty}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 flex-1 min-h-0" style={{ gap: 2 }}>
        {presets.slice(0, 5).map((amount, i) => (
          <button key={i} disabled={isDisabled} onClick={() => onFry(pair, amount)}
            className={`rounded-lg flex items-center justify-center text-[12px] font-black transition-colors select-none ${btnCls} ${i === 0 ? 'ring-2 ring-chunky-secondary/60' : ''}`}>
            {amount}
          </button>
        ))}
      </div>
      <button onClick={() => onManual(pair)} style={{ minHeight: 16, flexShrink: 0 }}
        className="w-full border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 font-bold text-[8px] hover:border-chunky-main transition-colors">
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Panel Principal ───────────────────────────────────────────────────────────
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
  const { width: sw, height: sh } = useScreenSize();
  const aspectRatio = sh / sw;

  const isMobile  = aspectRatio > 1.4;
  const isTablet  = !isMobile && sw > 500 && sw <= 1200;
  const isTabletLandscape = isTablet && sw > sh;

  const isTabletFewProds = isTablet && count <= 3;
  const isTabletPills    = isTablet && count > 3;

  let cols, allowScroll, pad, gap;
  if (isMobile) {
    cols = 1; allowScroll = true; pad = 8; gap = 6;
  } else if (isTabletFewProds) {
    cols = count || 1; allowScroll = false; pad = 16; gap = 12;
  } else if (isTabletPills) {
    cols = isTabletLandscape ? 2 : 1;
    allowScroll = true; pad = 10; gap = 8;
  } else {
    allowScroll = false; pad = 6; gap = 6;
    cols = count <= 2 ? (count || 1) : count <= 4 ? 2 : count <= 6 ? 3 : count <= 12 ? 4 : 5;
  }
  const rows = Math.ceil(count / cols);

  const HEADER_H   = 52;
  const availableH = sh - HEADER_H - 2 * pad - (rows - 1) * gap;
  const cardH      = availableH / rows;
  const useCompact = !isMobile && !isTablet && !allowScroll && cardH < 140;

  const CARD_MAX = count <= 2 ? 500 : count <= 4 ? 360 : 270;
  const gridMaxW = isTabletFewProds ? '100%'
    : allowScroll ? '100%'
    : cols <= 4 ? cols * CARD_MAX + (cols - 1) * gap : '100%';


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
      {modalConfig && <ActionModal config={modalConfig} wasteMode={wasteMode} onClose={() => setModalConfig(null)} onConfirm={handleModalConfirm} />}

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
            {wasteMode ? '⚠️ SALIR' : '🗑️ MERMA'}
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

      <div style={{ flex: 1, overflow: allowScroll ? 'auto' : 'hidden', padding: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: (!isMobile && !allowScroll) ? 'center' : 'flex-start' }}>
        {pairs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 40 }}>🧊</span>
            <p style={{ fontWeight: 900, fontSize: 18, color: '#1f2937', marginTop: 12 }}>No hay crudos vinculados</p>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#9ca3af' }}>Configura recetas de fritado en Admin.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: (isMobile || isTabletPills) ? `repeat(${cols}, 1fr)` : `repeat(${cols}, minmax(0, ${CARD_MAX}px))`,
            gridTemplateRows: !allowScroll && count > 0 ? `repeat(${rows}, minmax(0, 1fr))` : 'auto',
            gap,
            width: '100%',
            maxWidth: gridMaxW,
            height: !allowScroll ? '100%' : 'auto',
          }}>
            {pairs.map((pair, i) => {
              const props = { key: i, pair, wasteMode, onFry: handleFry, onManual: (p) => setModalConfig({ pair: p }) };
              if (isMobile)          return <FritadoCardMobile  {...props} size="sm" />;
              if (isTabletPills)     return <FritadoCardMobile  {...props} size="md" />;
              if (isTabletFewProds)  return <FritadoCardTablet  {...props} cardH={cardH} />;
              if (useCompact)        return <FritadoCardCompact {...props} />;
              return                        <FritadoCard        {...props} cardH={cardH} />;
            })}
          </div>
        )}
      </div>

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

export function FritadoView() {
  const signOut = useAuthStore((s) => s.signOut);
  const [selectedPoint, setSelectedPoint] = useState(null);
  if (!selectedPoint) return <SelectFritadoPoint onSelect={setSelectedPoint} signOut={signOut} />;
  return <FritadoPanel productionPoint={selectedPoint} onBack={() => setSelectedPoint(null)} />;
}
