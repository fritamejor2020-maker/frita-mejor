import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { isPointInPolygon, getHaversineDistance, formatDistance } from '../utils/geoUtils';
import { useBranchStore } from '../store/useBranchStore';
import { toast } from 'react-hot-toast';
import { 
  ShoppingBag, MapPin, Phone, User, Check, X, ShieldAlert, Sparkles, Navigation, 
  Clock, MessageCircle, ArrowRight, Store, Search, Filter, ChevronRight, RefreshCw, Zap
} from 'lucide-react';

const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522]; // Pitalito, Huila por defecto
const DEFAULT_ZOOM = 15;

// Iconos Leaflet
const clientIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    ">
      <div style="
        background: #FF4040; border: 3px solid white;
        border-radius: 50%; width: 44px; height: 44px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; animation: bounce 1.5s infinite;
      ">😋</div>
      <div style="
        background: #1f2937; border-radius: 8px; padding: 2px 8px;
        font-size: 10px; font-weight: 900; color: white;
        margin-top: 2px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
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
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
    ">
      <div style="
        background: ${isSelected ? '#FF4040' : (isStationary ? '#3b82f6' : '#FFB700')}; 
        border: 3px solid white;
        border-radius: 50%; width: 46px; height: 46px;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; transition: all 0.2s;
      ">${isStationary ? '🏪' : '🛵'}</div>
      <div style="
        background: white; border: 2px solid ${isSelected ? '#FF4040' : (isStationary ? '#3b82f6' : '#FFB700')};
        border-radius: 10px; padding: 2px 8px;
        font-size: 9px; font-weight: 900; color: #1f2937;
        margin-top: 2px; white-space: nowrap; max-width: 100px; overflow: hidden;
      ">${name}</div>
    </div>`,
  iconSize: [60, 60],
  iconAnchor: [30, 44],
});

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
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const map = useMapEvents({
    click(e) {
      onLocationChangeRef.current(e.latlng.lat, e.latlng.lng);
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
      onLocationChangeRef.current(e.latlng.lat, e.latlng.lng);
    },
    locationerror() {
      toast.error('No se pudo acceder a tu GPS. Puedes tocar en el mapa para ubicarte.');
    },
  });

  return null;
}

export function ClientePedirView() {
  const { branches } = useBranchStore();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'BRANCH-001');
  const currentBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

  // --- Ubicación y Geocercas ---
  const [clientPos, setClientPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [geofences, setGeofences] = useState<any[]>([]);
  const [isInsideCoverage, setIsInsideCoverage] = useState(true);
  const [triggerGeolocation, setTriggerGeolocation] = useState(true);

  // --- Pasos del Flujo Uber ---
  // Step 'MAP': Ver mapa interactivo Uber con carritos alrededor + Botón grande PEDIR
  // Step 'MENU': Ver catálogo de productos disponibles en los triciclos
  // Step 'CHECKOUT': Elegir si el carrito va o el cliente va + formulario
  const [uiStep, setUiStep] = useState<'MAP' | 'MENU' | 'CHECKOUT'>('MAP');

  // --- Modalidad & Carrito ---
  const [deliveryMode, setDeliveryMode] = useState<'delivery' | 'pickup'>('delivery');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');

  // --- Catálogo y Stock Consolidado ---
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventorySnapshots, setInventorySnapshots] = useState<any[]>([]);
  const [posSettings, setPosSettings] = useState<any>(null);

  // --- Formulario Checkout ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Tracking y Dispatch Uber ---
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => localStorage.getItem('fm_active_order_id'));
  const [activeOrderToken, setActiveOrderToken] = useState<string | null>(() => localStorage.getItem('fm_active_order_token'));
  const [activeOrder, setActiveOrder] = useState<any>(null);

  // Refs para prevenir clausuras obsoletas en callbacks asíncronos y eventos de Leaflet
  const branchesRef = useRef(branches);
  const selectedBranchIdRef = useRef(selectedBranchId);

  useEffect(() => {
    branchesRef.current = branches;
  }, [branches]);

  useEffect(() => {
    selectedBranchIdRef.current = selectedBranchId;
  }, [selectedBranchId]);

  // Auto-seleccionar la sede más cercana cuando la ubicación del cliente cambia por GPS
  const handleLocationUpdate = (lat: number, lng: number) => {
    setClientPos([lat, lng]);

    const currentBranches = branchesRef.current;
    const currentSelectedId = selectedBranchIdRef.current;

    if (currentBranches && currentBranches.length > 0) {
      let nearestBranch: any = null;
      let minDistance = Infinity;

      currentBranches.forEach(b => {
        const bLat = Number(b.settings?.lat);
        const bLng = Number(b.settings?.lng);
        if (!isNaN(bLat) && !isNaN(bLng) && bLat !== 0 && bLng !== 0) {
          const dist = getHaversineDistance(lat, lng, bLat, bLng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestBranch = b;
          }
        }
      });

      if (nearestBranch && nearestBranch.id !== currentSelectedId) {
        setSelectedBranchId(nearestBranch.id);
        toast.success(`📍 Sede asignada por tu GPS: ${nearestBranch.name}`);
      }
    }
  };

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
    const selected = branches.find(b => b.id === branchId);
    if (selected && selected.settings?.lat && selected.settings?.lng) {
      setClientPos([selected.settings.lat, selected.settings.lng]);
    }
  };

  // Re-evaluar la sede más cercana a clientPos de manera reactiva cada vez que branches se cargue/actualice
  useEffect(() => {
    if (branches && branches.length > 0) {
      let nearestBranch: any = null;
      let minDistance = Infinity;

      branches.forEach(b => {
        const bLat = Number(b.settings?.lat);
        const bLng = Number(b.settings?.lng);
        if (!isNaN(bLat) && !isNaN(bLng) && bLat !== 0 && bLng !== 0) {
          const dist = getHaversineDistance(clientPos[0], clientPos[1], bLat, bLng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestBranch = b;
          }
        }
      });

      if (nearestBranch && nearestBranch.id !== selectedBranchId) {
        setSelectedBranchId(nearestBranch.id);
        toast.success(`📍 Sede asignada por cercanía: ${nearestBranch.name}`);
      }
    }
  }, [branches]);

  // GPS Inicial al cargar (ejecuta solo una vez al montar)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleLocationUpdate(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('GPS inicial no disponible:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Cargar datos al cambiar de sede
  useEffect(() => {
    fetchGeofences();
    fetchVendors();
    fetchCatalog();
    
    if (activeOrderId && activeOrderToken) {
      monitorOrder();
    }
  }, [selectedBranchId]);

  // Recalcular cobertura de Geocercas
  useEffect(() => {
    if (geofences.length === 0) {
      setIsInsideCoverage(true);
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
    try {
      const { data: stateData } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', `inventory_${selectedBranchId}`)
        .maybeSingle();

      let items = stateData?.value || [];
      if (!items || items.length === 0) {
        const { data: globalData } = await supabase
          .from('app_state')
          .select('value')
          .eq('key', 'inventory')
          .maybeSingle();
        items = globalData?.value || [];
      }

      const { data: settingsData } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', 'posSettings')
        .maybeSingle();
      if (settingsData?.value) {
        setPosSettings(settingsData.value);
      }

      const saleItems = (items || []).filter(
        (i: any) => ['FRITO', 'PRODUCTO', 'CRUDO', 'BEBIDA'].includes(i.type || i.tipo) && i.inTricycles !== false
      );

      const mappedProducts = saleItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.posCategoryId || 'Fritos',
        description: item.description || 'Recién preparado',
        image_url: item.imageUrl || null,
        stock: item.qty || 0
      }));

      setProducts(mappedProducts);
      setInventorySnapshots([]);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    }
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
    }, 6000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  };

  // Carritos activos ordenados por cercanía GPS
  const activeVendorsAround = vendors.map(v => {
    const distance = getHaversineDistance(clientPos[0], clientPos[1], v.lat, v.lng);
    return { ...v, distance };
  }).filter(v => v.distance <= 6.0).sort((a, b) => a.distance - b.distance);

  // Stock disponible consolidado de los carritos del municipio
  const availableProducts = products.map(prod => {
    const strictStock = posSettings?.inventoryControl?.strictTricycleStock ?? false;
    const totalStock = prod.stock || 0;
    return {
      ...prod,
      stock: strictStock ? totalStock : (totalStock > 0 ? totalStock : 10)
    };
  });

  // Categorías dinámicas adaptadas exactamente a los productos de los triciclos
  const dynamicCategories = useMemo(() => {
    const catsSet = new Set<string>();
    availableProducts.forEach(p => {
      if (p.category && p.category.trim()) {
        catsSet.add(p.category.trim());
      }
    });
    const list = Array.from(catsSet).sort();
    return ['TODOS', ...list];
  }, [availableProducts]);

  // Filtrar productos
  const filteredProducts = availableProducts.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedCategory === 'TODOS') return matchesSearch;
    return matchesSearch && (prod.category || '').trim().toUpperCase() === selectedCategory.toUpperCase();
  });

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
      const prod = products.find(p => String(p.id) === String(pId));
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  };

  const getCartItemsCount = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getCartItemsCount() === 0) {
      toast.error('Selecciona al menos un producto antes de continuar.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error('Ingresa tu nombre y teléfono celular.');
      return;
    }
    if (!phone.match(/^[0-9]{7,15}$/)) {
      toast.error('El celular debe contener entre 7 y 15 dígitos.');
      return;
    }

    const targetVendor = activeVendorsAround[0];
    if (!targetVendor) {
      toast.error('No hay carritos activos disponibles cerca en este momento.');
      return;
    }

    setIsSubmitting(true);
    const token = crypto.randomUUID ? crypto.randomUUID() : 'c-' + Math.random().toString(36).substring(2, 15);

    const itemsPayload = Object.entries(cart).map(([pId, qty]) => {
      const prod = products.find(p => String(p.id) === String(pId));
      return {
        productId: pId,
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
      assigned_vendor_id: targetVendor.vendor_id,
      client_token: token,
      delivery_mode: deliveryMode,
      branch_id: selectedBranchId,
      rejected_vendor_ids: [],
    };

    try {
      const { data, error } = await supabase.from('delivery_requests').insert(newOrder).select('id').single();
      
      if (error) throw new Error(error.message);

      toast.success(deliveryMode === 'delivery' ? '¡Buscando carrito cercano! 🛵💨' : '¡Reserva enviada al puesto! 📍');
      localStorage.setItem('fm_active_order_id', data.id);
      localStorage.setItem('fm_active_order_token', token);
      setActiveOrderId(data.id);
      setActiveOrderToken(token);
      setUiStep('MAP');
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
    setUiStep('MAP');
  };

  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  };

  // --- VISTA DE SEGUIMIENTO Y DISPATCH UBER EN VIVO ---
  if (activeOrder) {
    const isPending = activeOrder.status === 'pending';
    const isAccepted = activeOrder.status === 'accepted';
    const isCompleted = activeOrder.status === 'completed';
    const isRejected = activeOrder.status === 'rejected';
    const isPickup = activeOrder.delivery_mode === 'pickup';

    const distanceKm = (isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng)
      ? getHaversineDistance(activeOrder.client_lat, activeOrder.client_lng, activeOrder.vendor_lat, activeOrder.vendor_lng)
      : null;

    const etaMinutes = distanceKm ? Math.max(2, Math.round((distanceKm / 15) * 60 + 3)) : 5;

    return (
      <div className="min-h-screen bg-[#F6F7FB] flex flex-col font-sans">
        <header className="bg-white px-6 py-4 shadow-sm text-center flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#FF4040] text-white flex items-center justify-center font-black text-lg shadow-sm">
              ⚡
            </div>
            <div className="text-left">
              <h1 className="text-sm font-black text-gray-900 leading-none">
                {isPickup ? 'Recoger en Puesto' : 'Frita Mejor Delivery'}
              </h1>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">Seguimiento en vivo por GPS</p>
            </div>
          </div>
          <button
            onClick={handleResetOrder}
            className="text-xs font-bold text-[#FF4040] hover:underline"
          >
            Nuevo Pedido
          </button>
        </header>

        <div className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
          {(isPending || isAccepted) && (
            <div className="w-full lg:w-3/5 lg:sticky lg:top-6 flex flex-col gap-4">
              <div className="bg-white rounded-[32px] overflow-hidden shadow-md h-[340px] lg:h-[calc(100vh-180px)] lg:min-h-[520px] border border-gray-100 relative">
                <MapContainer
                  center={[activeOrder.client_lat, activeOrder.client_lng]}
                  zoom={15}
                  style={{ width: '100%', height: '100%', zIndex: 1 }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[activeOrder.client_lat, activeOrder.client_lng]} icon={clientIcon} />

                  {isAccepted && activeOrder.vendor_lat && activeOrder.vendor_lng && (
                    <Marker 
                      position={[activeOrder.vendor_lat, activeOrder.vendor_lng]} 
                      icon={createVendorIcon(activeOrder.vendor_name || 'Vendedor', true, isPickup)} 
                    />
                  )}

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
                        opacity: 0.85
                      }}
                    />
                  )}
                </MapContainer>

                {isAccepted && distanceKm !== null && (
                  <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-4 z-[1000] border border-gray-100 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#FF4040] text-white flex items-center justify-center font-black text-xl shadow-md animate-pulse">
                        {isPickup ? '📍' : '🛵'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900">
                          {isPickup ? 'Puesto a' : 'Carrito a'} {formatDistance(distanceKm)}
                        </p>
                        <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <Clock size={13} /> Llegada estimada: ~{etaMinutes} min
                        </p>
                      </div>
                    </div>
                    
                    {activeOrder.vendor_phone && (
                      <a
                        href={`tel:${activeOrder.vendor_phone}`}
                        className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-2xl shadow-md flex items-center gap-1.5 text-xs font-black transition-all active:scale-95"
                      >
                        <Phone size={16} /> Llamar
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`w-full flex flex-col gap-4 ${
            (isPending || isAccepted) 
              ? 'lg:w-2/5 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto pr-1 shrink-0' 
              : 'max-w-lg mx-auto'
          }`}>
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col gap-5 text-center">
              
              {(isPending || isAccepted) && (
                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                  {[
                    { label: 'Buscando', icon: '🔎', done: true },
                    { label: 'Aceptado', icon: '👍', done: isAccepted },
                    { label: isPickup ? 'Listo' : 'En camino', icon: isPickup ? '🛍️' : '🛵', done: isAccepted },
                    { label: 'Entregado', icon: '🎉', done: false },
                  ].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black transition-all ${
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
                <div className="space-y-3 py-2">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mx-auto animate-bounce shadow-sm">
                    🔎
                  </div>
                  <h2 className="text-lg font-black text-gray-900">Buscando Carrito Disponible...</h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    Notificando la orden a <span className="text-[#FF4040] font-black">{activeOrder.vendor_name || 'repartidores cercanos'}</span>. 
                    Si no está disponible, el sistema reasignará automáticamente al siguiente carrito más cercano.
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mt-3">
                    <div className="bg-[#FF4040] h-full rounded-full animate-[pulse_1.2s_infinite]" style={{ width: '75%' }}></div>
                  </div>
                </div>
              )}

              {isAccepted && (
                <div className="space-y-3 py-2">
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mx-auto animate-pulse shadow-sm">
                    {isPickup ? '🛍️' : '🛵'}
                  </div>
                  <h2 className="text-lg font-black text-green-600">
                    {isPickup ? '¡Pedido Listo en Puesto!' : '¡Carrito Aceptó Tu Pedido!'}
                  </h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    <span className="text-gray-900 font-black">{activeOrder.vendor_name}</span> {isPickup ? 'ya empacó tu pedido y te espera en el puesto.' : 'se encuentra en camino hacia tu dirección.'}
                  </p>

                  {isPickup && activeOrder.vendor_lat && (
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.vendor_lat},${activeOrder.vendor_lng}`, '_blank')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 px-4 rounded-2xl shadow-md text-xs flex items-center justify-center gap-2 active:scale-95 transition-all mt-2"
                    >
                      <Navigation size={15} /> Abrir Ruta en Google Maps
                    </button>
                  )}
                </div>
              )}

              {isCompleted && (
                <div className="space-y-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mx-auto shadow-sm">
                    🎉
                  </div>
                  <h2 className="text-lg font-black text-green-600">¡Pedido Entregado!</h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    ¡Gracias por pedir en Frita Mejor! Disfruta tu frito recién hecho.
                  </p>
                  <button
                    onClick={handleResetOrder}
                    className="bg-[#FF4040] hover:bg-red-600 text-white font-black py-3.5 px-8 rounded-2xl shadow-md active:scale-95 transition-all text-xs w-full mt-2"
                  >
                    HACER OTRO PEDIDO
                  </button>
                </div>
              )}

              {isRejected && (
                <div className="space-y-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl mx-auto shadow-sm">
                    😢
                  </div>
                  <h2 className="text-lg font-black text-red-600">Sin Carritos Disponibles</h2>
                  <p className="text-xs font-bold text-gray-500 leading-snug">
                    Ningún carrito en este municipio pudo tomar la orden en este momento. Por favor intenta en unos minutos.
                  </p>
                  <button
                    onClick={handleResetOrder}
                    className="bg-gray-900 hover:bg-black text-white font-black py-3.5 px-8 rounded-2xl shadow-md active:scale-95 transition-all text-xs w-full mt-2"
                  >
                    REINTENTAR PEDIDO
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-100">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Detalle del Pedido</h3>
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

  // --- INTERFAZ PRINCIPAL INTERACTIVA UBER-FIRST ---
  return (
    <div className="fixed inset-0 w-full overflow-hidden bg-gray-900 font-sans select-none" style={{ height: '100dvh' }}>
      
      {/* ── MAPA COMPLETO INTERACTIVO TIPO UBER ── */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={clientPos}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <MapController 
            onLocationChange={(lat, lng) => handleLocationUpdate(lat, lng)} 
            triggerGeolocation={triggerGeolocation} 
            setTriggerGeolocation={setTriggerGeolocation} 
            centerPos={clientPos} 
          />

          {/* Polígonos de Geocercas de la Sede */}
          {geofences.map(geo => (
            <Polygon 
              key={geo.id} 
              positions={geo.coordinates} 
              pathOptions={{ fillColor: '#FFB700', fillOpacity: 0.18, color: '#FFB700', weight: 2 }} 
            />
          ))}

          {/* Marcador del Cliente */}
          <Marker position={clientPos} icon={clientIcon} />

          {/* Marcadores de Carritos y Triciclos en tiempo real alrededor */}
          {activeVendorsAround.map(v => (
            <Marker
              key={v.id}
              position={[v.lat, v.lng]}
              icon={createVendorIcon(v.name || 'Carrito Móvil', false, false)}
            >
              <Popup>
                <div className="p-1 font-sans text-center">
                  <p className="font-black text-xs text-gray-900">🛵 {v.name || 'Carrito Móvil'}</p>
                  <p className="text-[10px] text-gray-500 font-bold">A {formatDistance(v.distance)} de ti</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ── HEADER FLOTANTE TIPO UBER ── */}
      <header className="absolute top-4 left-4 right-4 z-20 max-w-md mx-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#FF4040] text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
              ⚡
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xs font-black text-gray-900 leading-none truncate">
                Frita Mejor Móvil
              </h1>
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchSelect(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-gray-500 outline-none cursor-pointer p-0 m-0 border-none w-full truncate"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    📍 {b.name} ({b.settings?.city || b.settings?.address || 'Municipio'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setTriggerGeolocation(true)}
            className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 text-[#FF4040] border border-red-100 flex items-center justify-center transition-all active:scale-95 shrink-0"
            title="Mi ubicación GPS"
          >
            📍
          </button>
        </div>
      </header>

      {/* ── BADGE SUPERIOR DE CARRITOS DISPONIBLES ── */}
      <div className="absolute top-[88px] left-1/2 -translate-x-1/2 z-20">
        <div className="bg-gray-900/90 text-white backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white/20 text-xs font-black flex items-center gap-2 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
          <span>{activeVendorsAround.length} Carritos activos cerca de ti</span>
        </div>
      </div>

      {/* ── BARRA INFERIOR DE ACCIÓN GIGANTE ESTILO UBER (STEP MAP) ── */}
      {uiStep === 'MAP' && (
        <div className="absolute bottom-6 left-4 right-4 z-20 max-w-md mx-auto animate-slide-up">
          <button
            onClick={() => setUiStep('MENU')}
            className="w-full bg-[#FF4040] hover:bg-red-600 text-white font-black py-4 px-6 rounded-[28px] shadow-2xl flex items-center justify-between transition-all active:scale-95 border-2 border-white/20"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛍️</span>
              <div className="text-left leading-tight">
                <span className="text-base font-black tracking-tight block">PEDIR EMPANADAS Y FRITOS</span>
                <span className="text-[10px] font-bold text-white/80 block">
                  Empanadas recién fritas en tu puerta
                </span>
              </div>
            </div>
            <ArrowRight size={22} className="shrink-0" />
          </button>
        </div>
      )}

      {/* ── MODAL / BOTTOM SHEET DEL CATÁLOGO DE PRODUCTOS (STEP MENU) ── */}
      {uiStep === 'MENU' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setUiStep('MAP')}>
          <div 
            onClick={e => e.stopPropagation()} 
            className="bg-white w-full max-w-lg rounded-t-[36px] sm:rounded-[36px] p-6 max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col gap-4 animate-slide-up"
          >
            {/* Header del Menú */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  🥟 Menú de Fritos en {currentBranch.name}
                </h2>
                <p className="text-[10px] font-bold text-gray-400">Productos disponibles en carritos cercanos</p>
              </div>
              <button 
                onClick={() => setUiStep('MAP')}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar empanadas, papas, bebidas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 ring-[#FF4040]"
              />
            </div>

            {/* Categorías Dinámicas */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {dynamicCategories.map(cat => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl font-black text-[11px] transition-all shrink-0 border ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {cat === 'TODOS' ? '🔥 Todas' : `🍽️ ${cat}`}
                  </button>
                );
              })}
            </div>

            {/* Lista Vertical de Productos con Fotos */}
            <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
              {filteredProducts.map(prod => {
                const qtyInCart = cart[prod.id] || 0;
                return (
                  <div key={prod.id} className="bg-gray-50 rounded-2xl p-3 border border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {prod.image_url ? (
                          <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🥟</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-xs">{prod.name}</h3>
                        <p className="text-[10px] text-gray-400 font-medium line-clamp-1">{prod.description || 'Frito recién hecho'}</p>
                        <p className="text-xs font-black text-[#FF4040] mt-0.5">{formatMoney(prod.price)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {qtyInCart > 0 && (
                        <>
                          <button
                            onClick={() => removeFromCart(String(prod.id))}
                            className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-700 font-black flex items-center justify-center active:scale-90"
                          >
                            -
                          </button>
                          <span className="font-black text-gray-900 text-xs min-w-[14px] text-center">{qtyInCart}</span>
                        </>
                      )}
                      <button
                        onClick={() => addToCart(String(prod.id), prod.stock)}
                        disabled={qtyInCart >= prod.stock}
                        className={`h-8 px-3 rounded-xl font-black text-xs transition-all active:scale-95 shadow-xs ${
                          qtyInCart > 0 
                            ? 'bg-[#FF4040] text-white' 
                            : 'bg-amber-400 hover:bg-amber-500 text-gray-950'
                        }`}
                      >
                        {qtyInCart > 0 ? '+' : '+ AGREGAR'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón Continuar si hay items en carrito */}
            {getCartItemsCount() > 0 && (
              <button
                onClick={() => setUiStep('CHECKOUT')}
                className="w-full bg-[#FF4040] hover:bg-red-600 text-white font-black py-4 px-6 rounded-2xl shadow-xl flex items-center justify-between transition-all active:scale-95 mt-2"
              >
                <span>Continuar al Pedido ({getCartItemsCount()} ítems)</span>
                <span>{formatMoney(getCartTotal())} ➔</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DE MODALIDAD Y DATOS (STEP CHECKOUT) ── */}
      {uiStep === 'CHECKOUT' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setUiStep('MENU')}>
          <div 
            onClick={e => e.stopPropagation()} 
            className="bg-white w-full max-w-lg rounded-t-[36px] sm:rounded-[36px] p-6 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-5 animate-slide-up"
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                🛵 Opciones de Entrega
              </h2>
              <button 
                onClick={() => setUiStep('MENU')}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* SELECCIÓN SI EL CARRITO VA AL CLIENTE O EL CLIENTE VA AL CARRITO */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">¿Cómo deseas recibir tu pedido?</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isInsideCoverage) {
                      toast.error('Tu ubicación actual está fuera del perímetro de domicilio.');
                      return;
                    }
                    setDeliveryMode('delivery');
                  }}
                  className={`p-4 rounded-2xl font-black text-xs flex flex-col items-center text-center gap-1.5 transition-all border-2 active:scale-95 ${
                    deliveryMode === 'delivery'
                      ? 'bg-[#FF4040] text-white border-[#FF4040] shadow-md'
                      : !isInsideCoverage
                      ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-gray-50 text-gray-700 border-gray-100'
                  }`}
                >
                  <span className="text-3xl">🛵</span>
                  <span className="leading-tight">Que el Carrito Móvil Venga a Mí</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMode('pickup')}
                  className={`p-4 rounded-2xl font-black text-xs flex flex-col items-center text-center gap-1.5 transition-all border-2 active:scale-95 ${
                    deliveryMode === 'pickup'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-gray-50 text-gray-700 border-gray-100'
                  }`}
                >
                  <span className="text-3xl">📍</span>
                  <span className="leading-tight">Voy a Recoger al Triciclo</span>
                </button>
              </div>
            </div>

            {/* FORMULARIO */}
            <form onSubmit={handleCheckout} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-xs font-bold text-gray-800 outline-none focus:ring-2 ring-[#FF4040]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Celular / WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="Ej. 3123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-xs font-bold text-gray-800 outline-none focus:ring-2 ring-[#FF4040]"
                />
              </div>

              {deliveryMode === 'delivery' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Dirección / Indicaciones</label>
                  <input
                    type="text"
                    placeholder="Ej. Calle 5 # 4-20 (Frente al parque)"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-xs font-bold text-gray-800 outline-none focus:ring-2 ring-[#FF4040]"
                  />
                </div>
              )}

              <div className="bg-amber-50 rounded-2xl p-4 flex items-center justify-between border border-amber-200/50">
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Total a Pagar</p>
                  <p className="text-[10px] font-bold text-gray-400">Pagas al recibir en efectivo</p>
                </div>
                <span className="text-2xl font-black text-gray-900">{formatMoney(getCartTotal())}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#FF4040] hover:bg-red-600 text-white font-black text-base py-4 rounded-[22px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Procesando...</span>
                ) : (
                  <>
                    <ShoppingBag size={18} /> Confirmar y Notificar Carrito
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      ` }} />
    </div>
  );
}
