import React, { useState, useEffect } from 'react';
import { Calculator, Package, DollarSign, X, Zap, LogOut, Check } from 'lucide-react';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { usePosStore } from '../store/usePosStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { calculateClosingStatus } from '../utils/financeUtils';
import { formatMoney } from '../utils/formatUtils';
import { NumberSelectorGroup } from '../components/ui/NumberSelectorGroup';
import { BottomNav } from '../components/ui/BottomNav';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export const VendedorDashboard = () => {
  const { isSetupComplete, pointId, responsibleName, endShift } = useSellerSessionStore();
  const { cart, total, addToCart, checkout, clearCart } = usePosStore();
  const { restockCart, addToRestockCart, sendRestockRequest, clearRestockCart } = useLogisticsStore();
  const { inventory, loadTemplates, addLoadTemplate, posSettings } = useInventoryStore();
  const { signOut } = useAuthStore();
  
  const presets = posSettings?.restockPresets || [5, 10, 15, 20];
  const vendedorTemplates = loadTemplates?.filter((t: any) => t.role === 'VENDEDOR') || [];

  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState<any[]>([]);

  // Cierre state
  const [cash, setCash] = useState('');
  const [transfer, setTransfer] = useState('');
  const [expenses, setExpenses] = useState('');
  const [expensesDesc, setExpensesDesc] = useState('');
  const [theorySales, setTheorySales] = useState(0); 
  
  // Custom states for manual input toggles
  const [manualInputOpen, setManualInputOpen] = useState<string | null>(null);

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
      await sendRestockRequest(pointId as string);
      alert("Solicitud de surtido enviada exitosamente");
      clearRestockCart();
    } catch (err: any) {
      alert("Error al pedir surtido: " + err.message);
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
    <div className="min-h-screen bg-[#FFD56B] pb-32 font-sans w-full flex flex-col">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map(p => (
              <button 
                key={p.id}
                onClick={() => addToCart(p, 1)}
                className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-transparent hover:border-white transition-all duration-300 active:scale-95 flex flex-col items-start justify-center text-left min-h-[120px] sm:min-h-[140px] hover:-translate-y-1 hover:shadow-chunky-lg group"
              >
                <span className="font-black text-gray-900 text-base sm:text-xl leading-tight mb-1 group-hover:text-[#FF4040] transition-colors">{p.name}</span>
                <span className="text-[#FF4040] font-black text-sm sm:text-base">{formatMoney(p.price)}</span>
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
              return (
                <div key={p.id} className="bg-white rounded-3xl sm:rounded-full flex flex-col sm:flex-row sm:items-center justify-between p-2 shadow-sm border border-gray-100 gap-2 sm:gap-0">
                  <div className="bg-[#FF4040] text-white font-black text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3 rounded-full sm:min-w-[140px] text-center shadow-sm">
                    {p.name}
                  </div>
                  
                  <div className="flex gap-2 items-center sm:pr-2 justify-center">
                     <NumberSelectorGroup
                       presets={presets}
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
             {restockCart.some((i: any) => i.qty > 0) && (
              <div className="md:col-span-2 flex justify-center mt-6 sm:mt-8">
                <button 
                  onClick={handleSendRestock}
                  className="w-full max-w-2xl bg-[#FF4040] text-white font-black text-lg lg:text-2xl py-4 sm:py-5 rounded-full shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95"
                >
                  Enviar Solicitud
                </button>
              </div>
            )}
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
                    <input 
                      type="number" 
                      value={cash}
                      onChange={(e) => setCash(e.target.value)}
                      placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-2xl sm:rounded-[28px] py-4 px-5 sm:py-5 sm:px-6 font-black text-xl sm:text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
                    />
                 </div>

                 {/* TRANSFERENCIAS */}
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] sm:text-xs px-3 sm:px-4 py-1 sm:py-1.5 rounded-t-lg tracking-widest flex items-center gap-1 sm:gap-2">
                       <Zap size={14} strokeWidth={3} fill="currentColor" /> TRANSFERENCIAS
                    </div>
                    <input 
                      type="number" 
                      value={transfer}
                      onChange={(e) => setTransfer(e.target.value)}
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
                     <input 
                       type="number" 
                       value={expenses}
                       onChange={(e) => setExpenses(e.target.value)}
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
                    {formatMoney((parseInt(cash)||0) + (parseInt(transfer)||0) - (parseInt(expenses)||0))}
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

      {/* MODAL CARRITO POS (Flotante) */}
      {activeTab === 'pos' && cart.length > 0 && (
        <div className="fixed bottom-28 left-4 right-4 max-w-lg mx-auto bg-white rounded-[40px] p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] z-40 animate-slide-up border-2 border-gray-50">
          <div className="flex justify-between max-h-40 overflow-y-auto mb-6 text-sm font-bold text-gray-500 pr-2">
            <div className="flex flex-col gap-3 w-full">
              {cart.map((c: any) => (
                <div key={c.productId} className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-2xl">
                  <span className="text-gray-900 font-black">{c.qty}x {c.name}</span>
                  <span className="text-[#FF4040] font-black">{formatMoney(c.price * c.qty)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={clearCart}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <X size={28} strokeWidth={3} />
            </button>
            <button 
              onClick={handleCheckout}
              className="flex-1 bg-[#FF4040] rounded-3xl flex items-center justify-between px-6 sm:px-8 font-black text-2xl text-white shadow-[0_10px_20px_-5px_rgba(255,64,64,0.4)] hover:scale-[1.02] transition-transform active:scale-95"
            >
              <span>COBRAR</span>
              <span>{formatMoney(total)}</span>
            </button>
          </div>
        </div>
      )}

      <BottomNav activeTab={activeTab} onTabSelect={setActiveTab} tabs={tabs} />
    </div>
  );
};
