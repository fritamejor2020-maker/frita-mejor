import os

file_path = "src/views/VendedorDashboard.tsx"

new_code = """import React, { useState, useEffect } from 'react';
import { Calculator, Package, DollarSign, X, Bell, LogOut, Check } from 'lucide-react';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { usePosStore } from '../store/usePosStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { calculateClosingStatus } from '../utils/financeUtils';
import { BottomNav } from '../components/ui/BottomNav';
import { Navigate } from 'react-router-dom';

export const VendedorDashboard = () => {
  const { isSetupComplete, pointId, responsibleName, endShift } = useSellerSessionStore();
  const { cart, total, addToCart, checkout, clearCart } = usePosStore();
  const { restockCart, addToRestockCart, sendRestockRequest, clearRestockCart } = useLogisticsStore();
  const { inventory } = useInventoryStore();
  const { signOut } = useAuthStore();

  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState<any[]>([]);

  // Cierre state
  const [shiftType, setShiftType] = useState('Triciclo');
  const [shiftTime, setShiftTime] = useState('AM');
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

  const handleCloseShift = async () => {
    const cashVal = parseInt(cash) || 0;
    const transferVal = parseInt(transfer) || 0;
    const expensesVal = parseInt(expenses) || 0;
    const { difference, status } = calculateClosingStatus(theorySales, cashVal, transferVal, expensesVal);

    try {
      alert(`Cierre exitoso. Diferencia: $${difference} (${status})`);
      endShift();
      signOut();
    } catch (err: any) {
      alert("Error en cierre: " + err.message);
    }
  };

  const tabs = [
    { id: 'pos', label: 'Venta', icon: <Calculator size={24} /> },
    { id: 'restock', label: 'Pedir', icon: <Package size={24} /> },
    { id: 'pedidos', label: 'Pedidos', icon: <Bell size={24} /> },
    { id: 'close', label: 'Cierre', icon: <DollarSign size={24} /> }
  ];

  const getHeaderTitle = () => {
    if (activeTab === 'pos') return 'Venta Rápida';
    if (activeTab === 'restock') return 'Pedir Surtido';
    if (activeTab === 'pedidos') return 'Mis Pedidos';
    if (activeTab === 'close') return 'Cierre Caja';
    return 'Dashboard';
  };

  const currentDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

  return (
    <div className="min-h-screen bg-[#FFD56B] pb-32 font-sans w-full flex flex-col">
      {/* HEADER */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-8 pb-6 px-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">{getHeaderTitle()}</h1>
            <p className="text-sm font-bold text-gray-400 mt-2">{formattedDate}</p>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <button 
                key={p.id}
                onClick={() => addToCart(p, 1)}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-transparent hover:border-white transition-all active:scale-95 flex flex-col items-start justify-center text-left"
              >
                <span className="font-black text-gray-900 text-lg sm:text-xl leading-tight mb-1">{p.name}</span>
                <span className="text-[#FF4040] font-black text-sm sm:text-base">${p.price}</span>
              </button>
            ))}
          </div>
        )}

        {/* SUBVISTA: PEDIR SURTIDO */}
        {activeTab === 'restock' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {products.map(p => {
              const currentQty = restockCart.find((i: any) => i.productId === p.id)?.qty || 0;
              const presets = [5, 10, 15, 20];
              return (
                <div key={p.id} className="bg-amber-100/50 rounded-full flex items-center justify-between p-2 shadow-sm border border-amber-200/50">
                  <div className="bg-[#FF4040] text-white font-black text-sm sm:text-base px-6 py-3 rounded-full flex-shrink-0 min-w-[140px] text-center shadow-sm">
                    {p.name}
                  </div>
                  
                  <div className="flex gap-2 items-center pr-2">
                    {presets.map(qty => {
                      const isActive = currentQty === qty;
                      return (
                        <button
                          key={qty}
                          onClick={() => addToRestockCart(p.id, isActive ? -qty : qty, p.name)}
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 font-black text-sm sm:text-base flex items-center justify-center transition-all active:scale-90
                            ${isActive 
                              ? 'bg-[#FFB700] text-white border-[#FFB700] shadow-sm' 
                              : 'bg-transparent border-[#FF4040] text-[#FF4040] hover:bg-white'}
                          `}
                        >
                          {qty}
                        </button>
                      );
                    })}
                    {/* Manual Input Dropdown */}
                    <div className="relative">
                       {manualInputOpen === p.id || (currentQty > 0 && !presets.includes(currentQty)) ? (
                          <input
                            type="number"
                            autoFocus
                            value={currentQty || ''}
                            onChange={(e) => {
                               const val = parseInt(e.target.value) || 0;
                               // We need to replace the quantity. Since addToRestockCart adds relative, we first clear this item or handle it differently.
                               // In useLogisticsStore we don't have a 'setExactQty'. So we calculate the delta.
                               const delta = val - currentQty;
                               if(delta !== 0) addToRestockCart(p.id, delta, p.name);
                            }}
                            onBlur={() => setManualInputOpen(null)}
                            className="w-14 h-10 sm:h-12 rounded-full bg-white border-2 border-gray-300 text-center font-black text-gray-800 outline-none focus:border-gray-500 shadow-inner"
                          />
                       ) : (
                          <button
                            onClick={() => setManualInputOpen(p.id)}
                            className="w-12 h-10 sm:h-12 rounded-full bg-white border-2 border-white text-gray-400 font-bold flex items-center justify-center hover:bg-gray-50 hover:text-gray-600 transition-colors shadow-sm"
                          >
                            ...
                          </button>
                       )}
                    </div>
                  </div>
                </div>
              );
            })}
             {restockCart.some((i: any) => i.qty > 0) && (
              <div className="md:col-span-2 flex justify-center mt-8">
                <button 
                  onClick={handleSendRestock}
                  className="w-full max-w-2xl bg-[#FF4040] text-white font-black text-xl lg:text-3xl py-6 rounded-full shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95"
                >
                  Enviar Solicitud
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUBVISTA: PEDIDOS (Omitida funcionalmente) */}
        {activeTab === 'pedidos' && (
           <div className="text-center py-20">
             <span className="text-6xl mb-6 block">🚧</span>
             <h2 className="text-2xl font-black text-amber-900">Módulo en construcción</h2>
             <p className="font-bold text-amber-700/60 mt-2">La vista de pedidos activos estará disponible pronto.</p>
           </div>
        )}

        {/* SUBVISTA: CIERRE CAJA */}
        {activeTab === 'close' && (
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* CONFIGURACIÓN DE JORNADA */}
            <div className="bg-amber-100/50 rounded-[40px] p-6 sm:p-8 border border-amber-200/50">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Configuración de Jornada</h4>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                 <div className="flex bg-white rounded-xl overflow-hidden p-1 shadow-sm flex-1">
                    <button 
                       onClick={() => setShiftType('Local Físico')}
                       className={`flex-1 py-3 text-sm font-black rounded-lg transition-colors ${shiftType === 'Local Físico' ? 'bg-[#FFB700] text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                       Local Físico
                    </button>
                    <button 
                       onClick={() => setShiftType('Triciclo')}
                       className={`flex-1 py-3 text-sm font-black rounded-lg transition-colors ${shiftType === 'Triciclo' ? 'bg-[#FFB700] text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                       Triciclo
                    </button>
                 </div>
                 <div className="flex-1 bg-white rounded-xl shadow-sm px-4 flex items-center font-black text-gray-800">
                    {pointId || 'Triciclo 01 (T:1)'}
                 </div>
                 <div className="flex-1 bg-white rounded-xl shadow-sm px-4 py-3 text-sm font-bold text-gray-500">
                    {responsibleName || 'Nombre Vendedor'}
                 </div>
              </div>
              <div className="flex bg-white rounded-xl overflow-hidden p-1 shadow-sm">
                  {['AM', 'MD', 'PM'].map(time => (
                     <button 
                       key={time}
                       onClick={() => setShiftTime(time)}
                       className={`flex-1 py-3 text-sm font-black rounded-lg transition-colors ${shiftTime === time ? 'bg-[#FF4040] text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                       {time}
                    </button>
                  ))}
              </div>
            </div>

            {/* FORMULARIO FINANCIERO */}
            <div className="bg-white rounded-[40px] p-6 sm:p-10 shadow-sm border border-white">
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
                 {/* EFECTIVO */}
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] sm:text-xs px-4 py-1.5 rounded-t-lg tracking-widest flex items-center gap-2">
                       <DollarSign size={14} strokeWidth={3} /> EFECTIVO
                    </div>
                    <input 
                      type="number" 
                      value={cash}
                      onChange={(e) => setCash(e.target.value)}
                      placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-[28px] py-5 px-6 font-black text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
                    />
                 </div>

                 {/* TRANSFERENCIAS */}
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] sm:text-xs px-4 py-1.5 rounded-t-lg tracking-widest flex items-center gap-2">
                       <Zap size={14} strokeWidth={3} fill="currentColor" /> TRANSFERENCIAS
                    </div>
                    <input 
                      type="number" 
                      value={transfer}
                      onChange={(e) => setTransfer(e.target.value)}
                      placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-[28px] py-5 px-6 font-black text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors"
                    />
                 </div>
               </div>

               {/* GASTOS */}
               <div className="relative pt-6 mb-10">
                  <div className="absolute top-0 left-4 bg-gray-900 text-white font-black text-[10px] sm:text-xs px-4 py-1.5 rounded-t-lg tracking-widest">
                     GASTOS / SALIDAS
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 bg-gray-50 border-2 border-gray-100 rounded-[28px] p-2">
                     <input 
                       type="number" 
                       value={expenses}
                       onChange={(e) => setExpenses(e.target.value)}
                       placeholder="$ Valor"
                       className="w-full sm:w-1/3 bg-white rounded-3xl py-4 px-6 font-black text-xl text-gray-800 outline-none shadow-sm focus:ring-2 ring-[#FFB700] border-none"
                     />
                     <input 
                       type="text" 
                       value={expensesDesc}
                       onChange={(e) => setExpensesDesc(e.target.value)}
                       placeholder="Descripción del gasto..."
                       className="w-full sm:w-2/3 bg-transparent py-4 px-4 font-bold text-gray-500 text-base outline-none"
                     />
                  </div>
               </div>
               
               <hr className="border-gray-100 border-dashed border-2 mb-8" />

               {/* TOTALIZADOR */}
               <div className="text-center">
                  <span className="block text-gray-400 font-bold text-sm tracking-widest uppercase mb-1">Total Venta Neta</span>
                  <p className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tighter">
                    ${(parseInt(cash)||0) + (parseInt(transfer)||0) - (parseInt(expenses)||0)}
                  </p>
               </div>
            </div>

            <button 
              onClick={handleCloseShift}
              className="w-full flex items-center justify-center gap-3 bg-[#FF4040] text-white font-black text-xl sm:text-2xl py-6 rounded-[32px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] hover:scale-[1.02] transition-all active:scale-95"
            >
              <Check size={28} strokeWidth={3} /> CERRAR JORNADA
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
                  <span className="text-[#FF4040] font-black">${c.price * c.qty}</span>
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
              <span>${total}</span>
            </button>
          </div>
        </div>
      )}

      <BottomNav activeTab={activeTab} onTabSelect={setActiveTab} tabs={tabs} />
    </div>
  );
};
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_code)

print("File updated successfully.")
