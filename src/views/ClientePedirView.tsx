import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { isPointInPolygon, getHaversineDistance, formatDistance } from '../utils/geoUtils';
import { toast } from 'react-hot-toast';
import { ShoppingBag, MapPin, Phone, User, Check, X, ShieldAlert, Sparkles, Navigation } from 'lucide-react';

const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522]; // Pitalito, Huila
const DEFAULT_ZOOM = 14;

// Custom Icons for Leaflet
const clientIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
    ">
      <div style="
        background: #FF4040; border: 3px solid white;
        border-radius: 50%; width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; animation: bounce 1.5s infinite;
      ">😋</div>
      <div style="
        background: #1f2937; border-radius: 8px; padding: 2px 6px;
        font-size: 10px; font-weight: 900; color: white;
        margin-top: 2px; white-space: nowrap;
      ">Tu Ubicación</div>
    </div>`,
  iconSize: [50, 50],
  iconAnchor: [25, 45],
});

const createVendorIcon = (name: string, isSelected: boolean) => L.divIcon({
  className: '',
  html: `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,0.25));
    ">
      <div style="
        background: ${isSelected ? '#FF4040' : '#FFB700'}; border: 3px solid white;
        border-radius: 50%; width: 44px; height: 44px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; transition: all 0.2s;
      ">🛵</div>
      <div style="
        background: white; border: 2px solid ${isSelected ? '#FF4040' : '#FFB700'};
        border-radius: 10px; padding: 1px 6px;
        font-size: 9px; font-weight: 900; color: #1f2937;
        margin-top: 1px; white-space: nowrap; max-width: 80px; overflow: hidden;
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
}: {
  onLocationChange: (lat: number, lng: number) => void;
  triggerGeolocation: boolean;
  setTriggerGeolocation: (val: boolean) => void;
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

  useMapEvents({
    locationfound(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
      toast.success('¡Ubicación GPS encontrada! 📍');
    },
    locationerror() {
      toast.error('No se pudo acceder a tu GPS. Por favor arrastra el pin manualmente.');
    },
  });

  return null;
}

