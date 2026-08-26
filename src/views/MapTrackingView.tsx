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
import { useInventoryStore } from '../store/useInventoryStore';
import { useLogisticsStore } from '../store/useLogisticsStore';
import { useVehicleStore } from '../store/useVehicleStore';
import { useBranchStore } from '../store/useBranchStore';
import { useNavigate } from 'react-router-dom';
import { VehicleShiftCard } from '../components/admin/AdminVehicleInventoryTab';

// ── Centro por defecto: Pitalito, Huila ──────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [1.8485, -76.0522];
const DEFAULT_ZOOM = 14;
const CHANNEL = 'vendor-tracking';

// ── Ícono personalizado para el vendedor ─────────────────────────────────────
const createVendorIcon = (name: string, stale: boolean, offline = false, vehicleType = 'tricycle') => {
  const color  = offline ? '#e5e7eb' : stale ? '#9ca3af' : '#FFB700';
  const border = offline ? '#9ca3af' : stale ? '#6b7280' : '#e67e00';
  const isMoto = String(vehicleType).toLowerCase().includes('moto') || String(vehicleType).toLowerCase().includes('domicilio');
  const emoji  = offline ? '📍' : (isMoto ? '🛵' : '🚲');
  const extra  = offline ? 'opacity:0.75; filter:grayscale(0.5);' : '';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex; flex-direction:column; align-items:center; gap:2px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); ${extra}
      ">
        <div style="
          background:${color}; border:3px ${offline ? 'dashed' : 'solid'} ${border};
          border-radius:50%; width:44px; height:44px;
          display:flex; align-items:center; justify-content:center;
          font-size:22px; animation:${(!stale && !offline) ? 'pulse 2s infinite' : 'none'};
        ">${emoji}</div>
        <div style="
          background:white; border:1.5px ${offline ? 'dashed' : 'solid'} ${border};
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
  pointId?: string;   // T1, T2… — necesario para VehicleShiftCard
  name: string;
  lat: number;
  lng: number;
  updatedAt: string;
  source?: 'presence' | 'db' | 'offline';
}

