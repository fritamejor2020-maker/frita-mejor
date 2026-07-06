import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { isPointInPolygon, getHaversineDistance, formatDistance } from '../utils/geoUtils';
import { useBranchStore } from '../store/useBranchStore';
import { toast } from 'react-hot-toast';
import { ShoppingBag, MapPin, Phone, User, Check, X, ShieldAlert, Sparkles, Navigation, Clock, MessageCircle, ArrowRight, Store } from 'lucide-react';

const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522]; // Pitalito, Huila
const DEFAULT_ZOOM = 14;

// Custom Icons for Leaflet
const clientIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25));
    ">
      <div style="
        background: #FF4040; border: 3px solid white;
        border-radius: 50%; width: 42px; height: 42px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; animation: bounce 1.5s infinite;
      ">😋</div>
      <div style="
        background: #1f2937; border-radius: 8px; padding: 2px 6px;
        font-size: 10px; font-weight: 900; color: white;
        margin-top: 2px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">Tu Ubicación</div>
    </div>`,
  iconSize: [50, 50],
  iconAnchor: [25, 45],
});

const createVendorIcon = (name: string, isSelected: boolean, isStationary = false) => L.divIcon({
  className: '',
  html: `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3));
    ">
      <div style="
        background: ${isSelected ? '#FF4040' : (isStationary ? '#3b82f6' : '#FFB700')}; 
        border: 3px solid white;
        border-radius: 50%; width: 44px; height: 44px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; transition: all 0.2s;
      ">${isStationary ? '🏪' : '🛵'}</div>
      <div style="
        background: white; border: 2px solid ${isSelected ? '#FF4040' : (isStationary ? '#3b82f6' : '#FFB700')};
        border-radius: 10px; padding: 1px 6px;
        font-size: 9px; font-weight: 900; color: #1f2937;
        margin-top: 1px; white-space: nowrap; max-width: 90px; overflow: hidden;
      ">${name}</div>
    </div>`,
  iconSize: [60, 60],
  iconAnchor: [30, 44],
});

// Helper component to bind map events for draggable marker and user geolocator
function MapController({
  onLocationChange,
  triggerGeolocation,
  setTriggerGeolocation,
  centerPos,
}: {
  onLocationChange: (lat: number, lng: number) => void;
  triggerGeolocation: boolean;
  setTriggerGeolocation: (val: boolean) => void;
  centerPos?: [number, number];
}) {
  const map = useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (triggerGeolocation) {
      map.locate({ setView: true, maxZoom: 15 });
      setTriggerGeolocation(false);
    }
  }, [triggerGeolocation]);

  useEffect(() => {
    if (centerPos) {
      map.setView(centerPos, DEFAULT_ZOOM);
    }
  }, [centerPos]);

  useMapEvents({
    locationfound(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
      toast.success('¡Ubicación GPS encontrada! 📍');
    },
    locationerror() {
      toast.error('No se pudo acceder a tu GPS. Por favor selecciona tu ubicación en el mapa.');
    },
  });

  return null;
}

export function ClientePedirView() {
  const { branches } = useBranchStore();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'BRANCH-001');

  // --- Estados de Ubicación y Cobertura ---
  const [clientPos, setClientPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [geofences, setGeofences] = useState<any[]>([]);
  const [isInsideCoverage, setIsInsideCoverage] = useState(false);
  const [triggerGeolocation, setTriggerGeolocation] = useState(true);

  // --- Modalidad de Pedido: 'delivery' (Vengan a mí) | 'pickup' (Voy al puesto) ---
  const [deliveryMode, setDeliveryMode] = useState<'delivery' | 'pickup'>('delivery');

  // --- Catálogo y Stock ---
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [inventorySnapshots, setInventorySnapshots] = useState<any[]>([]);

  // --- Carrito ---
  const [cart, setCart] = useState<Record<string, number>>({});

  // --- Formulario de Checkout ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Seguimiento en Vivo ---
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => localStorage.getItem('fm_active_order_id'));
  const [activeOrderToken, setActiveOrderToken] = useState<string | null>(() => localStorage.getItem('fm_active_order_token'));
  const [activeOrder, setActiveOrder] = useState<any>(null);

  // Cargar sede actual
  const currentBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

  // 1. Cargar Geocercas, Vendedores y Catálogo al montar
  useEffect(() => {
    fetchGeofences();
    fetchVendors();
    fetchCatalog();
    
    if (activeOrderId && activeOrderToken) {
      monitorOrder();
    }
  }, [selectedBranchId]);

  // Actualizar centro del mapa si cambia la sede
  useEffect(() => {
    if (currentBranch?.settings?.lat && currentBranch?.settings?.lng) {
      setClientPos([currentBranch.settings.lat, currentBranch.settings.lng]);
    }
  }, [selectedBranchId]);

  // Recalcular cobertura cuando cambie la posición o las geocercas
  useEffect(() => {
    if (geofences.length === 0) {
      setIsInsideCoverage(true); // Si no hay geocercas configuradas, asumir cobertura general
      return;
    }
    
    let covered = false;
    for (const geo of geofences) {
      if (Array.isArray(geo.coordinates) && isPointInPolygon(clientPos[0], clientPos[1], geo.coordinates)) {
        covered = true;
        break;
      }
    }
    setIsInsideCoverage(covered);
    // Si queda fuera de cobertura, forzar modo pickup (Recoger en punto)
    if (!covered && deliveryMode === 'delivery') {
      setDeliveryMode('pickup');
    }
  }, [clientPos, geofences]);

  const fetchGeofences = async () => {
    const { data } = await supabase.from('geofences').select('*').eq('is_active', true);
    setGeofences(data || []);
  };

  const fetchVendors = async () => {
    const { data } = await supabase.from('vendor_locations').select('*').eq('is_active', true);
    setVendors(data || []);
  };

  const fetchCatalog = async () => {
    const { data: prodData } = await supabase.from('products').select('*');
    const { data: snapData } = await supabase.from('inventory_snapshots').select('*');
    
    setProducts(prodData || []);
    setInventorySnapshots(snapData || []);
  };

  const monitorOrder = async () => {
    if (!activeOrderId || !activeOrderToken) return;

    const { data, error } = await supabase.rpc('get_active_delivery_request', {
      p_order_id: activeOrderId,
      p_client_token: activeOrderToken
    });

    if (error || !data || data.length === 0) {
      localStorage.removeItem('fm_active_order_id');
      localStorage.removeItem('fm_active_order_token');
      setActiveOrderId(null);
      setActiveOrderToken(null);
      setActiveOrder(null);
      return;
    }

    const orderData = data[0];
    setActiveOrder(orderData);

    if (orderData.status === 'completed' || orderData.status === 'rejected') {
      return;
    }

    const channel = supabase.channel(`order-track-${activeOrderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_requests',
        filter: `id=eq.${activeOrderId}`
      }, async () => {
        const { data: updated } = await supabase.rpc('get_active_delivery_request', {
          p_order_id: activeOrderId,
          p_client_token: activeOrderToken
        });
        if (updated && updated.length > 0) {
          setActiveOrder(updated[0]);
        }
      })
      .subscribe();

    const interval = setInterval(async () => {
      const { data: polled } = await supabase.rpc('get_active_delivery_request', {
        p_order_id: activeOrderId,
        p_client_token: activeOrderToken
      });
      if (polled && polled.length > 0) {
        setActiveOrder(polled[0]);
        if (polled[0].status === 'completed' || polled[0].status === 'rejected') {
          clearInterval(interval);
          supabase.removeChannel(channel);
        }
      }
    }, 8000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  };

  // Vendedores cercanos en 3 km
  const vendorsInProximity = vendors.map(v => {
    const distance = getHaversineDistance(clientPos[0], clientPos[1], v.lat, v.lng);
    return { ...v, distance };
  }).filter(v => v.distance <= 4.0).sort((a, b) => a.distance - b.distance);

  useEffect(() => {
    if (vendorsInProximity.length > 0) {
      if (!selectedVendorId || !vendorsInProximity.some(v => v.vendor_id === selectedVendorId)) {
        setSelectedVendorId(vendorsInProximity[0].vendor_id);
      }
    } else {
      setSelectedVendorId(null);
    }
  }, [clientPos, vendors]);

  const selectedVendor = vendorsInProximity.find(v => v.vendor_id === selectedVendorId);
  const selectedVendorPointId = selectedVendor?.point_id;
  const vendorInventory = inventorySnapshots.filter(snap => snap.point_id === selectedVendorPointId && snap.quantity > 0);
  const vendorProducts = vendorInventory.map(snap => {
    const prod = products.find(p => p.id === snap.product_id);
    return prod ? { ...prod, stock: snap.quantity } : null;
  }).filter(Boolean) as any[];

  const addToCart = (productId: string, stock: number) => {
    const current = cart[productId] || 0;
    if (current >= stock) {
      toast.error('¡Stock máximo disponible alcanzado!');
      return;
    }
    setCart(prev => ({ ...prev, [productId]: current + 1 }));
  };

  const removeFromCart = (productId: string) => {
    const current = cart[productId] || 0;
    if (current <= 1) {
      const copy = { ...cart };
      delete copy[productId];
      setCart(copy);
    } else {
      setCart(prev => ({ ...prev, [productId]: current - 1 }));
    }
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((sum, [pId, qty]) => {
      const prod = products.find(p => p.id === Number(pId));
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  };

  const getCartItemsCount = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getCartItemsCount() === 0) {
      toast.error('Agrega productos al carrito antes de pedir.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error('Por favor ingresa tu nombre y teléfono móvil.');
      return;
    }
    if (!phone.match(/^[0-9]{7,15}$/)) {
      toast.error('El número de teléfono móvil debe contener entre 7 y 15 dígitos.');
      return;
    }
    if (!selectedVendorId) {
      toast.error('Selecciona un puesto o carrito disponible.');
      return;
    }

    setIsSubmitting(true);
    const token = crypto.randomUUID ? crypto.randomUUID() : 'c-' + Math.random().toString(36).substring(2, 15);

    const itemsPayload = Object.entries(cart).map(([pId, qty]) => {
      const prod = products.find(p => p.id === Number(pId));
      return {
        productId: Number(pId),
        qty,
        name: prod?.name || 'Producto',
        price: prod?.price || 0
      };
    });

    const newOrder = {
      client_name: name.trim(),
      client_phone: phone.trim(),
      client_address: address.trim() || (deliveryMode === 'pickup' ? 'Para recoger en puesto' : null),
      client_lat: clientPos[0],
      client_lng: clientPos[1],
      items: itemsPayload,
      total_amount: getCartTotal(),
      status: 'pending',
      assigned_vendor_id: selectedVendorId,
      client_token: token,
      delivery_mode: deliveryMode, // 'delivery' o 'pickup'
      branch_id: selectedBranchId,
    };

    try {
      const { data, error } = await supabase.from('delivery_requests').insert(newOrder).select('id').single();
      
      if (error) {
        throw new Error(error.message);
      }

      toast.success(deliveryMode === 'delivery' ? '¡Pedido a domicilio enviado! 🛵💨' : '¡Pedido reservado para recoger! 📍');
      localStorage.setItem('fm_active_order_id', data.id);
      localStorage.setItem('fm_active_order_token', token);
      setActiveOrderId(data.id);
      setActiveOrderToken(token);
      setCart({});
      
      setTimeout(() => {
        monitorOrder();
      }, 500);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al procesar el pedido. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetOrder = () => {
    localStorage.removeItem('fm_active_order_id');
    localStorage.removeItem('fm_active_order_token');
    setActiveOrderId(null);
    setActiveOrderToken(null);
    setActiveOrder(null);
    setCart({});
  };

  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  };

  // --- VISTA DE SEGUIMIENTO EN VIVO ESTILO UBER/RAPPI ---
  if (activeOrder) {
    const isPending = activeOrder.status === 'pending';
    const isAccepted = activeOrder.status === 'accepted';
    const isCompleted = activeOrder.status === 'completed';
    const isRejected = activeOrder.status === 'rejected';
    const isPickup = activeOrder.delivery_mode === 'pickup';

    const distanceKm = (isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng)
      ? getHaversineDistance(activeOrder.client_lat, activeOrder.client_lng, activeOrder.vendor_lat, activeOrder.vendor_lng)
      : null;

    // ETA estimado (asumiendo velocidad promedio de 15 km/h en triciclo/carrito)
    const etaMinutes = distanceKm ? Math.max(2, Math.round((distanceKm / 15) * 60 + 3)) : 5;

    return (
      <div className="min-h-screen bg-[#FFD56B] flex flex-col font-sans">
        {/* HEADER DE SEGUIMIENTO */}
        <header className="bg-white rounded-b-[32px] px-6 py-4 shadow-sm text-center flex items-center justify-between">
          <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5">
            🛵 frita mejor <span className="text-[#FF4040]">{isPickup ? 'recoge' : 'delivery'}</span>
          </h1>
          <button
            onClick={handleResetOrder}
            className="text-xs font-bold text-gray-400 hover:text-gray-700 underline"
          >
            Nuevo Pedido
          </button>
        </header>

        <div className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
          {/* MAPA ANIMADO ESTILO UBER CON POLILÍNEA */}
          {(isPending || isAccepted) && (
            <div className="w-full lg:w-3/5 lg:sticky lg:top-6 flex flex-col gap-4">
              <div className="bg-white rounded-[32px] overflow-hidden shadow-sm h-[320px] lg:h-[calc(100vh-180px)] lg:min-h-[500px] border-2 border-white relative">
                <MapContainer
                  center={[activeOrder.client_lat, activeOrder.client_lng]}
                  zoom={15}
                  style={{ width: '100%', height: '100%', zIndex: 1 }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Pin del Cliente */}
                  <Marker position={[activeOrder.client_lat, activeOrder.client_lng]} icon={clientIcon} />

                  {/* Pin del Vendedor */}
                  {isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng && (
                    <Marker 
                      position={[activeOrder.vendor_lat, activeOrder.vendor_lng]} 
                      icon={createVendorIcon(activeOrder.vendor_name || 'Vendedor', true, isPickup)} 
                    />
                  )}

                  {/* Línea de ruta (Polyline) guiada estilo Uber */}
                  {isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng && (
                    <Polyline
                      positions={[
                        [activeOrder.vendor_lat, activeOrder.vendor_lng],
                        [activeOrder.client_lat, activeOrder.client_lng]
                      ]}
                      pathOptions={{
                        color: '#FF4040',
                        weight: 5,
                        dashArray: '8, 12',
                        opacity: 0.8
                      }}
                    />
                  )}
                </MapContainer>

                {/* Badge de Distancia y ETA Estilo Uber */}
                {isAccepted && distanceKm !== null && (
                  <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur shadow-xl rounded-2xl p-3.5 z-[1000] border border-gray-100 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg animate-pulse">
                        {isPickup ? '📍' : '🛵'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800">
                          {isPickup ? 'Puesto a' : 'Carrito a'} {formatDistance(distanceKm)}
                        </p>
                        <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                          <Clock size={12} /> Llega en aprox. ~{etaMinutes} min
                        </p>
                      </div>
                    </div>
                    
                    {activeOrder.vendor_phone && (
                      <a
                        href={`tel:${activeOrder.vendor_phone}`}
                        className="bg-green-500 hover:bg-green-600 text-white p-2.5 rounded-xl shadow-sm flex items-center gap-1 text-xs font-bold transition-all active:scale-95"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DERECHA: BARRA DE PROGRESO DE ESTADO */}
          <div className={`w-full flex flex-col gap-4 ${
            (isPending || isAccepted) 
              ? 'lg:w-2/5 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto pr-1 shrink-0' 
              : 'max-w-lg mx-auto'
          }`}>
            <div className="bg-white rounded-[32px] p-6 shadow-sm flex flex-col gap-5 text-center">
              
              {/* Barra de Pasos Estilo Rappi */}
              {(isPending || isAccepted) && (
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  {[
                    { label: 'Enviado', icon: '📩', done: true },
                    { label: 'Aceptado', icon: '👍', done: isAccepted },
                    { label: isPickup ? 'Listo' : 'En camino', icon: isPickup ? '🛍️' : '🛵', done: isAccepted },
                    { label: 'Entregado', icon: '🎉', done: false },
                  ].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                        step.done 
                          ? 'bg-[#FF4040] text-white shadow-md scale-105' 
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {step.icon}
                      </div>
                      <span className={`text-[10px] font-bold ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isPending && (
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-3xl mx-auto animate-bounce">
                    🔔
                  </div>
                  <h2 className="text-lg font-black text-gray-900">Buscando Carrito Cercano...</h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    Tu pedido fue notificado a <span className="text-amber-500 font-extrabold">{activeOrder.vendor_name || 'repartidores cercanos'}</span>.
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mt-3">
                    <div className="bg-[#FFB700] h-full rounded-full animate-[pulse_1.5s_infinite]" style={{ width: '70%' }}></div>
                  </div>
                </div>
              )}

              {isAccepted && (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mx-auto animate-pulse">
                    {isPickup ? '🛍️' : '🛵'}
                  </div>
                  <h2 className="text-lg font-black text-green-600">
                    {isPickup ? '¡Pedido Listo en el Puesto!' : '¡Carrito en Camino!'}
                  </h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    <span className="text-gray-800 font-extrabold">{activeOrder.vendor_name}</span> {isPickup ? 'ya empacó tu pedido y te espera en el puesto.' : 'aceptó tu pedido y se dirige hacia tu ubicación.'}
                  </p>

                  {isPickup && activeOrder.vendor_lat && (
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.vendor_lat},${activeOrder.vendor_lng}`, '_blank')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-2xl shadow-sm text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Navigation size={14} /> Abrir Ruta en Google Maps
                    </button>
                  )}
                </div>
              )}

              {isCompleted && (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mx-auto">
                    🎉
                  </div>
                  <h2 className="text-lg font-black text-green-600">¡Pedido Completado!</h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    ¡Gracias por elegir Frita Mejor! Disfruta tu frito calientico.
                  </p>
                  <button
                    onClick={handleResetOrder}
                    className="bg-[#FF4040] hover:bg-red-600 text-white font-black py-3 px-8 rounded-full shadow-md active:scale-95 transition-all text-xs w-full"
                  >
                    HACER OTRO PEDIDO
                  </button>
                </div>
              )}

              {isRejected && (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl mx-auto">
                    😢
                  </div>
                  <h2 className="text-lg font-black text-red-600">Pedido Cancelado</h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    El vendedor no pudo tomar la orden en este momento. Intenta con otro carrito cercano.
                  </p>
                  <button
                    onClick={handleResetOrder}
                    className="bg-gray-900 text-white font-black py-3 px-8 rounded-full shadow-md active:scale-95 transition-all text-xs w-full"
                  >
                    REINTENTAR
                  </button>
                </div>
              )}
            </div>

            {/* Resumen del pedido */}
            <div className="bg-white rounded-[32px] p-5 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Resumen de Tu Compra</h3>
              <div className="divide-y divide-gray-100">
                {(activeOrder.items || []).map((item: any, i: number) => (
                  <div key={i} className="py-2 flex items-center justify-between font-bold text-xs text-gray-700">
                    <span>{item.name} <span className="text-gray-400">× {item.qty}</span></span>
                    <span className="font-black text-gray-900">{formatMoney(item.price * item.qty)}</span>
                  </div>
                ))}
                <div className="pt-3 mt-1 flex items-center justify-between text-sm font-black text-gray-900">
                  <span>Total</span>
                  <span className="text-[#FF4040] text-base">{formatMoney(activeOrder.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA DE TIENDA Y MAPA PARA NUEVOS PEDIDOS ---
  return (
    <div className="min-h-screen bg-[#FFD56B] flex flex-col font-sans pb-24">
      {/* HEADER DE MUNICIPO / SEDE */}
      <header className="bg-white rounded-b-[32px] px-6 py-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-1.5 leading-none">
            🛵 frita mejor <span className="text-[#FF4040]">móvil</span>
          </h1>
          <p className="text-[10px] font-bold text-gray-400 mt-1">Empanadas calienticas cerca de ti</p>
        </div>

        {/* Selector de Sede / Municipio */}
        <div className="flex items-center gap-2">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-gray-100 border border-gray-200 text-gray-800 text-xs font-black rounded-xl px-3 py-2 outline-none focus:ring-2 ring-amber-400"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                📍 {b.name} ({b.settings?.address || 'Municipio'})
              </option>
            ))}
          </select>

          <button
            onClick={() => setTriggerGeolocation(true)}
            className="w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 flex items-center justify-center text-amber-500 border border-amber-200 transition-all active:scale-95 shadow-sm"
            title="Centrar en mi ubicación GPS"
          >
            📍
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-3 sm:p-6 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: MAPA CON GEOFENCE */}
        <div className="w-full lg:w-3/5 lg:sticky lg:top-6 flex flex-col gap-4">
          <div className="bg-white rounded-[32px] overflow-hidden shadow-sm h-[260px] lg:h-[calc(100vh-180px)] min-h-[300px] lg:min-h-[500px] border-2 border-white relative">
            <MapContainer
              center={clientPos}
              zoom={DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%', zIndex: 1 }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapController 
                onLocationChange={(lat, lng) => setClientPos([lat, lng])} 
                triggerGeolocation={triggerGeolocation}
                setTriggerGeolocation={setTriggerGeolocation}
                centerPos={clientPos}
              />

              {/* Dibujar Geocercas de Cobertura por Sede */}
              {geofences.map(geo => (
                <Polygon 
                  key={geo.id} 
                  positions={geo.coordinates} 
                  pathOptions={{
                    fillColor: '#FFB700',
                    fillOpacity: 0.2,
                    color: '#FFB700',
                    weight: 3,
                    dashArray: '6, 8'
                  }} 
                />
              ))}

              {/* Pin del Cliente */}
              <Marker position={clientPos} icon={clientIcon} />

              {/* Vendedores Cercanos */}
              {vendorsInProximity.map(v => (
                <Marker
                  key={v.vendor_id}
                  position={[v.lat, v.lng]}
                  icon={createVendorIcon(v.vendor_name, selectedVendorId === v.vendor_id, v.vehicle_type === 'Local')}
                  eventHandlers={{
                    click: () => setSelectedVendorId(v.vendor_id)
                  }}
                />
              ))}
            </MapContainer>

            {/* Indicador de Cobertura Flotante */}
            <div className={`absolute bottom-3 left-3 right-3 py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-between shadow-md border z-[1000] backdrop-blur ${
              isInsideCoverage 
                ? 'bg-green-50/95 border-green-200 text-green-700' 
                : 'bg-amber-50/95 border-amber-300 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                {isInsideCoverage ? (
                  <>
                    <Check size={16} className="text-green-500 stroke-[3px]" />
                    <span>Zona de Domicilios Disponible en {currentBranch.name}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={16} className="text-amber-600" />
                    <span>Fuera de Cobertura a Domicilio. Solo opción Recoger.</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ELEGIR MODALIDAD, CARRITO Y MENÚ */}
        <div className="w-full lg:w-2/5 flex flex-col gap-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto pr-1 shrink-0">
          
          {/* SELECTOR DE MODALIDAD (2 BOTONES GIGANTES) */}
          <div className="bg-white rounded-[32px] p-4 shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">¿Cómo deseas recibir tu pedido?</h3>
            
            <div className="grid grid-cols-2 gap-2.5">
              {/* Botón Delivery: Vengan a mí */}
              <button
                type="button"
                onClick={() => {
                  if (!isInsideCoverage) {
                    toast.error('Tu ubicación actual está fuera del perímetro de entrega a domicilio.');
                    return;
                  }
                  setDeliveryMode('delivery');
                }}
                className={`p-3.5 rounded-2xl font-black text-xs flex flex-col items-center text-center gap-1.5 transition-all border-2 active:scale-95 ${
                  deliveryMode === 'delivery'
                    ? 'bg-[#FF4040] text-white border-[#FF4040] shadow-md'
                    : !isInsideCoverage
                    ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed'
                    : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <span className="text-2xl">🛵</span>
                <span>Que el Carrito Venga a Mí</span>
                <span className="text-[9px] font-bold opacity-80">Delivery en tu ubicación</span>
              </button>

              {/* Botón Pickup: Voy al Puesto */}
              <button
                type="button"
                onClick={() => setDeliveryMode('pickup')}
                className={`p-3.5 rounded-2xl font-black text-xs flex flex-col items-center text-center gap-1.5 transition-all border-2 active:scale-95 ${
                  deliveryMode === 'pickup'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <span className="text-2xl">📍</span>
                <span>Voy a Recoger al Puesto</span>
                <span className="text-[9px] font-bold opacity-80">Paso a recoger en puesto</span>
              </button>
            </div>
          </div>

          {/* MENSAJE SI NO HAY TRICICLOS CERCANOS */}
          {vendorsInProximity.length === 0 && (
            <div className="bg-white rounded-[32px] p-6 text-center flex flex-col items-center gap-3 shadow-sm">
              <span className="text-4xl">🛵💨</span>
              <h2 className="text-lg font-black text-gray-800">Sin carritos activos en {currentBranch.name}</h2>
              <p className="text-xs font-bold text-gray-400 leading-snug">
                En este momento no hay carritos ni triciclos transmitiendo señal en este municipio. Prueba cambiando de sede o vuelve a intentar en unos minutos.
              </p>
            </div>
          )}

          {/* LISTA DE PUESTOS / TRICICLOS DISPONIBLES */}
          {vendorsInProximity.length > 0 && (
            <div className="bg-white rounded-[32px] p-4 shadow-sm flex flex-col gap-2.5">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                {deliveryMode === 'delivery' ? 'Carritos Cercanos a ti' : 'Puestos Fijos para Recoger'}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
                {vendorsInProximity.map(v => {
                  const isSelected = selectedVendorId === v.vendor_id;
                  return (
                    <button
                      key={v.vendor_id}
                      onClick={() => setSelectedVendorId(v.vendor_id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shrink-0 border-2 ${
                        isSelected 
                          ? 'bg-amber-50 border-[#FFB700] text-gray-900 shadow-sm' 
                          : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-white'
                      }`}
                    >
                      <span>{v.vehicle_type === 'Local' ? '🏪' : '🛵'} {v.vendor_name.split(' ')[0]}</span>
                      <span className="text-[10px] bg-white border border-gray-100 px-1.5 py-0.5 rounded-full font-bold">
                        {formatDistance(v.distance)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MENÚ DE PRODUCTOS DEL CARRITO SELECCIONADO */}
          {selectedVendorId && (
            <div className="bg-white rounded-[32px] p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Menú de {selectedVendor?.vendor_name}</h3>
                <span className="text-[10px] bg-red-50 text-[#FF4040] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} /> Recién Caliente
                </span>
              </div>

              {vendorProducts.length === 0 ? (
                <p className="text-xs font-bold text-gray-400 text-center py-4">Este carrito no tiene stock disponible en este momento.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {vendorProducts.map(p => {
                    const qtyInCart = cart[p.id] || 0;
                    return (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50/70 rounded-2xl p-2.5 border border-gray-100 shadow-sm">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-800 text-sm">{p.name}</span>
                          <span className="text-xs font-bold text-gray-400">
                            {formatMoney(p.price)} · <span className="text-amber-500">{p.stock} dispon.</span>
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {qtyInCart > 0 && (
                            <>
                              <button
                                onClick={() => removeFromCart(String(p.id))}
                                className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 font-black flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors active:scale-90"
                              >
                                -
                              </button>
                              <span className="font-black text-gray-800 text-sm min-w-[16px] text-center">{qtyInCart}</span>
                            </>
                          )}
                          <button
                            onClick={() => addToCart(String(p.id), p.stock)}
                            disabled={qtyInCart >= p.stock}
                            className={`w-8 h-8 rounded-full font-black flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:scale-100 ${
                              qtyInCart > 0 
                                ? 'bg-amber-400 text-white' 
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-amber-400 hover:text-amber-500'
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FORMULARIO DE CHECKOUT */}
          {getCartItemsCount() > 0 && (
            <form onSubmit={handleCheckout} className="bg-white rounded-[32px] p-5 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
                Datos del Cliente ({deliveryMode === 'delivery' ? '🛵 Domicilio' : '📍 Recoger en Puesto'})
              </h3>
              
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={12} className="text-amber-400" /> Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold text-gray-700 outline-none focus:ring-2 ring-amber-400 shadow-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone size={12} className="text-amber-400" /> Teléfono Celular
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej. 3123456789"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold text-gray-700 outline-none focus:ring-2 ring-amber-400 shadow-sm"
                  />
                </div>

                {deliveryMode === 'delivery' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={12} className="text-amber-400" /> Dirección / Indicaciones
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Calle 5 # 4-20 (Frente al parque)"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold text-gray-700 outline-none focus:ring-2 ring-amber-400 shadow-sm"
                    />
                  </div>
                )}
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 flex items-center justify-between border border-amber-200/50 mt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Total a Pagar</span>
                  <span className="text-[10px] font-bold text-gray-400">Pagas en efectivo al entregar</span>
                </div>
                <span className="text-2xl font-black text-gray-900">{formatMoney(getCartTotal())}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full text-white font-black text-base py-4 rounded-[24px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${
                  deliveryMode === 'delivery' ? 'bg-[#FF4040] hover:bg-red-600 shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                }`}
              >
                {isSubmitting ? (
                  <span>Procesando...</span>
                ) : (
                  <>
                    <ShoppingBag size={18} /> {deliveryMode === 'delivery' ? 'Confirmar Pedido a Domicilio' : 'Reservar para Recoger'}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      ` }} />
    </div>
  );
}
