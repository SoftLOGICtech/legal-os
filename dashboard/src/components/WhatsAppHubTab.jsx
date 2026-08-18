import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost } from '../api';

export default function WhatsAppHubTab({ cases = [], leads = [], userRole, fetchData, showToast }) {
  const [statusData, setStatusData] = useState({
    status: 'DISCONNECTED',
    qr: null,
    phoneNumber: null,
    connectedAt: null,
    logs: []
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [composerMessage, setComposerMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [broadcastingReminders, setBroadcastingReminders] = useState(false);

  // SocaBot Co-Pilot Drawer in WhatsApp Tab
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiGeneratedText, setAiGeneratedText] = useState('');

  // Quick Add Contact Modal
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    case_title: 'General Legal Consultation',
    service_category: 'Litigation'
  });

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
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Consolidate client directory from cases and leads with multi-beneficiary expansion
  const clientDirectory = useMemo(() => {
    const list = [];
    const seenPhones = new Set();

    // 1. Add active cases (primary + all linked beneficiaries)
    cases.forEach(c => {
      const phone = (c.client_phone || '').trim();
      const altPhones = (c.alternative_phone || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean);
      const allPhones = [phone, ...altPhones].filter(Boolean);

      if (phone && !seenPhones.has(phone)) {
        seenPhones.add(phone);
        list.push({
          id: `case_${c.id}_primary`,
          caseId: c.id,
          name: c.client_name || 'Unnamed Client',
          phone: phone,
          roleTag: 'Primary Client',
          altPhone: c.alternative_phone || '',
          email: c.client_email || '',
          matterTitle: c.case_title || 'Active Matter',
          courtStation: c.court_station || 'Milimani Law Courts',
          trackingToken: c.tracking_token || c.ref_no || '',
          assignedLawyer: c.assigned_lawyer || 'Sam Ogola, Advocate',
          currentMilestone: c.current_milestone || '1',
          outstandingBalance: c.outstanding_balance || '0',
          totalFee: c.total_fee || '0',
          allLinkedPhones: allPhones,
          type: 'matter'
        });
      }

      // Add linked beneficiaries/co-parties
      altPhones.forEach((ap, idx) => {
        if (!seenPhones.has(ap)) {
          seenPhones.add(ap);
          list.push({
            id: `case_${c.id}_alt_${idx}`,
            caseId: c.id,
            name: `${c.client_name} (Beneficiary/Co-Party ${idx + 1})`,
            phone: ap,
            roleTag: `Beneficiary ${idx + 1}`,
            email: c.alternative_email ? c.alternative_email.split(/[,;]+/)[idx] || '' : '',
            matterTitle: c.case_title || 'Active Matter',
            courtStation: c.court_station || 'Milimani Law Courts',
            trackingToken: c.tracking_token || c.ref_no || '',
            assignedLawyer: c.assigned_lawyer || 'Sam Ogola, Advocate',
            currentMilestone: c.current_milestone || '1',
            outstandingBalance: c.outstanding_balance || '0',
            totalFee: c.total_fee || '0',
            allLinkedPhones: allPhones,
            type: 'matter'
          });
        }
      });
    });

    // 2. Add CRM leads
    leads.forEach(l => {
      const phone = (l.phone || '').trim();
      if (phone && !seenPhones.has(phone)) {
        seenPhones.add(phone);
        list.push({
          id: `lead_${l.id}`,
          name: l.full_name || 'Prospective Client',
          phone: phone,
          roleTag: 'Intake Lead',
          email: l.email || '',
          matterTitle: l.service_category || 'CRM Intake Lead',
          courtStation: 'Intake / Pre-litigation',
          trackingToken: 'LEAD',
          assignedLawyer: l.assigned_lawyer || 'Reception Desk',
          currentMilestone: 'Intake',
          outstandingBalance: '0',
          totalFee: '0',
          allLinkedPhones: [phone],
          type: 'lead'
        });
      }
    });

    return list;
  }, [cases, leads]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return clientDirectory;
    const q = searchQuery.toLowerCase();
    return clientDirectory.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.matterTitle.toLowerCase().includes(q) ||
      c.trackingToken.toLowerCase().includes(q)
    );
  }, [clientDirectory, searchQuery]);

  // Set default selected contact
  useEffect(() => {
    if (clientDirectory.length > 0 && !selectedContact) {
      setSelectedContact(clientDirectory[0]);
    }
  }, [clientDirectory, selectedContact]);

  const handleReconnect = async () => {
    setLoading(true);
    try {
      await apiPost('/api/whatsapp/reconnect', {});
      if (showToast) showToast('🔄 Initializing WhatsApp Desk...', 'info');
      setTimeout(fetchStatus, 1500);
    } catch (e) {
      if (showToast) showToast(`⚠️ Connection error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this firm phone?')) return;
    setLoading(true);
    try {
      await apiPost('/api/whatsapp/disconnect', {});
      if (showToast) showToast('🔌 Firm phone unlinked.', 'info');
      fetchStatus();
    } catch (e) {
      if (showToast) showToast(`⚠️ Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedContact?.phone || !composerMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await apiPost('/api/whatsapp/send', {
        phone: selectedContact.phone,
        message: composerMessage.trim()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch message');
      if (showToast) showToast(`✅ Message sent to ${selectedContact.name}!`, 'success');
      setComposerMessage('');
      fetchStatus();
    } catch (e) {
      if (showToast) showToast(`⚠️ Dispatch error: ${e.message}`, 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBroadcastReminders = async () => {
    setBroadcastingReminders(true);
    try {
      const res = await apiPost('/api/whatsapp/reminders', { daysAhead: 1 });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Broadcast failed');
      if (showToast) showToast(`📢 Tomorrow's court notices dispatched to ${data.sent || 0} clients!`, 'success');
      fetchStatus();
    } catch (e) {
      if (showToast) showToast(`⚠️ Broadcast error: ${e.message}`, 'error');
    } finally {
      setBroadcastingReminders(false);
    }
  };

  // SocaBot AI Drafting Generator
  const handleAskSocaBot = async (customInstruction) => {
    const prompt = customInstruction || aiPrompt;
    if (!prompt.trim() || !selectedContact) return;
    setAiDrafting(true);
    try {
      const res = await apiPost('/api/ai/assistant/chat', {
        message: `Act as the Executive Advocate for Sam Ogola & Co. Advocates. Draft a formal, clear WhatsApp client message for:
Client: ${selectedContact.name}
Phone: ${selectedContact.phone}
Matter: ${selectedContact.matterTitle} (${selectedContact.trackingToken})
Court Station: ${selectedContact.courtStation}
Assigned Counsel: ${selectedContact.assignedLawyer}
Outstanding Balance: KES ${selectedContact.outstandingBalance}

Instruction: ${prompt}

Format rules: Clean WhatsApp formatting with professional emojis and bullet points. Include advocate sign-off.`,
        activeMatterId: selectedContact.caseId || null
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate draft');
      setAiGeneratedText(data.reply || data.content || '');
      setComposerMessage(data.reply || data.content || '');
      if (showToast) showToast('✨ SocaBot drafted message and loaded into composer!', 'success');
    } catch (e) {
      if (showToast) showToast(`⚠️ SocaBot error: ${e.message}`, 'error');
    } finally {
      setAiDrafting(false);
    }
  };

  // Quick Action Templates
  const handleApplyTemplate = (type) => {
    if (!selectedContact) return;
    let text = '';
    if (type === 'hearing') {
      text = `⚖️ *COURT MENTION UPDATE — SAM OGOLA & CO. ADVOCATES*

Dear *${selectedContact.name}*,

Please note your matter (*${selectedContact.matterTitle}*) has a court mention scheduled:
• *Station:* ${selectedContact.courtStation}
• *Matter Ref:* ${selectedContact.trackingToken || 'On Record'}
• *Presiding:* Hon. Court
• *Advocate on Record:* ${selectedContact.assignedLawyer}

_Our registry team will follow up on virtual hearing links and orders._`;
    } else if (type === 'fee') {
      text = `💳 *FEE STATEMENT — SAM OGOLA & CO. ADVOCATES*

Dear *${selectedContact.name}*,

Re: *${selectedContact.matterTitle}*
• *Total Retainer:* KES ${parseFloat(selectedContact.totalFee || 0).toLocaleString()}
• *Outstanding Balance:* KES ${parseFloat(selectedContact.outstandingBalance || 0).toLocaleString()}

*REMITTANCE CHANNELS:*
📱 *M-PESA Paybill:* 553388
📝 *Account Ref:* ${selectedContact.trackingToken || 'FIRM'}

_Thank you for your prompt settlement._`;
    } else if (type === 'kyc') {
      text = `📋 *REGULATORY ONBOARDING (KYC) REQUEST*

Dear *${selectedContact.name}*,

To complete your client profile with Sam Ogola & Co. Advocates, please share:
1. Clear copy of your National ID / Passport
2. KRA PIN Certificate

_You can send photos or documents directly on this WhatsApp chat._`;
    } else if (type === 'milestone') {
      text = `📁 *MATTER PROGRESS UPDATE — SAM OGOLA & CO. ADVOCATES*

Dear *${selectedContact.name}*,

Your matter (*${selectedContact.matterTitle}*) is currently at *Phase ${selectedContact.currentMilestone}*. All pleadings and procedural steps are on schedule.

_Assigned Counsel:_ ${selectedContact.assignedLawyer}`;
    }
    setComposerMessage(text);
  };

  // Add Contact Form Submit
  const handleAddContactSubmit = async (e) => {
    e.preventDefault();
    if (!newContactForm.client_name.trim() || !newContactForm.client_phone.trim()) return;
    try {
      const res = await apiPost('/api/leads', {
        full_name: newContactForm.client_name.trim(),
        phone: newContactForm.client_phone.trim(),
        email: newContactForm.client_email.trim(),
        service_category: newContactForm.service_category,
        message: 'Created via WhatsApp Client Directory',
        source: 'whatsapp'
      });
      if (!res.ok) throw new Error('Failed to create contact');
      if (showToast) showToast('✅ Contact added to directory!', 'success');
      setShowAddContactModal(false);
      setNewContactForm({ client_name: '', client_phone: '', client_email: '', case_title: 'General Legal Consultation', service_category: 'Litigation' });
      if (fetchData) fetchData();
      fetchStatus();
    } catch (err) {
      if (showToast) showToast(`⚠️ Error: ${err.message}`, 'error');
    }
  };

  const isConnected = statusData.status === 'CONNECTED';
  const isQrReady = statusData.status === 'QR_READY' && statusData.qr;

  // Filter logs for selected contact or show all
  const activeLogs = useMemo(() => {
    if (!statusData.logs) return [];
    if (!selectedContact?.phone) return statusData.logs;
    const cleanPhone = selectedContact.phone.replace(/\D/g, '').slice(-9);
    return statusData.logs.filter(l => (l.phone || '').includes(cleanPhone));
  }, [statusData.logs, selectedContact]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', padding: '20px', overflowY: 'auto' }}>
      
      {/* ── Top Executive Bar ── */}
      <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350',
            boxShadow: `0 0 10px ${isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350'}`
          }} />
          <div>
            <h2 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.15rem', fontFamily: 'var(--font-display)' }}>
              Client Communications & WhatsApp Desk
            </h2>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {isConnected 
                ? `Firm Desk Active: +${statusData.phoneNumber || 'Linked Number'} • Automated Case Updates & Direct Client Messaging`
                : isQrReady 
                ? 'Scan pairing QR code with your firm phone to activate desk'
                : 'Firm Desk Disconnected'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={handleBroadcastReminders}
            disabled={!isConnected || broadcastingReminders}
            className="secondary-btn"
            style={{ padding: '7px 14px', fontSize: '0.78rem', borderColor: 'rgba(77,182,172,0.4)', color: '#4db6ac', fontWeight: 600 }}
          >
            {broadcastingReminders ? 'Broadcasting...' : '📢 Broadcast Tomorrow\'s Court Notices'}
          </button>

          {!isConnected ? (
            <button 
              onClick={handleReconnect}
              disabled={loading}
              className="primary-btn"
              style={{ padding: '7px 14px', fontSize: '0.78rem', background: 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
            >
              {loading ? 'Starting...' : '🔄 Link Phone QR'}
            </button>
          ) : (
            <button 
              onClick={handleDisconnect}
              disabled={loading}
              className="secondary-btn"
              style={{ padding: '7px 14px', fontSize: '0.78rem', borderColor: '#ef5350', color: '#ef5350' }}
            >
              Unlink Desk
            </button>
          )}
        </div>
      </div>

      {/* ── QR Pairing Banner (If Not Connected) ── */}
      {isQrReady && !isConnected && (
        <div style={{ background: 'var(--navy-950)', border: '1px solid var(--gold-500)', borderRadius: '10px', padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.05rem' }}>
            📲 Link Firm WhatsApp Phone
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', maxWidth: '440px' }}>
            Open WhatsApp &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>, then scan this code:
          </p>
          <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
            <img src={statusData.qr} alt="Pairing QR" style={{ width: '210px', height: '210px', display: 'block' }} />
          </div>
        </div>
      )}

      {/* ── 3-Column Communications Workspace ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 340px', gap: '16px', flex: 1, minHeight: '520px' }}>
        
        {/* ════ COLUMN 1: CLIENT DIRECTORY ════ */}
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Directory Search & Add */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--gold-400)' }}>
                Client Directory ({filteredContacts.length})
              </span>
              <button 
                onClick={() => setShowAddContactModal(true)}
                className="primary-btn"
                style={{ padding: '4px 8px', fontSize: '0.72rem', background: 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
              >
                + Add Client
              </button>
            </div>
            <input 
              type="text"
              placeholder="Search by name, case, or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'white', padding: '7px 10px', fontSize: '0.76rem' }}
            />
          </div>

          {/* Contact List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filteredContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No matching clients found. Click "+ Add Client" to create one.
              </div>
            ) : (
              filteredContacts.map(c => {
                const isSelected = selectedContact?.id === c.id;
                return (
                  <div 
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isSelected ? 'rgba(201,168,76,0.12)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--gold-400)' : '3px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: isSelected ? 'var(--gold-300)' : 'white', fontSize: '0.82rem' }}>
                        {c.name}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {c.trackingToken || ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {c.matterTitle}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>📞 {c.phone}</span>
                      <span style={{ color: '#4db6ac' }}>{c.type === 'matter' ? 'Active Matter' : 'Intake Lead'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ════ COLUMN 2: CONVERSATION DESK & COMPOSER ════ */}
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Active Contact Header */}
          {selectedContact ? (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', background: 'var(--navy-950)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '0.95rem' }}>{selectedContact.name}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--gold-400)', background: 'rgba(201,168,76,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(201,168,76,0.2)' }}>
                      {selectedContact.roleTag || 'Client'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    📞 {selectedContact.phone} • {selectedContact.matterTitle} ({selectedContact.courtStation})
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div>Counsel: <strong style={{ color: 'white' }}>{selectedContact.assignedLawyer}</strong></div>
                  <div>Balance: <strong style={{ color: parseFloat(selectedContact.outstandingBalance) > 0 ? '#ef5350' : '#4db6ac' }}>KES {parseFloat(selectedContact.outstandingBalance || 0).toLocaleString()}</strong></div>
                </div>
              </div>

              {/* Linked Beneficiary Quick Switcher (e.g. for Succession Cases) */}
              {selectedContact.allLinkedPhones?.length > 1 && (
                <div style={{ padding: '6px 18px', background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--gold-400)', fontWeight: 600 }}>Linked Parties / Beneficiaries:</span>
                  {selectedContact.allLinkedPhones.map((lp, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        const match = clientDirectory.find(cd => cd.phone === lp && cd.caseId === selectedContact.caseId);
                        if (match) setSelectedContact(match);
                      }}
                      style={{
                        background: selectedContact.phone === lp ? 'var(--gold-500)' : 'var(--navy-800)',
                        color: selectedContact.phone === lp ? 'var(--navy-950)' : 'white',
                        border: '1px solid var(--border-default)',
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      📞 {lp} {idx === 0 ? '(Primary)' : `(Beneficiary ${idx})`}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '14px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Select a client from the directory to view communications.
            </div>
          )}

          {/* Quick Action Formal Templates Bar */}
          <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '6px', overflowX: 'auto' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>Templates:</span>
            <button onClick={() => handleApplyTemplate('hearing')} className="secondary-btn" style={{ padding: '3px 8px', fontSize: '0.7rem', color: '#64b5f6', borderColor: 'rgba(100,181,246,0.3)' }}>🏛️ Court Mention</button>
            <button onClick={() => handleApplyTemplate('fee')} className="secondary-btn" style={{ padding: '3px 8px', fontSize: '0.7rem', color: 'var(--gold-400)', borderColor: 'rgba(201,168,76,0.3)' }}>💳 Fee & Paybill</button>
            <button onClick={() => handleApplyTemplate('kyc')} className="secondary-btn" style={{ padding: '3px 8px', fontSize: '0.7rem', color: '#81c784', borderColor: 'rgba(129,199,132,0.3)' }}>📋 KYC Request</button>
            <button onClick={() => handleApplyTemplate('milestone')} className="secondary-btn" style={{ padding: '3px 8px', fontSize: '0.7rem', color: '#ba68c8', borderColor: 'rgba(186,104,200,0.3)' }}>📁 Milestone Brief</button>
          </div>

          {/* Conversation Stream Log */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No recent message logs for this client. Type a message below to dispatch directly via WhatsApp.
              </div>
            ) : (
              activeLogs.map(log => (
                <div 
                  key={log.id} 
                  style={{
                    alignSelf: log.direction === 'incoming' ? 'flex-start' : 'flex-end',
                    maxWidth: '82%',
                    background: log.direction === 'incoming' ? 'var(--navy-950)' : 'rgba(77,182,172,0.12)',
                    border: `1px solid ${log.direction === 'incoming' ? 'var(--border-default)' : 'rgba(77,182,172,0.3)'}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '0.68rem' }}>
                    <span style={{ fontWeight: 700, color: log.direction === 'incoming' ? '#64b5f6' : '#4db6ac' }}>
                      {log.direction === 'incoming' ? selectedContact?.name || log.phone : 'Firm Desk'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                  </div>
                  <div style={{ color: 'white', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                    {log.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message Composer */}
          <form onSubmit={handleSendMessage} style={{ padding: '14px', borderTop: '1px solid var(--border-default)', background: 'var(--navy-950)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea 
              rows="3"
              placeholder={`Write WhatsApp message to ${selectedContact?.name || 'client'}...`}
              value={composerMessage}
              onChange={e => setComposerMessage(e.target.value)}
              style={{ width: '100%', background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'white', padding: '10px', fontSize: '0.82rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Press <strong>Send to WhatsApp</strong> to dispatch immediately.
              </div>
              <button 
                type="submit"
                disabled={!isConnected || sendingMessage || !selectedContact?.phone || !composerMessage.trim()}
                className="primary-btn"
                style={{ padding: '7px 20px', fontSize: '0.8rem', background: !isConnected ? 'var(--navy-700)' : 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
              >
                {sendingMessage ? 'Sending...' : '⚡ Send to WhatsApp'}
              </button>
            </div>
          </form>

        </div>

        {/* ════ COLUMN 3: SOCABOT CO-PILOT & CLIENT ASSISTANT ════ */}
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          
          <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🤖</span> SocaBot Client Co-Pilot
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Generate tailored, professional WhatsApp updates with matter context
            </p>
          </div>

          {/* Quick AI Action Prompts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick AI Drafting Prompts:
            </span>
            <button 
              onClick={() => handleAskSocaBot('Draft an update explaining the mention was adjourned for 14 days to allow filing of written submissions')}
              disabled={aiDrafting || !selectedContact}
              className="secondary-btn"
              style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-primary)' }}
            >
              ⚖️ Mention Adjournment Update
            </button>
            <button 
              onClick={() => handleAskSocaBot('Politely remind the client of their outstanding retainer balance and ask for settlement before the next hearing')}
              disabled={aiDrafting || !selectedContact}
              className="secondary-btn"
              style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-primary)' }}
            >
              💳 Polite Fee Remittance Request
            </button>
            <button 
              onClick={() => handleAskSocaBot('Reassure the client regarding the defence filed by the opposing counsel and outline our response strategy')}
              disabled={aiDrafting || !selectedContact}
              className="secondary-btn"
              style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-primary)' }}
            >
              🛡️ Opposing Pleadings Reassurance
            </button>
          </div>

          {/* Custom SocaBot Instruction */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Custom SocaBot Instruction:
            </label>
            <textarea 
              rows="3"
              placeholder="e.g. Ask the client to sign and return the affidavit by Friday noon..."
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '0.76rem' }}
            />
            <button 
              onClick={() => handleAskSocaBot()}
              disabled={aiDrafting || !selectedContact || !aiPrompt.trim()}
              className="primary-btn"
              style={{ padding: '7px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #ba68c8, #7b1fa2)', color: 'white', fontWeight: 700 }}
            >
              {aiDrafting ? 'Drafting with SocaBot...' : '✨ Generate Draft'}
            </button>
          </div>

          {/* Keyword Reference Box */}
          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--gold-400)' }}>
              ⚡ Automated Client Keywords
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Clients can text these keywords anytime for instant replies:
              <ul style={{ margin: '4px 0 0', paddingLeft: '14px' }}>
                <li><strong>STATUS</strong> — Case progress & milestone</li>
                <li><strong>HEARING</strong> — Next date & Teams link</li>
                <li><strong>FEES</strong> — Outstanding balance & Paybill</li>
                <li><strong>KYC</strong> — Document verification check</li>
              </ul>
            </div>
          </div>

        </div>

      </div>

      {/* ── Add New Contact Modal ── */}
      {showAddContactModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, backdropFilter: 'blur(4px)', padding: '20px'
        }}>
          <div style={{
            background: 'var(--navy-900)', border: '1px solid var(--gold-500)', borderRadius: '10px',
            width: '100%', maxWidth: '480px', padding: '24px', color: 'white', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.1rem' }}>+ Add Client Contact</h3>
              <button onClick={() => setShowAddContactModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleAddContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CLIENT FULL NAME *</label>
                <input 
                  type="text" required
                  placeholder="e.g. Patrick Kamau"
                  value={newContactForm.client_name}
                  onChange={e => setNewContactForm({ ...newContactForm, client_name: e.target.value })}
                  style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '8px 10px', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>PHONE NUMBER *</label>
                <input 
                  type="text" required
                  placeholder="e.g. 0712345678 or +254712345678"
                  value={newContactForm.client_phone}
                  onChange={e => setNewContactForm({ ...newContactForm, client_phone: e.target.value })}
                  style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '8px 10px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>EMAIL ADDRESS</label>
                <input 
                  type="email"
                  placeholder="e.g. client@domain.co.ke"
                  value={newContactForm.client_email}
                  onChange={e => setNewContactForm({ ...newContactForm, client_email: e.target.value })}
                  style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '8px 10px', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>LEGAL SERVICE CATEGORY</label>
                <select 
                  value={newContactForm.service_category}
                  onChange={e => setNewContactForm({ ...newContactForm, service_category: e.target.value })}
                  style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '8px 10px', fontSize: '0.8rem' }}
                >
                  <option value="Litigation">Litigation & Dispute Resolution</option>
                  <option value="Conveyancing">Conveyancing & Land Transactions</option>
                  <option value="Commercial">Commercial & Corporate Law</option>
                  <option value="Probate">Succession & Probate</option>
                  <option value="Family">Family & Matrimonial Law</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddContactModal(false)} className="secondary-btn" style={{ padding: '7px 14px', fontSize: '0.78rem' }}>Cancel</button>
                <button type="submit" className="primary-btn" style={{ padding: '7px 16px', fontSize: '0.78rem', background: 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}>Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