// ── Componente auxiliar: centra el mapa una sola vez al cargar ────────
function AutoCenter({ vendors, mapCenter }: { vendors: VendorLocation[]; mapCenter: [number, number] }) {
  const map = useMap();
  const initialCenteredRef = useRef(false);

  useEffect(() => {
    if (initialCenteredRef.current || vendors.length === 0) return;
    const validVendors = vendors.filter(v => v.lat && v.lng && (v.lat !== mapCenter[0] || v.lng !== mapCenter[1]));
    if (validVendors.length === 1) {
      map.setView([validVendors[0].lat, validVendors[0].lng], DEFAULT_ZOOM);
      initialCenteredRef.current = true;
    } else if (validVendors.length > 1) {
      const bounds = L.latLngBounds(validVendors.map(v => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
      initialCenteredRef.current = true;
    }
  }, [vendors.length, mapCenter[0], mapCenter[1]]);
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export const MapTrackingView = ({ embedded = false, onVehicleSelect, activeShifts = [], branchId = null }: {
  embedded?: boolean;
  onVehicleSelect?: (vehicleId: string) => void;
  activeShifts?: any[];   // posShifts con turno activo para cruzar con la última ubicación
  branchId?: string | null; // Filtrar por sede (para Gerentes)
}) => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  // Resolver centro del mapa según la sede
  const branchData = useBranchStore((s: any) =>
    branchId ? s.branches?.find((b: any) => b.id === branchId) : null
  );
  const mapCenter: [number, number] = (
    branchData?.settings?.lat && branchData?.settings?.lng
      ? [branchData.settings.lat, branchData.settings.lng]
      : DEFAULT_CENTER
  );
  const [vendors, setVendors] = useState<VendorLocation[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleLabel, setSelectedVehicleLabel] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Presence data — se fusiona con datos de la BD
  const presenceRef = useRef<Map<string, VendorLocation>>(new Map());
  const dbRef = useRef<Map<string, VendorLocation>>(new Map());
  // Memoria persistente para evitar parpadeos si la red cae 10 segundos
  const lastKnownLocationsRef = useRef<Map<string, VendorLocation>>(new Map());

  // Cargar datos remotos y turnos al abrir el mapa y periódicamente
  useEffect(() => {
    const loadState = async () => {
      try {
        const { data } = await supabase
          .from('app_state')
          .select('key, value')
          .in('key', ['posShifts', 'posShifts_BRANCH-001', 'vendorLocations', 'vendorLocations_BRANCH-001']);
        if (data) {
          const map: Record<string, any> = {};
          data.forEach(r => { map[r.key] = r.value; });

          const shiftMap = new Map<string, any>();
          [
            ...(Array.isArray(map['posShifts']) ? map['posShifts'] : []),
            ...(Array.isArray(map['posShifts_BRANCH-001']) ? map['posShifts_BRANCH-001'] : []),
            ...(Array.isArray(map['posShifts_master_history']) ? map['posShifts_master_history'] : []),
          ].forEach((s: any) => {
            if (!s?.id) return;
            const existing = shiftMap.get(s.id);
            if (!existing) {
              shiftMap.set(s.id, s);
            } else if (!existing.closedAt && s.closedAt) {
              shiftMap.set(s.id, s);
            } else if (existing.closedAt && s.closedAt) {
              const existingTime = new Date(existing.closedAt || 0).getTime();
              const sTime = new Date(s.closedAt || 0).getTime();
              if (sTime > existingTime) {
                shiftMap.set(s.id, s);
              }
            } else if (!existing.closedAt && !s.closedAt) {
              const existingTime = new Date(existing.openedAt || 0).getTime();
              const sTime = new Date(s.openedAt || 0).getTime();
              if (sTime > existingTime) {
                shiftMap.set(s.id, s);
              }
            }
          });

          const combinedShifts = Array.from(shiftMap.values());
          if (combinedShifts.length > 0) {
            useInventoryStore.setState({ posShifts: combinedShifts });
          }

          const locs = { ...(map['vendorLocations'] || {}), ...(map['vendorLocations_BRANCH-001'] || {}) };
          if (Object.keys(locs).length > 0) {
            useInventoryStore.setState({ vendorLocations: locs });
          }
        }
      } catch (e) {}
    };
    loadState();
    useInventoryStore.getState().loadFromRemote().catch(() => {});
    useLogisticsStore.getState().fetchPendingRequests().catch(() => {});
    // Intervalo de respaldo de 15s (el canal Realtime y Presence actualizan en vivo)
    const interval = setInterval(loadState, 15000);
    return () => clearInterval(interval);
  }, []);

  // Calcular si una ubicación está "vieja" (más de 2 minutos sin GPS en vivo)
  const isStale = (updatedAt: string) =>
    Date.now() - new Date(updatedAt).getTime() > 2 * 60 * 1000;

  // ── Vehículos filtrados por sede (para restricción de Gerentes) ────────────
  const allVehicles = useVehicleStore((s: any) => s.vehicles) || [];
  const branchVehicleIds = branchId
    ? new Set(allVehicles.filter((v: any) => v.active && v.branchId === branchId).map((v: any) => v.abbreviation || v.name))
    : null; // null = no filtrar (Admin/Dejador ven todo)

  // ── Fusionar Presence (en vivo) + BD (persistida) ──────────────────────────
  const mergeVendors = () => {
    // 1. Unificar todos los turnos por ID con prevalencia estricta de cierre
    const allActiveShifts = [
      ...(activeShifts || []),
      ...(posShiftsFromStore || []),
    ];

    const shiftByIdMap = new Map<string, any>();
    allActiveShifts.forEach((s: any) => {
      if (!s?.id) return;
      const existing = shiftByIdMap.get(s.id);
      if (!existing) {
        shiftByIdMap.set(s.id, s);
      } else if (!existing.closedAt && s.closedAt) {
        shiftByIdMap.set(s.id, s);
      } else if (existing.closedAt && s.closedAt) {
        if (new Date(s.closedAt).getTime() > new Date(existing.closedAt).getTime()) {
          shiftByIdMap.set(s.id, s);
        }
      } else if (!existing.closedAt && !s.closedAt) {
        if (new Date(s.openedAt || 0).getTime() > new Date(existing.openedAt || 0).getTime()) {
          shiftByIdMap.set(s.id, s);
        }
      }
    });

    const openShiftsMap = new Map<string, any>();
    Array.from(shiftByIdMap.values()).forEach((s: any) => {
      if (!s || s.closedAt) return;
      const typeStr = String(s.type || '').toUpperCase();
      const pIdStr = String(s.pointId || s.vehicle || '').toLowerCase();
      const respStr = String(s.responsibleName || s.userName || '').toLowerCase();

      // 🚫 EXCLUSIÓN EXPLÍCITA DE CAJEROS / POS / SEDE / DEJADORES
      const isCashierOrPos = 
        typeStr === 'POS' || typeStr === 'CAJERO' || typeStr === 'CAJA' || typeStr === 'DESPACHO' || typeStr === 'ADMIN' || typeStr === 'DEJADOR' ||
        pIdStr.includes('caja') || pIdStr.includes('pos') || pIdStr.includes('cajero') || pIdStr.includes('despacho') || pIdStr.includes('branch') || pIdStr.includes('sucursal') ||
        respStr.includes('cajero') || respStr.includes('caja') || respStr.includes('despacho');

      if (isCashierOrPos) return;

      // 🛵 INCLUSIÓN EXCLUSIVA DE VENDEDORES MÓVILES / TRICICLOS
      const hasVehiclePattern = /^[tc]\d+/i.test(pIdStr) || pIdStr.startsWith('t') || pIdStr.startsWith('c') || pIdStr.includes('vendedor') || pIdStr.includes('triciclo') || pIdStr.includes('carrito');
      const isVendor = typeStr === 'VENDEDOR' || hasVehiclePattern;
      if (!isVendor) return;

      const rawPoint = s.pointId || s.vehicle || 'Punto';
      const cleanPoint = String(rawPoint).trim().toUpperCase();
      const rawName = s.responsibleName || s.userName || s.sellerName || s.vendedor || rawPoint;
      const cleanName = String(rawName).trim().toUpperCase();

      const numMatch = cleanPoint.match(/\d+/);
      const vehicleCode = numMatch ? `T${numMatch[0]}` : (cleanPoint.startsWith('T') || cleanPoint.startsWith('C') ? cleanPoint : cleanName);
      const uniqueShiftKey = vehicleCode || cleanName || cleanPoint;
      if (uniqueShiftKey) {
        const existing = openShiftsMap.get(uniqueShiftKey);
        if (!existing || new Date(s.openedAt || 0).getTime() > new Date(existing.openedAt || 0).getTime()) {
          openShiftsMap.set(uniqueShiftKey, s);
        }
      }
    });

    const openShifts = Array.from(openShiftsMap.values());

    // 2. Construir lista final de marcadores basada directamente en los turnos abiertos
    const finalVendorsMap = new Map<string, VendorLocation>();

    openShifts.forEach((s: any) => {
      const rawPoint = s.pointId || s.vehicle || 'Punto';
      const cleanPoint = String(rawPoint).trim().toUpperCase();
      const cleanLowerP = cleanPoint.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawName = s.responsibleName || s.userName || s.sellerName || s.vendedor || rawPoint;
      const cleanName = String(rawName).trim().toUpperCase();
      const cleanLowerN = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const userId = String(s.userId || s.createdBy || '').trim();

      const numMatch = cleanPoint.match(/\d+/);
      const vehicleCode = numMatch ? `T${numMatch[0]}` : (cleanPoint.startsWith('T') || cleanPoint.startsWith('C') ? cleanPoint : cleanName);
      const uniqueKey = vehicleCode || cleanName || cleanPoint;

      // 1. Buscar en Presence (en vivo)
      let loc = Array.from(presenceRef.current.values()).find(p => {
        const pP = String(p.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const pN = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (cleanLowerP && pP === cleanLowerP) || (cleanLowerN && pN === cleanLowerN);
      });

      // 2. Buscar en DB (persistida)
      if (!loc) {
        loc = Array.from(dbRef.current.values()).find(d => {
          const dP = String(d.pointId || d.vendorId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const dN = String(d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return (cleanLowerP && dP === cleanLowerP) || (cleanLowerN && dN === cleanLowerN);
        });
      }

      // 3. Buscar en store local (vendorLocationsFromStore)
      if (!loc) {
        const saved = vendorLocationsFromStore[rawPoint] ||
                      vendorLocationsFromStore[cleanPoint] ||
                      vendorLocationsFromStore[cleanPoint.toLowerCase()] ||
                      Object.values(vendorLocationsFromStore).find((l: any) => {
                        const lP = String(l?.pointId || l?.vendorId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const lN = String(l?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        return (cleanLowerP && lP === cleanLowerP) || (cleanLowerN && lN === cleanLowerN);
                      });
        if (saved && saved.lat && saved.lng) {
          loc = {
            vendorId: userId || cleanPoint,
            pointId: rawPoint,
            name: rawName,
            lat: Number(saved.lat),
            lng: Number(saved.lng),
            updatedAt: saved.updatedAt || s.openedAt || new Date().toISOString(),
            source: 'db',
          };
        }
      }

      // 4. Buscar en memoria persistente local (lastKnownLocationsRef)
      if (!loc) {
        loc = lastKnownLocationsRef.current.get(uniqueKey) ||
              Array.from(lastKnownLocationsRef.current.values()).find(k => {
                const kP = String(k.pointId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const kN = String(k.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return (cleanLowerP && kP === cleanLowerP) || (cleanLowerN && kN === cleanLowerN);
              });
      }

      const lat = (loc?.lat && !isNaN(Number(loc.lat))) ? Number(loc.lat) : mapCenter[0];
      const lng = (loc?.lng && !isNaN(Number(loc.lng))) ? Number(loc.lng) : mapCenter[1];

      const vendorItem: VendorLocation = {
        vendorId: loc?.vendorId || userId || uniqueKey,
        pointId: rawPoint,
        name: rawName,
        lat,
        lng,
        updatedAt: loc?.updatedAt || s.openedAt || new Date().toISOString(),
        source: loc?.source || (loc?.lat ? 'db' : 'offline'),
      };

      // Si tenemos coordenadas reales, guardar en la memoria incondicional para que nunca desaparezca
      if (loc && loc.lat && loc.lng && (loc.lat !== mapCenter[0] || loc.lng !== mapCenter[1])) {
        lastKnownLocationsRef.current.set(uniqueKey, vendorItem);
      }

      finalVendorsMap.set(uniqueKey, vendorItem);
    });

    let result = Array.from(finalVendorsMap.values());

    // Filtrar por sede si hay branchId
    if (branchVehicleIds) {
      result = result.filter(v => v.pointId && branchVehicleIds.has(v.pointId));
    }

    if (result.length > 0) {
      setVendors(result);
    }
  };

  // ── Leer ubicaciones desde el store (sincronizado vía app_state) ──────────
  const vendorLocationsFromStore = useInventoryStore((s: any) => s.vendorLocations || {});
  const posShiftsFromStore       = useInventoryStore((s: any) => s.posShifts || []);

  useEffect(() => {
    const activeOpenShifts = (posShiftsFromStore || []).filter((s: any) => {
      if (s.closedAt) return false;
      const isVendor = String(s.type || '').toUpperCase() === 'VENDEDOR' || (s.pointId && String(s.pointId).toLowerCase().startsWith('t'));
      return isVendor;
    });

    const activeKeys = new Set<string>();
    activeOpenShifts.forEach((s: any) => {
      const pId = String(s.pointId || s.vehicle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const vName = String(s.responsibleName || s.userName || s.sellerName || s.vendedor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const uId = String(s.userId || s.createdBy || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (pId) activeKeys.add(pId);
      if (vName) activeKeys.add(vName);
      if (uId) activeKeys.add(uId);

      const numMatch = pId.match(/\d+/);
      if (numMatch) {
        activeKeys.add(`t${numMatch[0]}`);
        activeKeys.add(`${numMatch[0]}`);
      }
    });

    const updatedDbMap = new Map<string, VendorLocation>();

    Object.entries(vendorLocationsFromStore || {}).forEach(([vendorId, loc]: [string, any]) => {
      if (!loc || typeof loc !== 'object') return;
      if (!loc.lat || !loc.lng) return;

      const cleanP = loc.pointId ? String(loc.pointId).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const cleanUid = vendorId ? String(vendorId).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const cleanName = loc.name ? String(loc.name).toLowerCase().replace(/[^a-z0-9]/g, '') : '';

      const numMatch = (cleanP || cleanName).match(/\d+/);
      const pNumKey = numMatch ? `t${numMatch[0]}` : '';

      const hasActiveShift = activeKeys.size === 0 ||
        (cleanP && activeKeys.has(cleanP)) ||
        (cleanUid && activeKeys.has(cleanUid)) ||
        (cleanName && activeKeys.has(cleanName)) ||
        (pNumKey && activeKeys.has(pNumKey));

      if (!hasActiveShift) return;

      const pKey = loc.pointId || vendorId || loc.name;
      updatedDbMap.set(pKey, {
        vendorId: pKey,
        pointId: loc.pointId || vendorId,
        name: loc.name || loc.pointId || 'Vendedor',
        lat: loc.lat,
        lng: loc.lng,
        updatedAt: loc.updatedAt,
        source: 'offline',
      });
    });
    mergeVendors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorLocationsFromStore, posShiftsFromStore]);


  // ── Suscripción a Presence (tiempo real) ──────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(CHANNEL, { config: { presence: { key: 'viewer-' + (user?.id ?? 'anon') } } });
    channelRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, any[]>;

      Object.values(state).forEach((entries) => {
        entries.forEach((e) => {
          // Solo incluir entradas con coordenadas reales (no los viewers)
          if (e.lat && e.lng && (e.vendorId || e.pointId)) {
            const pKey = e.pointId || e.vendorId;
            presenceRef.current.set(pKey, {
              ...(e as VendorLocation),
              vendorId: pKey,
              pointId: e.pointId || undefined,
            });
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
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          style={{ flex: 1, height: '100%', zIndex: 1 }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoCenter vendors={vendors} mapCenter={mapCenter} />
          {vendors.map((v) => {
            const stale   = isStale(v.updatedAt);
            const offline = v.source === 'offline';
            return (
            <Marker
              key={v.vendorId}
              position={[v.lat, v.lng]}
              icon={createVendorIcon(v.name, stale, offline)}
              eventHandlers={embedded && onVehicleSelect ? {
                click: () => onVehicleSelect(v.pointId || v.vendorId),
              } : !embedded ? {
                click: () => setSelectedVehicleId(id => id === (v.pointId || v.vendorId) ? null : (v.pointId || v.vendorId)),
              } : undefined}
            >
              {!embedded && (
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: 160 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>🛵 {v.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    📍 {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
                  </div>
                  <div style={{ fontSize: 12, color: offline ? '#f59e0b' : stale ? '#ef4444' : '#22c55e', fontWeight: 700, marginTop: 4 }}>
                    🕐 {formatTime(v.updatedAt)}
                  </div>
                  {offline && (
                    <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginTop: 4, background: '#fef3c7', borderRadius: 6, padding: '3px 6px' }}>
                      📡 Última ubicación conocida · App cerrada
                    </div>
                  )}
                </div>
              </Popup>
              )}
              {embedded && (
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: 120 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 2 }}>🛵 {v.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>🕐 {formatTime(v.updatedAt)}</div>
                  {onVehicleSelect && (
                    <button
                      onClick={() => onVehicleSelect(v.pointId || v.vendorId)}
                      style={{ marginTop: 6, width: '100%', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '4px 8px', fontWeight: 900, fontSize: 11, cursor: 'pointer' }}
                    >
                      Ver inventario →
                    </button>
                  )}
                </div>
              </Popup>
              )}
            </Marker>
            );
          })}
        </MapContainer>

        {/* Panel flotante de vendedores — abajo al centro, solo en modo standalone */}
        {!embedded && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000, pointerEvents: 'auto',
            maxWidth: '92vw', width: 'max-content',
          }}>

            {/* Inventario del vehículo seleccionado — aparece encima del panel */}
            {selectedVehicleId && (
              <div style={{
                background: 'white', borderRadius: 20, padding: '12px 14px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)', marginBottom: 8,
                maxWidth: 320, width: '90vw',
              }}>
                <div style={{ fontWeight: 900, fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📦 Inventario en Ruta · {selectedVehicleLabel || selectedVehicleId}
                </div>
                <VehicleShiftCard vehicleId={selectedVehicleId} activeOnly />
              </div>
            )}

            {/* Cuadro flotante de vendedores */}
            <div style={{
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(12px)',
              borderRadius: 20,
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              padding: vendors.length === 0 ? '12px 20px' : '10px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: vendors.length > 0 ? '#22c55e' : '#d1d5db',
                  flexShrink: 0,
                }} />
                <span style={{ fontWeight: 800, fontSize: 12, color: '#374151' }}>
                  {vendors.length === 0 ? 'Ningún vendedor en línea' : `${vendors.length} vendedor${vendors.length > 1 ? 'es' : ''} en ruta`}
                </span>
              </div>

              {/* Tarjetas de vendedores en fila */}
              {vendors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, maxWidth: '88vw' }}>
                  {vendors.map((v) => {
                    const stale    = isStale(v.updatedAt);
                    const offline  = v.source === 'offline';
                    const vehicleKey = v.pointId || v.vendorId;
                    const isSelected = selectedVehicleId === vehicleKey;
                    return (
                  <div
                        key={v.vendorId}
                        onClick={() => { setSelectedVehicleId(isSelected ? null : vehicleKey); setSelectedVehicleLabel(isSelected ? null : (v.pointId || v.name)); }}
                        style={{
                          background: isSelected ? '#fef3c7' : offline ? '#f9fafb' : stale ? '#f9fafb' : 'white',
                          border: `2px solid ${isSelected ? '#f59e0b' : offline ? '#d1d5db' : stale ? '#e5e7eb' : '#d1fae5'}`,
                          borderRadius: 14, padding: '8px 12px', cursor: 'pointer',
                          transition: 'all 0.15s', minWidth: 90,
                          boxShadow: isSelected ? '0 0 0 3px rgba(245,158,11,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: offline ? '#d1d5db' : stale ? '#9ca3af' : '#22c55e', flexShrink: 0 }} />
                          <span style={{ fontWeight: 900, fontSize: 12, color: '#1f2937', whiteSpace: 'nowrap' }}>
                            {v.name.split(' ')[0]}
                          </span>
                          {isSelected && <span style={{ fontSize: 9 }}>📦</span>}
                        </div>
                        <div style={{ fontSize: 10, color: offline ? '#f59e0b' : stale ? '#ef4444' : '#6b7280', fontWeight: 600 }}>
                          {offline ? '📡 ' : '🕐 '}{formatTime(v.updatedAt)}
                        </div>
                        {offline && (
                          <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, marginTop: 2 }}>
                            App cerrada
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
