import React, { useState, useEffect } from 'react';
import { Calculator, Package, DollarSign, X, Zap, LogOut, Check, Pencil, Save, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
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
import { useVendorTracking } from '../lib/useVendorTracking';

export const VendedorDashboard = () => {
  const { isSetupComplete, pointId, shift, responsibleName, endShift, openedAt } = useSellerSessionStore();
  const { cart, total, addToCart, checkout, clearCart } = usePosStore();
  const { restockCart, addToRestockCart, sendRestockRequest, clearRestockCart, calcSoldByVehicle,
          pendingRequests, completedRequests, rejectedRequests } = useLogisticsStore();
  const { getPosItems, getVendedorPosItems, getDeliveryItems, loadTemplates, addLoadTemplate, deleteLoadTemplate, addPosShift, updatePosShift, posShifts } = useInventoryStore();
  const { user, signOut, updateUserPresets } = useAuthStore();
  
  const presets: number[] = (user as any)?.restockPresets || [5, 10, 15, 20];
  const vendedorTemplates = loadTemplates?.filter((t: any) =>
    t.role === 'VENDEDOR' && (!t.userId || t.userId === (user as any)?.id)
  ) || [];
  const products = getVendedorPosItems();
  const posProducts = products.filter((p) => p.showInPos !== false);
  // Para pedir surtido: incluye productos con showInPos:false (ej. "Cambio")
  // pero excluye los marcados showInTricicloPos:true (solo POS, no requieren carga)
  const restockProducts = getDeliveryItems();

  // Modales propios (window.confirm/prompt bloqueados en Android PWA)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [deletingTemplate, setDeletingTemplate] = useState<{ id: string; name: string } | null>(null);

  // Registrar turno en posShifts al abrir sesión (para que admin lo vea en tiempo real)
  useEffect(() => {
    if (!isSetupComplete || !openedAt || !pointId) return;
    // Verificar si ya existe un turno activo para esta sesión
    const already = (posShifts || []).find(
      (s: any) => s.type === 'VENDEDOR' && s.pointId === pointId && s.openedAt === openedAt && !s.closedAt
    );
    if (!already) {
      addPosShift({
        openedAt,
        pointId,
        shift,
        responsibleName,
        type: 'VENDEDOR',
        closedAt: null,
      });
    }
  // Solo ejecutar cuando la sesión empieza
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetupComplete, openedAt]);

  // ── GPS Tracking: compartir ubicación en tiempo real con admin/dejadores ──
  const trackingName = responsibleName || (user as any)?.name || 'Vendedor';
  const trackingId   = (user as any)?.id || pointId || 'unknown';
  const { status: gpsStatus, retry: gpsRetry, stop: gpsStop } = useVendorTracking(
    trackingId,
    trackingName,
    isSetupComplete // Solo activo cuando el turno está abierto
  );

  const [activeTab, setActiveTab] = useState('pos');
  // For products with string presets (e.g. CAM with MON/20k/50k), track selected value separately
  const [stringSelections, setStringSelections] = useState<Record<string, string>>({});
  // Campo de observación para el pedido de surtido
  const [observacion, setObservacion] = useState('');
  // Panel Mis Pedidos
  const [showMisPedidos, setShowMisPedidos] = useState(false);

  // Cierre state
  const [cash, setCash] = useState('');
  const [transfer, setTransfer] = useState('');
  const [expenses, setExpenses] = useState('');
  const [expensesDesc, setExpensesDesc] = useState('');


  // Build product price map for calcSoldByVehicle
  // Para productos de precio variable, usa referencePrice (precio promedio) para el teórico
  // Para productos de precio fijo, usa price directamente
  const productPriceMap = products.reduce((acc: any, p: any) => {
    const isVariable = p.variablePrice === true || (p.price === 0 && p.variablePrice !== false);
    const priceForTheory = isVariable ? (p.referencePrice || 0) : (p.price || 0);
    acc[p.id] = { price: priceForTheory, name: p.name };
    return acc;
  }, {});

  // Auto-calculated from logistics: (carga + surtidos) - sobrantes
  const getLogisticsCalc = () => {
    if (!pointId) return { soldItems: {}, theoretical: 0 };
    return calcSoldByVehicle(pointId, productPriceMap, openedAt || undefined);
  };

  // Modal edición de presets por producto
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draftPresets, setDraftPresets] = useState<string[]>([]);

  const productPresets = (user as any)?.productPresets || {};
  const DEFAULT_PRESETS = [5, 10, 15, 20];

  const getPresetsForProduct = (productId: string): (number | string)[] => {
    if (productPresets[productId]) return productPresets[productId];
    // Buscar en surtido primero (incluye showInPos:false como TIN, C.L, CAM)
    // y luego en POS, para cubrir todos los productos
    const item = restockProducts.find((i: any) => i.id === productId)
              ?? products.find((i: any) => i.id === productId);
    if (item?.inventoryPresets && item.inventoryPresets.length > 0) return item.inventoryPresets;
    return DEFAULT_PRESETS;
  };

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



  // Hydration guard: Zustand persist loads async, so read localStorage directly
  // to avoid a false redirect during the brief window before rehydration.
  const hasActiveSession = isSetupComplete || (() => {
    try {
      const raw = localStorage.getItem('frita-seller-session');
      if (!raw) return false;
      return JSON.parse(raw)?.state?.isSetupComplete === true;
    } catch { return false; }
  })();

  if (!hasActiveSession) {
    return <Navigate to="/vendedor-setup" replace />;
  }

  const handleCheckout = async () => {
    try {
      await checkout(pointId as string);
    } catch (err: any) {
      alert("Error al vender: " + err.message);
    }
  };

  const handleSendRestock = async () => {
    try {
      await sendRestockRequest(pointId as string, responsibleName as string, observacion);
      toast.success("Solicitud de surtido enviada exitosamente");
      clearRestockCart();
      setStringSelections({});
      setObservacion('');
    } catch (err: any) {
      toast.error("Error al pedir surtido: " + err.message);
    }
  };

  const handleSaveTemplate = () => {
    const itemsToSave: Record<string, number> = {};
    restockCart.forEach((item: any) => {
      if (item.qty > 0) itemsToSave[item.productId] = item.qty;
    });
    if (Object.keys(itemsToSave).length === 0) {
      toast.error('Agrega productos al pedido antes de guardar una plantilla');
      return;
    }
    setNewTemplateName('');
    setShowSaveTemplate(true);
  };

  const confirmSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    const itemsToSave: Record<string, number> = {};
    restockCart.forEach((item: any) => {
      if (item.qty > 0) itemsToSave[item.productId] = item.qty;
    });
    addLoadTemplate({ name: newTemplateName.trim(), role: 'VENDEDOR', userId: (user as any)?.id, items: itemsToSave });
    toast.success('Plantilla guardada exitosamente');
    setShowSaveTemplate(false);
    setNewTemplateName('');
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
    const realTotal = cashVal + transferVal + expensesVal;

    const { soldItems, theoretical: theorySalesVal } = getLogisticsCalc();
    const difference = theorySalesVal - realTotal;
    const status = difference === 0 ? 'CUADRADO' : difference > 0 ? 'FALTANTE' : 'SOBRANTE';

    // Construir details[] vacío (sección de productos vendidos eliminada)
    const details: any[] = [];

    try {
      const shiftData = useSellerSessionStore.getState();
      const finalShift = {
          openedAt: shiftData.openedAt || new Date().toISOString(),
          closedAt: new Date().toISOString(),
          userId: (user as any)?.id,
          userName: responsibleName,
          pointId: pointId,
          shift: shiftData.shift,
          pointType: shiftData.pointType,
          theorySales: theorySalesVal,
          realAmount: realTotal,
          cashAmount: cashVal,
          transferAmount: transferVal,
          expenses: expensesVal,
          expensesDesc: expensesDesc,
          status: status,
          difference: difference,
          type: 'VENDEDOR',
          soldItems,
          details,
      };

      const activeShiftRecord = (posShifts || []).find(
        (s: any) => s.type === 'VENDEDOR' && s.pointId === pointId && s.openedAt === openedAt && !s.closedAt
      );
      if (activeShiftRecord) {
        updatePosShift(activeShiftRecord.id, finalShift);
      } else {
        addPosShift(finalShift);
      }

      // Marcar GPS inactivo inmediatamente — el vendedor desaparece del mapa
      await gpsStop();
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
        <div className="max-w-7xl mx-auto pt-5 sm:pt-8 pb-4 sm:pb-6 px-4 sm:px-6 relative">
          <div className="pr-16">
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight">{getHeaderTitle()}</h1>
            <p className="text-xs sm:text-sm font-bold text-gray-400 mt-1">{formattedDate}</p>
          </div>

          {/* Botón salir */}
          <div className="absolute top-5 sm:top-8 right-4">
            <button
               onClick={() => signOut()}
               title="Salir (el turno sigue activo)"
               className="w-10 h-10 bg-white border-2 border-red-50 rounded-full flex items-center justify-center shadow-sm text-[#FF4040] hover:bg-red-50 transition-all active:scale-95"
            >
              <LogOut size={18} strokeWidth={2.5} className="ml-0.5" />
            </button>
          </div>

          {/* Turno + punto + nombre badge */}
          {(shift || pointId || responsibleName) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {pointId && <span className="bg-amber-400 text-white font-black text-xs px-2.5 py-1 rounded-full tracking-widest">{pointId}</span>}
              {shift && <span className="bg-[#FF4040] text-white font-black text-xs px-2.5 py-1 rounded-full tracking-widest">{shift}</span>}
              {responsibleName && <span className="bg-gray-900 text-white font-bold text-xs px-2.5 py-1 rounded-full">👤 {responsibleName.split(' ')[0]}</span>}
              {/* Indicador GPS */}
              {gpsStatus === 'active' && (
                <span className="flex items-center gap-1 bg-green-100 text-green-700 font-bold text-xs px-2.5 py-1 rounded-full">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  GPS activo
                </span>
              )}
              {gpsStatus === 'requesting' && (
                <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 font-bold text-xs px-2.5 py-1 rounded-full">
                  📍 Solicitando GPS...
                </span>
              )}
              {gpsStatus === 'denied' && (
                <button onClick={gpsRetry} className="flex items-center gap-1 bg-red-100 text-red-600 font-bold text-xs px-2.5 py-1 rounded-full active:scale-95">
                  ⚠️ GPS denegado — toca para reintentar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        
        {/* SUBVISTA: POS (Venta Rápida) */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            {posProducts.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  if (p.variablePrice === true || !p.price || p.price <= 0) {
                     setVariablePriceProduct(p);
                  } else {
                     addToCart(p, 1);
                  }
                }}
                className="bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-[#FF4040] transition-all duration-200 active:scale-95 flex flex-col items-center justify-center text-center p-2 sm:p-5 min-h-[80px] sm:min-h-[120px] hover:-translate-y-0.5 hover:shadow-md group gap-0.5"
              >
                <span className="font-black text-gray-900 text-lg sm:text-2xl tracking-wide group-hover:text-[#FF4040] transition-colors leading-none">
                  {getProductAbbreviation(p.name, p.abbreviation)}
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
                <div key={tpl.id} className="flex items-center shrink-0">
                  <button
                    onClick={() => loadTemplateItems(tpl.id)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-l-full bg-white border-2 border-r-0 border-amber-400 font-bold text-amber-500 text-sm whitespace-nowrap active:scale-95 shadow-sm hover:bg-amber-50 transition-colors"
                  >
                    <Zap size={14} /> {tpl.name}
                  </button>
                  <button
                    onClick={() => setDeletingTemplate({ id: tpl.id, name: tpl.name })}
                    className="flex items-center justify-center py-1.5 px-2 rounded-r-full bg-white border-2 border-amber-400 text-amber-400 text-sm whitespace-nowrap active:scale-95 shadow-sm hover:bg-red-50 hover:text-red-500 hover:border-red-400 transition-colors"
                    title="Eliminar plantilla"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button 
                onClick={handleSaveTemplate}
                className="flex items-center justify-center py-1.5 px-3 rounded-full border border-dashed border-gray-400 font-bold text-gray-500 text-sm whitespace-nowrap hover:border-gray-600 hover:text-gray-700 transition-colors shrink-0"
              >
                + Guardar Actual
              </button>
            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
               {restockProducts.map(p => {
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
                      {getProductAbbreviation(p.name, p.abbreviation)}
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
                       value={
                         productPresetValues.length > 0 && productPresetValues.every((v) => typeof v === 'string')
                           ? (stringSelections[p.id] || '')
                           : currentQty
                       }
                       onChange={(qty) => {
                         if (typeof qty === 'string') {
                           const current = stringSelections[p.id];
                           const next = current === qty ? '' : qty;
                           setStringSelections(prev => ({ ...prev, [p.id]: next }));
                           const diff = (next ? 1 : 0) - currentQty;
                           addToRestockCart(p.id, diff, p.name, p.abbreviation, next || undefined);
                         } else {
                           const diff = qty - currentQty;
                           addToRestockCart(p.id, diff, p.name, p.abbreviation);
                         }
                       }}
                     />
                  </div>
                </div>
              );
            })}
            </div>
            {/* Espaciador para que el último producto no quede detrás del botón flotante */}
            <div style={{ height: '80px' }} aria-hidden="true" />

            {/* ── MIS PEDIDOS ── */}
            {(() => {
              const myPending   = (pendingRequests   || []).filter((r: any) => r.requester_point_id === pointId);
              const myCompleted = (completedRequests || []).filter((r: any) => r.requester_point_id === pointId);
              const myRejected  = (rejectedRequests  || []).filter((r: any) => r.requester_point_id === pointId);
              const allMine = [
                ...myPending.map((r: any) => ({ ...r, _status: 'pending' })),
                ...myCompleted.map((r: any) => ({ ...r, _status: 'completed' })),
                ...myRejected.map((r: any) => ({ ...r, _status: 'rejected' })),
              ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ).slice(0, 15); // Mostrar máx. 15 pedidos recientes

              if (allMine.length === 0) return null;

              const hasPending = myPending.length > 0;

              const fmtTime = (iso: string) =>
                iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

              return (
                <div className="mt-2 mb-4">
                  {/* Cabecera desplegable */}
                  <button
                    onClick={() => setShowMisPedidos(v => !v)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-amber-500" />
                      <span className="font-black text-gray-800 text-sm"><span>Mis Pedidos</span></span>
                      {hasPending && (
                        <span className="bg-[#FF4040] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          {myPending.length} pendiente{myPending.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {!hasPending && (
                        <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {allMine.length}
                        </span>
                      )}
                    </div>
                    {showMisPedidos ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>

                  {/* Lista de pedidos */}
                  {showMisPedidos && (
                    <div className="mt-2 space-y-2">
                      {allMine.map((req: any) => {
                        const isPending   = req._status === 'pending';
                        const isCompleted = req._status === 'completed';
                        const isRejected  = req._status === 'rejected';

                        return (
                          <div
                            key={req.id}
                            className={`rounded-2xl border-2 px-4 py-3 ${
                              isPending   ? 'bg-amber-50 border-amber-200' :
                              isCompleted ? 'bg-green-50 border-green-100' :
                                            'bg-red-50 border-red-100'
                            }`}
                          >
                            {/* Fila superior: estado + hora */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                {isPending && (
                                  <>
                                    <Clock size={13} className="text-amber-500" />
                                    <span className="text-amber-700 font-black text-xs"><span>En espera</span></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  </>
                                )}
                                {isCompleted && (
                                  <>
                                    <CheckCircle size={13} className="text-green-500" />
                                    <span className="text-green-700 font-black text-xs"><span>Surtido</span></span>
                                    {req.dejadorName && (
                                      <span className="text-green-600 font-bold text-xs"><span>· {req.dejadorName}</span></span>
                                    )}
                                  </>
                                )}
                                {isRejected && (
                                  <>
                                    <XCircle size={13} className="text-red-500" />
                                    <span className="text-red-700 font-black text-xs"><span>Rechazado</span></span>
                                  </>
                                )}
                              </div>
                              <span className="text-gray-400 font-bold text-[10px]">
                                <span>{fmtTime(isCompleted ? (req.completed_at || req.created_at) : isRejected ? (req.rejected_at || req.created_at) : req.created_at)}</span>
                              </span>
                            </div>

                            {/* Productos del pedido */}
                            <div className="flex flex-wrap gap-1.5">
                              {(req.items_payload || []).map((item: any, i: number) => (
                                <span
                                  key={i}
                                  className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                    isPending   ? 'bg-amber-100 text-amber-800' :
                                    isCompleted ? 'bg-green-100 text-green-800' :
                                                  'bg-red-100 text-red-700'
                                  }`}
                                >
                                  <span>{item.abbreviation || item.name} ×{item.qty}</span>
                                </span>
                              ))}
                            </div>

                            {/* Observación (si hay) */}
                            {req.observacion && (
                              <p className="text-xs font-bold text-gray-500 mt-1.5 italic">📝 <span>{req.observacion}</span></p>
                            )}

                            {/* Mensaje de estado para pendientes */}
                            {isPending && (
                              <div className="flex items-center gap-1 mt-2">
                                <AlertCircle size={11} className="text-amber-400" />
                                <span className="text-amber-600 font-bold text-[10px]"><span>El Dejador aún no ha atendido este pedido</span></span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        )}

        {/* SUBVISTA: CIERRE CAJA */}
        {activeTab === 'close' && (() => {
          const { soldItems: logSoldItems, theoretical: logTheoretical } = getLogisticsCalc();
          const cashVal = parseInt(cash) || 0;
          const transferVal = parseInt(transfer) || 0;
          const expensesVal = parseInt(expenses) || 0;
          const realTotal = cashVal + transferVal + expensesVal;
          const diff = realTotal - logTheoretical;

          return (
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
            
            {/* INFO DE JORNADA */}
            <div className="bg-amber-100/50 rounded-3xl p-5 border border-amber-200/50">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Jornada Activa</h4>
              <div className="flex gap-3">
                <div className="flex-1 bg-white rounded-xl shadow-sm px-4 py-3 font-black text-gray-800">{pointId || '—'}</div>
                <div className="flex-1 bg-white rounded-xl shadow-sm px-4 py-3 font-bold text-gray-500">{responsibleName || '—'}</div>
              </div>
            </div>


            {/* FORMULARIO FINANCIERO */}

            <div className="bg-white rounded-3xl p-5 sm:p-10 shadow-sm border border-white">
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] px-3 py-1 rounded-t-lg tracking-widest flex items-center gap-1">
                       <DollarSign size={12} strokeWidth={3} /> EFECTIVO
                    </div>
                    <MoneyInput value={cash} onChange={setCash} placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 px-5 font-black text-xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors" />
                 </div>
                 <div className="relative pt-6">
                    <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] px-3 py-1 rounded-t-lg tracking-widest flex items-center gap-1">
                       <Zap size={12} strokeWidth={3} fill="currentColor" /> TRANSFERENCIAS
                    </div>
                    <MoneyInput value={transfer} onChange={setTransfer} placeholder="$ 0"
                      className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 px-5 font-black text-xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors" />
                 </div>
               </div>

               <div className="relative pt-6 mb-6">
                  <div className="absolute top-0 left-4 bg-gray-900 text-white font-black text-[10px] px-3 py-1 rounded-t-lg tracking-widest">
                     GASTOS / SALIDAS
                  </div>
                  <div className="flex flex-col gap-2 bg-gray-50 border-2 border-gray-100 rounded-2xl p-3">
                     <MoneyInput value={expenses} onChange={setExpenses} placeholder="$ Valor"
                       className="w-full bg-white rounded-xl py-4 px-5 font-black text-xl text-gray-800 outline-none shadow-sm focus:ring-2 ring-[#FFB700] border-none" />
                     <input type="text" value={expensesDesc} onChange={(e) => setExpensesDesc(e.target.value)}
                       placeholder="Descripción del gasto..."
                       className="w-full bg-white rounded-xl py-3 px-5 font-bold text-gray-500 text-sm outline-none shadow-sm border-none focus:ring-2 ring-[#FFB700]" />
                  </div>
               </div>

            </div>




            {/* TOTAL DECLARADO */}
            <div className="bg-gray-50 rounded-3xl px-6 py-5 flex items-center justify-between border border-gray-100">
              <div>
                <span className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Ventas</span>
                <span className="text-xs font-bold text-gray-300">Efectivo + Transferencias</span>
              </div>
              <span className="text-3xl font-black text-gray-900">{formatMoney(cashVal + transferVal)}</span>
            </div>

            <button onClick={handleCloseShift}
              className="w-full flex items-center justify-center gap-3 bg-[#FF4040] text-white font-black text-lg sm:text-2xl py-5 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] hover:scale-[1.02] transition-all active:scale-95">
              <Check size={26} strokeWidth={3} />
              CERRAR JORNADA
            </button>

          </div>
          );
        })()}

      </div>

      {/* CAMPO OBSERVACIÓN + BOTÓN FLOTANTE: ENVIAR SOLICITUD */}
      {activeTab === 'restock' && restockCart.some((i: any) => i.qty > 0) && (
        <div className="fixed bottom-[72px] left-4 right-4 z-40 flex flex-col items-center gap-2 pointer-events-none">
          {/* Textarea para la observación */}
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-amber-200 px-4 py-2 pointer-events-auto">
            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">📝 Nota al Dejador (opcional)</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: Estoy en la esquina del parque, necesito cambio..."
              rows={2}
              maxLength={200}
              className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none resize-none placeholder-gray-300 leading-snug"
            />
          </div>
          {/* Botón Enviar */}
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

      {/* Modal guardar plantilla */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Guardar Plantilla</h2>
            <p className="text-sm text-gray-500 mb-4">Dale un nombre a esta configuración.</p>
            <input
              type="text" autoFocus value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmSaveTemplate()}
              placeholder="Ej: Carga Lunes"
              className="w-full border-2 border-amber-300 rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-amber-500 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveTemplate(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95">Cancelar</button>
              <button onClick={confirmSaveTemplate} disabled={!newTemplateName.trim()} className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-black text-sm active:scale-95 disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal borrar plantilla */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">¿Eliminar plantilla?</h2>
            <p className="text-sm text-gray-500 mb-6">"{deletingTemplate.name}" se borrará permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTemplate(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95">Cancelar</button>
              <button onClick={() => { deleteLoadTemplate(deletingTemplate.id); setDeletingTemplate(null); }} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm active:scale-95">Sí, borrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
