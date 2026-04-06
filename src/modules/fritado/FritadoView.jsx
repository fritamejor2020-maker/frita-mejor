import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Toast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useInventoryStore } from '../../store/useInventoryStore';

// Fritado configurations are now loaded dynamically from useInventoryStore (fritadoRecipes).

function SelectFritadoPoint({ onSelect, signOut }) {
  // Simulamos puntos de fritado, para el ejemplo usaremos los puntos de producción
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
              <button
                key={pp.id}
                className="w-full border-2 border-gray-100 rounded-3xl p-5 text-left hover:border-chunky-secondary hover:shadow-sm transition-all active:scale-[0.98] group"
                onClick={() => onSelect(pp)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-2xl border border-yellow-100 shrink-0">
                    🍳
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-chunky-dark text-lg leading-tight group-hover:text-chunky-dark">{pp.name}</h3>
                    <p className="text-gray-400 font-bold text-sm mt-0.5">{pp.location}</p>
                  </div>
                  <svg className="text-gray-300 group-hover:text-chunky-secondary transition-colors shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          className="w-full text-center text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors py-2"
          onClick={signOut}
        >
          ← Cambiar de rol o salir
        </button>
      </div>
    </div>
  );
}

// ─── Modal de Acción (Manual o Merma Rápida) ──────────────────────────────────
function ActionModal({ config, wasteMode, onClose, onConfirm }) {
  const [qty, setQty]   = useState(config.amount ? String(config.amount) : '');
  const [mode, setMode] = useState(config.isWasteFast || wasteMode ? 'WASTE' : 'FRY');
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
            <button
              className={`flex-1 py-2 rounded-full font-bold text-sm transition-all ${mode === 'FRY' ? 'bg-chunky-secondary text-white' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setMode('FRY')}
            >Fritar</button>
            <button
              className={`flex-1 py-2 rounded-full font-bold text-sm transition-all ${mode === 'WASTE' ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setMode('WASTE')}
            >Merma de Crudo</button>
          </div>
        )}

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          Cantidad en unidades
        </p>
        <input
          type="number" min="0" step="1"
          placeholder="0"
          className="w-full text-5xl font-black text-center border-2 border-gray-200 rounded-2xl p-4 mb-4 outline-none focus:border-chunky-main disabled:bg-gray-50 disabled:text-gray-400"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          autoFocus={!config.isWasteFast}
          disabled={config.isWasteFast}
        />

        {mode === 'WASTE' && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Motivo de la pérdida</p>
            <select
              className="w-full border-2 border-gray-200 rounded-2xl p-3 font-bold text-chunky-dark outline-none focus:border-red-400 bg-white"
              value={reason} onChange={(e) => setReason(e.target.value)}
            >
              <option value="Dañado / Defectuoso">Dañado / Defectuoso</option>
              <option value="Quemado">Quemado</option>
              <option value="Masa mala / Mal estado">Masa mala / Mal estado</option>
              <option value="Caída al piso">Caída al piso</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button className="flex-1 border border-gray-200 text-gray-400 font-bold py-3 rounded-full" onClick={onClose}>Cancelar</button>
          <button
            className={`flex-1 text-white font-bold py-3 rounded-full ${mode === 'FRY' ? 'bg-chunky-secondary' : 'bg-red-400'}`}
            onClick={handleSubmit}
          >Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de producto para fritos ─────────────────────────────────────────
function FritadoCard({ pair, productionPoint, wasteMode, onFry, onManual }) {
  const cardClass = wasteMode
    ? 'border-dashed border-2 border-red-300 bg-red-50/20'
    : pair.crudo.qty > 0
      ? 'border border-gray-100 hover:border-chunky-secondary/40 bg-white'
      : 'border border-red-200 bg-red-50/30 ring-1 ring-red-200';

  const presets = pair.presets || [10, 20, 50, 100, 200];
  const [bigPreset, ...smallPresets] = presets;
  const isDisabled  = pair.crudo.qty === 0 && !wasteMode;

  const btnBase = wasteMode
    ? 'bg-red-400 hover:bg-red-500 text-white border-2 border-red-500 disabled:opacity-40'
    : isDisabled
      ? 'bg-gray-100 text-gray-300 border-2 border-gray-200 cursor-not-allowed'
      : 'bg-chunky-main hover:bg-chunky-secondary text-chunky-dark hover:text-white border-2 border-chunky-secondary shadow-sm';

  return (
    <div className={`rounded-3xl p-6 md:p-8 flex flex-col gap-6 transition-all shadow-sm ${cardClass}`}>
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-black text-chunky-dark text-xl md:text-2xl leading-tight truncate">{pair.frito.name}</h3>
          <p className="text-xs text-gray-400 mt-1">Masa/Origen: <span className="font-bold text-gray-600">{pair.crudo.name}</span></p>
        </div>

        {/* Cajas de Inventario Mejoradas */}
        <div className="flex bg-gray-50 border border-gray-100 rounded-[20px] overflow-hidden p-1.5 shadow-inner items-stretch">
          <div className="flex-1 px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
             <span className="text-[10px] uppercase font-black text-gray-400 mb-0.5 tracking-wide">Crudo / Origen</span>
             {pair.crudo.qty === 0 && !wasteMode ? (
               <span className="text-sm font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md mt-1">Agotado</span>
             ) : (
               <div className="flex items-baseline gap-1 mt-1">
                 <span className="text-2xl font-black text-green-600">{pair.crudo.qty}</span>
                 <span className="text-xs font-bold text-gray-400">uds</span>
               </div>
             )}
          </div>
          
          <div className="w-8 flex items-center justify-center shrink-0 text-gray-300 font-bold">
             ➡️
          </div>
          
          <div className="flex-1 px-4 py-3 bg-yellow-50 rounded-xl shadow-sm border border-yellow-200/60 flex flex-col justify-center items-center rounded-r-2xl">
             <span className="text-[10px] uppercase font-black text-yellow-600/80 mb-0.5 tracking-wide">Listas / Fritas</span>
             <div className="flex items-baseline gap-1 mt-1">
               <span className="text-2xl font-black text-chunky-dark">{pair.frito.qty}</span>
               <span className="text-xs font-bold text-gray-500">uds</span>
             </div>
          </div>
        </div>
      </div>

      {wasteMode && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 text-center">
          <span className="text-xs font-bold text-red-500">🗑️ MERMA (Quema Crudo)</span>
        </div>
      )}

      {/* Botón grande */}
      <button
        disabled={isDisabled}
        onClick={() => onFry(pair, bigPreset)}
        className={`w-full rounded-2xl py-6 flex flex-col items-center justify-center gap-1 font-black transition-all active:scale-[0.97] select-none ${btnBase}`}
      >
        <span className="text-3xl leading-none">{bigPreset}</span>
        <span className="text-sm font-bold opacity-80">uds</span>
      </button>

      {/* Botones pequeños */}
      <div className="grid grid-cols-4 gap-2">
        {smallPresets.map((amount, idx) => (
          <button
            key={idx}
            disabled={isDisabled}
            onClick={() => onFry(pair, amount)}
            className={`rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 font-black transition-all active:scale-95 select-none ${btnBase}`}
          >
            <span className="text-base leading-none">{amount}</span>
            <span className="text-[10px] font-bold opacity-80">uds</span>
          </button>
        ))}
      </div>

      {/* Manual */}
      <button
        onClick={() => onManual(pair)}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-gray-400 font-bold text-sm hover:border-chunky-main hover:text-chunky-dark transition-all active:scale-[0.98]"
      >
        ✏️ MANUAL
      </button>
    </div>
  );
}

