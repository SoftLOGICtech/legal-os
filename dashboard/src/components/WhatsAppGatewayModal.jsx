import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

export default function WhatsAppGatewayModal({ isOpen, onClose, showToast }) {
  const [statusData, setStatusData] = useState({ status: 'DISCONNECTED', qr: null, phoneNumber: null });
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await apiGet('/api/whatsapp/status');
      const data = await res.json();
      if (data) setStatusData(data);
    } catch (e) {
      console.warn('Could not fetch WhatsApp status:', e.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleReconnect = async () => {
    setLoading(true);
    try {
      await apiPost('/api/whatsapp/reconnect', {});
      if (showToast) showToast('🔄 Initializing Baileys WhatsApp Gateway...', 'info');
      setTimeout(fetchStatus, 1500);
    } catch (e) {
      if (showToast) showToast(`⚠️ Reconnect error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp session?')) return;
    setLoading(true);
    try {
      await apiPost('/api/whatsapp/disconnect', {});
      if (showToast) showToast('🔌 WhatsApp gateway disconnected.', 'info');
      fetchStatus();
    } catch (e) {
      if (showToast) showToast(`⚠️ Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) return;
    setSendingTest(true);
    try {
      const res = await apiPost('/api/whatsapp/send', {
        phone: testPhone.trim(),
        message: testMessage.trim()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch message');
      if (showToast) showToast(`✅ Message dispatched to ${testPhone}!`, 'success');
      setTestMessage('');
    } catch (e) {
      if (showToast) showToast(`⚠️ Send error: ${e.message}`, 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleTriggerReminders = async () => {
    setSendingReminders(true);
    try {
      const res = await apiPost('/api/whatsapp/reminders', { daysAhead: 1 });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reminder scan failed');
      if (showToast) showToast(`📢 Automated reminders dispatched to ${data.sent || 0} clients!`, 'success');
    } catch (e) {
      if (showToast) showToast(`⚠️ Reminders error: ${e.message}`, 'error');
    } finally {
      setSendingReminders(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = statusData.status === 'CONNECTED';
  const qrImageSrc = statusData.qr 
    ? (statusData.qr.startsWith('data:image') || statusData.qr.startsWith('http') ? statusData.qr : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(statusData.qr)}`)
    : (statusData.rawQr ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(statusData.rawQr)}` : null);
  const isQrReady = !isConnected && (statusData.status === 'QR_READY' || !!qrImageSrc);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, backdropFilter: 'blur(6px)', padding: '20px'
    }}>
      <div style={{
        background: 'var(--navy-900)', border: '1px solid var(--gold-500)', borderRadius: '10px',
        width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', color: 'white',
        display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.2rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📱 WhatsApp Gateway & Client Automation Engine
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Self-hosted Baileys engine with automated court reminders, tracking token replies, and Client Care AI
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Connection Status Banner */}
        <div style={{
          background: isConnected ? 'rgba(77,182,172,0.12)' : isQrReady ? 'rgba(201,168,76,0.12)' : 'rgba(239,83,80,0.12)',
          border: `1px solid ${isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-500)' : '#ef5350'}`,
          borderRadius: '8px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{isConnected ? '🟢' : isQrReady ? '🟡' : '🔴'}</span>
              <span>
                {isConnected ? `CONNECTED (${statusData.phoneNumber || 'Linked Phone'})` : isQrReady ? 'PAIRING QR CODE READY' : 'GATEWAY DISCONNECTED'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {isConnected 
                ? 'Incoming tracking queries, court date requests, and fee balance inquiries are answered 24/7 automatically.'
                : isQrReady 
                ? 'Open WhatsApp on your phone > Linked Devices > Link a Device, then scan the QR code below.'
                : 'Click "Start / Reconnect Gateway" to generate a pairing QR code.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isConnected ? (
              <button 
                onClick={handleReconnect}
                disabled={loading}
                className="primary-btn"
                style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: '4px', background: 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
              >
                {loading ? 'Starting...' : '🔄 Start / Refresh QR'}
              </button>
            ) : (
              <button 
                onClick={handleDisconnect}
                disabled={loading}
                className="secondary-btn"
                style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: '4px', borderColor: '#ef5350', color: '#ef5350' }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* QR Code Display if Pairing */}
        {!isConnected && (
          <div style={{ textAlign: 'center', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gold-300)' }}>
              📲 Scan with WhatsApp to Link Firm Number:
            </div>
            {qrImageSrc ? (
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <img src={qrImageSrc} alt="WhatsApp Pairing QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '1.6rem', animation: 'spin 1.5s infinite linear' }}>⚙️</div>
                <span>Click "Start / Refresh QR" above to generate a fresh pairing QR code.</span>
              </div>
            )}
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: '380px' }}>
              Once scanned, your WhatsApp session persists securely in the law firm data vault across server restarts.
            </div>
          </div>
        )}

        {/* Automated Capabilities Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          
          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gold-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ Deterministic Keywords (Zero Rate Limits)
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li><strong>STATUS / TRACK:</strong> Case milestone & advocate</li>
              <li><strong>HEARING / DATES:</strong> Court mentions & Teams link</li>
              <li><strong>FEES / BALANCE:</strong> Retainer balance & Paybill</li>
              <li><strong>KYC / DOCS:</strong> National ID & KRA status</li>
            </ul>
          </div>

          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64b5f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🤖 Client Care AI Fallback
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Answers natural-language client questions regarding previous hearings, proceedings, and procedures in English or Swahili, while adhering to strict legal non-advisory boundaries.
            </p>
          </div>

        </div>

        {/* 1-Click Court Mentions Reminder Broadcast */}
        <div style={{ background: 'var(--navy-950)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📢 Broadcast 24h Court Hearing Reminders
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Scans master calendar for matters with court dates tomorrow and sends automated WhatsApp reminder briefs.
            </div>
          </div>
          <button 
            onClick={handleTriggerReminders}
            disabled={!isConnected || sendingReminders}
            className="primary-btn"
            style={{ padding: '8px 16px', fontSize: '0.78rem', borderRadius: '4px', background: !isConnected ? 'var(--navy-700)' : 'linear-gradient(135deg, #4db6ac, #00897b)', color: 'var(--navy-950)', fontWeight: 700 }}
          >
            {sendingReminders ? 'Scanning & Sending...' : '📢 Send Reminders Now'}
          </button>
        </div>

        {/* Direct Test Dispatch Box */}
        <form onSubmit={handleSendTestMessage} style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold-400)' }}>
            🧪 Quick Test WhatsApp Dispatch
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input 
              type="text"
              placeholder="e.g. 0712345678 or +254712345678"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              style={{ flex: '1 1 180px', background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '8px 12px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
            />
            <input 
              type="text"
              placeholder="Type test message to client..."
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              style={{ flex: '2 1 240px', background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '8px 12px', fontSize: '0.8rem' }}
            />
            <button 
              type="submit"
              disabled={!isConnected || sendingTest || !testPhone.trim() || !testMessage.trim()}
              className="primary-btn"
              style={{ padding: '8px 16px', fontSize: '0.78rem', borderRadius: '4px', background: !isConnected ? 'var(--navy-700)' : 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
            >
              {sendingTest ? 'Sending...' : '⚡ Send Test'}
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            onClick={onClose}
            className="secondary-btn"
            style={{ padding: '8px 18px', fontSize: '0.8rem', borderRadius: '4px' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
