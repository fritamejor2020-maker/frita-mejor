import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        skipWaiting: true,       // Nuevo SW toma el control inmediatamente
        clientsClaim: true,      // Reclamar todos los clientes abiertos
        cleanupOutdatedCaches: true, // Borrar caches viejas automáticamente
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase.*$/i,
            handler: 'NetworkOnly',  // Nunca cachear llamadas a Supabase
          },
        ],
      },
      manifest: {
        name: 'Frita Mejor PWA',
        short_name: 'FritaMejor',
        description: 'Gestión de Producción y Bodega Táctil',
        theme_color: '#FFCD5A',
        background_color: '#FFCD5A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
