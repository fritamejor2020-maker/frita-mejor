/**
 * useVendorTracking — hook para VENDEDORES
 * Pide permiso GPS y transmite la ubicación cada 30s
 * al canal de Supabase Realtime Presence 'vendor-tracking'.
 *
 * ADEMÁS: guarda cada ubicación en useInventoryStore.vendorLocations
 * (sincronizado vía app_state) para que la última posición quede
 * persistida incluso si el vendedor pierde conexión o cierra la app.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useInventoryStore } from '../store/useInventoryStore';

const CHANNEL  = 'vendor-tracking';

export type TrackingStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

export function useVendorTracking(
  vendorId: string,
  vendorName: string,
  pointId: string,
  enabled: boolean,
) {
  const [status, setStatus]     = useState<TrackingStatus>('idle');
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const watchIdRef  = useRef<number | null>(null);

  // ── Guardar en Presence (tiempo real) + Store (persistente vía app_state) ──
  const sendLocation = async (lat: number, lng: number) => {
    const now = new Date().toISOString();

    // 1) Presence → mapa en vivo
    if (channelRef.current) {
      await channelRef.current.track({
        vendorId,
        pointId,
        name: vendorName,
        lat,
        lng,
        updatedAt: now,
      }).catch(() => {});
    }

    // 2) Store → persiste aunque la app se cierre (sincronizado vía Supabase app_state)
    useInventoryStore.getState().updateVendorLocation(vendorId, lat, lng, vendorName, pointId);

    setLastSent(new Date());
  };

  const startTracking = () => {
    setStatus('requesting');

    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Crear canal de Supabase Presence
        const ch = supabase.channel(CHANNEL, { config: { presence: { key: vendorId } } });
        channelRef.current = ch;

        ch.subscribe(async (s) => {
          if (s === 'SUBSCRIBED') {
            await sendLocation(pos.coords.latitude, pos.coords.longitude);
            setStatus('active');

            // Usar watchPosition en vez de setInterval — no se pausa en background en móviles
            watchIdRef.current = navigator.geolocation.watchPosition(
              (p) => sendLocation(p.coords.latitude, p.coords.longitude),
              () => {/* silencioso */},
              { enableHighAccuracy: true, maximumAge: 30_000 }
            );
          }
        });
      },
      (err) => {
        setStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    );
  };

  const stopTracking = async () => {
    // Detener watchPosition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (channelRef.current) {
      await channelRef.current.untrack().catch(() => {});
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    // Marcar la ubicación como inactiva en el store
    const locMap = useInventoryStore.getState().vendorLocations || {};
    if (locMap[vendorId]) {
      useInventoryStore.getState().updateVendorLocation(vendorId, locMap[vendorId].lat, locMap[vendorId].lng, vendorName, pointId);
      const updated = { ...useInventoryStore.getState().vendorLocations };
      if (updated[vendorId]) {
        updated[vendorId] = { ...updated[vendorId], isActive: false, updatedAt: new Date().toISOString() };
        useInventoryStore.setState({ vendorLocations: updated });
      }
    }
    setStatus('idle');
  };

  useEffect(() => {
    if (enabled && vendorId) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [enabled, vendorId]);

  return { status, lastSent, retry: startTracking, stop: stopTracking };
}
