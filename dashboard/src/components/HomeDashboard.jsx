import React, { useState, useEffect } from 'react';
import {
  ScalesIcon, CalendarIcon, IngestionIcon, AssistantIcon, LedgerIcon,
  IntakeIcon, BellIcon, ClockIcon, VaultIcon, BriefcaseIcon, SettingsIcon,
  ShieldIcon, AlertIcon, SyncIcon
} from './Icons';

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
  userDisplayName = 'Advocate',
  syncState = { isConnected: false, lastSyncedAt: null, pendingOutboxCount: 0, isSyncing: false, remoteUrl: '' },
  handleTriggerSync,
  refreshSyncStatus
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
        background: 'var(--navy-900)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 4px)',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldIcon size={14} color="var(--gold-400)" />
            <span>
              {accountPersona === 'advocate' ? 'Advocate Litigation Operations Center' :
               accountPersona === 'accountant' ? 'Client Trust & Operating Accounting Hub' :
               accountPersona === 'paralegal' ? 'Paralegal Document Operations Desk' :
               'Managing Partner Executive Chambers'}
            </span>
          </div>
          <h2 style={{ margin: '4px 0 0 0', color: 'white', fontSize: '1.35rem', letterSpacing: '0.01em' }}>
            Welcome back, {userDisplayName.split(' ')[0]}
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {activeCases.length} Active Client Matters &bull; {upcoming48h.length} Superior Court Hearings Scheduled
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('matters')}
            className="primary-btn"
            style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ScalesIcon size={14} color="var(--navy-950)" />
            <span>View Active Matters</span>
          </button>

          <button
            onClick={requestNotificationPermission}
            className="secondary-btn"
            style={{
              borderColor: notificationPermission === 'granted' ? '#4db6ac' : 'var(--gold-500)',
              color: notificationPermission === 'granted' ? '#4db6ac' : 'var(--gold-400)',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BellIcon size={14} color={notificationPermission === 'granted' ? '#4db6ac' : 'var(--gold-400)'} />
            <span>{notificationPermission === 'granted' ? 'Court Alerts Active' : 'Enable Court Alerts'}</span>
          </button>
        </div>
      </div>

      {/* ── PERSONA 1: ADVOCATE DASHBOARD (Litigation / Trial Style) ── */}
      {accountPersona === 'advocate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Action Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <button className="primary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700 }} onClick={() => setShowJudiciaryIngestionModal && setShowJudiciaryIngestionModal(true)}>
              <IngestionIcon size={16} color="var(--navy-950)" />
              <span>PDF Engine</span>
            </button>
            <button className="secondary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }} onClick={() => setActiveTab('matters')}>
              <ScalesIcon size={16} />
              <span>Active Matters ({activeCases.length})</span>
            </button>
            <button className="secondary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }} onClick={() => setActiveTab('calendar')}>
              <CalendarIcon size={16} />
              <span>Court Calendar</span>
            </button>
            <button className="secondary-btn" style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--gold-400)', borderColor: 'var(--gold-500)' }} onClick={() => setActiveTab('soca_pa')}>
              <AssistantIcon size={16} color="var(--gold-400)" />
              <span>Co-Counsel Desk</span>
            </button>
          </div>

          {/* Today's Court List & Virtual Courtroom */}
          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)', padding: '18px 20px' }}>
            <h4 style={{ margin: '0 0 14px 0', color: 'var(--gold-400)', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <CalendarIcon size={16} color="var(--gold-400)" />
              <span>Court Mentions & Hearings in 48 Hours ({upcoming48h.length})</span>
            </h4>

            {upcoming48h.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '18px 0' }}>
                No court mentions or hearings scheduled in the immediate 48-hour window.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming48h.map(ev => {
                  const teamsLink = extractTeamsUrl(ev.notes);
                  return (
                    <div key={ev.id} style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '12px 16px', borderRadius: 'var(--radius-sm, 3px)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <strong style={{ color: 'white', fontSize: '0.88rem' }}>{ev.event_title}</strong>
                        <span style={{ color: 'var(--gold-400)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ClockIcon size={12} color="var(--gold-400)" />
                          <span>{new Date(ev.event_date).toLocaleString('en-KE')}</span>
                        </span>
                      </div>
                      {teamsLink && (
                        <a href={teamsLink} target="_blank" rel="noreferrer" className="primary-btn" style={{ textDecoration: 'none', marginTop: '8px', display: 'inline-flex', padding: '4px 10px', fontSize: '0.75rem' }}>
                          Join Virtual Courtroom (MS Teams)
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
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '18px', borderRadius: 'var(--radius-md, 4px)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Client Trust Account (Escrow)</div>
              <div style={{ fontSize: '1.5rem', color: '#4DB6AC', fontWeight: 700, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>KES {totalTrustBalance.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '18px', borderRadius: 'var(--radius-md, 4px)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Outstanding Fee Balances</div>
              <div style={{ fontSize: '1.5rem', color: '#EF5350', fontWeight: 700, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>KES {totalOutstanding.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '18px', borderRadius: 'var(--radius-md, 4px)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Total Billed Revenue</div>
              <div style={{ fontSize: '1.5rem', color: 'var(--gold-400)', fontWeight: 700, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>KES {totalFeeRevenue.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="primary-btn" onClick={() => setActiveTab('finance')} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>+ Log Deposit / Fee Note</button>
            <button className="secondary-btn" onClick={() => setActiveTab('matters')} style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LedgerIcon size={14} />
              <span>Client Ledgers</span>
            </button>
          </div>
        </div>
      )}

      {/* ── PERSONA 3: PARALEGAL DASHBOARD (Ops Style) ── */}
      {accountPersona === 'paralegal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <button className="primary-btn" style={{ padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-md, 4px)' }} onClick={() => setShowJudiciaryIngestionModal && setShowJudiciaryIngestionModal(true)}>
              <IngestionIcon size={20} color="var(--navy-950)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>PDF Engine</span>
            </button>
            <button className="secondary-btn" style={{ padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-md, 4px)' }} onClick={() => setActiveTab('matters')}>
              <ScalesIcon size={20} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Active Matters</span>
            </button>
            <button className="secondary-btn" style={{ padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-md, 4px)' }} onClick={() => setActiveTab('leads')}>
              <IntakeIcon size={20} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Client Intake Queue ({pendingLeads.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── PERSONA 4: MANAGING PARTNER DASHBOARD (Executive KPI Style) ── */}
      {accountPersona === 'partner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="stat-card" style={{ padding: '18px' }}>
              <div className="stat-card__val">{activeCases.length}</div>
              <div className="stat-card__label">Active Client Matters</div>
            </div>
            <div className="stat-card" style={{ padding: '18px' }}>
              <div className="stat-card__val" style={{ color: '#4DB6AC' }}>KES {(totalFeeRevenue / 1000000).toFixed(1)}M</div>
              <div className="stat-card__label">Firm Fee Revenue</div>
            </div>
            <div className="stat-card" style={{ padding: '18px' }}>
              <div className="stat-card__val">{pendingLeads.length}</div>
              <div className="stat-card__label">Pending CRM Intakes</div>
            </div>
          </div>
        </div>
      )}

      {/* ── CLOUD & OFFLINE SYNC HUB ── */}
      <div style={{
        background: 'var(--navy-800)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 4px)',
        padding: '18px 20px',
        marginTop: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <SyncIcon size={16} color="var(--gold-400)" />
              <span>Cloud & Offline Sync Hub</span>
            </h4>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Bidirectional Delta Synchronization & Offline Mutation Ledger
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={syncState.isSyncing}
            className="primary-btn"
            style={{
              padding: '7px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: syncState.isSyncing ? 'not-allowed' : 'pointer',
              opacity: syncState.isSyncing ? 0.7 : 1
            }}
          >
            <SyncIcon
              size={13}
              color="var(--navy-950)"
              style={{
                animation: syncState.isSyncing ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>{syncState.isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* Status Metric Card */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '12px 14px', borderRadius: 'var(--radius-sm, 3px)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Connection Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: syncState.isConnected ? '#26a69a' : '#ffb300',
                boxShadow: syncState.isConnected ? '0 0 8px #26a69a' : '0 0 8px #ffb300'
              }} />
              <strong style={{ color: syncState.isConnected ? '#80cbc4' : '#ffb300', fontSize: '0.85rem' }}>
                {syncState.isConnected ? 'Cloud Server Connected' : 'Offline Mode Active'}
              </strong>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-all' }}>
              {syncState.remoteUrl ? syncState.remoteUrl.replace(/^https?:\/\//, '') : 'Local Autonomous Storage'}
            </div>
          </div>

          {/* Outbox Pending Mutations Card */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '12px 14px', borderRadius: 'var(--radius-sm, 3px)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Pending Local Outbox
            </div>
            <div style={{ marginTop: '4px', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: syncState.pendingOutboxCount > 0 ? '#ffb300' : '#4db6ac' }}>
              {syncState.pendingOutboxCount} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>mutations</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {syncState.pendingOutboxCount === 0 ? 'All local edits pushed to cloud' : 'Queued in local Write-Ahead Log'}
            </div>
          </div>

          {/* Last Sync Timestamp Card */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '12px 14px', borderRadius: 'var(--radius-sm, 3px)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Last Verified Sync
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.86rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ClockIcon size={13} color="var(--gold-400)" />
              <span>
                {syncState.lastSyncedAt
                  ? new Date(syncState.lastSyncedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Pending First Sync'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Local Storage Ready'}
            </div>
          </div>
        </div>
      </div>

      {/* ── GLOBAL CUSTOMIZATION & THEME SUITE (For all account types) ── */}
      <div style={{
        background: 'var(--navy-800)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 4px)',
        padding: '20px 24px',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '0.94rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={16} color="var(--gold-400)" />
              <span>Chambers Canvas & Theme Preferences</span>
            </h3>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Configure your workspace canvas background mode and institutional accent palette.
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--gold-300)', background: 'rgba(201,168,76,0.1)', padding: '3px 8px', borderRadius: 'var(--radius-sm, 3px)', border: '1px solid rgba(201,168,76,0.2)' }}>
            Practice Role: {userRole.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Background Canvas Mode Selector */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.04em' }}>
              1. Canvas Background Mode
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { id: 'navy', label: 'Midnight Blue', desc: 'Classic Chambers' },
                { id: 'black', label: 'Pitch Black', desc: 'OLED Dark' },
                { id: 'beige', label: 'Warm Beige', desc: 'Archival Parchment' }
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
                      const evt = new CustomEvent('themeChange', { detail: { bg: bg.id } });
                      window.dispatchEvent(evt);
                    }}
                    style={{
                      background: isSelected ? 'var(--gold-500)' : 'var(--navy-950)',
                      color: isSelected ? 'var(--navy-950)' : 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm, 3px)',
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
                    <span style={{ fontSize: '0.8rem' }}>{bg.label}</span>
                    <span style={{ fontSize: '0.64rem', opacity: 0.8 }}>{bg.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palette Selector */}
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.04em' }}>
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
                      background: isSelected ? 'rgba(255,255,255,0.1)' : 'var(--navy-950)',
                      border: isSelected ? `2px solid ${t.dot}` : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm, 3px)',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.dot, display: 'inline-block', flexShrink: 0 }} />
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
