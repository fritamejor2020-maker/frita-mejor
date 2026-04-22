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

// Registra el Service Worker de la PWA
// onNeedRefresh: cuando Vercel despliega una nueva versión, recarga automáticamente
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nueva versión disponible → recargar para aplicarla
    window.location.reload();
  },
  onOfflineReady() {
    // App lista para usarse offline (silencioso)
  },
});
