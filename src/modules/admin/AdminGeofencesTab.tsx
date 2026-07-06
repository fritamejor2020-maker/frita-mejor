import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { useBranchStore } from '../../store/useBranchStore';
import { toast } from 'react-hot-toast';
import { Shield, Trash2, Plus, Check, X, MapPin, Layers, RefreshCw, Eye, Building2 } from 'lucide-react';
import { getHaversineDistance, formatDistance } from '../../utils/geoUtils';

const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522]; // Pitalito, Huila por defecto
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

// Helper to fit map bounds to a specific polygon or center on lat/lng
function MapControllerHelper({ polygon, centerPos }: { polygon: any[] | null; centerPos: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    if (polygon && polygon.length > 0) {
      const bounds = L.latLngBounds(polygon.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (centerPos) {
      map.setView(centerPos, DEFAULT_ZOOM);
    }
  }, [polygon, centerPos[0], centerPos[1]]);

  return null;
}

export function AdminGeofencesTab() {
  const { branches } = useBranchStore();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'BRANCH-001');
  const selectedBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

  const [geofences, setGeofences] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [vendorLocations, setVendorLocations] = useState<any[]>([]);

  // --- Estado de Dibujo ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [newGeofenceName, setNewGeofenceName] = useState('');
  const [selectedGeoToZoom, setSelectedGeoToZoom] = useState<any[] | null>(null);

  // Determinar centro del mapa según la sede seleccionada
  const branchCenter: [number, number] = (selectedBranch?.settings?.lat && selectedBranch?.settings?.lng)
    ? [selectedBranch.settings.lat, selectedBranch.settings.lng]
    : DEFAULT_CENTER;

  useEffect(() => {
    fetchGeofences();
    fetchActiveDeliveries();
    fetchVendorLocations();

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
  }, [selectedBranchId]);

  const fetchGeofences = async () => {
    const { data } = await supabase.from('geofences').select('*').eq('is_active', true);
    setGeofences(data || []);
  };

  const fetchActiveDeliveries = async () => {
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

  // Filtrar geocercas correspondientes a la sede seleccionada (o sin sede asignada)
  const branchGeofences = geofences.filter(g => !g.branch_id || g.branch_id === selectedBranchId);

  const handleAddPoint = (lat: number, lng: number) => {
    setDrawPoints(prev => [...prev, { lat, lng }]);
  };

  const handleUndoPoint = () => {
    setDrawPoints(prev => prev.slice(0, -1));
  };

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
        name: `${selectedBranch?.name || 'Sede'}: ${newGeofenceName.trim()}`,
        coordinates: drawPoints,
        is_active: true,
        branch_id: selectedBranchId,
      });

      if (error) {
        // Fallback si la columna branch_id no existe en Supabase
        const { error: fallbackErr } = await supabase.from('geofences').insert({
          name: `${selectedBranch?.name || 'Sede'}: ${newGeofenceName.trim()}`,
          coordinates: drawPoints,
          is_active: true
        });
        if (fallbackErr) throw new Error(fallbackErr.message);
      }

      toast.success(`¡Geocerca guardada para ${selectedBranch?.name || 'la sede'}! 🛡️`);
      setIsDrawing(false);
      setDrawPoints([]);
      setNewGeofenceName('');
      fetchGeofences();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    }
  };

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

  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] w-full">
      {/* PANEL LATERAL IZQUIERDO: CONTROLES Y LISTADO */}
      <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto pr-1 shrink-0">
        
        {/* SELECTOR DE SEDE / MUNICIPIO */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Building2 size={14} className="text-amber-500" /> Configuración por Sede
            </h3>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
              Seleccionar Sede / Municipio:
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedGeoToZoom(null);
              }}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-black rounded-xl p-3 outline-none focus:ring-2 ring-amber-400"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  📍 {b.name} ({b.settings?.address || 'Municipio'})
                </option>
              ))}
            </select>
          </div>
        </div>

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
              <Plus size={16} strokeWidth={3} /> DIBUJAR COBERTURA EN {selectedBranch?.name?.toUpperCase()}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newGeofenceName}
                onChange={e => setNewGeofenceName(e.target.value)}
                placeholder="Nombre (ej. Zona Centro, Barrio Bolivar...)"
                className="bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold text-gray-700 outline-none focus:ring-2 ring-[#FFB700] shadow-inner"
              />
              
              <div className="flex gap-1 bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 text-[11px] font-bold text-yellow-700">
                👉 Haz clics en el mapa para delimitar el perímetro permitido de delivery para {selectedBranch?.name}.
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

        {/* LISTADO DE GEOCERCAS ACTIVAS POR SEDE */}
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 flex flex-col gap-3 flex-1 min-h-[160px]">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
            Zonas de Cobertura ({selectedBranch?.name})
          </h3>
          
          {branchGeofences.length === 0 ? (
            <p className="text-xs font-bold text-gray-300 text-center py-6">No hay zonas creadas para esta sede.</p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-48 lg:max-h-full">
              {branchGeofences.map(geo => (
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
          center={branchCenter}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapDrawingHandler isDrawing={isDrawing} onAddPoint={handleAddPoint} />
          <MapControllerHelper polygon={selectedGeoToZoom} centerPos={branchCenter} />

          {/* Renderizar Geocercas en el mapa */}
          {branchGeofences.map(geo => (
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
                  icon={clientIcon}
                />
              ))}
            </>
          )}

          {/* Repartidores activos en el mapa */}
          {vendorLocations.map(v => (
            <Marker
              key={v.id || v.vendor_id}
              position={[v.lat, v.lng]}
              icon={createVendorIcon(v.vendor_name || 'Vendedor')}
            >
              <Popup>
                <div className="text-xs font-bold p-1">
                  🛵 {v.vendor_name}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Badge Indicador de Sede Activa en Mapa */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur shadow-md rounded-2xl px-4 py-2 text-xs font-black text-gray-800 z-[1000] border border-gray-100 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
          <span>Sede: {selectedBranch?.name} ({selectedBranch?.settings?.address || 'Municipio'})</span>
        </div>
      </div>
    </div>
  );
}