export function ClientePedirView() {
  // --- Estados de Ubicación y Cobertura ---
  const [clientPos, setClientPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [geofences, setGeofences] = useState<any[]>([]);
  const [isInsideCoverage, setIsInsideCoverage] = useState(false);
  const [triggerGeolocation, setTriggerGeolocation] = useState(true);

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

  // 1. Cargar Geocercas, Vendedores y Catálogo al montar
  useEffect(() => {
    fetchGeofences();
    fetchVendors();
    fetchCatalog();
    
    // Si hay un pedido activo guardado localmente, iniciar monitoreo
    if (activeOrderId && activeOrderToken) {
      monitorOrder();
    }
  }, []);

  // Recalcular cobertura cuando cambie la posición o las geocercas
  useEffect(() => {
    if (geofences.length === 0) return;
    
    let covered = false;
    for (const geo of geofences) {
      if (Array.isArray(geo.coordinates) && isPointInPolygon(clientPos[0], clientPos[1], geo.coordinates)) {
        covered = true;
        break;
      }
    }
    setIsInsideCoverage(covered);
  }, [clientPos, geofences]);

  // Cargar geocercas activas
  const fetchGeofences = async () => {
    const { data } = await supabase.from('geofences').select('*').eq('is_active', true);
    setGeofences(data || []);
  };

  // Cargar vendedores activos y su GPS actual
  const fetchVendors = async () => {
    const { data } = await supabase.from('vendor_locations').select('*').eq('is_active', true);
    setVendors(data || []);
  };

  // Cargar catálogo maestro de productos y existencias de carritos
  const fetchCatalog = async () => {
    const { data: prodData } = await supabase.from('products').select('*');
    const { data: snapData } = await supabase.from('inventory_snapshots').select('*');
    
    setProducts(prodData || []);
    setInventorySnapshots(snapData || []);
  };

  // Buscar pedidos activos o monitorear en tiempo real
  const monitorOrder = async () => {
    if (!activeOrderId || !activeOrderToken) return;

    // Consultar estado actual
    const { data, error } = await supabase.rpc('get_active_delivery_request', {
      p_order_id: activeOrderId,
      p_client_token: activeOrderToken
    });

    if (error || !data || data.length === 0) {
      // Si dio error o no se encuentra, limpiar
      localStorage.removeItem('fm_active_order_id');
      localStorage.removeItem('fm_active_order_token');
      setActiveOrderId(null);
      setActiveOrderToken(null);
      setActiveOrder(null);
      return;
    }

    const orderData = data[0];
    setActiveOrder(orderData);

    // Si está completado o rechazado, parar el realtime después de unos segundos
    if (orderData.status === 'completed' || orderData.status === 'rejected') {
      return;
    }

    // Suscribirse a cambios en la base de datos para esta fila específica
    const channel = supabase.channel(`order-track-${activeOrderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_requests',
        filter: `id=eq.${activeOrderId}`
      }, async () => {
        // Al haber actualización de la fila, re-consultar con RPC para jalar coordenadas del vendedor
        const { data: updated } = await supabase.rpc('get_active_delivery_request', {
          p_order_id: activeOrderId,
          p_client_token: activeOrderToken
        });
        if (updated && updated.length > 0) {
          setActiveOrder(updated[0]);
        }
      })
      .subscribe();

    // Polling de seguridad cada 10 segundos para actualizar GPS del vendedor
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
    }, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  };

  // Filtrar vendedores activos que están dentro de un radio de 3 km de la posición del cliente
  const vendorsInProximity = vendors.map(v => {
    const distance = getHaversineDistance(clientPos[0], clientPos[1], v.lat, v.lng);
    return { ...v, distance };
  }).filter(v => v.distance <= 3.0).sort((a, b) => a.distance - b.distance);

  // Auto-seleccionar primer vendedor de la lista si cambia la posición y el actual ya no está o no hay ninguno
  useEffect(() => {
    if (vendorsInProximity.length > 0) {
      if (!selectedVendorId || !vendorsInProximity.some(v => v.vendor_id === selectedVendorId)) {
        setSelectedVendorId(vendorsInProximity[0].vendor_id);
      }
    } else {
      setSelectedVendorId(null);
    }
  }, [clientPos, vendors]);

  // Obtener los productos que tiene cargados el vendedor seleccionado
  const selectedVendorPointId = vendors.find(v => v.vendor_id === selectedVendorId)?.point_id;
  const vendorInventory = inventorySnapshots.filter(snap => snap.point_id === selectedVendorPointId && snap.quantity > 0);
  const vendorProducts = vendorInventory.map(snap => {
    const prod = products.find(p => p.id === snap.product_id);
    return prod ? { ...prod, stock: snap.quantity } : null;
  }).filter(Boolean) as any[];

  // Manejar el carrito
  const addToCart = (productId: string, stock: number) => {
    const current = cart[productId] || 0;
    if (current >= stock) {
      toast.error('¡Límite de stock disponible alcanzado!');
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

  // Enviar Pedido a la Base de Datos
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
      toast.error('Selecciona un repartidor disponible.');
      return;
    }

    setIsSubmitting(true);
    const token = crypto.randomUUID ? crypto.randomUUID() : 'c-' + Math.random().toString(36).substring(2, 15);

    // Mapear items
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
      client_address: address.trim() || null,
      client_lat: clientPos[0],
      client_lng: clientPos[1],
      items: itemsPayload,
      total_amount: getCartTotal(),
      status: 'pending',
      assigned_vendor_id: selectedVendorId,
      client_token: token
    };

    try {
      const { data, error } = await supabase.from('delivery_requests').insert(newOrder).select('id').single();
      
      if (error) {
        throw new Error(error.message);
      }

      toast.success('¡Pedido enviado exitosamente! 🛵💨');
      localStorage.setItem('fm_active_order_id', data.id);
      localStorage.setItem('fm_active_order_token', token);
      setActiveOrderId(data.id);
      setActiveOrderToken(token);
      setCart({});
      
      // Activar monitoreo en vivo
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

  // Cancelar/Reiniciar vista al terminar
  const handleResetOrder = () => {
    localStorage.removeItem('fm_active_order_id');
    localStorage.removeItem('fm_active_order_token');
    setActiveOrderId(null);
    setActiveOrderToken(null);
    setActiveOrder(null);
    setCart({});
  };

  // Formatear pesos
  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  };

  // --- VISTA DE SEGUIMIENTO EN VIVO (CLIENTE TIENE PEDIDO ACTIVO) ---
  if (activeOrder) {
    const isPending = activeOrder.status === 'pending';
    const isAccepted = activeOrder.status === 'accepted';
    const isCompleted = activeOrder.status === 'completed';
    const isRejected = activeOrder.status === 'rejected';

    return (
      <div className="min-h-screen bg-[#FFD56B] flex flex-col font-sans">
        <header className="bg-white rounded-b-[32px] px-6 py-5 shadow-sm text-center">
          <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center justify-center gap-1.5">
            🛵 frita mejor <span className="text-[#FF4040]">pedidos</span>
          </h1>
          <p className="text-xs font-bold text-gray-400 mt-0.5">Seguimiento en Vivo de tu Frito Caliente</p>
        </header>

        <div className="flex-1 p-4 flex flex-col gap-4 max-w-lg mx-auto w-full">
          {/* Tarjeta de Estado */}
          <div className="bg-white rounded-[32px] p-5 shadow-sm flex flex-col items-center text-center gap-3">
            {isPending && (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-3xl animate-bounce">
                  🔔
                </div>
                <h2 className="text-lg font-black text-gray-900">Esperando Confirmación</h2>
                <p className="text-sm font-bold text-gray-500 leading-snug">
                  Tu pedido ha sido enviado a <span className="text-amber-500 font-extrabold">{activeOrder.vendor_name || 'repartidores cercanos'}</span>. 
                  Por favor mantén esta pantalla abierta. ¡Te avisaremos cuando lo acepten!
                </p>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-[#FFB700] h-full rounded-full animate-[pulse_1.5s_infinite]" style={{ width: '65%' }}></div>
                </div>
              </>
            )}

            {isAccepted && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl animate-pulse">
                  🛵
                </div>
                <h2 className="text-lg font-black text-green-600">¡Pedido Aceptado!</h2>
                <p className="text-sm font-bold text-gray-500 leading-snug">
                  <span className="text-gray-800 font-extrabold">{activeOrder.vendor_name}</span> aceptó tu pedido y se dirige hacia ti. 
                  ¡Sigue su ubicación en el mapa de abajo!
                </p>
              </>
            )}

            {isCompleted && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
                  🎉
                </div>
                <h2 className="text-lg font-black text-green-600">¡Pedido Entregado!</h2>
                <p className="text-sm font-bold text-gray-500 leading-snug">
                  ¡Qué disfrutes tu frito calientico! Gracias por comprar en Frita Mejor.
                </p>
                <button
                  onClick={handleResetOrder}
                  className="mt-2 bg-[#FF4040] hover:bg-red-600 text-white font-black py-3 px-8 rounded-full shadow-md active:scale-95 transition-all text-sm w-full"
                >
                  VOLVER A PEDIR
                </button>
              </>
            )}

            {isRejected && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl">
                  😢
                </div>
                <h2 className="text-lg font-black text-red-600">Pedido Rechazado</h2>
                <p className="text-sm font-bold text-gray-500 leading-snug">
                  Lo sentimos, el repartidor no pudo tomar tu pedido en este momento. Por favor reintenta en unos minutos.
                </p>
                <button
                  onClick={handleResetOrder}
                  className="mt-2 bg-gray-900 text-white font-black py-3 px-8 rounded-full shadow-md active:scale-95 transition-all text-sm w-full"
                >
                  REINTENTAR PEDIDO
                </button>
              </>
            )}
          </div>

          {/* Mapa de Seguimiento (Solo si está pendiente o aceptado) */}
          {(isPending || isAccepted) && (
            <div className="bg-white rounded-[32px] overflow-hidden shadow-sm h-[300px] border-2 border-white relative">
              <MapContainer
                center={[activeOrder.client_lat, activeOrder.client_lng]}
                zoom={15}
                style={{ width: '100%', height: '100%', zIndex: 1 }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Pin del Cliente */}
                <Marker position={[activeOrder.client_lat, activeOrder.client_lng]} icon={clientIcon} />

                {/* Pin del Vendedor (si hay asignado y tenemos sus coordenadas) */}
                {isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng && (
                  <Marker 
                    position={[activeOrder.vendor_lat, activeOrder.vendor_lng]} 
                    icon={createVendorIcon(activeOrder.vendor_name || 'Vendedor', true)} 
                  />
                )}
              </MapContainer>

              {/* Distancia flotante */}
              {isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng && (
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur shadow-md rounded-2xl px-4 py-2 text-xs font-black text-gray-800 z-[1000] border border-gray-100 flex items-center gap-1.5 animate-pulse">
                  <Navigation size={12} className="text-green-500 fill-green-500 rotate-45" />
                  Repartidor a {formatDistance(getHaversineDistance(activeOrder.client_lat, activeOrder.client_lng, activeOrder.vendor_lat, activeOrder.vendor_lng))}
                </div>
              )}
            </div>
          )}

          {/* Resumen del pedido */}
          <div className="bg-white rounded-[32px] p-5 shadow-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Detalle del Pedido</h3>
            <div className="divide-y divide-gray-100">
              {(activeOrder.items || []).map((item: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between font-bold text-sm text-gray-700">
                  <span>{item.name} <span className="text-gray-400">× {item.qty}</span></span>
                  <span className="font-black text-gray-900">{formatMoney(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="pt-3 mt-1 flex items-center justify-between text-base font-black text-gray-900">
                <span>Total</span>
                <span className="text-[#FF4040] text-lg">{formatMoney(activeOrder.total_amount)}</span>
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
      {/* HEADER */}
      <header className="bg-white rounded-b-[32px] px-6 py-5 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-1.5 leading-none">
            🛵 frita mejor <span className="text-[#FF4040]">móvil</span>
          </h1>
          <p className="text-[10px] font-bold text-gray-400 mt-1">Pide tu frito calientico a domicilio</p>
        </div>
        <button
          onClick={() => setTriggerGeolocation(true)}
          className="w-10 h-10 rounded-full bg-amber-50 hover:bg-amber-100 flex items-center justify-center text-amber-500 border border-amber-200 transition-all active:scale-95 shadow-sm"
          title="Centrar en mi ubicación GPS"
        >
          📍
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-3 sm:p-5 flex flex-col gap-4 max-w-lg mx-auto w-full">
        
        {/* MAPA Y GEOFENCE WARNING */}
        <div className="bg-white rounded-[32px] overflow-hidden shadow-sm h-[260px] border-2 border-white relative">
          <MapContainer
            center={clientPos}
            zoom={DEFAULT_ZOOM}
            style={{ width: '100%', height: '100%', zIndex: 1 }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapController 
              onLocationChange={(lat, lng) => setClientPos([lat, lng])} 
              triggerGeolocation={triggerGeolocation}
              setTriggerGeolocation={setTriggerGeolocation}
            />

            {/* Dibujar Geocercas */}
            {geofences.map(geo => (
              <Polygon 
                key={geo.id} 
                positions={geo.coordinates} 
                pathOptions={{
                  fillColor: '#FFB700',
                  fillOpacity: 0.25,
                  color: '#FFB700',
                  weight: 3,
                  dashArray: '5, 8'
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
                icon={createVendorIcon(v.vendor_name, selectedVendorId === v.vendor_id)}
                eventHandlers={{
                  click: () => setSelectedVendorId(v.vendor_id)
                }}
              />
            ))}
          </MapContainer>

          {/* Indicador de Geocerca Flotante */}
          <div className={`absolute bottom-3 left-3 right-3 py-2.5 px-4 rounded-2xl text-xs font-black flex items-center gap-2 shadow-md border z-[1000] backdrop-blur ${
            isInsideCoverage 
              ? 'bg-green-50/95 border-green-200 text-green-700' 
              : 'bg-red-50/95 border-red-200 text-red-700 animate-bounce'
          }`}>
            {isInsideCoverage ? (
              <>
                <Check size={14} className="text-green-500 stroke-[3px]" />
                Zona de entrega disponible
              </>
            ) : (
              <>
                <ShieldAlert size={14} className="text-red-500 fill-red-50" />
                Fuera de cobertura. Arrastra tu pin.
              </>
            )}
          </div>
        </div>

        {/* SI NO HAY COBERTURA: MENSAJE AMIGABLE */}
        {!isInsideCoverage && (
          <div className="bg-white rounded-[32px] p-6 text-center flex flex-col items-center gap-3 shadow-sm">
            <span className="text-4xl">🤷‍♂️</span>
            <h2 className="text-lg font-black text-gray-800">¡Sin cobertura en tu zona!</h2>
            <p className="text-sm font-bold text-gray-400 leading-snug">
              Actualmente no tenemos carritos prestando servicio en tu ubicación. 
              Por favor toca el mapa o arrastra el pin dentro de un área con cobertura (amarilla) para ordenar.
            </p>
          </div>
        )}

        {/* SI TIENE COBERTURA PERO NO HAY TRICICLOS CERCANOS */}
        {isInsideCoverage && vendorsInProximity.length === 0 && (
          <div className="bg-white rounded-[32px] p-6 text-center flex flex-col items-center gap-3 shadow-sm">
            <span className="text-4xl">🛵💨</span>
            <h2 className="text-lg font-black text-gray-800">Sin carritos de fritos cerca</h2>
            <p className="text-sm font-bold text-gray-400 leading-snug">
              ¡Estás dentro de nuestra zona de servicio! Sin embargo, en este momento no hay triciclos móviles en un radio de 3 km. 
              Por favor vuelve a intentar en unos minutos.
            </p>
          </div>
        )}

        {/* SELECCIONAR REPARTIDOR MÓVIL */}
        {isInsideCoverage && vendorsInProximity.length > 0 && (
          <div className="bg-white rounded-[32px] p-4 shadow-sm flex flex-col gap-2.5">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Triciclos Cercanos</h3>
            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
              {vendorsInProximity.map(v => {
                const isSelected = selectedVendorId === v.vendor_id;
                return (
                  <button
                    key={v.vendor_id}
                    onClick={() => setSelectedVendorId(v.vendor_id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 shrink-0 border-2 ${
                      isSelected 
                        ? 'bg-amber-50 border-[#FFB700] text-gray-900 shadow-sm' 
                        : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-white'
                    }`}
                  >
                    <span>🛵 {v.vendor_name.split(' ')[0]}</span>
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
        {isInsideCoverage && selectedVendorId && (
          <div className="bg-white rounded-[32px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Menú Disponible</h3>
              <span className="text-[10px] bg-red-50 text-[#FF4040] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} /> Recién Frito
              </span>
            </div>

            {vendorProducts.length === 0 ? (
              <p className="text-sm font-bold text-gray-400 text-center py-4">Este carrito no tiene stock disponible en este momento.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {vendorProducts.map(p => {
                  const qtyInCart = cart[p.id] || 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50/70 rounded-2xl p-2.5 border border-gray-100 shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-800 text-sm">{p.name}</span>
                        <span className="text-xs font-bold text-gray-400">
                          {formatMoney(p.price)} · <span className="text-amber-500">{p.stock} disponibles</span>
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

        {/* FORMULARIO DE ENVÍO */}
        {isInsideCoverage && getCartItemsCount() > 0 && (
          <form onSubmit={handleCheckout} className="bg-white rounded-[32px] p-5 shadow-sm flex flex-col gap-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Información de Entrega</h3>
            
            <div className="space-y-3">
              {/* Nombre */}
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
                  className="bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-amber-400 transition-all shadow-sm"
                />
              </div>

              {/* Teléfono */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={12} className="text-amber-400" /> Teléfono Móvil
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ej. 3123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-amber-400 transition-all shadow-sm"
                />
              </div>

              {/* Dirección */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={12} className="text-amber-400" /> Dirección / Indicaciones
                </label>
                <input
                  type="text"
                  placeholder="Ej. Calle 5 # 4-20 (Frente al parque)"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 ring-amber-400 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Total Resumen */}
            <div className="bg-amber-50 rounded-2xl p-4 flex items-center justify-between border border-amber-200/50 mt-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Total a Pagar</span>
                <span className="text-[10px] font-bold text-gray-400">Paga en efectivo al recibir</span>
              </div>
              <span className="text-2xl font-black text-gray-900">{formatMoney(getCartTotal())}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#FF4040] text-white font-black text-lg py-4 rounded-[24px] shadow-[0_12px_24px_-8px_rgba(255,64,64,0.5)] transition-all active:scale-95 flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50 disabled:scale-100"
            >
              {isSubmitting ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <ShoppingBag size={18} /> Pedir Ahora
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* CSS animaciones */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
