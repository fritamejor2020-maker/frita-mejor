import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';

// ─── Pantalla de Selección de Punto de Producción ─────────────────────────────
function SelectProductionPoint({ onSelect, signOut }) {
  const { productionPoints } = useInventoryStore();
  const active = productionPoints.filter((p) => p.active);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-[32px] sm:rounded-[40px] p-5 sm:p-8 shadow-sm mb-4 sm:mb-6">
          <div className="text-center mb-5 sm:mb-8">
            <img src="/logo.png" alt="Frita Mejor" className="w-28 sm:w-40 mx-auto object-contain mb-4" />
            <h1 className="text-2xl sm:text-3xl font-black text-chunky-dark">Línea de Producción</h1>
            <p className="text-gray-400 font-bold mt-2 text-sm">Selecciona tu punto de trabajo</p>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {active.map((pp) => (
              <button
                key={pp.id}
                className="w-full border-2 border-gray-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-left hover:border-chunky-secondary hover:shadow-sm transition-all active:scale-[0.98] group"
                onClick={() => onSelect(pp)}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl border border-yellow-100 shrink-0">
                    🏭
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-chunky-dark text-base sm:text-lg leading-tight group-hover:text-chunky-dark">{pp.name}</h3>
                    <p className="text-gray-400 font-bold text-xs sm:text-sm mt-0.5">{pp.location}</p>
                  </div>
                  <svg className="text-gray-300 group-hover:text-chunky-secondary transition-colors shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          className="w-full text-center text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors py-2"
          onClick={signOut}
        >
          ← Cambiar de rol
        </button>
      </div>
    </div>
  );
}

// ─── Modal de entrada manual ───────────────────────────────────────────────────
function ManualModal({ product, recipe, wasteMode, onClose, onConfirm }) {
  const [qty, setQty]   = useState('');
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
          <button
            className={`flex-1 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${mode === 'PRODUCE' ? 'bg-[#FFB700] text-gray-900 border border-[#FFB700]' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
            onClick={() => setMode('PRODUCE')}
          >Producir</button>
          <button
            className={`flex-1 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${mode === 'WASTE' ? 'bg-red-100 border border-red-200 text-red-700' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
            onClick={() => setMode('WASTE')}
          >Descarte</button>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {recipe ? `Lotes de ${recipe.yieldQty} ${recipe.yieldUnit}` : `Cantidad en ${product.unit}`}
        </p>
        <input
          type="number" min="0" step="0.5"
          placeholder="0"
          className="w-full text-5xl font-black text-center border-2 border-gray-200 rounded-2xl p-4 mb-2 outline-none focus:border-chunky-main"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          autoFocus
        />
        {recipe && qty && !isNaN(parseFloat(qty)) && (
          <p className="text-center text-sm font-bold text-gray-400 mb-4">
            = {(parseFloat(qty) * recipe.yieldQty).toFixed(1)} {recipe.yieldUnit}
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <button className="flex-1 border border-gray-200 text-gray-400 font-bold py-3 rounded-full" onClick={onClose}>Cancelar</button>
          <button
            className={`flex-1 text-white font-bold py-3 rounded-full ${mode === 'PRODUCE' ? 'bg-chunky-secondary' : 'bg-red-400'}`}
            onClick={handleSubmit}
          >Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de producto con 5 botones de cantidad ────────────────────────────
function ProductCard({ prod, productionPoint, wasteMode, onProduce, onManual }) {
  // En modo merma: resalta diferente
  const cardClass = wasteMode
    ? 'border-dashed border-2 border-red-300 bg-red-50/20'
    : prod.stockOk
      ? 'border border-gray-100 hover:border-chunky-secondary/40 bg-white'
      : 'border border-red-200 bg-red-50/30 ring-1 ring-red-200';

  // presets: array de lotes (ej. [1, 2, 5, 10, 20])
  const presets = prod.linePresets?.[productionPoint.id] ?? [1, 2, 5, 10, 20];
  const yieldQty  = prod.recipe?.yieldQty ?? 1;
  const yieldUnit = prod.recipe?.yieldUnit ?? prod.unit;

  // Primer preset = botón grande, los 4 restantes = botones pequeños
  const [bigPreset, ...smallPresets] = presets;
  const bigAmount   = bigPreset * yieldQty;
  const isDisabled  = !prod.stockOk && !wasteMode;

  const btnBase = wasteMode
    ? 'bg-red-100 hover:bg-red-200 text-red-700 border-2 border-red-200 disabled:opacity-40 shadow-sm'
    : isDisabled
      ? 'bg-gray-50 text-gray-300 border-2 border-gray-100 cursor-not-allowed'
      : 'bg-[#FFB700] hover:bg-yellow-400 text-gray-900 border-2 border-transparent shadow-sm hover:shadow-md';

  return (
    <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-7 flex flex-col gap-3 sm:gap-5 transition-all ${cardClass}`}>
      {/* Cabecera */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-chunky-dark text-base sm:text-xl leading-tight truncate">{prod.name}</h3>
          {!prod.stockOk && !wasteMode ? (
            <div className="mt-1">
              <span className="text-xs font-bold text-red-500 block">⚠️ Insumos faltantes:</span>
              {prod.missing.map((m, i) => (
                <span key={i} className="text-xs text-red-400 block">
                  {m.name}: {(+m.have).toFixed(1)}/{m.need.toFixed(1)} {m.unit}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs sm:text-sm font-bold text-green-500 mt-1 block">✓ Insumos disponibles</span>
          )}
        </div>
        <div className="text-right ml-3 shrink-0">
          <span className="text-lg sm:text-2xl font-black text-chunky-dark">{prod.currentStock}</span>
          <span className="text-xs sm:text-sm font-bold text-gray-400 ml-1">{prod.unit}</span>
          <p className="text-xs text-gray-300 font-bold">en bodega</p>
        </div>
      </div>

      {wasteMode && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 text-center">
          <span className="text-xs font-bold text-red-500">🗑️ MODO DESCARTE</span>
        </div>
      )}

      {/* ── Botón principal (grande) ── */}
      <button
        disabled={isDisabled}
        onClick={() => onProduce(prod, bigPreset)}
        className={`w-full rounded-xl sm:rounded-2xl py-4 sm:py-6 flex flex-col items-center justify-center gap-1 font-black transition-all active:scale-[0.97] select-none ${btnBase}`}
      >
        <span className="text-2xl sm:text-3xl leading-none">{bigAmount % 1 === 0 ? bigAmount : bigAmount.toFixed(1)}</span>
        <span className="text-sm font-bold opacity-80">{yieldUnit}</span>
      </button>

      {/* ── 4 botones secundarios (pequeños) ── */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {smallPresets.map((batches, idx) => {
          const amount = batches * yieldQty;
          return (
            <button
              key={idx}
              disabled={isDisabled}
              onClick={() => onProduce(prod, batches)}
              className={`rounded-xl sm:rounded-2xl py-2 sm:py-3 px-1 flex flex-col items-center justify-center gap-0.5 font-black transition-all active:scale-95 select-none ${btnBase}`}
            >
              <span className="text-sm sm:text-base leading-none">{amount % 1 === 0 ? amount : amount.toFixed(1)}</span>
              <span className="text-[10px] font-bold opacity-80">{yieldUnit}</span>
            </button>
          );
        })}
      </div>

      {/* ── Botón Manual ── */}
      <button
        onClick={() => onManual(prod)}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 flex items-center justify-center gap-2 text-gray-400 font-bold text-sm hover:border-chunky-main hover:text-chunky-dark transition-all active:scale-[0.98]"
      >
        ✏️ MANUAL
      </button>
    </div>
  );
}

// ─── Panel Principal de Producción ────────────────────────────────────────────
function ProductionPanel({ productionPoint, onBack }) {
  const { products, inventory, produceItem, reportWaste, checkStock, getRecipeByProductId } = useInventoryStore();
  const signOut = useAuthStore((s) => s.signOut);

  const [toast, setToast]       = useState({ visible: false, message: '', type: 'success' });
  const [wasteMode, setWasteMode] = useState(false);
  const [manualProd, setManualProd] = useState(null); // producto abierto en modal manual

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });

  // Productos asignados al punto (o todos si no hay asignados)
  const filteredProducts = products.filter(
    (p) => !p.productionPointIds?.length || p.productionPointIds.includes(productionPoint.id)
  );
  const displayProducts = filteredProducts.length > 0 ? filteredProducts : products;

  // Enriquecer con stock y receta
  const enriched = displayProducts.map((prod) => {
    const recipe     = getRecipeByProductId(prod.id);
    const stockCheck = recipe ? checkStock(recipe.id, 1) : { canProduce: true, missing: [] };
    const productInv = inventory.find((i) => prod.outputInventoryId ? i.id === prod.outputInventoryId : i.name === prod.name);
    return {
      ...prod,
      stockOk:      stockCheck.canProduce,
      missing:      stockCheck.missing,
      currentStock: productInv?.qty ?? 0,
      recipe,
    };
  });

  const handleProduce = (product, batches = 1) => {
    if (wasteMode) {
      const recipe  = getRecipeByProductId(product.id);
      const qty     = batches * (recipe?.yieldQty ?? 1);
      const invId   = product.outputInventoryId
        ?? inventory.find((i) => i.name === product.name)?.id;
      if (invId) reportWaste(invId, qty, 'Descarte en producción', productionPoint.id);
      showToast(`🗑️ Descarte registrado: ${qty} ${recipe?.yieldUnit ?? product.unit}`, 'warning');
      return;
    }
    const result = produceItem(product.id, batches, productionPoint.id);
    showToast(result.message, result.ok ? 'success' : 'error');
  };

  const handleManualConfirm = (product, amount, mode) => {
    const recipe  = getRecipeByProductId(product.id);
    if (mode === 'WASTE') {
      const qty   = amount * (recipe?.yieldQty ?? 1);
      const invId = product.outputInventoryId
        ?? inventory.find((i) => i.name === product.name)?.id;
      if (invId) reportWaste(invId, qty, 'Descarte manual', productionPoint.id);
      showToast(`🗑️ Descarte: -${qty} ${recipe?.yieldUnit ?? product.unit}`, 'warning');
    } else {
      const result = produceItem(product.id, amount, productionPoint.id);
      showToast(result.message, result.ok ? 'success' : 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Modal Manual */}
      {manualProd && (
        <ManualModal
          product={manualProd}
          recipe={getRecipeByProductId(manualProd.id)}
          wasteMode={wasteMode}
          onClose={() => setManualProd(null)}
          onConfirm={(amount, mode) => handleManualConfirm(manualProd, amount, mode)}
        />
      )}

      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100"
            onClick={onBack}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-base font-black text-chunky-dark leading-none">{productionPoint.name}</h1>
            <p className="text-xs font-bold text-gray-400">{productionPoint.location} · Operario</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={wasteMode ? 'primary' : 'outline'}
            className="text-sm rounded-full font-bold px-4 border-gray-200"
            onClick={() => setWasteMode(!wasteMode)}
          >
            {wasteMode ? '⚠️ SALIR DESCARTE' : '🗑️ MODO DESCARTE'}
          </Button>
          <Button
            variant="outline"
            className="w-9 h-9 !min-w-0 !p-0 rounded-full flex items-center justify-center border-gray-200 hover:bg-red-50"
            onClick={signOut}
            title="Cerrar sesión"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </Button>
        </div>
      </header>

      {wasteMode && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-center shrink-0">
          <p className="font-bold text-red-600 text-xs tracking-wide">⚠️ MODO DESCARTE ACTIVO – Registra productos dañados o rechazados</p>
        </div>
      )}

      {/* Grid de productos */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {enriched.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">📋</span>
            <h3 className="text-xl font-black text-chunky-dark mb-2">Sin productos asignados</h3>
            <p className="text-gray-400 font-bold text-sm">El Admin puede asignar productos a este punto de producción.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 max-w-7xl mx-auto">
            {enriched.map((prod) => (
              <ProductCard
                key={prod.id}
                prod={prod}
                productionPoint={productionPoint}
                wasteMode={wasteMode}
                onProduce={handleProduce}
                onManual={(p) => setManualProd(p)}
              />
            ))}
          </div>
        )}
      </div>

      <Toast visible={toast.visible} message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
}

// ─── Exportación Principal ─────────────────────────────────────────────────────
export function ProductionView() {
  const signOut = useAuthStore((s) => s.signOut);
  const [selectedPoint, setSelectedPoint] = useState(null);

  if (!selectedPoint) {
    return <SelectProductionPoint onSelect={setSelectedPoint} signOut={signOut} />;
  }

  return <ProductionPanel productionPoint={selectedPoint} onBack={() => setSelectedPoint(null)} />;
}
