import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import { registerSW } from 'virtual:pwa-register'

// Register the PWA service worker only if we are in the browser (not Electron)
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
if (!isElectron) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
