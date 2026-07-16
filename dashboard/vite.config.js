import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Sam Ogola & Co Advocates',
        short_name: 'Legal OS',
        description: 'Legal case management system for Sam Ogola & Co Advocates',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#060e1c',
        theme_color: '#c9a84c',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['productivity', 'business'],
        lang: 'en-KE'
      },
      workbox: {
        // Cache the app shell and static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Network-first for API calls — always try live data first
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours fallback
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        // Enable in dev mode for testing
        enabled: false
      }
    })
  ],
  server: {
    port: 4000
  },
  preview: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4000,
    host: '0.0.0.0',
    allowedHosts: true
  }
})
