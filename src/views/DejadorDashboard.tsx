import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, Zap, ChevronDown, ChevronUp, CheckCircle2, Pencil, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useDejadorSessionStore } from '../store/useDejadorSessionStore';
import { NumberSelectorGroup } from '../components/ui/NumberSelectorGroup';
import { getProductAbbreviation } from '../utils/formatUtils';

// ─── Hook: Relative time that auto-refreshes ─────────────────────────────
const useRelativeTime = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  return useCallback((isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Ahora';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `Hace ${diffDay}d`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);
};

export const DejadorDashboard = () => {
  const navigate = useNavigate();
  const timeAgo = useRelativeTime();
  const { pendingRequests, completedRequests, fetchPendingRequests, commitRestock, commitLoad, commitReception, updatePendingRequest } = useLogisticsStore();
  const { loadTemplates, addLoadTemplate, deleteLoadTemplate, posSettings, getPosItems } = useInventoryStore();
  const products = getPosItems();
  const { user, signOut, updateUserPresets } = useAuthStore();
  const { isSetupComplete, shift, anotadorName, dejadorName, endShift } = useDejadorSessionStore();
  const getAllActivePoints = useVehicleStore((state) => state.getAllActivePoints);
  const vehicles = getAllActivePoints ? getAllActivePoints() : useVehicleStore.getState().vehicles.filter((v: any) => v.active).map((v: any) => v.abbreviation || v.name);
  const defaultVehicle = vehicles.length > 0 ? vehicles[0] : 'T1';

  // Guard: if no session, redirect to setup
  useEffect(() => {
    if (!isSetupComplete) navigate('/dejador-setup', { replace: true });
  }, [isSetupComplete]);

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
  
  const productPresets = (user as any)?.productPresets || {};
  const DEFAULT_PRESETS = [5, 10, 15, 20];

  const getPresetsForProduct = (productId: string): number[] =>
    productPresets[productId] || DEFAULT_PRESETS;

  // Modal edición de presets
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draftPresets, setDraftPresets] = useState<string[]>([]);

  const openProductPresets = (productId: string) => {
    setDraftPresets(getPresetsForProduct(productId).map(String));
    setEditingProductId(productId);
  };

  const saveProductPresets = () => {
    if (!editingProductId) return;
    const parsed = draftPresets.map(v => parseInt(v, 10)).filter(n => !isNaN(n) && n > 0);
    if (parsed.length < 1) { showToast('⚠️ Ingresa al menos un valor'); return; }
    const newProductPresets = { ...productPresets, [editingProductId]: parsed };
    updateUserPresets((user as any).id, newProductPresets);
    showToast('✔ Botones actualizados');
    setEditingProductId(null);
  };

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
    // Si hay una edición en curso para ESTE pedido, guardarla primero
    if (editingReqId === id) {
      updatePendingRequest(id, editPayload);
      setEditingReqId(null);
    }
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

  const { addPosShift } = useInventoryStore();

  const handleEndShift = () => {
    if (!window.confirm('¿Cerrar jornada del Dejador?')) return;
    // Guardar registro del cierre para el admin
    addPosShift({
      type: 'DEJADOR',
      shift,
      anotadorName,
      dejadorName,
      closedAt: new Date().toISOString(),
    });
    endShift();
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-32 font-sans w-full bg-[#FFD56B] flex flex-col">
      
      {/* ─── HEADER ─── */}
      <div className="w-full bg-white rounded-b-[40px] shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto pt-5 sm:pt-8 pb-4 sm:pb-6 px-4 sm:px-6">

          {/* Top row: title + CERRAR JORNADA */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-gray-900 leading-tight">{getHeaderTitle()}</h1>
              <p className="text-xs sm:text-sm font-bold text-gray-500 mt-1">Logística y Control</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleEndShift}
                className="flex items-center gap-2 bg-[#FF4040] text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-md hover:bg-red-600 transition-all active:scale-95"
              >
                <LogOut size={15} strokeWidth={2.5} />
                CERRAR JORNADA
              </button>
            </div>
          </div>

          {/* Session badges: turno · anotador · dejador */}
          {isSetupComplete && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                {shift}
              </span>
              {anotadorName && (
                <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full">
                  📋 {anotadorName}
                </span>
              )}
              {dejadorName && (
                <span className="flex items-center gap-1 bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  🛵 {dejadorName}
                </span>
              )}
            </div>
          )}

          {/* ─── TABS ─── */}
          <div className="bg-amber-100/50 rounded-2xl p-1 mt-5 flex max-w-lg">
            {[
              { id: 'carga', label: 'Carga Inicial' },
              { id: 'surtir', label: 'Surtir' },
              { id: 'recibir', label: 'Recibir' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setLoadQuantities({});
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
          <div className="mb-5 sm:mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
            
            <div className="flex gap-2 sm:gap-3 overflow-x-auto py-1 sm:py-2 no-scrollbar px-1 sm:px-2 items-center flex-1">
              {vehicles.map((v: string) => (
                <button
                  key={v}
                  onClick={() => setSelectedVehicle(v)}
                  className={`flex-none w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-base sm:text-xl transition-all duration-300 shadow-sm hover:-translate-y-1 hover:shadow-chunky-lg
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
                <div key={tpl.id} className="flex items-center">
                  <button
                    onClick={() => loadTemplateItems(tpl.id)}
                    className={`flex items-center justify-center gap-2 py-2 px-4 rounded-l-full border-2 border-r-0 font-bold text-sm transition-all duration-300 active:scale-95 shadow-sm
                      ${activePreset === tpl.id ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white border-amber-500 text-amber-500 hover:bg-amber-50'}`}
                  >
                    <Zap size={16} fill={activePreset === tpl.id ? "white" : "currentColor"} /> {tpl.name}
                  </button>
                  <button
                    onClick={() => { if(window.confirm(`¿Eliminar plantilla "${tpl.name}"?`)) deleteLoadTemplate(tpl.id); }}
                    className={`flex items-center justify-center py-2 px-2 rounded-r-full border-2 border-l font-bold text-sm transition-all active:scale-95
                      ${activePreset === tpl.id ? 'bg-amber-500 text-white border-amber-500 border-l-amber-300' : 'bg-white border-amber-500 text-amber-400 hover:bg-red-50 hover:text-red-500 hover:border-red-400'}`}
                    title="Eliminar plantilla"
                  >
                    ✕
                  </button>
                </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fade-in mb-8">
            {products.map((p: any) => {
              const productPresetValues = getPresetsForProduct(p.id);
              return (
              <div key={p.id} className={`${activeTab === 'recibir' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'} rounded-[28px] flex flex-row items-center justify-between p-2 shadow-sm border`}>

                {/* Cápsula izquierda + editar */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className={`${getThemeClass('bg')} text-white font-black text-base px-4 py-2.5 rounded-full min-w-[52px] text-center shadow-sm tracking-wide leading-none`}
                    title={p.name || 'Producto'}
                  >
                    {getProductAbbreviation(p.name || 'Producto')}
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
                     value={loadQuantities[p.id] || 0}
                     themeClass={activeTab}
                     onChange={(val) => {
                       handleQtyClick(p.id, val);
                       setActivePreset(null);
                     }}
                   />
                </div>
              </div>
            )})}
          </div>
        )}

        {/* ─── TAB: SURTIR CARROS ─── */}
        {activeTab === 'surtir' && (
          <div className="space-y-4 sm:space-y-6 mt-2">
            <h2 className="text-gray-700 font-black tracking-wide text-base sm:text-lg mb-3 sm:mb-4 px-2">Solicitudes Recientes</h2>
            
             {pendingRequests.length === 0 ? (
                <div className="bg-white/80 rounded-3xl sm:rounded-[40px] p-10 sm:p-16 text-center border-2 border-dashed border-white max-w-3xl mx-auto shadow-sm">
                  <span className="text-4xl sm:text-6xl block mb-4 sm:mb-6 drop-shadow-sm">🙌</span>
                  <h3 className="font-black text-xl sm:text-2xl text-gray-800">Todo al día</h3>
                  <p className="text-gray-500 font-bold mt-2 text-base">No hay carros pidiendo surtido ahora.</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {pendingRequests.map((req: any) => (
                    <div key={req.id} className="bg-white rounded-3xl sm:rounded-[32px] p-4 sm:p-8 shadow-sm border-2 border-dashed border-gray-300 relative overflow-hidden transition-all hover:shadow-md hover:border-gray-400">
                      
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-6 mb-4 sm:mb-6">
                        <div className="flex items-center gap-3">
                          {/* Vehicle Circle Badge */}
                          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-amber-400 rounded-full flex items-center justify-center text-white font-black text-xl sm:text-3xl shadow-sm border-4 border-amber-100">
                            {req.requester_point_id}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-800 font-black text-base sm:text-xl leading-tight">Pedido Urgente</span>
                            {req.requester_name && (
                              <span className="text-gray-600 font-bold text-sm leading-tight mt-0.5" title="Vendedor que solicitó">{req.requester_name}</span>
                            )}
                            <span className="text-amber-600 font-bold text-xs sm:text-sm bg-amber-50 inline-block px-3 py-1 rounded-full mt-1 w-max">
                              {req.created_at ? timeAgo(req.created_at) : 'Pendiente'}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                           <button 
                             className={`flex-1 sm:flex-none font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base border-2 transition-colors active:scale-95 ${editingReqId === req.id ? 'bg-green-100 text-green-700 border-green-200 hover:border-green-300' : 'bg-gray-100 text-gray-600 border-transparent hover:border-gray-200'}`}
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
                             className="flex-1 sm:flex-none bg-amber-500 text-white font-black px-6 sm:px-8 py-2 sm:py-3 rounded-full text-sm sm:text-base shadow-lg hover:bg-amber-600 transition-all hover:shadow-xl hover:-translate-y-0.5 transform active:scale-95 active:shadow-sm"
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
                                 <div className="bg-red-500 text-white font-black text-sm px-4 py-2.5 flex items-center justify-center min-w-[48px] whitespace-nowrap" title={item.name}>
                                   {getProductAbbreviation(item.name || '')}
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
                                 <div className="bg-red-500 text-white font-black text-sm px-4 py-2.5 flex items-center justify-center min-w-[48px] whitespace-nowrap" title={item.name}>
                                   {getProductAbbreviation(item.name || '')}
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
                               <div className="bg-gray-200/50 text-gray-500 font-black text-xs px-3 py-1.5 flex items-center min-w-[40px] justify-center whitespace-nowrap" title={item.name}>
                                 {getProductAbbreviation(item.name || '')}
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
        <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pointer-events-none z-50">
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
                className={`w-full sm:w-auto pointer-events-auto px-8 sm:px-12 py-4 sm:py-5 rounded-full text-white font-black text-base sm:text-xl lg:text-2xl shadow-2xl transition-all transform hover:scale-105 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] flex items-center justify-center gap-2 sm:gap-3
                   ${getThemeClass('bg')}`}
             >
               <CheckCircle2 strokeWidth={3} className="w-5 h-5 sm:w-7 sm:h-7" />
               {activeTab === 'carga' ? 'Confirmar Carga' : 'Confirmar Recepción'}
             </button>
           </div>
        </div>
      )}

      {/* MODAL EDITAR PRESETS POR PRODUCTO (Dejador) */}
      {editingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[32px] p-7 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className={`${getThemeClass('bg')} text-white font-black text-sm px-3 py-1.5 rounded-full`}>
                {getProductAbbreviation(products.find((p: any) => p.id === editingProductId)?.name || '')}
              </div>
              <h3 className="font-black text-xl text-gray-900">Botones de cantidad</h3>
            </div>
            <p className="text-gray-400 font-bold text-sm mb-5">Valores rápidos para este producto. Se guardan solo para ti.</p>

            <div className="flex gap-2 mb-6 flex-wrap">
              {draftPresets.map((val, idx) => (
                <input
                  key={idx}
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
              ))}
              {draftPresets.length < 6 && (
                <button onClick={() => setDraftPresets(p => [...p, ''])}
                  className="w-16 h-14 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 font-bold text-2xl flex items-center justify-center hover:border-gray-400 transition-colors">
                  +
                </button>
              )}
              {draftPresets.length > 1 && (
                <button onClick={() => setDraftPresets(p => p.slice(0, -1))}
                  className="w-16 h-14 rounded-2xl border-2 border-dashed border-red-200 text-red-300 font-bold text-2xl flex items-center justify-center hover:border-red-400 hover:text-red-500 transition-colors">
                  −
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingProductId(null)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-base hover:bg-gray-200 transition-colors active:scale-95">
                Cancelar
              </button>
              <button onClick={saveProductPresets}
                className="flex-1 py-3 rounded-2xl bg-[#FF4040] text-white font-black text-base shadow-lg shadow-red-200 hover:bg-red-500 transition-colors active:scale-95 flex items-center justify-center gap-2">
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed top-4 sm:top-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[100] bg-gray-900 text-white font-black text-sm sm:text-lg px-5 sm:px-8 py-3 sm:py-4 rounded-full shadow-2xl border-2 border-white/20 text-center">
          {toast}
        </div>
      )}
    </div>
  );
};
