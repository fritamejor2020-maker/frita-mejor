import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Service Worker PWA ──────────────────────────────────────────────────────
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-actualizar: aplica el nuevo SW inmediatamente y recarga
    console.log('[PWA] Nueva versión detectada — actualizando automáticamente...');
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    // Chequear actualizaciones cada 10 segundos mientras la app está abierta
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 10_000);
    }
  },
  onOfflineReady() {},
});

// Fallback: recargar automáticamente cuando el nuevo SW toma el control
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
