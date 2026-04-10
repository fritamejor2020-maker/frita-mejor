import React, { useState, useEffect } from 'react';
import { Calculator, Package, DollarSign, X, Zap, LogOut, Check, Pencil, Save } from 'lucide-react';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { usePosStore } from '../store/usePosStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { calculateClosingStatus } from '../utils/financeUtils';
import { formatMoney, getProductAbbreviation } from '../utils/formatUtils';
import { NumberSelectorGroup } from '../components/ui/NumberSelectorGroup';
import { MoneyInput } from '../components/ui/MoneyInput';
import { BottomNav } from '../components/ui/BottomNav';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export const VendedorDashboard = () => {
  const { isSetupComplete, pointId, responsibleName, endShift } = useSellerSessionStore();
  const { cart, total, addToCart, checkout, clearCart } = usePosStore();
  const { restockCart, addToRestockCart, sendRestockRequest, clearRestockCart } = useLogisticsStore();
  const { inventory, loadTemplates, addLoadTemplate } = useInventoryStore();
  const { user, signOut, updateUserPresets } = useAuthStore();
  
  const presets: number[] = (user as any)?.restockPresets || [5, 10, 15, 20];
  const vendedorTemplates = loadTemplates?.filter((t: any) => t.role === 'VENDEDOR') || [];

  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState<any[]>([]);

  // Cierre state
  const [cash, setCash] = useState('');
  const [transfer, setTransfer] = useState('');
  const [expenses, setExpenses] = useState('');
  const [expensesDesc, setExpensesDesc] = useState('');
  const [theorySales, setTheorySales] = useState(0);

  // Modal edición de presets por producto
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draftPresets, setDraftPresets] = useState<string[]>([]);

  const productPresets = (user as any)?.productPresets || {};
  const DEFAULT_PRESETS = [5, 10, 15, 20];

  const getPresetsForProduct = (productId: string): number[] =>
    productPresets[productId] || DEFAULT_PRESETS;

  const openProductPresets = (productId: string) => {
    setDraftPresets(getPresetsForProduct(productId).map(String));
    setEditingProductId(productId);
  };

  const saveProductPresets = () => {
    if (!editingProductId) return;
    const parsed = draftPresets.map(v => parseInt(v, 10)).filter(n => !isNaN(n) && n > 0);
    if (parsed.length < 1) { toast.error('Ingresa al menos un valor'); return; }
    const newProductPresets = { ...productPresets, [editingProductId]: parsed };
    updateUserPresets((user as any).id, newProductPresets);
    toast.success('Botones actualizados ✔');
    setEditingProductId(null);
  };

  // Custom states for manual input toggles
  const [manualInputOpen, setManualInputOpen] = useState<string | null>(null);

  const [variablePriceProduct, setVariablePriceProduct] = useState<any>(null);
  const [variablePriceInput, setVariablePriceInput] = useState('');

  useEffect(() => {
    const sellable = inventory.filter((i: any) => i.type === 'FRITO' || i.type === 'PRODUCTO');
    setProducts(sellable);
  }, [inventory]);

  if (!isSetupComplete) {
    return <Navigate to="/vendedor-setup" replace />;
  }

  const handleCheckout = async () => {
    try {
      const saleTotal = await checkout(pointId as string);
      // alert(`Venta registrada exitosamente. Cobrar: $${saleTotal}`);
      setTheorySales(prev => prev + saleTotal);
    } catch (err: any) {
      alert("Error al vender: " + err.message);
    }
  };

  const handleSendRestock = async () => {
    try {
      await sendRestockRequest(pointId as string, responsibleName as string);
      toast.success("Solicitud de surtido enviada exitosamente");
      clearRestockCart();
    } catch (err: any) {
      toast.error("Error al pedir surtido: " + err.message);
    }
  };

  const handleSaveTemplate = () => {
    // Only save items that have a quantity > 0 in the restock cart
    const itemsToSave: Record<string, number> = {};
    restockCart.forEach((item: any) => {
      if (item.qty > 0) itemsToSave[item.productId] = item.qty;
    });

    if (Object.keys(itemsToSave).length === 0) {
      toast.error("Agrega productos al pedido antes de guardar una plantilla");
      return;
    }

    const name = window.prompt("Nombre de esta Carga Guardada:");
    if (!name) return;
    
    addLoadTemplate({
      name,
      role: 'VENDEDOR',
      items: itemsToSave
    });
    toast.success('Plantilla guardada exitosamente');
  };

  const loadTemplateItems = (templateId: string) => {
    const tpl = vendedorTemplates.find((t: any) => t.id === templateId);
    if (!tpl) return;
    
    // Clear current cart and load the new one
    clearRestockCart();
    // Re-populate using addToRestockCart (which requires name, so we find it in products)
    Object.entries(tpl.items).forEach(([pId, qty]) => {
      const prod = products.find(p => p.id === pId);
      if (prod && typeof qty === 'number') {
        addToRestockCart(pId, qty, prod.name);
      }
    });
    toast.success(`⚡ Plantilla "${tpl.name}" aplicada`);
  };

  const handleCloseShift = async () => {
    const cashVal = parseInt(cash) || 0;
    const transferVal = parseInt(transfer) || 0;
    const expensesVal = parseInt(expenses) || 0;
    const { difference, status } = calculateClosingStatus(theorySales, cashVal, transferVal, expensesVal);

    try {
      alert(`Cierre exitoso. Diferencia: ${formatMoney(difference)} (${status})`);
      endShift();
      signOut();
    } catch (err: any) {
      alert("Error en cierre: " + err.message);
    }
  };

  const tabs = [
    { id: 'pos', label: 'Venta', icon: <Calculator size={24} /> },
    { id: 'restock', label: 'Pedir', icon: <Package size={24} /> },
    { id: 'close', label: 'Cierre', icon: <DollarSign size={24} /> }
  ];

  const getHeaderTitle = () => {
    if (activeTab === 'pos') return 'Venta Rápida';
    if (activeTab === 'restock') return 'Pedir Surtido';
    if (activeTab === 'close') return 'Cierre Caja';
    return 'Dashboard';
  };

  const currentDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

  return (
    <div className="min-h-screen bg-[#FFD56B] font-sans w-full flex flex-col" style={{ paddingBottom: activeTab === 'pos' ? '240px' : '160px' }}>
      {/* HEADER */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-5 sm:pt-8 pb-4 sm:pb-6 px-4 sm:px-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight leading-none">{getHeaderTitle()}</h1>
            <p className="text-xs sm:text-sm font-bold text-gray-400 mt-1 sm:mt-2">{formattedDate}</p>
          </div>
          
          <button 
             onClick={() => { endShift(); signOut(); }}
             className="w-12 h-12 bg-white border-2 border-red-50 rounded-full flex items-center justify-center shadow-sm text-[#FF4040] hover:bg-red-50 transition-all active:scale-95"
          >
            <LogOut size={20} strokeWidth={2.5} className="ml-1" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        
        {/* SUBVISTA: POS (Venta Rápida) */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  if (!p.price || p.price <= 0) {
                     setVariablePriceProduct(p);
                  } else {
                     addToCart(p, 1);
                  }
                }}
                className="bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-[#FF4040] transition-all duration-200 active:scale-95 flex flex-col items-center justify-center text-center p-2 sm:p-5 min-h-[80px] sm:min-h-[120px] hover:-translate-y-0.5 hover:shadow-md group gap-0.5"
              >
                <span className="font-black text-gray-900 text-lg sm:text-2xl tracking-wide group-hover:text-[#FF4040] transition-colors leading-none">
                  {getProductAbbreviation(p.name)}
                </span>
                <span className="text-[#FF4040] font-black text-[11px] sm:text-sm leading-tight">
                  {formatMoney(p.price)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* SUBVISTA: PEDIR SURTIDO */}
        {activeTab === 'restock' && (
          <div className="space-y-4">
            {/* Plantillas del Vendedor */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center border-b border-amber-200/50 mb-2">
              <span className="text-gray-500 font-bold text-sm shrink-0 uppercase tracking-wide">Cargas Listas:</span>
              {vendedorTemplates.map((tpl: any) => (
                <button 
                  key={tpl.id}
                  onClick={() => loadTemplateItems(tpl.id)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-white border-2 border-amber-400 font-bold text-amber-500 text-sm whitespace-nowrap active:scale-95 shadow-sm hover:bg-amber-50 transition-colors"
                >
                  <Zap size={14} /> {tpl.name}
                </button>
              ))}
              <button 
                onClick={handleSaveTemplate}
                className="flex items-center justify-center py-1.5 px-3 rounded-full border border-dashed border-gray-400 font-bold text-gray-500 text-sm whitespace-nowrap hover:border-gray-600 hover:text-gray-700 transition-colors shrink-0"
              >
                + Guardar Actual
              </button>
            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
               {products.map(p => {
                const currentQty = restockCart.find((i: any) => i.productId === p.id)?.qty || 0;
                const productPresetValues = getPresetsForProduct(p.id);
              return (
                <div key={p.id} className="bg-white rounded-[28px] flex flex-row items-center justify-between p-2 shadow-sm border border-gray-100">
                  {/* Cápsula izquierda: abreviación + editar */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div
                      className="bg-[#FF4040] text-white font-black text-base px-4 py-2.5 rounded-full min-w-[52px] text-center shadow-sm tracking-wide leading-none"
                      title={p.name}
                    >
                      {getProductAbbreviation(p.name)}
                    </div>
                    <button
                      onClick={() => openProductPresets(p.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors active:scale-90"
                      title={`Editar botones de ${p.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>

                  {/* Botones de cantidad */}
                  <div className="flex gap-1.5 items-center pr-1">
                     <NumberSelectorGroup
                       presets={productPresetValues}
                       value={currentQty}
                       onChange={(qty) => {
                          const diff = qty - currentQty;
                          addToRestockCart(p.id, diff, p.name);
                       }}
                     />
                  </div>
                </div>
              );
            })}
            </div>
            {/* Espaciador para que el último producto no quede detrás del botón flotante */}
            <div style={{ height: '80px' }} aria-hidden="true" />
          </div>
        )}

        {/* SUBVISTA: CIERRE CAJA */}
        {activeTab === 'close' && (
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
            
            {/* INFORMACIÓN DE JORNADA (Solo lectura) */}
            <div className="bg-amber-100/50 rounded-3xl sm:rounded-[40px] p-5 sm:p-8 border border-amber-200/50">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 sm:mb-4">Información de Jornada</h4>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-2 sm:mb-4">
                 <div className="flex-1 bg-white rounded-xl shadow-sm px-4 sm:px-6 py-3 sm:py-4 flex items-center font-black text-gray-800 text-base sm:text-lg">
                    {pointId || 'Punto no asignado'}
                 </div>
                 <div className="flex-1 bg-white rounded-xl shadow-sm px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-500 flex items-center text-base sm:text-lg">
                    {responsibleName || 'Vendedor no asignado'}
                 </div>
              </div>
            </div>

            {/* FORMULARIO FINANCIERO */}
            <div className="bg-white rounded-3xl sm:rounded-[40px] p-5 sm:p-10 shadow-sm border border-white">
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-10">
                 {/* EFECTIVO */}
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] sm:text-xs px-3 sm:px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest flex items-center gap-1 sm:gap-2">
                       <DollarSign size={14} strokeWidth={3} /> EFECTIVO
                    </div>
                    <MoneyInput
                      value={cash}
                      onChange={setCash}
                      placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-2xl sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-xl sm:text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
                    />
                 </div>

                 {/* TRANSFERENCIAS */}
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] sm:text-xs px-3 sm:px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest flex items-center gap-1 sm:gap-2">
                       <Zap size={14} strokeWidth={3} fill="currentColor" /> TRANSFERENCIAS
                    </div>
                    <MoneyInput
                      value={transfer}
                      onChange={setTransfer}
                      placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-2xl sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-xl sm:text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
                    />
                 </div>
               </div>

               {/* GASTOS */}
               <div className="relative pt-6 mb-8 sm:mb-10">
                  <div className="absolute top-0 left-4 bg-gray-900 text-white font-black text-[10px] sm:text-xs px-3 sm:px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest">
                     GASTOS / SALIDAS
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-gray-50 border-2 border-gray-100 rounded-[24px] sm:rounded-[28px] p-2">
                     <MoneyInput
                       value={expenses}
                       onChange={setExpenses}
                       placeholder="$ Valor"
                       className="w-full sm:w-1/3 bg-white rounded-[20px] sm:rounded-3xl py-3 px-4 sm:py-4 sm:px-6 font-black text-lg sm:text-xl text-gray-800 outline-none shadow-sm focus:ring-2 ring-[#FFB700] border-none"
                     />
                     <input 
                       type="text" 
                       value={expensesDesc}
                       onChange={(e) => setExpensesDesc(e.target.value)}
                       placeholder="Descripción del gasto..."
                       className="w-full sm:w-2/3 bg-transparent py-3 px-4 sm:py-4 sm:px-4 font-bold text-gray-500 text-sm sm:text-base outline-none"
                     />
                  </div>
               </div>
               
               <hr className="border-gray-100 border-dashed border-2 mb-6 sm:mb-8" />

               {/* TOTALIZADOR */}
               <div className="text-center">
                  <span className="block text-gray-400 font-bold text-xs sm:text-sm tracking-widest uppercase mb-1">Total Venta Neta</span>
                  <p className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tighter">
                    {formatMoney((parseInt(cash)||0) + (parseInt(transfer)||0))}
                  </p>
               </div>
            </div>

            <button 
              onClick={handleCloseShift}
              className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-[#FF4040] text-white font-black text-lg sm:text-2xl py-4 sm:py-6 rounded-[24px] sm:rounded-[32px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] hover:scale-[1.02] transition-all active:scale-95"
            >
              <Check size={24} strokeWidth={3} className="sm:hidden" /> 
              <Check size={28} strokeWidth={3} className="hidden sm:block" /> 
              CERRAR JORNADA
            </button>

          </div>
        )}

      </div>

      {/* BOTÓN FLOTANTE: ENVIAR SOLICITUD (siempre visible si hay items) */}
      {activeTab === 'restock' && restockCart.some((i: any) => i.qty > 0) && (
        <div className="fixed bottom-[72px] left-4 right-4 z-40 flex justify-center pointer-events-none">
          <button
            onClick={handleSendRestock}
            className="pointer-events-auto w-full max-w-lg bg-[#FF4040] text-white font-black text-lg py-4 rounded-full shadow-[0_15px_40px_-10px_rgba(255,64,64,0.6)] transition-all active:scale-95 hover:bg-red-500"
          >
            Enviar Solicitud
          </button>
        </div>
      )}

      {/* MODAL EDITAR PRESETS POR PRODUCTO */}
      {editingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[32px] p-7 shadow-2xl w-full max-w-sm animate-slide-up">
            {/* Título con abreviación del producto */}
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-[#FF4040] text-white font-black text-sm px-3 py-1.5 rounded-full">
                {getProductAbbreviation(products.find(p => p.id === editingProductId)?.name || '')}
              </div>
              <h3 className="font-black text-xl text-gray-900">Botones de cantidad</h3>
            </div>
            <p className="text-gray-400 font-bold text-sm mb-5">Valores de acceso rápido para este producto. Se guardan solo para ti.</p>

            <div className="flex gap-2 mb-6 flex-wrap">
              {draftPresets.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={val}
                    onChange={(e) => {
                      const next = [...draftPresets];
                      next[idx] = e.target.value;
                      setDraftPresets(next);
                    }}
                    className="w-16 h-14 rounded-2xl border-2 border-[#FF4040] text-center font-black text-gray-900 text-lg outline-none focus:border-[#FFB700] transition-colors shadow-sm"
                  />
                </div>
              ))}
              {draftPresets.length < 6 && (
                <button
                  onClick={() => setDraftPresets(prev => [...prev, ''])}
                  className="w-16 h-14 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 font-bold text-2xl flex items-center justify-center hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  +
                </button>
              )}
              {draftPresets.length > 1 && (
                <button
                  onClick={() => setDraftPresets(prev => prev.slice(0, -1))}
                  className="w-16 h-14 rounded-2xl border-2 border-dashed border-red-200 text-red-300 font-bold text-2xl flex items-center justify-center hover:border-red-400 hover:text-red-500 transition-colors"
                >
                  −
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingProductId(null)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-base hover:bg-gray-200 transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={saveProductPresets}
                className="flex-1 py-3 rounded-2xl bg-[#FF4040] text-white font-black text-base shadow-lg shadow-red-200 hover:bg-red-500 transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRECIO VARIABLE */}
      {variablePriceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[32px] p-7 shadow-2xl w-full max-w-sm animate-slide-up text-center">
             <h3 className="font-black text-2xl text-gray-900 mb-2">{variablePriceProduct.name}</h3>
             <p className="text-gray-500 font-bold mb-6">Ingresa el precio de venta (Precio Variable).</p>
             
             <div className="relative mb-6">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">$</span>
                <input 
                  autoFocus 
                  type="number"
                  value={variablePriceInput}
                  onChange={e => setVariablePriceInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                       const price = parseInt(variablePriceInput);
                       if (isNaN(price) || price <= 0) {
                           toast.error('Ingresa un precio válido');
                           return;
                       }
                       addToCart(variablePriceProduct, 1, price);
                       setVariablePriceProduct(null);
                       setVariablePriceInput('');
                    }
                  }}
                  className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#FF4040] rounded-[24px] py-4 pl-12 pr-6 text-3xl font-black text-gray-900 outline-none text-center transition-colors"
                  placeholder="0"
                />
             </div>

             <div className="flex gap-3">
                <button onClick={() => { setVariablePriceProduct(null); setVariablePriceInput(''); }} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-lg hover:bg-gray-200 transition-colors active:scale-95">
                  Cancelar
                </button>
                <button onClick={() => {
                  const price = parseInt(variablePriceInput);
                  if (isNaN(price) || price <= 0) {
                       toast.error('Ingresa un precio válido');
                       return;
                  }
                  addToCart(variablePriceProduct, 1, price);
                  setVariablePriceProduct(null);
                  setVariablePriceInput('');
                }} className="flex-1 py-3 rounded-2xl bg-[#FF4040] text-white font-black text-lg shadow-lg hover:bg-red-500 transition-colors active:scale-95">
                  Confirmar
                </button>
             </div>
          </div>
        </div>
      )}

      {/* PANEL FIJO CARRITO POS (30% inferior) */}
      {activeTab === 'pos' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-[28px] shadow-[0_-6px_24px_-4px_rgba(0,0,0,0.10)] border-t border-gray-100 pb-16">
          {cart.length === 0 ? (
            /* Estado vacío: panel colapsado */
            <div className="flex items-center justify-center py-4 gap-2 text-gray-400">
              <span className="font-bold text-sm">Toca un producto para agregar al pedido</span>
            </div>
          ) : (
            <div className="px-4 pt-3 pb-3">
              {/* Lista de items (scrollable) */}
              <div className="flex flex-col gap-1.5 max-h-[110px] overflow-y-auto mb-3 pr-1">
                {cart.map((c: any) => (
                  <div key={c.productId} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-2xl">
                    <span className="text-gray-900 font-black text-sm">
                      <span className="inline-block bg-[#FF4040] text-white text-xs font-black px-2 py-0.5 rounded-full mr-2">{c.qty}x</span>
                      {c.name}
                    </span>
                    <span className="text-[#FF4040] font-black text-sm">{formatMoney(c.price * c.qty)}</span>
                  </div>
                ))}
              </div>
              {/* Acciones */}
              <div className="flex gap-3">
                <button
                  onClick={clearCart}
                  className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0 active:scale-95"
                >
                  <X size={22} strokeWidth={3} />
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 h-12 bg-[#FF4040] rounded-2xl flex items-center justify-between px-5 font-black text-xl text-white shadow-[0_6px_16px_-4px_rgba(255,64,64,0.5)] hover:scale-[1.01] transition-transform active:scale-95"
                >
                  <span>COBRAR</span>
                  <span>{formatMoney(total)}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav activeTab={activeTab} onTabSelect={setActiveTab} tabs={tabs} />
    </div>
  );
};
