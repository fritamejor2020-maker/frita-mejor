import React, { useState, useEffect } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Edit2, Check, Trash2, Plus, X, Search, ShoppingCart, Shuffle } from 'lucide-react';
import { formatMoney } from '../../utils/formatUtils';
import { MoneyInput } from '../ui/MoneyInput';
import { push } from '../../lib/syncManager';

type Mode = 'list' | 'add-select' | 'add-custom';
type PriceType = 'fijo' | 'variable';

export const AdminPricesTab = () => {
  const { inventory, updateInventoryItem, addInventoryItem, deleteInventoryItem } = useInventoryStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editIsVariable, setEditIsVariable] = useState<boolean>(false);
  const [mode, setMode] = useState<Mode>('list');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Push current inventory to Supabase whenever this tab is opened,
  // so local changes (deletions, additions) are reflected remotely immediately.
  useEffect(() => {
    push('inventory', useInventoryStore.getState().inventory).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Custom product form
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customPriceType, setCustomPriceType] = useState<PriceType>('fijo');
  const [customAbbrev, setCustomAbbrev] = useState('');
  const [customPresets, setCustomPresets] = useState<string[]>(['5', '10', '15', '20']);
  const [presetInput, setPresetInput] = useState('');

  // Products SHOWN in the Precios Maestros list = any item that already has a price set
  const products = inventory.filter(
    (i: any) => (i.type === 'PRODUCTO' || i.type === 'FRITO') && i.price != null
  );

  // ALL inventory items NOT already in the priced list (any type)
  const pricedIds = new Set(products.map((p: any) => p.id));
  const allInventoryProducts = inventory.filter(
    (i: any) => !pricedIds.has(i.id)
  );
  const filteredInventory = allInventoryProducts.filter((i: any) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setEditPrice(p.price);
    setEditIsVariable(p.price === 0);
  };

  const handleSave = (id: string) => {
    updateInventoryItem(id, { price: editIsVariable ? 0 : editPrice });
    setEditingId(null);
  };

  const handleAddFromInventory = (item: any) => {
    // Set price=0 and ensure type is PRODUCTO so getPosItems() includes it in Dejador/Vendedor
    updateInventoryItem(item.id, {
      price: 0,
      type: item.type === 'FRITO' ? 'FRITO' : 'PRODUCTO',
    });
    setMode('list');
    setSearch('');
    // Open the price editor immediately so admin can set the price
    setEditingId(item.id);
    setEditPrice(0);
    setEditIsVariable(true); // new items from inventory default to variable
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    // Parse presets: try numbers first, keep as strings if letters
    const parsedPresets = customPresets
      .map(v => v.trim())
      .filter(v => v.length > 0)
      .map(v => isNaN(Number(v)) ? v : Number(v));
    addInventoryItem({
      warehouseId: 'BOD-003',
      name: customName.trim(),
      qty: 0,
      unit: 'ud',
      type: 'PRODUCTO',
      alert: 0,
      price: customPriceType === 'variable' ? 0 : customPrice,
      abbreviation: customAbbrev.trim() || undefined,
      inventoryPresets: parsedPresets.length > 0 ? parsedPresets : undefined,
    });
    setCustomName('');
    setCustomPrice(0);
    setCustomPriceType('fijo');
    setCustomAbbrev('');
    setCustomPresets(['5', '10', '15', '20']);
    setMode('list');
  };

  const handleDelete = (id: string) => {
    // Find the item — if it's a custom product (added via addInventoryItem with qty=0), delete it;
    // otherwise just remove the price so it goes back to the inventory pool without breaking other modules.
    const item = inventory.find((i: any) => i.id === id);
    const isCustom = item?.qty === 0 && item?.alert === 0 && item?.unit === 'ud' && item?.warehouseId === 'BOD-003';
    if (isCustom) {
      deleteInventoryItem(id);
    } else {
      updateInventoryItem(id, { price: null });
    }
    setConfirmDeleteId(null);
  };

  // Separate lists: variable first, then fixed
  const variableProducts = products.filter((p: any) => p.price === 0);
  const fixedProducts = products.filter((p: any) => p.price > 0);

  return (
    <div className="p-4 bg-[#FFD56B] flex-1 rounded-bl-[32px] rounded-br-[32px] md:rounded-[32px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-3">
        <h2 className="text-2xl font-black text-gray-800">Productos Triciclos</h2>
        <button
          onClick={() => { setMode('add-select'); setSearch(''); }}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-black px-4 py-2.5 rounded-2xl shadow-md hover:bg-gray-700 transition-all active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Agregar
        </button>
      </div>
      <p className="text-xs font-bold text-gray-400 mb-6 bg-frita-yellow/20 p-3 rounded-lg border border-frita-yellow/50">
        💡 Cambiar precios no afecta los reportes pasados ya que el precio se guarda con cada cierre.
      </p>

      {/* Product list */}
      <div className="space-y-3">

        {/* ── Precio Variable ─── */}
        {variableProducts.length > 0 && (
          <div className="mb-1">
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Shuffle size={12} /> Precio Variable
            </p>
            <div className="space-y-2">
              {variableProducts.map((p: any) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  editingId={editingId}
                  editPrice={editPrice}
                  editIsVariable={editIsVariable}
                  setEditPrice={setEditPrice}
                  setEditIsVariable={setEditIsVariable}
                  handleSave={handleSave}
                  openEdit={openEdit}
                  setEditingId={setEditingId}
                  confirmDeleteId={confirmDeleteId}
                  setConfirmDeleteId={setConfirmDeleteId}
                  handleDelete={handleDelete}
                  updateInventoryItem={updateInventoryItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Precio Fijo ─── */}
        {fixedProducts.length > 0 && (
          <div>
            {variableProducts.length > 0 && (
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 mt-4 flex items-center gap-1.5">
                📌 Precio Fijo
              </p>
            )}
            <div className="space-y-2">
              {fixedProducts.map((p: any) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  editingId={editingId}
                  editPrice={editPrice}
                  editIsVariable={editIsVariable}
                  setEditPrice={setEditPrice}
                  setEditIsVariable={setEditIsVariable}
                  handleSave={handleSave}
                  openEdit={openEdit}
                  setEditingId={setEditingId}
                  confirmDeleteId={confirmDeleteId}
                  setConfirmDeleteId={setConfirmDeleteId}
                  handleDelete={handleDelete}
                  updateInventoryItem={updateInventoryItem}
                />
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-bold">No hay productos aún. Agrega uno con el botón de arriba.</p>
          </div>
        )}
      </div>

      {/* ── Modal: agregar producto ─────────────────── */}
      {mode === 'add-select' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={() => setMode('list')}
        >
          <div
            className="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-900 text-lg">Agregar Producto</h3>
              <button onClick={() => setMode('list')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Opción: personalizado */}
            <button
              onClick={() => setMode('add-custom')}
              className="flex items-center gap-3 w-full p-4 rounded-2xl border-2 border-gray-100 hover:border-gray-900 hover:bg-gray-50 transition-all text-left mb-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white flex-shrink-0">
                <Plus size={18} strokeWidth={3} />
              </div>
              <div>
                <p className="font-black text-gray-900">Producto personalizado</p>
                <p className="text-xs font-bold text-gray-400">Nombre y precio libre, sin inventario</p>
              </div>
            </button>

            {/* Desde inventario */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Desde inventario</p>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 outline-none focus:border-amber-400"
                autoFocus
              />
            </div>
            <div className="max-h-44 overflow-y-auto flex flex-col gap-1.5">
              {filteredInventory.length === 0 ? (
                <p className="text-center text-xs font-bold text-gray-400 py-4">
                  {search ? 'Sin resultados para "' + search + '"' : 'Escribe para buscar en el inventario'}
                </p>
              ) : (
                filteredInventory.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddFromInventory(item)}
                    className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all text-left gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${
                        item.type === 'FRITO' ? 'bg-orange-100 text-orange-600' :
                        item.type === 'PRODUCTO' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{item.type}</span>
                      <span className="font-bold text-gray-800 text-sm truncate">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400 shrink-0">{item.unit}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: producto personalizado ───────── */}
      {mode === 'add-custom' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={() => setMode('list')}
        >
          <div
            className="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-900 text-lg">Producto Personalizado</h3>
              <button onClick={() => setMode('list')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Nombre */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Salchicha Ranchera"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-800 outline-none focus:border-gray-900"
                  autoFocus
                />
              </div>

              {/* Abreviación + preview */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Abreviación <span className="normal-case font-medium text-gray-300">(máx. 3 letras)</span></label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Ej: SR"
                    value={customAbbrev}
                    onChange={(e) => setCustomAbbrev(e.target.value.toUpperCase())}
                    className="w-24 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 outline-none focus:border-gray-900 text-center tracking-widest"
                  />
                  <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white text-xs font-black">
                    {customAbbrev || (customName ? customName.slice(0,3).toUpperCase() : '??')}
                  </div>
                  <p className="text-xs text-gray-400 font-bold flex-1">Así aparece en los reportes y tarjetas</p>
                </div>
              </div>

              {/* ── Tipo de Precio ── */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tipo de Precio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomPriceType('fijo')}
                    className={`flex flex-col items-center gap-1 py-3 px-3 rounded-2xl border-2 transition-all font-black text-sm ${
                      customPriceType === 'fijo'
                        ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    📌 Fijo
                    <span className="text-[10px] font-bold opacity-70">Precio definido</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomPriceType('variable')}
                    className={`flex flex-col items-center gap-1 py-3 px-3 rounded-2xl border-2 transition-all font-black text-sm ${
                      customPriceType === 'variable'
                        ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-amber-300'
                    }`}
                  >
                    💱 Variable
                    <span className="text-[10px] font-bold opacity-70">Vendedor ingresa</span>
                  </button>
                </div>
                {customPriceType === 'variable' && (
                  <p className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
                    El vendedor ingresará el precio al momento de cada venta.
                  </p>
                )}
              </div>

              {/* Precio (solo si fijo) */}
              {customPriceType === 'fijo' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Precio de venta</label>
                  <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-900">
                    <span className="px-4 py-3 text-gray-400 font-bold">$</span>
                    <MoneyInput
                      value={String(customPrice)}
                      onChange={(v) => setCustomPrice(parseInt(v) || 0)}
                      className="bg-transparent outline-none font-black py-3 text-gray-900 flex-1"
                    />
                  </div>
                </div>
              )}

              {/* Valores de los botones */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Botones de cantidad</label>
                <p className="text-[11px] text-gray-400 mb-2">Pueden ser números o letras (ej: S, M, L, XL)</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {customPresets.map((v, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="w-9 h-9 rounded-full border-2 border-gray-900 bg-gray-50 flex items-center justify-center text-xs font-black text-gray-900">{v}</span>
                      <button
                        onClick={() => setCustomPresets(prev => prev.filter((_, idx) => idx !== i))}
                        className="w-5 h-5 rounded-full bg-red-100 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center text-[10px] font-black transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {customPresets.length < 6 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Valor…"
                      value={presetInput}
                      onChange={(e) => setPresetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && presetInput.trim()) {
                          setCustomPresets(prev => [...prev, presetInput.trim()]);
                          setPresetInput('');
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-800 outline-none focus:border-gray-900"
                    />
                    <button
                      onClick={() => {
                        if (presetInput.trim()) {
                          setCustomPresets(prev => [...prev, presetInput.trim()]);
                          setPresetInput('');
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-black hover:bg-gray-700 transition-colors"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleAddCustom}
                disabled={!customName.trim()}
                className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-black text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors active:scale-95"
              >
                Agregar Producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-componente reutilizable para cada fila de producto ────────────────
interface ProductRowProps {
  p: any;
  editingId: string | null;
  editPrice: number;
  editIsVariable: boolean;
  setEditPrice: (v: number) => void;
  setEditIsVariable: (v: boolean) => void;
  handleSave: (id: string) => void;
  openEdit: (p: any) => void;
  setEditingId: (id: string | null) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleDelete: (id: string) => void;
  updateInventoryItem: (id: string, data: any) => void;
}

const ProductRow = ({
  p, editingId, editPrice, editIsVariable,
  setEditPrice, setEditIsVariable,
  handleSave, openEdit, setEditingId,
  confirmDeleteId, setConfirmDeleteId, handleDelete,
  updateInventoryItem,
}: ProductRowProps) => {
  const isEditing = editingId === p.id;
  const isVariable = p.price === 0;

  return (
    <div className={`bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center gap-3 ${
      isVariable ? 'border-amber-200' : 'border-gray-100'
    }`}>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="font-bold text-gray-800 text-lg leading-tight truncate">{p.name}</span>
        {/* showInPos badge */}
        <button
          onClick={() => updateInventoryItem(p.id, { showInPos: !(p.showInPos !== false) })}
          title={p.showInPos !== false ? 'Visible en POS vendedor — clic para ocultar' : 'Oculto en POS vendedor — clic para mostrar'}
          className={`ml-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 transition-all ${
            p.showInPos !== false
              ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-500'
              : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
          }`}
        >
          <ShoppingCart size={10} />
          {p.showInPos !== false ? 'POS' : 'No POS'}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isEditing ? (
          <>
            {/* Toggle fijo / variable mientras se edita */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 text-[11px] font-black">
              <button
                onClick={() => { setEditIsVariable(false); }}
                className={`px-2.5 py-1.5 transition-colors ${!editIsVariable ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                📌 Fijo
              </button>
              <button
                onClick={() => { setEditIsVariable(true); }}
                className={`px-2.5 py-1.5 transition-colors ${editIsVariable ? 'bg-amber-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                💱 Variable
              </button>
            </div>

            {/* Input de precio (solo si fijo) */}
            {!editIsVariable && (
              <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-frita-orange">
                <span className="px-3 py-2 text-gray-400 font-bold">$</span>
                <MoneyInput
                  value={String(editPrice)}
                  onChange={(v) => setEditPrice(parseInt(v) || 0)}
                  className="bg-transparent outline-none font-black w-20 py-2 text-frita-red"
                />
              </div>
            )}

            <button
              onClick={() => handleSave(p.id)}
              className="bg-green-500 text-white p-2.5 rounded-xl shadow-sm hover:scale-105 transition-transform"
            >
              <Check size={18} strokeWidth={3} />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="bg-gray-100 text-gray-400 hover:text-gray-700 p-2.5 rounded-xl transition-colors"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <>
            {/* Precio o badge Variable */}
            {isVariable ? (
              <span className="flex items-center gap-1 bg-amber-100 text-amber-700 font-black text-xs px-3 py-1.5 rounded-full border border-amber-200">
                <Shuffle size={11} /> Variable
              </span>
            ) : (
              <span className="font-black text-frita-red text-xl">{formatMoney(p.price)}</span>
            )}

            <button
              onClick={() => openEdit(p)}
              className="bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-2.5 rounded-xl transition-colors"
            >
              <Edit2 size={18} strokeWidth={3} />
            </button>

            {confirmDeleteId === p.id ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-red-500">¿Eliminar?</span>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="bg-red-500 text-white text-xs font-black px-2.5 py-1.5 rounded-xl hover:bg-red-600 transition-colors"
                >
                  Sí
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="bg-gray-100 text-gray-500 text-xs font-black px-2.5 py-1.5 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(p.id)}
                className="bg-gray-100 text-gray-300 hover:text-red-400 hover:bg-red-50 p-2.5 rounded-xl transition-colors"
              >
                <Trash2 size={18} strokeWidth={2.5} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
