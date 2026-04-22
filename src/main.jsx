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
// Con skipWaiting+clientsClaim en vite.config, el nuevo SW toma el control
// apenas Vercel despliega. Escuchamos 'controllerchange' para recargar la página.
registerSW({ immediate: true });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
