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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Legal OS Error Boundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#060e1c',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'DM Sans', system-ui, sans-serif"
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '540px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚖️</div>
            <h2 style={{ color: 'var(--gold-400, #c9a84c)', margin: '0 0 8px', fontSize: '1.2rem', fontFamily: "'DM Serif Display', serif" }}>
              Legal OS System Recovery
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: '0 0 20px' }}>
              The application encountered a transient interface exception:
            </p>
            <div style={{
              background: '#030710',
              border: '1px solid rgba(239,83,80,0.3)',
              borderRadius: '4px',
              padding: '12px',
              color: '#ef5350',
              fontSize: '0.75rem',
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'left',
              marginBottom: '20px',
              overflowX: 'auto'
            }}>
              {this.state.error?.message || 'Unknown render error'}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                background: 'linear-gradient(135deg, #c9a84c, #a67c30)',
                color: '#060e1c',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              🔄 Reload Legal OS
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
