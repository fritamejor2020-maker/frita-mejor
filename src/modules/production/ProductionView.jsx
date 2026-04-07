import React, { useState, useEffect } from 'react';
import { Toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';

// ─── Hook: tamaño de pantalla ─────────────────────────────────────────────────
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
function SelectProductionPoint({ onSelect, signOut }) {
  const { productionPoints } = useInventoryStore();
  const active = productionPoints.filter((p) => p.active);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-[40px] p-8 shadow-sm mb-6">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Frita Mejor" className="w-40 mx-auto object-contain mb-4" />
            <h1 className="text-3xl font-black text-chunky-dark">Línea de Producción</h1>
            <p className="text-gray-400 font-bold mt-2 text-sm">Selecciona tu punto de trabajo</p>
          </div>
          <div className="space-y-3">
            {active.map((pp) => (
              <button key={pp.id} className="w-full border-2 border-gray-100 rounded-3xl p-5 text-left hover:border-chunky-secondary hover:shadow-sm transition-all group" onClick={() => onSelect(pp)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-2xl border border-yellow-100 shrink-0">🏭</div>
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

// ─── Modal Manual ──────────────────────────────────────────────────────────────
function ManualModal({ product, recipe, wasteMode, onClose, onConfirm }) {
  const [qty, setQty] = useState('');
  const [mode, setMode] = useState(wasteMode ? 'WASTE' : 'PRODUCE');
  const handleSubmit = () => {
    const amount = parseFloat(qty);
    if (isNaN(amount) || amount <= 0) return;
    onConfirm(amount, mode);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-chunky-dark mb-1">Cantidad Manual</h2>
        <p className="text-gray-400 font-bold text-sm mb-5">{product.name}</p>
        <div className="flex gap-3 mb-6">
          <button className={`flex-1 py-2 rounded-full font-bold text-sm ${mode === 'PRODUCE' ? 'bg-[#FFB700] text-gray-900' : 'bg-gray-100 text-gray-500'}`} onClick={() => setMode('PRODUCE')}>Producir</button>
          <button className={`flex-1 py-2 rounded-full font-bold text-sm ${mode === 'WASTE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`} onClick={() => setMode('WASTE')}>Descarte</button>
        </div>
        <input type="number" min="0" step="0.5" placeholder="0" autoFocus
          className="w-full text-5xl font-black text-center border-2 border-gray-200 rounded-2xl p-4 mb-4 outline-none focus:border-chunky-main"
          value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }} />
        <div className="flex gap-3">
          <button className="flex-1 border border-gray-200 text-gray-400 font-bold py-3 rounded-full" onClick={onClose}>Cancelar</button>
          <button className={`flex-1 text-white font-bold py-3 rounded-full ${mode === 'PRODUCE' ? 'bg-chunky-secondary' : 'bg-red-400'}`} onClick={handleSubmit}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta MÓVIL: píldora horizontal + botones circulares ───────────────────
function CardMobile({ prod, productionPoint, wasteMode, onProduce, onManual }) {
  const presets   = prod.linePresets?.[productionPoint.id] ?? [1, 2, 5, 10, 20];
  const yieldQty  = prod.recipe?.yieldQty ?? 1;
  const yieldUnit = (prod.recipe?.yieldUnit ?? prod.unit);
  const shortUnit = yieldUnit.length > 3 ? yieldUnit.slice(0, 3) : yieldUnit;
  const isDisabled = !prod.stockOk && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/10'
    : prod.stockOk ? 'border border-gray-200 bg-white'
    : 'border border-red-200 bg-red-50/10';

  const circleCls = isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
    : wasteMode ? 'bg-red-100 text-red-700 active:scale-95'
    : 'bg-[#FFB700] text-gray-900 active:scale-90 shadow-sm';

  return (
    <div className={`rounded-2xl px-3 py-3 flex items-center gap-3 ${cardCls}`}>
      {/* Info producto */}
      <div style={{ minWidth: 0, width: 100, flexShrink: 0 }}>
        <div className="font-black text-chunky-dark text-sm leading-tight truncate">{prod.name}</div>
        <div className="flex items-baseline gap-0.5">
          <span className="font-black text-chunky-dark text-xs">{prod.currentStock}</span>
          <span className="text-[9px] font-bold text-gray-400">{shortUnit}</span>
          <span className={`text-[10px] font-bold ml-1 ${prod.stockOk ? 'text-green-500' : 'text-red-500'}`}>{prod.stockOk ? '✓' : '⚠️'}</span>
        </div>
      </div>

      {/* Botones circulares */}
      <div className="flex gap-1.5 flex-1 justify-center">
        {presets.slice(0, 5).map((b, i) => {
          const a = b * yieldQty;
          const label = a % 1 === 0 ? String(a) : a.toFixed(1);
          return (
            <button key={i} disabled={isDisabled} onClick={() => onProduce(prod, b)}
              style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              className={`font-black transition-all select-none ${circleCls}`}>
              <span style={{ fontSize: label.length > 3 ? 9 : label.length > 2 ? 11 : 14, lineHeight: 1, fontWeight: 900 }}>{label}</span>
              {shortUnit.length <= 3 && <span style={{ fontSize: 7, opacity: 0.65, fontWeight: 700 }}>{shortUnit}</span>}
            </button>
          );
        })}
      </div>

      {/* Manual — icono */}
      <button onClick={() => onManual(prod)}
        style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: '1.5px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', fontSize: 14, cursor: 'pointer' }}
        title="Manual">
        ✏️
      </button>
    </div>
  );
}

// ─── Tarjeta TABLET: normal con texto más grande ───────────────────────────────
function CardTablet({ prod, productionPoint, wasteMode, onProduce, onManual }) {
  const presets   = prod.linePresets?.[productionPoint.id] ?? [1, 2, 5, 10, 20];
  const yieldQty  = prod.recipe?.yieldQty ?? 1;
  const yieldUnit = prod.recipe?.yieldUnit ?? prod.unit;
  const [big, ...smalls] = presets;
  const bigAmt     = big * yieldQty;
  const isDisabled = !prod.stockOk && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : prod.stockOk ? 'border border-gray-200 bg-white'
    : 'border border-red-200 bg-red-50/20';
  const btnCls = isDisabled ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed'
    : wasteMode ? 'bg-red-100 hover:bg-red-200 text-red-700 border-2 border-red-200'
    : 'bg-[#FFB700] hover:bg-yellow-400 text-gray-900 border-2 border-transparent shadow-sm';

  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-3 h-full ${cardCls}`}>
      <div className="text-center shrink-0">
        <div className="font-black text-chunky-dark text-base leading-tight truncate">{prod.name}</div>
        <div className="flex items-baseline justify-center gap-1">
          <span className="font-black text-chunky-dark text-base">{prod.currentStock}</span>
          <span className="text-sm font-bold text-gray-400">{prod.unit}</span>
          <span className={`text-sm font-bold ${prod.stockOk ? 'text-green-500' : 'text-red-500'}`}>{prod.stockOk ? '✓' : '⚠️'}</span>
        </div>
      </div>

      <button disabled={isDisabled} onClick={() => onProduce(prod, big)}
        className={`rounded-xl flex-1 min-h-0 flex flex-col items-center justify-center font-black transition-colors select-none ${btnCls}`}>
        <span className="text-3xl font-black leading-none">{bigAmt % 1 === 0 ? bigAmt : bigAmt.toFixed(1)}</span>
        <span className="text-sm font-bold opacity-70 mt-0.5">{yieldUnit}</span>
      </button>

      <div className="grid grid-cols-4 gap-2 shrink-0">
        {smalls.slice(0, 4).map((b, i) => {
          const a = b * yieldQty;
          return (
            <button key={i} disabled={isDisabled} onClick={() => onProduce(prod, b)}
              className={`rounded-xl py-2.5 flex flex-col items-center font-black transition-colors select-none ${btnCls}`}>
              <span className="text-sm leading-none">{a % 1 === 0 ? a : a.toFixed(1)}</span>
              <span className="text-[9px] font-bold opacity-70">{yieldUnit}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => onManual(prod)}
        className="w-full shrink-0 border border-dashed border-gray-300 rounded-xl py-2 flex items-center justify-center text-gray-400 font-bold text-xs hover:border-chunky-main hover:text-chunky-dark transition-colors">
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Tarjeta COCINA/PC: adaptativa sin scroll ─────────────────────────────────
function CardNormal({ prod, productionPoint, wasteMode, onProduce, onManual }) {
  const presets   = prod.linePresets?.[productionPoint.id] ?? [1, 2, 5, 10, 20];
  const yieldQty  = prod.recipe?.yieldQty ?? 1;
  const yieldUnit = prod.recipe?.yieldUnit ?? prod.unit;
  const [big, ...smalls] = presets;
  const bigAmt     = big * yieldQty;
  const isDisabled = !prod.stockOk && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : prod.stockOk ? 'border border-gray-200 bg-white'
    : 'border border-red-200 bg-red-50/20';
  const btnCls = isDisabled ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed'
    : wasteMode ? 'bg-red-100 hover:bg-red-200 text-red-700 border-2 border-red-200'
    : 'bg-[#FFB700] hover:bg-yellow-400 text-gray-900 border-2 border-transparent shadow-sm';

  return (
    <div className={`rounded-xl p-2 flex flex-col gap-1.5 h-full ${cardCls}`} style={{ paddingBottom: 4 }}>
      <div className="text-center shrink-0">
        <div className="font-black text-chunky-dark text-xs leading-tight truncate">{prod.name}</div>
        <div className="flex items-baseline justify-center gap-0.5">
          <span className="font-black text-chunky-dark text-xs">{prod.currentStock}</span>
          <span className="text-[9px] font-bold text-gray-400">{prod.unit}</span>
          <span className={`text-[9px] font-bold ml-0.5 ${prod.stockOk ? 'text-green-500' : 'text-red-500'}`}>{prod.stockOk ? '✓' : '⚠️'}</span>
        </div>
      </div>

      <button disabled={isDisabled} onClick={() => onProduce(prod, big)}
        className={`rounded-lg flex-1 min-h-0 flex flex-col items-center justify-center font-black transition-colors select-none ${btnCls}`}>
        <span className="text-xl font-black leading-none">{bigAmt % 1 === 0 ? bigAmt : bigAmt.toFixed(1)}</span>
        <span className="text-[9px] font-bold opacity-70">{yieldUnit}</span>
      </button>

      <div className="grid grid-cols-4 shrink-0" style={{ gap: 2 }}>
        {smalls.slice(0, 4).map((b, i) => {
          const a = b * yieldQty;
          return (
            <button key={i} disabled={isDisabled} onClick={() => onProduce(prod, b)}
              className={`rounded-md flex flex-col items-center py-1 font-black transition-colors select-none ${btnCls}`}>
              <span className="text-[10px] leading-none">{a % 1 === 0 ? a : a.toFixed(1)}</span>
              <span className="text-[7px] font-bold opacity-70">{yieldUnit}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => onManual(prod)}
        style={{ minHeight: 18 }}
        className="w-full shrink-0 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 font-bold text-[9px] py-0.5 hover:border-chunky-main hover:text-chunky-dark transition-colors">
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Tarjeta COCINA compacta (muy poco espacio) ────────────────────────────────
function CardCompact({ prod, productionPoint, wasteMode, onProduce, onManual }) {
  const presets   = prod.linePresets?.[productionPoint.id] ?? [1, 2, 5, 10, 20];
  const yieldQty  = prod.recipe?.yieldQty ?? 1;
  const yieldUnit = prod.recipe?.yieldUnit ?? prod.unit;
  const shortUnit = yieldUnit.length > 3 ? yieldUnit.slice(0, 3) + '.' : yieldUnit;
  const isDisabled = !prod.stockOk && !wasteMode;

  const cardCls = wasteMode ? 'border-2 border-dashed border-red-300 bg-red-50/20'
    : prod.stockOk ? 'border border-gray-200 bg-white'
    : 'border border-red-200 bg-red-50/20';
  const btnCls = isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
    : wasteMode ? 'bg-red-100 text-red-700'
    : 'bg-[#FFB700] hover:bg-yellow-400 text-gray-900 shadow-sm';

  return (
    <div className={`rounded-xl px-2 py-1.5 flex flex-col h-full ${cardCls}`} style={{ gap: 3 }}>
      <div className="flex items-center justify-between shrink-0">
        <span className="font-black text-chunky-dark text-[11px] truncate flex-1">{prod.name}</span>
        <span className={`text-[9px] font-bold shrink-0 ml-1 whitespace-nowrap ${prod.stockOk ? 'text-green-500' : 'text-red-500'}`}>
          {prod.stockOk ? '✓' : '⚠️'} {prod.currentStock} {shortUnit}
        </span>
      </div>
      <div className="grid grid-cols-5 flex-1 min-h-0" style={{ gap: 2 }}>
        {presets.slice(0, 5).map((b, i) => {
          const a = b * yieldQty;
          return (
            <button key={i} disabled={isDisabled} onClick={() => onProduce(prod, b)}
              className={`rounded-lg flex items-center justify-center text-[12px] font-black transition-colors select-none ${btnCls} ${i === 0 ? 'ring-2 ring-yellow-500' : ''}`}>
              {a % 1 === 0 ? a : a.toFixed(1)}
            </button>
          );
        })}
      </div>
      <button onClick={() => onManual(prod)} style={{ minHeight: 16, flexShrink: 0 }}
        className="w-full border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 font-bold text-[8px] hover:border-chunky-main transition-colors">
        ✏️ Manual
      </button>
    </div>
  );
}

// ─── Panel Principal ───────────────────────────────────────────────────────────
function ProductionPanel({ productionPoint, onBack }) {
  const { products, inventory, produceItem, reportWaste, checkStock, getRecipeByProductId } = useInventoryStore();
  const signOut = useAuthStore((s) => s.signOut);
  const [toast, setToast]          = useState({ visible: false, message: '', type: 'success' });
  const [wasteMode, setWasteMode]  = useState(false);
  const [manualProd, setManualProd] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ visible: true, message: msg, type });

  const filtered = products.filter((p) => !p.productionPointIds?.length || p.productionPointIds.includes(productionPoint.id));
  const displayProducts = filtered.length > 0 ? filtered : products;

  const enriched = displayProducts.map((prod) => {
    const recipe     = getRecipeByProductId(prod.id);
    const stockCheck = recipe ? checkStock(recipe.id, 1) : { canProduce: true, missing: [] };
    const inv        = inventory.find((i) => prod.outputInventoryId ? i.id === prod.outputInventoryId : i.name === prod.name);
    return { ...prod, stockOk: stockCheck.canProduce, currentStock: inv?.qty ?? 0, recipe };
  });

  const count = enriched.length;
  const { width: sw, height: sh } = useScreenSize();
  const aspectRatio = sh / sw;

  // ── Breakpoints ──────────────────────────────────────────────────────────────
  // Móvil: portrait marcado → píldoras horizontales + scroll
  const isMobile  = aspectRatio > 1.4;
  // Tablet: ancho medio (iPad, tablet landscape) → tarjetas normales con texto grande + sin scroll
  const isTablet  = !isMobile && sw > 500 && sw <= 1000;
  // Cocina/PC: pantalla grande → compacto adaptativo sin scroll
  // const isDesktop = !isMobile && !isTablet;  // implícito

  // Columnas según dispositivo
  let cols, allowScroll, pad, gap;
  if (isMobile) {
    cols = 1; allowScroll = true; pad = 8; gap = 6;
  } else if (isTablet) {
    allowScroll = false; pad = 10; gap = 10;
    if      (count <= 2)  { cols = count || 1; }
    else if (count <= 4)  { cols = 2; }
    else                   { cols = 3; }
  } else {
    allowScroll = false; pad = 6; gap = 6;
    if      (count <= 2)  { cols = count || 1; }
    else if (count <= 4)  { cols = 2; }
    else if (count <= 6)  { cols = 3; }
    else if (count <= 12) { cols = 4; }
    else                   { cols = 5; }
  }
  const rows = Math.ceil(count / cols);

  // Compacto solo en desktop cuando hay muy poco espacio por tarjeta
  const HEADER_H   = 52;
  const availableH = sh - HEADER_H - 2 * pad - (rows - 1) * gap;
  const cardH      = availableH / rows;
  const useCompact = !isMobile && !isTablet && !allowScroll && cardH < 140;

  const handleProduce = (product, batches = 1) => {
    if (wasteMode) {
      const recipe = getRecipeByProductId(product.id);
      const qty    = batches * (recipe?.yieldQty ?? 1);
      const invId  = product.outputInventoryId ?? inventory.find((i) => i.name === product.name)?.id;
      if (invId) reportWaste(invId, qty, 'Descarte en producción', productionPoint.id);
      showToast(`🗑️ Descarte: ${qty} ${recipe?.yieldUnit ?? product.unit}`, 'warning');
      return;
    }
    const result = produceItem(product.id, batches, productionPoint.id);
    showToast(result.message, result.ok ? 'success' : 'error');
  };

  const handleManualConfirm = (product, amount, mode) => {
    const recipe = getRecipeByProductId(product.id);
    if (mode === 'WASTE') {
      const qty   = amount * (recipe?.yieldQty ?? 1);
      const invId = product.outputInventoryId ?? inventory.find((i) => i.name === product.name)?.id;
      if (invId) reportWaste(invId, qty, 'Descarte manual', productionPoint.id);
      showToast(`🗑️ Descarte: -${qty} ${recipe?.yieldUnit ?? product.unit}`, 'warning');
    } else {
      const result = produceItem(product.id, amount, productionPoint.id);
      showToast(result.message, result.ok ? 'success' : 'error');
    }
  };

  // Ancho máximo del grid cuando hay pocos productos (para que no se estiren)
  const CARD_MAX   = isTablet ? 380 : 300;
  const gridMaxW   = (!isMobile && count <= 4) ? cols * CARD_MAX + (cols - 1) * gap : '100%';

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {manualProd && (
        <ManualModal product={manualProd} recipe={getRecipeByProductId(manualProd.id)} wasteMode={wasteMode}
          onClose={() => setManualProd(null)} onConfirm={(amt, mode) => handleManualConfirm(manualProd, amt, mode)} />
      )}

      {/* Header */}
      <header style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1f2937', lineHeight: 1 }}>{productionPoint.name}</div>
            <div style={{ fontWeight: 700, fontSize: 10, color: '#9ca3af' }}>{productionPoint.location} · Operario</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setWasteMode(!wasteMode)}
            style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20, border: wasteMode ? '1px solid #fca5a5' : '1px solid #e5e7eb', background: wasteMode ? '#fee2e2' : 'white', color: wasteMode ? '#dc2626' : '#6b7280', cursor: 'pointer' }}>
            {wasteMode ? '⚠️ SALIR' : '🗑️ DESCARTE'}
          </button>
          <button onClick={signOut} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        </div>
      </header>

      {wasteMode && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '3px 16px', textAlign: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 11, color: '#dc2626' }}>⚠️ MODO DESCARTE ACTIVO</span>
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: allowScroll ? 'auto' : 'hidden', padding: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: (!isMobile && count <= 4) ? 'center' : 'flex-start' }}>
        {enriched.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 40 }}>📋</span>
            <p style={{ fontWeight: 900, fontSize: 18, color: '#1f2937', marginTop: 12 }}>Sin productos asignados</p>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#9ca3af' }}>El Admin puede asignar productos a este punto.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : `repeat(${cols}, minmax(0, ${CARD_MAX}px))`,
            gridTemplateRows: !allowScroll && count > 4 ? `repeat(${rows}, minmax(0, 1fr))` : 'auto',
            gap,
            width: '100%',
            maxWidth: typeof gridMaxW === 'number' ? gridMaxW : '100%',
            height: !allowScroll && count > 4 ? '100%' : 'auto',
          }}>
            {enriched.map((prod) => {
              const props = { key: prod.id, prod, productionPoint, wasteMode, onProduce: handleProduce, onManual: (p) => setManualProd(p) };
              if (isMobile)      return <CardMobile  {...props} />;
              if (isTablet)      return <CardTablet  {...props} />;
              if (useCompact)    return <CardCompact {...props} />;
              return               <CardNormal  {...props} />;
            })}
          </div>
        )}
      </div>

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────
export function ProductionView() {
  const signOut = useAuthStore((s) => s.signOut);
  const [selectedPoint, setSelectedPoint] = useState(null);
  if (!selectedPoint) return <SelectProductionPoint onSelect={setSelectedPoint} signOut={signOut} />;
  return <ProductionPanel productionPoint={selectedPoint} onBack={() => setSelectedPoint(null)} />;
}
