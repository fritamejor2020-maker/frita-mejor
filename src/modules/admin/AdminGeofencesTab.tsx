import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Shield, Trash2, Plus, Check, X, MapPin, Layers, RefreshCw, Eye } from 'lucide-react';
import { getHaversineDistance, formatDistance } from '../../utils/geoUtils';

const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522]; // Pitalito, Huila
const DEFAULT_ZOOM = 14;

// Draggable client icon in red
const clientIcon = L.divIcon({
  className: '',
  html: `<div style="background:#FF4040; border:2.5px solid white; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 2px 4px rgba(0,0,0,0.3)">😋</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Repartidor icon in yellow
const createVendorIcon = (name: string) => L.divIcon({
  className: '',
  html: `
    <div style="display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))">
      <div style="background:#FFB700; border:2.5px solid white; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-size:18px">🛵</div>
      <div style="background:white; border:1.5px solid #FFB700; border-radius:8px; padding:1px 5px; font-size:8px; font-weight:900; color:#1f2937; margin-top:1px; white-space:nowrap">${name}</div>
    </div>`,
  iconSize: [50, 50],
  iconAnchor: [25, 36],
});

// Helper component to handle click events on the map when drawing
function MapDrawingHandler({
  isDrawing,
  onAddPoint,
}: {
  isDrawing: boolean;
  onAddPoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Helper to fit map bounds to a specific polygon
function MapZoomToPolygon({ polygon }: { polygon: any[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (polygon && polygon.length > 0) {
      const bounds = L.latLngBounds(polygon.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [polygon]);
  return null;
}

export function AdminGeofencesTab() {
  const [geofences, setGeofences] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [vendorLocations, setVendorLocations] = useState<any[]>([]);

  // --- Estado de Dibujo ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [newGeofenceName, setNewGeofenceName] = useState('');
  const [selectedGeoToZoom, setSelectedGeoToZoom] = useState<any[] | null>(null);

  useEffect(() => {
    fetchGeofences();
    fetchActiveDeliveries();
    fetchVendorLocations();

    // Suscribirse a cambios en vivo de pedidos y ubicaciones para la torre de control
    const orderSubscription = supabase.channel('admin-control-tower')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, () => {
        fetchActiveDeliveries();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_locations' }, () => {
        fetchVendorLocations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, []);

  const fetchGeofences = async () => {
    const { data } = await supabase.from('geofences').select('*').eq('is_active', true);
    setGeofences(data || []);
  };

  const fetchActiveDeliveries = async () => {
    // Jalamos pedidos pendientes o aceptados
    const { data } = await supabase
      .from('delivery_requests')
      .select('*')
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });
    
    setActiveDeliveries(data || []);
  };

  const fetchVendorLocations = async () => {
    const { data } = await supabase.from('vendor_locations').select('*').eq('is_active', true);
    setVendorLocations(data || []);
  };

  // Agregar un punto al dibujar la geocerca
  const handleAddPoint = (lat: number, lng: number) => {
    setDrawPoints(prev => [...prev, { lat, lng }]);
  };

  // Deshacer el último punto dibujado
  const handleUndoPoint = () => {
    setDrawPoints(prev => prev.slice(0, -1));
  };

  // Guardar la geocerca en Supabase
  const handleSaveGeofence = async () => {
    if (!newGeofenceName.trim()) {
      toast.error('Por favor ingresa un nombre para la geocerca.');
      return;
    }
    if (drawPoints.length < 3) {
      toast.error('Una geocerca requiere al menos 3 puntos.');
      return;
    }

    try {
      const { error } = await supabase.from('geofences').insert({
        name: newGeofenceName.trim(),
        coordinates: drawPoints,
        is_active: true
      });

      if (error) throw new Error(error.message);

      toast.success('¡Geocerca guardada con éxito! 🛡️');
      setIsDrawing(false);
      setDrawPoints([]);
      setNewGeofenceName('');
      fetchGeofences();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    }
  };

  // Eliminar una geocerca (soft delete)
  const handleDeleteGeofence = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta zona de cobertura?')) return;
    
    try {
      const { error } = await supabase
        .from('geofences')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw new Error(error.message);

      toast.success('Geocerca eliminada.');
      fetchGeofences();
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  // Formatear pesos
  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] w-full">
      {/* PANEL LATERAL IZQUIERDO: CONTROLES Y LISTADO */}
      <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto pr-1 shrink-0">
        
        {/* SECCIÓN DIBUJAR GEOCERCA */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
              <Layers size={16} className="text-[#FF4040]" /> Diseñador de Zonas
            </h3>
            {isDrawing && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                Dibujando...
              </span>
            )}
          </div>

          {!isDrawing ? (
            <button
              onClick={() => {
                setIsDrawing(true);
                setDrawPoints([]);
                setNewGeofenceName('');
              }}
              className="w-full bg-[#FF4040] hover:bg-red-600 text-white font-black py-3.5 px-6 rounded-2xl shadow-md transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
            >
              <Plus size={16} strokeWidth={3} /> DIBUJAR COBERTURA
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newGeofenceName}
                onChange={e => setNewGeofenceName(e.target.value)}
                placeholder="Nombre (ej. Sector Universidades)"
                className="bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold text-gray-700 outline-none focus:ring-2 ring-[#FFB700] shadow-inner"
              />
              
              <div className="flex gap-1 bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 text-[11px] font-bold text-yellow-700">
                👉 Haz clics en el mapa para marcar los puntos del polígono de servicio.
              </div>

              {drawPoints.length > 0 && (
                <div className="text-[11px] font-bold text-gray-400 px-1">
                  Puntos marcados: <span className="text-gray-700">{drawPoints.length}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <button
                  onClick={() => {
                    setIsDrawing(false);
                    setDrawPoints([]);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-2.5 px-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1 active:scale-95"
                >
                  <X size={13} /> Cancelar
                </button>
                <button
                  onClick={handleUndoPoint}
                  disabled={drawPoints.length === 0}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-600 font-black py-2.5 px-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1 disabled:opacity-40 active:scale-95"
                >
                  Undo ↩
                </button>
                <button
                  onClick={handleSaveGeofence}
                  disabled={drawPoints.length < 3}
                  className="bg-green-500 hover:bg-green-600 text-white font-black py-2.5 px-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1 disabled:opacity-40 active:scale-95"
                >
                  <Check size={13} /> Guardar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LISTADO DE GEOCERCAS ACTIVAS */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col gap-3 flex-1 min-h-[160px]">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Zonas de Cobertura</h3>
          
          {geofences.length === 0 ? (
            <p className="text-xs font-bold text-gray-300 text-center py-6">No hay zonas creadas.</p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-48 lg:max-h-full">
              {geofences.map(geo => (
                <div key={geo.id} className="bg-gray-50 rounded-2xl p-3 border border-gray-100 flex items-center justify-between group hover:border-[#FFB700] transition-colors">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-amber-500 fill-amber-50" />
                    <div className="flex flex-col">
                      <span className="font-black text-gray-800 text-xs">{geo.name}</span>
                      <span className="text-[10px] font-bold text-gray-400">{geo.coordinates.length} vértices</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedGeoToZoom(geo.coordinates)}
                      className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-amber-500 active:scale-90 transition-colors"
                      title="Enfocar en mapa"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteGeofence(geo.id)}
                      className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 active:scale-90 transition-colors"
                      title="Eliminar geocerca"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LISTADO DE PEDIDOS ACTIVOS EN COLA */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col gap-3 flex-1 min-h-[220px]">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Pedidos en Vivo
            </h3>
            {activeDeliveries.length > 0 && (
              <span className="bg-[#FF4040] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {activeDeliveries.length} activo{activeDeliveries.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {activeDeliveries.length === 0 ? (
            <p className="text-xs font-bold text-gray-300 text-center py-8">Ningún pedido activo en curso.</p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-60 lg:max-h-full">
              {activeDeliveries.map(delivery => {
                const isPending = delivery.status === 'pending';
                return (
                  <div key={delivery.id} className={`rounded-2xl p-3 border-2 ${
                    isPending 
                      ? 'bg-amber-50 border-amber-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-400 text-white animate-pulse' : 'bg-green-500 text-white'
                      }`}>
                        {isPending ? '🔔 PENDIENTE' : '🛵 EN CAMINO'}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {new Date(delivery.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="font-black text-gray-800 text-xs leading-tight">{delivery.client_name}</div>
                    <div className="text-[10px] font-bold text-gray-400 mt-0.5">📞 {delivery.client_phone}</div>
                    {delivery.client_address && (
                      <div className="text-[10px] font-bold text-gray-500 mt-1">📍 {delivery.client_address}</div>
                    )}

                    <div className="flex flex-wrap gap-1 mt-2 border-t border-gray-200/40 pt-2">
                      {(delivery.items || []).map((item: any, i: number) => (
                        <span key={i} className="text-[9px] bg-white border border-gray-100 font-bold px-1.5 py-0.5 rounded-full text-gray-600">
                          {item.name} ×{item.qty}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs font-black text-gray-800">
                      <span className="text-gray-400 font-bold text-[10px]">Total:</span>
                      <span className="text-[#FF4040]">{formatMoney(delivery.total_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* PANEL DERECHO: MAPA DE CONTROL Y TORRE DE MONITOREO */}
      <div className="flex-1 bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 h-full relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapDrawingHandler isDrawing={isDrawing} onAddPoint={handleAddPoint} />
          <MapZoomToPolygon polygon={selectedGeoToZoom} />

          {/* Renderizar Geocercas en el mapa */}
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

          {/* Renderizar Polígono actualmente en dibujo */}
          {isDrawing && drawPoints.length > 0 && (
            <>
              <Polyline 
                positions={drawPoints.map(p => [p.lat, p.lng])} 
                pathOptions={{ color: '#FF4040', weight: 3 }} 
              />
              {drawPoints.map((p, i) => (
                <Marker 
                  key={i} 
                  position={[p.lat, p.lng]} 
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="background:#FF4040; border:2px solid white; border-radius:50%; width:10px; height:10px"></div>`,
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                  })}
                />
              ))}
            </>
          )}

          {/* Repartidores Móviles en Vivo */}
          {vendorLocations.map(vendor => (
            <Marker
              key={vendor.vendor_id}
              position={[vendor.lat, vendor.lng]}
              icon={createVendorIcon(vendor.vendor_name)}
            >
              <Popup>
                <div className="font-sans min-w-[120px]">
                  <div className="font-black text-gray-900 text-sm">🛵 {vendor.vendor_name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">ID: {vendor.point_id || 'Móvil'}</div>
                  <div className="text-[10px] text-green-500 font-bold mt-1">✓ Transmitiendo GPS</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Pedidos Activos (Pins en el mapa) */}
          {activeDeliveries.map(delivery => {
            const isPending = delivery.status === 'pending';
            return (
              <Marker
                key={delivery.id}
                position={[delivery.client_lat, delivery.client_lng]}
                icon={clientIcon}
              >
                <Popup>
                  <div className="font-sans min-w-[160px]">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-400 text-white' : 'bg-green-500 text-white'
                      }`}>
                        {isPending ? 'PENDIENTE' : 'EN CAMINO'}
                      </span>
                      <span className="text-[9px] text-gray-400">Total: {formatMoney(delivery.total_amount)}</span>
                    </div>
                    <div className="font-black text-gray-900 text-xs">{delivery.client_name}</div>
                    <div className="text-[10px] text-gray-500">📞 {delivery.client_phone}</div>
                    {delivery.client_address && (
                      <div className="text-[10px] text-gray-400 mt-1 italic">📍 {delivery.client_address}</div>
                    )}
                    
                    <div className="mt-2 border-t border-gray-100 pt-2 flex flex-col gap-1">
                      {(delivery.items || []).map((item: any, i: number) => (
                        <div key={i} className="text-[9px] font-bold text-gray-600 flex justify-between">
                          <span>{item.name} ×{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Indicador de Estado Torre de Control */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur shadow-md rounded-2xl px-4 py-2 text-[10px] font-black text-gray-700 z-[1000] border border-gray-100 flex items-center gap-1.5 uppercase tracking-wide">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Monitoreo Realtime Activo
        </div>
      </div>
    </div>
  );
}
