// MobileMatterView.jsx — Dedicated Mobile-First Matter Hub for Legal OS
import React, { useState } from 'react';
import { apiPost } from '../api';

export default function MobileMatterView({
  activeCase,
  onBack,
  milestones = ["Intake", "Research", "Drafting", "Processing", "Resolution"],
  caseFiles = [],
  casePayments = [],
  caseInvoices = [],
  activities = [],
  calendar = [],
  onLiveCtsSync,
  onOpenPaymentModal,
  fetchActivities,
  fetchData,
  userDisplayName = 'Advocate',
  showToast
}) {
  const [activeMobileTab, setActiveMobileTab] = useState('overview'); // 'overview' | 'kyc' | 'files' | 'finance'
  const [quickNote, setQuickNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [nextCourtDateInput, setNextCourtDateInput] = useState('');

  if (!activeCase) return null;

  const currentPhase = parseInt(activeCase.current_milestone) || 1;
  const isClosed = activeCase.current_milestone === 'CLOSED';

  // Client Contacts
  const phone = activeCase.client_phone ? activeCase.client_phone.trim() : '';
  const email = activeCase.client_email ? activeCase.client_email.trim() : '';
  
  // Format WhatsApp Link
  const cleanPhoneForWa = phone.replace(/[^0-9]/g, '');
  const formattedWaPhone = cleanPhoneForWa.startsWith('0') 
    ? '254' + cleanPhoneForWa.slice(1) 
    : cleanPhoneForWa.startsWith('254') 
    ? cleanPhoneForWa 
    : '254' + cleanPhoneForWa;
  const defaultWaMessage = encodeURIComponent(`Hello ${activeCase.client_name || 'Client'}, this is regarding your matter "${activeCase.case_title || ''}" (Ref: ${activeCase.tracking_token || ''}) at Sam Ogola & Co Advocates.`);
  const waUrl = formattedWaPhone.length >= 9 ? `https://wa.me/${formattedWaPhone}?text=${defaultWaMessage}` : null;

  // Upcoming hearings for this matter
  const matterEvents = calendar.filter(ev => String(ev.case_id) === String(activeCase.id));
  const nextHearing = matterEvents.length > 0 
    ? matterEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))[0] 
    : null;

  const extractTeamsUrl = (notesStr) => {
    if (!notesStr) return null;
    const match = notesStr.match(/(https?:\/\/[^\s>]+teams[^\s>]+)/i);
    return match ? match[1] : null;
  };

  // Quick Attendance Note / Hearing Update
  const handleSaveAttendanceNote = async (e) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    setSubmittingNote(true);
    try {
      const notePayload = {
        case_id: activeCase.id,
        activity_type: 'court_mention',
        description: `🏛️ Court Attendance Note: ${quickNote.trim()}`,
        recorded_by: userDisplayName
      };
      const res = await apiPost('/api/activities', notePayload);
      if (res && res.ok) {
        showToast('📝 Attendance note logged to matter record!', 'success');
        setQuickNote('');
        if (fetchActivities) fetchActivities();
      } else {
        showToast('Failed to save note.', 'error');
      }

      // If user also set a new court date
      if (nextCourtDateInput) {
        await apiPost('/api/calendar', {
          case_id: activeCase.id,
          event_title: `Mention / Hearing: ${activeCase.case_title}`,
          event_type: 'mention',
          event_date: nextCourtDateInput,
          notes: `Post-hearing mention scheduled by ${userDisplayName}`
        });
        showToast('📅 Next court date added to calendar!', 'success');
        setNextCourtDateInput('');
        if (fetchData) fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Error saving note', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="mobile-matter-view" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', paddingBottom: '90px' }}>
      {/* ── Top Bar with Back Action & Case Token ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px' }}>
        <button 
          onClick={onBack}
          className="secondary-btn"
          style={{ padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '20px' }}
        >
          ← Back to Matters
        </button>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gold-400)', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
          {activeCase.tracking_token || `REF-${activeCase.id}`}
        </span>
      </div>

      {/* ── Hero Matter Header Card ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)',
        border: '1px solid var(--border-default)',
        borderRadius: '14px',
        padding: '16px',
        marginBottom: '14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {activeCase.case_type || 'Civil Litigation'}
            </div>
            <h2 style={{ fontSize: '1.25rem', color: 'white', margin: '2px 0 0 0', fontWeight: 700, lineHeight: 1.25 }}>
              {activeCase.client_name}
            </h2>
          </div>
          <span className={`badge ${isClosed ? 'badge--archived' : 'badge--active'}`} style={{ fontSize: '0.72rem', padding: '4px 8px', textTransform: 'uppercase' }}>
            {isClosed ? '🔒 Closed' : `Phase ${currentPhase}: ${milestones[currentPhase - 1] || 'Active'}`}
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.35 }}>
          {activeCase.case_title}
        </div>

        {/* Station & Judge details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginBottom: '14px' }}>
          {activeCase.judiciary_case_id && (
            <div>🏛️ <strong style={{ color: '#64b5f6' }}>{activeCase.judiciary_case_id}</strong></div>
          )}
          <div>📍 {activeCase.court_station || 'Court Station: Unset'}</div>
          <div>👨‍⚖️ {activeCase.assigned_judge || 'Judge: Unset'}</div>
          <div>⚖️ {activeCase.assigned_lawyer || 'Sam Ogola'}</div>
        </div>

        {/* ── 1-Tap Client Action Bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {phone ? (
            <a 
              href={`tel:${phone}`}
              className="primary-btn"
              style={{ padding: '9px 6px', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.78rem', borderRadius: '8px', fontWeight: 700 }}
            >
              <span>📞</span> Call
            </a>
          ) : (
            <button disabled className="secondary-btn" style={{ padding: '9px 6px', fontSize: '0.75rem', opacity: 0.4 }}>
              📞 No Phone
            </button>
          )}

          {waUrl ? (
            <a 
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#25D366',
                color: '#07180e',
                padding: '9px 6px',
                textAlign: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontSize: '0.78rem',
                borderRadius: '8px',
                fontWeight: 800
              }}
            >
              <span>💬</span> WhatsApp
            </a>
          ) : (
            <button disabled className="secondary-btn" style={{ padding: '9px 6px', fontSize: '0.75rem', opacity: 0.4 }}>
              💬 No WA
            </button>
          )}

          {email ? (
            <a 
              href={`mailto:${email}`}
              className="secondary-btn"
              style={{ padding: '9px 6px', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.78rem', borderRadius: '8px', color: 'white', borderColor: 'var(--border-default)' }}
            >
              <span>✉️</span> Email
            </a>
          ) : (
            <button disabled className="secondary-btn" style={{ padding: '9px 6px', fontSize: '0.75rem', opacity: 0.4 }}>
              ✉️ No Email
            </button>
          )}
        </div>
      </div>

      {/* ── 4 Streamlined Mobile Tabs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', background: 'var(--navy-900)', padding: '4px', borderRadius: '10px', marginBottom: '14px', border: '1px solid var(--border-default)' }}>
        {[
          { id: 'overview', label: '📌 Notes & Date' },
          { id: 'kyc', label: '👤 KYC & Parties' },
          { id: 'files', label: '📁 Files (' + caseFiles.length + ')' },
          { id: 'finance', label: '💰 Billing' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveMobileTab(t.id)}
            style={{
              background: activeMobileTab === t.id ? 'var(--gold-500)' : 'transparent',
              color: activeMobileTab === t.id ? 'var(--navy-950)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '8px 4px',
              fontSize: '0.72rem',
              fontWeight: activeMobileTab === t.id ? 700 : 500,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW & POST-HEARING DICTATION ── */}
      {activeMobileTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Next Scheduled Hearing / Teams Link Card */}
          {nextHearing && (
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--gold-500)', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 4px 16px rgba(201,168,76,0.1)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                ⏰ Next Scheduled Court Appearance
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                {nextHearing.event_title}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gold-300)', marginTop: '2px', fontWeight: 600 }}>
                📅 {new Date(nextHearing.event_date).toLocaleString('en-KE')}
              </div>
              {extractTeamsUrl(nextHearing.notes) && (
                <a 
                  href={extractTeamsUrl(nextHearing.notes)}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-btn"
                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '10px', padding: '10px', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  💻 Join MS Teams Virtual Hearing
                </a>
              )}
            </div>
          )}

          {/* Quick Post-Hearing Attendance Note Form */}
          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--gold-400)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎙️</span> Log Post-Hearing Attendance Note
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '0 0 10px 0', lineHeight: 1.3 }}>
              Dictate or type orders, adjournments, or next hearing directions. Saved directly into the firm audit log.
            </p>
            <form onSubmit={handleSaveAttendanceNote} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                placeholder="e.g. Matter mentioned before Justice Cherere. Adjourned to 15th Sept for hearing of Application dated 4th July. Opposing counsel granted 7 days to file reply..."
                rows={3}
                style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '0.82rem', outline: 'none', resize: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Next Court Date (Optional)</label>
                <input 
                  type="datetime-local"
                  value={nextCourtDateInput}
                  onChange={e => setNextCourtDateInput(e.target.value)}
                  style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '0.8rem' }}
                />
              </div>
              <button 
                type="submit"
                disabled={!quickNote.trim() || submittingNote}
                className="primary-btn"
                style={{ padding: '10px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px' }}
              >
                {submittingNote ? 'Saving...' : '💾 Save to Case Log & Calendar'}
              </button>
            </form>
          </div>

          {/* Recent Matter Activity Feed */}
          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--gold-400)', fontSize: '0.9rem' }}>
              📋 Recent Chronology / Updates ({activities.length})
            </h4>
            {activities.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '12px 0' }}>
                No recent activity records logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activities.slice(0, 6).map(act => (
                  <div key={act.id} style={{ background: 'var(--navy-900)', borderLeft: '3px solid var(--gold-500)', padding: '8px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'white', lineHeight: 1.3 }}>{act.description}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>By: {act.recorded_by || 'Staff'}</span>
                      <span>{new Date(act.created_at).toLocaleDateString('en-KE')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CLIENT KYC & OPPOSING PARTIES ── */}
      {activeMobileTab === 'kyc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--gold-400)', fontSize: '0.9rem' }}>Client Identification (KYC)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', fontSize: '0.82rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Full Name:</span> <strong style={{ color: 'white' }}>{activeCase.client_name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Primary Phone:</span> <a href={`tel:${activeCase.client_phone}`} style={{ color: '#64b5f6', textDecoration: 'none' }}>{activeCase.client_phone || 'N/A'}</a></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Primary Email:</span> <a href={`mailto:${activeCase.client_email}`} style={{ color: '#64b5f6', textDecoration: 'none' }}>{activeCase.client_email || 'N/A'}</a></div>
              <div><span style={{ color: 'var(--text-muted)' }}>National ID / Passport:</span> <strong style={{ color: 'white' }}>{activeCase.id_number || 'N/A'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>KRA PIN:</span> <strong style={{ color: 'white' }}>{activeCase.kra_pin || 'N/A'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Physical / Postal Address:</span> <span style={{ color: 'white' }}>{activeCase.address || 'N/A'}</span></div>
            </div>
          </div>

          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#ef5350', fontSize: '0.9rem' }}>Opposing Party & Counsel</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', fontSize: '0.82rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Opposing Party:</span> <strong style={{ color: 'white' }}>{activeCase.opposing_party || 'N/A'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Opposing Counsel:</span> <span style={{ color: 'white' }}>{activeCase.opposing_counsel_name || 'N/A'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Opposing Law Firm:</span> <span style={{ color: 'white' }}>{activeCase.opposing_counsel_firm || 'N/A'}</span></div>
              {activeCase.opposing_counsel_phone && (
                <div><span style={{ color: 'var(--text-muted)' }}>Counsel Tel:</span> <a href={`tel:${activeCase.opposing_counsel_phone}`} style={{ color: '#64b5f6', textDecoration: 'none' }}>{activeCase.opposing_counsel_phone}</a></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CASE FILES & PLEADINGS ── */}
      {activeMobileTab === 'files' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--gold-400)', fontSize: '0.9rem' }}>
              📄 Filed Pleadings & Attachments ({caseFiles.length})
            </h4>
            {caseFiles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
                No document files uploaded for this matter yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {caseFiles.map(file => (
                  <div key={file.id} style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1, marginRight: '10px' }}>
                      <div style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.original_name || file.file_name}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>
                        {file.category?.toUpperCase() || 'DOCUMENT'} • {new Date(file.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {file.file_path && (
                      <a 
                        href={`/uploads/${encodeURIComponent(file.file_name)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-btn"
                        style={{ padding: '5px 10px', fontSize: '0.72rem', textDecoration: 'none', color: 'var(--gold-400)', borderColor: 'var(--gold-500)', whiteSpace: 'nowrap' }}
                      >
                        👁️ View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: FINANCIALS & BILLING ── */}
      {activeMobileTab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Agreed Fee</div>
              <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 800, marginTop: '4px' }}>
                KES {(activeCase.total_fee || 0).toLocaleString()}
              </div>
            </div>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Outstanding Balance</div>
              <div style={{ fontSize: '1.25rem', color: '#ef5350', fontWeight: 800, marginTop: '4px' }}>
                KES {(activeCase.outstanding_balance || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Client Escrow Trust Balance</div>
            <div style={{ fontSize: '1.35rem', color: '#4db6ac', fontWeight: 800, marginTop: '4px' }}>
              KES {casePayments.filter(p => p.destination === 'trust').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
            </div>
          </div>

          {onOpenPaymentModal && (
            <button 
              onClick={onOpenPaymentModal}
              className="primary-btn"
              style={{ width: '100%', padding: '12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px' }}
            >
              + Log M-PESA Deposit / Payment
            </button>
          )}

          {/* Desktop notice */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '10px', padding: '14px', textAlign: 'center', marginTop: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              💻 Full multi-phase tax invoicing, trust drawdowns, and disbursement ledgers are available on the Chambers PC app.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
