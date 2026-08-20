import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  server: {
    proxy: {
      '/isapi-proxy': {
        target: 'http://192.168.3.220:80',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/isapi-proxy/, ''),
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        importScripts: ['/sw-custom.js'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase.*$/i,
            handler: 'NetworkOnly',
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
