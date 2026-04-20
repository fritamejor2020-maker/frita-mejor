/**
 * MapTrackingView — Vista del mapa en tiempo real
 * Para Admin y Dejadores: muestra la ubicación de los vendedores activos
 * usando Leaflet + OpenStreetMap (gratis, sin API key)
 * y Supabase Realtime Presence para actualizaciones en vivo.
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
export const MapTrackingView = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorLocation[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Calcular si una ubicación está "vieja" (más de 2 minutos)
  const isStale = (updatedAt: string) =>
    Date.now() - new Date(updatedAt).getTime() > 2 * 60 * 1000;

  useEffect(() => {
    const ch = supabase.channel(CHANNEL, { config: { presence: { key: 'viewer-' + (user?.id ?? 'anon') } } });
    channelRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      const list: VendorLocation[] = [];
      Object.values(state).forEach((entries) => {
        entries.forEach((e) => {
          // Solo incluir entradas con coordenadas reales (no los viewers)
          if (e.lat && e.lng && e.vendorId) {
            list.push(e as VendorLocation);
          }
        });
      });
      setVendors(list);
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
    return `Hace ${Math.floor(diff / 60)} min`;
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      {/* Header */}
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
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoCenter vendors={vendors} />
          {vendors.map((v) => (
            <Marker
              key={v.vendorId}
              position={[v.lat, v.lng]}
              icon={createVendorIcon(v.name, isStale(v.updatedAt))}
            >
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: 140 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>🛵 {v.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    📍 {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
                  </div>
                  <div style={{ fontSize: 12, color: isStale(v.updatedAt) ? '#ef4444' : '#22c55e', fontWeight: 700, marginTop: 4 }}>
                    🕐 {formatTime(v.updatedAt)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Panel lateral de vendedores */}
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
                  </div>
                );
              })
            )}
          </div>
        </div>
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
