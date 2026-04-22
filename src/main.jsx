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
    const existing = document.getElementById('sw-update-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'background:#1f2937', 'color:white', 'padding:12px 20px', 'border-radius:16px',
      'display:flex', 'align-items:center', 'gap:12px', 'z-index:99999',
      'box-shadow:0 4px 20px rgba(0,0,0,0.4)', 'font-family:system-ui',
      'font-size:14px', 'font-weight:700', 'max-width:90vw',
    ].join(';');
    banner.innerHTML = `
      <span>🔄 Nueva versión disponible</span>
      <button onclick="window.location.reload()" style="
        background:#10b981;color:white;border:none;border-radius:10px;
        padding:6px 14px;font-weight:900;font-size:13px;cursor:pointer;
      ">Actualizar</button>
    `;
    document.body.appendChild(banner);
  },
  onRegisteredSW(_swUrl, registration) {
    // Chequear actualizaciones cada 30 segundos mientras la app está abierta
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 30_000);
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
