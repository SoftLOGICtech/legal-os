import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000
  },
  preview: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4000,
    host: '0.0.0.0',
    allowedHosts: true
  }
})

