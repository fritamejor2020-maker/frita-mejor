import React, { useState, useRef, useEffect } from 'react';
import { Calculator, Package, DollarSign, X, Zap, LogOut, Check, Pencil, Save, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle, Camera, Send, Trash2, Share2, ArrowRightLeft, Image } from 'lucide-react';
import { useSellerSessionStore } from '../store/useSellerSessionStore';
import { usePosStore } from '../store/usePosStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { calculateClosingStatus } from '../utils/financeUtils';
import { formatMoney, getProductAbbreviation, compressImage } from '../utils/formatUtils';
import { NumberSelectorGroup } from '../components/ui/NumberSelectorGroup';
import { MoneyInput } from '../components/ui/MoneyInput';
import { BottomNav } from '../components/ui/BottomNav';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useVendorTracking } from '../lib/useVendorTracking';
import { useVendorTransferStore } from '../store/useVendorTransferStore';
import { usePayrollStore } from '../store/usePayrollStore';
import { supabase } from '../lib/supabase';

export const VendedorDashboard = () => {
  const { isSetupComplete, pointId, shift, responsibleName, endShift, openedAt } = useSellerSessionStore();
  const { cart, total, addToCart, checkout, clearCart } = usePosStore();
  const { restockCart, addToRestockCart, sendRestockRequest, clearRestockCart, calcSoldByVehicle,
          pendingRequests, completedRequests, rejectedRequests } = useLogisticsStore();
  const { getPosItems, getVendedorPosItems, getDeliveryItems, loadTemplates, addLoadTemplate, deleteLoadTemplate, addPosShift, updatePosShift, posShifts, salesGoals = [] } = useInventoryStore();
  const { payrollEmployees = [] } = usePayrollStore();
  const { user, signOut, updateUserPresets } = useAuthStore();
  const { transfers: allVendorTransfers, addTransfer: addVendorTransfer, deleteTransfer: deleteVendorTransfer, updateTransfer: updateVendorTransfer, getShiftTransfers, getShiftTransferTotal } = useVendorTransferStore();
  
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

  // NOTA: El posShift se crea en SellerSetupView.handleStartShift (no aquí)
  // para evitar duplicados por race condition con la rehidratación de Zustand persist.

  // ── GPS Tracking: compartir ubicación en tiempo real con admin/dejadores ──
  const trackingName = responsibleName || (user as any)?.name || 'Vendedor';
  const trackingId   = (user as any)?.id || pointId || 'unknown';
  const { status: gpsStatus, retry: gpsRetry, stop: gpsStop } = useVendorTracking(
    trackingId,
    trackingName,
    pointId || 'unknown',    // pointId (T1, T2…) para cruzar con posShifts en el mapa
    isSetupComplete          // Solo activo cuando el turno está abierto
  );

  const [activeTab, setActiveTab] = useState('pos');

  // --- Estados de Pedidos Móviles (Uber / Rappi-style) ---
  const [pendingDelivery, setPendingDelivery] = useState<any>(null);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!trackingId || !isSetupComplete) return;

    // 1. Cargar si ya hay un pedido activo aceptado por mí
    const fetchActiveDelivery = async () => {
      const { data } = await supabase
        .from('delivery_requests')
        .select('*')
        .eq('assigned_vendor_id', trackingId)
        .eq('status', 'accepted')
        .limit(1);
      
      if (data && data.length > 0) {
        setActiveDelivery(data[0]);
      }
    };

    // 2. Cargar si hay algún pedido pendiente asignado a mí
    const fetchPendingDelivery = async () => {
      const { data } = await supabase
        .from('delivery_requests')
        .select('*')
        .eq('assigned_vendor_id', trackingId)
        .eq('status', 'pending')
        .limit(1);
      
      if (data && data.length > 0) {
        setPendingDelivery(data[0]);
        if (!audioRef.current) {
          audioRef.current = new Audio('/sounds/mixkit_bell.wav');
          audioRef.current.loop = true;
        }
        audioRef.current.play().catch(() => {});
      }
    };

    fetchActiveDelivery();
    fetchPendingDelivery();

    // 3. Suscribirse a cambios en tiempo real
    const channel = supabase.channel(`vendor-delivery-${trackingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_requests',
        filter: `assigned_vendor_id=eq.${trackingId}`
      }, (payload: any) => {
        const order = payload.new;
        if (!order) return;

        if (order.status === 'pending') {
          setPendingDelivery(order);
          if (!audioRef.current) {
            audioRef.current = new Audio('/sounds/mixkit_bell.wav');
            audioRef.current.loop = true;
          }
          audioRef.current.play().catch(() => {});
        } else if (order.status === 'accepted') {
          setActiveDelivery(order);
          setPendingDelivery(null);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        } else if (order.status === 'completed' || order.status === 'rejected') {
          setActiveDelivery(null);
          setPendingDelivery(null);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [trackingId, isSetupComplete]);

  const handleAcceptDelivery = async (orderId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const { error } = await supabase
      .from('delivery_requests')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', orderId);
    
    if (error) {
      toast.error('Error al aceptar el pedido: ' + error.message);
    } else {
      toast.success('¡Pedido aceptado! 🛵 Dirígete al cliente.');
    }
  };

  const handleRejectDelivery = async (orderId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      // 1. Obtener la orden actual
      const { data: order } = await supabase.from('delivery_requests').select('*').eq('id', orderId).single();
      if (!order) return;

      const rejectedList = [...(order.rejected_vendor_ids || []), trackingId];

      // 2. Buscar otros vendedores activos
      const { data: allVendors } = await supabase.from('vendor_locations').select('*').eq('is_active', true);
      
      const candidates = (allVendors || [])
        .filter(v => !rejectedList.includes(v.vendor_id))
        .map(v => ({
          ...v,
          distance: getHaversineDistance(order.client_lat, order.client_lng, v.lat, v.lng)
        }))
        .sort((a, b) => a.distance - b.distance);

      if (candidates.length > 0) {
        // Reasignar al siguiente carrito más cercano
        const nextVendor = candidates[0];
        await supabase
          .from('delivery_requests')
          .update({
            assigned_vendor_id: nextVendor.vendor_id,
            rejected_vendor_ids: rejectedList,
            status: 'pending'
          })
          .eq('id', orderId);
        
        toast.success('Pedido rechazado y reasignado al siguiente carrito.');
      } else {
        // No hay más carritos candidatos
        await supabase
          .from('delivery_requests')
          .update({
            status: 'rejected',
            rejected_vendor_ids: rejectedList
          })
          .eq('id', orderId);
        
        toast.success('Pedido rechazado.');
      }
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setPendingDelivery(null);
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    const { error } = await supabase
      .from('delivery_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', orderId);
    
    if (error) {
      toast.error('Error al finalizar el pedido: ' + error.message);
    } else {
      setActiveDelivery(null);
      toast.success('¡Pedido entregado con éxito! 🎉 Stock descontado.');
    }
  };

  // For products with string presets (e.g. CAM with MON/20k/50k), track selected value separately
  const [stringSelections, setStringSelections] = useState<Record<string, string>>({});
  // Campo de observación para el pedido de surtido
  const [observacion, setObservacion] = useState('');
  // Panel Mis Pedidos
  const [showMisPedidos, setShowMisPedidos] = useState(false);

  // Cierre state
  const [cash, setCash] = useState('');
  const [expenses, setExpenses] = useState('');
  const [expensesDesc, setExpensesDesc] = useState('');

  // Transferencias state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferPhoto, setTransferPhoto] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const transferFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  // Transferencias del turno actual
  const shiftTransfers = getShiftTransfers(pointId, openedAt);
  const shiftTransferTotal = getShiftTransferTotal(pointId, openedAt);


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
    const transferVal = shiftTransferTotal;
    const expensesVal = parseInt(expenses) || 0;
    const realTotal = cashVal + transferVal + expensesVal;

    const { soldItems, theoretical: theorySalesVal } = getLogisticsCalc();
    const difference = theorySalesVal - realTotal;
    const status = difference === 0 ? 'CUADRADO' : difference > 0 ? 'FALTANTE' : 'SOBRANTE';

    // Calculate goals and bonuses
    const totalSales = cashVal + transferVal;
    const activeBranchId = (user as any)?.branchId || 'BRANCH-001';
    const dayOfWeek = new Date().getDay();

    const activeGoal = salesGoals.find((g: any) => 
      g.branchId === activeBranchId && 
      g.targetType === 'VEHICLE' && 
      g.targetId === pointId && 
      g.shift === shift &&
      g.daysOfWeek.includes(dayOfWeek)
    );

    const goalMet = activeGoal && totalSales >= activeGoal.minAmount;
    const excess = goalMet ? (totalSales - activeGoal.minAmount) : 0;
    const totalBonus = goalMet ? (excess * (activeGoal.bonusPercent / 100)) : 0;

    const bonusRecipients = [];
    if (goalMet) {
      const currentEmp = payrollEmployees.find((e: any) => e.name === responsibleName);
      bonusRecipients.push({
        employeeId: currentEmp?.id || 'TEMP-' + Date.now(),
        name: responsibleName || 'Vendedor',
        documentId: currentEmp?.documentId || '',
        bonusAmount: Math.round(totalBonus)
      });
    }

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
          earnedBonus: Math.round(totalBonus),
          bonusGoalAmount: activeGoal?.minAmount || 0,
          bonusPercent: activeGoal?.bonusPercent || 0,
          bonusRecipients
      };
      // Buscar el turno abierto de este vehículo/jornada hoy.
      // Búsqueda amplia: mismo pointId + tipo VENDEDOR + sin cerrar + mismo día.
      // Esto evita duplicados cuando el vendedor reabre la app y openedAt cambia.
      const today = new Date().toISOString().slice(0, 10); // "2026-05-06"
      const shiftKey = shiftData.shift; // "AM" o "PM"

      // 1. Buscar turno abierto (sin closedAt) para este triciclo hoy
      let activeShiftRecord = (posShifts || []).find(
        (s: any) => s.type === 'VENDEDOR' && s.pointId === pointId && !s.closedAt
          && s.openedAt?.startsWith(today)
      );

      // 2. Si no hay abierto, buscar por openedAt exacto (el del session store)
      if (!activeShiftRecord) {
        activeShiftRecord = (posShifts || []).find(
          (s: any) => s.type === 'VENDEDOR' && s.pointId === pointId && s.openedAt === openedAt
        );
      }

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

  const activeOrdersCount = (pendingDelivery ? 1 : 0) + (activeDelivery ? 1 : 0);

  const tabs = [
    { id: 'pos', label: 'Venta', icon: <Calculator size={24} /> },
    { id: 'deliveries', label: 'Pedidos', icon: <Clock size={24} />, badge: activeOrdersCount },
    { id: 'restock', label: 'Pedir', icon: <Package size={24} /> },
    { id: 'transfers', label: 'Transf.', icon: <ArrowRightLeft size={24} /> },
    { id: 'close', label: 'Cierre', icon: <DollarSign size={24} /> }
  ];

  const getHeaderTitle = () => {
    if (activeTab === 'pos') return 'Venta Rápida';
    if (activeTab === 'deliveries') return 'Pedidos Clientes';
    if (activeTab === 'restock') return 'Pedir Surtido';
    if (activeTab === 'transfers') return 'Transferencias';
    if (activeTab === 'close') return 'Cierre Caja';
    return 'Dashboard';
  };

  const currentDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

  return (
    <div className="min-h-screen bg-[#FFD56B] font-sans w-full flex flex-col" style={{ paddingBottom: activeTab === 'pos' ? '240px' : '160px' }}>
      
      {/* OVERLAY DE PEDIDO ENTRANTE (UBER-STYLE ALERT) */}
      {pendingDelivery && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md p-6 sm:p-8 shadow-2xl border-4 border-[#FFB700] animate-bounce flex flex-col gap-5 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-amber-400 via-red-500 to-amber-400"></div>
            
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-4xl mx-auto border-4 border-amber-300 animate-pulse">
              🔔
            </div>

            <div>
              <span className="bg-[#FF4040] text-white font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                ¡Nuevo Pedido Recibido!
              </span>
              <h3 className="text-2xl font-black text-gray-900 mt-2 leading-none">{pendingDelivery.client_name}</h3>
              <p className="text-sm font-bold text-gray-400 mt-1">📞 {pendingDelivery.client_phone}</p>
            </div>

            {/* Address & Items */}
            <div className="bg-gray-50 rounded-3xl p-4 text-left flex flex-col gap-2 border border-gray-100">
              {pendingDelivery.client_address && (
                <div className="text-xs font-bold text-gray-700">
                  <span className="text-gray-400 block text-[9px] font-black uppercase tracking-wider">Dirección de Entrega:</span>
                  📍 {pendingDelivery.client_address}
                </div>
              )}
              
              <div>
                <span className="text-gray-400 block text-[9px] font-black uppercase tracking-wider mb-1">Productos Solicitados:</span>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                  {(pendingDelivery.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between font-bold text-xs text-gray-700">
                      <span>{item.name} <span className="text-[#FF4040]">× {item.qty}</span></span>
                      <span className="font-black text-gray-900">{formatMoney(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200/50 flex justify-between items-center mt-1">
                <span className="text-xs font-black text-gray-400 uppercase tracking-wide">Monto Total:</span>
                <span className="text-lg font-black text-gray-900">{formatMoney(pendingDelivery.total_amount)}</span>
              </div>
            </div>

            {/* Botones */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => handleRejectDelivery(pendingDelivery.id)}
                className="bg-red-50 hover:bg-red-100 text-[#FF4040] font-black py-4 px-6 rounded-2xl border-2 border-red-100 transition-all active:scale-95 text-base flex items-center justify-center gap-1.5"
              >
                <X size={18} strokeWidth={3} /> Rechazar
              </button>
              <button
                onClick={() => handleAcceptDelivery(pendingDelivery.id)}
                className="bg-green-500 hover:bg-green-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-green-200 transition-all active:scale-95 text-base flex items-center justify-center gap-1.5"
              >
                <Check size={18} strokeWidth={3} /> Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

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
        
        {/* BANNER DE PEDIDO ACTIVO (CAMINO AL CLIENTE) */}
        {activeDelivery && (
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-[32px] p-5 text-white shadow-xl shadow-green-200/50 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-4 border-white animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shrink-0 mt-0.5">
                🛵
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="bg-white/20 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider w-max">
                  Pedido Activo en Curso
                </span>
                <h3 className="text-lg font-black leading-tight">Cliente: {activeDelivery.client_name}</h3>
                <p className="text-xs font-bold opacity-90">
                  📞 <a href={`tel:${activeDelivery.client_phone}`} className="underline font-black">{activeDelivery.client_phone}</a>
                  {activeDelivery.client_address && ` · 📍 ${activeDelivery.client_address}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(activeDelivery.items || []).map((item: any, i: number) => (
                    <span key={i} className="text-[10px] bg-white/10 font-bold px-2 py-0.5 rounded-full">
                      {item.name} ×{item.qty}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleCompleteDelivery(activeDelivery.id)}
              className="bg-white hover:bg-green-50 text-green-700 font-black py-3.5 px-6 rounded-2xl shadow-md transition-all active:scale-95 text-sm whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={16} strokeWidth={2.5} /> ENTREGAR PEDIDO
            </button>
          </div>
        )}
        
        {/* SUBVISTA: POS (Venta Rápida) */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            {posProducts.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  if (p.variablePrice === true || !p.price || p.price <= 0) {
                     setVariablePriceProduct(p);
                     setVariablePriceInput(p.referencePrice ? String(p.referencePrice) : '');
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

        {/* SUBVISTA: PEDIDOS CLIENTES */}
        {activeTab === 'deliveries' && (
          <div className="max-w-md mx-auto space-y-4">
            {/* Pedido Pendiente (si lo hay) */}
            {pendingDelivery && (
              <div className="bg-white rounded-[32px] p-6 border-4 border-amber-400 shadow-lg space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-pulse">🔔</span>
                  <div>
                    <span className="bg-[#FF4040] text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Pedido Pendiente
                    </span>
                    <h3 className="text-xl font-black text-gray-900 mt-1 leading-none">{pendingDelivery.client_name}</h3>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm text-gray-700">
                  <p className="font-bold">📞 Celular: {pendingDelivery.client_phone}</p>
                  {pendingDelivery.client_address && (
                    <p className="font-bold">📍 Dirección: {pendingDelivery.client_address}</p>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">Productos:</span>
                    {(pendingDelivery.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between font-bold text-xs">
                        <span>{item.name} × {item.qty}</span>
                        <span>{formatMoney(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-black text-gray-900">Total:</span>
                    <span className="font-black text-lg text-gray-900">{formatMoney(pendingDelivery.total_amount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleRejectDelivery(pendingDelivery.id)}
                    className="bg-red-50 hover:bg-red-100 text-[#FF4040] font-black py-3 px-4 rounded-xl border border-red-100 transition-all active:scale-95 text-sm flex items-center justify-center gap-1.5"
                  >
                    <X size={16} strokeWidth={3} /> Rechazar
                  </button>
                  <button
                    onClick={() => handleAcceptDelivery(pendingDelivery.id)}
                    className="bg-green-500 hover:bg-green-600 text-white font-black py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 text-sm flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} strokeWidth={3} /> Aceptar
                  </button>
                </div>
              </div>
            )}

            {/* Pedido Activo (si lo hay) */}
            {activeDelivery && (
              <div className="bg-white rounded-[32px] p-6 border-4 border-green-500 shadow-lg space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl animate-pulse">🛵</span>
                  <div>
                    <span className="bg-green-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Pedido en Curso
                    </span>
                    <h3 className="text-xl font-black text-gray-900 mt-1 leading-none">{activeDelivery.client_name}</h3>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm text-gray-700">
                  <p className="font-bold">
                    📞 Celular: <a href={`tel:${activeDelivery.client_phone}`} className="underline text-green-600 font-black">{activeDelivery.client_phone}</a>
                  </p>
                  {activeDelivery.client_address && (
                    <p className="font-bold">📍 Dirección: {activeDelivery.client_address}</p>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">Productos:</span>
                    {(activeDelivery.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between font-bold text-xs">
                        <span>{item.name} × {item.qty}</span>
                        <span>{formatMoney(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-black text-gray-900">Total:</span>
                    <span className="font-black text-lg text-gray-900">{formatMoney(activeDelivery.total_amount)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCompleteDelivery(activeDelivery.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition-all active:scale-95 text-base flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={18} strokeWidth={2.5} /> ENTREGAR PEDIDO
                </button>
              </div>
            )}

            {/* Si no hay pedidos activos ni pendientes */}
            {!pendingDelivery && !activeDelivery && (
              <div className="bg-white rounded-[32px] p-8 text-center border-2 border-dashed border-gray-300 space-y-3">
                <span className="text-5xl block">📥</span>
                <h3 className="font-black text-gray-800 text-lg">Sin pedidos activos</h3>
                <p className="text-xs text-gray-400 font-bold max-w-xs mx-auto">
                  Los pedidos que realicen los clientes cercanos aparecerán aquí automáticamente en tiempo real.
                </p>
              </div>
            )}

            {/* Historial de pedidos del turno */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm space-y-4">
              <h4 className="font-black text-gray-800 text-sm border-b border-gray-100 pb-2">
                📝 Historial del Turno
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(() => {
                  const isThisShift = (req: any) => req.openedAt === openedAt || (req.pointId === pointId && req.shift === shift);
                  const myCompleted = (completedRequests || []).filter(isThisShift);
                  const myRejected = (rejectedRequests || []).filter(isThisShift);
                  
                  const allHistory = [
                    ...myCompleted.map(c => ({ ...c, _status: 'completed' })),
                    ...myRejected.map(r => ({ ...r, _status: 'rejected' }))
                  ].sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());

                  if (allHistory.length === 0) {
                    return <p className="text-xs text-gray-400 font-bold text-center py-4">Aún no has procesado pedidos hoy.</p>;
                  }

                  return allHistory.map((req: any, i: number) => {
                    const isCompleted = req._status === 'completed';
                    return (
                      <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="font-black text-gray-800">{req.clientName || req.client_name || 'Cliente'}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                            {isCompleted ? '✅ Entregado' : '❌ Rechazado'} · {formatMoney(req.total_amount || req.total || 0)}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold">
                          {new Date(req.completed_at || req.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
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
              // Filtrar por punto de venta Y por jornada actual (solo desde que abrió este turno)
              // Esto evita mostrar pedidos de jornadas anteriores o de otros vendedores
              const shiftStart = openedAt ? new Date(openedAt).getTime() : 0;
              const isThisShift = (r: any) =>
                r.requester_point_id === pointId &&
                new Date(r.created_at).getTime() >= shiftStart;

              const myPending   = (pendingRequests   || []).filter(isThisShift);
              const myCompleted = (completedRequests || []).filter(isThisShift);
              const myRejected  = (rejectedRequests  || []).filter(isThisShift);
              const allMine = [
                ...myPending.map((r: any) => ({ ...r, _status: 'pending' })),
                ...myCompleted.map((r: any) => ({ ...r, _status: 'completed' })),
                ...myRejected.map((r: any) => ({ ...r, _status: 'rejected' })),
              ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ).slice(0, 15);

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
                        const isRead      = isPending && !!req.readAt;   // Leído pero aún no surtido
                        const isUnread    = isPending && !req.readAt;    // En espera sin leer
                        const isCompleted = req._status === 'completed';
                        const isRejected  = req._status === 'rejected';

                        return (
                          <div
                            key={req.id}
                            className={`rounded-2xl border-2 px-4 py-3 ${
                              isRead      ? 'bg-blue-50 border-blue-200' :
                              isUnread    ? 'bg-amber-50 border-amber-200' :
                              isCompleted ? 'bg-green-50 border-green-100' :
                                            'bg-red-50 border-red-100'
                            }`}
                          >
                            {/* Fila superior: estado + hora */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                {isRead && (
                                  <>
                                    <span className="text-base">👁️</span>
                                    <span className="text-blue-700 font-black text-xs"><span>Leído</span></span>
                                    {req.readByDejador && (
                                      <span className="text-blue-500 font-bold text-xs"><span>· {req.readByDejador}</span></span>
                                    )}
                                  </>
                                )}
                                {isUnread && (
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
                              {(req.items_payload || []).filter((item: any) => item.qty > 0).map((item: any, i: number) => (
                                <span
                                  key={i}
                                  className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                    isRead      ? 'bg-blue-100 text-blue-800' :
                                    isUnread    ? 'bg-amber-100 text-amber-800' :
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

                            {/* Mensaje de estado */}
                            {isUnread && (
                              <div className="flex items-center gap-1 mt-2">
                                <AlertCircle size={11} className="text-amber-400" />
                                <span className="text-amber-600 font-bold text-[10px]"><span>El Dejador aún no ha visto este pedido</span></span>
                              </div>
                            )}
                            {isRead && (
                              <div className="flex items-center gap-1 mt-2">
                                <span className="text-blue-500 font-bold text-[10px]"><span>✓ El Dejador lo vio — en camino pronto</span></span>
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

        {/* SUBVISTA: TRANSFERENCIAS BANCARIAS */}
        {activeTab === 'transfers' && (
          <div className="max-w-3xl mx-auto space-y-4">

            {/* Formulario nueva transferencia */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-white">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Nueva Transferencia</h4>

              {/* Monto */}
              <div className="relative pt-6 mb-4">
                <div className="absolute top-0 left-4 bg-[#FF4040] text-white font-black text-[10px] px-3 py-1 rounded-t-lg tracking-widest flex items-center gap-1">
                  <DollarSign size={12} strokeWidth={3} /> VALOR
                </div>
                <MoneyInput value={transferAmount} onChange={setTransferAmount} placeholder="$ 0"
                  className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 px-5 font-black text-2xl text-gray-800 outline-none focus:border-[#FFB700] shadow-sm transition-colors" />
              </div>

              {/* Nota opcional */}
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Nota (opcional) — ej: Nequi de Juan"
                className="w-full bg-gray-50 rounded-2xl py-3 px-5 font-bold text-gray-500 text-sm outline-none shadow-sm border-none focus:ring-2 ring-[#FFB700] mb-4"
              />

              {/* Foto del comprobante */}
              <input
                ref={transferFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const compressedBase64 = await compressImage(file, 800, 0.7);
                    setTransferPhoto(compressedBase64);
                  } catch (err) {
                    console.error('Error comprimiendo foto:', err);
                    toast.error('No se pudo procesar la foto');
                  }
                  e.target.value = '';
                }}
              />

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => transferFileRef.current?.click()}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                    transferPhoto
                      ? 'bg-green-50 border-2 border-green-200 text-green-700'
                      : 'bg-gray-50 border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {transferPhoto ? (
                    <><CheckCircle size={16} /> Foto lista ✔</>
                  ) : (
                    <><Camera size={16} /> Tomar / Subir Foto</>
                  )}
                </button>
                {transferPhoto && (
                  <button
                    onClick={() => setTransferPhoto(null)}
                    className="w-12 flex items-center justify-center rounded-2xl bg-red-50 border-2 border-red-100 text-red-400 active:scale-95"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Preview de la foto */}
              {transferPhoto && (
                <div className="mb-4 rounded-2xl overflow-hidden border-2 border-gray-100">
                  <img src={transferPhoto} alt="Comprobante" className="w-full max-h-48 object-cover" />
                </div>
              )}

              {/* Botón registrar */}
              <button
                onClick={() => {
                  const amount = parseInt(transferAmount) || 0;
                  if (amount <= 0) { toast.error('Ingresa un valor válido'); return; }
                  try {
                    addVendorTransfer({
                      pointId,
                      shiftOpenedAt: openedAt,
                      amount,
                      photoBase64: transferPhoto,
                      note: transferNote,
                    });
                    toast.success(`✔ Transferencia de ${formatMoney(amount)} registrada`);
                  } catch (err) {
                    console.error('Error al guardar transferencia (probablemente cuota de almacenamiento llena):', err);
                    toast.error('La transferencia se procesó pero podrías estar sin espacio local. Por favor reinicia la app.');
                  } finally {
                    setTransferAmount('');
                    setTransferNote('');
                    setTransferPhoto(null);
                    if (transferFileRef.current) {
                      transferFileRef.current.value = '';
                    }
                  }
                }}
                disabled={!(parseInt(transferAmount) > 0)}
                className="w-full flex items-center justify-center gap-2 bg-[#FF4040] text-white font-black text-lg py-4 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                <Send size={20} /> Registrar Transferencia
              </button>
            </div>

            {/* Total del turno */}
            {shiftTransfers.length > 0 && (
              <div className="bg-gray-50 rounded-3xl px-6 py-5 flex items-center justify-between border border-gray-100">
                <div>
                  <span className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Transferencias</span>
                  <span className="text-xs font-bold text-gray-300">{shiftTransfers.length} transferencia{shiftTransfers.length !== 1 ? 's' : ''} hoy</span>
                </div>
                <span className="text-3xl font-black text-gray-900">{formatMoney(shiftTransferTotal)}</span>
              </div>
            )}

            {/* Lista de transferencias del turno */}
            {shiftTransfers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Historial del Turno</h4>
                {shiftTransfers.map((t: any) => {
                  const time = new Date(t.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                  const isEditing = editingTransferId === t.id;

                  // Modo edición inline
                  if (isEditing) {
                    return (
                      <div key={t.id} className="bg-amber-50 rounded-2xl shadow-sm border-2 border-amber-300 overflow-hidden p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-600 uppercase tracking-widest">✏️ Editando Transferencia</span>
                          <span className="text-xs font-bold text-gray-300">{time}</span>
                        </div>
                        {/* Monto */}
                        <MoneyInput value={editAmount} onChange={setEditAmount} placeholder="$ 0"
                          className="w-full bg-white border-2 border-amber-200 rounded-2xl py-3 px-4 font-black text-xl text-gray-800 outline-none focus:border-amber-400 transition-colors" />
                        {/* Nota */}
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Nota (opcional)"
                          className="w-full bg-white rounded-xl py-2.5 px-4 font-bold text-gray-500 text-sm outline-none border-2 border-gray-100 focus:border-amber-300"
                        />
                        {/* Foto */}
                        <input
                          ref={editFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => setEditPhoto(ev.target?.result as string);
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => editFileRef.current?.click()}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                              editPhoto ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-gray-50 border border-dashed border-gray-200 text-gray-400'
                            }`}
                          >
                            {editPhoto ? <><CheckCircle size={14} /> Foto lista</> : <><Camera size={14} /> Cambiar Foto</>}
                          </button>
                          {editPhoto && (
                            <button onClick={() => setEditPhoto(null)}
                              className="w-10 flex items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-400 active:scale-95">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {editPhoto && (
                          <img src={editPhoto} alt="Preview" className="w-full h-24 object-cover rounded-xl border border-gray-100" />
                        )}
                        {/* Acciones */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              const newAmount = parseInt(editAmount) || 0;
                              if (newAmount <= 0) { toast.error('Ingresa un valor válido'); return; }
                              updateVendorTransfer(t.id, {
                                amount: newAmount,
                                note: editNote.trim(),
                                ...(editPhoto !== t.photoBase64 ? { photoBase64: editPhoto } : {}),
                              });
                              toast.success('✔ Transferencia actualizada');
                              setEditingTransferId(null);
                            }}
                            className="flex-1 bg-amber-500 text-white font-black py-2.5 rounded-xl active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <Save size={14} /> Guardar
                          </button>
                          <button
                            onClick={() => setEditingTransferId(null)}
                            className="flex-1 bg-gray-100 text-gray-500 font-bold py-2.5 rounded-xl active:scale-95"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <ArrowRightLeft size={18} />
                          </div>
                          <div>
                            <span className="font-black text-gray-900 text-lg">{formatMoney(t.amount)}</span>
                            {t.note && <p className="text-xs font-bold text-gray-400 leading-tight">{t.note}</p>}
                            {t.editedAt && <p className="text-[10px] font-bold text-amber-400">✏️ editada</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-300">{time}</span>
                          {/* Ver foto */}
                          {t.photoBase64 && (
                            <button
                              onClick={() => setViewingPhoto(t.photoBase64)}
                              className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center active:scale-90"
                              title="Ver comprobante"
                            >
                              <Image size={14} />
                            </button>
                          )}
                          {/* Editar */}
                          <button
                            onClick={() => {
                              setEditingTransferId(t.id);
                              setEditAmount(String(t.amount));
                              setEditNote(t.note || '');
                              setEditPhoto(t.photoBase64 || null);
                            }}
                            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center active:scale-90"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {/* Compartir WhatsApp */}
                          <button
                            onClick={() => {
                              const msg = `*Transferencia ${pointId}*%0A💰 ${formatMoney(t.amount)}%0A📝 ${t.note || 'Sin nota'}%0A🕐 ${time}%0A👤 ${t.vendorName}`;
                              window.open(`https://wa.me/?text=${msg}`, '_blank');
                            }}
                            className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center active:scale-90"
                            title="Compartir por WhatsApp"
                          >
                            <Share2 size={14} />
                          </button>
                          {/* Eliminar */}
                          <button
                            onClick={() => setDeletingTransferId(t.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center active:scale-90"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {/* Miniatura de la foto */}
                      {t.photoBase64 && (
                        <button onClick={() => setViewingPhoto(t.photoBase64)} className="w-full">
                          <img src={t.photoBase64} alt="Comprobante" className="w-full h-24 object-cover border-t border-gray-100 hover:opacity-80 transition-opacity" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {shiftTransfers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">💸</div>
                <p className="text-gray-400 font-bold text-sm">No hay transferencias en este turno</p>
                <p className="text-gray-300 font-bold text-xs mt-1">Registra las transferencias que recibas</p>
              </div>
            )}
          </div>
        )}

        {/* SUBVISTA: CIERRE CAJA */}
        {activeTab === 'close' && (() => {
          const { soldItems: logSoldItems, theoretical: logTheoretical } = getLogisticsCalc();
          const cashVal = parseInt(cash) || 0;
          const transferVal = shiftTransferTotal;
          const expensesVal = parseInt(expenses) || 0;
          const realTotal = cashVal + transferVal + expensesVal;
          const diff = realTotal - logTheoretical;

          const activeBranchId = (user as any)?.branchId || 'BRANCH-001';
          const dayOfWeek = new Date().getDay();
          const activeGoal = salesGoals.find((g: any) => 
            g.branchId === activeBranchId && 
            g.targetType === 'VEHICLE' && 
            g.targetId === pointId && 
            g.shift === shift &&
            g.daysOfWeek.includes(dayOfWeek)
          );

          const totalSales = cashVal + transferVal;
          const goalMet = activeGoal && totalSales >= activeGoal.minAmount;
          const excess = goalMet ? (totalSales - activeGoal.minAmount) : 0;
          const totalBonus = goalMet ? (excess * (activeGoal.bonusPercent / 100)) : 0;

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

            {/* GOAL STATUS */}
            {activeGoal && (
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <span className="font-black text-gray-800 text-sm flex items-center gap-1.5">🎯 Meta de Turno: <span className="text-gray-500 font-bold">{activeGoal.targetId}</span></span>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${goalMet ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {goalMet ? '¡META SUPERADA! 🥳' : 'Meta en curso'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-500">
                  <div>Ventas Totales: <span className="text-gray-900 block font-black text-base">{formatMoney(totalSales)}</span></div>
                  <div>Meta Asignada: <span className="text-gray-900 block font-black text-base">{formatMoney(activeGoal.minAmount)}</span></div>
                  {goalMet ? (
                    <>
                      <div>Excedente: <span className="text-green-600 block font-black text-base">+{formatMoney(excess)}</span></div>
                      <div>Tu Bonificación ({activeGoal.bonusPercent}%): <span className="text-violet-600 block font-black text-base">{formatMoney(totalBonus)}</span></div>
                    </>
                  ) : (
                    <div className="col-span-2 bg-amber-50 text-amber-800 p-3 rounded-xl text-center text-xs font-bold mt-1">
                      ⚠️ Estás a <span className="font-black text-amber-950">{formatMoney(activeGoal.minAmount - totalSales)}</span> de alcanzar la meta y ganar bonificación.
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    <div className="w-full bg-blue-50 border-2 border-blue-100 rounded-2xl py-4 px-5 font-black text-xl text-blue-700 cursor-default flex items-center justify-between">
                      <span>{formatMoney(shiftTransferTotal)}</span>
                      <span className="text-xs font-bold text-blue-400">{shiftTransfers.length} transf.</span>
                    </div>
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
                  onFocus={e => e.target.select()}
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

      {/* Modal ver foto transferencia */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={() => setViewingPhoto(null)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-500 active:scale-90 z-10"
            >
              <X size={20} />
            </button>
            <img src={viewingPhoto} alt="Comprobante" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar transferencia */}
      {deletingTransferId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">¿Eliminar transferencia?</h2>
            <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTransferId(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95">Cancelar</button>
              <button onClick={() => { deleteVendorTransfer(deletingTransferId); setDeletingTransferId(null); toast.success('Transferencia eliminada'); }} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm active:scale-95">Sí, borrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
