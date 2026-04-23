import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, Zap, ChevronDown, ChevronUp, CheckCircle2, Pencil, Save, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useDejadorSessionStore } from '../store/useDejadorSessionStore';
import { NumberSelectorGroup } from '../components/ui/NumberSelectorGroup';
import { getProductAbbreviation } from '../utils/formatUtils';
import { MapTrackingView } from './MapTrackingView';
import { VehicleShiftCard } from '../components/admin/AdminVehicleInventoryTab';

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


// ─── Hook: Audio — bip único y loop continuo ─────────────────────────────────
function useDeliveryAlert() {
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const loopRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopActiveRef = useRef(false);
  const stoppedRef    = useRef(false);

  // Obtener (o crear) el AudioContext — nunca lo cerramos para evitar el estado "suspended"
  const getCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(1, ctx.currentTime);
      mg.connect(ctx.destination);
      masterGainRef.current = mg;
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return { ctx: audioCtxRef.current, mg: masterGainRef.current! };
  };

  const singleBeep = (
    ctx: AudioContext, mg: GainNode,
    startTime: number, freq: number, duration: number
  ) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(mg);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + duration * 0.8);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.9, startTime + 0.01);
    gain.gain.setValueAtTime(0.9, startTime + duration - 0.04);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const playTripleBeep = () => {
    if (stoppedRef.current) return;
    try {
      const { ctx, mg } = getCtx();
      // Restaurar gain maestro antes de reproducir (pudo haber sido silenciado)
      mg.gain.cancelScheduledValues(ctx.currentTime);
      mg.gain.setValueAtTime(1, ctx.currentTime);
      const t = ctx.currentTime;
      singleBeep(ctx, mg, t + 0.00, 1000, 0.12);
      singleBeep(ctx, mg, t + 0.18, 1000, 0.12);
      singleBeep(ctx, mg, t + 0.36, 1200, 0.18);
    } catch (_) {}
  };

  const playOnce = () => {
    stoppedRef.current = false;
    playTripleBeep();
  };

  const startLoop = () => {
    if (loopActiveRef.current) return;
    stoppedRef.current = false;
    loopActiveRef.current = true;
    playTripleBeep();
    loopRef.current = setInterval(playTripleBeep, 1200);
  };

  const stopAll = () => {
    stoppedRef.current = true;
    loopActiveRef.current = false;

    // Cancelar loop si existe
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }

    // Silenciar via gain maestro — SIN cerrar el contexto
    // (cerrarlo causa que el siguiente bip quede bloqueado por autoplay policy)
    if (masterGainRef.current && audioCtxRef.current?.state !== 'closed') {
      try {
        const t = audioCtxRef.current!.currentTime;
        masterGainRef.current.gain.cancelScheduledValues(t);
        masterGainRef.current.gain.setValueAtTime(0, t);
      } catch (_) {}
    }
  };

  // Solo cerramos el contexto al desmontar el componente
  useEffect(() => () => {
    if (loopRef.current) clearInterval(loopRef.current);
    try { audioCtxRef.current?.close(); } catch (_) {}
  }, []);

  return { playOnce, startLoop, stopAll, isLooping: loopActiveRef };
}


