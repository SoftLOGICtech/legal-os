// JudiciaryApiSettingsModal.jsx — Strategy B API & Advocate Credentials Configuration
import React, { useState, useEffect } from 'react';
import { BASE, getSession } from '../api';

export default function JudiciaryApiSettingsModal({ onClose, showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pNumber, setPNumber] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [mode, setMode] = useState('sandbox'); // 'sandbox' | 'production'
  const [baseUrl, setBaseUrl] = useState('https://efiling.court.go.ke/api/v1');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  useEffect(() => {
    const session = getSession();
    fetch(`${BASE}/api/judiciary-api/config`, {
      headers: { 'Authorization': `Bearer ${session?.token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data) {
          setPNumber(data.p_number || '');
          setApiKey(data.api_key || '');
          setMode(data.mode || 'sandbox');
          setBaseUrl(data.base_url || 'https://efiling.court.go.ke/api/v1');
          setAutoSyncEnabled(data.auto_sync_enabled === 1 || data.auto_sync_enabled === true);
          setLastSyncAt(data.last_sync_at || null);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const session = getSession();
      const res = await fetch(`${BASE}/api/judiciary-api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          p_number: pNumber,
          api_key: apiKey,
          mode: mode,
          base_url: baseUrl,
          auto_sync_enabled: autoSyncEnabled
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save API config');

      showToast('⚙️ Judiciary API Integration Settings Saved!', 'success');
      onClose();
    } catch (err) {
      showToast(`⚠️ Error: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
    }}>
      <div style={{
        background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'12px',
        width:'100%', maxWidth:'620px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 50px rgba(0,0,0,0.8)',
        padding:'24px 28px', color:'white'
      }}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'14px', marginBottom:'20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <span style={{fontSize:'1.6rem'}}>🏛️</span>
            <div>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.1rem'}}>
                Kenya Judiciary Live REST API Integration (Strategy B)
              </h3>
              <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                Direct connection to efiling.court.go.ke / CTS Cause Lists & M-Pesa 553388 Verification
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>✕</button>
        </div>

        {loading ? (
          <div style={{padding:'40px', textAlign:'center', color:'var(--gold-400)'}}>Loading Judiciary API settings...</div>
        ) : (
          <form onSubmit={handleSaveConfig} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            
            {/* Status Badge */}
            <div style={{
              background: mode === 'sandbox' ? 'rgba(255,152,0,0.12)' : 'rgba(77,182,172,0.12)',
              border: mode === 'sandbox' ? '1px solid rgba(255,152,0,0.4)' : '1px solid rgba(77,182,172,0.4)',
              padding:'12px 16px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'
            }}>
              <div>
                <div style={{fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700}}>
                  Active Connection Environment
                </div>
                <div style={{fontSize:'0.95rem', fontWeight:700, color: mode === 'sandbox' ? '#ff9800' : '#4db6ac', marginTop:'2px'}}>
                  {mode === 'sandbox' ? '🧪 Interactive Local Sandbox Driver (Pre-Approved)' : '🟢 Live Judiciary Production REST API'}
                </div>
              </div>
              <span className="badge" style={{background:'var(--navy-950)', color:'var(--gold-400)'}}>
                {mode.toUpperCase()}
              </span>
            </div>

            {/* Mode Selector */}
            <div>
              <label style={{fontSize:'0.8rem', fontWeight:700, color:'var(--gold-400)'}}>Environment Engine Mode:</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
              >
                <option value="sandbox">🧪 Sandbox Driver (Local Demo & Offline Testing)</option>
                <option value="production">🟢 Live eFiling REST API (Requires Judiciary ICT API Key)</option>
              </select>
            </div>

            {/* Advocate P-Number */}
            <div>
              <label style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Advocate LSK P-Number:</label>
              <input
                type="text"
                value={pNumber}
                onChange={e => setPNumber(e.target.value)}
                placeholder="e.g. P.105/18920/26"
                style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
              />
            </div>

            {/* API Key */}
            <div>
              <label style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Judiciary Enterprise API Secret Key:</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={mode === 'sandbox' ? 'Sandbox API Key (Auto-Generated)' : 'Paste official Judiciary ICT API Key'}
                style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
              />
            </div>

            {/* Base Endpoint URL */}
            <div>
              <label style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Judiciary API Gateway URL:</label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://efiling.court.go.ke/api/v1"
                style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
              />
            </div>

            {/* Auto-Sync Toggle */}
            <div style={{background:'var(--navy-800)', padding:'12px 16px', borderRadius:'8px', border:'1px solid var(--border-default)'}}>
              <label style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'0.82rem', cursor:'pointer', margin:0}}>
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={e => setAutoSyncEnabled(e.target.checked)}
                />
                Enable Background CTS Cause List & Milestone Polling (Every 60 Minutes)
              </label>
            </div>

            {/* Actions */}
            <div style={{display:'flex', justifyContent:'flex-end', gap:'12px', marginTop:'10px'}}>
              <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="primary-btn" style={{padding:'10px 20px', fontWeight:700}} disabled={saving}>
                {saving ? 'Saving Config...' : '💾 Save API Integration Settings'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
