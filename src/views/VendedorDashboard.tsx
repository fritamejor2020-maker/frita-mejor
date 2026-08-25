import React, { useState, useRef, useEffect } from 'react';
import { Calculator, Package, DollarSign, X, Zap, LogOut, Check, Pencil, Save, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertCircle, Camera, Send, Trash2, Share2, ArrowRightLeft, Image, MessageSquare, Minus } from 'lucide-react';
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
import { useChatStore } from '../store/useChatStore';
import { IntercomChatModule } from '../components/chat/IntercomChatModule';
import { useChatSoundNotifier } from '../hooks/useChatSoundNotifier';
import { push } from '../lib/syncManager';
import { ActiveCallBanner } from '../components/chat/ActiveCallBanner';
import { supabase } from '../lib/supabase';
import { useRemoteShiftClose } from '../lib/useRemoteShiftClose';
import { push } from '../lib/syncManager';

export const VendedorDashboard = () => {
  const { isSetupComplete, pointId, shift, responsibleName, endShift, openedAt } = useSellerSessionStore();

  // Detectar cierre remoto del turno (cuando el Admin lo cierra desde el PC)
  useRemoteShiftClose();

  // Flag para distinguir cierre PROPIO del vendedor vs cierre REMOTO del Admin.
  // Se activa antes de que handleCloseShift actualice posShifts, para que el
  // efecto de monitoreo (useEffect #3) no muestre "cerrado por administración"
  // cuando en realidad el vendedor hizo su propio cierre.
  const isClosingNormally = useRef(false);
  const { cart, total, addToCart, decreaseFromCart, checkout, clearCart } = usePosStore();
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
  const products = getVendedorPosItems() || [];
  const posProducts = (products || []).filter((p) => p && p.showInPos !== false);
  // Para pedir surtido: incluye productos con showInPos:false (ej. "Cambio")
  // pero excluye los marcados showInTricicloPos:true (solo POS, no requieren carga)
  const restockProducts = getDeliveryItems() || [];

  // Modales propios (window.confirm/prompt bloqueados en Android PWA)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [deletingTemplate, setDeletingTemplate] = useState<{ id: string; name: string } | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // ── 0. Cargar estado remoto más reciente de Supabase al montar ─────────────
  useEffect(() => {
    useInventoryStore.getState().loadFromRemote().catch(() => {});
  }, []);

  // ── 1. Validar identidad del usuario: si la sesión en localStorage pertenece a otro usuario, salir ──
  useEffect(() => {
    if (!isSetupComplete || !user) return;
    const sessionUserId = String((useSellerSessionStore.getState() as any).userId || '').trim().toLowerCase();
    const sessionResp = String(responsibleName || '').trim().toLowerCase();
    const currentName = String((user as any)?.name || '').trim().toLowerCase();
    const currentId = String((user as any)?.id || (user as any)?.username || '').trim().toLowerCase();

    const isSameUser = (sessionUserId && sessionUserId === currentId) ||
                       (sessionResp && (sessionResp === currentName || sessionResp.includes(currentName) || currentName.includes(sessionResp)));

    if (!isSameUser && (user as any).role !== 'ADMIN' && (user as any).role !== 'SUPER_ADMIN') {
      console.log('[VendedorDashboard] Sesión previa pertenece a otro usuario. Limpiando...');
      endShift();
    }
  }, [user, isSetupComplete, responsibleName]);

  // ── 2. Auto-asegurar que el turno de vendedor esté registrado en posShifts y Supabase ──
  useEffect(() => {
    if (!isSetupComplete || !pointId) return;
    const currentShiftId = (useSellerSessionStore.getState() as any).shiftId;
    if (!currentShiftId) return;

    const currentShifts = useInventoryStore.getState().posShifts || [];
    const exists = currentShifts.some((s: any) => s.id === currentShiftId);

    const activeBranchId = (user as any)?.branchId || 'BRANCH-001';
    const cleanResp = String(responsibleName || (user as any)?.name || 'Vendedor').trim();
    const activeShiftRecord = {
      id: currentShiftId,
      openedAt: openedAt || new Date().toISOString(),
      pointId,
      shift: shift || 'AM',
      responsibleName: cleanResp,
      userId: (user as any)?.id || (user as any)?.username,
      createdBy: (user as any)?.id,
      branchId: activeBranchId,
      type: 'VENDEDOR',
      closedAt: null,
    };

    if (!exists) {
      console.log('[VendedorDashboard] Asegurando turno activo en posShifts:', currentShiftId);
      addPosShift(activeShiftRecord);
    }

    const allShifts = useInventoryStore.getState().posShifts || [activeShiftRecord];
    push('posShifts', allShifts, activeBranchId).catch(() => {});
    push('posShifts', allShifts, null).catch(() => {});
  }, [isSetupComplete, pointId, shift, responsibleName, openedAt]);

  // ── 3. Monitoreo reactivo en tiempo real: si ESTE turno específico es cerrado por Admin, salir ──
  const livePosShifts = useInventoryStore((state: any) => state.posShifts) || [];
  useEffect(() => {
    if (isClosingNormally.current) return;
    if (!isSetupComplete || !pointId) return;

    const currentShiftId = (useSellerSessionStore.getState() as any).shiftId;
    if (!currentShiftId) return;

    const myShift = livePosShifts.find((s: any) => s.id === currentShiftId);
    if (myShift?.closedAt) {
      console.log('[VendedorDashboard] Turno cerrado remotamente por la administración:', currentShiftId);
      toast.error('⚠️ Tu turno ha sido cerrado por la administración.', { duration: 5000 });
      gpsStop();
      endShift();
    }
  }, [livePosShifts, isSetupComplete, pointId]);

  // ── GPS Tracking: compartir ubicación en tiempo real con admin/dejadores ──
  const trackingName = responsibleName || (user as any)?.name || 'Vendedor';
  const trackingId   = pointId || (user as any)?.id || 'unknown';
  const { status: gpsStatus, retry: gpsRetry, stop: gpsStop } = useVendorTracking(
    trackingId,
    trackingName,
    pointId || 'unknown',    // pointId (T1, T2…) para cruzar con posShifts en el mapa
    isSetupComplete          // Solo activo cuando el turno está abierto
  );

  const [activeTab, setActiveTab] = useState('pos');

  // 🔊 Sonido global de radio — funciona en TODAS las pestañas, no solo en Chat
  useChatSoundNotifier(pointId || trackingId);

  // --- Estados de Pedidos Móviles (Uber / Rappi-style) ---
  const [pendingDelivery, setPendingDelivery] = useState<any>(null);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const customerDeliveryRequests = useLogisticsStore(state => state.customerDeliveryRequests);

  // 1. Efecto Reactivo Principal vía Store + WebSocket
  useEffect(() => {
    const orders: any[] = customerDeliveryRequests || [];
    const cleanPoint = String(pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanUser  = String((user as any)?.id || (user as any)?.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTrack = String(trackingId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanResp  = String(responsibleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const myPending = orders.find((o: any) => {
      if (o.status !== 'pending') return false;
      const rejected = (o.rejected_vendor_ids || []).map((r: any) => String(r).toLowerCase().replace(/[^a-z0-9]/g, ''));
      return !rejected.includes(cleanPoint) && !rejected.includes(cleanUser) && !rejected.includes(cleanTrack) && (!cleanResp || !rejected.includes(cleanResp));
    });

    const myActive = orders.find((o: any) => {
      if (o.status !== 'accepted') return false;
      const assigned = String(o.assigned_vendor_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const assignedName = String(o.assigned_vendor_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const numMatchAssigned = assigned.match(/\d+/);
      const numMatchPoint = cleanPoint.match(/\d+/);
      const isSameVehicleNum = !!(numMatchAssigned && numMatchPoint && numMatchAssigned[0] === numMatchPoint[0]);

      return (
        (cleanPoint && assigned === cleanPoint) ||
        (cleanUser && assigned === cleanUser) ||
        (cleanTrack && assigned === cleanTrack) ||
        (cleanResp && assignedName.includes(cleanResp)) ||
        isSameVehicleNum
      );
    });

    if (myPending) {
      setPendingDelivery(myPending);
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/mixkit_bell.wav');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => {});
    } else {
      setPendingDelivery(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }

    if (myActive) {
      setActiveDelivery(myActive);
    } else {
      setActiveDelivery(null);
    }
  }, [customerDeliveryRequests, pointId, trackingId, user, responsibleName]);

  // 2. Respaldo de Polling Directo cada 2.5s a Supabase app_state
  useEffect(() => {
    const syncCustomerOrders = async () => {
      try {
        const { data } = await supabase
          .from('app_state')
          .select('value')
          .eq('key', 'customer_delivery_requests')
          .maybeSingle();

        if (data?.value && Array.isArray(data.value)) {
          useLogisticsStore.setState({ customerDeliveryRequests: data.value });
        }
      } catch (e) {}
    };

    syncCustomerOrders();
    const interval = setInterval(syncCustomerOrders, 2500);

    const channel = supabase.channel(`vendor-delivery-direct-sync`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_state',
        filter: 'key=eq.customer_delivery_requests'
      }, () => {
        syncCustomerOrders();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAcceptDelivery = async (orderId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', 'customer_delivery_requests')
        .maybeSingle();

      const orders: any[] = data?.value || [];
      const idx = orders.findIndex((o: any) => o.id === orderId);
      if (idx !== -1) {
        orders[idx] = {
          ...orders[idx],
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_vendor_name: responsibleName || pointId || 'Vendedor'
        };
        await push('customer_delivery_requests', orders);
        setActiveDelivery(orders[idx]);
        setPendingDelivery(null);
        toast.success('¡Pedido aceptado! 🛵 Dirígete al cliente.');
      }
    } catch (e) {
      toast.error('Error al aceptar el pedido.');
    }

    Promise.resolve(supabase.from('delivery_requests')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', orderId)).catch(() => {});
  };

  const handleRejectDelivery = async (orderId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', 'customer_delivery_requests')
        .maybeSingle();

      const orders: any[] = data?.value || [];
      const idx = orders.findIndex((o: any) => o.id === orderId);
      if (idx === -1) return;

      const order = orders[idx];
      const rejectedList = Array.from(new Set([...(order.rejected_vendor_ids || []), trackingId, pointId].filter(Boolean)));

      // Buscar otros vendedores con turno ABIERTO de HOY
      const currentShifts = useInventoryStore.getState().posShifts || [];
      const activeVendorShifts = currentShifts.filter((s: any) => !s.closedAt && String(s.type || '').toUpperCase() === 'VENDEDOR');

      const locations = useInventoryStore.getState().vendorLocations || {};

      const candidates = activeVendorShifts
        .filter((s: any) => {
          const vPoint = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const vUser  = String(s.userId || s.createdBy || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return !rejectedList.some((r: string) => {
            const cleanR = String(r).toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanR === vPoint || cleanR === vUser;
          });
        })
        .map((s: any) => {
          const pId = s.pointId || s.vehicle;
          const loc = locations[pId] || Object.values(locations).find((l: any) => l.pointId === pId);
          const lat = loc?.lat || 1.8485;
          const lng = loc?.lng || -76.0522;
          const distance = getHaversineDistance(order.client_lat, order.client_lng, lat, lng);
          return { shift: s, pId, name: s.responsibleName || pId, distance };
        })
        .sort((a, b) => a.distance - b.distance);

      if (candidates.length > 0) {
        // Reasignar al siguiente carrito más cercano
        const nextVendor = candidates[0];
        orders[idx] = {
          ...order,
          assigned_vendor_id: nextVendor.pId,
          assigned_vendor_name: nextVendor.name,
          rejected_vendor_ids: rejectedList,
          status: 'pending'
        };
        toast.info(`Pedido reasignado al siguiente carrito más cercano (${nextVendor.pId}) 🛵`);
      } else {
        // No hay más carritos disponibles
        orders[idx] = {
          ...order,
          rejected_vendor_ids: rejectedList,
          status: 'rejected'
        };
        toast.info('No hay más carritos disponibles para este pedido.');
      }

      await push('customer_delivery_requests', orders);

      setPendingDelivery(null);
    } catch (err: any) {
      console.error('Error rejecting delivery:', err);
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    try {
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', 'customer_delivery_requests')
        .maybeSingle();

      const orders: any[] = data?.value || [];
      const idx = orders.findIndex((o: any) => o.id === orderId);
      if (idx !== -1) {
        orders[idx] = {
          ...orders[idx],
          status: 'completed',
          completed_at: new Date().toISOString()
        };
        await push('customer_delivery_requests', orders);
      }
    } catch (e) {}

    Promise.resolve(supabase.from('delivery_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', orderId)).catch(() => {});

    setActiveDelivery(null);
    toast.success('¡Pedido entregado con éxito! 🎉 Stock descontado.');
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
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const editCameraFileRef = useRef<HTMLInputElement>(null);
  const editGalleryFileRef = useRef<HTMLInputElement>(null);

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
    isClosingNormally.current = true;
    setIsClosing(true);

    try {
      const cashVal = parseInt(cash) || 0;
      const transferVal = shiftTransferTotal || 0;
      const expensesVal = parseInt(expenses) || 0;
      const realTotal = cashVal + transferVal + expensesVal;

      let soldItems = {};
      let theorySalesVal = 0;
      try {
        const calc = getLogisticsCalc();
        soldItems = calc?.soldItems || {};
        theorySalesVal = calc?.theoretical || 0;
      } catch (eCalc) {
        console.warn('[VendedorClose] Error in getLogisticsCalc:', eCalc);
      }

      const difference = theorySalesVal - realTotal;
      const status = difference === 0 ? 'CUADRADO' : difference > 0 ? 'FALTANTE' : 'SOBRANTE';

      // Calculate goals and bonuses
      const totalSales = cashVal + transferVal;
      const activeBranchId = (user as any)?.branchId || 'BRANCH-001';
      const dayOfWeek = new Date().getDay();

      const activeGoal = (salesGoals || []).find((g: any) => 
        g.branchId === activeBranchId && 
        g.targetType === 'VEHICLE' && 
        g.targetId === pointId && 
        g.shift === shift &&
        (g.daysOfWeek || []).includes(dayOfWeek)
      );

      const goalMet = activeGoal && totalSales >= activeGoal.minAmount;
      const excess = goalMet ? (totalSales - activeGoal.minAmount) : 0;
      const totalBonus = goalMet ? (excess * (activeGoal.bonusPercent / 100)) : 0;

      const bonusRecipients: any[] = [];
      if (goalMet) {
        const currentEmp = (payrollEmployees || []).find((e: any) => e.name === responsibleName);
        bonusRecipients.push({
          employeeId: currentEmp?.id || 'TEMP-' + Date.now(),
          name: responsibleName || 'Vendedor',
          documentId: currentEmp?.documentId || '',
          bonusAmount: Math.round(totalBonus)
        });
      }

      const shiftData = useSellerSessionStore.getState() as any;
      const currentShiftId = shiftData?.shiftId || '';
      const closeTime = new Date().toISOString();

      const finalShift = {
          id: currentShiftId || `SHIFT-VEND-${pointId || 'AUTO'}-${Date.now()}`,
          openedAt: shiftData.openedAt || closeTime,
          closedAt: closeTime,
          userId: (user as any)?.id,
          userName: responsibleName,
          pointId: pointId,
          shift: shiftData.shift || shift || 'AM',
          pointType: shiftData.pointType,
          theorySales: theorySalesVal,
          realAmount: realTotal,
          cashAmount: cashVal,
          transferAmount: transferVal,
          expenses: expensesVal,
          expensesDesc: expensesDesc,
          shiftTransfers: shiftTransfers || [],
          status: status,
          difference: difference,
          type: 'VENDEDOR',
          soldItems,
          details: [],
          earnedBonus: Math.round(totalBonus),
          bonusGoalAmount: activeGoal?.minAmount || 0,
          bonusPercent: activeGoal?.bonusPercent || 0,
          bonusRecipients
      };

      const matchesPointId = (idA: any, idB: any) => {
        if (!idA || !idB) return false;
        const cleanA = String(idA).toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanB = String(idB).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanA === cleanB) return true;
        if (cleanA.length >= 2 && cleanB.length >= 2 && (cleanA.includes(cleanB) || cleanB.includes(cleanA))) return true;
        return false;
      };

      // 1. Actualizar localmente posShifts
      const currentShifts = useInventoryStore.getState().posShifts || [];
      let shiftFound = false;

      const updatedShifts = currentShifts.map((s: any) => {
        if (s.type !== 'VENDEDOR' || s.closedAt) return s;

        const isMatchByShiftId = currentShiftId && s.id === currentShiftId;
        const isMatchByPoint = matchesPointId(s.pointId, pointId);
        const isMatchByName = s.responsibleName && responsibleName &&
          String(s.responsibleName).trim().toLowerCase() === String(responsibleName).trim().toLowerCase();

        if (isMatchByShiftId || isMatchByPoint || isMatchByName) {
          shiftFound = true;
          return {
            ...s,
            ...finalShift,
            id: s.id,
            closedAt: closeTime,
          };
        }
        return s;
      });

      if (!shiftFound) {
        updatedShifts.push(finalShift);
      }

      useInventoryStore.setState({ posShifts: updatedShifts });
      useInventoryStore.getState().clearVendorLocation(pointId);

      // 2. Detener GPS
      try { gpsStop().catch(() => {}); } catch (_) {}

      // 3. Escribir directamente a Supabase para garantizar cierre remoto
      try {
        const keysToUpdate = [
          'posShifts',
          `posShifts_${activeBranchId}`,
          'posShifts_BRANCH-001',
          'posShifts_master_history'
        ];

        const { data: remoteData } = await supabase
          .from('app_state')
          .select('key, value')
          .in('key', keysToUpdate);

        const upsertPromises = (remoteData || []).map(row => {
          const list = Array.isArray(row.value) ? row.value : [];
          let modified = false;
          const closedList = list.map((s: any) => {
            if (s.type !== 'VENDEDOR' || s.closedAt) return s;
            const isMatchByShiftId = currentShiftId && s.id === currentShiftId;
            const isMatchByPoint = matchesPointId(s.pointId, pointId);
            const isMatchByName = s.responsibleName && responsibleName &&
              String(s.responsibleName).trim().toLowerCase() === String(responsibleName).trim().toLowerCase();

            if (isMatchByShiftId || isMatchByPoint || isMatchByName) {
              modified = true;
              return { ...s, ...finalShift, id: s.id, closedAt: closeTime };
            }
            return s;
          });

          if (!modified) {
            closedList.push(finalShift);
          }

          return supabase.from('app_state').upsert({
            key: row.key,
            value: closedList,
            updated_at: closeTime
          }, { onConflict: 'key' });
        });

        await Promise.allSettled([
          ...upsertPromises,
          push('posShifts', updatedShifts, activeBranchId),
          push('posShifts', updatedShifts, null),
          supabase
            .from('vendor_locations')
            .update({ is_active: false })
            .or(`point_id.ilike.%${pointId}%,assigned_vendor_id.ilike.%${pointId}%`)
        ]);
      } catch (eSync) {
        console.warn('[VendedorClose Remote Sync]:', eSync);
      }

      toast.success('Jornada cerrada');
      endShift();
      signOut();
    } catch (err: any) {
      console.warn('[VendedorClose Error]:', err?.message);
      endShift();
      signOut();
    }
  };

  const cleanPoint = String(pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanUser  = String((user as any)?.id || (user as any)?.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanTrack = String(trackingId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanResp  = String(responsibleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const pendingOrdersCount = (customerDeliveryRequests || []).filter((o: any) => {
    if (o?.status !== 'pending') return false;
    const rejected = (o?.rejected_vendor_ids || []).map((r: any) => String(r).toLowerCase().replace(/[^a-z0-9]/g, ''));
    return !rejected.includes(cleanPoint) && !rejected.includes(cleanUser) && !rejected.includes(cleanTrack) && (!cleanResp || !rejected.includes(cleanResp));
  }).length;

  const activeOrdersCount = Math.max(pendingOrdersCount, pendingDelivery ? 1 : 0) + (activeDelivery ? 1 : 0);
  const chatMessages = useChatStore(state => state.messages);
  const getUnreadCount = useChatStore(state => state.getUnreadCount);
  const chatUnreadCount = getUnreadCount(pointId || trackingId);

  const tabs = [
    { id: 'pos', label: 'Venta', icon: <Calculator size={24} /> },
    { id: 'deliveries', label: 'Pedidos', icon: <Clock size={24} />, badge: activeOrdersCount },
    { id: 'restock', label: 'Pedir', icon: <Package size={24} /> },
    { id: 'transfers', label: 'Transf.', icon: <ArrowRightLeft size={24} /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={24} />, badge: chatUnreadCount },
    { id: 'close', label: 'Cierre', icon: <DollarSign size={24} /> }
  ];

  const getHeaderTitle = () => {
    if (activeTab === 'pos') return 'Venta Rápida';
    if (activeTab === 'deliveries') return 'Pedidos Clientes';
    if (activeTab === 'restock') return 'Pedir Surtido';
    if (activeTab === 'transfers') return 'Transferencias';
    if (activeTab === 'chat') return 'Radio / Intercom Chat';
    if (activeTab === 'close') return 'Cierre Caja';
    return 'Dashboard';
  };

  const currentDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

  // ── Guardia: Si la sesión no está iniciada, intentar auto-restaurar si hay turno abierto ──────
  if (!isSetupComplete) {
    const shifts = useInventoryStore.getState().posShifts || [];
    const today = new Date().toISOString().slice(0, 10);
    const activeOpenShift = shifts.find((s: any) => !s.closedAt && String(s.type || '').toUpperCase() === 'VENDEDOR' && (s.openedAt || s.fecha || '').startsWith(today));
    if (activeOpenShift) {
      console.log('[VendedorDashboard] Auto-restaurando turno activo encontrado:', activeOpenShift);
      useSellerSessionStore.getState().startShift({
        id: activeOpenShift.id,
        pointId: activeOpenShift.pointId || activeOpenShift.vehicle,
        shift: activeOpenShift.shift || 'AM',
        pointType: activeOpenShift.pointType || 'variable',
        responsibleName: activeOpenShift.responsibleName || (user as any)?.name,
        userId: activeOpenShift.userId || (user as any)?.id || (user as any)?.username,
        openedAt: activeOpenShift.openedAt,
        branchId: activeOpenShift.branchId || (user as any)?.branchId || 'BRANCH-001'
      });
    } else {
      return <Navigate to="/vendedor-setup" replace />;
    }
  }

  return (
    <div
      className={`font-sans w-full bg-[#FFD56B] flex flex-col ${
        activeTab === 'chat' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
      }`}
      style={{
        paddingBottom: activeTab === 'chat' ? '0px' : activeTab === 'pos' ? '240px' : '160px'
      }}
    >
      {/* 📞 Banner Flotante Global de Llamada Activa (Funciona en todas las pestañas) */}
      <ActiveCallBanner currentUserId={pointId || trackingId} />
      
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

      {/* HEADER ULTRA COMPACTO */}
      <div className="w-full bg-white shadow-sm relative z-10 rounded-b-2xl overflow-hidden">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight leading-tight shrink-0">
              {getHeaderTitle()}
            </h1>
            {(shift || pointId || responsibleName) && (
              <div className="flex flex-wrap items-center gap-1">
                {pointId && <span className="bg-amber-400 text-white font-black text-[9px] px-2 py-0.5 rounded-full tracking-wider">{pointId}</span>}
                {shift && <span className="bg-[#FF4040] text-white font-black text-[9px] px-2 py-0.5 rounded-full tracking-wider">{shift}</span>}
                {responsibleName && <span className="bg-gray-900 text-white font-bold text-[9px] px-2 py-0.5 rounded-full">👤 {responsibleName.split(' ')[0]}</span>}
                {/* Indicador GPS */}
                {gpsStatus === 'active' && (
                  <span className="flex items-center gap-1 bg-green-100 text-green-700 font-bold text-[9px] px-2 py-0.5 rounded-full">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    GPS
                  </span>
                )}
                {gpsStatus === 'requesting' && (
                  <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 font-bold text-[9px] px-2 py-0.5 rounded-full">
                    📍 Solicitando...
                  </span>
                )}
                {gpsStatus === 'denied' && (
                  <button onClick={gpsRetry} className="flex items-center gap-1 bg-red-100 text-red-600 font-bold text-[9px] px-2 py-0.5 rounded-full active:scale-95">
                    ⚠️ GPS
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Botón salir alineado dentro del flujo flex */}
          <button
             onClick={() => signOut()}
             title="Salir (el turno sigue activo)"
             className="w-8 h-8 bg-red-50/80 border border-red-100 rounded-full flex items-center justify-center text-[#FF4040] hover:bg-red-100 transition-all active:scale-95 shrink-0 ml-1"
          >
            <LogOut size={14} strokeWidth={2.5} className="ml-0.5" />
          </button>
        </div>
      </div>

      <div className={`w-full max-w-7xl mx-auto px-2 sm:px-6 ${
        activeTab === 'chat' ? 'flex-1 min-h-0 flex flex-col overflow-hidden my-2 sm:my-3' : 'mt-8'
      }`}>
        
        {/* BANNER DE PEDIDO PENDIENTE (ALERTA URGENTE EN TODAS LAS PESTAÑAS) */}
        {pendingDelivery && (
          <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-[32px] p-5 text-gray-950 shadow-2xl shadow-amber-200/80 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-4 border-white animate-bounce">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/30 rounded-2xl flex items-center justify-center text-2xl shrink-0 mt-0.5 animate-pulse">
                🔔
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider w-max">
                  ¡Nuevo Pedido Pendiente!
                </span>
                <h3 className="font-black text-lg text-gray-950 leading-tight">
                  {pendingDelivery.client_name} ({formatMoney(pendingDelivery.total_amount)})
                </h3>
                <p className="text-xs font-bold text-amber-950/80 leading-snug">
                  📍 {pendingDelivery.client_address || 'Cliente en mapa'} · 📞 {pendingDelivery.client_phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRejectDelivery(pendingDelivery.id)}
                className="bg-white/80 hover:bg-white text-red-600 font-black py-3 px-4 rounded-2xl shadow-sm text-xs transition-all active:scale-95 flex items-center gap-1"
              >
                <X size={16} strokeWidth={3} /> Rechazar
              </button>
              <button
                onClick={() => handleAcceptDelivery(pendingDelivery.id)}
                className="bg-green-600 hover:bg-green-700 text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check size={18} strokeWidth={3} /> ACEPTAR PEDIDO
              </button>
            </div>
          </div>
        )}

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
          <div>
            {posProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-amber-200/60 my-4">
                <ShoppingCart size={36} className="mx-auto text-amber-400 mb-2" />
                <h3 className="font-black text-gray-800 text-base mb-1">Cargando productos de venta...</h3>
                <p className="text-xs text-gray-500 font-bold mb-3">Obteniendo productos autorizados para triciclos</p>
                <button
                  onClick={() => useInventoryStore.getState().loadFromRemote()}
                  className="bg-amber-400 hover:bg-amber-500 text-white font-black text-xs px-4 py-2 rounded-full shadow-sm active:scale-95 transition-all"
                >
                  ⚡ Actualizar Venta Rápida
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                {posProducts.map(p => {
                  const nameClean = (p?.name || '').trim().toLowerCase();
                  const isVar = p && (
                    p.variablePrice === true ||
                    String(p.variablePrice) === 'true' ||
                    p.variablePrice === 1 ||
                    String(p.variablePrice) === '1' ||
                    p.isVariable === true ||
                    !p.price ||
                    Number(p.price) <= 0 ||
                    nameClean.includes('bofe') ||
                    nameClean.includes('rellena') ||
                    nameClean.includes('chicharrón') ||
                    nameClean.includes('chicharron') ||
                    nameClean.includes('hueso') ||
                    nameClean.includes('azadura') ||
                    nameClean.includes('café') ||
                    nameClean.includes('cafe') ||
                    nameClean.includes('bebida no guardada') ||
                    nameClean.includes('domicilio') ||
                    nameClean.includes('producto no registrado')
                  );
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (isVar) {
                           setVariablePriceProduct(p);
                           const initialVal = (p.referencePrice && p.referencePrice > 0) 
                             ? String(p.referencePrice) 
                             : (p.price && p.price > 0 ? String(p.price) : '');
                           setVariablePriceInput(initialVal);
                        } else {
                           addToCart(p, 1);
                        }
                      }}
                      className="bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-[#FF4040] transition-all duration-200 active:scale-95 flex flex-col items-center justify-center text-center p-3 sm:p-5 min-h-[90px] sm:min-h-[125px] hover:-translate-y-0.5 hover:shadow-md group gap-1"
                    >
                      <span className="font-black text-gray-900 text-xs sm:text-base tracking-tight group-hover:text-[#FF4040] transition-colors leading-tight uppercase line-clamp-2">
                        {p.name}
                      </span>
                      <span className="text-[#FF4040] font-black text-xs sm:text-sm leading-tight">
                        {formatMoney((p.price && p.price > 0) ? p.price : (p.referencePrice || 0))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
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



            {restockProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-amber-200/60 my-4">
                <Package size={36} className="mx-auto text-amber-400 mb-2" />
                <h3 className="font-black text-gray-800 text-base mb-1">Cargando catálogo de productos...</h3>
                <p className="text-xs text-gray-500 font-bold mb-3">Sincronizando productos disponibles desde la nube</p>
                <button
                  onClick={() => useInventoryStore.getState().loadFromRemote()}
                  className="bg-amber-400 hover:bg-amber-500 text-white font-black text-xs px-4 py-2 rounded-full shadow-sm active:scale-95 transition-all"
                >
                  ⚡ Cargar Productos
                </button>
              </div>
            ) : (
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
            )}
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

              {/* Inputs de foto: Cámara Directa y Galería */}
              <input
                ref={cameraFileRef}
                type="file"
                accept="image/*"
                capture="environment"
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
              <input
                ref={galleryFileRef}
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

              {!transferPhoto ? (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => cameraFileRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 px-3 bg-[#FFB700] hover:bg-yellow-400 text-gray-900 rounded-2xl font-black text-xs shadow-sm active:scale-95 transition-all"
                  >
                    <Camera size={18} /> Tomar Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryFileRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-bold text-xs active:scale-95 transition-all"
                  >
                    <Image size={18} /> Subir Galería
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-2xl p-3 mb-4">
                  <span className="font-black text-xs text-green-700 flex items-center gap-1.5">
                    <CheckCircle size={16} /> Foto Comprobante Lista ✔
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cameraFileRef.current?.click()}
                      className="text-[11px] font-bold text-green-800 bg-green-200/60 hover:bg-green-300 px-2.5 py-1 rounded-xl transition-colors"
                    >
                      📷 Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferPhoto(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-red-200 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

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
                          ref={editCameraFileRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressedBase64 = await compressImage(file, 800, 0.7);
                              setEditPhoto(compressedBase64);
                            } catch (err) {
                              console.error('Error comprimiendo foto editada:', err);
                            }
                            e.target.value = '';
                          }}
                        />
                        <input
                          ref={editGalleryFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressedBase64 = await compressImage(file, 800, 0.7);
                              setEditPhoto(compressedBase64);
                            } catch (err) {
                              console.error('Error comprimiendo foto editada:', err);
                            }
                            e.target.value = '';
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => editCameraFileRef.current?.click()}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FFB700] text-gray-900 rounded-xl font-bold text-xs active:scale-95 transition-all"
                          >
                            <Camera size={14} /> Tomar
                          </button>
                          <button
                            type="button"
                            onClick={() => editGalleryFileRef.current?.click()}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                          >
                            <Image size={14} /> Galería
                          </button>
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
                          {/* Compartir WhatsApp (con foto adjunta si existe) */}
                          <button
                            onClick={async () => {
                              const textMsg = `*📲 Transferencia Bancaria (${pointId || 'Punto'})*\n` +
                                              `💰 *Monto:* ${formatMoney(t.amount)}\n` +
                                              (t.note ? `📝 *Nota:* ${t.note}\n` : '') +
                                              `🕐 *Hora:* ${time}\n` +
                                              `👤 *Vendedor:* ${t.vendorName || responsibleName || 'Vendedor'}`;

                              const photoSrc = t.photoBase64 || (t as any).photoUrl;

                              if (photoSrc && typeof navigator !== 'undefined' && (navigator as any).canShare) {
                                try {
                                  const res = await fetch(photoSrc);
                                  const blob = await res.blob();
                                  const ext = blob.type.includes('png') ? 'png' : 'jpg';
                                  const file = new File([blob], `comprobante_${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });

                                  if ((navigator as any).canShare({ files: [file] })) {
                                    await (navigator as any).share({
                                      title: 'Comprobante Transferencia',
                                      text: textMsg,
                                      files: [file],
                                    });
                                    return;
                                  }
                                } catch (err) {
                                  console.warn('Error al compartir foto, intentando fallback de texto:', err);
                                }
                              }

                              if (typeof navigator !== 'undefined' && navigator.share) {
                                try {
                                  await navigator.share({ title: 'Comprobante Transferencia', text: textMsg });
                                  return;
                                } catch (err) {}
                              }

                              window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, '_blank');
                            }}
                            className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center active:scale-90"
                            title="Compartir por WhatsApp con foto"
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

        {/* SUBVISTA: CHAT / RADIO INTERCOM */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto flex-1 min-h-0 flex flex-col w-full overflow-hidden pb-20 sm:pb-24">
            <IntercomChatModule
              currentUserId={pointId || trackingId}
              currentUserName={`${pointId ? pointId + ' (' : ''}${responsibleName || trackingName}${pointId ? ')' : ''}`}
              currentUserRole="VENDEDOR"
              targetUserId="DEJADOR"
              targetUserName="Dejador / Logística"
              branchId={(user as any)?.branchId || 'BRANCH-001'}
              shiftId={openedAt || 'shift-active'}
              pointId={pointId}
            />
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

            <button 
              onClick={handleCloseShift}
              disabled={isClosing}
              className="w-full flex items-center justify-center gap-3 bg-[#FF4040] disabled:bg-gray-400 text-white font-black text-lg sm:text-2xl py-5 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(255,64,64,0.5)] hover:scale-[1.02] transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <Check size={26} strokeWidth={3} />
              {isClosing ? 'CERRANDO JORNADA...' : 'CERRAR JORNADA'}
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
          <div className="bg-white rounded-[32px] p-7 shadow-2xl w-full max-w-sm animate-modal-in text-center">
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
                <button 
                  onClick={() => { setVariablePriceProduct(null); setVariablePriceInput(''); }} 
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-lg hover:bg-gray-200 transition-colors active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const price = parseInt(variablePriceInput);
                    if (isNaN(price) || price <= 0) {
                         toast.error('Ingresa un precio válido');
                         return;
                    }
                    addToCart(variablePriceProduct, 1, price);
                    setVariablePriceProduct(null);
                    setVariablePriceInput('');
                  }} 
                  className="flex-1 py-3 rounded-2xl bg-[#FF4040] text-white font-black text-lg shadow-lg hover:bg-red-500 transition-colors active:scale-95"
                >
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
                {cart.map((c: any) => {
                  const itemId = c.cartItemId || c.productId;
                  return (
                    <div key={itemId} className="flex justify-between items-center bg-gray-50 px-3 py-1.5 rounded-2xl">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Botón para restar 1 o eliminar si solo queda 1 con la misma altura de la cápsula */}
                        <button
                          type="button"
                          onClick={() => decreaseFromCart(itemId)}
                          style={{ minHeight: '22px', height: '22px', width: '22px', maxHeight: '22px', maxWidth: '22px', padding: 0 }}
                          className="btn-compact !min-h-[22px] !h-[22px] !w-[22px] !max-h-[22px] !max-w-[22px] rounded-full bg-red-100 hover:bg-red-200 text-[#FF4040] flex items-center justify-center font-black transition-all active:scale-90 shrink-0 self-center leading-none shadow-none"
                          title={c.qty > 1 ? "Restar 1" : "Eliminar"}
                        >
                          {c.qty > 1 ? (
                            <Minus size={12} strokeWidth={3.5} />
                          ) : (
                            <X size={12} strokeWidth={3.5} />
                          )}
                        </button>
                        <span className="inline-flex items-center justify-center bg-[#FF4040] text-white text-xs font-black px-2 py-0.5 rounded-full shrink-0 leading-tight self-center">
                          {c.qty}x
                        </span>
                        <span className="text-gray-900 font-black text-sm truncate self-center">{c.name}</span>
                      </div>
                      <span className="text-[#FF4040] font-black text-sm shrink-0 self-center">{formatMoney(c.price * c.qty)}</span>
                    </div>
                  );
                })}
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
