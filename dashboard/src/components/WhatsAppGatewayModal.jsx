import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';
import { WhatsAppIcon, SyncIcon, ShieldIcon, SendIcon, BellIcon } from './Icons';

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
      if (showToast) showToast('Initializing Baileys WhatsApp Gateway...', 'info');
      setTimeout(fetchStatus, 1500);
    } catch (e) {
      if (showToast) showToast(`Reconnect error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp session?')) return;
    setLoading(true);
    try {
      await apiPost('/api/whatsapp/disconnect', {});
      if (showToast) showToast('WhatsApp gateway disconnected.', 'info');
      fetchStatus();
    } catch (e) {
      if (showToast) showToast(`Error: ${e.message}`, 'error');
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
      if (showToast) showToast(`Message dispatched to ${testPhone}`, 'success');
      setTestMessage('');
    } catch (e) {
      if (showToast) showToast(`Send error: ${e.message}`, 'error');
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
      if (showToast) showToast(`Automated reminders dispatched to ${data.sent || 0} clients`, 'success');
    } catch (e) {
      if (showToast) showToast(`Reminders error: ${e.message}`, 'error');
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
      background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, backdropFilter: 'blur(6px)', padding: '20px'
    }}>
      <div style={{
        background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)',
        width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', color: 'white',
        display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: 'var(--shadow-navy, 0 4px 20px rgba(0,0,0,0.7))'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WhatsAppIcon size={16} color="var(--gold-400)" />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.1rem', fontFamily: 'var(--font-display)' }}>
                WhatsApp Client Dispatch Gateway
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Direct integration with automated cause list reminders and status tracking
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Connection Status Banner */}
        <div style={{
          background: isConnected ? 'rgba(77,182,172,0.08)' : isQrReady ? 'rgba(201,168,76,0.08)' : 'rgba(239,83,80,0.08)',
          border: `1px solid ${isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-500)' : '#ef5350'}`,
          borderRadius: 'var(--radius-sm, 3px)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350', display: 'inline-block' }} />
              <span>
                {isConnected ? `CONNECTED (${statusData.phoneNumber || 'Firm Line'})` : isQrReady ? 'PAIRING QR CODE READY' : 'GATEWAY DISCONNECTED'}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {isConnected 
                ? 'Client case status inquiries and scheduled hearing notices are processed automatically.'
                : isQrReady 
                ? 'Open WhatsApp on your mobile device > Linked Devices > Link a Device, then scan the QR code below.'
                : 'Click "Start / Refresh Gateway" to generate a pairing QR code.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isConnected ? (
              <button 
                onClick={handleReconnect}
                disabled={loading}
                className="primary-btn"
                style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 700 }}
              >
                {loading ? 'Starting...' : 'Start / Refresh Gateway'}
              </button>
            ) : (
              <button 
                onClick={handleDisconnect}
                disabled={loading}
                className="secondary-btn"
                style={{ padding: '7px 14px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm, 3px)', borderColor: '#ef5350', color: '#ef5350' }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* QR Code Display if Pairing */}
        {!isConnected && (
          <div style={{ textAlign: 'center', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold-400)' }}>
              Scan with WhatsApp to Link Firm Number:
            </div>
            {qrImageSrc ? (
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm, 3px)', display: 'inline-block' }}>
                <img src={qrImageSrc} alt="WhatsApp Pairing QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span>Click "Start / Refresh Gateway" to initialize a pairing session.</span>
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '380px' }}>
              Your session credentials persist securely in the chambers encrypted vault across service restarts.
            </div>
          </div>
        )}

        {/* Capabilities Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Standard Inbound Keywords
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li><strong>STATUS:</strong> Procedural milestone & assigned lawyer</li>
              <li><strong>HEARING:</strong> Cause list mention date & MS Teams link</li>
              <li><strong>FEES:</strong> Fee notes & Paybill remittance info</li>
              <li><strong>KYC:</strong> ID and documents verification status</li>
            </ul>
          </div>

          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64b5f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Client Notice Assistant
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Provides verified matter updates and hearing reminders in English or Swahili, adhering strictly to non-advisory statutory boundaries.
            </p>
          </div>
        </div>

        {/* 1-Click Court Mentions Reminder Broadcast */}
        <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BellIcon size={14} color="var(--gold-400)" />
              <span>Broadcast 24h Hearing Reminders</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Scans master calendar for matters with mentions tomorrow and dispatches WhatsApp notices.
            </div>
          </div>
          <button 
            onClick={handleTriggerReminders}
            disabled={!isConnected || sendingReminders}
            className="primary-btn"
            style={{ padding: '8px 16px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 700 }}
          >
            {sendingReminders ? 'Scanning & Sending...' : 'Dispatch Reminders'}
          </button>
        </div>

        {/* Direct Test Dispatch Box */}
        <form onSubmit={handleSendTestMessage} style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Direct Dispatch Test
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input 
              type="text"
              placeholder="e.g. 0712345678"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              style={{ flex: '1 1 160px', background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', color: 'white', padding: '8px 12px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
            />
            <input 
              type="text"
              placeholder="Notice text to dispatch..."
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              style={{ flex: '2 1 220px', background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', color: 'white', padding: '8px 12px', fontSize: '0.8rem' }}
            />
            <button 
              type="submit"
              disabled={!isConnected || sendingTest || !testPhone.trim() || !testMessage.trim()}
              className="primary-btn"
              style={{ padding: '8px 16px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 700 }}
            >
              {sendingTest ? 'Sending...' : 'Dispatch Notice'}
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            onClick={onClose}
            className="secondary-btn"
            style={{ padding: '7px 16px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm, 3px)' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
