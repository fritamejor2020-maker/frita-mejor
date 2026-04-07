import React, { useState, useEffect } from 'react';
import { LogOut, Zap, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { NumberSelectorGroup } from '../components/ui/NumberSelectorGroup';

export const DejadorDashboard = () => {
  const { pendingRequests, completedRequests, fetchPendingRequests, commitRestock, commitLoad, commitReception, updatePendingRequest } = useLogisticsStore();
  const { products, loadTemplates, addLoadTemplate, posSettings } = useInventoryStore();
  const { signOut } = useAuthStore();
  const getActiveTricycleAbbreviations = useVehicleStore((state) => state.getActiveTricycleAbbreviations);
  
  const vehicles = getActiveTricycleAbbreviations();
  const defaultVehicle = vehicles.length > 0 ? vehicles[0] : 'T1';

  const [activeTab, setActiveTab] = useState('carga'); // carga, surtir, recibir
  const [selectedVehicle, setSelectedVehicle] = useState(defaultVehicle);
  const [loadQuantities, setLoadQuantities] = useState<Record<string, number>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  // Custom states for manual input toggles
  const [manualInputOpen, setManualInputOpen] = useState<string | null>(null);
  
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<any[]>([]);

  const handleUpdateEditQty = (idx: number, delta: number) => {
    const newPayload = [...editPayload];
    newPayload[idx] = { ...newPayload[idx], qty: Math.max(0, newPayload[idx].qty + delta) };
    setEditPayload(newPayload);
  };
  
  const presets = posSettings?.restockPresets || [5, 10, 15, 20];
  const dejadorTemplates = loadTemplates?.filter((t: any) => t.role === 'DEJADOR') || [];

  // Toast for success feedback
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(() => {
      fetchPendingRequests();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCommit = async (id: string, point: string) => {
    try {
      await commitRestock(id);
      showToast(`✅ Entrega a ${point} confirmada y descontada`);
    } catch (err: any) {
      showToast("❌ Error: " + err.message);
    }
  };

  const handleQtyClick = (prodId: string, val: number) => {
    // Si ya tiene ese valor lo quita, sino lo pone
    setLoadQuantities(prev => ({ ...prev, [prodId]: val }));
    setManualInputOpen(null);
  };

  const handleManualInput = (prodId: string, val: string) => {
    const num = parseInt(val);
    if (!isNaN(num)) {
      setLoadQuantities(prev => ({ ...prev, [prodId]: num }));
    } else if (val === '') {
      const newLoads = { ...loadQuantities };
      delete newLoads[prodId];
      setLoadQuantities(newLoads);
    }
  };

  const handleSaveTemplate = () => {
    const name = window.prompt("Nombre de esta Plantilla de Carga:");
    if (!name) return;
    addLoadTemplate({
      name,
      role: 'DEJADOR',
      items: { ...loadQuantities }
    });
    showToast('✅ Plantilla guardada exitosamente');
  };

  const loadTemplateItems = (templateId: string) => {
    const tpl = dejadorTemplates.find((t: any) => t.id === templateId);
    if (tpl) {
      setLoadQuantities({ ...tpl.items });
      setActivePreset(templateId);
      showToast(`⚡ Plantilla "${tpl.name}" aplicada`);
    }
  };

  // ─── THEME LOGIC ───
  // Carga: Red | Surtir: Orange | Recibir: Indigo
  const getThemeColor = () => {
    if (activeTab === 'carga')   return '#EF4444'; // bg-red-500
    if (activeTab === 'surtir')  return '#F59E0B'; // bg-amber-500
    if (activeTab === 'recibir') return '#4F46E5'; // bg-indigo-600
    return '#EF4444';
  };
  
  const getThemeClass = (type: 'bg' | 'text' | 'border' | 'activePill', forceActive = true) => {
    // Define exact tailwind classes based on tab
    if (activeTab === 'carga') {
      if (type === 'bg') return 'bg-red-500';
      if (type === 'text') return 'text-red-500';
      if (type === 'border') return 'border-red-500';
      if (type === 'activePill') return forceActive ? 'bg-red-500 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:text-red-500';
    }
    if (activeTab === 'surtir') {
      if (type === 'bg') return 'bg-amber-500';
      if (type === 'text') return 'text-amber-500';
      if (type === 'border') return 'border-amber-500';
      if (type === 'activePill') return forceActive ? 'bg-amber-500 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:text-amber-500';
    }
    if (activeTab === 'recibir') {
      if (type === 'bg') return 'bg-indigo-600';
      if (type === 'text') return 'text-indigo-600';
      if (type === 'border') return 'border-indigo-600';
      if (type === 'activePill') return forceActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:text-indigo-600';
    }
    return '';
  };

  const getHeaderTitle = () => {
    if (activeTab === 'carga') return 'Carga Inicial';
    if (activeTab === 'surtir') return 'Surtir Carros';
    if (activeTab === 'recibir') return 'Cierre Jornada';
    return 'Logística';
  };

  return (
    <div className="min-h-screen pb-32 font-sans w-full bg-[#FFD56B] flex flex-col">
      
      {/* ─── HEADER (Full Width background, constrained content) ─── */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-8 pb-6 px-6 relative">
          <div className="pr-16">
            <h1 className="text-4xl font-black text-gray-900 leading-tight">{getHeaderTitle()}</h1>
            <p className="text-sm font-bold text-gray-500 mt-1">Logística y Control</p>
          </div>
          
          {/* Logout Circular Button */}
          <button 
             onClick={signOut}
             className="absolute top-8 right-6 w-12 h-12 bg-white border-2 border-red-50 rounded-full flex items-center justify-center shadow-sm text-red-500 hover:bg-red-50 transition-colors active:scale-95"
          >
            <LogOut size={20} strokeWidth={2.5} className="ml-1" />
          </button>

          {/* ─── TABS ─── */}
          <div className="bg-amber-100/50 rounded-2xl p-1 mt-6 flex max-w-lg">
            {[
              { id: 'carga', label: 'Carga Inicial' },
              { id: 'surtir', label: 'Surtir' },
              { id: 'recibir', label: 'Recibir' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setLoadQuantities({}); // reset quantities on switch
                  setActivePreset(null);
                }}
                className={`flex-1 py-3 px-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeTab === tab.id ? getThemeClass('activePill') : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CONTENT AREA ─── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 mt-8 animate-fade-in">
        
        {/* ─── VEHICLE SELECTOR & PRESETS (Shown in Carga & Recibir) ─── */}
        {(activeTab === 'carga' || activeTab === 'recibir') && (
          <div className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            
            <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar px-2 items-center flex-1">
              {vehicles.map((v: string) => (
                <button
                  key={v}
                  onClick={() => setSelectedVehicle(v)}
                  className={`flex-none w-[72px] h-[72px] rounded-2xl flex items-center justify-center font-black text-xl transition-all duration-300 shadow-sm hover:-translate-y-1 hover:shadow-chunky-lg
                    ${selectedVehicle === v 
                      ? 'bg-amber-500 text-white shadow-[0_0_0_4px_white]' 
                      : 'bg-white text-gray-800 border-2 border-transparent hover:border-amber-200'}`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* PRESET PILLS */}
            <div className="flex gap-2 px-1 flex-shrink-0 flex-wrap justify-end">
              {dejadorTemplates.map((tpl: any) => (
                <button 
                  key={tpl.id}
                  onClick={() => loadTemplateItems(tpl.id)}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full border-2 font-bold text-sm transition-all duration-300 active:scale-95 shadow-sm
                    ${activePreset === tpl.id ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white border-amber-500 text-amber-500 hover:bg-amber-50'}`}
                >
                  <Zap size={16} fill={activePreset === tpl.id ? "white" : "currentColor"} /> {tpl.name}
                </button>
              ))}
              <button 
                onClick={handleSaveTemplate}
                className="flex items-center justify-center gap-1 py-2 px-4 rounded-full border border-dashed border-gray-400 font-bold text-gray-500 text-sm hover:border-gray-600 hover:text-gray-700 transition-colors"
              >
                + Guardar Actual
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: CARGA INICIAL & RECIBIR (PRODUCT GRID) ─── */}
        {(activeTab === 'carga' || activeTab === 'recibir') && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-fade-in mb-8">
            {products.map((p: any) => (
              <div key={p.id} className={`${activeTab === 'recibir' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'} rounded-full flex items-center justify-between p-2 shadow-sm border`}>
                
                <div className={`${getThemeClass('bg')} text-white font-black text-sm sm:text-base px-6 py-3 rounded-full flex-shrink-0 min-w-[140px] text-center shadow-sm max-w-[140px] sm:max-w-[180px] truncate`}>
                  {p.name || 'Producto'}
                </div>

                <div className="flex gap-2 items-center pr-2">
                   <NumberSelectorGroup
                     presets={presets}
                     value={loadQuantities[p.id] || 0}
                     themeClass={activeTab}
                     onChange={(val) => {
                       handleQtyClick(p.id, val);
                       setActivePreset(null);
                     }}
                   />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── TAB: SURTIR CARROS ─── */}
        {activeTab === 'surtir' && (
          <div className="space-y-6 mt-2">
            <h2 className="text-gray-700 font-black tracking-wide text-lg mb-4 px-2">Solicitudes Recientes</h2>
            
             {pendingRequests.length === 0 ? (
                <div className="bg-white/80 rounded-[40px] p-16 text-center border-2 border-dashed border-white max-w-3xl mx-auto shadow-sm">
                  <span className="text-6xl block mb-6 drop-shadow-sm">🙌</span>
                  <h3 className="font-black text-2xl text-gray-800">Todo al día</h3>
                  <p className="text-gray-500 font-bold mt-2 text-lg">No hay carros pidiendo surtido ahora.</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {pendingRequests.map((req: any) => (
                    <div key={req.id} className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border-2 border-dashed border-gray-300 relative overflow-hidden transition-all hover:shadow-md hover:border-gray-400">
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 mb-6">
                        <div className="flex items-center gap-4">
                          {/* Vehicle Circle Badge */}
                          <div className="w-20 h-20 bg-amber-400 rounded-full flex items-center justify-center text-white font-black text-3xl shadow-sm border-4 border-amber-100">
                            {req.requester_point_id}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-800 font-black text-xl">Pedido Urgente</span>
                            <span className="text-amber-600 font-bold text-sm bg-amber-50 inline-block px-3 py-1 rounded-full mt-1 w-max">Hace 5m</span>
                          </div>
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto">
                           <button 
                             className={`flex-1 sm:flex-none font-bold px-6 py-3 rounded-full text-base border-2 transition-colors active:scale-95 ${editingReqId === req.id ? 'bg-green-100 text-green-700 border-green-200 hover:border-green-300' : 'bg-gray-100 text-gray-600 border-transparent hover:border-gray-200'}`}
                             onClick={() => {
                               if (editingReqId === req.id) {
                                 updatePendingRequest(req.id, editPayload);
                                 setEditingReqId(null);
                               } else {
                                 setEditingReqId(req.id);
                                 setEditPayload([...req.items_payload]);
                               }
                             }}
                           >
                             {editingReqId === req.id ? 'Guardar' : 'Modificar'}
                           </button>
                           <button 
                             onClick={() => handleCommit(req.id, req.requester_point_id)}
                             className="flex-1 sm:flex-none bg-amber-500 text-white font-black px-8 py-3 rounded-full text-base shadow-lg hover:bg-amber-600 transition-all hover:shadow-xl hover:-translate-y-0.5 transform active:scale-95 active:shadow-sm"
                           >
                             Surtir Ya
                           </button>
                        </div>
                      </div>

                      {/* Fused Pills for Items */}
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Artículos solicitados:</h4>
                        <div className="flex flex-wrap gap-3">
                           {editingReqId === req.id ? (
                             editPayload.map((item: any, idx: number) => (
                               <div key={idx} className="flex rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-200 bg-white">
                                 <div className="bg-red-500 text-white font-bold text-sm px-4 py-2.5 flex items-center whitespace-nowrap">
                                   {item.name}
                                 </div>
                                 <button onClick={() => handleUpdateEditQty(idx, -1)} className="px-3 bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">-</button>
                                 <div className="text-gray-900 font-black text-base px-3 py-2.5 flex items-center min-w-[40px] justify-center">
                                   {item.qty}
                                 </div>
                                 <button onClick={() => handleUpdateEditQty(idx, 1)} className="px-3 bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">+</button>
                               </div>
                             ))
                           ) : (
                             req.items_payload?.map((item: any, idx: number) => (
                               <div key={idx} className="flex rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                 <div className="bg-red-500 text-white font-bold text-sm px-4 py-2.5 flex items-center whitespace-nowrap">
                                   {item.name}
                                 </div>
                                 <div className="bg-white text-gray-900 font-black text-base px-5 py-2.5 flex items-center min-w-[48px] justify-center border-y border-r border-gray-200">
                                   {item.qty}
                                 </div>
                               </div>
                             ))
                           )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             )}

             <button 
               onClick={() => setShowHistory(!showHistory)}
               className="w-full text-center py-8 mt-6 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 transition-colors font-bold text-base cursor-pointer"
             >
               Ver Historial de Movimientos {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
             </button>

             {showHistory && (
                <div className="mt-2 space-y-4">
                  {!completedRequests || completedRequests.length === 0 ? (
                    <p className="text-center text-gray-500 font-bold py-6">No hay entregas recientes</p>
                  ) : (
                    completedRequests.map((req: any) => (
                      <div key={req.id} className="bg-[#FEF3C7] rounded-[32px] p-6 shadow-sm border border-dashed border-amber-200 relative">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-200/60 rounded-full flex items-center justify-center text-gray-500 font-black text-xl">
                              {req.requester_point_id}
                            </div>
                            <span className="text-gray-500 font-bold text-sm sm:text-base">
                              Completado {new Date(req.completed_at || req.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          
                          <div className="bg-green-100 text-green-600 font-black text-xs px-4 py-2 rounded-full tracking-widest uppercase self-start sm:self-auto">
                            ENVIADO
                          </div>
                        </div>

                        {/* Fused Pills inside History */}
                        <div className="flex flex-wrap gap-2">
                           {req.items_payload?.map((item: any, idx: number) => (
                             <div key={idx} className="flex rounded-lg overflow-hidden border border-amber-200/50">
                               <div className="bg-gray-200/50 text-gray-500 font-bold text-xs px-3 py-1.5 flex items-center whitespace-nowrap">
                                 {item.name}
                               </div>
                               <div className="bg-white/80 text-gray-500 font-black text-xs px-3 py-1.5 flex items-center min-w-[36px] justify-center border-l border-amber-200/50">
                                 {item.qty}
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
             )}
          </div>
        )}

      </div>

      {/* ─── FLOATING CONFIRM BUTTON (For Carga & Recibir) ─── */}
      {(activeTab === 'carga' || activeTab === 'recibir') && (
        <div className="fixed bottom-0 left-0 right-0 p-6 pointer-events-none z-50">
           <div className="max-w-7xl mx-auto flex justify-center sm:justify-end">
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const totalItems = Object.values(loadQuantities).filter(v => v > 0).length;
                  if (totalItems === 0) {
                    showToast('⚠️ Selecciona al menos un producto');
                    return;
                  }
                  
                  let success = false;
                  if (activeTab === 'carga') {
                    success = commitLoad(selectedVehicle, loadQuantities, products);
                  } else {
                    success = commitReception(selectedVehicle, loadQuantities, products);
                  }
                  
                  if (success) {
                    showToast(`✅ ${activeTab === 'carga' ? 'Carga registrada' : 'Sobrantes recibidos'} para ${selectedVehicle}`);
                    setLoadQuantities({});
                    setActivePreset(null);
                  } else {
                    showToast('⚠️ No se pudo registrar. Verifica las cantidades.');
                  }
                }}
                className={`w-full sm:w-auto pointer-events-auto px-12 py-5 rounded-full text-white font-black text-xl lg:text-2xl shadow-2xl transition-all transform hover:scale-105 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] flex items-center justify-center gap-3
                   ${getThemeClass('bg')}`}
             >
               <CheckCircle2 strokeWidth={3} className="w-7 h-7" />
               {activeTab === 'carga' ? 'Confirmar Carga' : 'Confirmar Recepción'}
             </button>
           </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white font-black text-lg px-8 py-4 rounded-full shadow-2xl animate-[slideDown_0.3s_ease-out] border-2 border-white/20">
          {toast}
        </div>
      )}
    </div>
  );
};
