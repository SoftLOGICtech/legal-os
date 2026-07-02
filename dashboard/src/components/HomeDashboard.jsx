import React from 'react';

export default function HomeDashboard({
  cases,
  leads,
  calendar,
  upcoming48h,
  userRole,
  filterBy,
  setFilterBy,
  setActiveTab
}) {
  return (
    <div className="home-dashboard-wrapper">
      <div style={{textAlign:'center', marginBottom:'40px'}}>
         <h2 style={{fontSize:'2.5rem', color:'white', marginBottom:'10px'}}>Welcome to <span style={{color:'var(--gold-500)'}}>Legal OS</span></h2>
         <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>Select a module below to begin managing your firm.</p>
      </div>
      <div className="home-dashboard-grid">
        <div className={`large-stat-card ${filterBy==='active_cases'?'active-filter':''}`} onClick={() => { setFilterBy('active_cases'); setActiveTab('matters'); }}>
          <div className="large-stat-card__val">{cases.filter(c => c.current_milestone !== "CLOSED").length}</div>
          <div className="large-stat-card__label">Active Matters</div>
          <div className="large-stat-card__icon">⚖️</div>
        </div>
        <div className={`large-stat-card ${filterBy==='pending_intakes'?'active-filter':''}`} onClick={() => { setFilterBy('pending_intakes'); setActiveTab('leads'); }}>
          <div className="large-stat-card__val">{leads.filter(l => !l.consultation_date && l.status !== 'converted' && l.status !== 'archived').length}</div>
          <div className="large-stat-card__label">Pending Intakes</div>
          <div className="large-stat-card__icon">📥</div>
        </div>
        <div className={`large-stat-card ${filterBy==='upcoming_consults'?'active-filter':''}`} onClick={() => { setFilterBy('upcoming_consults'); setActiveTab('leads'); }}>
          <div className="large-stat-card__val">{leads.filter(l => l.consultation_date && l.status !== 'converted' && l.status !== 'archived').length}</div>
          <div className="large-stat-card__label">Upcoming Consults</div>
          <div className="large-stat-card__icon">🤝</div>
        </div>
        <div className={`large-stat-card ${filterBy==='urgent'?'active-filter':''}`} onClick={() => { setFilterBy('urgent'); setActiveTab('leads'); }}>
          <div className="large-stat-card__val" style={{color:'#ef5350'}}>{leads.filter(l => l.is_emergency === 1 || l.message?.includes('[URGENT]')).length}</div>
          <div className="large-stat-card__label">Urgent Alerts</div>
          <div className="large-stat-card__icon" style={{color:'rgba(239,83,80,0.2)'}}>⚠️</div>
        </div>
        <div className="large-stat-card" onClick={() => setActiveTab('calendar')}>
          <div className="large-stat-card__val" style={{color: upcoming48h.length > 0 ? '#ff9800' : 'var(--gold-500)'}}>
            {upcoming48h.length > 0 ? upcoming48h.length : calendar.length}
          </div>
          <div className="large-stat-card__label">{upcoming48h.length > 0 ? 'Due ≤48h' : 'Court Dates'}</div>
          <div className="large-stat-card__icon">📅</div>
        </div>
        {userRole !== 'advocate' && (
          <div className="large-stat-card" onClick={() => setActiveTab('finance')}>
            <div className="large-stat-card__val" style={{color:'var(--green-400)'}}>{cases.filter(c => c.fee_status==='paid').length}</div>
            <div className="large-stat-card__label">Fully Paid Cases</div>
            <div className="large-stat-card__icon" style={{color:'rgba(76,175,80,0.2)'}}>💰</div>
          </div>
        )}
      </div>
    </div>
  );
}
