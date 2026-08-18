import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { useSellerSessionStore } from '../store/useSellerSessionStore';

/**
 * Hook: detecta cuando el Admin cierra remotamente el turno del Vendedor.
 *
 * Cómo funciona:
 * 1. Se suscribe en tiempo real a cambios en la tabla app_state para las llaves de posShifts.
 * 2. Cuando detecta un cambio, verifica si el shiftId activo ya fue marcado como cerrado.
 * 3. Si fue cerrado, limpia la sesión local y redirige al vendedor a la pantalla de configuración.
 *
 * También hace polling cada 10s como fallback en caso de que Realtime falle.
 */
export function useRemoteShiftClose() {
  const { shiftId, isSetupComplete, endShift } = useSellerSessionStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSetupComplete || !shiftId) return;

    let cancelled = false;

    const checkIfClosed = async () => {
      try {
        const { data } = await supabase
          .from('app_state')
          .select('value')
          .in('key', ['posShifts', 'posShifts_BRANCH-001']);

        if (!data || cancelled) return;

        const allShifts = data.flatMap((r: any) => r.value || []);
        const myShift = allShifts.find((s: any) => s.id === shiftId);

        if (myShift?.closedAt) {
          console.log('[RemoteShiftClose] Turno cerrado remotamente. Cerrando sesion local...');
          endShift();
          if (!cancelled) navigate('/vendedor-setup', { replace: true });
        }
      } catch (e) {
        // Silencioso — el polling es un fallback
      }
    };

    // Verificacion inmediata al montar
    checkIfClosed();

    // Polling de respaldo cada 10 segundos
    const interval = setInterval(checkIfClosed, 10000);

    // Suscripcion Realtime a cambios en app_state
    const channel = supabase
      .channel(`remote-shift-close-${shiftId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_state',
        },
        async (payload: any) => {
          const key = payload.new?.key;
          if (!key || !key.startsWith('posShifts')) return;

          const shifts = payload.new?.value;
          if (!Array.isArray(shifts)) return;

          const myShift = shifts.find((s: any) => s.id === shiftId);
          if (myShift?.closedAt) {
            console.log('[RemoteShiftClose] Realtime: turno cerrado remotamente.');
            endShift();
            if (!cancelled) navigate('/vendedor-setup', { replace: true });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [shiftId, isSetupComplete, endShift, navigate]);
}
