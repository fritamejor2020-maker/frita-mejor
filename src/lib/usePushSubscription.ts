import { useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';

// ──────────────────────────────────────────────────────────────
// usePushSubscription
// Hook para gestionar la suscripción Web Push del Dejador.
//
// Uso:
//   const { subscribe, unsubscribe, permissionState } = usePushSubscription();
//   await subscribe(openedAt);    // al iniciar turno
//   await unsubscribe(openedAt);  // al cerrar turno
// ──────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Convierte la clave VAPID base64 a Uint8Array (requerido por el navegador) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Obtiene el Service Worker activo registrado por la PWA */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service Workers no soportados en este navegador');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('[Push] Service Worker ready timeout/error:', err);
    return null;
  }
}

export function usePushSubscription() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Pre-registrar el SW al montar
  useEffect(() => {
    getServiceWorkerRegistration().then((reg) => {
      registrationRef.current = reg;
    });

    // Escuchar mensajes del SW (e.g. PUSH_SUBSCRIPTION_CHANGED)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        console.log('[Push] Suscripción rotada por el navegador — actualizando en Supabase');
        // Re-guardar la nueva suscripción
        saveSubscriptionToSupabase(event.data.subscription, 'rotation');
      }
      if (event.data?.type === 'NAVIGATE') {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  /** Guarda la suscripción push en la tabla push_subscriptions de Supabase */
  const saveSubscriptionToSupabase = async (
    sub: PushSubscriptionJSON,
    shiftOpenedAt: string
  ) => {
    const subJson = sub;
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;

    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', 'push_subscriptions').maybeSingle();
      const existing = Array.isArray(data?.value) ? data.value : [];
      const filtered = existing.filter((s: any) => s.endpoint !== subJson.endpoint);
      const newSub = {
        shift_opened_at: shiftOpenedAt,
        endpoint:        subJson.endpoint,
        p256dh:          subJson.keys.p256dh,
        auth:            subJson.keys.auth,
        updated_at:      new Date().toISOString(),
      };
      const merged = [newSub, ...filtered];
      await supabase.from('app_state').upsert({ key: 'push_subscriptions', value: merged, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      console.log('[Push] Suscripción guardada en app_state ✅');
    } catch (err: any) {
      console.warn('[Push] Error guardando suscripción:', err?.message);
    }
  };

  /**
   * Suscribir al Dejador a las notificaciones push.
   * Llama esto al INICIAR el turno.
   */
  const subscribe = useCallback(async (shiftOpenedAt: string): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY no configurada — sin push notifications');
      return false;
    }

    // Verificar soporte
    if (!('Notification' in window) || !('PushManager' in window)) {
      console.warn('[Push] Push Notifications no soportadas en este navegador/OS');
      return false;
    }

    // Pedir permiso al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Permiso de notificaciones denegado');
      return false;
    }

    const registration = registrationRef.current || await getServiceWorkerRegistration();
    if (!registration) return false;
    registrationRef.current = registration;

    try {
      // Ver si ya hay una suscripción activa
      let subscription = await registration.pushManager.getSubscription();

      // Si no hay suscripción, crear una nueva
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await saveSubscriptionToSupabase(subscription.toJSON(), shiftOpenedAt);
      return true;
    } catch (err) {
      console.error('[Push] Error al suscribirse:', err);
      return false;
    }
  }, []);

  /**
   * Desuscribir al Dejador de las notificaciones push.
   * Llama esto al CERRAR el turno.
   */
  const unsubscribe = useCallback(async (shiftOpenedAt: string): Promise<void> => {
    // Eliminar de app_state
    try {
      const { data } = await supabase.from('app_state').select('value').eq('key', 'push_subscriptions').maybeSingle();
      const existing = Array.isArray(data?.value) ? data.value : [];
      const filtered = existing.filter((s: any) => s.shift_opened_at !== shiftOpenedAt);
      await supabase.from('app_state').upsert({ key: 'push_subscriptions', value: filtered, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    } catch (e) {
      console.warn('[Push] Error eliminando suscripción de app_state:', e);
    }

    // Cancelar la suscripción en el navegador
    try {
      const registration = registrationRef.current || await getServiceWorkerRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
    } catch (err) {
      console.warn('[Push] Error al desuscribirse:', err);
    }

    console.log('[Push] Suscripción eliminada — Dejador sin notificaciones');
  }, []);

  /** Estado del permiso de notificaciones */
  const permissionState: NotificationPermission =
    'Notification' in window ? Notification.permission : 'default';

  return { subscribe, unsubscribe, permissionState };
}
