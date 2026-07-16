import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { usePosStore } from '../../../store/usePosStore';
import { useInventoryStore } from '../../../store/useInventoryStore';
import { ShoppingBag, Check, X, Phone, MapPin, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';

// Web Audio API Synthesizer for a premium register/bell sound
const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playNote = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Use triangle wave for a softer, bell-like quality
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      
      osc.start(time);
      osc.stop(time + duration);
    };
    
    const now = ctx.currentTime;
    // Pleasant double ding chime (bright chord)
    playNote(659.25, now, 0.3);        // E5
    playNote(987.77, now + 0.1, 0.5);   // B5
  } catch (e) {
    console.warn("Audio synthesis block:", e.message);
  }
};

export function OlaClickOrdersTab({ activeShiftId, selectedRegisterId, formatMoney, onClose, onOrderProcessed }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'ACCEPTED' | 'REJECTED'
  const loadExternalOrder = usePosStore(s => s.loadExternalOrder);
  const clearCart = usePosStore(s => s.clearCart);
  const parkOlaClickOrder = usePosStore(s => s.parkOlaClickOrder);
  const posSettings = useInventoryStore(s => s.posSettings);

  // 1. Cargar pedidos iniciales desde Supabase
  useEffect(() => {
    async function fetchOrders() {
      try {
        setLoading(true);
        const merchantId = posSettings?.olaclickMerchantId || '';
        if (!merchantId) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('olaclick_orders')
          .select('*')
          .eq('store_id', merchantId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error('[OlaClickTab] Error al cargar pedidos:', err.message);
        toast.error('No se pudieron cargar los pedidos en línea');
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [posSettings?.olaclickMerchantId]);

  // 2. Suscribirse a cambios en tiempo real (Supabase Realtime)
  useEffect(() => {
    const merchantId = posSettings?.olaclickMerchantId || '';
    
    const channel = supabase
      .channel('olaclick_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'olaclick_orders' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          console.log('[OlaClickTab] Realtime update:', eventType, newRecord);

          // Si es un evento de creación o actualización, validar comercio/sede
          if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord && newRecord.store_id !== merchantId) {
            return;
          }

          setOrders((prev) => {
            if (eventType === 'INSERT') {
              if (newRecord.status === 'PENDING') {
                if (soundEnabled) playChime();
                toast(`📱 ¡Nuevo pedido en línea de ${newRecord.customer_name}!`, {
                  icon: '🔔',
                  duration: 5000,
                  className: 'bg-yellow-50 text-yellow-800 border-2 border-yellow-400 font-black rounded-2xl shadow-chunky-lg'
                });
              }
              return [newRecord, ...prev];
            }
            if (eventType === 'UPDATE') {
              const oldMatch = prev.find(o => o.id === newRecord.id);
              if (newRecord.status === 'PENDING' && (!oldMatch || oldMatch.status !== 'PENDING')) {
                if (soundEnabled) playChime();
                toast('📱 Pedido actualizado disponible', { icon: '🔔' });
              }
              return prev.map((o) => (o.id === newRecord.id ? newRecord : o));
            }
            if (eventType === 'DELETE') {
              return prev.filter((o) => o.id !== oldRecord.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled, posSettings?.olaclickMerchantId]);

  // 3. Aceptar e importar pedido a Ventas en Espera
  const handleAcceptOrder = async (order) => {
    try {
      // 1. Actualizar estado local inmediatamente para remover la tarjeta de "PENDING"
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'ACCEPTED' } : o)));

      // 2. Guardar directamente en Ventas en Espera del POS
      parkOlaClickOrder(order);

      // 3. Cambiar estado a ACEPTADO en Supabase
      const { error } = await supabase
        .from('olaclick_orders')
        .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) {
        console.error('[OlaClickTab] Error DB:', error.message);
      }

      // 4. Sincronizar estado 'ACCEPTED' con OlaClick API
      try {
        const userBranch = JSON.parse(localStorage.getItem('auth-storage'))?.state?.user?.branchId || 'GLOBAL';
        const apiToken = posSettings?.olaclickByBranch?.[userBranch]?.apiToken || posSettings?.olaclickToken;
        if (apiToken) {
          const res = await fetch(`https://public-api.olaclick.app/v1/orders/${order.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'ACCEPTED' }) // Dependiendo de la versión puede ser ACCEPTED o PREPARING
          });
          if (!res.ok) {
            console.warn('[OlaClickTab] La API de OlaClick no actualizó el estado a ACCEPTED', await res.text());
          }
        }
      } catch (apiErr) {
        console.error('[OlaClickTab] Error al sincronizar con OlaClick:', apiErr);
      }

      toast.success(`📱 Pedido de ${order.customer_name || 'OlaClick'} guardado en Ventas en Espera`, {
        className: 'bg-green-500 text-white font-black rounded-2xl shadow-chunky-lg'
      });

      if (onOrderProcessed) onOrderProcessed();
    } catch (err) {
      console.error('[OlaClickTab] Error al aceptar pedido:', err.message);
      toast.error('No se pudo procesar la aceptación del pedido');
    }
  };

  // 4. Rechazar pedido con confirmación nativa
  const handleRejectOrder = async (e, order) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const rejectionReason = 'OTHER';

      // 1. Actualizar estado local inmediatamente para remover la tarjeta de "PENDING"
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'REJECTED', rejection_reason: rejectionReason } : o)));

      // 2. Cambiar estado a REJECTED en Supabase DB
      const { error } = await supabase
        .from('olaclick_orders')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) {
        console.error('[OlaClickTab] Error DB al rechazar:', error.message);
      }

      // 3. Sincronizar estado con OlaClick API
      try {
        const userBranch = JSON.parse(localStorage.getItem('auth-storage'))?.state?.user?.branchId || 'GLOBAL';
        const apiToken = posSettings?.olaclickByBranch?.[userBranch]?.apiToken || posSettings?.olaclickToken;
        if (apiToken) {
          const res = await fetch(`https://public-api.olaclick.app/v1/orders/${order.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'REJECTED', reason: rejectionReason })
          });
          if (!res.ok) {
            console.warn('[OlaClickTab] La API de OlaClick no actualizó el estado a REJECTED', await res.text());
          }
        }
      } catch (apiErr) {
        console.error('[OlaClickTab] Error al sincronizar con OlaClick:', apiErr);
      }

      toast.error(`❌ Pedido rechazado exitosamente`, {
        className: 'bg-red-600 text-white font-black rounded-2xl shadow-chunky-lg'
      });

      if (onOrderProcessed) onOrderProcessed();
    } catch (err) {
      console.error('[OlaClickTab] Error al rechazar pedido:', err.message);
      toast.error('No se pudo rechazar el pedido');
    }
  };

  const handleAcceptAll = async () => {
    const pendingOrders = orders.filter(o => o.status === 'PENDING');
    if (pendingOrders.length === 0) return;
    
    if (!confirm(`¿Estás seguro de aceptar los ${pendingOrders.length} pedidos pendientes de una vez?`)) {
      return;
    }

    try {
      // 1. Update state local
      setOrders(prev => prev.map(o => o.status === 'PENDING' ? { ...o, status: 'ACCEPTED' } : o));

      // 2. Park each order in Ventas en Espera
      for (const order of pendingOrders) {
        parkOlaClickOrder(order);
      }

      // 3. Update DB
      const ids = pendingOrders.map(o => o.id);
      const { error } = await supabase
        .from('olaclick_orders')
        .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
        .in('id', ids);

      if (error) {
        console.error('[OlaClickTab] Error al actualizar estado masivo en DB:', error.message);
      }

      // 4. Sync with OlaClick API asynchronously
      const userBranch = JSON.parse(localStorage.getItem('auth-storage'))?.state?.user?.branchId || 'GLOBAL';
      const apiToken = posSettings?.olaclickByBranch?.[userBranch]?.apiToken || posSettings?.olaclickToken;
      if (apiToken) {
        Promise.all(
          pendingOrders.map(order => 
            fetch(`https://public-api.olaclick.app/v1/orders/${order.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: 'ACCEPTED' })
            }).catch(e => console.warn(`[OlaClickTab] Error al notificar OlaClick para orden ${order.id}:`, e))
          )
        );
      }

      toast.success(`📱 ${pendingOrders.length} pedidos aceptados y guardados en Ventas en Espera`, {
        className: 'bg-green-500 text-white font-black rounded-2xl shadow-chunky-lg'
      });

      if (onOrderProcessed) onOrderProcessed();
    } catch (err) {
      console.error('[OlaClickTab] Error en handleAcceptAll:', err.message);
      toast.error('Error al procesar la aceptación masiva');
    }
  };

  const handleRejectAll = async () => {
    const pendingOrders = orders.filter(o => o.status === 'PENDING');
    if (pendingOrders.length === 0) return;
    
    if (!confirm(`¿Estás seguro de RECHAZAR los ${pendingOrders.length} pedidos pendientes?`)) {
      return;
    }

    try {
      const rejectionReason = 'OTHER';

      // 1. Update state local
      setOrders(prev => prev.map(o => o.status === 'PENDING' ? { ...o, status: 'REJECTED', rejection_reason: rejectionReason } : o));

      // 2. Update DB
      const ids = pendingOrders.map(o => o.id);
      const { error } = await supabase
        .from('olaclick_orders')
        .update({ 
          status: 'REJECTED', 
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString() 
        })
        .in('id', ids);

      if (error) {
        console.error('[OlaClickTab] Error al rechazar masivo en DB:', error.message);
      }

      // 3. Sync with OlaClick API asynchronously
      const userBranch = JSON.parse(localStorage.getItem('auth-storage'))?.state?.user?.branchId || 'GLOBAL';
      const apiToken = posSettings?.olaclickByBranch?.[userBranch]?.apiToken || posSettings?.olaclickToken;
      if (apiToken) {
        Promise.all(
          pendingOrders.map(order => 
            fetch(`https://public-api.olaclick.app/v1/orders/${order.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: 'REJECTED', reason: rejectionReason })
            }).catch(e => console.warn(`[OlaClickTab] Error al notificar rechazo a OlaClick para orden ${order.id}:`, e))
          )
        );
      }

      toast.error(`❌ ${pendingOrders.length} pedidos rechazados exitosamente`, {
        className: 'bg-red-600 text-white font-black rounded-2xl shadow-chunky-lg'
      });

      if (onOrderProcessed) onOrderProcessed();
    } catch (err) {
      console.error('[OlaClickTab] Error en handleRejectAll:', err.message);
      toast.error('Error al procesar el rechazo masivo');
    }
  };

  // Filtrar pedidos según pestaña seleccionada
  const filteredOrders = orders.filter((o) => o.status === activeTab);
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0e12] rounded-[32px] border border-gray-900 overflow-hidden shadow-chunky-xl">
      {/* Sub-header de control de pedidos */}
      <div className="bg-[#13151b] px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xl shadow-inner">
            📱
          </div>
          <div>
            <h2 className="text-base font-black text-white leading-tight">Pedidos en Línea OlaClick</h2>
            <p className="text-xs text-gray-500 font-bold">Monitoreo automático en tiempo real</p>
          </div>
        </div>

        {/* Control de sonido & Filtros */}
        <div className="flex items-center gap-3 mr-12">
          {/* Botón de Sonido Mute/Unmute */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              soundEnabled 
                ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' 
                : 'bg-gray-800/40 text-gray-500 hover:bg-gray-800'
            }`}
            title={soundEnabled ? "Silenciar notificaciones" : "Activar sonido"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Selector de Pestañas (Filtros) */}
          <div className="flex bg-[#1d1f27] rounded-xl p-1 border border-gray-800">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'PENDING'
                  ? 'bg-yellow-500 text-gray-950 shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Pendientes
              {pendingCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  activeTab === 'PENDING' ? 'bg-gray-950 text-yellow-500' : 'bg-yellow-500 text-gray-950'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ACCEPTED')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                activeTab === 'ACCEPTED'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Aceptados
            </button>
            <button
              onClick={() => setActiveTab('REJECTED')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                activeTab === 'REJECTED'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Rechazados
            </button>
          </div>
        </div>
      </div>

      {/* Grid / Lista de Pedidos */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[60vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-gray-500">Cargando pedidos en línea...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-4xl">📬</span>
            <p className="font-black text-gray-500 text-sm">No hay pedidos en esta sección</p>
            <p className="text-xs text-gray-600 max-w-xs leading-normal">
              {activeTab === 'PENDING' 
                ? 'Los pedidos que hagan tus clientes desde OlaClick aparecerán aquí instantáneamente.' 
                : 'Historial de pedidos procesados durante la jornada.'}
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'PENDING' && (
              <div className="flex justify-end gap-3 pb-2">
                <button
                  onClick={handleRejectAll}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-xs px-4 py-2.5 rounded-xl border border-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <X size={14} /> Rechazar Todos ({filteredOrders.length})
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="bg-green-600 hover:bg-green-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} /> Aceptar Todos ({filteredOrders.length})
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#12131a] border border-gray-900 rounded-[24px] p-5 flex flex-col justify-between hover:border-gray-800 transition-all shadow-inner animate-card-in"
              >
                {/* Cabecera Tarjeta: Nombre + ID */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-900/60">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      {order.customer_name || 'Cliente'}
                      {order.service_type && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          order.service_type === 'DELIVERY' 
                            ? 'bg-blue-500/10 text-blue-400' 
                            : 'bg-orange-500/10 text-orange-400'
                        }`}>
                          {order.service_type === 'DELIVERY' ? '🛵 Domicilio' : '🏪 Recoger'}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                      Pedido {order.public_id || `#${order.id?.substring(0, 8)}`} • {new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} a las {new Date(order.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {order.delivery_price > 0 && (
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        Envío: {formatMoney(order.delivery_price)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Contenido: Detalles e Ítems */}
                <div className="py-3 flex-1 space-y-3">
                  {/* Dirección y teléfono */}
                  <div className="space-y-1">
                    {order.customer_phone && (
                      <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
                        <Phone size={12} className="text-gray-500" /> {order.customer_phone}
                      </p>
                    )}
                    {order.delivery_address && (
                      <p className="text-xs text-gray-400 font-bold flex items-start gap-1">
                        <MapPin size={12} className="text-gray-500 mt-0.5" /> {order.delivery_address}
                      </p>
                    )}
                  </div>

                  {/* Listado de Productos */}
                  <div className="bg-[#181a23] rounded-xl p-3 border border-gray-900/40">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider mb-2">Desglose de Ítems</p>
                    {Array.isArray(order.items) && order.items.length > 0 ? (
                      <ul className="space-y-2">
                        {order.items.map((item, idx) => {
                          const qty = item.quantity || item.qty || 1;
                          const name = item.product_name || item.name || 'Producto';
                          const unitPrice = item.combo_price || item.variant_price || item.price || 0;
                          const note = item.comment || item.note || '';

                          return (
                            <li key={idx} className="flex justify-between items-start gap-2 text-xs">
                              <span className="text-gray-300 font-bold leading-normal">
                                <span className="text-yellow-500 font-black">{qty}x</span>{' '}
                                {name}
                                {note && (
                                  <span className="block text-[10px] text-gray-500 font-semibold italic mt-0.5">
                                    Nota: "{note}"
                                  </span>
                                )}
                              </span>
                              <span className="text-white font-black shrink-0">
                                {formatMoney(unitPrice * qty)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Sin desglose disponible</p>
                    )}
                  </div>

                  {/* Motivo de rechazo si aplica */}
                  {order.status === 'REJECTED' && order.rejection_reason && (
                    <div className="bg-red-500/10 text-red-400 text-xs font-bold rounded-xl p-3 flex items-start gap-2 border border-red-500/20">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black uppercase text-[10px] tracking-wider">Motivo del Rechazo</p>
                        <p className="mt-0.5 font-semibold text-red-300">"{order.rejection_reason}"</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Tarjeta: Total + Acciones */}
                <div className="pt-3 border-t border-gray-900/60 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Pedido</p>
                    <p className="text-base font-black text-yellow-500 mt-0.5">{formatMoney(order.total_amount)}</p>
                  </div>

                  {/* Acciones */}
                  {order.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleRejectOrder(e, order)}
                        className="w-10 h-10 rounded-full bg-[#f85151] hover:bg-red-600 text-white shadow-lg active:scale-90 transition-all flex items-center justify-center font-bold shrink-0 cursor-pointer"
                        title="Rechazar pedido"
                      >
                        <X size={18} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcceptOrder(order)}
                        className="bg-green-500 hover:bg-green-600 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-md flex items-center gap-1.5"
                      >
                        <Check size={14} /> Aceptar
                      </button>
                    </div>
                  )}
                  {order.status === 'ACCEPTED' && (
                    <span className="text-[11px] font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full flex items-center gap-1">
                      <Check size={12} /> Aceptado
                    </span>
                  )}
                  {order.status === 'REJECTED' && (
                    <span className="text-[11px] font-black text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full flex items-center gap-1">
                      <X size={12} /> Rechazado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
