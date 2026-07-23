import React from 'react';

export default function HomeDashboard({
  cases = [],
  leads = [],
  calendar = [],
  upcoming48h = [],
  userRole = 'advocate',
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

  // Extract Teams virtual courtroom link from event notes if present
  const extractTeamsUrl = (notesStr) => {
    if (!notesStr) return null;
    const match = notesStr.match(/(https?:\/\/[^\s>]+teams[^\s>]+)/i);
    return match ? match[1] : null;
  };

  return (
    <div className="home-dashboard-wrapper" style={{width:'100%'}}>
      
      {/* 📱 MOBILE ADVOCATE COMMAND CENTER (Renders on screens <= 768px via CSS) */}
      <div className="mobile-command-center">
        
        {/* Advocate Greeting Banner */}
        <div style={{background:'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)', border:'1px solid var(--border-default)', borderRadius:'12px', padding:'16px', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:'0.72rem', color:'var(--gold-400)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>Advocate Command Center</div>
            <h3 style={{margin:'2px 0 0 0', color:'white', fontSize:'1.15rem'}}>Habari, {userDisplayName.split(' ')[0]} ⚖️</h3>
            <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'2px'}}>
              {activeCases.length} Active Matters • {upcoming48h.length} Court Dates
            </div>
          </div>
          <div>
            <button 
              onClick={requestNotificationPermission}
              className="action-btn"
              style={{
                background: notificationPermission === 'granted' ? 'rgba(77,182,172,0.15)' : 'var(--gold-gradient)',
                color: notificationPermission === 'granted' ? '#4db6ac' : 'var(--navy-950)',
                border: notificationPermission === 'granted' ? '1px solid #4db6ac' : 'none',
                fontWeight: 700,
                fontSize: '0.72rem',
                padding: '6px 10px',
                borderRadius: '8px'
              }}
            >
              {notificationPermission === 'granted' ? '🔔 Alerts On' : '🔔 Enable Alerts'}
            </button>
          </div>
        </div>

        {/* 4-Touch Quick Action Bar */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginBottom:'16px'}}>
          <button 
            onClick={() => setShowJudiciaryIngestionModal && setShowJudiciaryIngestionModal(true)}
            style={{background:'var(--navy-800)', border:'1px solid var(--gold-500)', borderRadius:'10px', padding:'12px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color:'white', cursor:'pointer'}}
          >
            <span style={{fontSize:'1.4rem'}}>⚡</span>
            <span style={{fontSize:'0.65rem', fontWeight:700, color:'var(--gold-300)'}}>Scan PDF</span>
          </button>

          <button 
            onClick={() => setActiveTab('matters')}
            style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'10px', padding:'12px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color:'white', cursor:'pointer'}}
          >
            <span style={{fontSize:'1.4rem'}}>📝</span>
            <span style={{fontSize:'0.65rem', fontWeight:600}}>Log Outcome</span>
          </button>

          <button 
            onClick={() => setShowNewLeadModal && setShowNewLeadModal(true)}
            style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'10px', padding:'12px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color:'white', cursor:'pointer'}}
          >
            <span style={{fontSize:'1.4rem'}}>🤝</span>
            <span style={{fontSize:'0.65rem', fontWeight:600}}>New Intake</span>
          </button>

          <button 
            onClick={() => setActiveTab('documents')}
            style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'10px', padding:'12px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color:'white', cursor:'pointer'}}
          >
            <span style={{fontSize:'1.4rem'}}>📄</span>
            <span style={{fontSize:'0.65rem', fontWeight:600}}>Draft Doc</span>
          </button>
        </div>

        {/* Today's Cause List Hero Cards */}
        <div style={{marginBottom:'20px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
            <h4 style={{margin:0, color:'var(--gold-400)', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'6px'}}>
              <span>🏛️ Today's Cause & Court Dates</span>
              <span className="badge" style={{background:'rgba(255,152,0,0.15)', color:'#ff9800', fontSize:'0.7rem'}}>
                {upcoming48h.length} Upcoming
              </span>
            </h4>
            <button onClick={() => setActiveTab('calendar')} style={{background:'none', border:'none', color:'var(--gold-500)', fontSize:'0.75rem', cursor:'pointer', textDecoration:'underline'}}>
              View All →
            </button>
          </div>

          {upcoming48h.length === 0 ? (
            <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'10px', padding:'20px', textAlign:'center', color:'var(--text-secondary)', fontSize:'0.82rem'}}>
              🌴 No court appearances scheduled for the next 48 hours. Enjoy your prep time!
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              {upcoming48h.slice(0, 3).map(ev => {
                const teamsLink = extractTeamsUrl(ev.notes);
                const relatedCase = cases.find(c => c.id === ev.case_id);
                return (
                  <div key={ev.id} style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderLeft:'4px solid var(--gold-500)', borderRadius:'8px', padding:'12px 14px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontSize:'0.72rem', color:'var(--gold-400)', fontWeight:700}}>{ev.event_type ? ev.event_type.toUpperCase() : 'COURT EVENT'}</div>
                        <div style={{fontSize:'0.9rem', fontWeight:700, color:'white', margin:'2px 0'}}>{ev.event_title}</div>
                        {relatedCase && (
                          <div style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>
                            Matter: <strong>{relatedCase.client_name}</strong> ({relatedCase.judiciary_case_id || relatedCase.tracking_token})
                          </div>
                        )}
                      </div>
                      <div style={{textAlign:'right', fontSize:'0.75rem', color:'#ff9800', fontWeight:700}}>
                        📅 {new Date(ev.event_date).toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>

                    {ev.notes && (
                      <div style={{fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'6px', background:'var(--navy-950)', padding:'6px 10px', borderRadius:'4px'}}>
                        {ev.notes}
                      </div>
                    )}

                    {teamsLink && (
                      <a 
                        href={teamsLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="primary-btn"
                        style={{display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'10px', textDecoration:'none', padding:'6px 12px', fontSize:'0.75rem', fontWeight:700, width:'100%', justifyContent:'center'}}
                      >
                        💻 Join Virtual Courtroom (MS Teams)
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Touch-Optimized Active Matters List */}
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
            <h4 style={{margin:0, color:'var(--gold-400)', fontSize:'0.9rem'}}>⚖️ Active Client Matters ({activeCases.length})</h4>
            <button onClick={() => setActiveTab('matters')} style={{background:'none', border:'none', color:'var(--gold-500)', fontSize:'0.75rem', cursor:'pointer', textDecoration:'underline'}}>
              View All →
            </button>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {activeCases.slice(0, 5).map(c => (
              <div 
                key={c.id}
                style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'10px', padding:'14px', cursor:'pointer'}}
                onClick={() => {
                  if (setActiveMatterId) setActiveMatterId(c.id);
                  if (setSelectedCase) setSelectedCase(c.id);
                  setActiveTab('matters');
                }}
              >
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px'}}>
                  <div>
                    <div style={{fontSize:'0.92rem', fontWeight:700, color:'white'}}>{c.client_name}</div>
                    <div style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>{c.case_title}</div>
                  </div>
                  <span className="badge badge--active" style={{fontSize:'0.68rem'}}>Phase {c.current_milestone}</span>
                </div>

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'10px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{fontFamily:'monospace', fontSize:'0.72rem', color:'var(--gold-400)'}}>
                    {c.judiciary_case_id || c.tracking_token}
                  </div>
                  <div style={{display:'flex', gap:'8px'}} onClick={e => e.stopPropagation()}>
                    {c.client_phone ? (
                      <>
                        <a 
                          href={`https://web.whatsapp.com/send?phone=${c.client_phone.replace(/\+/g,'')}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="primary-btn" 
                          style={{padding:'4px 10px', fontSize:'0.7rem', textDecoration:'none'}}
                        >
                          💬 WA
                        </a>
                        <a 
                          href={`tel:${c.client_phone}`}
                          className="secondary-btn" 
                          style={{padding:'4px 10px', fontSize:'0.7rem', textDecoration:'none'}}
                        >
                          📞 Call
                        </a>
                      </>
                    ) : (
                      <span style={{fontSize:'0.7rem', color:'var(--text-muted)'}}>No Phone</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 💻 DESKTOP DASHBOARD (Renders on screens > 768px) */}
      <div className="desktop-dashboard-view">
        <div style={{textAlign:'center', marginBottom:'40px'}}>
           <h2 style={{fontSize:'2.5rem', color:'white', marginBottom:'10px'}}>Welcome to <span style={{color:'var(--gold-500)'}}>Legal OS</span></h2>
           <p style={{color:'var(--text-secondary)', fontSize:'1.1rem'}}>Select a module below to begin managing your firm.</p>
        </div>
        <div className="home-dashboard-grid">
          <div className={`large-stat-card ${filterBy==='active_cases'?'active-filter':''}`} onClick={() => { setFilterBy('active_cases'); setActiveTab('matters'); }}>
            <div className="large-stat-card__val">{activeCases.length}</div>
            <div className="large-stat-card__label">Active Matters</div>
            <div className="large-stat-card__icon">⚖️</div>
          </div>
          <div className={`large-stat-card ${filterBy==='pending_intakes'?'active-filter':''}`} onClick={() => { setFilterBy('pending_intakes'); setActiveTab('leads'); }}>
            <div className="large-stat-card__val">{pendingLeads.length}</div>
            <div className="large-stat-card__label">Pending Intakes</div>
            <div className="large-stat-card__icon">📥</div>
          </div>
          <div className={`large-stat-card ${filterBy==='upcoming_consults'?'active-filter':''}`} onClick={() => { setFilterBy('upcoming_consults'); setActiveTab('leads'); }}>
            <div className="large-stat-card__val">{leads.filter(l => l.consultation_date && l.status !== 'converted' && l.status !== 'archived').length}</div>
            <div className="large-stat-card__label">Upcoming Consults</div>
            <div className="large-stat-card__icon">🤝</div>
          </div>
          <div className={`large-stat-card ${filterBy==='urgent'?'active-filter':''}`} onClick={() => { setFilterBy('urgent'); setActiveTab('leads'); }}>
            <div className="large-stat-card__val" style={{color:'#ef5350'}}>{urgentAlerts.length}</div>
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

    </div>
  );
}
