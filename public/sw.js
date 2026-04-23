// ============================================================
// FRITA MEJOR — Service Worker
// Maneja push notifications en background (app cerrada / bloqueada)
// ============================================================

const APP_VERSION = 'v1';

// ── Activación inmediata sin esperar que se cierren otras tabs ──
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Recibir push del servidor ────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }

  const title   = data.title  || '🛵 Nuevo Pedido — Frita Mejor';
  const body    = data.body   || 'Un vendedor necesita surtido';
  const pointId = data.pointId || '';
  const items   = data.items  || '';

  const options = {
    body:    items ? `${body}\n${items}` : body,
    icon:    '/logo.png',
    badge:   '/logo.png',
    vibrate: [200, 100, 200, 100, 300],
    tag:     `pedido-${data.requestId || Date.now()}`,  // evita apilar la misma notif
    renotify: true,   // vibra aunque ya exista la misma tag
    requireInteraction: true,  // no desaparece sola en Android
    data: {
      url:       '/dejador',
      requestId: data.requestId,
      pointId,
    },
    actions: [
      { action: 'open', title: '📋 Ver pedido' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Click en la notificación → abrir / enfocar la app ───────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/dejador';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña abierta con la app → enfocarla
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Si no → abrir nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Push subscription change (rotación de claves del navegador) ─
self.addEventListener('pushsubscriptionchange', (event) => {
  // Re-suscribirse automáticamente si el navegador rota las claves
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.__VAPID_PUBLIC_KEY__,
    }).then((subscription) => {
      // Notificar al cliente para que actualice la suscripción en Supabase
      return self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({
          type: 'PUSH_SUBSCRIPTION_CHANGED',
          subscription: subscription.toJSON(),
        }));
      });
    })
  );
});