export const DejadorDashboard = () => {
  const navigate = useNavigate();
  const timeAgo = useRelativeTime();
  const { pendingRequests, completedRequests, rejectedRequests, loadHistory, fetchPendingRequests, commitRestock, commitPartialRestock, commitLoad, commitReception, updatePendingRequest, rejectRequest, postponeRequest, markRequestRead } = useLogisticsStore();
  const { loadTemplates, addLoadTemplate, deleteLoadTemplate, posSettings, getDeliveryItems, posShifts, addPosShift } = useInventoryStore();
  const allDeliveryProducts = getDeliveryItems();
  const { user, signOut, updateUserPresets } = useAuthStore();
  const { isSetupComplete, shift, anotadorName, dejadorName, endShift } = useDejadorSessionStore();
  const { playOnce, startLoop, stopAll, isLooping } = useDeliveryAlert();

  // ─── Alarm state ───
  const [isAlertPlaying, setIsAlertPlaying] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevPendingCountRef = useRef(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bandera: el loop de inactividad solo se dispara UNA VEZ por sesión de pedido
  const loopAlreadyFiredRef = useRef(false);
  const INACTIVITY_MS = 2 * 60 * 1000; // 2 minutos

  const getAllActivePoints = useVehicleStore((state) => state.getAllActivePoints);
  const vehicles = getAllActivePoints ? getAllActivePoints() : useVehicleStore.getState().vehicles.filter((v: any) => v.active).map((v: any) => v.abbreviation || v.name);
  const defaultVehicle = vehicles.length > 0 ? vehicles[0] : 'T1';

  // Mapa: tricicloId → nombre del vendedor con turno abierto
  const vehicleVendorMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    (posShifts || []).forEach((s: any) => {
      if (s.type === 'VENDEDOR' && s.pointId && !s.closedAt) {
        const firstName = (s.responsibleName || s.userName || '').split(' ')[0];
        if (firstName) map[s.pointId] = firstName;
      }
    });
    return map;
  }, [posShifts]);

  // Filtro defensivo: excluir pedidos ya completados o rechazados
  const processedIds = new Set([
    ...(completedRequests || []).map((r: any) => r.id),
    ...(rejectedRequests  || []).map((r: any) => r.id),
  ]);
  const truePendingRequests = (pendingRequests || []).filter((r: any) => !processedIds.has(r.id));

  // Conteo de pedidos genuinos del vendedor (sin los reencolados por el dejador)
  const genuinePendingCount = truePendingRequests.filter((r: any) => !r.isPostponed).length;

  // Ref siempre actualizada — usada dentro de callbacks/timers para evitar closures obsoletas
  const genuinePendingCountRef = useRef(genuinePendingCount);
  genuinePendingCountRef.current = genuinePendingCount;

  const clearInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  const scheduleInactivityAlert = () => {
    // Si la alerta de inactividad ya se disparó una vez, no volver a programarla
    if (loopAlreadyFiredRef.current) return;
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      if (genuinePendingCountRef.current > 0) {
        loopAlreadyFiredRef.current = true; // Marcar: ya se usó, no repetir jamás
        startLoop();                         // Loop continuo hasta que el usuario lo pare
        setIsAlertPlaying(true);             // Activa tap-para-silenciar
      }
    }, INACTIVITY_MS);
  };

  // NO hay listener de actividad del usuario — el timer de inactividad no se resetea

  // Guard: if no session, redirect to setup
  useEffect(() => {
    if (!isSetupComplete) navigate('/dejador-setup', { replace: true });
  }, [isSetupComplete]);

  // Detectar cambios en pedidos genuinos
  useEffect(() => {
    if (genuinePendingCount > prevPendingCountRef.current) {
      // Llegó un pedido NUEVO → resetear bandera + bip + programar timer una sola vez
      loopAlreadyFiredRef.current = false; // Nuevo pedido = nueva oportunidad de loop
      // Siempre tocar el bip al llegar un pedido nuevo
      const added = genuinePendingCount - prevPendingCountRef.current;
      setNewOrderCount(prev => prev + added);
      playOnce();
      setIsAlertPlaying(true);
      scheduleInactivityAlert();
    }
    if (genuinePendingCount === 0) {
      // No quedan pedidos → apagar todo
      stopAll();
      clearInactivityTimer();
      loopAlreadyFiredRef.current = false;
      setIsAlertPlaying(false);
      setNewOrderCount(0);
    }
    prevPendingCountRef.current = genuinePendingCount;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genuinePendingCount]);

  // Parar alarma — silencia sin re-programar el timer (ya se disparó)
  const handleStopAlert = () => {
    stopAll();
    clearInactivityTimer();
    setIsAlertPlaying(false);
    setNewOrderCount(0);
    // NO se reprograma — la alerta de inactividad solo ocurre una vez por pedido
  };



  const [activeTab, setActiveTab] = useState('carga'); // carga, surtir, recibir

  // Auto-marcar como leídos al entrar al tab de Pedidos
  useEffect(() => {
    if (activeTab === 'surtir') {
      const unread = truePendingRequests.filter((r: any) => !r.readAt && !r.isPostponed);
      if (unread.length > 0) {
        unread.forEach((r: any) => markRequestRead(r.id));
        stopAll();
        clearInactivityTimer();
        setIsAlertPlaying(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [selectedVehicle, setSelectedVehicle] = useState(defaultVehicle);
  const [loadQuantities, setLoadQuantities] = useState<Record<string, number>>({});
  // For products with string presets (e.g. MON/20k/50k), track selected string value separately
  const [stringSelections, setStringSelections] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  // Custom states for manual input toggles
  const [manualInputOpen, setManualInputOpen] = useState<string | null>(null);
  
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<any[]>([]);
  // IDs de pedidos que están siendo procesados (evita doble tap en "Surtir Ya")
  const [committingIds, setCommittingIds] = useState<Set<string>>(new Set());
  // Ítems pospuestos por pedido: { [requestId]: Set<itemIndex> }
  const [postponedItems, setPostponedItems] = useState<Record<string, Set<number>>>({});

  const togglePostponed = (reqId: string, itemIdx: number) => {
    setPostponedItems(prev => {
      const current = new Set(prev[reqId] || []);
      if (current.has(itemIdx)) current.delete(itemIdx);
      else current.add(itemIdx);
      return { ...prev, [reqId]: current };
    });
  };

  const getPostponedSet = (reqId: string): Set<number> => postponedItems[reqId] || new Set();

  const handleUpdateEditQty = (idx: number, delta: number) => {
    const newPayload = [...editPayload];
    newPayload[idx] = { ...newPayload[idx], qty: Math.max(0, newPayload[idx].qty + delta) };
    setEditPayload(newPayload);
  };
  
  const productPresets = (user as any)?.productPresets || {};
  const DEFAULT_PRESETS = [5, 10, 15, 20];

  // Orden y visibilidad por usuario
  const userProductOrder: string[] = (user as any)?.productPresets?.productOrder || [];
  const userHiddenProducts: string[] = (user as any)?.productPresets?.hiddenProducts || [];

  // Ordenar y filtrar productos según preferencias del usuario
  const products = React.useMemo(() => {
    const ordered = userProductOrder.length > 0
      ? [
          ...userProductOrder.map((id: string) => allDeliveryProducts.find((p: any) => p.id === id)).filter(Boolean),
          ...allDeliveryProducts.filter((p: any) => !userProductOrder.includes(p.id)),
        ]
      : allDeliveryProducts;
    return ordered.filter((p: any) => !userHiddenProducts.includes(p.id));
  }, [allDeliveryProducts, userProductOrder, userHiddenProducts]);

  // Modo organizar productos
  const [organizeMode, setOrganizeMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [draftHidden, setDraftHidden] = useState<string[]>([]);

  // GPS tab: triciclo seleccionado
  const [gpsSelectedVehicle, setGpsSelectedVehicle] = useState<string>('');
  useEffect(() => {
    if (!gpsSelectedVehicle && vehicles.length > 0) setGpsSelectedVehicle(vehicles[0]);
  }, [vehicles.length]);

  // Confirmar cierre de jornada
  const [showEndShiftConfirm, setShowEndShiftConfirm] = useState(false);

  // Confirmar borrar template
  const [deletingTemplate, setDeletingTemplate] = useState<{ id: string; name: string } | null>(null);

  // Modal guardar nuevo template
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const openOrganize = () => {
    // Inicializar draft con el orden actual de TODOS los productos (incluyendo ocultos)
    const currentOrder = userProductOrder.length > 0
      ? [
          ...userProductOrder.map((id: string) => allDeliveryProducts.find((p: any) => p.id === id)).filter(Boolean),
          ...allDeliveryProducts.filter((p: any) => !userProductOrder.includes(p.id)),
        ]
      : allDeliveryProducts;
    setDraftOrder(currentOrder.map((p: any) => p.id));
    setDraftHidden([...userHiddenProducts]);
    setOrganizeMode(true);
  };

  const saveOrganize = () => {
    const newPresets = { ...productPresets, productOrder: draftOrder, hiddenProducts: draftHidden };
    updateUserPresets((user as any).id, newPresets);
    setOrganizeMode(false);
    showToast('✔ Orden guardado');
  };

  const moveProduct = (idx: number, dir: -1 | 1) => {
    const next = [...draftOrder];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDraftOrder(next);
  };

  const toggleHidden = (id: string) => {
    setDraftHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getPresetsForProduct = (productId: string, action: 'surtir' | 'recibir' = 'surtir'): (number | string)[] => {
    const actionKey = `${action}__${productId}`;
    // 1. Override específico por acción (surtir__id / recibir__id)
    if (productPresets[actionKey] && productPresets[actionKey].length > 0) return productPresets[actionKey];
    // 2. Override genérico (retrocompatibilidad)
    if (productPresets[productId] && productPresets[productId].length > 0) return productPresets[productId];
    // 3. Presets del producto creado en Admin
    const item = getDeliveryItems().find((i: any) => i.id === productId);
    if (item?.inventoryPresets && item.inventoryPresets.length > 0) return item.inventoryPresets;
    return DEFAULT_PRESETS;
  };

  // Modal edición de presets — ahora con 2 secciones (Surtir / Recibir)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draftPresetsSurtir, setDraftPresetsSurtir] = useState<string[]>([]);
  const [draftPresetsRecibir, setDraftPresetsRecibir] = useState<string[]>([]);

  const openProductPresets = (productId: string) => {
    setDraftPresetsSurtir(getPresetsForProduct(productId, 'surtir').map(String));
    setDraftPresetsRecibir(getPresetsForProduct(productId, 'recibir').map(String));
    setEditingProductId(productId);
  };

  const saveProductPresets = () => {
    if (!editingProductId) return;
    const parsedSurtir = draftPresetsSurtir.map(v => parseInt(v, 10)).filter(n => !isNaN(n) && n > 0);
    const parsedRecibir = draftPresetsRecibir.map(v => parseInt(v, 10)).filter(n => !isNaN(n) && n > 0);
    if (parsedSurtir.length < 1 && parsedRecibir.length < 1) { showToast('⚠️ Ingresa al menos un valor'); return; }
    const newProductPresets = {
      ...productPresets,
      [`surtir__${editingProductId}`]: parsedSurtir.length > 0 ? parsedSurtir : undefined,
      [`recibir__${editingProductId}`]: parsedRecibir.length > 0 ? parsedRecibir : undefined,
    };
    updateUserPresets((user as any).id, newProductPresets);
    showToast('✔ Botones actualizados');
    setEditingProductId(null);
  };

  const dejadorTemplates = loadTemplates?.filter((t: any) =>
    t.role === 'DEJADOR' && (!t.userId || t.userId === (user as any)?.id)
  ) || [];

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

  const handleCommit = async (id: string, point: string, req: any) => {
    if (committingIds.has(id)) return; // Prevenir doble-tap

    // Determinar si el dejador editó el pedido antes de confirmar
    const wasEditing = editingReqId === id;
    // Obtener payload actual (editado o original)
    const payload = wasEditing ? editPayload : (req.items_payload || []);
    if (wasEditing) setEditingReqId(null);

    const postponedSet = getPostponedSet(id);
    const hasPostponed = postponedSet.size > 0;

    // Si hay pospuestos, separar ítems
    if (hasPostponed) {
      const available = payload.filter((_: any, idx: number) => !postponedSet.has(idx));
      const postponed = payload.filter((_: any, idx: number) => postponedSet.has(idx));

      // Si TODOS están pospuestos, proceder directo (UI ya muestra que todo está marcado)
      if (available.length === 0) {
        // Sin confirm — el dejador ya tomó la decisión marcando todos como no disponibles
      }

      setCommittingIds(prev => new Set([...prev, id]));
      try {
        await commitPartialRestock(id, available, postponed);
        // Limpiar estado de pospuestos para este pedido
        setPostponedItems(prev => { const next = { ...prev }; delete next[id]; return next; });
        const msg = available.length === 0
          ? `⏳ Pedido de ${point} reencolado completo`
          : `✅ Surtido parcial a ${point} — ${postponed.length} producto(s) reencolado(s)`;
        showToast(msg);
      } catch (err: any) {
        showToast("❌ Error: " + err.message);
      } finally {
        setCommittingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      }
    } else if (wasEditing) {
      // El dejador editó cantidades pero no pospuso. Guardar el payload editado.
      setCommittingIds(prev => new Set([...prev, id]));
      try {
        await commitPartialRestock(id, payload, []);
        showToast(`✅ Entrega editada a ${point} confirmada`);
      } catch (err: any) {
        showToast("❌ Error: " + err.message);
      } finally {
        setCommittingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      }
    } else {
      // Flujo normal sin edición: surtir todo tal como se pidió
      setCommittingIds(prev => new Set([...prev, id]));
      try {
        await commitRestock(id);
        showToast(`✅ Entrega a ${point} confirmada y descontada`);
      } catch (err: any) {
        showToast("❌ Error: " + err.message);
      } finally {
        setCommittingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      }

    }
  };

  const handleReject = (id: string, point: string) => {
    if (editingReqId === id) setEditingReqId(null);
    rejectRequest(id);
    showToast(`❌ Pedido de ${point} rechazado`);
  };

  const handleQtyClick = (prodId: string, val: number | string) => {
    if (typeof val === 'string') {
      // String preset: toggle selection (e.g. MON, 20k, 50k for Cambio)
      const current = stringSelections[prodId];
      const next = current === val ? '' : val;
      setStringSelections(prev => ({ ...prev, [prodId]: next }));
      setLoadQuantities(prev => ({ ...prev, [prodId]: next ? 1 : 0 }));
    } else {
      setLoadQuantities(prev => ({ ...prev, [prodId]: val }));
    }
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
    setNewTemplateName('');
    setShowSaveTemplate(true);
  };

  const confirmSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    addLoadTemplate({
      name: newTemplateName.trim(),
      role: 'DEJADOR',
      userId: (user as any)?.id,
      items: { ...loadQuantities }
    });
    showToast('✅ Plantilla guardada exitosamente');
    setShowSaveTemplate(false);
    setNewTemplateName('');
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
  // Surtir(carga): Red | Pedidos(surtir): Orange | Recibir: Indigo | GPS: Emerald
  const getThemeColor = () => {
    if (activeTab === 'carga')   return '#EF4444'; // bg-red-500
    if (activeTab === 'surtir')  return '#F59E0B'; // bg-amber-500
    if (activeTab === 'recibir') return '#4F46E5'; // bg-indigo-600
    if (activeTab === 'gps')     return '#10b981'; // bg-emerald-500
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
    if (activeTab === 'gps') {
      if (type === 'bg') return 'bg-emerald-500';
      if (type === 'text') return 'text-emerald-500';
      if (type === 'border') return 'border-emerald-500';
      if (type === 'activePill') return forceActive ? 'bg-emerald-500 text-white shadow-sm' : 'bg-transparent text-gray-500 hover:text-emerald-500';
    }
    return '';
  };

  const getHeaderTitle = () => {
    if (activeTab === 'carga') return 'Surtir';
    if (activeTab === 'surtir') return 'Pedidos';
    if (activeTab === 'recibir') return 'Cierre Jornada';
    if (activeTab === 'gps') return 'GPS Triciclos';
    return 'Logística';
  };

  const handleEndShift = () => {
    setShowEndShiftConfirm(true); // Abrir modal de confirmación
  };

  const confirmEndShift = () => {
    setShowEndShiftConfirm(false);
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
    <div
      className="min-h-screen pb-32 font-sans w-full bg-[#FFD56B] flex flex-col"
      onPointerDown={isAlertPlaying ? handleStopAlert : undefined}
    >
      
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
          <div className="bg-amber-100/50 rounded-2xl p-1 mt-5 flex max-w-2xl">
            {[
              { id: 'carga', label: 'Surtir' },
              { id: 'surtir', label: 'Pedidos' },
              { id: 'recibir', label: 'Recibir' },
              { id: 'gps', label: '📍 GPS' },
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
              {vehicles.map((v: string) => {
                const vendorName = vehicleVendorMap[v];
                return (
                <button
                  key={v}
                  onClick={() => setSelectedVehicle(v)}
                  className={`flex-none flex flex-col items-center justify-center gap-0.5 rounded-xl sm:rounded-2xl transition-all duration-300 shadow-sm hover:-translate-y-1 hover:shadow-chunky-lg px-2 py-1.5 min-w-[52px] sm:min-w-[72px] min-h-[52px] sm:min-h-[72px]
                    ${selectedVehicle === v 
                      ? 'bg-amber-500 text-white shadow-[0_0_0_4px_white]' 
                      : 'bg-white text-gray-800 border-2 border-transparent hover:border-amber-200'}`}
                >
                  <span className="font-black text-base sm:text-xl leading-none">{v}</span>
                  {vendorName && (
                    <span className={`text-[9px] sm:text-[10px] font-bold leading-none truncate max-w-[58px] ${
                      selectedVehicle === v ? 'text-amber-100' : 'text-gray-400'
                    }`}>
                      {vendorName}
                    </span>
                  )}
                </button>
                );
              })}
            </div>

            {/* PRESET PILLS + Botón Organizar */}
            <div className="flex gap-2 px-1 flex-shrink-0 flex-wrap justify-end items-center">
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
                    onClick={() => setDeletingTemplate({ id: tpl.id, name: tpl.name })}
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
              {/* Botón Organizar productos */}
              <button
                onClick={openOrganize}
                className="flex items-center gap-1.5 py-2 px-4 rounded-full bg-white border-2 border-gray-300 text-gray-600 font-bold text-sm hover:border-gray-500 hover:text-gray-800 transition-all active:scale-95"
                title="Reordenar y ocultar productos"
              >
                ⚙️ Organizar
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: SURTIR & RECIBIR (PRODUCT GRID) ─── */}
        {(activeTab === 'carga' || activeTab === 'recibir') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fade-in mb-8">
          {/* Reordenar para que la grid rellene de arriba a abajo (columna por columna):
               [0,1,2,3,4,5] con 2 cols → [0,3,1,4,2,5] así queda:
               col1: 0,1,2   col2: 3,4,5  */}
            {(() => {
              const half = Math.ceil(products.length / 2);
              const col1 = products.slice(0, half);
              const col2 = products.slice(half);
              const reordered = col1.map((item: any, i: number) => [item, col2[i]]).flat().filter(Boolean);
              return reordered.map((p: any) => {
              const action = activeTab === 'carga' ? 'surtir' : 'recibir';
              const productPresetValues = getPresetsForProduct(p.id, action);
              return (
              <div key={p.id} className={`${activeTab === 'recibir' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'} rounded-[28px] flex flex-row items-center justify-between p-2 shadow-sm border`}>

                {/* Cápsula izquierda + editar */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className={`${getThemeClass('bg')} text-white font-black text-base px-4 py-2.5 rounded-full min-w-[52px] text-center shadow-sm tracking-wide leading-none`}
                    title={p.name || 'Producto'}
                  >
                    {getProductAbbreviation(p.name || 'Producto', p.abbreviation)}
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
                       productPresetValues.length > 0 && productPresetValues.every((v: any) => typeof v === 'string')
                         ? (stringSelections[p.id] || '')
                         : (loadQuantities[p.id] || 0)
                     }
                     themeClass={activeTab}
                     onChange={(val) => {
                       handleQtyClick(p.id, val);
                       setActivePreset(null);
                     }}
                   />
                </div>
              </div>
              );})
            })()}
          </div>
        )}

        {/* ─── HISTORIAL DE CARGAS INICIALES ─── */}
        {activeTab === 'carga' && (() => {
          const recentCargas = [...(loadHistory as any[])]
            .filter((e: any) => e.type === 'carga')
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 30);
          if (recentCargas.length === 0) return null;
          return (
            <div className="mt-8 mb-6">
              <h2 className="font-black text-gray-700 tracking-wide text-base mb-3 px-1">📦 Historial de Cargas</h2>
              <div className="space-y-2">
                {recentCargas.map((entry: any) => {
                  const totalItems = (entry.items || []).reduce((sum: number, i: any) => sum + (i.qty || 0), 0);
                  const d = new Date(entry.timestamp);
                  const timeStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  return (
                    <div key={entry.id} className="bg-white/80 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-white">
                      <div className="w-10 h-10 rounded-xl bg-red-500 text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                        {(entry.vehicleId || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 text-sm">{entry.vehicleId || 'Sin triciclo'}</p>
                        <p className="text-gray-400 font-bold text-xs">{timeStr}{entry.dejadorName ? ` · ${entry.dejadorName}` : ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-red-500 text-sm">{totalItems} uds.</p>
                        <p className="text-gray-300 font-bold text-[10px]">{(entry.items || []).length} productos</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ─── TAB: PEDIDOS ─── */}
        {activeTab === 'surtir' && (
          <div className="space-y-4 sm:space-y-6 mt-2">
            <h2 className="text-gray-700 font-black tracking-wide text-base sm:text-lg mb-3 sm:mb-4 px-2">Solicitudes Recientes</h2>
            
             {truePendingRequests.length === 0 ? (
                <div className="bg-white/80 rounded-3xl sm:rounded-[40px] p-10 sm:p-16 text-center border-2 border-dashed border-white max-w-3xl mx-auto shadow-sm">
                  <span className="text-4xl sm:text-6xl block mb-4 sm:mb-6 drop-shadow-sm">🙌</span>
                  <h3 className="font-black text-xl sm:text-2xl text-gray-800">Todo al día</h3>
                  <p className="text-gray-500 font-bold mt-2 text-base">No hay carros pidiendo surtido ahora.</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {truePendingRequests.map((req: any) => {
                    const postponedSet = getPostponedSet(req.id);
                    const payload = editingReqId === req.id ? editPayload : (req.items_payload || []);
                    const hasPostponed = postponedSet.size > 0 && editingReqId !== req.id;
                    const allPostponed = hasPostponed && postponedSet.size === payload.length;
                    const isPostponedCard = !!req.isPostponed;

                    return (
                    <div key={req.id}
                      className={`rounded-3xl sm:rounded-[32px] p-4 sm:p-8 shadow-sm border-2 border-dashed relative overflow-hidden transition-all hover:shadow-md ${
                        isPostponedCard
                          ? 'bg-orange-50 border-orange-300 hover:border-orange-400'
                          : req.readAt
                            ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                            : 'bg-white border-gray-300 hover:border-gray-400'
                      }`}
                      onPointerDown={() => {
                        // Redundancia: si llegó a ver esta tarjeta sin haber marcado el tab, marcar aquí
                        if (!req.readAt && !req.isPostponed) {
                          markRequestRead(req.id);
                          stopAll();
                          clearInactivityTimer();
                          setIsAlertPlaying(false);
                        }
                      }}
                    >
                      {/* ── Botón Rechazar — esquina superior derecha ── */}
                      <button
                        onClick={() => handleReject(req.id, req.requester_point_id)}
                        className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-red-50 text-red-400 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-90 text-base font-black z-10"
                        title="Rechazar pedido"
                      >
                        ✕
                      </button>

                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-6 mb-4 sm:mb-6">
                        <div className="flex items-center gap-3">
                          {/* Vehicle Circle Badge */}
                          <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-black text-xl sm:text-3xl shadow-sm border-4 ${
                            isPostponedCard ? 'bg-orange-400 border-orange-100' : 'bg-amber-400 border-amber-100'
                          }`}>
                            {req.requester_point_id}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-800 font-black text-base sm:text-xl leading-tight">
                              {isPostponedCard ? '⏳ Productos Pendientes' : 'Pedido Urgente'}
                            </span>
                            {req.requester_name && (
                              <span className="text-gray-600 font-bold text-sm leading-tight mt-0.5" title="Vendedor que solicitó">{req.requester_name}</span>
                            )}
                            <span className={`font-bold text-xs sm:text-sm inline-block px-3 py-1 rounded-full mt-1 w-max ${
                              isPostponedCard ? 'text-orange-600 bg-orange-100' : 'text-amber-600 bg-amber-50'
                            }`}>
                              {req.created_at ? timeAgo(req.created_at) : 'Pendiente'}
                            </span>
                            {/* Badge resumen de pospuestos */}
                            {hasPostponed && (
                              <span className="text-orange-600 bg-orange-100 font-bold text-xs px-3 py-1 rounded-full mt-1 w-max">
                                {allPostponed ? '⚠️ Todo pospuesto' : `⏳ ${postponedSet.size} pospuesto(s)`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                          {/* Botón Modificar — oculto en pedidos pospuestos */}
                          {!isPostponedCard && (
                            <button
                              className={`flex-1 sm:flex-none font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-full text-sm sm:text-base border-2 transition-colors active:scale-95 whitespace-nowrap ${editingReqId === req.id ? 'bg-green-100 text-green-700 border-green-200 hover:border-green-300' : 'bg-gray-100 text-gray-600 border-transparent hover:border-gray-200'}`}
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
                          )}

                          {/* Botón Surtir — adaptativo */}
                          <button
                            onClick={() => handleCommit(req.id, req.requester_point_id, req)}
                            disabled={committingIds.has(req.id)}
                            className={`flex-1 sm:flex-none font-black px-5 sm:px-8 py-2 sm:py-3 rounded-full text-sm sm:text-base shadow-lg transition-all transform active:scale-95 whitespace-nowrap ${
                              committingIds.has(req.id)
                                ? 'bg-gray-300 text-gray-400 cursor-not-allowed shadow-none'
                                : hasPostponed
                                  ? 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-xl hover:-translate-y-0.5'
                                  : isPostponedCard
                                    ? 'bg-orange-400 text-white hover:bg-orange-500 hover:shadow-xl hover:-translate-y-0.5'
                                    : 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-xl hover:-translate-y-0.5 active:shadow-sm'
                            }`}
                          >
                            {committingIds.has(req.id)
                              ? '⏳ Procesando...'
                              : hasPostponed
                                ? 'Surtir Lo Disponible →'
                                : 'Surtir Ya'}
                          </button>
                        </div>
                      </div>

                      {/* Fused Pills for Items */}
                      <div className={`rounded-2xl p-5 border ${
                        isPostponedCard ? 'bg-orange-50/60 border-orange-100' : 'bg-gray-50 border-gray-100'
                      }`}>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Artículos solicitados:</h4>
                        <div className="flex flex-wrap gap-3">
                          {editingReqId === req.id ? (
                            editPayload.map((item: any, idx: number) => {
                              const isPostp = postponedSet.has(idx);
                              return (
                                <div key={idx} className={`flex rounded-xl overflow-hidden shadow-sm transition-shadow border border-gray-200 bg-white ${isPostp ? 'opacity-50 ring-2 ring-orange-300' : 'hover:shadow-md'}`}>
                                  <div className={`text-white font-black text-sm px-4 py-2.5 flex items-center justify-center min-w-[48px] whitespace-nowrap ${isPostp ? 'bg-gray-400' : 'bg-red-500'}`} title={item.name}>
                                    {item.stringValue || getProductAbbreviation(item.name || '', item.abbreviation)}
                                  </div>
                                  <button onClick={() => handleUpdateEditQty(idx, -1)} className="px-3 bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">-</button>
                                  <div className={`font-black text-base px-3 py-2.5 flex items-center min-w-[40px] justify-center ${isPostp ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                    {item.qty}
                                  </div>
                                  <button onClick={() => handleUpdateEditQty(idx, 1)} className="px-3 bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">+</button>
                                  {/* Botón posponer por producto — solo visible en modo edición */}
                                  {!isPostponedCard && (
                                    <button
                                      title={isPostp ? 'Marcar disponible' : 'No disponible en cocina'}
                                      onClick={() => togglePostponed(req.id, idx)}
                                      className={`px-3 py-2.5 border-l border-gray-200 font-bold text-sm transition-all active:scale-90 ${
                                        isPostp
                                          ? 'bg-orange-100 text-orange-500 hover:bg-orange-200'
                                          : 'bg-white text-gray-300 hover:bg-orange-50 hover:text-orange-400'
                                      }`}
                                    >
                                      {isPostp ? '↩' : '🚫'}
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            payload.map((item: any, idx: number) => {
                              const isPostp = postponedSet.has(idx);
                              return (
                                <div key={idx} className={`flex rounded-xl overflow-hidden shadow-sm transition-all ${
                                  isPostp ? 'opacity-50 ring-2 ring-orange-300' : 'hover:shadow-md'
                                }`}>
                                  <div className={`text-white font-black text-sm px-4 py-2.5 flex items-center justify-center min-w-[48px] whitespace-nowrap transition-colors ${
                                    isPostp ? 'bg-gray-400' : 'bg-red-500'
                                  }`} title={item.name}>
                                    {item.stringValue || getProductAbbreviation(item.name || '', item.abbreviation)}
                                  </div>
                                  <div className={`font-black text-base px-5 py-2.5 flex items-center min-w-[48px] justify-center border-y border-gray-200 ${
                                    isPostp ? 'bg-gray-100 text-gray-400 line-through' : 'bg-white text-gray-900'
                                  }`}>
                                    {item.qty}
                                  </div>
                                  {/* Toggle no-disponible — solo en modo edición */}
                                  {!isPostponedCard && editingReqId === req.id && (
                                    <button
                                      title={isPostp ? 'Marcar disponible' : 'No disponible en cocina'}
                                      onClick={() => togglePostponed(req.id, idx)}
                                      className={`px-3 py-2.5 border-y border-r border-gray-200 font-bold text-sm transition-all active:scale-90 ${
                                        isPostp
                                          ? 'bg-orange-100 text-orange-500 hover:bg-orange-200'
                                          : 'bg-white text-gray-300 hover:bg-orange-50 hover:text-orange-400'
                                      }`}
                                    >
                                      {isPostp ? '↩' : '🚫'}
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                        {hasPostponed && !allPostponed && (
                          <p className="text-orange-500 font-bold text-xs mt-3">
                            Los ítems con 🚫 se reencolarán como nuevo pedido pendiente.
                          </p>
                        )}
                        {/* Banner de observación del vendedor */}
                        {req.observacion && (
                          <div className="mt-4 flex items-start gap-2 bg-amber-50 border-l-4 border-amber-400 rounded-xl px-4 py-3">
                            <span className="text-amber-500 text-base shrink-0">📝</span>
                            <div>
                              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Nota del vendedor</p>
                              <p className="text-sm font-bold text-gray-700 leading-snug">{req.observacion}</p>
                            </div>
                          </div>
                        )}
                        {/* Botón de ubicación GPS del vendedor */}
                        {req.location && req.location.lat && req.location.lng && (
                          <button
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${req.location.lat},${req.location.lng}`, '_blank')}
                            className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 font-black text-sm py-3 px-4 rounded-xl transition-all active:scale-95 shadow-sm"
                          >
                            <span className="text-base">📍</span>
                            Ver Ubicación del Vendedor
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="ml-1 opacity-60">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
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
                                 {item.stringValue || getProductAbbreviation(item.name || '', item.abbreviation)}
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

        {/* ─── TAB: GPS TRICICLOS ─── */}
        {activeTab === 'gps' && (
          <div className="animate-fade-in flex flex-col gap-4">

            {/* Selector de triciclo */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {vehicles.map((v: string) => {
                const vendorName = vehicleVendorMap[v];
                return (
                  <button
                    key={v}
                    onClick={() => setGpsSelectedVehicle(v)}
                    className={`flex-none flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 min-w-[52px] font-black text-sm transition-all duration-200 border-2 active:scale-95 ${
                      gpsSelectedVehicle === v
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    <span className="leading-none">{v}</span>
                    {vendorName && (
                      <span className={`text-[9px] font-bold leading-none ${
                        gpsSelectedVehicle === v ? 'text-emerald-100' : 'text-gray-400'
                      }`}>
                        {vendorName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mapa */}
            <div className="rounded-3xl overflow-hidden shadow-lg border-2 border-white" style={{ height: 320 }}>
              <MapTrackingView
                embedded
                onVehicleSelect={(vehicleId) => setGpsSelectedVehicle(vehicleId)}
                activeShifts={posShifts || []}
              />
            </div>

            {/* Inventario en ruta del triciclo seleccionado */}
            {gpsSelectedVehicle && (
              <VehicleShiftCard vehicleId={gpsSelectedVehicle} currentShift={shift || undefined} />
            )}

          </div>
        )}

      </div>

      {/* ─── FLOATING CONFIRM BUTTON (For Surtir & Recibir) ─── */}
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
                    showToast(`✅ ${activeTab === 'carga' ? 'Surtido registrado' : 'Sobrantes recibidos'} para ${selectedVehicle}`);
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
               {activeTab === 'carga' ? 'Confirmar Surtido' : 'Confirmar Recepción'}
             </button>
           </div>
        </div>
      )}

      {/* MODAL EDITAR PRESETS POR PRODUCTO — 2 secciones: Surtir / Recibir */}
      {editingProductId && (() => {
        const productName = allDeliveryProducts.find((p: any) => p.id === editingProductId)?.name || '';
        const PresetEditor = ({ label, color, drafts, setDrafts }: { label: string; color: string; drafts: string[]; setDrafts: React.Dispatch<React.SetStateAction<string[]>> }) => (
          <div>
            <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${color}`}>{label}</p>
            <div className="flex gap-2 flex-wrap">
              {drafts.map((val, idx) => (
                <input key={idx} type="number" min="1" value={val}
                  onChange={(e) => { const next = [...drafts]; next[idx] = e.target.value; setDrafts(next); }}
                  className="w-14 h-12 rounded-2xl border-2 border-gray-200 text-center font-black text-gray-900 text-base outline-none focus:border-amber-400 transition-colors shadow-sm"
                />
              ))}
              {drafts.length < 6 && (
                <button onClick={() => setDrafts(p => [...p, ''])}
                  className="w-14 h-12 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 font-bold text-xl flex items-center justify-center hover:border-gray-400 transition-colors">+</button>
              )}
              {drafts.length > 1 && (
                <button onClick={() => setDrafts(p => p.slice(0, -1))}
                  className="w-14 h-12 rounded-2xl border-2 border-dashed border-red-200 text-red-300 font-bold text-xl flex items-center justify-center hover:border-red-400 hover:text-red-500 transition-colors">−</button>
              )}
            </div>
          </div>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-[32px] p-6 shadow-2xl w-full max-w-sm">
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-gray-900 text-white font-black text-sm px-3 py-1.5 rounded-full">
                  {getProductAbbreviation(productName)}
                </div>
                <h3 className="font-black text-xl text-gray-900">Botones de cantidad</h3>
              </div>
              <p className="text-gray-400 font-bold text-sm mb-5">Valores independientes para Surtir y para Recibir.</p>

              <div className="flex flex-col gap-5 mb-6">
                <PresetEditor
                  label="🔴 Surtir (Carga inicial)"
                  color="text-red-500"
                  drafts={draftPresetsSurtir}
                  setDrafts={setDraftPresetsSurtir}
                />
                <div className="border-t border-gray-100" />
                <PresetEditor
                  label="🔵 Recibir (Cierre de jornada)"
                  color="text-indigo-500"
                  drafts={draftPresetsRecibir}
                  setDrafts={setDraftPresetsRecibir}
                />
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
        );
      })()}

      {/* MODAL ORGANIZAR PRODUCTOS */}
      {organizeMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[32px] p-6 shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-xl text-gray-900">⚙️ Organizar Productos</h3>
              <button onClick={() => setOrganizeMode(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">✕</button>
            </div>
            <p className="text-gray-400 font-bold text-xs mb-4">Arrastra con ▲▼ para reordenar. Toca el ojo 👁️ para ocultar/mostrar.</p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-5">
              {draftOrder.map((id: string, idx: number) => {
                const prod = allDeliveryProducts.find((p: any) => p.id === id);
                if (!prod) return null;
                const isHidden = draftHidden.includes(id);
                return (
                  <div key={id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                    isHidden ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-200 hover:border-amber-200'
                  }`}>
                    {/* Orden */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveProduct(idx, -1)}
                        disabled={idx === 0}
                        className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-black disabled:opacity-20 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                      >▲</button>
                      <button
                        onClick={() => moveProduct(idx, 1)}
                        disabled={idx === draftOrder.length - 1}
                        className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-black disabled:opacity-20 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                      >▼</button>
                    </div>
                    {/* Nombre */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-sm truncate ${isHidden ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{prod.name}</p>
                      <p className="text-[10px] font-bold text-gray-400">{getProductAbbreviation(prod.name, prod.abbreviation)}</p>
                    </div>
                    {/* Toggle visible */}
                    <button
                      onClick={() => toggleHidden(id)}
                      title={isHidden ? 'Mostrar producto' : 'Ocultar producto'}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all active:scale-90 ${
                        isHidden
                          ? 'bg-gray-100 text-gray-300 hover:bg-amber-100 hover:text-amber-500'
                          : 'bg-amber-50 text-amber-500 hover:bg-red-50 hover:text-red-400'
                      }`}
                    >
                      {isHidden ? '🙈' : '👁️'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setOrganizeMode(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-base hover:bg-gray-200 transition-colors active:scale-95">
                Cancelar
              </button>
              <button onClick={saveOrganize}
                className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-black text-base shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors active:scale-95 flex items-center justify-center gap-2">
                <Save size={16} /> Guardar orden
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
      {/* ─── Badge flotante: nuevos pedidos + botón para parar ─── */}
      {isAlertPlaying && (
        <div className={`fixed bottom-6 inset-x-0 flex justify-center z-50 ${isLooping.current ? 'animate-bounce' : ''}`}>
          <button
            onClick={handleStopAlert}
            className="flex items-center gap-2 px-5 py-3.5 bg-red-500 hover:bg-red-600 active:scale-95 text-white font-black text-sm rounded-full shadow-2xl shadow-red-500/40 transition-all border-2 border-white"
          >
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            {newOrderCount > 1
              ? `🔔 ${newOrderCount} pedidos nuevos — Toca para entendido`
              : '🔔 Nuevo pedido — Toca para entendido'}
            {isLooping.current && (
              <span className="ml-1 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">🔊 ACTIVO</span>
            )}
          </button>
        </div>
      )}

      {/* ─── Modal guardar nueva plantilla ─── */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Guardar Plantilla</h2>
            <p className="text-sm text-gray-500 mb-4">Dale un nombre a esta configuración de surtido.</p>
            <input
              type="text"
              autoFocus
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmSaveTemplate()}
              placeholder="Ej: Carga Fin de Semana"
              className="w-full border-2 border-amber-300 rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-amber-500 mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSaveTemplate}
                disabled={!newTemplateName.trim()}
                className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-black text-sm active:scale-95 transition-all disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmar borrar template ─── */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">¿Eliminar plantilla?</h2>
            <p className="text-sm text-gray-500 mb-6">"{deletingTemplate.name}" se borrará permanentemente.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingTemplate(null)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => { deleteLoadTemplate(deletingTemplate.id); setDeletingTemplate(null); }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm active:scale-95 transition-all"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmar cierre de jornada ─── */}
      {showEndShiftConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <div className="text-4xl mb-3">🚪</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">¿Cerrar Jornada?</h2>
            <p className="text-sm text-gray-500 mb-6">Se cerrará la sesión del Dejador y volverás al login.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndShiftConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEndShift}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm active:scale-95 transition-all"
              >
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
