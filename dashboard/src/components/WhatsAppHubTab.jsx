import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPut } from '../api';
import { WhatsAppIcon, CheckIcon, SyncIcon, ShieldIcon, SendIcon } from './Icons';

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
  const [directoryFilter, setDirectoryFilter] = useState('all'); // 'all' | 'matters' | 'leads' | 'missing_phone'
  const [selectedContact, setSelectedContact] = useState(null);
  const [composerMessage, setComposerMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [broadcastingReminders, setBroadcastingReminders] = useState(false);
  const [persistentMessages, setPersistentMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [linkPhoneInput, setLinkPhoneInput] = useState('');
  const [linkingPhone, setLinkingPhone] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);

  // SocaBot Co-Pilot Drawer in WhatsApp Tab
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiGeneratedText, setAiGeneratedText] = useState('');

  // Quick Add Contact Modal
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  // Dedicated QR Code & Pairing Status Modal
  const [showQrModal, setShowQrModal] = useState(false);
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

  const fetchConversation = async (phone) => {
    if (!phone) return;
    try {
      setLoadingMessages(true);
      const res = await apiGet(`/api/whatsapp/messages/${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setPersistentMessages(data.messages);
      }
    } catch (e) {
      console.warn('Could not fetch conversation history:', e.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
      if (selectedContact?.phone) {
        fetchConversation(selectedContact.phone);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedContact?.phone]);

  useEffect(() => {
    if (selectedContact?.phone) {
      fetchConversation(selectedContact.phone);
    } else {
      setPersistentMessages([]);
    }
  }, [selectedContact?.phone]);

  const isConnected = statusData.status === 'CONNECTED';
  const qrImageSrc = statusData.qr 
    ? (statusData.qr.startsWith('data:image') || statusData.qr.startsWith('http') ? statusData.qr : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(statusData.qr)}`)
    : (statusData.rawQr ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(statusData.rawQr)}` : null);
  const isQrReady = !isConnected && (statusData.status === 'QR_READY' || !!qrImageSrc);

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

  // Consolidate client directory from all cases and all CRM leads
  const clientDirectory = useMemo(() => {
    const list = [];

    // 1. Add ALL active cases (even if phone is not yet entered)
    cases.forEach(c => {
      const phone = (c.client_phone || '').trim();
      const altPhones = (c.alternative_phone || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean);
      const allPhones = [phone, ...altPhones].filter(Boolean);

      list.push({
        id: `case_${c.id}_primary`,
        caseId: c.id,
        name: c.client_name || 'Unnamed Client',
        phone: phone,
        hasPhone: !!phone,
        roleTag: 'Primary Client',
        altPhone: c.alternative_phone || '',
        email: c.client_email || '',
        matterTitle: c.case_title || 'Active Matter',
        courtStation: c.court_station || 'Milimani Law Courts',
        trackingToken: c.tracking_token || c.ref_no || `SO-${(c.id || '').slice(-5).toUpperCase()}`,
        assignedLawyer: c.assigned_lawyer || 'Sam Ogola, Advocate',
        currentMilestone: c.current_milestone || '1',
        outstandingBalance: c.outstanding_balance || '0',
        totalFee: c.total_fee || '0',
        allLinkedPhones: allPhones,
        type: 'matter'
      });

      // Add linked beneficiaries/co-parties
      altPhones.forEach((ap, idx) => {
        list.push({
          id: `case_${c.id}_alt_${idx}`,
          caseId: c.id,
          name: `${c.client_name} (Beneficiary ${idx + 1})`,
          phone: ap,
          hasPhone: true,
          roleTag: `Beneficiary ${idx + 1}`,
          email: c.alternative_email ? c.alternative_email.split(/[,;]+/)[idx] || '' : '',
          matterTitle: c.case_title || 'Active Matter',
          courtStation: c.court_station || 'Milimani Law Courts',
          trackingToken: c.tracking_token || c.ref_no || `SO-${(c.id || '').slice(-5).toUpperCase()}`,
          assignedLawyer: c.assigned_lawyer || 'Sam Ogola, Advocate',
          currentMilestone: c.current_milestone || '1',
          outstandingBalance: c.outstanding_balance || '0',
          totalFee: c.total_fee || '0',
          allLinkedPhones: allPhones,
          type: 'matter'
        });
      });
    });

    // 2. Add ALL CRM leads
    leads.forEach(l => {
      const phone = (l.phone || '').trim();
      list.push({
        id: `lead_${l.id}`,
        leadId: l.id,
        name: l.full_name || 'Prospective Client',
        phone: phone,
        hasPhone: !!phone,
        roleTag: 'CRM Lead',
        email: l.email || '',
        matterTitle: l.service_category ? `${l.service_category} Intake` : 'CRM Intake Lead',
        courtStation: l.property_location ? `Location: ${l.property_location}` : 'Intake / Pre-litigation',
        trackingToken: `LEAD-${(l.id || '').slice(-5).toUpperCase()}`,
        assignedLawyer: l.assigned_lawyer || 'Reception Desk',
        currentMilestone: l.status === 'converted' ? 'Converted to Matter' : (l.consultation_paid ? 'Consultation Paid' : 'Pending Review'),
        outstandingBalance: '0',
        totalFee: l.property_value ? `Est. Value: KES ${Number(l.property_value).toLocaleString()}` : '0',
        allLinkedPhones: phone ? [phone] : [],
        type: 'lead',
        leadData: l
      });
    });

    return list;
  }, [cases, leads]);

  // Filter counts
  const matterCount = useMemo(() => clientDirectory.filter(c => c.type === 'matter').length, [clientDirectory]);
  const leadCount = useMemo(() => clientDirectory.filter(c => c.type === 'lead').length, [clientDirectory]);
  const missingPhoneCount = useMemo(() => clientDirectory.filter(c => !c.hasPhone).length, [clientDirectory]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    let result = clientDirectory;
    if (directoryFilter === 'matters') result = result.filter(c => c.type === 'matter');
    if (directoryFilter === 'leads') result = result.filter(c => c.type === 'lead');
    if (directoryFilter === 'missing_phone') result = result.filter(c => !c.hasPhone);

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      c.matterTitle.toLowerCase().includes(q) ||
      c.trackingToken.toLowerCase().includes(q)
    );
  }, [clientDirectory, directoryFilter, searchQuery]);

  const handleLinkPhone = async () => {
    if (!selectedContact?.caseId || !linkPhoneInput.trim()) return;
    setLinkingPhone(true);
    try {
      await apiPut(`/api/cases/${selectedContact.caseId}`, { client_phone: linkPhoneInput.trim() });
      if (showToast) showToast('✅ WhatsApp phone linked to matter!', 'success');
      if (fetchData) fetchData();
      setLinkPhoneInput('');
    } catch (e) {
      if (showToast) showToast('⚠️ Error linking phone: ' + e.message, 'error');
    } finally {
      setLinkingPhone(false);
    }
  };

  const handleConvertLead = async () => {
    if (!selectedContact?.leadId) return;
    if (!window.confirm(`Convert intake lead "${selectedContact.name}" into an active matter dossier?`)) return;
    setConvertingLead(true);
    try {
      const res = await apiPost(`/api/leads/${selectedContact.leadId}/convert`, {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to convert lead');
      if (showToast) showToast(`🎉 Lead converted to Active Matter (${data.trackingToken})!`, 'success');
      if (fetchData) fetchData();
    } catch (e) {
      if (showToast) showToast('⚠️ Error converting lead: ' + e.message, 'error');
    } finally {
      setConvertingLead(false);
    }
  };

  // Set default selected contact
  useEffect(() => {
    if (clientDirectory.length > 0 && !selectedContact) {
      setSelectedContact(clientDirectory[0]);
    }
  }, [clientDirectory, selectedContact]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedContact?.phone || !composerMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await apiPost('/api/whatsapp/send', {
        phone: selectedContact.phone,
        message: composerMessage.trim(),
        case_id: selectedContact.caseId || null
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch message');
      if (showToast) showToast(`✅ Message sent to ${selectedContact.name}!`, 'success');
      setComposerMessage('');
      fetchStatus();
      if (selectedContact?.phone) fetchConversation(selectedContact.phone);
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
      const res = await apiPost('/api/soca-pa/chat', {
        message: `Act as the Executive Advocate for Sam Ogola & Co. Advocates. Draft a formal, clear WhatsApp client message for:
Client: ${selectedContact.name}
Phone: ${selectedContact.phone || 'On file'}
Matter: ${selectedContact.matterTitle} (${selectedContact.trackingToken})
Court Station: ${selectedContact.courtStation}
Assigned Counsel: ${selectedContact.assignedLawyer}
Outstanding Balance: KES ${selectedContact.outstandingBalance}

Instruction: ${prompt}

Format rules: Clean WhatsApp formatting with professional emojis and bullet points. Include advocate sign-off.`,
        matter_id: selectedContact.caseId || null
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

  // Filter logs for selected contact or show persistent DB conversation
  const activeLogs = useMemo(() => {
    if (persistentMessages && persistentMessages.length > 0) {
      return persistentMessages.map(m => ({
        id: m.id,
        phone: m.phone,
        direction: m.direction,
        text: m.message_text,
        handler: m.handler,
        status: m.status || 'sent',
        timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
      }));
    }
    if (!statusData.logs) return [];
    if (!selectedContact?.phone) return statusData.logs;
    const cleanPhone = selectedContact.phone.replace(/\D/g, '').slice(-9);
    return statusData.logs.filter(l => (l.phone || '').includes(cleanPhone));
  }, [persistentMessages, statusData.logs, selectedContact]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', gap: '18px', padding: '20px 24px', overflowY: 'auto' }}>
      
      {/* ── Top Executive Bar ── */}
      <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350',
            boxShadow: `0 0 10px ${isConnected ? '#4db6ac' : isQrReady ? 'var(--gold-400)' : '#ef5350'}`
          }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.15rem', fontFamily: 'var(--font-display)' }}>
                Client Communications & WhatsApp Desk
              </h2>
              <span style={{ fontSize: '0.68rem', color: '#4db6ac', background: 'rgba(77,182,172,0.12)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(77,182,172,0.3)', fontWeight: 600 }}>
                🟢 Cross-Device Synced
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {isConnected 
                ? `Firm Desk Active: +${statusData.phoneNumber || 'Linked Number'} • Automated Case Updates & Direct Client Messaging`
                : isQrReady 
                ? 'Scan pairing QR code with your firm phone to activate desk'
                : 'Firm Gateway Standby (Messages will relay via Cloud / Sync automatically)'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => setShowQrModal(true)}
            className="secondary-btn"
            style={{ padding: '7px 14px', fontSize: '0.78rem', borderColor: isConnected ? 'rgba(77,182,172,0.4)' : 'var(--gold-400)', color: isConnected ? '#4db6ac' : 'var(--gold-400)', fontWeight: 600 }}
          >
            {isConnected ? '🟢 Desk Connected' : '📲 Scan QR Code'}
          </button>

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

      {/* ── 3-Column Communications Workspace ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr minmax(300px, 340px)', gap: '18px', flex: 1, minHeight: '620px' }}>
        
        {/* ════ COLUMN 1: CLIENT DIRECTORY ════ */}
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', display: 'flex', flexDirection: 'column', minHeight: '560px' }}>
          
          {/* Directory Search, Filters & Add */}
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

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setDirectoryFilter('all')}
                style={{
                  background: directoryFilter === 'all' ? 'var(--gold-500)' : 'var(--navy-950)',
                  color: directoryFilter === 'all' ? 'var(--navy-950)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                All ({clientDirectory.length})
              </button>
              <button
                onClick={() => setDirectoryFilter('matters')}
                style={{
                  background: directoryFilter === 'matters' ? '#4db6ac' : 'var(--navy-950)',
                  color: directoryFilter === 'matters' ? 'var(--navy-950)' : '#4db6ac',
                  border: '1px solid rgba(77,182,172,0.3)',
                  borderRadius: '12px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Matters ({matterCount})
              </button>
              <button
                onClick={() => setDirectoryFilter('leads')}
                style={{
                  background: directoryFilter === 'leads' ? '#64b5f6' : 'var(--navy-950)',
                  color: directoryFilter === 'leads' ? 'var(--navy-950)' : '#64b5f6',
                  border: '1px solid rgba(100,181,246,0.3)',
                  borderRadius: '12px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                CRM Leads ({leadCount})
              </button>
              {missingPhoneCount > 0 && (
                <button
                  onClick={() => setDirectoryFilter('missing_phone')}
                  style={{
                    background: directoryFilter === 'missing_phone' ? '#ff9800' : 'var(--navy-950)',
                    color: directoryFilter === 'missing_phone' ? 'var(--navy-950)' : '#ffb74d',
                    border: '1px solid rgba(255,152,0,0.3)',
                    borderRadius: '12px', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ⚠️ Unlinked ({missingPhoneCount})
                </button>
              )}
            </div>
          </div>

          {/* Contact List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filteredContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No contacts matching this filter.
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '0.7rem' }}>
                      {c.hasPhone ? (
                        <span style={{ color: 'var(--text-muted)' }}>📞 {c.phone}</span>
                      ) : (
                        <span style={{ color: '#ffb74d', fontWeight: 600 }}>⚠️ No Phone Linked</span>
                      )}
                      <span style={{ 
                        color: c.type === 'matter' ? '#4db6ac' : '#64b5f6', 
                        background: c.type === 'matter' ? 'rgba(77,182,172,0.1)' : 'rgba(100,181,246,0.1)',
                        padding: '1px 6px', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 600
                      }}>
                        {c.type === 'matter' ? 'Active Matter' : 'CRM Lead'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ════ COLUMN 2: CONVERSATION DESK & COMPOSER ════ */}
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Active Contact Header or Global Stream Header */}
          {selectedContact ? (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', background: 'var(--navy-950)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '0.95rem' }}>{selectedContact.name}</h3>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      color: selectedContact.type === 'matter' ? 'var(--gold-400)' : '#64b5f6', 
                      background: selectedContact.type === 'matter' ? 'rgba(201,168,76,0.1)' : 'rgba(100,181,246,0.1)', 
                      padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' 
                    }}>
                      {selectedContact.roleTag || 'Client'}
                    </span>
                    <button 
                      onClick={() => setSelectedContact(null)}
                      className="secondary-btn"
                      style={{ padding: '2px 8px', fontSize: '0.68rem', borderColor: 'var(--border-default)', color: 'var(--text-secondary)', marginLeft: '6px' }}
                    >
                      🌐 View All Messages
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {selectedContact.hasPhone ? `📞 ${selectedContact.phone}` : '⚠️ Phone not linked'} • {selectedContact.matterTitle} ({selectedContact.courtStation})
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div>Counsel: <strong style={{ color: 'white' }}>{selectedContact.assignedLawyer}</strong></div>
                  <div>Balance: <strong style={{ color: parseFloat(selectedContact.outstandingBalance) > 0 ? '#ef5350' : '#4db6ac' }}>KES {parseFloat(selectedContact.outstandingBalance || 0).toLocaleString()}</strong></div>
                </div>
              </div>

              {/* In-Place Phone Linker Banner if Matter has No Phone */}
              {!selectedContact.hasPhone && selectedContact.type === 'matter' && (
                <div style={{ padding: '10px 18px', background: 'rgba(255,152,0,0.12)', borderBottom: '1px solid rgba(255,152,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: '#ffb74d', fontWeight: 600 }}>No WhatsApp Phone Number Linked</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Enter client's mobile number to enable instant WhatsApp chat & court notices.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="text" 
                      placeholder="+254 7XX XXX XXX" 
                      value={linkPhoneInput} 
                      onChange={e => setLinkPhoneInput(e.target.value)}
                      style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'white', padding: '5px 8px', fontSize: '0.76rem', width: '150px' }}
                    />
                    <button 
                      onClick={handleLinkPhone} 
                      disabled={linkingPhone || !linkPhoneInput.trim()}
                      className="primary-btn" 
                      style={{ padding: '5px 12px', fontSize: '0.74rem', background: 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
                    >
                      {linkingPhone ? 'Saving...' : '💾 Link Phone'}
                    </button>
                  </div>
                </div>
              )}

              {/* CRM Intake Lead Banner with 1-Click Convert */}
              {selectedContact.type === 'lead' && (
                <div style={{ padding: '10px 18px', background: 'rgba(100,181,246,0.1)', borderBottom: '1px solid rgba(100,181,246,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#90caf9', fontWeight: 700 }}>📋 CRM Intake Lead: {selectedContact.name}</span>
                      <span style={{ fontSize: '0.68rem', color: '#81c784', background: 'rgba(129,199,132,0.15)', padding: '1px 6px', borderRadius: '3px' }}>
                        {selectedContact.currentMilestone}
                      </span>
                    </div>
                    {selectedContact.leadData?.message && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                        "{selectedContact.leadData.message}"
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleConvertLead}
                    disabled={convertingLead}
                    className="primary-btn"
                    style={{ padding: '5px 12px', fontSize: '0.74rem', background: 'var(--gold-gradient)', color: 'var(--navy-950)', fontWeight: 700 }}
                  >
                    {convertingLead ? 'Converting...' : '⚡ Convert to Active Matter'}
                  </button>
                </div>
              )}

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
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', background: 'var(--navy-950)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '0.95rem' }}>🌐 All Live WhatsApp Messages</h3>
                  <span style={{ fontSize: '0.7rem', color: '#4db6ac', background: 'rgba(77,182,172,0.12)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(77,182,172,0.3)' }}>
                    {statusData.logs?.length || 0} Recent Messages
                  </span>
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Live feed of all messages to and fro. Tap any message or client on the left to filter.
                </div>
              </div>
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
                {selectedContact 
                  ? 'No recent message logs for this client. Type a message below to dispatch directly via WhatsApp.'
                  : 'No WhatsApp messages logged yet. Pair phone to begin live messaging.'}
              </div>
            ) : (
              activeLogs.map(log => {
                const matchedClient = clientDirectory.find(cd => {
                  const cleanP = (cd.phone || '').replace(/\D/g, '').slice(-9);
                  return cleanP && (log.phone || '').includes(cleanP);
                });

                return (
                  <div 
                    key={log.id} 
                    style={{
                      alignSelf: log.direction === 'incoming' ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      background: log.direction === 'incoming' ? 'var(--navy-950)' : 'rgba(77,182,172,0.1)',
                      border: `1px solid ${log.direction === 'incoming' ? 'var(--border-default)' : 'rgba(77,182,172,0.25)'}`,
                      borderRadius: 'var(--radius-sm, 3px)',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      cursor: !selectedContact && matchedClient ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (!selectedContact && matchedClient) setSelectedContact(matchedClient);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '0.68rem' }}>
                      <span style={{ fontWeight: 600, color: log.direction === 'incoming' ? '#64b5f6' : '#4db6ac' }}>
                        {log.direction === 'incoming' 
                          ? (matchedClient ? `${matchedClient.name} (${log.phone})` : `Client (${log.phone})`)
                          : `Chambers Desk → ${matchedClient?.name || log.phone}`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {log.handler && (
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '2px' }}>
                            {log.handler === 'ai' ? 'Auto' : log.handler === 'deterministic' ? 'System' : log.handler}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                      </div>
                    </div>
                    <div style={{ color: 'white', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {log.text}
                    </div>
                    {!selectedContact && matchedClient && (
                      <div style={{ fontSize: '0.66rem', color: 'var(--gold-400)', marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '3px' }}>
                        Matter: {matchedClient.matterTitle} (Click to open client thread)
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Message Composer */}
          <form onSubmit={handleSendMessage} style={{ padding: '14px', borderTop: '1px solid var(--border-default)', background: 'var(--navy-950)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea 
              rows="3"
              placeholder={`Write WhatsApp message to ${selectedContact?.name || 'client'}...`}
              value={composerMessage}
              onChange={e => setComposerMessage(e.target.value)}
              style={{ width: '100%', background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', color: 'white', padding: '10px', fontSize: '0.82rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Press <strong>Dispatch</strong> to send client notification.
              </div>
              <button 
                type="submit"
                disabled={!isConnected || sendingMessage || !selectedContact?.phone || !composerMessage.trim()}
                className="primary-btn"
                style={{ padding: '7px 20px', fontSize: '0.8rem', background: !isConnected ? 'var(--navy-700)' : 'var(--gold-500)', color: 'var(--navy-950)', fontWeight: 700 }}
              >
                {sendingMessage ? 'Sending...' : 'Dispatch to WhatsApp'}
              </button>
            </div>
          </form>

        </div>

        {/* ════ COLUMN 3: DRAFTING ASSISTANT ════ */}
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          
          <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '0.92rem', fontWeight: 600 }}>
              Client Notice Drafting Desk
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Prepare professional legal updates contextualized with active matter pleadings
            </p>
          </div>

          {/* Quick Drafting Prompts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Standard Notice Templates:
            </span>
            <button 
              onClick={() => handleAskSocaBot('Draft an update explaining the mention was adjourned for 14 days to allow filing of written submissions')}
              disabled={aiDrafting || !selectedContact}
              className="secondary-btn"
              style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm, 3px)' }}
            >
              Mention Adjournment Notice
            </button>
            <button 
              onClick={() => handleAskSocaBot('Politely remind the client of their outstanding retainer balance and ask for settlement before the next hearing')}
              disabled={aiDrafting || !selectedContact}
              className="secondary-btn"
              style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm, 3px)' }}
            >
              Fee Balance Remittance Request
            </button>
            <button 
              onClick={() => handleAskSocaBot('Reassure the client regarding the defence filed by the opposing counsel and outline our response strategy')}
              disabled={aiDrafting || !selectedContact}
              className="secondary-btn"
              style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm, 3px)' }}
            >
              Pleadings & Defense Strategy Summary
            </button>
          </div>

          {/* Custom Instruction */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Custom Drafting Instruction:
            </label>
            <textarea 
              rows="3"
              placeholder="e.g. Advise the client that affidavits are ready for signing at chambers..."
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', color: 'white', padding: '8px', fontSize: '0.76rem' }}
            />
            <button 
              onClick={() => handleAskSocaBot()}
              disabled={aiDrafting || !selectedContact || !aiPrompt.trim()}
              className="primary-btn"
              style={{ padding: '7px', fontSize: '0.75rem', fontWeight: 700 }}
            >
              {aiDrafting ? 'Drafting Notice...' : 'Generate Notice Draft'}
            </button>
          </div>

          {/* Keyword Reference Box */}
          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '12px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--gold-400)', letterSpacing: '0.02em' }}>
              Client SMS & WhatsApp Inbound Commands
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Clients can text these keywords for automated replies:
              <ul style={{ margin: '4px 0 0', paddingLeft: '14px' }}>
                <li><strong>STATUS</strong> — Matter progress & milestone</li>
                <li><strong>HEARING</strong> — Next date & MS Teams link</li>
                <li><strong>FEES</strong> — Outstanding balance & Paybill</li>
                <li><strong>KYC</strong> — Pleading & ID checklist</li>
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

      {/* ── Dedicated QR Code & Pairing Modal ── */}
      {showQrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, backdropFilter: 'blur(5px)', padding: '20px'
        }}>
          <div style={{
            background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)',
            width: '100%', maxWidth: '440px', padding: '24px', color: 'white', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center',
            boxShadow: 'var(--shadow-navy, 0 20px 60px rgba(0,0,0,0.85))'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WhatsAppIcon size={14} color="var(--gold-400)" />
                </div>
                <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.02rem', fontFamily: 'var(--font-display)' }}>WhatsApp Desk Pairing</h3>
              </div>
              <button onClick={() => setShowQrModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {isConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: 'var(--radius-sm, 3px)', background: 'rgba(77,182,172,0.1)', border: '1px solid #4db6ac', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4db6ac' }}>
                  <CheckIcon size={24} color="#4db6ac" />
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'white', fontSize: '0.98rem' }}>Firm Desk Connected</h4>
                  <div style={{ fontSize: '0.82rem', color: '#4db6ac', fontWeight: 600, marginTop: '4px' }}>
                    +{statusData.phoneNumber || 'Linked Phone'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Connected at: {statusData.connectedAt ? new Date(statusData.connectedAt).toLocaleTimeString() : 'Active Session'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button 
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="secondary-btn"
                    style={{ padding: '7px 16px', fontSize: '0.78rem', borderColor: '#ef5350', color: '#ef5350', borderRadius: 'var(--radius-sm, 3px)' }}
                  >
                    Unlink Device
                  </button>
                  <button 
                    onClick={() => setShowQrModal(false)}
                    className="primary-btn"
                    style={{ padding: '7px 16px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 700 }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (isQrReady || loading) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', maxWidth: '380px' }}>
                  Open WhatsApp on your firm phone &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>, then scan below:
                </p>
                {qrImageSrc ? (
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm, 3px)', display: 'inline-block' }}>
                    <img src={qrImageSrc} alt="Pairing QR" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ padding: '30px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', border: '2px solid var(--gold-400)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Generating fresh pairing QR code...</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold-400)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--gold-300)' }}>Waiting for phone scan &bull; Auto-pairs instantly</span>
                </div>
                <button 
                  onClick={handleReconnect}
                  disabled={loading}
                  className="secondary-btn"
                  style={{ padding: '6px 14px', fontSize: '0.74rem', borderRadius: 'var(--radius-sm, 3px)' }}
                >
                  Refresh QR Code
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px 0' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WhatsAppIcon size={20} color="var(--gold-400)" />
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Click below to generate a fresh pairing QR code for your firm's WhatsApp phone.
                </p>
                <button 
                  onClick={handleReconnect}
                  disabled={loading}
                  className="primary-btn"
                  style={{ padding: '9px 20px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 700 }}
                >
                  {loading ? 'Initializing Engine...' : 'Generate Pairing QR'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
