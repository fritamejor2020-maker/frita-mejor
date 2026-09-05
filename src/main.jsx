import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// 🛡️ Auto-recuperación ante nuevos despliegues de Vercel (Vite dynamic import chunk failure)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const lastReload = sessionStorage.getItem('chunk_reload_ts');
    const now = Date.now();
    if (!lastReload || (now - Number(lastReload)) > 10000) {
      sessionStorage.setItem('chunk_reload_ts', String(now));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Service Worker PWA (Auto-actualización suave en Desktop / Bypass en Tablets para evitar saturación de RAM) ──
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const isMobileOrTablet = /Android|iPad|iPhone|iPod|Tablet/i.test(navigator.userAgent);
  if (isMobileOrTablet) {
    // 🛡️ En tablets y móviles Android: Desactivar Service Worker para evitar colapso de RAM de Chromium (Aw Snap / Ups)
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        reg.unregister();
      }
    }).catch(() => {});
  } else {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] Nueva versión disponible en segundo plano.');
      },
      onOfflineReady() {
        console.log('[PWA] Aplicación lista para operar sin conexión.');
      },
    });
  }
}

