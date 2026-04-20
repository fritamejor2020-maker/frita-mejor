/**
 * MapTrackingView — Vista del mapa en tiempo real
 * Para Admin y Dejadores: muestra la ubicación de los vendedores activos
 * usando Leaflet + OpenStreetMap (gratis, sin API key)
 * y Supabase Realtime Presence para actualizaciones en vivo.
 *
 * PERSISTENCIA: Al montar, carga las últimas ubicaciones guardadas
 * de la tabla `vendor_locations`. Luego, Presence actualiza en vivo.
 * Si un vendedor pierde conexión, su última ubicación de la BD sigue visible.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

// ── Centro por defecto: Pitalito, Huila ──────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522];
const DEFAULT_ZOOM = 14;
const CHANNEL = 'vendor-tracking';

// ── Ícono personalizado para el vendedor ─────────────────────────────────────
const createVendorIcon = (name: string, stale: boolean) => {
  const color = stale ? '#9ca3af' : '#FFB700';
  const border = stale ? '#6b7280' : '#e67e00';
  const emoji = '🛵';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex; flex-direction:column; align-items:center; gap:2px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <div style="
          background:${color}; border:3px solid ${border};
          border-radius:50%; width:44px; height:44px;
          display:flex; align-items:center; justify-content:center;
          font-size:22px; animation:${stale ? 'none' : 'pulse 2s infinite'};
        ">${emoji}</div>
        <div style="
          background:white; border:1.5px solid ${border};
          border-radius:12px; padding:2px 8px;
          font-size:11px; font-weight:900; color:#1f2937;
          white-space:nowrap; max-width:100px; overflow:hidden;
          text-overflow:ellipsis; box-shadow:0 1px 3px rgba(0,0,0,0.2);
        ">${name}</div>
      </div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 44],
    popupAnchor: [0, -46],
  });
};

// Fix Leaflet default marker issue with Vite/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Tipo de vendedor activo ───────────────────────────────────────────────────
interface VendorLocation {
  vendorId: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: string;
  source?: 'presence' | 'db';  // de dónde vino el dato
}

// ── Componente auxiliar: centra el mapa si no hay ubicaciones aún ────────────
function AutoCenter({ vendors }: { vendors: VendorLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (vendors.length === 1) {
      map.setView([vendors[0].lat, vendors[0].lng], DEFAULT_ZOOM);
    } else if (vendors.length > 1) {
      const bounds = L.latLngBounds(vendors.map(v => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [vendors.length]);
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export const MapTrackingView = ({ embedded = false }: { embedded?: boolean }) => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorLocation[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Presence data — se fusiona con datos de la BD
  const presenceRef = useRef<Map<string, VendorLocation>>(new Map());
  const dbRef = useRef<Map<string, VendorLocation>>(new Map());

  // Calcular si una ubicación está "vieja" (más de 2 minutos)
  const isStale = (updatedAt: string) =>
    Date.now() - new Date(updatedAt).getTime() > 2 * 60 * 1000;

  // ── Fusionar Presence (en vivo) + BD (persistida) ──────────────────────────
  const mergeVendors = () => {
    const merged = new Map<string, VendorLocation>();

    // Primero agregar los de la BD (última ubicación guardada)
    dbRef.current.forEach((v, id) => merged.set(id, { ...v, source: 'db' }));

    // Luego sobrescribir con los de Presence (estos son más recientes)
    presenceRef.current.forEach((v, id) => merged.set(id, { ...v, source: 'presence' }));

    setVendors(Array.from(merged.values()));
  };

  // ── Cargar últimas ubicaciones guardadas de la BD al montar ────────────────
  useEffect(() => {
    const loadSavedLocations = async () => {
      try {
        const { data } = await supabase
          .from('vendor_locations')
          .select('*')
          .order('updated_at', { ascending: false });

        if (data && data.length > 0) {
          data.forEach((row: any) => {
            dbRef.current.set(row.vendor_id, {
              vendorId: row.vendor_id,
              name: row.vendor_name,
              lat: row.lat,
              lng: row.lng,
              updatedAt: row.updated_at,
              source: 'db',
            });
          });
          mergeVendors();
        }
      } catch (_) {
        // Silencioso — si la tabla no existe aún, no pasa nada
      }
    };

    loadSavedLocations();

    // Refrescar de la BD cada 60s como respaldo
    const dbInterval = setInterval(loadSavedLocations, 60_000);
    return () => clearInterval(dbInterval);
  }, []);

  // ── Suscripción a Presence (tiempo real) ──────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(CHANNEL, { config: { presence: { key: 'viewer-' + (user?.id ?? 'anon') } } });
    channelRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      presenceRef.current.clear();

      Object.values(state).forEach((entries) => {
        entries.forEach((e) => {
          // Solo incluir entradas con coordenadas reales (no los viewers)
          if (e.lat && e.lng && e.vendorId) {
            presenceRef.current.set(e.vendorId, e as VendorLocation);
          }
        });
      });
      mergeVendors();
    });

    ch.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const formatTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Ahora mismo';
    if (diff < 120) return 'Hace 1 min';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return `Hace ${Math.floor(diff / 86400)}d`;
  };

  return (
    <div style={{ height: embedded ? '100%' : '100dvh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      {/* Header — hidden when embedded */}
      {!embedded && (
      <header style={{
        background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0, zIndex: 1000,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/selector')}
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1f2937', lineHeight: 1 }}>🗺️ Rastreo en Vivo</div>
            <div style={{ fontWeight: 700, fontSize: 10, color: '#9ca3af' }}>Pitalito · Huila</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Estado de conexión */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: connected ? '#dcfce7' : '#fef9c3', borderRadius: 20, padding: '4px 10px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#22c55e' : '#eab308', animation: connected ? 'none' : undefined }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: connected ? '#15803d' : '#92400e' }}>
              {connected ? 'En línea' : 'Conectando...'}
            </span>
          </div>
          <button
            onClick={() => { signOut(); navigate('/login'); }}
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        </div>
      </header>
      )}

      {/* Contenido: mapa + panel lateral */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Mapa */}
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ flex: 1, height: '100%', zIndex: 1 }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoCenter vendors={vendors} />
          {vendors.map((v) => {
            const stale = isStale(v.updatedAt);
            const fromDb = v.source === 'db';
            return (
            <Marker
              key={v.vendorId}
              position={[v.lat, v.lng]}
              icon={createVendorIcon(v.name, stale)}
            >
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: 160 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>🛵 {v.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    📍 {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
                  </div>
                  <div style={{ fontSize: 12, color: stale ? '#ef4444' : '#22c55e', fontWeight: 700, marginTop: 4 }}>
                    🕐 {formatTime(v.updatedAt)}
                  </div>
                  {fromDb && stale && (
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginTop: 4, fontStyle: 'italic' }}>
                      📡 Última ubicación guardada
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
            );
          })}
        </MapContainer>

        {/* Panel lateral de vendedores — hidden when embedded */}
        {!embedded && (
        <div style={{
          width: 220, background: 'white', boxShadow: '-2px 0 8px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 2,
          flexShrink: 0,
        }}>
          <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#1f2937' }}>Vendedores activos</div>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {vendors.length === 0 ? 'Ninguno en línea' : `${vendors.length} en ruta`}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vendors.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🛵</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
                  Los vendedores aparecerán aquí cuando estén en turno con GPS activo
                </div>
              </div>
            ) : (
              vendors.map((v) => {
                const stale = isStale(v.updatedAt);
                return (
                  <div key={v.vendorId} style={{
                    background: stale ? '#f9fafb' : '#fffbeb',
                    border: `1.5px solid ${stale ? '#e5e7eb' : '#fde68a'}`,
                    borderRadius: 12, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: stale ? '#9ca3af' : '#22c55e',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontWeight: 900, fontSize: 13, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: stale ? '#ef4444' : '#6b7280' }}>
                      🕐 {formatTime(v.updatedAt)}
                    </div>
                    {v.source === 'db' && stale && (
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>
                        📡 Última guardada
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}

        {/* Embedded: floating vendor count badge */}
        {embedded && vendors.length > 0 && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1000,
            background: 'white', borderRadius: 20, padding: '6px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex',
            alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontWeight: 900, fontSize: 12, color: '#1f2937' }}>
              {vendors.length} en ruta
            </span>
          </div>
        )}
        {embedded && (
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 1000,
            background: connected ? '#dcfce7' : '#fef9c3', borderRadius: 20,
            padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#22c55e' : '#eab308' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: connected ? '#15803d' : '#92400e' }}>
              {connected ? 'En línea' : 'Conectando...'}
            </span>
          </div>
        )}
      </div>

      {/* CSS animaciones */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};
