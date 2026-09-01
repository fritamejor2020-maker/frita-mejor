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

// ── Service Worker PWA (Auto-actualización suave sin bucles de recarga) ──
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Nueva versión disponible en segundo plano.');
  },
  onOfflineReady() {
    console.log('[PWA] Aplicación lista para operar sin conexión.');
  },
});

