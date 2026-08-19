import React, { useState, useEffect } from 'react';

/**
 * Persona-Driven Home Dashboard Component
 * Dynamically transforms between Advocate, Accountant,
 * Paralegal, and Managing Partner (Executive KPI-style) Dashboards.
 */
export default function HomeDashboard({
  cases = [],
  leads = [],
  calendar = [],
  upcoming48h = [],
  userRole = 'advocate',
  accountPersona = 'advocate',
  filterBy = 'all',
  setFilterBy,
  setActiveTab,
  setActiveMatterId,
  setSelectedCase,
  setShowJudiciaryIngestionModal,
  setShowNewLeadModal,
  requestNotificationPermission,
  notificationPermission = 'default',
  userDisplayName = 'Advocate'
}) {
  const activeCases = cases.filter(c => c.current_milestone !== 'CLOSED');
  const pendingLeads = leads.filter(l => !l.consultation_date && l.status !== 'converted' && l.status !== 'archived');
  const urgentAlerts = leads.filter(l => l.is_emergency === 1 || l.message?.includes('[URGENT]'));

  // Calculate Financial Metrics for Accountant / Partner dashboards
  const totalTrustBalance = cases.reduce((sum, c) => sum + (c.trust_balance || 0), 0);
  const totalOutstanding = cases.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);
  const totalFeeRevenue = cases.reduce((sum, c) => sum + (c.total_fee || 0), 0);

  // PWA Install Prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installState, setInstallState] = useState('idle');
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setInstallState('installed');
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIos || isSafari) {
      setInstallState('ios');
      return;
    }
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (installState === 'ios') {
      setShowIosHint(h => !h);
      return;
    }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallState('installed');
      setInstallPrompt(null);
    }
  };

  const extractTeamsUrl = (notesStr) => {
    if (!notesStr) return null;
    const match = notesStr.match(/(https?:\/\/[^\s>]+teams[^\s>]+)/i);
    return match ? match[1] : null;
  };

  return (
    <div className="home-dashboard-wrapper" style={{ width: '100%' }}>
      {/* Greeting Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {accountPersona === 'advocate' ? '⚖️ Advocate Litigation Command Center' :
             accountPersona === 'accountant' ? '💰 Client Trust & Operating Accounting Hub' :
             accountPersona === 'paralegal' ? '📂 Paralegal Document Operations Desk' :
             '🏛️ Managing Partner Executive Dashboard'}
          </div>
          <h2 style={{ margin: '4px 0 0 0', color: 'white', fontSize: '1.4rem' }}>
            Habari, {userDisplayName.split(' ')[0]} 👋
          </h2>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {activeCases.length} Active Matters • {upcoming48h.length} Court Dates Scheduled
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('matters')}
            className="primary-btn"
            style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700 }}
          >
            ⚖️ View Active Matters
          </button>

          <button
            onClick={requestNotificationPermission}
            className="secondary-btn"
            style={{
              borderColor: notificationPermission === 'granted' ? '#4db6ac' : 'var(--gold-500)',
              color: notificationPermission === 'granted' ? '#4db6ac' : 'var(--gold-400)',
              fontWeight: 700,
              fontSize: '0.78rem'
            }}
          >
            {notificationPermission === 'granted' ? '🔔 Alerts Active' : '🔔 Enable Court Alerts'}
          </button>
        </div>
      </div>

      {/* ── PERSONA 1: ADVOCATE DASHBOARD (Litigation / Trial Style) ── */}
      {accountPersona === 'advocate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Action Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <button className="primary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700 }} onClick={() => setShowJudiciaryIngestionModal && setShowJudiciaryIngestionModal(true)}>
              <span>⚡</span>
              <span>PDF Engine</span>
            </button>
            <button className="secondary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }} onClick={() => setActiveTab('matters')}>
              <span>⚖️</span>
              <span>Active Matters ({activeCases.length})</span>
            </button>
            <button className="secondary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }} onClick={() => setActiveTab('calendar')}>
              <span>📅</span>
              <span>Court Calendar</span>
            </button>
            <button className="secondary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--gold-400)', borderColor: 'var(--gold-500)' }} onClick={() => setActiveTab('soca_pa')}>
              <span>🤖</span>
              <span>SocaBot Co-Counsel</span>
            </button>
          </div>

          {/* Today's Court List & Virtual Courtroom */}
          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '18px 20px' }}>
            <h4 style={{ margin: '0 0 14px 0', color: 'var(--gold-400)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏛️</span> Today's Court Mentions & Hearings ({upcoming48h.length})
            </h4>

            {upcoming48h.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '18px 0' }}>
                🌴 No court mentions scheduled in the next 48 hours.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming48h.map(ev => {
                  const teamsLink = extractTeamsUrl(ev.notes);
                  return (
                    <div key={ev.id} style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderLeft: '4px solid var(--gold-500)', padding: '12px 16px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <strong style={{ color: 'white', fontSize: '0.9rem' }}>{ev.event_title}</strong>
                        <span style={{ color: 'var(--gold-400)', fontSize: '0.78rem', fontWeight: 700 }}>
                          ⏰ {new Date(ev.event_date).toLocaleString('en-KE')}
                        </span>
                      </div>
                      {teamsLink && (
                        <a href={teamsLink} target="_blank" rel="noreferrer" className="primary-btn" style={{ textDecoration: 'none', marginTop: '8px', display: 'inline-flex', padding: '4px 10px', fontSize: '0.75rem' }}>
                          💻 Join MS Teams Virtual Courtroom
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PERSONA 2: ACCOUNTANT DASHBOARD (Clio Finance Style) ── */}
      {accountPersona === 'accountant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Financial Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '18px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Client Trust Account (Escrow)</div>
              <div style={{ fontSize: '1.6rem', color: 'var(--green-400)', fontWeight: 800, marginTop: '4px' }}>KES {totalTrustBalance.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '18px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding Fee Balances</div>
              <div style={{ fontSize: '1.6rem', color: '#ef5350', fontWeight: 800, marginTop: '4px' }}>KES {totalOutstanding.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '18px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Billed Revenue</div>
              <div style={{ fontSize: '1.6rem', color: 'var(--gold-400)', fontWeight: 800, marginTop: '4px' }}>KES {totalFeeRevenue.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="primary-btn" onClick={() => setActiveTab('finance')} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>+ Log Deposit / Fee Note</button>
            <button className="secondary-btn" onClick={() => setActiveTab('matters')} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>🏦 Client Ledgers</button>
          </div>
        </div>
      )}

      {/* ── PERSONA 3: PARALEGAL DASHBOARD (Ops Style) ── */}
      {accountPersona === 'paralegal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <button className="primary-btn" style={{ padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }} onClick={() => setShowJudiciaryIngestionModal && setShowJudiciaryIngestionModal(true)}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>PDF Engine</span>
            </button>
            <button className="secondary-btn" style={{ padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }} onClick={() => setActiveTab('matters')}>
              <span style={{ fontSize: '1.4rem' }}>⚖️</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Active Matters</span>
            </button>
            <button className="secondary-btn" style={{ padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }} onClick={() => setActiveTab('leads')}>
              <span style={{ fontSize: '1.4rem' }}>📥</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Client Leads ({pendingLeads.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── PERSONA 4: MANAGING PARTNER DASHBOARD (Executive KPI Style) ── */}
      {accountPersona === 'partner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="large-stat-card">
              <div className="large-stat-card__val">{activeCases.length}</div>
              <div className="large-stat-card__label">Active Client Matters</div>
              <div className="large-stat-card__icon">⚖️</div>
            </div>
            <div className="large-stat-card">
              <div className="large-stat-card__val" style={{ color: 'var(--green-400)' }}>KES {(totalFeeRevenue / 1000000).toFixed(1)}M</div>
              <div className="large-stat-card__label">Firm Fee Revenue</div>
              <div className="large-stat-card__icon">💰</div>
            </div>
            <div className="large-stat-card">
              <div className="large-stat-card__val">{pendingLeads.length}</div>
              <div className="large-stat-card__label">Pending CRM Intakes</div>
              <div className="large-stat-card__icon">📥</div>
            </div>
          </div>
        </div>
      )}

      {/* ── GLOBAL CUSTOMIZATION & THEME SUITE (For all account types) ── */}
      <div style={{
        background: 'var(--navy-800)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '0.95rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎨</span> Chambers Canvas & Theme Personalization
            </h3>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Choose your preferred workspace canvas background and highlight palette. Persists across all sessions.
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--gold-300)', background: 'rgba(201,168,76,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(201,168,76,0.2)' }}>
            Active Profile: {userRole.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Background Canvas Mode Selector */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>
              1. Canvas Background Mode
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { id: 'navy', label: '🌌 Midnight Blue', desc: 'Classic Chambers' },
                { id: 'black', label: '🌑 Pitch Black', desc: 'Pure OLED Dark' },
                { id: 'beige', label: '📜 Warm Beige', desc: 'Artisan Parchment' }
              ].map(bg => {
                const isSelected = (localStorage.getItem('legal_os_bg_theme') || 'navy') === bg.id;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => {
                      const root = document.documentElement;
                      root.setAttribute('data-bg-theme', bg.id);
                      localStorage.setItem('legal_os_bg_theme', bg.id);
                      window.dispatchEvent(new Event('storage'));
                      // Force re-render
                      const evt = new CustomEvent('themeChange', { detail: { bg: bg.id } });
                      window.dispatchEvent(evt);
                    }}
                    style={{
                      background: isSelected ? 'var(--gold-500)' : 'var(--navy-950)',
                      color: isSelected ? 'var(--navy-950)' : 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      padding: '10px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.82rem' }}>{bg.label}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{bg.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palette Selector */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>
              2. Accent & Lettering Palette
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { id: 'gold', name: 'Regal Gold', dot: '#C9A84C', primary: '#C9A84C', light: '#DFC06A', bright: '#EDD98B', gradient: 'linear-gradient(135deg, #C9A84C 0%, #EDD98B 50%, #C9A84C 100%)', glow: 'rgba(201, 168, 76, 0.25)' },
                { id: 'teal', name: 'Patina Teal', dot: '#4DB6AC', primary: '#26A69A', light: '#4DB6AC', bright: '#80CBC4', gradient: 'linear-gradient(135deg, #26A69A 0%, #80CBC4 50%, #26A69A 100%)', glow: 'rgba(77, 182, 172, 0.25)' },
                { id: 'crimson', name: 'Crimson', dot: '#E53935', primary: '#E53935', light: '#EF5350', bright: '#E57373', gradient: 'linear-gradient(135deg, #C62828 0%, #EF5350 50%, #C62828 100%)', glow: 'rgba(229, 57, 53, 0.25)' },
                { id: 'sapphire', name: 'Sapphire', dot: '#3B82F6', primary: '#2563EB', light: '#3B82F6', bright: '#93C5FD', gradient: 'linear-gradient(135deg, #1D4ED8 0%, #60A5FA 50%, #1D4ED8 100%)', glow: 'rgba(59, 130, 246, 0.25)' },
                { id: 'emerald', name: 'Emerald', dot: '#10B981', primary: '#059669', light: '#10B981', bright: '#6EE7B7', gradient: 'linear-gradient(135deg, #047857 0%, #34D399 50%, #047857 100%)', glow: 'rgba(16, 185, 129, 0.25)' },
                { id: 'amethyst', name: 'Amethyst', dot: '#8B5CF6', primary: '#7C3AED', light: '#8B5CF6', bright: '#C4B5FD', gradient: 'linear-gradient(135deg, #6D28D9 0%, #A78BFA 50%, #6D28D9 100%)', glow: 'rgba(139, 92, 246, 0.25)' }
              ].map(t => {
                const isSelected = (localStorage.getItem('legal_os_theme') || 'gold') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const root = document.documentElement;
                      root.style.setProperty('--gold-500', t.primary);
                      root.style.setProperty('--gold-400', t.light);
                      root.style.setProperty('--gold-300', t.bright);
                      root.style.setProperty('--gold-gradient', t.gradient);
                      root.style.setProperty('--theme-glow', t.glow);
                      localStorage.setItem('legal_os_theme', t.id);
                      const evt = new CustomEvent('themeChange', { detail: { accent: t.id } });
                      window.dispatchEvent(evt);
                    }}
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.12)' : 'var(--navy-950)',
                      border: isSelected ? `2px solid ${t.dot}` : '1px solid var(--border-default)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.dot, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${t.dot}` }} />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
