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
        // Automatically activate new service worker versions immediately
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Cache static media and assets, never index.html or API endpoints
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}']
      },
      devOptions: {
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