// ─── Panel Principal de Fritado ────────────────────────────────────────────
function FritadoPanel({ productionPoint, onBack }) {
  const { inventory, fritadoRecipes, fryItem, reportWaste } = useInventoryStore();
  const signOut = useAuthStore((s) => s.signOut);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [wasteMode, setWasteMode] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });

  // Construir pares (crudo -> frito) desde el inventario usando los mappings configurados por el Admin
  const pairs = (fritadoRecipes || [])
    .filter(recipe => !recipe.productionPointIds || recipe.productionPointIds.length === 0 || recipe.productionPointIds.includes(productionPoint.id))
    .map(recipe => {
    const crudoItem = inventory.find(i => i.id === recipe.crudoId) || { id: null, qty: 0, name: 'Inválido' };
    const fritoItem = inventory.find(i => i.id === recipe.fritoId) || { id: null, qty: 0, name: 'Inválido' };
    return { crudo: crudoItem, frito: fritoItem, presets: recipe.presets };
  }).filter(p => p.crudo.id && p.frito.id); // Solo mostramos si ambos existen

  const handleFry = (pair, amount) => {
    if (wasteMode) {
      setModalConfig({ pair, amount, isWasteFast: true });
      return;
    }
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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {modalConfig && (
        <ActionModal
          config={modalConfig}
          wasteMode={wasteMode}
          onClose={() => setModalConfig(null)}
          onConfirm={handleModalConfirm}
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
            <h1 className="text-base font-black text-chunky-dark leading-none">Puesto: {productionPoint.name}</h1>
            <p className="text-xs font-bold text-gray-400">Panel de Fritado</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={wasteMode ? 'primary' : 'outline'}
            className="text-sm rounded-full font-bold px-4 border-gray-200"
            onClick={() => setWasteMode(!wasteMode)}
          >
            {wasteMode ? '⚠️ SALIR MERMA' : '🗑️ MODO MERMA'}
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
          <p className="font-bold text-red-500 text-xs">⚠️ MODO MERMA ACTIVO – Descuenta del inventario CRUDO por mal estado o daño.</p>
        </div>
      )}

      {/* Grid de productos */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {pairs.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🧊</span>
            <h3 className="text-xl font-black text-chunky-dark mb-2">No hay crudos vinculados</h3>
            <p className="text-gray-400 font-bold text-sm">El sistema no detecta productos configurados para fritado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {pairs.map((pair, i) => (
              <FritadoCard
                key={i}
                pair={pair}
                productionPoint={productionPoint}
                wasteMode={wasteMode}
                onFry={handleFry}
                onManual={(p) => setModalConfig({ pair: p })}
              />
            ))}
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

  if (!selectedPoint) {
    return <SelectFritadoPoint onSelect={setSelectedPoint} signOut={signOut} />;
  }

  return <FritadoPanel productionPoint={selectedPoint} onBack={() => setSelectedPoint(null)} />;
}
