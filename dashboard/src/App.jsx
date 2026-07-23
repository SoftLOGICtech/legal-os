import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomeDashboard from './components/HomeDashboard';
import CalendarTab from './components/CalendarTab';
import JudiciaryIngestionModal from './components/JudiciaryIngestionModal';
import JudiciaryApiSettingsModal from './components/JudiciaryApiSettingsModal';
import DocumentStudio from './components/DocumentStudio';
import './App.css';
import Login from './Login';
import logoImg from './logo.png';
import { getSession, clearSession, isAdmin, isSecretary, apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload, BASE } from './api';

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[m][n];
}
function tokenScore(q, target) {
  if (!q || !target) return 0;
  const qt = q.toLowerCase().split(/\s+/);
  const tt = target.toLowerCase().split(/\s+/);
  let best = 0;
  for (const a of qt) for (const b of tt) {
    const dist = levenshtein(a, b);
    const s = Math.round((1 - dist / Math.max(a.length, b.length)) * 100);
    if (s > best) best = s;
  }
  return best;
}

const PAYMENT_STATUS_LABELS = {
  none:    { label: 'No Payment Logged', color: 'var(--text-muted)' },
  pending: { label: 'Payment Pending',   color: '#ff9800' },
  paid:    { label: 'Confirmed Paid',    color: '#4db6ac' },
};

const EVENT_TYPES = ['hearing', 'mention', 'directions', 'filing_deadline'];
const ACTIVITY_TYPES = ['internal_note', 'client_call', 'court_filing', 'milestone_change', 'custom'];
const EXPENSE_CATEGORIES = ['transport', 'filing_fees', 'stationery', 'internet', 'other'];
const DEFAULT_LAWYERS = ['Sam Ogola', 'Ms Ivy'];

const TEMPLATES = [
  { id: 'notice_of_appearance', title: 'Notice of Appearance',
    description: 'Formally registers the firm as legal representatives in court.',
    fields: ['client_name','case_title','case_type','tracking_token','opposing_party','assigned_lawyer','ref_no'] },
  { id: 'intake_confirmation', title: 'Client Intake Confirmation',
    description: 'Acknowledgement letter sent to the client on case registration.',
    fields: ['client_name','case_title','tracking_token','assigned_lawyer'] },
  { id: 'hearing_notice', title: 'Hearing Notice to Client',
    description: 'Notifies the client of an upcoming court date or mention.',
    fields: ['client_name','case_title','event_title','event_date','notes'] },
  { id: 'blank_letter', title: 'Blank Custom Document',
    description: 'Start with a raw blank page with SOCA letterhead styling.',
    fields: ['client_name'] }
];

function buildTemplateText(tplId, data) {
  const date = new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' });
  if (tplId === 'notice_of_appearance') return `NOTICE OF APPEARANCE

Date: ${date}
Matter: ${data.case_title || '_______________'}
Case Type: ${data.case_type || '_______________'}
Judiciary Case ID: ${data.judiciary_case_id || data.ref_no || '_______________'}
Client: ${data.client_name || '_______________'}
Opposing Party: ${data.opposing_party || '_______________'}

TAKE NOTICE that Sam Ogola & Co. Advocates hereby enters appearance on behalf of the client in the above-captioned matter.

All correspondence regarding this matter should be directed to:
${data.assigned_lawyer || 'The Advocate'}
Sam Ogola & Co. Advocates

___________________________
For: SAM OGOLA & CO. ADVOCATES`;

  if (tplId === 'intake_confirmation') return `CLIENT INTAKE CONFIRMATION

Date: ${date}

Dear ${data.client_name || '_______________'},

RE: CLIENT INTAKE — "${data.case_title || '_______________'}"

We write to confirm that your matter has been formally registered with our firm.
Your Judiciary Case ID is: ${data.judiciary_case_id || '_______________'}
Your assigned advocate is: ${data.assigned_lawyer || '_______________'}

You may check the status of your case at any time by sending your tracking reference via WhatsApp.

Yours faithfully,
___________________________
For: SAM OGOLA & CO. ADVOCATES`;

  if (tplId === 'hearing_notice') return `HEARING NOTICE

Date: ${date}

Dear ${data.client_name || '_______________'},

RE: COURT HEARING STATUS — "${data.case_title || '_______________'}"

Please take notice that your matter is scheduled for:
Event: ${data.event_title || 'Court Mention'}
Date & Time: ${data.event_date ? new Date(data.event_date).toLocaleString('en-KE') : '_______________'}
Venue / Notes: ${data.notes || 'Milimani Courts'}

Kindly ensure your availability.

Yours faithfully,
___________________________
For: SAM OGOLA & CO. ADVOCATES`;

  if (tplId === 'blank_letter') return `CUSTOM LETTER

Date: ${date}
Client: ${data.client_name || '_______________'}

Type your custom letter details here...`;

  return '';
}

function App() {
  const [session, setSession_] = useState(() => getSession());

  const handleLogin = (data) => {
    setSession_(data);
  };
  const handleLogout = () => {
    clearSession();
    setSession_(null);
  };

  if (!session) return <Login onLogin={handleLogin} />;

  return <MainDashboard session={session} handleLogout={handleLogout} />;
}

function MainDashboard({ session, handleLogout }) {
  // ── Main app state ───────────────────────────────────────────────────
  const userRole        = session.role;
  const userDisplayName = session.display_name;
  const userCanEdit     = userRole === 'admin' || userRole === 'secretary';

  // Toast notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // PWA Install Prompt
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPwaPrompt(e);
      // Only show banner on mobile
      if (window.innerWidth <= 768) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const handleInstall = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setPwaPrompt(null);
  };


  // Avatar (persisted per user in localStorage)
  const avatarKey = `legal_os_avatar_${session.username}`;
  const [avatarSrc, setAvatarSrc] = useState(() => localStorage.getItem(avatarKey) || null);
  const avatarInputRef = useRef(null);
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      localStorage.setItem(avatarKey, b64);
      setAvatarSrc(b64);
    };
    reader.readAsDataURL(file);
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('isSidebarCollapsed') === 'true');
  const toggleSidebar = () => {
    const nextVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextVal);
    localStorage.setItem('isSidebarCollapsed', String(nextVal));
  };

  const [activeTab, setActiveTab]   = useState('leads');
  const [clock, setClock]           = useState(new Date().toLocaleTimeString());
  const [leads, setLeads]           = useState([]);
  const [cases, setCases]           = useState([]);
  const [calendar, setCalendar]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [conflictResults, setConflictResults] = useState([]);
  const [conflictQuery, setConflictQuery] = useState('');
  const [users, setUsers]           = useState([]);
  const [lawyersList, setLawyersList] = useState(DEFAULT_LAWYERS);
  const [newLawyerInput, setNewLawyerInput] = useState('');

  const fetchLawyers = useCallback(() => {
    apiGet('/api/lawyers')
      .then(r => r?.json())
      .then(d => {
        if (d && Array.isArray(d)) {
          const names = d.map(item => typeof item === 'string' ? item : item.name);
          if (names.length > 0) setLawyersList(names);
        }
      }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  const handleAddLawyer = async (e) => {
    e.preventDefault();
    if (!newLawyerInput.trim()) return;
    try {
      const r = await apiPost('/api/lawyers', { name: newLawyerInput.trim() });
      if (r && r.ok) {
        showToast(`⚖️ Advocate "${newLawyerInput.trim()}" added to firm roster.`, 'success');
        setNewLawyerInput('');
        fetchLawyers();
      } else {
        const data = await r?.json();
        showToast(data?.error || 'Failed to add advocate.', 'error');
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLawyer = async (lawyerName) => {
    if (!window.confirm(`Remove advocate "${lawyerName}" from firm roster?`)) return;
    try {
      const r = await apiDelete(`/api/lawyers/${encodeURIComponent(lawyerName)}`);
      if (r && r.ok) {
        showToast(`Advocate "${lawyerName}" removed from active roster.`, 'info');
        fetchLawyers();
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  // Admin: user management form
  const [newUserForm, setNewUserForm] = useState({ username:'', display_name:'', password:'', role:'secretary' });
  const [userMgmtMsg, setUserMgmtMsg] = useState('');

  // Filters
  const [filterBy, setFilterBy]       = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  
  // Finance Filters
  const [expenseCaseFilter, setExpenseCaseFilter]   = useState('all');
  const [expenseStartDate, setExpenseStartDate]     = useState('');
  const [expenseEndDate, setExpenseEndDate]         = useState('');

  // Archives Vault Lock & Search State
  const [isVaultUnlocked, setIsVaultUnlocked]       = useState(false);
  const [vaultUnlockExpiry, setVaultUnlockExpiry]   = useState(null);
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [vaultAuthError, setVaultAuthError]         = useState('');
  const [vaultAuthLoading, setVaultAuthLoading]     = useState(false);
  const [vaultSearchQuery, setVaultSearchQuery]     = useState('');
  const [vaultTimeRemaining, setVaultTimeRemaining] = useState('');

  // Archives 15-minute countdown timer effect
  useEffect(() => {
    if (!isVaultUnlocked || !vaultUnlockExpiry) return;
    const interval = setInterval(() => {
      const remainingMs = vaultUnlockExpiry - Date.now();
      if (remainingMs <= 0) {
        setIsVaultUnlocked(false);
        setVaultUnlockExpiry(null);
        setVaultTimeRemaining('');
        showToast('🔒 Archives Vault security session expired (15m timeout). Vault locked.', 'info');
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setVaultTimeRemaining(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isVaultUnlocked, vaultUnlockExpiry]);

  const handleUnlockVaultSubmit = async (e) => {
    e.preventDefault();
    setVaultAuthError('');
    setVaultAuthLoading(true);
    try {
      const res = await apiPost('/api/auth/verify-password', { password: vaultPasswordInput });
      if (!res) return; // session expired/401 handled by api.js
      const contentType = res.headers ? res.headers.get('content-type') : null;
      if (!contentType || !contentType.includes('application/json')) {
        setVaultAuthError('Server endpoint unavailable or non-JSON response. Please verify backend server is running on port 3001.');
        return;
      }
      const data = await res.json();
      if (res.ok && data?.success) {
        setIsVaultUnlocked(true);
        const expiry = Date.now() + 15 * 60 * 1000;
        setVaultUnlockExpiry(expiry);
        setVaultPasswordInput('');
        showToast('🏛️ Archives Vault Unlocked (15-minute security session).', 'success');
      } else {
        setVaultAuthError(data?.error || 'Incorrect account password.');
      }
    } catch (err) {
      setVaultAuthError(err.message || 'Failed to authenticate password.');
    } finally {
      setVaultAuthLoading(false);
    }
  };

  const handleLockVaultNow = () => {
    setIsVaultUnlocked(false);
    setVaultUnlockExpiry(null);
    setVaultTimeRemaining('');
    showToast('🔒 Archives Vault locked.', 'info');
  };

  const handleReopenCase = (caseId, clientName) => {
    if (!window.confirm(`Re-open case for "${clientName}" and return it to Active Matters?`)) return;
    apiPut(`/api/cases/${caseId}/milestone`, { milestone: '1' })
      .then(r => r?.json())
      .then(() => {
        showToast(`🔓 Matter for "${clientName}" re-opened to Phase 1!`, 'success');
        apiPost('/api/activities', {
          case_id: caseId,
          activity_type: 'milestone_change',
          description: `🔓 Matter Re-opened from Archives Vault back to Phase 1 (Active)`,
          recorded_by: userDisplayName
        }).then(() => fetchActivities());
        fetchData();
      });
  };

  // Modals
  const [showNewLeadModal, setShowNewLeadModal]       = useState(false);
  const [showNewCaseModal, setShowNewCaseModal]       = useState(false);
  const [showEditMilestoneModal, setShowEditMilestoneModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal]     = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showDocModal, setShowDocModal]               = useState(null); // template id
  const [bulkPrintDocs, setBulkPrintDocs]             = useState([]);   // array of strings for bulk printing
  const [bulkPrintPending, setBulkPrintPending]       = useState(false); // triggers print after render
  const [showPaymentModal, setShowPaymentModal]       = useState(false);
  const [showEditFeeModal, setShowEditFeeModal]       = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showJudiciaryModal, setShowJudiciaryModal]   = useState(false);
  const [showJudiciaryIngestionModal, setShowJudiciaryIngestionModal] = useState(false);
  const [showJudiciaryApiSettingsModal, setShowJudiciaryApiSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal]       = useState(false);
  const [showMobileDrawer, setShowMobileDrawer]       = useState(false);
  const [profileForm, setProfileForm]                 = useState({ display_name: '', username: '', password: '' });
  const [selectedLead, setSelectedLead]               = useState(null);
  const [editingEvent, setEditingEvent]               = useState(null);
  const [liveKeTime, setLiveKeTime]                   = useState('');
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Case Tracker & Matter Dashboard
  const [activeMatterId, setActiveMatterId] = useState(null);
  const [matterTab, setMatterTab] = useState('overview');
  const [caseFiles, setCaseFiles] = useState([]);
  const [casePayments, setCasePayments] = useState([]);
  const [caseInvoices, setCaseInvoices] = useState([]);
  const [caseDisbursements, setCaseDisbursements] = useState([]);
  const [caseSubmissions, setCaseSubmissions] = useState([]);
  const [showAddSubmissionModal, setShowAddSubmissionModal] = useState(false);
  const [newSubmissionForm, setNewSubmissionForm] = useState({
    title: '', submission_type: 'written_submissions', due_date: '', status: 'drafting', assigned_lawyer: '', notes: ''
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState('1');
  const [editableMilestones, setEditableMilestones] = useState([]);
  const [newPaymentForm, setNewPaymentForm] = useState({ amount: '', payment_ref: '', payment_method: 'MPESA', notes: '', destination: 'operating', invoice_id: '' });
  const [newActivityForm, setNewActivityForm] = useState({ activity_type: 'internal_note', description: '', recorded_by: 'Secretary' });

  // Legal Accounting Modal States
  const [showAddDisbursementModal, setShowAddDisbursementModal] = useState(false);
  const [newDisbursementForm, setNewDisbursementForm] = useState({ amount:'', description:'', payment_method:'M-PESA' });
  
  const [showGenerateInvoiceModal, setShowGenerateInvoiceModal] = useState(false);
  const [newInvoiceForm, setNewInvoiceForm] = useState({ invoice_number:'', amount:'', notes:'', due_date:'', selectedDisbursements:[] });
  
  const [showTrustTransferModal, setShowTrustTransferModal] = useState(false);
  const [trustTransferForm, setTrustTransferForm] = useState({ amount:'', invoice_id:'', notes:'' });

  // Document Editor State
  const [editedDocContent, setEditedDocContent] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [bulkRecipientType, setBulkRecipientType] = useState('cases'); // 'cases' or 'leads'
  const [bulkTemplateBody, setBulkTemplateBody] = useState('');
  const [importType, setImportType] = useState('cases');
  const [parsedRows, setParsedRows] = useState([]);
  const [importFeedback, setImportFeedback] = useState('');

  // Forms
  const [newLeadForm, setNewLeadForm] = useState({
    full_name:'', phone:'', email:'', service_category:'Civil Disputes',
    message:'', source:'walk_in', opposing_party:'', is_emergency:false, conflict_checked:false,
    id_number:'', kra_pin:'', address:'', custom_kyc:'',
    dob:'', occupation:'', opposing_party_contact:'', billing_type:'flat',
    emergency_name:'', emergency_phone:'', emergency_relation:'',
    alternative_phone:'', alternative_email:'',
    opposing_counsel_name:'', opposing_counsel_firm:'', opposing_counsel_phone:'', opposing_counsel_email:'', opposing_counsel_address:'',
    assigned_judge:'', court_division:''
  });
  const [newCaseForm, setNewCaseForm] = useState({
    client_name:'', case_title:'', case_type:'Civil Disputes',
    assigned_lawyer:'Sam Ogola', opposing_party:'', ref_no:'', is_sensitive:false, tracking_token:'',
    id_number:'', kra_pin:'', address:'', custom_kyc:'',
    client_phone:'', client_email:'', court_station:'',
    dob:'', occupation:'', opposing_party_contact:'', billing_type:'flat',
    emergency_name:'', emergency_phone:'', emergency_relation:'',
    alternative_phone:'', alternative_email:'',
    opposing_counsel_name:'', opposing_counsel_firm:'', opposing_counsel_phone:'', opposing_counsel_email:'', opposing_counsel_address:'',
    assigned_judge:'', court_division:'', case_brief:''
  });
  const [leadActionForm, setLeadActionForm] = useState({
    consultation_date:'', consultation_paid:false, assigned_lawyer:'Sam Ogola',
    case_title:'', convert_to_case:false, tracking_token:''
  });
  const [newEventForm, setNewEventForm] = useState({
    case_id:'', event_title:'', event_type:'mention', event_date:'', notes:''
  });
  const [newExpenseForm, setNewExpenseForm] = useState({
    amount:'', category:'transport', description:'', recorded_by:'Secretary', case_id:''
  });
  const [paymentForm, setPaymentForm] = useState({
    trust_payment_status:'pending', trust_payment_ref:'', fee_status:'pending', total_fee:'', outstanding_balance:''
  });
  const [judiciaryForm, setJudiciaryForm] = useState({
    judiciary_case_id:'', judiciary_filing_token:'', court_station:''
  });

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  const [activeSession, setActiveSession] = useState(null);
  const handleToggleBot = () => {
    if (!activeSession) return;
    const nextState = activeSession.current_state === 'HANDOVER' ? 'WELCOME' : 'HANDOVER';
    apiPut('/api/whatsapp/session', { phone: activeSession.phone_number, current_state: nextState })
      .then(r => r?.json())
      .then(data => {
        if (data && data.success) {
          setActiveSession(prev => ({ ...prev, current_state: nextState }));
          showToast(nextState === 'HANDOVER' ? '🤖 Bot paused. Staff has manual control.' : '🤖 Bot re-activated.');
        }
      });
  };

  useEffect(() => {
    if (!activeMatterId || matterTab !== 'overview') { setActiveSession(null); return; }
    const c = cases.find(x => x.id === activeMatterId);
    if (!c || !c.client_phone) { setActiveSession(null); return; }
    apiGet(`/api/whatsapp/session?phone=${encodeURIComponent(c.client_phone)}`)
      .then(r => r?.json())
      .then(data => {
        setActiveSession(data);
      })
      .catch(() => setActiveSession(null));
  }, [activeMatterId, matterTab, cases]);

  // Live Kenya EAT Time Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Nairobi' });
      const dateStr = now.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
      setLiveKeTime(`${dateStr} • ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('⚠️ Web Notifications are not supported on this browser.', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast('🔔 Hearing & Deadline Alerts Enabled!', 'success');
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('⚖️ SOCA Legal OS Alerts Active', {
              body: 'You will receive court hearing and filing deadline notifications on this device.',
              icon: '/logo.png',
              badge: '/logo.png'
            });
          });
        } else {
          new Notification('⚖️ SOCA Legal OS Alerts Active', {
            body: 'You will receive court hearing and filing deadline notifications on this device.',
            icon: '/logo.png'
          });
        }
      } else {
        showToast('Notification permission was denied.', 'error');
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  // Fetch data
  const fetchData = useCallback(() => {
    apiGet('/api/leads').then(r => r?.json()).then(d => d && setLeads(d)).catch(console.error);
    apiGet('/api/cases').then(r => r?.json()).then(data => {
      if (!data) return;
      setCases(data);
      if (data.length > 0 && !selectedCase) {
        setSelectedCase(data[0].id);
        setSelectedPhase(data[0].current_milestone);
      }
    }).catch(console.error);
    apiGet('/api/calendar').then(r => r?.json()).then(d => d && setCalendar(d)).catch(console.error);
  }, [selectedCase]);

  // Fetch expenses with active filter
  const fetchExpenses = useCallback(() => {
    const params = new URLSearchParams();
    if (expenseCaseFilter !== 'all') params.append('case_id', expenseCaseFilter);
    if (expenseStartDate) params.append('start_date', expenseStartDate);
    if (expenseEndDate) params.append('end_date', expenseEndDate);
    apiGet(`/api/expenses?${params.toString()}`)
      .then(r => r?.json()).then(d => d && setExpenses(d)).catch(console.error);
  }, [expenseCaseFilter, expenseStartDate, expenseEndDate]);

  // Fetch users (admin only)
  const fetchUsers = useCallback(() => {
    if (userRole !== 'admin') return;
    apiGet('/api/auth/users').then(r => r?.json()).then(d => d && setUsers(d)).catch(console.error);
  }, [userRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!calendar || calendar.length === 0) return;
    const upcoming = calendar.filter(ev => {
      const diffMs = new Date(ev.event_date) - new Date();
      return diffMs > 0 && diffMs <= 48 * 3600 * 1000;
    });
    if (upcoming.length > 0 && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const topHearing = upcoming[0];
      const noteStr = `${topHearing.event_title} scheduled for ${new Date(topHearing.event_date).toLocaleString('en-KE')}`;
      try {
        new Notification('⚖️ Upcoming Court Appearance', {
          body: noteStr,
          icon: '/logo.png'
        });
      } catch(e) { console.log(e); }
    }
  }, [calendar]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Fetch activities when case changes
  const fetchActivities = useCallback(() => {
    const targetCase = activeMatterId || selectedCase;
    if (!targetCase) return;
    apiGet(`/api/activities?case_id=${targetCase}`)
      .then(r => r?.json()).then(d => d && setActivities(d)).catch(console.error);
  }, [activeMatterId, selectedCase]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleLiveCtsSync = async (caseId) => {
    if (!caseId) return;
    try {
      showToast('🔄 Connecting to eFiling CTS REST Gateway...', 'info');
      const r = await apiPost(`/api/judiciary-api/sync-case/${caseId}`);
      const data = await r?.json();
      if (r && r.ok && data.success) {
        showToast(`🟢 CTS Data Synced! Station: ${data.ctsData.court_station}, Presider: ${data.ctsData.assigned_judge}`, 'success');
        fetchData();
        fetchActivities();
      } else {
        showToast(data?.error || 'CTS sync failed.', 'error');
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (session) {
      setProfileForm({
        display_name: session.display_name,
        username: session.username,
        password: ''
      });
    }
  }, [showProfileModal, session]);

  // Fetch case files
  const fetchCaseFiles = useCallback(() => {
    if (activeMatterId) {
      apiGet(`/api/cases/${activeMatterId}/files`)
        .then(r => r?.json()).then(d => d && setCaseFiles(d)).catch(console.error);
      apiGet(`/api/cases/${activeMatterId}/payments`)
        .then(r => r?.json()).then(d => d && setCasePayments(d)).catch(console.error);
      apiGet(`/api/cases/${activeMatterId}/invoices`)
        .then(r => r?.json()).then(d => d && setCaseInvoices(d)).catch(console.error);
      apiGet(`/api/cases/${activeMatterId}/disbursements`)
        .then(r => r?.json()).then(d => d && setCaseDisbursements(d)).catch(console.error);
      apiGet(`/api/cases/${activeMatterId}/submissions`)
        .then(r => r?.json()).then(d => d && setCaseSubmissions(d)).catch(console.error);
    } else {
      setCaseFiles([]);
      setCasePayments([]);
      setCaseInvoices([]);
      setCaseDisbursements([]);
      setCaseSubmissions([]);
    }
  }, [activeMatterId]);

  const handleAddSubmissionSubmit = async (e) => {
    e.preventDefault();
    if (!newSubmissionForm.title.trim() || !activeMatterId) return;
    try {
      const r = await apiPost(`/api/cases/${activeMatterId}/submissions`, {
        ...newSubmissionForm,
        assigned_lawyer: newSubmissionForm.assigned_lawyer || userDisplayName
      });
      if (r && r.ok) {
        showToast('📜 Court submission scheduled and synced to Calendar!', 'success');
        setShowAddSubmissionModal(false);
        setNewSubmissionForm({ title: '', submission_type: 'written_submissions', due_date: '', status: 'drafting', assigned_lawyer: '', notes: '' });
        fetchCaseFiles();
        fetchData();
      } else {
        const data = await r?.json();
        showToast(data?.error || 'Failed to log submission', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateSubmissionStatus = async (subId, newStatus) => {
    if (!activeMatterId) return;
    try {
      const r = await apiPut(`/api/cases/${activeMatterId}/submissions/${subId}`, { status: newStatus });
      if (r && r.ok) {
        showToast(`Submission status updated to ${newStatus.replace('_', ' ').toUpperCase()}`, 'success');
        fetchCaseFiles();
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteSubmission = async (subId) => {
    if (!activeMatterId || !window.confirm('Delete this submission record?')) return;
    try {
      const r = await apiDelete(`/api/cases/${activeMatterId}/submissions/${subId}`);
      if (r && r.ok) {
        showToast('Submission entry deleted.', 'info');
        fetchCaseFiles();
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    fetchCaseFiles();
  }, [fetchCaseFiles]);

  // Suggest token when name changes in case intake
  useEffect(() => {
    if (!newCaseForm.client_name || newCaseForm.client_name.trim().length < 2) return;
    const delayDebounceFn = setTimeout(() => {
      apiGet(`/api/cases/suggest-token?client_name=${encodeURIComponent(newCaseForm.client_name)}`)
        .then(r => r?.json()).then(data => {
          if (data) setNewCaseForm(prev => ({ ...prev, tracking_token: data.token }));
        });
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [newCaseForm.client_name]);

  // Suggest token when converting lead
  useEffect(() => {
    if (!selectedLead?.full_name) return;
    apiGet(`/api/cases/suggest-token?client_name=${encodeURIComponent(selectedLead.full_name)}`)
      .then(r => r?.json()).then(data => {
        if (data) setLeadActionForm(prev => ({ ...prev, tracking_token: data.token }));
      });
  }, [selectedLead]);

  // Conflict check (debounced)
  useEffect(() => {
    if (!conflictQuery || conflictQuery.trim().length < 2) { setConflictResults([]); return; }
    const timer = setTimeout(() => {
      apiGet(`/api/conflict-check?q=${encodeURIComponent(conflictQuery)}`)
        .then(r => r?.json()).then(d => d && setConflictResults(d)).catch(() => setConflictResults([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [conflictQuery]);

  // Derived state
  const currentCase = cases.find(c => c.id === selectedCase);
  let currentMilestonesList = ["Intake","Research","Drafting","Processing","Resolution"];
  if (currentCase?.milestones_json) {
    try { currentMilestonesList = JSON.parse(currentCase.milestones_json); } catch(e){}
  }
  const activePhaseInt = selectedPhase === "CLOSED" ? currentMilestonesList.length + 1 : (parseInt(selectedPhase) || 1);
  
  const filteredCases = cases.filter(c => {
    if (c.current_milestone === "CLOSED") return false;
    if (lawyerFilter !== 'all' && c.assigned_lawyer !== lawyerFilter) return false;
    return true;
  });

  const archivedCases = cases.filter(c => c.current_milestone === "CLOSED");
  const filteredArchivedCases = archivedCases.filter(c => {
    if (lawyerFilter !== 'all' && c.assigned_lawyer !== lawyerFilter) return false;
    if (!vaultSearchQuery.trim()) return true;
    const q = vaultSearchQuery.toLowerCase().trim();
    return (
      (c.client_name && c.client_name.toLowerCase().includes(q)) ||
      (c.case_title && c.case_title.toLowerCase().includes(q)) ||
      (c.judiciary_case_id && c.judiciary_case_id.toLowerCase().includes(q)) ||
      (c.tracking_token && c.tracking_token.toLowerCase().includes(q)) ||
      (c.case_type && c.case_type.toLowerCase().includes(q)) ||
      (c.assigned_lawyer && c.assigned_lawyer.toLowerCase().includes(q))
    );
  });
  
  const filteredLeads = leads.filter(l => {
    if (lawyerFilter !== 'all' && l.assigned_lawyer && l.assigned_lawyer !== lawyerFilter) return false;
    if (filterBy === 'pending_intakes') return l.status !== 'converted' && l.status !== 'archived' && !l.consultation_date;
    if (filterBy === 'upcoming_consults') return l.status !== 'converted' && l.status !== 'archived' && l.consultation_date;
    if (filterBy === 'unpaid_fees') return l.status !== 'converted' && l.status !== 'archived' && l.consultation_date && !l.consultation_paid;
    if (filterBy === 'urgent') return l.is_emergency === 1 || l.message?.includes('[URGENT]');
    return l.status !== 'archived';
  });

  const now = Date.now();
  const upcoming48h = calendar.filter(ev => {
    const d = new Date(ev.event_date).getTime();
    return d >= now && d <= now + 48 * 3600 * 1000;
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // Handlers
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await apiPut('/api/auth/profile', profileForm);
      if (r && r.ok) {
        showToast('Profile updated! Please log in again to apply changes.', 'success');
        setShowProfileModal(false);
        setTimeout(() => {
          handleLogout();
        }, 1500);
      } else {
        const data = await r?.json();
        showToast(data?.error || 'Failed to update profile.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleNewLeadSubmit = async (e) => {
    e.preventDefault();
    if (!newLeadForm.conflict_checked) {
      alert("WARNING: You must perform a conflict of interest check before logging a new lead.");
      return;
    }
    const prefix = newLeadForm.is_emergency ? "[URGENT] " : "";
    try {
      const r = await apiPost('/api/leads', { ...newLeadForm, message: prefix + newLeadForm.message });
      const data = await r?.json();
      if (!r || !r.ok) {
        showToast(data?.error || "Failed to log lead.", "error");
        return;
      }
      setShowNewLeadModal(false);
      setNewLeadForm({ 
        full_name:'', phone:'', email:'', service_category:'Civil Disputes', message:'', source:'walk_in', opposing_party:'', is_emergency:false, conflict_checked:false,
        id_number:'', kra_pin:'', address:'', custom_kyc:'', dob:'', occupation:'', opposing_party_contact:'', billing_type:'flat',
        emergency_name:'', emergency_phone:'', emergency_relation:'',
        alternative_phone:'', alternative_email:'',
        opposing_counsel_name:'', opposing_counsel_firm:'', opposing_counsel_phone:'', opposing_counsel_email:'', opposing_counsel_address:'',
        assigned_judge:'', court_division:''
      });
      setConflictResults([]); setConflictQuery('');
      fetchData();
      setActiveTab('leads');
      showToast("Lead logged successfully!");
    } catch (err) {
      showToast(err.message || "Failed to log lead.", "error");
    }
  };

  const handleNewCaseSubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await apiPost('/api/cases', newCaseForm);
      const data = await r?.json();
      if (!r || !r.ok) {
        showToast(data?.error || "Failed to register case.", "error");
        return;
      }
      setShowNewCaseModal(false);
      setNewCaseForm({ 
        client_name:'', case_title:'', case_type:'Civil Disputes', assigned_lawyer:'Sam Ogola', opposing_party:'', ref_no:'', is_sensitive:false, tracking_token:'',
        id_number:'', kra_pin:'', address:'', custom_kyc:'', client_phone:'', client_email:'', court_station:'',
        dob:'', occupation:'', opposing_party_contact:'', billing_type:'flat',
        emergency_name:'', emergency_phone:'', emergency_relation:'',
        alternative_phone:'', alternative_email:'',
        opposing_counsel_name:'', opposing_counsel_firm:'', opposing_counsel_phone:'', opposing_counsel_email:'', opposing_counsel_address:'',
        assigned_judge:'', court_division:'', case_brief:''
      });
      setConflictResults([]); setConflictQuery('');
      fetchData(); 
      setActiveTab('matters');
      showToast("Case registered successfully!");
    } catch (err) {
      showToast(err.message || "Failed to register case.", "error");
    }
  };

  const handleLeadActionSubmit = async (e) => {
    e.preventDefault();
    if (leadActionForm.convert_to_case) {
      try {
        const r = await apiPost('/api/cases', {
          client_name: selectedLead.full_name,
          case_title: leadActionForm.case_title || `${selectedLead.service_category} Matter`,
          case_type: selectedLead.service_category,
          assigned_lawyer: leadActionForm.assigned_lawyer,
          tracking_token: leadActionForm.tracking_token,
          lead_id: selectedLead.id,
          client_phone: selectedLead.phone,
          client_email: selectedLead.email,
          id_number: selectedLead.id_number,
          kra_pin: selectedLead.kra_pin,
          address: selectedLead.address,
          custom_kyc: selectedLead.custom_kyc,
          dob: selectedLead.dob,
          occupation: selectedLead.occupation,
          opposing_party: selectedLead.opposing_party,
          opposing_party_contact: selectedLead.opposing_party_contact,
          billing_type: selectedLead.billing_type,
          emergency_name: selectedLead.emergency_name,
          emergency_phone: selectedLead.emergency_phone,
          emergency_relation: selectedLead.emergency_relation,
          alternative_phone: selectedLead.alternative_phone,
          alternative_email: selectedLead.alternative_email,
          opposing_counsel_name: selectedLead.opposing_counsel_name,
          opposing_counsel_firm: selectedLead.opposing_counsel_firm,
          opposing_counsel_phone: selectedLead.opposing_counsel_phone,
          opposing_counsel_email: selectedLead.opposing_counsel_email,
          opposing_counsel_address: selectedLead.opposing_counsel_address,
          assigned_judge: selectedLead.assigned_judge,
          court_division: selectedLead.court_division,
          case_brief: selectedLead.message // map lead description to initial case brief
        });
        const data = await r?.json();
        if (!r || !r.ok) {
          showToast(data?.error || "Failed to convert lead to active case.", "error");
          return;
        }
        setSelectedLead(null); 
        fetchData();
        setActiveTab('matters');
        showToast("Lead successfully converted to active case!");
      } catch (err) {
        showToast(err.message || "Failed to convert lead.", "error");
      }
    } else {
      try {
        const r = await apiPut(`/api/leads/${selectedLead.id}`, {
          status:'consultation_set',
          consultation_date: leadActionForm.consultation_date,
          consultation_paid: leadActionForm.consultation_paid,
          assigned_lawyer: leadActionForm.assigned_lawyer
        });
        const data = await r?.json();
        if (!r || !r.ok) {
          showToast(data?.error || "Failed to update lead status.", "error");
          return;
        }
        if (leadActionForm.consultation_date) {
          await apiPost('/api/calendar', {
            case_id: '',
            event_title: `Consultation: ${selectedLead.full_name}`,
            event_type: 'consultation',
            event_date: leadActionForm.consultation_date,
            notes: `Consultation with prospective client. Category: ${selectedLead.service_category}. Phone: ${selectedLead.phone}.`,
            is_important: true,
            assigned_lawyer: leadActionForm.assigned_lawyer
          });
        }
        setSelectedLead(null); 
        fetchData();
        showToast("Consultation scheduled and registered on Firm Calendar!");
      } catch (err) {
        showToast(err.message || "Failed to update lead.", "error");
      }
    }
  };

  const updateLeadStatus = (statusStr) => {
    apiPut(`/api/leads/${selectedLead.id}`, { status: statusStr })
      .then(r => r?.json()).then(() => { setSelectedLead(null); fetchData(); });
  };

  const handleStarActivity = (activityId) => {
    apiPatch(`/api/activities/${activityId}/star`, {})
      .then(r => r?.json()).then(data => {
        if (data) setActivities(prev => prev.map(a => a.id === activityId ? {...a, is_starred: data.is_starred} : a));
      });
  };

  const handleUserMgmtSubmit = async (e) => {
    e.preventDefault();
    setUserMgmtMsg('');
    const r = await apiPost('/api/auth/users', newUserForm);
    const data = await r?.json();
    if (!r?.ok) { setUserMgmtMsg('❌ ' + (data?.error || 'Failed')); return; }
    setUserMgmtMsg(`✅ Account created! Username: ${newUserForm.username}, Password: ${newUserForm.password}`);
    setNewUserForm({ username:'', display_name:'', password:'', role:'secretary' });
    fetchUsers();
  };

  const handleDeleteUser = async (userId, uname) => {
    if (!window.confirm(`Delete user "${uname}"? This cannot be undone.`)) return;
    const r = await apiDelete(`/api/auth/users/${userId}`);
    if (r?.ok) fetchUsers();
  };

  const handleNukeDatabase = async () => {
    if (!window.confirm('⚠️ WARNING: This will permanently DELETE all databases (leads, cases, invoices, expenses, etc.) and reset back to original seed data. Are you absolutely sure?')) return;
    if (!window.confirm('This is your final confirmation. Wiping data now.')) return;
    try {
      const r = await apiPost('/api/dev/nuke-database', {});
      if (r && r.ok) {
        showToast('Database wiped and re-seeded successfully. Logging out.', 'success');
        handleLogout();
      } else {
        const data = await r?.json();
        showToast(data?.error || 'Database wipe failed.', 'error');
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleSeedTestData = async () => {
    try {
      const r = await apiPost('/api/dev/seed-test-data', {});
      if (r && r.ok) { showToast('Test data seeded! Refreshing...', 'success'); fetchData(); }
      else { const d = await r?.json(); showToast(d?.error || 'Seed failed.', 'error'); }
    } catch(err) { showToast(err.message, 'error'); }
  };

  const handleDownloadBackup = async () => {
    try {
      const token = localStorage.getItem('token') || session?.token;
      const res = await fetch(`${BASE}/api/dev/backup-download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to generate backup.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legalos_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Database backup downloaded successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setImportFeedback('⚠️ No valid data found in CSV.');
        setParsedRows([]);
        return;
      }
      setParsedRows(rows);
      setImportFeedback(`✅ Parsed ${rows.length} rows. Please verify headers and click "Confirm Import" below.`);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0 || !lines[0]) return [];
    
    const headers = splitCSVLine(lines[0]);
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      result.push(obj);
    }
    return result;
  };

  const splitCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(v => v.replace(/^"|"$/g, ''));
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    const url = importType === 'cases' ? '/api/cases/bulk-import' : '/api/calendar/bulk-import';
    const payload = importType === 'cases' ? { cases: parsedRows } : { events: parsedRows };
    
    setImportFeedback('Importing, please wait...');
    
    apiPost(url, payload)
    .then(r => {
      if (!r || !r.ok) throw new Error('Failed to import. Please verify CSV columns.');
      return r.json();
    })
    .then(data => {
      setImportFeedback(`🎉 Successfully imported ${data.count} records!`);
      setParsedRows([]);
      fetchData();
      showToast(`✅ Bulk import completed.`);
    })
    .catch(err => {
      setImportFeedback(`❌ Import failed: ${err.message}`);
    });
  };

  const handleResetUserPassword = async (userId, new_password) => {
    try {
      const r = await apiPut(`/api/auth/users/${userId}/password`, { new_password });
      if (r && r.ok) {
        showToast('Password reset successfully.', 'success');
      } else {
        const data = await r?.json();
        showToast(data?.error || 'Failed to reset password.', 'error');
      }
    } catch(err) { showToast(err.message, 'error'); }
  };

  const handleMilestoneUpdate = () => {
    if (!selectedCase) return;
    fetch(`${BASE}/api/cases/${selectedCase}/milestone`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ milestone: selectedPhase })
    }).then(r => r.json()).then(() => {
      showToast(selectedPhase === "CLOSED" ? 'Case marked as CLOSED and archived.' : '✅ Milestone updated — live for client on WhatsApp.');
      // Auto-log milestone update in Case timeline
      apiPost('/api/activities', {
        case_id: selectedCase,
        activity_type: 'milestone_change',
        description: `Milestone updated to Phase ${selectedPhase}: ${currentMilestonesList[parseInt(selectedPhase)-1] || selectedPhase}`,
        recorded_by: userDisplayName
      }).then(() => fetchActivities());
      fetchData();
    });
  };

  const handleMilestoneRollback = () => {
    if (!selectedCase) return;
    const passcode = prompt("Enter Senior Partner Passcode to authorize rollback:");
    if (passcode === null) return;
    apiPut(`/api/cases/${selectedCase}/rollback-milestone`, { milestone: selectedPhase, passcode })
      .then(async res => {
        if (res?.status === 403) { showToast('Invalid Partner Passcode — rollback unauthorized.', 'error'); return; }
        showToast('⚠️ Milestone rollback authorized and applied.');
        apiPost('/api/activities', {
          case_id: selectedCase,
          activity_type: 'milestone_change',
          description: `⚠️ Authorized Milestone Rollback to Phase ${selectedPhase} (${currentMilestonesList[parseInt(selectedPhase)-1] || selectedPhase})`,
          recorded_by: userDisplayName
        }).then(() => fetchActivities());
        fetchData();
      });
  };

  const handleEditMilestonesSubmit = (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    apiPut(`/api/cases/${selectedCase}/edit-milestones`, { milestones_json: JSON.stringify(editableMilestones) })
      .then(r => r?.json()).then(() => { setShowEditMilestoneModal(false); fetchData(); });
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0 || !activeMatterId) return;
    const file = e.target.files[0];
    
    // Guess category from file name
    const guessCategoryFromFilename = (filename) => {
      const name = filename.toLowerCase();
      if (name.includes('motion') || name.includes('plaint') || name.includes('petition') || 
          name.includes('defense') || name.includes('defence') || name.includes('chamber') || 
          name.includes('affidavit') || name.includes('application') || name.includes('memorandum') || 
          name.includes('pleading') || name.includes('submission')) {
        return 'pleadings';
      }
      if (name.includes('letter') || name.includes('email') || name.includes('correspondence') || 
          name.includes('reply') || name.includes('demand') || name.includes('notice') || 
          name.includes('chat') || name.includes('whatsapp')) {
        return 'correspondence';
      }
      if (name.includes('order') || name.includes('ruling') || name.includes('judgment') || 
          name.includes('decree') || name.includes('injunction') || name.includes('award') || 
          name.includes('directions')) {
        return 'court_orders';
      }
      if (name.includes('id_') || name.includes('passport') || name.includes('kra') || 
          name.includes('pin_') || name.includes('kyc') || name.includes('utility') || 
          name.includes('registration') || name.includes('certificate') || name.includes('cert') || 
          name.includes('national id')) {
        return 'client_kyc';
      }
      if (name.includes('receipt') || name.includes('invoice') || name.includes('payment') || 
          name.includes('fee_') || name.includes('bill_') || name.includes('deposit') || 
          name.includes('trust_') || name.includes('statement') || name.includes('bank') || 
          name.includes('financial')) {
        return 'financials';
      }
      if (name.includes('research') || name.includes('draft') || name.includes('opinion') || 
          name.includes('brief') || name.includes('authority') || name.includes('precedent') || 
          name.includes('case law')) {
        return 'research';
      }
      if (name.includes('exhibit') || name.includes('evidence') || name.includes('photo') || 
          name.includes('image') || name.includes('contract') || name.includes('agreement') || 
          name.includes('deed') || name.includes('title') || name.includes('lease') || 
          name.includes('map')) {
        return 'exhibits';
      }
      return null;
    };

    const guessed = guessCategoryFromFilename(file.name);
    let finalCategory = uploadCategory;
    if (guessed) {
      finalCategory = guessed;
      setUploadCategory(guessed);
      showToast(`Auto-categorized: ${guessed.toUpperCase()}`);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', finalCategory);
    setUploadingFile(true);
    const res = await apiUpload(`/api/cases/${activeMatterId}/files`, formData);
    if (res?.ok) {
      fetchCaseFiles();
      apiPost('/api/activities', {
        case_id: activeMatterId,
        activity_type: 'internal_note',
        description: `Uploaded document: ${file.name}`,
        recorded_by: userDisplayName
      }).then(() => fetchActivities());
    } else {
      alert("Failed to upload file");
    }
    setUploadingFile(false);
    e.target.value = null; // reset input
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (!window.confirm(`Delete ${fileName}?`)) return;
    const res = await apiDelete(`/api/cases/files/${fileId}`);
    if (res?.ok) fetchCaseFiles();
  };

  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!selectedCase || !newActivityForm.description) return;
    apiPost('/api/activities', { ...newActivityForm, case_id: selectedCase })
      .then(r => r?.json()).then(() => {
        setNewActivityForm({ activity_type:'internal_note', description:'', recorded_by: userDisplayName });
        fetchActivities();
      });
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    if (editingEvent) {
      apiPut(`/api/calendar/${editingEvent.id}`, newEventForm).then(r => r?.json()).then(() => {
        setShowAddEventModal(false); setEditingEvent(null);
        setNewEventForm({ case_id:'', event_title:'', event_type:'mention', event_date:'', notes:'', is_important:false, assigned_lawyer:'' });
        fetchData();
      });
    } else {
      apiPost('/api/calendar', newEventForm).then(r => r?.json()).then(() => {
        setShowAddEventModal(false);
        setNewEventForm({ case_id:'', event_title:'', event_type:'mention', event_date:'', notes:'', is_important:false, assigned_lawyer:'' });
        fetchData();
      });
    }
  };

  const handleEditEventClick = (ev) => {
    setEditingEvent(ev);
    setNewEventForm({
      case_id: ev.case_id,
      event_title: ev.event_title,
      event_type: ev.event_type,
      event_date: ev.event_date.slice(0, 16),
      notes: ev.notes || '',
      is_important: !!ev.is_important,
      assigned_lawyer: ev.assigned_lawyer || ''
    });
    setShowAddEventModal(true);
  };

  const handleDeleteEvent = (id) => {
    if (!window.confirm('Remove this court date?')) return;
    apiDelete(`/api/calendar/${id}`).then(() => fetchData());
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    apiPost('/api/expenses', newExpenseForm).then(r => r?.json()).then(() => {
      setShowAddExpenseModal(false);
      setNewExpenseForm({ amount:'', category:'transport', description:'', recorded_by: userDisplayName, case_id:'' });
      fetchExpenses();
    });
  };

  const handleDeleteExpense = (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    apiDelete(`/api/expenses/${id}`).then(() => fetchExpenses());
  };

  const handlePaymentUpdate = (e) => {
    e.preventDefault();
    const targetCaseId = selectedCase || activeMatterId;
    if (!targetCaseId) return;
    apiPut(`/api/cases/${targetCaseId}/payment`, {
      trust_payment_status: paymentForm.trust_payment_status,
      trust_payment_ref: paymentForm.trust_payment_ref,
      total_fee: paymentForm.total_fee !== '' && paymentForm.total_fee !== null ? Number(paymentForm.total_fee) : null,
      outstanding_balance: paymentForm.outstanding_balance !== '' && paymentForm.outstanding_balance !== null ? Number(paymentForm.outstanding_balance) : null,
      fee_status: paymentForm.fee_status
    })
      .then(r => r?.json()).then(() => { 
        setShowPaymentModal(false); 
        fetchData(); 
        showToast("Payment references updated successfully!");
      });
  };

  const handleEditFeeSubmit = (e) => {
    e.preventDefault();
    const c = cases.find(x => x.id === activeMatterId);
    if (!c) return;
    const totalPaid = casePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const newOutstanding = Number(editFeeForm.total_fee || 0) - totalPaid;
    
    apiPut(`/api/cases/${activeMatterId}/payment`, {
      trust_payment_status: c.trust_payment_status || 'none',
      trust_payment_ref: c.trust_payment_ref || '',
      total_fee: Number(editFeeForm.total_fee),
      outstanding_balance: newOutstanding,
      fee_status: editFeeForm.fee_status
    })
      .then(r => r?.json()).then(() => { 
        setShowEditFeeModal(false); 
        fetchData(); 
        showToast("Case fee updated successfully!");
      });
  };

  const handleAddPaymentSubmit = async () => {
    if (!newPaymentForm.amount || !newPaymentForm.payment_ref) return alert('Amount and Reference required');
    await apiPost(`/api/cases/${activeMatterId}/payments`, newPaymentForm);
    setShowAddPaymentModal(false);
    fetchCaseFiles();
  };

  const handleAddDisbursementSubmit = async (e) => {
    e.preventDefault();
    if (!newDisbursementForm.amount || !newDisbursementForm.description) return alert('Amount and Description required');
    await apiPost(`/api/cases/${activeMatterId}/disbursements`, newDisbursementForm);
    setShowAddDisbursementModal(false);
    setNewDisbursementForm({ amount:'', description:'', payment_method:'M-PESA' });
    fetchCaseFiles();
  };

  const handleGenerateInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (!newInvoiceForm.invoice_number || !newInvoiceForm.amount) return alert('Invoice Number and Amount required');
    await apiPost(`/api/cases/${activeMatterId}/invoices`, {
      invoice_number: newInvoiceForm.invoice_number,
      amount: Number(newInvoiceForm.amount),
      notes: newInvoiceForm.notes,
      due_date: newInvoiceForm.due_date,
      disbursement_ids: newInvoiceForm.selectedDisbursements
    });
    setShowGenerateInvoiceModal(false);
    setNewInvoiceForm({ invoice_number:'', amount:'', notes:'', due_date:'', selectedDisbursements:[] });
    fetchCaseFiles();
  };

  const handleTrustTransferSubmit = async (e) => {
    e.preventDefault();
    if (!trustTransferForm.amount || !trustTransferForm.invoice_id) return alert('Amount and Invoice ID required');
    
    const res = await apiPost(`/api/cases/${activeMatterId}/trust-transfer`, {
      amount: Number(trustTransferForm.amount),
      invoice_id: trustTransferForm.invoice_id,
      notes: trustTransferForm.notes
    });
    
    if (res.status === 400) {
      const errData = await res.json();
      return alert(errData.error || 'Transfer failed');
    }
    
    setShowTrustTransferModal(false);
    setTrustTransferForm({ amount:'', invoice_id:'', notes:'' });
    fetchCaseFiles();
  };

  const handleJudiciaryUpdate = (e) => {
    e.preventDefault();
    apiPut(`/api/cases/${selectedCase}/judiciary`, judiciaryForm)
      .then(r => r?.json()).then(() => { setShowJudiciaryModal(false); fetchData(); });
  };

  const handleGenerateWeeklyReport = () => {
    apiGet('/api/weekly-report').then(r => r?.json()).then(data => { if(data) { setWeeklyReport(data); setActiveTab('report'); }});
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
  };

  const buildClipboardMeta = () => {
    if (!currentCase) return '';
    return [
      `Client: ${currentCase.client_name}`,
      `Case Title: ${currentCase.case_title}`,
      `Case Type: ${currentCase.case_type}`,
      `Tracking Token: ${currentCase.tracking_token}`,
      `Reference No: ${currentCase.ref_no || 'N/A'}`,
      `Opposing Party: ${currentCase.opposing_party || 'N/A'}`,
      `Judiciary Case ID: ${currentCase.judiciary_case_id || 'N/A'}`,
      `Assigned Advocate: ${currentCase.assigned_lawyer}`,
    ].join('\n');
  };

  // Document Modal Operations
  const handleOpenDocModal = (tplId) => {
    const rawText = buildTemplateText(tplId, {
      ...(currentCase || {}),
      ...(calendar.find(ev => ev.case_id === selectedCase) || {})
    });
    setEditedDocContent(rawText);
    setShowDocModal(tplId);
  };

  const logDocAction = (actionName) => {
    if (!selectedCase) return;
    apiPost('/api/activities', {
      case_id: selectedCase,
      activity_type: 'internal_note',
      description: `Generated Notice/Document: "${TEMPLATES.find(t=>t.id===showDocModal)?.title}" (${actionName})`,
      recorded_by: userDisplayName
    }).then(() => fetchActivities());
  };

  const handlePrintDoc = () => {
    const oldTitle = document.title;
    document.title = "";
    logDocAction('Printed/Saved PDF');
    window.print();
    document.title = oldTitle;
    setBulkPrintDocs([]);
  };

  const handlePrintBulkDocs = (docs) => {
    setBulkPrintDocs(docs);
    setBulkPrintPending(true); // print will fire after React re-renders the docs into DOM
  };

  // Fires AFTER bulkPrintDocs is rendered into #print-area
  useEffect(() => {
    if (!bulkPrintPending || bulkPrintDocs.length === 0) return;
    setBulkPrintPending(false);
    const oldTitle = document.title;
    document.title = '';
    window.print();
    document.title = oldTitle;
    setBulkPrintDocs([]);
  }, [bulkPrintPending, bulkPrintDocs]);

  const handleCopyToClipboardDoc = () => {
    copyToClipboard(editedDocContent);
    logDocAction('Copied text content');
  };

  const handleSendWhatsAppDoc = () => {
    logDocAction('Sent to WhatsApp');
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(editedDocContent)}`;
    window.open(url, '_blank');
  };

  const handleDownloadWeeklyReport = () => {
    if (!weeklyReport) return;
    const txt = [
      `SAM OGOLA & CO ADVOCATES — WEEKLY REPORT`,
      `Period: ${new Date(weeklyReport.week_start).toLocaleDateString()} to ${new Date(weeklyReport.week_end).toLocaleDateString()}`,
      `Generated at: ${new Date(weeklyReport.generated_at).toLocaleString()}`,
      `\n=========================================\n`
    ];
    Object.entries(weeklyReport.report).forEach(([lawyer, data]) => {
      txt.push(`LAWYER: ${lawyer}\n`);
      txt.push(`Upcoming Court Events:`);
      if (data.upcoming_events.length === 0) txt.push(` - None`);
      data.upcoming_events.forEach(ev => {
        txt.push(` - [${new Date(ev.event_date).toLocaleString('en-KE')}] ${ev.event_title} (${ev.client_name} - ${ev.case_title})`);
      });
      txt.push(`\nLogged Activities:`);
      if (data.activities.length === 0) txt.push(` - None`);
      data.activities.forEach(a => {
        txt.push(` - [${a.activity_type.toUpperCase()}] ${a.description} (${a.case_title})`);
      });
      txt.push(`\n-----------------------------------------\n`);
    });
    
    const blob = new Blob([txt.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Weekly_Advocate_Report_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Conflict Banner
  const ConflictBanner = () => {
    if (!conflictResults.length) return null;
    const matchLabel = (f) => ({ id_number: '🪪 ID Number', kra_pin: '📋 KRA PIN', phone: '📞 Phone', client_name: '👤 Name', full_name: '👤 Name', opposing_party: '⚔️ Opposing Party' }[f] || f);
    const isIdMatch = (r) => r.match_field === 'id_number' || r.match_field === 'kra_pin';
    return (
      <div style={{background:'rgba(255,152,0,0.12)', border:'1px solid rgba(255,152,0,0.5)', borderRadius:'6px', padding:'10px 14px', marginTop:'10px'}}>
        <div style={{color:'#ff9800', fontWeight:700, fontSize:'0.8rem', marginBottom:'6px'}}>
          ⚠️ POTENTIAL CONFLICT OF INTEREST — {conflictResults.length} match{conflictResults.length > 1 ? 'es' : ''} found
        </div>
        {conflictResults.map((r, i) => (
          <div key={i} style={{fontSize:'0.75rem', color:'var(--text-primary)', borderBottom:'1px solid rgba(255,152,0,0.2)', paddingBottom:'6px', marginBottom:'6px', display:'flex', alignItems:'flex-start', gap:'8px'}}>
            {isIdMatch(r) && <span style={{background:'rgba(239,83,80,0.2)',border:'1px solid rgba(239,83,80,0.5)',color:'#ef5350',padding:'1px 6px',borderRadius:'4px',fontSize:'0.65rem',fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>EXACT ID MATCH</span>}
            <div>
              <strong>{r.name}</strong>{r.opposing_party ? ` vs. ${r.opposing_party}` : ''} —{' '}
              <span style={{color:'var(--text-secondary)'}}>{r.detail} | {r.lawyer || 'Unassigned'} | {r.type === 'case' ? `Token: ${r.token}` : 'Lead'}</span>{' '}
              <span style={{color: isIdMatch(r) ? '#ef5350' : '#ff9800', fontWeight:700}}>{r.score}% match</span>
              <span style={{color:'var(--text-muted)',marginLeft:'6px',fontSize:'0.65rem'}}>via {matchLabel(r.match_field)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: toast.type === 'success' ? 'var(--gold-500, #c9a84c)' : 'var(--red-500, #ef5350)',
          color: 'var(--navy-950, #060e1c)',
          padding: '16px 28px',
          borderRadius: '8px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          zIndex: 10000,
          fontWeight: '700',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <span>{toast.type === 'success' ? '⚜️' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}



      {/* Header */}
      <div className="dash-header">
        <div className="dash-header__title" style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <img src={logoImg} alt="SOCA Advocates" style={{height:'34px', width:'auto', objectFit:'contain'}} />
          <span className="dash-header__brand-text">Sam Ogola & Co Advocates</span>
        </div>
        <div className="dash-header__actions" style={{display:'flex', gap:'12px', alignItems:'center'}}>
          <select className="desktop-only-header-item" style={{background:'var(--navy-800)',color:'white',padding:'5px 10px',border:'1px solid var(--border-default)',borderRadius:'4px',outline:'none'}}
            value={lawyerFilter} onChange={e => setLawyerFilter(e.target.value)}>
            <option value="all">Global View (All Lawyers)</option>
            {lawyersList.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <button
            className="primary-btn desktop-only-header-item"
            style={{padding:'6px 14px', fontSize:'0.78rem', fontWeight:700, display:'flex', alignItems:'center', gap:'6px'}}
            onClick={() => setShowJudiciaryIngestionModal(true)}
          >
            ⚡ Ingest Judiciary PDF
          </button>
          {upcoming48h.length > 0 && (
            <div className="desktop-only-header-item" style={{background:'rgba(255,152,0,0.15)',border:'1px solid rgba(255,152,0,0.5)',padding:'5px 12px',borderRadius:'20px',fontSize:'0.75rem',color:'#ff9800',cursor:'pointer'}}
              onClick={() => setActiveTab('calendar')}>
              ⚠️ {upcoming48h.length} court date{upcoming48h.length > 1 ? 's' : ''} within 48h
            </div>
          )}
          <div className="dash-header__meta" style={{fontSize:'0.78rem', color:'var(--gold-300)', fontWeight:600}}>
            <span>⏱️ {liveKeTime || 'EAT Nairobi'}</span>
          </div>
          <div className="desktop-only-header-item" style={{display:'flex',alignItems:'center',gap:'10px',borderLeft:'1px solid rgba(255,255,255,0.1)',paddingLeft:'15px'}}>
            <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.6)'}}>
              {userRole === 'admin' ? '🛡️' : userRole === 'secretary' ? '📋' : '⚖️'}&nbsp;{userDisplayName}
            </span>
            <button onClick={handleLogout} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',color:'rgba(255,255,255,0.5)',padding:'4px 10px',fontSize:'0.7rem',cursor:'pointer'}}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className={`dash-workspace ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Sidebar */}
        <div className="dash-sidebar">
          {/* Collapse toggle button */}
          <div className="sidebar-header-toggle" style={{
            display:'flex',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            alignItems: 'center',
            padding: '0 12px 10px 12px',
            borderBottom:'1px solid rgba(255,255,255,0.05)',
            marginBottom:'10px'
          }}>
            {!isSidebarCollapsed && <span style={{fontSize:'0.65rem', textTransform:'uppercase', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.05em'}}>Navigation</span>}
            <button className="secondary-btn" style={{padding:'4px 8px', fontSize:'0.7rem', minWidth:'24px', cursor:'pointer'}} onClick={toggleSidebar}>
              {isSidebarCollapsed ? '▶' : '◀'}
            </button>
          </div>

          {/* Desktop Navigation List */}
          <div className="desktop-nav-list">
            {[
              { id:'home',     icon:'🏠', label:'Dashboard' },
              { id:'leads',    icon:'📥', label:'CRM Inbox' },
              { id:'matters',  icon:'⚖️', label:'Active Matters' },
              { id:'archives', icon:'🏛️', label:'Archives & Vault' },
              { id:'calendar', icon:'📅', label:'Firm Calendar' },
              ...(userRole !== 'advocate' ? [{ id:'finance',  icon:'💰', label:'Firm Finance' }] : []),
              { id:'documents',icon:'📄', label:'Document Studio' },
              { id:'report',   icon:'📋', label:'Weekly Report' },
              ...(userRole === 'admin' || userRole === 'developer' ? [{ id:'settings', icon:'🛡️', label:'Admin & Users' }] : [])
            ].map(tab => (
              <button key={tab.id} className={`dash-nav-btn ${activeTab===tab.id?'active':''}`}
                title={isSidebarCollapsed ? tab.label : ''}
                onClick={() => {
                  setActiveTab(tab.id);
                  setFilterBy('all');
                  setActiveMatterId(null);
                  if (tab.id === 'settings') fetchUsers();
                }}
                style={{
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  padding: isSidebarCollapsed ? '10px 0' : '10px 20px',
                  width: '100%'
                }}
              >
                <span style={{fontSize: '1rem', display:'inline-block'}}>{tab.icon}</span>
                {!isSidebarCollapsed && <span style={{marginLeft: '10px'}}>{tab.label}</span>}
              </button>
            ))}
          </div>

          {/* Mobile Bottom Navigation Bar (4 Sleek Touch Tabs) */}
          <div className="mobile-bottom-nav">
            <button className={`dash-nav-btn ${activeTab==='home'?'active':''}`} onClick={() => { setActiveTab('home'); setActiveMatterId(null); }}>
              <span>🏛️</span>
              <span>Cause List</span>
            </button>
            <button className={`dash-nav-btn ${activeTab==='matters'?'active':''}`} onClick={() => { setActiveTab('matters'); setActiveMatterId(null); }}>
              <span>⚖️</span>
              <span>Matters</span>
            </button>
            <button className="dash-nav-btn" onClick={() => setShowJudiciaryIngestionModal(true)} style={{color:'var(--gold-400)'}}>
              <span>⚡</span>
              <span>Ingest PDF</span>
            </button>
            <button className="dash-nav-btn" onClick={() => setShowMobileDrawer(true)}>
              <span>☰</span>
              <span>Menu</span>
            </button>
          </div>

          <div style={{flex:1}}/>
          {/* Sidebar Profile Card */}
          <div className="sidebar-profile-card" style={{
            padding: isSidebarCollapsed ? '14px 4px' : '14px 12px',
            background:'var(--navy-800)',
            borderTop:'1px solid var(--border-default)'
          }}>
            {/* Avatar */}
            <div style={{
              display:'flex',
              flexDirection: isSidebarCollapsed ? 'column' : 'row',
              alignItems:'center',
              gap: isSidebarCollapsed ? '6px' : '10px',
              marginBottom: isSidebarCollapsed ? '0px' : '10px'
            }}>
              <div style={{position:'relative', cursor:'pointer', flexShrink:0}} onClick={() => avatarInputRef.current?.click()} title="Click to change photo">
                <img src={avatarSrc || logoImg} alt="Avatar"
                  style={{width:'38px', height:'38px', borderRadius:'50%', objectFit:'cover',
                    border:'2px solid var(--gold-500)', display:'block'}} />
                <div style={{position:'absolute', bottom:0, right:0, background:'var(--gold-500)', borderRadius:'50%',
                  width:'12px', height:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'6px', color: 'var(--navy-950)'}}>✏️</div>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange} />
              </div>
              {!isSidebarCollapsed ? (
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                    <div style={{fontWeight:700, fontSize:'0.82rem', color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>{userDisplayName}</div>
                    <button onClick={() => setShowProfileModal(true)} title="Edit Profile" style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:0, fontSize:'0.75rem', display:'flex', alignItems:'center'}}>⚙️</button>
                  </div>
                  <div style={{fontSize:'0.68rem', color:'var(--text-muted)', marginTop:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>@{session.username}</div>
                </div>
              ) : (
                <button onClick={handleLogout} title="Sign Out" style={{background:'transparent', border:'none', color:'var(--red-400)', fontSize:'1rem', cursor:'pointer', padding:'4px 0'}}>🚪</button>
              )}
            </div>
            
            {/* Role badge and Sign Out (only when expanded) */}
            {!isSidebarCollapsed && (
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{
                  fontSize:'0.65rem', fontWeight:700, padding:'3px 8px', borderRadius:'12px',
                  background: userRole==='admin' ? 'rgba(201,168,76,0.15)' : userRole==='secretary' ? 'rgba(100,181,246,0.15)' : 'rgba(77,182,172,0.15)',
                  color: userRole==='admin' ? 'var(--gold-400)' : userRole==='secretary' ? '#64b5f6' : '#4db6ac',
                  border: `1px solid ${userRole==='admin' ? 'rgba(201,168,76,0.3)' : userRole==='secretary' ? 'rgba(100,181,246,0.3)' : 'rgba(77,182,172,0.3)'}`
                }}>
                  {userRole==='admin' ? '🛡️ Admin' : userRole==='secretary' ? '📋 Sec' : '⚖️ Adv'}
                </span>
                <button onClick={handleLogout} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px',
                  color:'rgba(255,255,255,0.4)', padding:'3px 8px', fontSize:'0.65rem', cursor:'pointer'}}>Sign Out</button>
              </div>
            )}

            {/* Active Matter details */}
            {(() => {
              const currentMatterObj = cases.find(c => c.id === activeMatterId);
              if (!currentMatterObj || isSidebarCollapsed) return null;
              return (
                <div style={{marginTop:'10px', paddingTop:'10px', borderTop:'1px solid var(--border-default)', fontSize:'0.72rem', color:'var(--text-secondary)', display:'flex', flexDirection:'column', gap:'3px'}}>
                  <div style={{color:'var(--gold-400)', fontWeight:700, fontSize:'0.7rem', marginBottom:'2px'}}>Active Client Contact</div>
                  
                  {/* Primary Phone */}
                  <div>
                    📞 {currentMatterObj.client_phone ? (
                      <a href={`tel:${currentMatterObj.client_phone}`} style={{color:'inherit', textDecoration:'none', fontWeight:600}} title="Click to call primary phone">
                        {currentMatterObj.client_phone}
                      </a>
                    ) : <span style={{color:'var(--text-muted)'}}>No primary phone</span>}
                  </div>
                  
                  {/* Alternative Phone(s) */}
                  {currentMatterObj.alternative_phone && (
                    <div style={{fontSize:'0.65rem', paddingLeft:'12px', color:'var(--text-muted)'}}>
                      {currentMatterObj.alternative_phone.split(/,+/).map((p, idx) => (
                        <div key={idx}>
                          Alt: <a href={`tel:${p.trim()}`} style={{color:'inherit', textDecoration:'none'}}>{p.trim()}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Primary Email */}
                  <div>
                    ✉️ {currentMatterObj.client_email ? (
                      <a href={`mailto:${currentMatterObj.client_email}`} style={{color:'inherit', textDecoration:'none', fontWeight:600}} title="Click to email primary email">
                        {currentMatterObj.client_email}
                      </a>
                    ) : <span style={{color:'var(--text-muted)'}}>No primary email</span>}
                  </div>

                  {/* Alternative Email(s) */}
                  {currentMatterObj.alternative_email && (
                    <div style={{fontSize:'0.65rem', paddingLeft:'12px', color:'var(--text-muted)'}}>
                      {currentMatterObj.alternative_email.split(/,+/).map((em, idx) => (
                        <div key={idx}>
                          Alt: <a href={`mailto:${em.trim()}`} style={{color:'inherit', textDecoration:'none'}}>{em.trim()}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{fontSize:'0.68rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                    🪪 ID/Pass: <strong>{currentMatterObj.id_number || 'N/A'}</strong>
                  </div>
                </div>
              );
            })()}
            
            {activeMatterId && isSidebarCollapsed && (
              <div style={{marginTop:'8px', paddingTop:'8px', borderTop:'1px solid var(--border-default)', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', fontSize:'0.8rem'}} title={`Active Matter:\nPhone: ${cases.find(c => c.id === activeMatterId)?.client_phone || 'N/A'}\nEmail: ${cases.find(c => c.id === activeMatterId)?.client_email || 'N/A'}`}>
                <span>⚖️</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="dash-content">
          {activeMatterId && (
            <div className="matter-dashboard">
              {cases.find(c => c.id === activeMatterId)?.current_milestone === 'CLOSED' && (
                <div style={{background:'rgba(239,83,80,0.12)', border:'1px solid rgba(239,83,80,0.4)', padding:'12px 16px', borderRadius:'8px', marginBottom:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'1.2rem'}}>🏛️</span>
                    <div>
                      <div style={{color:'#ef5350', fontWeight:700, fontSize:'0.88rem'}}>🔒 ARCHIVED MATTER VAULT</div>
                      <div style={{color:'var(--text-secondary)', fontSize:'0.78rem'}}>This legal matter is closed. All historical pleadings, files, trust ledgers, and notes are preserved.</div>
                    </div>
                  </div>
                  {userCanEdit && (
                    <button className="primary-btn" style={{padding:'6px 14px', fontSize:'0.78rem', background:'#4db6ac', color:'var(--navy-950)', fontWeight:700}}
                      onClick={() => handleReopenCase(activeMatterId, cases.find(c => c.id === activeMatterId)?.client_name)}>
                      🔓 Re-open Case
                    </button>
                  )}
                </div>
              )}
              <div className="matter-header">
                <button className="secondary-btn" style={{marginBottom:'15px', padding:'4px 10px'}} onClick={() => { setActiveMatterId(null); setSelectedCase(null); }}>← Back to Matters</button>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
                  <h2 style={{color:'var(--gold-400)', margin:0}}>
                    {cases.find(c => c.id === activeMatterId)?.client_name}
                    <span style={{color:'var(--text-secondary)', fontSize:'1rem', marginLeft:'10px'}}>
                      {cases.find(c => c.id === activeMatterId)?.case_title}
                    </span>
                  </h2>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    <button className="primary-btn" style={{padding:'6px 12px', fontSize:'0.78rem', fontWeight:700}} onClick={() => handleLiveCtsSync(activeMatterId)}>
                      🔄 Sync CTS Data
                    </button>
                    <button className="secondary-btn" style={{fontSize:'0.78rem'}} onClick={() => setShowJudiciaryApiSettingsModal(true)}>
                      ⚙️ API Config
                    </button>
                    {userRole !== 'advocate' && <button className="secondary-btn" onClick={() => { setEditableMilestones([...currentMilestonesList]); setShowEditMilestoneModal(true); }}>✏️ Edit Milestones</button>}
                    {userRole !== 'advocate' && <button className="secondary-btn" style={{borderColor:'var(--gold-500)',color:'var(--gold-400)'}} onClick={() => { const c = cases.find(x => x.id === activeMatterId); if(c) { setPaymentForm({trust_payment_status:c.trust_payment_status||'none',trust_payment_ref:c.trust_payment_ref||'',total_fee:c.total_fee||'',outstanding_balance:c.outstanding_balance||'',fee_status:c.fee_status||'pending'}); setShowPaymentModal(true); }}}>💳 Payment Ref</button>}
                    {userRole !== 'advocate' && <button className="secondary-btn" style={{borderColor:'#64b5f6',color:'#64b5f6'}} onClick={() => { const c = cases.find(x => x.id === activeMatterId); if(c) { setJudiciaryForm({judiciary_case_id:c.judiciary_case_id||'',judiciary_filing_token:c.judiciary_filing_token||''}); setShowJudiciaryModal(true); }}}>⚖️ Judiciary IDs</button>}
                  </div>
                </div>
                <div className="matter-nav">
                  <button className={`matter-nav-btn ${matterTab==='overview'?'active':''}`} onClick={()=>setMatterTab('overview')}>Overview</button>
                  <button className={`matter-nav-btn ${matterTab==='client'?'active':''}`} onClick={()=>setMatterTab('client')}>Client Profile</button>
                  <button className={`matter-nav-btn ${matterTab==='files'?'active':''}`} onClick={()=>setMatterTab('files')}>Files & Documents</button>
                  <button className={`matter-nav-btn ${matterTab==='submissions'?'active':''}`} onClick={()=>setMatterTab('submissions')}>📜 Submissions & Authorities</button>
                  <button className={`matter-nav-btn ${matterTab==='calendar'?'active':''}`} onClick={()=>setMatterTab('calendar')}>Calendar</button>
                  {userRole !== 'advocate' && <button className={`matter-nav-btn ${matterTab==='finance'?'active':''}`} onClick={()=>setMatterTab('finance')}>Financials</button>}
                  <button className={`matter-nav-btn ${matterTab==='templates'?'active':''}`} onClick={()=>setMatterTab('templates')}>Letter Templates</button>
                </div>
              </div>

              <div style={{padding:'20px'}}>
                {matterTab === 'overview' && (
                  <div style={{display:'grid', gap:'20px'}}>

                    {/* ── Milestone Timeline + WhatsApp Sync ── */}
                    {(() => {
                      const activeCase = cases.find(c => c.id === activeMatterId);
                      const milestones = (() => { try { return JSON.parse(activeCase?.milestones_json || '[]'); } catch(e){ return []; } })();
                      const current = parseInt(activeCase?.current_milestone) || 1;
                      const isClosed = activeCase?.current_milestone === 'CLOSED';
                      return (
                        <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'16px 20px'}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px'}}>
                            <h3 style={{color:'var(--gold-400)', fontSize:'0.95rem', margin:0}}>📍 Matter Progress</h3>

                          </div>
                          {/* Timeline nodes */}
                          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0', marginBottom:'16px', overflowX:'auto', paddingBottom:'4px'}}>
                            {milestones.map((m, idx) => {
                              const phaseNum = idx + 1;
                              const isDone = isClosed || phaseNum < current;
                              const isActive = !isClosed && phaseNum === current;
                              return (
                                <div key={idx} style={{display:'flex', alignItems:'center', flex: '1 1 auto'}}>
                                  <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor: userCanEdit ? 'pointer' : 'default', minWidth:'70px'}}
                                    onClick={() => userCanEdit && setSelectedPhase(String(phaseNum))}>
                                    <div style={{
                                      width:'28px', height:'28px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                                      fontSize:'0.65rem', fontWeight:700, flexShrink:0, transition:'all 0.2s',
                                      background: isDone ? 'var(--gold-500)' : isActive ? 'rgba(201,168,76,0.2)' : 'var(--navy-950)',
                                      border: isDone ? '2px solid var(--gold-500)' : isActive ? '2px solid var(--gold-400)' : '2px solid var(--border-default)',
                                      color: isDone ? 'var(--navy-950)' : isActive ? 'var(--gold-400)' : 'var(--text-muted)',
                                      boxShadow: isActive ? '0 0 10px rgba(201,168,76,0.4)' : 'none'
                                    }}>{isDone ? '✓' : phaseNum}</div>
                                    <div style={{fontSize:'0.58rem', color: isActive ? 'var(--gold-400)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)',
                                      textAlign:'center', maxWidth:'70px', lineHeight:'1.2', fontWeight: isActive ? 700 : 400}}>{m}</div>
                                  </div>
                                  <div style={{flex:1, height:'2px', minWidth:'15px', margin:'0 4px', marginBottom:'22px',
                                    background: isDone ? 'var(--gold-500)' : 'var(--border-default)'}} />
                                </div>
                              );
                            })}
                            {/* CLOSED node */}
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor: userCanEdit ? 'pointer' : 'default', minWidth:'70px', flexShrink: 0}}
                              onClick={() => userCanEdit && setSelectedPhase('CLOSED')}>
                              <div style={{
                                width:'28px', height:'28px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:'0.6rem', fontWeight:700, flexShrink:0,
                                background: isClosed ? '#ef5350' : 'var(--navy-950)',
                                border: isClosed ? '2px solid #ef5350' : '2px solid var(--border-default)',
                                color: isClosed ? 'white' : 'var(--text-muted)'
                              }}>{isClosed ? '🔒' : 'End'}</div>
                              <div style={{fontSize:'0.58rem', color: isClosed ? '#ef5350' : 'var(--text-muted)',
                                textAlign:'center', maxWidth:'70px', lineHeight:'1.2', fontWeight: isClosed ? 700 : 400}}>CLOSE</div>
                            </div>
                          </div>
                          {/* Controls */}
                          {userCanEdit && (
                            <div style={{display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'}}>
                              <select value={selectedPhase} onChange={e => setSelectedPhase(e.target.value)}
                                style={{background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'6px 10px', borderRadius:'4px', fontSize:'0.8rem', flex:'1', minWidth:'160px'}}>
                                {milestones.map((m, i) => <option key={i} value={String(i+1)}>Phase {i+1}: {m}</option>)}
                                <option value="CLOSED">⛔ CLOSE / ARCHIVE CASE</option>
                              </select>
                              {parseInt(selectedPhase) > current || selectedPhase === 'CLOSED'
                                ? <button className="primary-btn" style={{padding:'6px 14px', fontSize:'0.8rem'}} onClick={handleMilestoneUpdate}>▶ Advance</button>
                                : parseInt(selectedPhase) < current
                                ? <button className="secondary-btn" style={{padding:'6px 14px', fontSize:'0.8rem', borderColor:'#ef5350', color:'#ef5350'}} onClick={handleMilestoneRollback}>↩ Rollback</button>
                                : <button className="primary-btn" style={{padding:'6px 14px', fontSize:'0.8rem', opacity:0.5}} disabled>Current Phase</button>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })()}



                    {/* Activity Log */}
                    <div style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                        <h3 style={{color:'var(--gold-400)',fontSize:'0.95rem'}}>📝 Case Activity Log</h3>
                        <span style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>Click ★ to star important entries</span>
                      </div>
                      {userRole !== 'advocate' && (
                        <form onSubmit={handleAddActivity} style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr auto',gap:'8px',marginBottom:'12px'}}>
                          <select style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'6px 10px',borderRadius:'4px',fontSize:'0.8rem'}} value={newActivityForm.activity_type} onChange={e => setNewActivityForm({...newActivityForm, activity_type:e.target.value})}>
                            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                          </select>
                          <input placeholder="What happened? e.g. Filed motion at Milimani…" style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'6px 10px',borderRadius:'4px',fontSize:'0.8rem'}} value={newActivityForm.description} onChange={e => setNewActivityForm({...newActivityForm, description:e.target.value})} required/>
                          <select style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'6px 10px',borderRadius:'4px',fontSize:'0.8rem'}} value={newActivityForm.recorded_by} onChange={e => setNewActivityForm({...newActivityForm, recorded_by:e.target.value})}>
                            <option>{userDisplayName}</option>
                            {lawyersList.map(l => <option key={l}>{l}</option>)}
                          </select>
                          <button type="submit" className="primary-btn" style={{padding:'6px 12px',fontSize:'0.75rem'}}>+ Log</button>
                        </form>
                      )}
                      <div style={{maxHeight:'300px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'6px'}}>
                        {activities.length === 0 && <p style={{color:'var(--text-muted)',fontSize:'0.8rem',textAlign:'center',padding:'12px'}}>No activities logged yet.</p>}
                        {activities.map(a => (
                          <div key={a.id} style={{display:'flex',gap:'10px',padding:'8px 10px',background: a.is_starred ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',borderRadius:'4px',borderLeft:`3px solid ${a.is_starred ? 'var(--gold-500)' : a.activity_type==='court_filing'?'var(--gold-500)':a.activity_type==='client_call'?'#64b5f6':a.activity_type==='milestone_change'?'#4db6ac':'var(--border-default)'}`}}>
                            <button onClick={() => handleStarActivity(a.id)} title={a.is_starred ? 'Unstar' : 'Star this entry'}
                              style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.9rem',color: a.is_starred ? '#c9a84c' : 'rgba(255,255,255,0.2)',padding:'0',flexShrink:0}}>
                              {a.is_starred ? '★' : '☆'}
                            </button>
                            <div style={{flex:1}}>
                              <span className="badge badge--pending" style={{marginRight:'6px',fontSize:'0.65rem'}}>{a.activity_type.replace('_',' ')}</span>
                              <span style={{fontSize:'0.8rem'}}>{a.description}</span>
                            </div>
                            <div style={{fontSize:'0.7rem',color:'var(--text-secondary)',whiteSpace:'nowrap',textAlign:'right'}}>
                              {a.recorded_by}<br/>
                              <span style={{color:'var(--text-muted)'}}>{new Date(a.created_at).toLocaleString('en-KE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {matterTab === 'client' && (
                  <ClientProfileTab
                    activeCase={cases.find(c => c.id === activeMatterId)}
                    fetchData={fetchData}
                    userRole={userRole}
                    showToast={showToast}
                  />
                )}
                {matterTab === 'files' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    <div style={{display:'flex', gap:'12px', alignItems:'center', background:'var(--navy-900)', border:'1px solid var(--border-default)', padding:'12px 16px', borderRadius:'8px', flexWrap:'wrap'}}>
                      <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                        <label style={{fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Target Folder / Category</label>
                        <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} 
                                style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'8px 12px', borderRadius:'4px', fontSize:'0.82rem', minWidth:'220px'}}>
                          <option value="pleadings">🏛️ Pleadings & Motions</option>
                          <option value="correspondence">✉️ Correspondences & Letters</option>
                          <option value="exhibits">📷 Evidence & Exhibits</option>
                          <option value="client_kyc">👤 Client Onboarding & KYC</option>
                          <option value="financials">💵 Fee Agreements & Financials</option>
                          <option value="research">📚 Legal Research & Opinions</option>
                          <option value="court_orders">📜 Court Orders & Judgments</option>
                          <option value="other">📁 Other / Miscellaneous</option>
                        </select>
                      </div>
                      <div style={{flex:1}}>
                        {userRole !== 'advocate' && (
                          <label className={`file-dropzone ${uploadingFile ? 'drag-active' : ''}`} style={{margin:0, padding:'10px 15px', fontSize:'0.82rem', height:'auto', minHeight:'unset'}}>
                            <input type="file" style={{display:'none'}} onChange={handleFileUpload} disabled={uploadingFile} />
                            {uploadingFile ? 'Uploading...' : 'Click to Upload Document to Selected Folder (Max 100MB)'}
                          </label>
                        )}
                      </div>
                    </div>

                    <div style={{display:'flex', flexDirection:'column', gap:'12px', marginTop:'5px'}}>
                      {[
                        { id: 'pleadings', label: '🏛️ Pleadings & Motions', color: '#ef5350' },
                        { id: 'correspondence', label: '✉️ Correspondences & Letters', color: '#64b5f6' },
                        { id: 'exhibits', label: '📷 Evidence & Exhibits', color: '#4db6ac' },
                        { id: 'client_kyc', label: '👤 Client Onboarding & KYC', color: '#ffb74d' },
                        { id: 'financials', label: '💵 Fee Agreements & Financials', color: '#81c784' },
                        { id: 'research', label: '📚 Legal Research & Opinions', color: '#ba68c8' },
                        { id: 'court_orders', label: '📜 Court Orders & Judgments', color: '#a1887f' },
                        { id: 'other', label: '📁 Other / Miscellaneous', color: 'var(--text-muted)' }
                      ].map(folder => {
                        const filesInFolder = caseFiles.filter(f => (f.category || 'other') === folder.id);
                        return (
                          <details key={folder.id} open={filesInFolder.length > 0} 
                                   style={{background:'var(--navy-900)', border:'1px solid var(--border-default)', borderRadius:'8px', overflow:'hidden'}}>
                            <summary style={{padding:'12px 16px', background:'var(--navy-800)', cursor:'pointer', fontWeight:600, color:'white', display:'flex', justifyContent:'space-between', alignItems:'center', outline:'none', listStyle:'none'}}>
                              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                <span style={{color: folder.color, fontSize:'1.1rem'}}>{folder.label.split(' ')[0]}</span>
                                <span>{folder.label.slice(2)}</span>
                                <span className="badge" style={{fontSize:'0.7rem', padding:'2px 6px', background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)'}}>
                                  {filesInFolder.length} file{filesInFolder.length === 1 ? '' : 's'}
                                </span>
                              </div>
                              <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>▼</span>
                            </summary>
                            <div style={{padding:'15px', borderTop:'1px solid var(--border-default)', display:'flex', flexDirection:'column', gap:'8px', background:'var(--navy-950)'}}>
                              {filesInFolder.length === 0 ? (
                                <p style={{color:'var(--text-muted)', fontSize:'0.8rem', margin:0, fontStyle:'italic'}}>No files in this folder yet.</p>
                              ) : (
                                filesInFolder.map(f => (
                                  <div key={f.id} className="file-item" style={{margin:0, padding:'10px 15px', background:'var(--navy-900)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <div>
                                      <strong>📄 {f.file_name}</strong>
                                      <div style={{fontSize:'0.7rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                                        {((f.file_size || 0)/1024/1024).toFixed(2)} MB • Uploaded {new Date(f.uploaded_at || Date.now()).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <div style={{display:'flex', gap:'10px'}}>
                                      <a href={`${BASE}${f.file_path}`} target="_blank" rel="noreferrer" className="action-btn" style={{textDecoration:'none'}}>Download</a>
                                      {userRole !== 'advocate' && (
                                        <button className="action-btn" style={{color:'var(--red-400)'}} onClick={() => handleDeleteFile(f.id, f.file_name)}>Delete</button>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Submissions & Authorities Sub-Tab ── */}
                {matterTab === 'submissions' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--navy-800)', padding:'14px 18px', borderRadius:'8px', border:'1px solid var(--border-default)', flexWrap:'wrap', gap:'10px'}}>
                      <div>
                        <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1rem'}}>📜 Court Submissions, Authorities & Skeleton Arguments</h3>
                        <p style={{margin:'4px 0 0 0', color:'var(--text-secondary)', fontSize:'0.8rem'}}>Track filing deadlines, skeleton arguments, authority lists, and service status for this matter.</p>
                      </div>
                      {userCanEdit && (
                        <button className="primary-btn" onClick={() => setShowAddSubmissionModal(true)}>
                          + Schedule New Submission
                        </button>
                      )}
                    </div>

                    <div className="dash-table-wrapper">
                      <table className="dash-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Title / Summary</th>
                            <th>Filing Deadline</th>
                            <th>Assigned Advocate</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {caseSubmissions.length === 0 && (
                            <tr>
                              <td colSpan="6" style={{textAlign:'center', padding:'24px', color:'var(--text-muted)'}}>
                                📜 No pleadings or submissions logged for this matter yet. Click "+ Schedule New Submission" to set deadlines.
                              </td>
                            </tr>
                          )}
                          {caseSubmissions.map(sub => {
                            const isOverdue = sub.due_date && new Date(sub.due_date).getTime() < Date.now() && sub.status !== 'completed' && sub.status !== 'served';
                            return (
                              <tr key={sub.id} style={{background: isOverdue ? 'rgba(239,83,80,0.06)' : undefined}}>
                                <td>
                                  <span className="badge" style={{background:'var(--navy-900)', border:'1px solid var(--gold-500)', color:'var(--gold-300)', fontSize:'0.72rem'}}>
                                    {sub.submission_type.replace(/_/g, ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <strong>{sub.title}</strong>
                                  {sub.notes && <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'2px'}}>{sub.notes}</div>}
                                </td>
                                <td>
                                  {sub.due_date ? (
                                    <span style={{color: isOverdue ? '#ef5350' : 'white', fontWeight: isOverdue ? 700 : 400}}>
                                      📅 {new Date(sub.due_date).toLocaleString('en-KE')}
                                      {isOverdue && <span style={{fontSize:'0.7rem', color:'#ef5350', display:'block'}}>⚠️ OVERDUE</span>}
                                    </span>
                                  ) : (
                                    <span style={{color:'var(--text-muted)'}}>No Deadline</span>
                                  )}
                                </td>
                                <td>⚖️ {sub.assigned_lawyer || 'Unassigned'}</td>
                                <td>
                                  <select 
                                    value={sub.status} 
                                    onChange={e => handleUpdateSubmissionStatus(sub.id, e.target.value)}
                                    style={{background:'var(--navy-950)', color: sub.status === 'completed' || sub.status === 'served' ? '#4db6ac' : 'white', border:'1px solid var(--border-default)', padding:'4px 8px', borderRadius:'4px', fontSize:'0.78rem'}}
                                  >
                                    <option value="drafting">📝 Drafting</option>
                                    <option value="partner_review">👀 Partner Review</option>
                                    <option value="filed">🏛️ Filed in Court</option>
                                    <option value="served">📩 Served on Opposing</option>
                                    <option value="completed">✅ Completed</option>
                                  </select>
                                </td>
                                <td>
                                  {userCanEdit && (
                                    <button className="action-btn" style={{color:'var(--red-400)'}} onClick={() => handleDeleteSubmission(sub.id)}>
                                      Delete
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {matterTab === 'calendar' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'24px'}}>
                    <CalendarTab
                      calendar={calendar}
                      upcoming48h={upcoming48h}
                      setEditingEvent={setEditingEvent}
                      setNewEventForm={setNewEventForm}
                      setShowAddEventModal={setShowAddEventModal}
                      handleDeleteEvent={handleDeleteEvent}
                      caseId={activeMatterId}
                    />

                    {/* Quick list summary of events below the calendar */}
                    <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
                      <h4 style={{color:'var(--gold-300)', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>📋 Case Schedule List</h4>
                      <div className="dash-table-wrapper">
                        <table className="dash-table">
                          <thead><tr><th>Date & Time</th><th>Event</th><th>Type</th><th>Notes</th><th>Action</th></tr></thead>
                          <tbody>
                            {calendar.filter(ev => ev.case_id === activeMatterId).length === 0 ? (
                              <tr><td colSpan="5" style={{textAlign:'center', color:'var(--text-muted)', padding:'12px'}}>No scheduled events for this matter.</td></tr>
                            ) : (
                              calendar.filter(ev => ev.case_id === activeMatterId).map(ev => (
                                <tr key={ev.id}>
                                  <td>{new Date(ev.event_date).toLocaleString('en-KE')}</td>
                                  <td><strong>{ev.event_title}</strong></td>
                                  <td><span className="badge badge--pending">{ev.event_type?.replace('_',' ')}</span></td>
                                  <td>{ev.notes}</td>
                                  <td>
                                    {userRole !== 'advocate' && (
                                      <button className="action-btn" onClick={() => handleEditEventClick(ev)}>✏️ Edit</button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {matterTab === 'finance' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'24px'}}>
                    {/* Disclaimer banner */}
                    <div style={{background:'rgba(255,193,7,0.05)', border:'1px solid rgba(255,193,7,0.3)', borderRadius:'8px', padding:'12px 16px', fontSize:'0.8rem', color:'var(--gold-400)', lineHeight:'1.5'}}>
                      ⚠️ <strong>ADMINISTRATIVE RECORD ONLY:</strong> Legal OS does not hold, move, or process client funds. Real-world financial transactions must be processed via licensed banking institutions or authorized channels. These ledgers serve as internal administrative logs only.
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px'}}>
                      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', padding:'20px', borderRadius:'8px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div style={{color:'var(--text-secondary)', fontSize:'0.8rem', textTransform:'uppercase'}}>Total Agreed Fee</div>
                          {userRole !== 'advocate' && <button className="secondary-btn" style={{padding:'2px 8px', fontSize:'0.7rem'}} onClick={() => { const c = cases.find(x => x.id === activeMatterId); if(c) { setEditFeeForm({total_fee:c.total_fee||'',fee_status:c.fee_status||'pending'}); setShowEditFeeModal(true); }}}>✏️ Edit</button>}
                        </div>
                        <div style={{fontSize:'1.6rem', color:'white', fontWeight:'bold', marginTop:'5px'}}>KES {(cases.find(c => c.id === activeMatterId)?.total_fee || 0).toLocaleString()}</div>
                      </div>
                      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', padding:'20px', borderRadius:'8px'}}>
                        <div style={{color:'var(--text-secondary)', fontSize:'0.8rem', textTransform:'uppercase'}}>Outstanding Balance</div>
                        <div style={{fontSize:'1.6rem', color:'var(--red-400)', fontWeight:'bold', marginTop:'5px'}}>KES {(cases.find(c => c.id === activeMatterId)?.outstanding_balance || 0).toLocaleString()}</div>
                      </div>
                      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', padding:'20px', borderRadius:'8px'}}>
                        <div style={{color:'var(--text-secondary)', fontSize:'0.8rem', textTransform:'uppercase'}}>Client Trust Balance (Escrow)</div>
                        <div style={{fontSize:'1.6rem', color:'var(--green-400)', fontWeight:'bold', marginTop:'5px'}}>
                          KES {casePayments.filter(p => p.destination === 'trust').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Invoices Section */}
                    <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <h3 style={{color:'var(--gold-400)', margin:0, fontSize:'1rem'}}>Bills & Invoices</h3>
                        {userRole !== 'advocate' && (
                          <button className="primary-btn" style={{padding:'6px 12px', fontSize:'0.8rem'}} onClick={() => {
                            setNewInvoiceForm({ invoice_number: 'INV-' + Date.now().toString().slice(-6), amount:'', notes:'', due_date:'', selectedDisbursements:[] });
                            setShowGenerateInvoiceModal(true);
                          }}>
                            + Generate Invoice
                          </button>
                        )}
                      </div>
                      <div className="dash-table-wrapper">
                        <table className="dash-table">
                          <thead><tr><th>Invoice #</th><th>Due Date</th><th>Total Amount</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead>
                          <tbody>
                            {caseInvoices.length === 0 && <tr><td colSpan="6" style={{textAlign:'center', color:'var(--text-muted)'}}>No invoices generated yet.</td></tr>}
                            {caseInvoices.map(inv => (
                              <tr key={inv.id}>
                                <td><strong>{inv.invoice_number}</strong></td>
                                <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'Immediate'}</td>
                                <td style={{fontWeight:'bold'}}>KES {inv.amount.toLocaleString()}</td>
                                <td>
                                  <span className={`badge badge--${inv.status === 'paid' ? 'success' : inv.status === 'partially_paid' ? 'pending' : 'archived'}`}>
                                    {inv.status.replace('_',' ').toUpperCase()}
                                  </span>
                                </td>
                                <td>{inv.notes || '—'}</td>
                                <td>
                                  {inv.status !== 'paid' && userRole !== 'advocate' && (
                                    <button className="action-btn" style={{color:'var(--green-400)'}} onClick={() => {
                                      setTrustTransferForm({ amount: inv.amount, invoice_id: inv.invoice_number, notes: `Trust transfer for invoice ${inv.invoice_number}` });
                                      setShowTrustTransferModal(true);
                                    }}>
                                      💵 Pay from Trust
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Disbursements Section */}
                    <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <h3 style={{color:'var(--gold-400)', margin:0, fontSize:'1rem'}}>Case Disbursements (Reimbursable Expenses)</h3>
                        {userRole !== 'advocate' && (
                          <button className="primary-btn" style={{padding:'6px 12px', fontSize:'0.8rem'}} onClick={() => {
                            setNewDisbursementForm({ amount:'', description:'', payment_method:'M-PESA' });
                            setShowAddDisbursementModal(true);
                          }}>
                            + Log Disbursement
                          </button>
                        )}
                      </div>
                      <div className="dash-table-wrapper">
                        <table className="dash-table">
                          <thead><tr><th>Date</th><th>Description</th><th>Amount (KES)</th><th>Paid Via</th><th>Status</th><th>Billed In</th></tr></thead>
                          <tbody>
                            {caseDisbursements.length === 0 && <tr><td colSpan="6" style={{textAlign:'center', color:'var(--text-muted)'}}>No disbursements logged yet.</td></tr>}
                            {caseDisbursements.map(d => (
                              <tr key={d.id}>
                                <td>{new Date(d.created_at).toLocaleDateString()}</td>
                                <td>{d.description}</td>
                                <td style={{fontWeight:'bold'}}>KES {d.amount.toLocaleString()}</td>
                                <td>{d.payment_method}</td>
                                <td>
                                  <span className={`badge badge--${d.status === 'unbilled' ? 'pending' : 'success'}`}>
                                    {d.status.toUpperCase()}
                                  </span>
                                </td>
                                <td>{d.invoice_id || 'Unbilled'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Ledgers (Operating vs. Client Trust) */}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                      {/* Operating Account Ledger */}
                      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                          <h3 style={{color:'var(--gold-400)', margin:0, fontSize:'1rem'}}>Operating Account Ledger</h3>
                          {userRole !== 'advocate' && (
                            <button className="primary-btn" style={{padding:'6px 12px', fontSize:'0.8rem'}} onClick={() => {
                              setNewPaymentForm({ amount:'', payment_ref:'', payment_method:'MPESA', notes:'', destination:'operating', invoice_id:'' });
                              setShowAddPaymentModal(true);
                            }}>
                              + Log Installment
                            </button>
                          )}
                        </div>
                        <div className="dash-table-wrapper" style={{maxHeight:'250px', overflowY:'auto'}}>
                          <table className="dash-table">
                            <thead><tr><th>Date</th><th>Amount (KES)</th><th>Ref</th><th>Invoice</th></tr></thead>
                            <tbody>
                              {casePayments.filter(p => p.destination === 'operating').length === 0 && <tr><td colSpan="4" style={{textAlign:'center', color:'var(--text-muted)'}}>No payments.</td></tr>}
                              {casePayments.filter(p => p.destination === 'operating').map(p => (
                                <tr key={p.id}>
                                  <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                                  <td style={{color:'var(--green-400)', fontWeight:'bold'}}>+ {p.amount.toLocaleString()}</td>
                                  <td>{p.payment_ref}</td>
                                  <td>{p.invoice_id || 'Direct'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Client Trust Account Ledger */}
                      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                          <h3 style={{color:'var(--gold-400)', margin:0, fontSize:'1rem'}}>Client Trust Account Ledger (Escrow)</h3>
                          {userRole !== 'advocate' && (
                            <button className="primary-btn" style={{padding:'6px 12px', fontSize:'0.8rem'}} onClick={() => {
                              setNewPaymentForm({ amount:'', payment_ref:'', payment_method:'MPESA', notes:'', destination:'trust', invoice_id:'' });
                              setShowAddPaymentModal(true);
                            }}>
                              + Deposit to Trust
                            </button>
                          )}
                        </div>
                        <div className="dash-table-wrapper" style={{maxHeight:'250px', overflowY:'auto'}}>
                          <table className="dash-table">
                            <thead><tr><th>Date</th><th>Amount (KES)</th><th>Ref</th><th>Notes</th></tr></thead>
                            <tbody>
                              {casePayments.filter(p => p.destination === 'trust').length === 0 && <tr><td colSpan="4" style={{textAlign:'center', color:'var(--text-muted)'}}>No trust deposits.</td></tr>}
                              {casePayments.filter(p => p.destination === 'trust').map(p => (
                                <tr key={p.id}>
                                  <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                                  <td style={{color: p.amount < 0 ? 'var(--red-400)' : 'var(--green-400)', fontWeight:'bold'}}>
                                    {p.amount < 0 ? '' : '+'} {p.amount.toLocaleString()}
                                  </td>
                                  <td>{p.payment_ref}</td>
                                  <td style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>{p.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {matterTab === 'templates' && (
                  <DocumentStudio 
                    cases={cases} 
                    leads={leads} 
                    activeMatterId={activeMatterId} 
                    lawyersList={lawyersList} 
                    userDisplayName={userDisplayName} 
                  />
                )}
              </div>
            </div>
          )}

          {!activeMatterId && (
            <div style={{display:'flex', flexDirection:'column', width:'100%'}}>
          {/* ═══════ HOME TAB ═══════ */}
          {activeTab === 'home' && (
            <HomeDashboard
              cases={cases}
              leads={leads}
              calendar={calendar}
              upcoming48h={upcoming48h}
              userRole={userRole}
              filterBy={filterBy}
              setFilterBy={setFilterBy}
              setActiveTab={setActiveTab}
            />
          )}

          {/* ═══════ LEADS TAB ═══════ */}
          {activeTab === 'leads' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:'1rem',color:'var(--gold-400)'}}>
                  CRM Inbox {filterBy !== 'all' && <span style={{color:'var(--text-secondary)',fontSize:'0.8rem'}}>(Filtered) <button onClick={() => setFilterBy('all')} style={{background:'none',border:'none',color:'var(--red-400)',cursor:'pointer',textDecoration:'underline'}}>Clear</button></span>}
                </h3>
                <div style={{display:'flex',gap:'10px'}}>
                  <button className="primary-btn" onClick={() => setShowNewLeadModal(true)}>+ New Lead</button>
                  <button className="secondary-btn" style={{color:'white',borderColor:'var(--gold-500)'}} onClick={() => setShowNewCaseModal(true)}>+ Direct Case</button>
                </div>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead><tr><th>Date</th><th>Source</th><th>Client</th><th>Category</th><th>Consultation</th><th>Assigned</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {filteredLeads.map(lead => (
                      <tr key={lead.id} className={lead.is_emergency === 1 || lead.message?.includes('[URGENT]') ? 'urgent-row' : ''}>
                        <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                        <td><span className={`badge badge--${lead.source==='whatsapp'?'active':'success'}`}>{lead.source?.replace('_',' ')}</span></td>
                        <td><strong>{lead.full_name}</strong><br/><span style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>{lead.phone}</span></td>
                        <td>{lead.service_category}</td>
                        <td>{lead.consultation_date ? <span style={{fontSize:'0.75rem',color:lead.consultation_paid?'#4db6ac':'#ef5350',fontWeight:lead.consultation_paid?'normal':'bold'}}>{new Date(lead.consultation_date).toLocaleDateString()} ({lead.consultation_paid?'Paid':'Unpaid'})</span> : 'Not Set'}</td>
                        <td>{lead.assigned_lawyer || 'Unassigned'}</td>
                        <td><span className={`badge badge--${lead.status==='converted'?'success':(lead.status==='no_show'?'new':'pending')}`}>{lead.status?.replace('_',' ')}</span></td>
                        <td>{lead.status !== 'converted' && <button className="action-btn" onClick={() => { setSelectedLead(lead); setLeadActionForm({...leadActionForm, assigned_lawyer:lead.assigned_lawyer||'Sam Ogola', consultation_date:lead.consultation_date||'', consultation_paid:lead.consultation_paid===1, convert_to_case:false}); }}>Manage</button>}</td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && <tr><td colSpan="8" style={{textAlign:'center',padding:'30px',color:'var(--text-secondary)'}}>No leads match this filter.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════ ARCHIVES & VAULT TAB ═══════ */}
          {activeTab === 'archives' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%',position:'relative'}}>
              {!isVaultUnlocked ? (
                /* ── Locked Security Gate Overlay ── */
                <div style={{
                  background: 'var(--navy-900)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  padding: '50px 30px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxWidth: '520px',
                  margin: '40px auto 0 auto',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)'
                }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'rgba(201,168,76,0.12)', border: '2px solid var(--gold-500)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', marginBottom: '16px'
                  }}>
                    🏛️
                  </div>
                  <h3 style={{color:'var(--gold-400)', margin:'0 0 8px 0', fontSize:'1.25rem'}}>
                    Archives & Vault Security Access
                  </h3>
                  <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', margin:'0 0 24px 0', lineHeight:'1.5'}}>
                    The Archives Vault contains sensitive closed cases, client financial records, and historical court pleadings.
                    Please re-authenticate with the account password for <strong>@{session.username || session.display_name || 'User'}</strong> to unlock access.
                  </p>

                  <form onSubmit={handleUnlockVaultSubmit} style={{width:'100%', display:'flex', flexDirection:'column', gap:'14px'}}>
                    <div>
                      <input
                        type="password"
                        placeholder="Enter your account password..."
                        style={{
                          width: '100%',
                          background: 'var(--navy-950)',
                          border: vaultAuthError ? '1px solid #ef5350' : '1px solid var(--border-default)',
                          color: 'white',
                          padding: '12px 16px',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          outline: 'none',
                          textAlign: 'center',
                          letterSpacing: '0.1em'
                        }}
                        value={vaultPasswordInput}
                        onChange={e => setVaultPasswordInput(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>

                    {vaultAuthError && (
                      <div style={{color:'#ef5350', fontSize:'0.8rem', fontWeight:600}}>
                        ⚠️ {vaultAuthError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="primary-btn"
                      style={{width:'100%', padding:'12px', fontSize:'0.9rem', fontWeight:700, letterSpacing:'0.03em'}}
                      disabled={vaultAuthLoading}
                    >
                      {vaultAuthLoading ? 'Authenticating...' : '🔓 Unlock Vault (15m Session)'}
                    </button>
                  </form>
                </div>
              ) : (
                /* ── Unlocked Vault Workspace ── */
                <>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px', background:'var(--navy-800)', border:'1px solid var(--border-default)', padding:'14px 20px', borderRadius:'8px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                      <span style={{fontSize:'1.4rem'}}>🏛️</span>
                      <div>
                        <h3 style={{fontSize:'1.05rem', color:'var(--gold-400)', margin:0}}>Archives & Closed Matters Vault</h3>
                        <div style={{color:'var(--text-secondary)', fontSize:'0.75rem', marginTop:'2px'}}>
                          Showing {filteredArchivedCases.length} of {archivedCases.length} closed matters
                        </div>
                      </div>
                    </div>

                    <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                      <div style={{background:'rgba(77,182,172,0.12)', border:'1px solid rgba(77,182,172,0.4)', color:'#4db6ac', padding:'5px 12px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:600}}>
                        ⏱️ Vault Session: <strong>{vaultTimeRemaining}</strong>
                      </div>
                      <button className="secondary-btn" style={{padding:'5px 12px', fontSize:'0.75rem', borderColor:'#ef5350', color:'#ef5350'}} onClick={handleLockVaultNow}>
                        🔒 Lock Vault Now
                      </button>
                    </div>
                  </div>

                  {/* Vault Search Bar */}
                  <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                    <input
                      type="text"
                      placeholder="🔍 Instant Search Archives by Client, Case Title, Judiciary ID, Token, Category, or Advocate..."
                      value={vaultSearchQuery}
                      onChange={e => setVaultSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'var(--navy-950)',
                        border: '1px solid var(--border-default)',
                        color: 'white',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    />
                    {vaultSearchQuery && (
                      <button className="secondary-btn" style={{padding:'8px 12px', fontSize:'0.8rem'}} onClick={() => setVaultSearchQuery('')}>
                        Clear Search
                      </button>
                    )}
                  </div>

                  {/* Archives Data Table */}
                  <div className="dash-table-wrapper">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Judiciary ID / Ref</th>
                          <th>Client</th>
                          <th>Case Title</th>
                          <th>Category</th>
                          <th>Advocate</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredArchivedCases.map(c => (
                          <tr key={c.id}>
                            <td>
                              {c.judiciary_case_id ? (
                                <span style={{fontFamily:'monospace', color:'#64b5f6', fontWeight:700, fontSize:'0.8rem'}}>{c.judiciary_case_id}</span>
                              ) : <span style={{color:'var(--text-muted)', fontSize:'0.65rem'}}>Judiciary ID: Unset</span>}
                              <div style={{fontFamily:'monospace', fontSize:'0.72rem', color:'var(--gold-400)', marginTop:'3px', fontWeight:600}}>
                                Ref: {c.tracking_token}
                              </div>
                            </td>
                            <td><strong>{c.client_name}</strong>{c.is_sensitive===1&&<span style={{color:'#ef5350', fontSize:'0.65rem', marginLeft:'4px'}}>🔒</span>}</td>
                            <td style={{fontSize:'0.8rem'}}>{c.case_title}</td>
                            <td>{c.case_type}</td>
                            <td>{c.assigned_lawyer}</td>
                            <td><span className="badge badge--archived">CLOSED</span></td>
                            <td>
                              <div style={{display:'flex', gap:'6px'}}>
                                <button className="primary-btn" style={{padding:'4px 8px', fontSize:'0.72rem'}} onClick={() => {
                                  setActiveMatterId(c.id);
                                  setMatterTab('overview');
                                  setSelectedCase(c.id);
                                  setSelectedPhase(c.current_milestone);
                                }}>
                                  📁 Document Locker
                                </button>
                                {userCanEdit && (
                                  <button className="secondary-btn" style={{padding:'4px 8px', fontSize:'0.72rem', borderColor:'#4db6ac', color:'#4db6ac'}} onClick={() => handleReopenCase(c.id, c.client_name)}>
                                    🔓 Re-open
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredArchivedCases.length === 0 && (
                          <tr>
                            <td colSpan="7" style={{textAlign:'center', padding:'40px', color:'var(--text-secondary)'}}>
                              🏛️ {archivedCases.length === 0 ? 'No cases have been closed/archived yet.' : 'No archived cases match your search query.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════ MATTERS TAB ═══════ */}
          {activeTab === 'matters' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <h3 style={{fontSize:'1rem',color:'var(--gold-400)', margin:0}}>⚖️ Active Matters</h3>
                  <span className="badge" style={{background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)', fontSize:'0.75rem', padding:'2px 8px'}}>
                    {filteredCases.length} Active
                  </span>
                </div>
                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                  {filterBy !== 'all' && <span style={{color:'var(--text-secondary)',fontSize:'0.8rem'}}>(Filtered) <button onClick={()=>setFilterBy('all')} style={{background:'none',border:'none',color:'var(--red-400)',cursor:'pointer',textDecoration:'underline'}}>Clear</button></span>}
                </div>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead><tr>
                    <th>Judiciary ID / Ref</th>
                    <th>Client</th>
                    <th>Case Title</th>
                    <th>Category</th>
                    <th>Lawyer</th>
                    <th>Phase</th>
                  </tr></thead>
                  <tbody>
                    {filteredCases.map(c => (
                      <tr key={c.id} onClick={() => { 
                        setActiveMatterId(c.id); 
                        setMatterTab('overview'); 
                        setSelectedCase(c.id); 
                        setSelectedPhase(c.current_milestone);
                      }} style={{cursor:'pointer'}}>
                        <td>
                          {c.judiciary_case_id ? (
                            <span style={{fontFamily:'monospace',color:'#64b5f6',fontWeight:700,fontSize:'0.8rem'}}>{c.judiciary_case_id}</span>
                          ) : <span style={{color:'var(--text-muted)',fontSize:'0.65rem'}}>Judiciary ID: Not set</span>}
                          <div style={{fontFamily:'monospace',fontSize:'0.72rem',color:'var(--gold-400)',marginTop:'3px',fontWeight:600}}>
                            Ref: {c.tracking_token}
                          </div>
                        </td>
                        <td><strong>{c.client_name}</strong>{c.is_sensitive===1&&<span style={{color:'#ef5350',fontSize:'0.65rem',marginLeft:'4px'}}>🔒</span>}</td>
                        <td style={{fontSize:'0.8rem'}}>{c.case_title}</td>
                        <td>{c.case_type}</td>
                        <td>{c.assigned_lawyer}</td>
                        <td>{c.current_milestone==="CLOSED" ? <span className="badge badge--archived">CLOSED</span> : <span className="badge badge--active">Phase {c.current_milestone}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════ CALENDAR TAB ═══════ */}
          {activeTab === 'calendar' && (
            <CalendarTab
              calendar={calendar}
              upcoming48h={upcoming48h}
              setEditingEvent={setEditingEvent}
              setNewEventForm={setNewEventForm}
              setShowAddEventModal={setShowAddEventModal}
              handleDeleteEvent={handleDeleteEvent}
            />
          )}

          {/* ═══════ FINANCE TAB ═══════ */}
          {activeTab === 'finance' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <h3 style={{color:'var(--gold-400)',fontSize:'1rem'}}>💳 Finance — Reference Tracker & Expenses</h3>

              {/* Trust / Payment References */}
              <div style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                  <div>
                    <h4 style={{color:'var(--gold-400)',fontSize:'0.9rem'}}>Case Payment References</h4>
                    <p style={{color:'var(--text-muted)',fontSize:'0.7rem',marginTop:'2px'}}>
                      This is a reference log only. Actual funds are managed offline. We only track payment confirmation codes.
                    </p>
                  </div>
                </div>
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead><tr><th>Client</th><th>Token</th><th>Case</th><th>Payment Status</th><th>Reference Code</th><th>Action</th></tr></thead>
                    <tbody>
                      {cases.filter(c => c.current_milestone !== 'CLOSED').map(c => (
                        <tr key={c.id}>
                          <td>{c.client_name}</td>
                          <td><span style={{fontFamily:'monospace',fontSize:'0.75rem',background:'rgba(255,255,255,0.08)',padding:'2px 6px',borderRadius:'4px'}}>{c.tracking_token}</span></td>
                          <td style={{fontSize:'0.8rem'}}>{c.case_title}</td>
                          <td>
                            <span style={{color:PAYMENT_STATUS_LABELS[c.trust_payment_status||'none']?.color,fontWeight:600,fontSize:'0.8rem'}}>
                              {PAYMENT_STATUS_LABELS[c.trust_payment_status||'none']?.label}
                            </span>
                          </td>
                          <td style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{c.trust_payment_ref||'—'}</td>
                          <td>
                            <button className="action-btn" onClick={() => { setSelectedCase(c.id); setPaymentForm({trust_payment_status:c.trust_payment_status||'none',trust_payment_ref:c.trust_payment_ref||'',total_fee:c.total_fee||'',outstanding_balance:c.outstanding_balance||'',fee_status:c.fee_status||'pending'}); setShowPaymentModal(true); }}>Update</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expense Tracker */}
              <div style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'15px'}}>
                  <div>
                    <h4 style={{color:'var(--gold-400)',fontSize:'0.9rem'}}>Firm Operating Expenses</h4>
                    <p style={{color:'var(--text-muted)',fontSize:'0.7rem',marginTop:'2px'}}>Total expenses for selected filters: <strong style={{color:'var(--gold-400)'}}>KES {totalExpenses.toLocaleString()}</strong></p>
                  </div>
                  
                  {/* Expense filters */}
                  <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
                    <select style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', borderRadius:'4px', padding:'5px 10px', fontSize:'0.8rem'}}
                      value={expenseCaseFilter} onChange={e=>setExpenseCaseFilter(e.target.value)}>
                      <option value="all">All Cases</option>
                      {cases.map(c=><option key={c.id} value={c.id}>{c.client_name} ({c.tracking_token.substring(0,8)})</option>)}
                    </select>
                    <input type="date" style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', borderRadius:'4px', padding:'5px 10px', fontSize:'0.8rem'}}
                      value={expenseStartDate} onChange={e=>setExpenseStartDate(e.target.value)}/>
                    <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>to</span>
                    <input type="date" style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', borderRadius:'4px', padding:'5px 10px', fontSize:'0.8rem'}}
                      value={expenseEndDate} onChange={e=>setExpenseEndDate(e.target.value)}/>
                    <button className="secondary-btn" style={{padding:'4px 8px', fontSize:'0.75rem'}} onClick={()=>{setExpenseCaseFilter('all'); setExpenseStartDate(''); setExpenseEndDate('');}}>Reset</button>
                    <button className="primary-btn" onClick={() => { setNewExpenseForm({amount:'', category:'transport', description:'', recorded_by:'Secretary', case_id:selectedCase||''}); setShowAddExpenseModal(true); }}>+ Log Expense</button>
                  </div>
                </div>
                
                <div className="dash-table-wrapper">
                  <table className="dash-table">
                    <thead><tr><th>Date</th><th>Amount (KES)</th><th>Category</th><th>Linked Case</th><th>Description</th><th>By</th><th></th></tr></thead>
                    <tbody>
                      {expenses.length === 0 && <tr><td colSpan="7" style={{textAlign:'center',padding:'20px',color:'var(--text-secondary)'}}>No expenses match these filters.</td></tr>}
                      {expenses.map(ex => (
                        <tr key={ex.id}>
                          <td>{new Date(ex.created_at).toLocaleDateString()}</td>
                          <td><strong style={{color:'var(--gold-400)'}}>KES {parseFloat(ex.amount).toLocaleString()}</strong></td>
                          <td><span className="badge badge--active">{ex.category}</span></td>
                          <td>{ex.client_name ? <span style={{fontSize:'0.75rem'}}>{ex.client_name}<br/><span style={{color:'var(--text-secondary)', fontSize:'0.65rem'}}>{ex.case_title}</span></span> : 'Office General'}</td>
                          <td style={{fontSize:'0.8rem'}}>{ex.description||'—'}</td>
                          <td style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{ex.recorded_by}</td>
                          <td><button className="action-btn" style={{color:'var(--red-400)'}} onClick={() => handleDeleteExpense(ex.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ DOCUMENTS TAB (DOCUMENT STUDIO) ═══════ */}
          {activeTab === 'documents' && (
            <DocumentStudio 
              cases={cases} 
              leads={leads} 
              activeMatterId={activeMatterId} 
              lawyersList={lawyersList} 
              userDisplayName={userDisplayName} 
            />
          )}

          {/* ═══════ WEEKLY REPORT TAB ═══════ */}
          {activeTab === 'report' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{color:'var(--gold-400)',fontSize:'1rem'}}>📋 Weekly Activity Report</h3>
                <div style={{display:'flex', gap:'10px'}}>
                  <button className="secondary-btn" onClick={handleDownloadWeeklyReport}>📥 Export/Download Text</button>
                  <button className="primary-btn" onClick={handleGenerateWeeklyReport}>↻ Regenerate</button>
                </div>
              </div>
              {!weeklyReport && (
                <div style={{textAlign:'center',padding:'60px',color:'var(--text-secondary)'}}>
                  <p>Click "Weekly Report" in the sidebar or "Regenerate" above to generate this week's summary.</p>
                </div>
              )}
              {weeklyReport && (
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  <p style={{color:'var(--text-muted)',fontSize:'0.75rem'}}>Generated: {new Date(weeklyReport.generated_at).toLocaleString('en-KE')} | Week: {new Date(weeklyReport.week_start).toLocaleDateString()} – {new Date(weeklyReport.week_end).toLocaleDateString()}</p>
                  {Object.keys(weeklyReport.report).length === 0 && <p style={{color:'var(--text-secondary)'}}>No activities logged this week yet.</p>}
                  {Object.entries(weeklyReport.report).map(([lawyer, data]) => (
                    <div key={lawyer} style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                      <h4 style={{color:'var(--gold-400)',marginBottom:'12px',fontSize:'0.95rem'}}>⚖️ {lawyer}</h4>
                      {data.upcoming_events.length > 0 && (
                        <div style={{marginBottom:'10px'}}>
                          <div style={{fontSize:'0.75rem',color:'#ff9800',fontWeight:600,marginBottom:'6px'}}>UPCOMING THIS WEEK</div>
                          {data.upcoming_events.map(ev => (
                            <div key={ev.id} style={{fontSize:'0.8rem',color:'var(--text-primary)',padding:'4px 8px',background:'rgba(255,152,0,0.08)',borderRadius:'4px',marginBottom:'4px'}}>
                              📅 <strong>{ev.event_title}</strong> — {ev.client_name} | {new Date(ev.event_date).toLocaleString('en-KE')}
                            </div>
                          ))}
                        </div>
                      )}
                      {data.activities.length > 0 ? (
                        <div>
                          <div style={{fontSize:'0.75rem',color:'var(--text-secondary)',fontWeight:600,marginBottom:'6px'}}>ACTIVITIES THIS WEEK</div>
                          {data.activities.map(a => (
                            <div key={a.id} style={{fontSize:'0.8rem',padding:'6px 8px',borderLeft:'2px solid var(--gold-600)',marginBottom:'4px'}}>
                              <span className="badge badge--pending" style={{marginRight:'6px',fontSize:'0.65rem'}}>{a.activity_type.replace('_',' ')}</span>
                              {a.description} — <span style={{color:'var(--text-secondary)'}}>{a.case_title} | {new Date(a.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>No activities logged this week.</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ ADMIN TAB ═══════ */}
          {activeTab === 'settings' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:'1rem',color:'var(--gold-400)'}}>🛡️ Admin & Users</h3>
                <div style={{display:'flex', gap:'8px'}}>
                  <button 
                    className="action-btn"
                    style={{backgroundColor:'var(--green-600)', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', fontWeight:'bold', cursor:'pointer'}}
                    onClick={handleDownloadBackup}
                  >
                    📥 Export Backup
                  </button>
                  {session?.role === 'developer' && (
                    <>
                      <button 
                        className="action-btn"
                        style={{backgroundColor:'#0288d1', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', fontWeight:'bold', cursor:'pointer'}}
                        onClick={handleSeedTestData}
                      >
                        🧪 Load Test Data
                      </button>
                      <button 
                        className="action-btn"
                        style={{backgroundColor:'var(--red-500)', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', fontWeight:'bold', cursor:'pointer'}}
                        onClick={handleNukeDatabase}
                      >
                        ⚠️ Nuke & Re-seed Database
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* User management form */}
              <div style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                <h4 style={{marginBottom:'10px',color:'var(--gold-300)'}}>Add / Reset User Account</h4>
                <form onSubmit={handleUserMgmtSubmit} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:'10px'}}>
                  <input placeholder="Username (login)" value={newUserForm.username} onChange={e=>setNewUserForm({...newUserForm,username:e.target.value})} required style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}/>
                  <input placeholder="Display Name" value={newUserForm.display_name} onChange={e=>setNewUserForm({...newUserForm,display_name:e.target.value})} required style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}/>
                  <input type="password" placeholder="Password" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm,password:e.target.value})} required style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}/>
                  <select value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm,role:e.target.value})} style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}>
                    <option value="advocate">Advocate (Read-Only)</option>
                    <option value="secretary">Secretary</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="submit" className="primary-btn">Save User</button>
                </form>
                {userMgmtMsg && <div style={{marginTop:'10px',fontSize:'0.8rem',color:'var(--gold-400)'}}>{userMgmtMsg}</div>}
              </div>

              {/* Firm Advocates Roster management */}
              <div style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                <h4 style={{marginBottom:'10px',color:'var(--gold-300)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>⚖️ Firm Advocates Roster</span>
                  <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{lawyersList.length} Active Advocate{lawyersList.length !== 1 ? 's' : ''}</span>
                </h4>
                {userRole === 'admin' && (
                  <form onSubmit={handleAddLawyer} style={{display:'flex',gap:'10px',marginBottom:'15px'}}>
                    <input 
                      placeholder="Enter Advocate Name (e.g. Ms Ivy)" 
                      value={newLawyerInput} 
                      onChange={e => setNewLawyerInput(e.target.value)} 
                      required 
                      style={{flex:1,background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px 12px',borderRadius:'4px'}}
                    />
                    <button type="submit" className="primary-btn">+ Add Advocate</button>
                  </form>
                )}
                <div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
                  {lawyersList.map(lawyer => (
                    <div key={lawyer} style={{background:'var(--navy-900)',border:'1px solid var(--border-default)',padding:'6px 14px',borderRadius:'20px',display:'flex',alignItems:'center',gap:'8px',fontSize:'0.85rem',color:'white'}}>
                      <span>⚖️ {lawyer}</span>
                      {userRole === 'admin' && lawyersList.length > 1 && (
                        <button type="button" title="Remove Advocate" onClick={() => handleDeleteLawyer(lawyer)} style={{background:'none',border:'none',color:'var(--red-400)',cursor:'pointer',fontSize:'0.8rem',fontWeight:'bold',padding:0,marginLeft:'4px'}}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Users Table */}
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead><tr><th>ID</th><th>Username</th><th>Display Name</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {(Array.isArray(users) ? users : []).map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>{u.display_name}</td>
                        <td><span className={`badge badge--${u.role==='admin'?'active':u.role==='secretary'?'success':'pending'}`}>{u.role}</span></td>
                        <td>
                          {u.id !== session.id ? (
                            <div style={{display:'flex', gap:'8px'}}>
                              <button className="action-btn" style={{color:'var(--gold-400)'}} onClick={() => { const p=prompt('Enter new password for ' + u.username); if(p) handleResetUserPassword(u.id, p); }}>Reset Pass</button>
                              <button className="action-btn" style={{color:'var(--red-400)'}} onClick={() => handleDeleteUser(u.id, u.username)}>Revoke Access</button>
                            </div>
                          ) : (
                            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                              <span style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>You</span>
                              <button className="action-btn" style={{color:'var(--gold-400)'}} onClick={() => setShowProfileModal(true)}>Edit My Profile</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mass CSV Import Section */}
              <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px', marginTop:'16px'}}>
                <h4 style={{marginBottom:'10px', color:'var(--gold-300)'}}>⚖️ Mass Data Onboarding (CSV)</h4>
                <p style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginBottom:'12px'}}>
                  Easily import bulk active cases or court mention dates. Select data type, upload your CSV file, preview the rows, and confirm to load them into the system.
                </p>
                
                <div style={{display:'flex', gap:'15px', alignItems:'center', marginBottom:'15px'}}>
                  <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                    <label style={{fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Import Type</label>
                    <select value={importType} onChange={e => { setImportType(e.target.value); setParsedRows([]); setImportFeedback(''); }} 
                            style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'8px 12px', borderRadius:'4px', fontSize:'0.82rem', minWidth:'180px'}}>
                      <option value="cases">🏛️ Active Cases (Leads)</option>
                      <option value="calendar">📅 Court Schedules</option>
                    </select>
                  </div>
                  
                  <div style={{flex:1, display:'flex', flexDirection:'column', gap:'4px'}}>
                    <label style={{fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Select CSV File</label>
                    <input type="file" accept=".csv" onChange={handleCSVUpload} style={{fontSize:'0.82rem', color:'var(--text-secondary)'}} />
                  </div>
                </div>

                {importFeedback && (
                  <div style={{
                    padding:'10px 14px', 
                    background:'var(--navy-950)', 
                    border:'1px solid var(--border-default)', 
                    borderRadius:'4px', 
                    fontSize:'0.8rem', 
                    color:'var(--gold-400)',
                    marginBottom:'12px'
                  }}>
                    {importFeedback}
                  </div>
                )}

                {parsedRows.length > 0 && (
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <div style={{maxHeight:'200px', overflowY:'auto'}} className="dash-table-wrapper">
                      <table className="dash-table">
                        <thead>
                          <tr>
                            {Object.keys(parsedRows[0]).map((h, i) => <th key={i}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.slice(0, 5).map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((v, i) => <td key={i}>{v}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedRows.length > 5 && (
                      <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Showing first 5 rows of {parsedRows.length} total rows...</span>
                    )}
                    <button className="primary-btn" onClick={handleConfirmImport} style={{alignSelf:'flex-start', marginTop:'5px'}}>
                      🚀 Confirm and Import {parsedRows.length} Records
                    </button>
                  </div>
                )}

                <div style={{marginTop:'12px', fontSize:'0.72rem', color:'var(--text-muted)', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'8px'}}>
                  <strong>Expected CSV Columns:</strong><br/>
                  • Cases: <code>client_name, case_title, case_type, assigned_lawyer, court_station, ref_no, judiciary_case_id, total_fee, outstanding_balance, client_phone</code><br/>
                  • Calendar: <code>event_title, event_type (mention/hearing/ruling), event_date (YYYY-MM-DD HH:MM), notes, assigned_lawyer, case_id (optional)</code>
                </div>
              </div>

            </div>
          )}
          </div>
        )}

        </div>
      </div>

      {/* ═══════ MODALS ═══════ */}

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'400px', width:'95%'}}>
            <h2 className="modal-title">Edit Account Profile</h2>
            <form onSubmit={handleProfileSubmit}>
              <div className="form-grid" style={{gridTemplateColumns:'1fr', gap:'12px'}}>
                <div className="form-group">
                  <label>Display Name</label>
                  <input required value={profileForm.display_name} onChange={e => setProfileForm({...profileForm, display_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input required value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>New Password (leave blank to keep current)</label>
                  <input type="password" placeholder="••••••••" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions" style={{marginTop:'24px'}}>
                <button type="button" className="secondary-btn" onClick={() => setShowProfileModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'1000px', width:'95%', maxHeight:'90vh', overflowY:'auto'}}>
            <h2 className="modal-title">Log New Client Lead (Intake)</h2>
            <form onSubmit={handleNewLeadSubmit}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(450px, 1fr))', gap:'24px'}}>
                {/* COLUMN 1: Client Personal Details */}
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0}}>👤 Client Details</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Full Name *</label><input required value={newLeadForm.full_name} onChange={e => { setNewLeadForm({...newLeadForm, full_name:e.target.value}); setConflictQuery(e.target.value); }}/></div>
                    <div className="form-group"><label>Phone Number *</label><input required value={newLeadForm.phone} onChange={e => { setNewLeadForm({...newLeadForm, phone:e.target.value}); setConflictQuery(prev => prev || e.target.value); }}/></div>
                    <div className="form-group"><label>Email Address</label><input type="email" value={newLeadForm.email} onChange={e => setNewLeadForm({...newLeadForm, email:e.target.value})}/></div>
                    <div className="form-group"><label>Date of Birth</label><input type="date" value={newLeadForm.dob} onChange={e => setNewLeadForm({...newLeadForm, dob:e.target.value})}/></div>
                    <div className="form-group"><label>Alternative Phone(s)</label><input placeholder="Alt phone numbers" value={newLeadForm.alternative_phone} onChange={e => setNewLeadForm({...newLeadForm, alternative_phone:e.target.value})}/></div>
                    <div className="form-group"><label>Alternative Email(s)</label><input placeholder="Alt emails" value={newLeadForm.alternative_email} onChange={e => setNewLeadForm({...newLeadForm, alternative_email:e.target.value})}/></div>
                    <div className="form-group"><label>ID / Passport Number</label><input placeholder="e.g. 12345678" value={newLeadForm.id_number} onChange={e => setNewLeadForm({...newLeadForm, id_number:e.target.value})}/></div>
                    <div className="form-group"><label>KRA PIN</label><input placeholder="e.g. A001234567B" value={newLeadForm.kra_pin} onChange={e => setNewLeadForm({...newLeadForm, kra_pin:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Physical Address</label><input placeholder="Street, Building, Town" value={newLeadForm.address} onChange={e => setNewLeadForm({...newLeadForm, address:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Occupation / Company Name</label><input placeholder="e.g. Business Analyst" value={newLeadForm.occupation} onChange={e => setNewLeadForm({...newLeadForm, occupation:e.target.value})}/></div>
                  </div>
                  
                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0, marginTop:'10px'}}>🚨 Emergency Contact</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Contact Name</label><input value={newLeadForm.emergency_name} onChange={e => setNewLeadForm({...newLeadForm, emergency_name:e.target.value})}/></div>
                    <div className="form-group"><label>Relationship</label><input placeholder="e.g. Spouse" value={newLeadForm.emergency_relation} onChange={e => setNewLeadForm({...newLeadForm, emergency_relation:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Contact Phone</label><input value={newLeadForm.emergency_phone} onChange={e => setNewLeadForm({...newLeadForm, emergency_phone:e.target.value})}/></div>
                  </div>
                </div>

                {/* COLUMN 2: Matter & Context Details */}
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0}}>⚖️ Legal Matter Details</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Service Category</label><select value={newLeadForm.service_category} onChange={e => setNewLeadForm({...newLeadForm, service_category:e.target.value})}><option>Civil Disputes</option><option>Conveyancing & Land</option><option>Corporate Law</option><option>Family Law</option><option>Criminal Defense</option><option>Employment Law</option><option>Succession</option><option>Intellectual Property</option></select></div>
                    <div className="form-group"><label>Source</label><select value={newLeadForm.source} onChange={e => setNewLeadForm({...newLeadForm, source:e.target.value})}><option value="walk_in">Walk In</option><option value="phone_call">Phone Call</option><option value="referral">Referral</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></div>
                    <div className="form-group"><label>Opposing Party Name</label><input placeholder="Opposing party name" value={newLeadForm.opposing_party} onChange={e => { setNewLeadForm({...newLeadForm, opposing_party:e.target.value}); setConflictQuery(e.target.value || newLeadForm.full_name); }}/></div>
                    <div className="form-group"><label>Opposing Party Contact</label><input placeholder="Phone / Email, if known" value={newLeadForm.opposing_party_contact} onChange={e => setNewLeadForm({...newLeadForm, opposing_party_contact:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Billing Arrangement</label><select value={newLeadForm.billing_type} onChange={e => setNewLeadForm({...newLeadForm, billing_type:e.target.value})}><option value="flat">Flat Fee Remuneration</option><option value="hourly">Hourly Rate</option><option value="contingency">Contingency / Success Fee</option></select></div>
                  </div>

                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0, marginTop:'10px'}}>💼 Opposing Counsel & Court Info</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Opposing Advocate Name</label><input placeholder="e.g. John Doe, Esq" value={newLeadForm.opposing_counsel_name} onChange={e => setNewLeadForm({...newLeadForm, opposing_counsel_name:e.target.value})}/></div>
                    <div className="form-group"><label>Opposing Law Firm</label><input placeholder="e.g. Doe & Partners" value={newLeadForm.opposing_counsel_firm} onChange={e => setNewLeadForm({...newLeadForm, opposing_counsel_firm:e.target.value})}/></div>
                    <div className="form-group"><label>Counsel Phone</label><input value={newLeadForm.opposing_counsel_phone} onChange={e => setNewLeadForm({...newLeadForm, opposing_counsel_phone:e.target.value})}/></div>
                    <div className="form-group"><label>Counsel Email</label><input value={newLeadForm.opposing_counsel_email} onChange={e => setNewLeadForm({...newLeadForm, opposing_counsel_email:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Counsel Address</label><input placeholder="Address" value={newLeadForm.opposing_counsel_address} onChange={e => setNewLeadForm({...newLeadForm, opposing_counsel_address:e.target.value})}/></div>
                    <div className="form-group"><label>Assigned Judge / Magistrate</label><input placeholder="e.g. Judge Mutungi" value={newLeadForm.assigned_judge} onChange={e => setNewLeadForm({...newLeadForm, assigned_judge:e.target.value})}/></div>
                    <div className="form-group"><label>Court Division</label><input placeholder="e.g. Commercial Division" value={newLeadForm.court_division} onChange={e => setNewLeadForm({...newLeadForm, court_division:e.target.value})}/></div>
                  </div>
                  
                  <div className="form-group"><label>Intake Details & Dispute Description *</label><textarea rows="3" required placeholder="Describe the dispute or requested services..." value={newLeadForm.message} onChange={e => setNewLeadForm({...newLeadForm, message:e.target.value})}/></div>
                  <div className="form-group"><label>Custom KYC Details / Company Registration Info</label><textarea rows="2" placeholder="e.g., KRA Pin certificates or business records checked" value={newLeadForm.custom_kyc} onChange={e => setNewLeadForm({...newLeadForm, custom_kyc:e.target.value})}/></div>
                </div>
              </div>

              <ConflictBanner />
              <div style={{marginTop:'15px', borderTop:'1px solid var(--border-default)', paddingTop:'15px', display:'flex', flexDirection:'column', gap:'8px'}}>
                <label className="checkbox-label" style={{color:'var(--red-400)'}}><input type="checkbox" checked={newLeadForm.is_emergency} onChange={e => setNewLeadForm({...newLeadForm, is_emergency:e.target.checked})}/> URGENT EMERGENCY (Bail, Injunction, Arrest) — Notify Partner Immediately</label>
                <label className="checkbox-label"><input type="checkbox" checked={newLeadForm.conflict_checked} onChange={e => setNewLeadForm({...newLeadForm, conflict_checked:e.target.checked})}/> I have reviewed the conflict check results above and confirmed no conflict of interest exists.</label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => { setShowNewLeadModal(false); setConflictResults([]); setConflictQuery(''); }}>Cancel</button>
                <button type="submit" className="primary-btn">Save Client Intake</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Direct Case Modal */}
      {showNewCaseModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'1000px', width:'95%', maxHeight:'90vh', overflowY:'auto'}}>
            <h2 className="modal-title">Direct Client & Case Registration</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'15px'}}>Bypass the lead CRM pipeline and immediately register an active signed case with tracking reference.</p>
            <form onSubmit={handleNewCaseSubmit}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(450px, 1fr))', gap:'24px'}}>
                {/* COLUMN 1: Client Personal Details */}
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0}}>👤 Client Details</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Client Full Name *</label><input required value={newCaseForm.client_name} onChange={e => { setNewCaseForm({...newCaseForm, client_name:e.target.value}); setConflictQuery(e.target.value); }}/></div>
                    <div className="form-group"><label>Phone Number *</label><input required value={newCaseForm.client_phone} onChange={e => setNewCaseForm({...newCaseForm, client_phone:e.target.value})}/></div>
                    <div className="form-group"><label>Email Address</label><input type="email" value={newCaseForm.client_email} onChange={e => setNewCaseForm({...newCaseForm, client_email:e.target.value})}/></div>
                    <div className="form-group"><label>Date of Birth</label><input type="date" value={newCaseForm.dob} onChange={e => setNewCaseForm({...newCaseForm, dob:e.target.value})}/></div>
                    <div className="form-group"><label>Alternative Phone(s)</label><input placeholder="Alt phone numbers" value={newCaseForm.alternative_phone} onChange={e => setNewCaseForm({...newCaseForm, alternative_phone:e.target.value})}/></div>
                    <div className="form-group"><label>Alternative Email(s)</label><input placeholder="Alt emails" value={newCaseForm.alternative_email} onChange={e => setNewCaseForm({...newCaseForm, alternative_email:e.target.value})}/></div>
                    <div className="form-group"><label>ID / Passport Number</label><input placeholder="e.g. 12345678" value={newCaseForm.id_number} onChange={e => setNewCaseForm({...newCaseForm, id_number:e.target.value})}/></div>
                    <div className="form-group"><label>KRA PIN</label><input placeholder="e.g. A001234567B" value={newCaseForm.kra_pin} onChange={e => setNewCaseForm({...newCaseForm, kra_pin:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Physical Address</label><input placeholder="Street, Building, Town" value={newCaseForm.address} onChange={e => setNewCaseForm({...newCaseForm, address:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Occupation / Company Name</label><input placeholder="e.g. Developer" value={newCaseForm.occupation} onChange={e => setNewCaseForm({...newCaseForm, occupation:e.target.value})}/></div>
                  </div>
                  
                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0, marginTop:'10px'}}>🚨 Emergency Contact</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Contact Name</label><input value={newCaseForm.emergency_name} onChange={e => setNewCaseForm({...newCaseForm, emergency_name:e.target.value})}/></div>
                    <div className="form-group"><label>Relationship</label><input placeholder="e.g. Parent" value={newCaseForm.emergency_relation} onChange={e => setNewCaseForm({...newCaseForm, emergency_relation:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Contact Phone</label><input value={newCaseForm.emergency_phone} onChange={e => setNewCaseForm({...newCaseForm, emergency_phone:e.target.value})}/></div>
                  </div>
                </div>

                {/* COLUMN 2: Matter & Court Details */}
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0}}>⚖️ Legal Case Details</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Official Case Title *</label><input required placeholder="e.g. Land dispute over plot 54 - Mombasa" value={newCaseForm.case_title} onChange={e => setNewCaseForm({...newCaseForm, case_title:e.target.value})}/></div>
                    <div className="form-group"><label>Service Category</label><select value={newCaseForm.case_type} onChange={e => setNewCaseForm({...newCaseForm, case_type:e.target.value})}><option>Civil Disputes</option><option>Conveyancing & Land</option><option>Corporate Law</option><option>Family Law</option><option>Criminal Defense</option><option>Employment Law</option><option>Succession</option><option>Litigation</option></select></div>
                    <div className="form-group"><label>Assign to Lawyer</label><select value={newCaseForm.assigned_lawyer} onChange={e => setNewCaseForm({...newCaseForm, assigned_lawyer:e.target.value})}>{lawyersList.map(l => <option key={l}>{l}</option>)}</select></div>
                    <div className="form-group"><label>Opposing Party Name</label><input placeholder="Opposing party" value={newCaseForm.opposing_party} onChange={e => { setNewCaseForm({...newCaseForm, opposing_party:e.target.value}); setConflictQuery(e.target.value || newCaseForm.client_name); }}/></div>
                    <div className="form-group"><label>Opposing Party Contact</label><input placeholder="Phone / Email, if known" value={newCaseForm.opposing_party_contact} onChange={e => setNewCaseForm({...newCaseForm, opposing_party_contact:e.target.value})}/></div>
                    <div className="form-group"><label>Internal Ref Number (Ref No)</label><input placeholder="e.g. SOA/2026/001" value={newCaseForm.ref_no} onChange={e => setNewCaseForm({...newCaseForm, ref_no:e.target.value})}/></div>
                    <div className="form-group"><label>Court Station (if filed)</label><input placeholder="e.g. Milimani High Court" value={newCaseForm.court_station} onChange={e => setNewCaseForm({...newCaseForm, court_station:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Billing Arrangement</label><select value={newCaseForm.billing_type} onChange={e => setNewCaseForm({...newCaseForm, billing_type:e.target.value})}><option value="flat">Flat Fee Remuneration</option><option value="hourly">Hourly Rate</option><option value="contingency">Contingency / Success Fee</option></select></div>
                  </div>

                  <h3 style={{color:'var(--gold-400)', fontSize:'0.9rem', borderBottom:'1px solid var(--border-default)', paddingBottom:'6px', margin:0, marginTop:'10px'}}>💼 Opposing Counsel & Court Info</h3>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                    <div className="form-group"><label>Opposing Advocate Name</label><input placeholder="e.g. John Doe, Esq" value={newCaseForm.opposing_counsel_name} onChange={e => setNewCaseForm({...newCaseForm, opposing_counsel_name:e.target.value})}/></div>
                    <div className="form-group"><label>Opposing Law Firm</label><input placeholder="e.g. Doe & Partners" value={newCaseForm.opposing_counsel_firm} onChange={e => setNewCaseForm({...newCaseForm, opposing_counsel_firm:e.target.value})}/></div>
                    <div className="form-group"><label>Counsel Phone</label><input value={newCaseForm.opposing_counsel_phone} onChange={e => setNewCaseForm({...newCaseForm, opposing_counsel_phone:e.target.value})}/></div>
                    <div className="form-group"><label>Counsel Email</label><input value={newCaseForm.opposing_counsel_email} onChange={e => setNewCaseForm({...newCaseForm, opposing_counsel_email:e.target.value})}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label>Counsel Address</label><input placeholder="Address" value={newCaseForm.opposing_counsel_address} onChange={e => setNewCaseForm({...newCaseForm, opposing_counsel_address:e.target.value})}/></div>
                    <div className="form-group"><label>Assigned Judge / Magistrate</label><input placeholder="e.g. Judge Mutungi" value={newCaseForm.assigned_judge} onChange={e => setNewCaseForm({...newCaseForm, assigned_judge:e.target.value})}/></div>
                    <div className="form-group"><label>Court Division</label><input placeholder="e.g. Commercial Division" value={newCaseForm.court_division} onChange={e => setNewCaseForm({...newCaseForm, court_division:e.target.value})}/></div>
                  </div>

                  <div className="form-group" style={{marginTop:'10px'}}><label>Case Facts Brief & Strategy Notes</label><textarea rows="2" placeholder="Describe case facts, pleadings strategy..." value={newCaseForm.case_brief} onChange={e => setNewCaseForm({...newCaseForm, case_brief:e.target.value})}/></div>
                  
                  <div className="form-group" style={{marginTop:'5px'}}><label>Tracking Reference Token (Initials/Count/Year)</label><input placeholder="e.g. WSO/1/26 (Auto-generated if blank)" value={newCaseForm.tracking_token} onChange={e => setNewCaseForm({...newCaseForm, tracking_token:e.target.value})}/></div>
                  <div className="form-group"><label>Custom KYC Notes</label><textarea rows="2" placeholder="e.g. Identity verified via passport database" value={newCaseForm.custom_kyc} onChange={e => setNewCaseForm({...newCaseForm, custom_kyc:e.target.value})}/></div>
                  <div className="form-group"><label className="checkbox-label" style={{marginTop:'8px'}}><input type="checkbox" checked={newCaseForm.is_sensitive} onChange={e => setNewCaseForm({...newCaseForm, is_sensitive:e.target.checked})}/> 🔒 Mark as Highly Sensitive Case (Extreme privacy over WhatsApp)</label></div>
                </div>
              </div>

              <ConflictBanner />
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => { setShowNewCaseModal(false); setConflictResults([]); setConflictQuery(''); }}>Cancel</button>
                <button type="submit" className="primary-btn">Generate Case & Token</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Installment Payment Modal */}
      {showAddPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'500px'}}>
            <h2 className="modal-title">Log Installment Payment / Deposit</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'15px'}}>
              Record a payment. Trust deposits remain unearned client money. Operating payments go directly to firm revenue.
            </p>
            <div className="form-group" style={{marginBottom:'10px'}}>
              <label>Account Destination</label>
              <select value={newPaymentForm.destination} onChange={e => setNewPaymentForm({...newPaymentForm, destination: e.target.value, invoice_id: ''})}>
                <option value="operating">Operating Account (Earned Fee / Invoice Payment)</option>
                <option value="trust">Client Trust Account (Escrow Deposit)</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom:'10px'}}>
              <label>Amount (KES)</label>
              <input type="number" placeholder="Amount (KES)" 
                value={newPaymentForm.amount} onChange={e => setNewPaymentForm({...newPaymentForm, amount: e.target.value})} />
            </div>
            {newPaymentForm.destination === 'operating' && caseInvoices.length > 0 && (
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Apply to Invoice (Optional)</label>
                <select value={newPaymentForm.invoice_id} onChange={e => setNewPaymentForm({...newPaymentForm, invoice_id: e.target.value})}>
                  <option value="">Direct Payment (No Invoice)</option>
                  {caseInvoices.filter(i => i.status !== 'paid').map(i => (
                    <option key={i.id} value={i.invoice_number}>{i.invoice_number} (KES {i.amount.toLocaleString()})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{marginBottom:'10px'}}>
              <label>Payment Method</label>
              <select value={newPaymentForm.payment_method} onChange={e => setNewPaymentForm({...newPaymentForm, payment_method: e.target.value})}>
                <option value="MPESA">M-PESA</option>
                <option value="RTGS">RTGS / Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom:'10px'}}>
              <label>Payment Reference</label>
              <input type="text" placeholder="e.g., QJK0A1B2C3" 
                value={newPaymentForm.payment_ref} onChange={e => setNewPaymentForm({...newPaymentForm, payment_ref: e.target.value})} />
            </div>
            <div className="form-group" style={{marginBottom:'15px'}}>
              <label>Optional Notes</label>
              <textarea placeholder="Any additional details" rows="2"
                value={newPaymentForm.notes} onChange={e => setNewPaymentForm({...newPaymentForm, notes: e.target.value})} />
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button className="primary-btn" style={{flex:1}} onClick={handleAddPaymentSubmit}>Save Payment</button>
              <button className="secondary-btn" style={{flex:1}} onClick={() => setShowAddPaymentModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Submission Modal */}
      {showAddSubmissionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'550px'}}>
            <h2 className="modal-title">Schedule Court Submission / Pleading</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'15px'}}>
              Set submission deadlines for skeleton arguments, authority lists, and reply affidavits. Deadlines automatically sync to the firm calendar.
            </p>
            <form onSubmit={handleAddSubmissionSubmit}>
              <div className="form-group" style={{marginBottom:'12px'}}>
                <label>Submission Title / Description *</label>
                <input required placeholder="e.g. Appellant's Skeleton Arguments & List of Authorities"
                  value={newSubmissionForm.title} onChange={e => setNewSubmissionForm({...newSubmissionForm, title: e.target.value})} />
              </div>
              <div className="form-group" style={{marginBottom:'12px'}}>
                <label>Submission Type</label>
                <select value={newSubmissionForm.submission_type} onChange={e => setNewSubmissionForm({...newSubmissionForm, submission_type: e.target.value})}>
                  <option value="written_submissions">Written Submissions</option>
                  <option value="skeleton_argument">Skeleton Argument</option>
                  <option value="authority_list">List of Authorities</option>
                  <option value="pleading">Pleading / Plaint / Motion</option>
                  <option value="reply_affidavit">Reply Affidavit / Replying Affidavit</option>
                </select>
              </div>
              <div className="form-group" style={{marginBottom:'12px'}}>
                <label>Filing & Service Deadline</label>
                <input type="datetime-local" value={newSubmissionForm.due_date} onChange={e => setNewSubmissionForm({...newSubmissionForm, due_date: e.target.value})} />
              </div>
              <div className="form-group" style={{marginBottom:'12px'}}>
                <label>Assigned Advocate</label>
                <select value={newSubmissionForm.assigned_lawyer} onChange={e => setNewSubmissionForm({...newSubmissionForm, assigned_lawyer: e.target.value})}>
                  {lawyersList.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group" style={{marginBottom:'15px'}}>
                <label>Notes / Directions</label>
                <textarea rows="2" placeholder="e.g. 14 days granted by Court at mention on 20th July"
                  value={newSubmissionForm.notes} onChange={e => setNewSubmissionForm({...newSubmissionForm, notes: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowAddSubmissionModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save & Sync to Calendar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Milestones Modal */}
      {showEditMilestoneModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Edit Case Milestones</h2>
            <p style={{color:'var(--text-secondary)',fontSize:'0.85rem',marginBottom:'15px'}}>Customize workflow steps for <strong>{currentCase?.case_title}</strong>.</p>
            <form onSubmit={handleEditMilestonesSubmit}>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',maxHeight:'300px',overflowY:'auto'}}>
                {editableMilestones.map((m, idx) => (
                  <div key={idx} style={{display:'flex',gap:'10px'}}>
                    <span style={{color:'var(--gold-400)',width:'20px',paddingTop:'8px'}}>{idx+1}.</span>
                    <input type="text" style={{flex:1,background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px 12px',borderRadius:'4px'}} value={m} onChange={e => { const n=[...editableMilestones]; n[idx]=e.target.value; setEditableMilestones(n); }}/>
                    <button type="button" className="secondary-btn" style={{color:'var(--red-400)',borderColor:'var(--red-400)',padding:'4px 8px'}} onClick={() => setEditableMilestones(editableMilestones.filter((_,i) => i!==idx))}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="action-btn" style={{marginTop:'15px'}} onClick={() => setEditableMilestones([...editableMilestones,"New Step"])}>+ Add Step</button>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowEditMilestoneModal(false)}>Cancel</button><button type="submit" className="primary-btn">Save Milestones</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Lead Modal */}
      {selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Manage Lead: {selectedLead.full_name}</h2>
            <form onSubmit={handleLeadActionSubmit}>
              <div className="form-group"><label>Assign to Lawyer</label><select value={leadActionForm.assigned_lawyer} onChange={e => setLeadActionForm({...leadActionForm, assigned_lawyer:e.target.value})}>{lawyersList.map(l => <option key={l}>{l}</option>)}</select></div>
              {!leadActionForm.convert_to_case && (
                <div className="form-grid" style={{marginTop:'15px',borderTop:'1px solid var(--border-default)',paddingTop:'15px'}}>
                  <div className="form-group"><label>Schedule Consultation</label><input type="datetime-local" value={leadActionForm.consultation_date} onChange={e => setLeadActionForm({...leadActionForm, consultation_date:e.target.value})}/></div>
                  <div className="form-group" style={{display:'flex',alignItems:'flex-end'}}><label className="checkbox-label"><input type="checkbox" checked={leadActionForm.consultation_paid} onChange={e => setLeadActionForm({...leadActionForm, consultation_paid:e.target.checked})}/> Interim Fee / Deposit Paid</label></div>
                </div>
              )}
              <div style={{marginTop:'20px',background:'rgba(201,168,76,0.1)',padding:'15px',borderRadius:'8px'}}>
                <label className="checkbox-label" style={{fontWeight:'bold',color:'var(--gold-400)'}}><input type="checkbox" checked={leadActionForm.convert_to_case} onChange={e => setLeadActionForm({...leadActionForm, convert_to_case:e.target.checked})}/> CONVERT TO ACTIVE CASE (Generates Tracker ID)</label>
                {leadActionForm.convert_to_case && (
                  <>
                    <div className="form-group" style={{marginTop:'10px'}}><label>Official Case Title</label><input required value={leadActionForm.case_title} onChange={e => setLeadActionForm({...leadActionForm, case_title:e.target.value})}/></div>
                    <div className="form-group" style={{marginTop:'10px'}}><label>Case Reference Token</label><input required value={leadActionForm.tracking_token} onChange={e => setLeadActionForm({...leadActionForm, tracking_token:e.target.value})}/></div>
                  </>
                )}
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setSelectedLead(null)}>Cancel</button><button type="submit" className="primary-btn">{leadActionForm.convert_to_case?"Convert to Case":"Save Changes"}</button></div>
              <div style={{marginTop:'20px',display:'flex',gap:'10px',borderTop:'1px solid var(--border-default)',paddingTop:'15px'}}>
                <button type="button" className="secondary-btn" style={{color:'#ff9800',borderColor:'#ff9800'}} onClick={() => { if(window.confirm('Mark as NO SHOW?')) updateLeadStatus('no_show'); }}>Mark No-Show</button>
                <button type="button" className="secondary-btn" style={{color:'var(--red-400)',borderColor:'var(--red-400)'}} onClick={() => { if(window.confirm('Archive this lead?')) updateLeadStatus('archived'); }}>Archive Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Court Event Modal */}
      {showAddEventModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'680px'}}>
            <h2 className="modal-title">{editingEvent ? 'Edit Appointment' : 'Add Calendar Appointment'}</h2>
            <form onSubmit={handleAddEvent}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Linked Case (Optional)</label>
                  <select value={newEventForm.case_id} disabled={!!editingEvent} onChange={e => setNewEventForm({...newEventForm, case_id:e.target.value})}>
                    <option value="">General Appointment / Consultation (No Case Link)</option>
                    {cases.filter(c => c.current_milestone !== 'CLOSED' || c.id === newEventForm.case_id).map(c => <option key={c.id} value={c.id}>{c.client_name} — {c.case_title}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Event Type</label><select value={newEventForm.event_type} onChange={e => setNewEventForm({...newEventForm, event_type:e.target.value})}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Event Title *</label><input required placeholder="e.g. Consultation - Jane Kamau" value={newEventForm.event_title} onChange={e => setNewEventForm({...newEventForm, event_title:e.target.value})}/></div>
                <div className="form-group"><label>Date & Time *</label><input type="datetime-local" required value={newEventForm.event_date} onChange={e => setNewEventForm({...newEventForm, event_date:e.target.value})}/></div>
                <div className="form-group"><label>Notes / Venue</label><input placeholder="e.g. Milimani Court / Office Meeting Room 2" value={newEventForm.notes} onChange={e => setNewEventForm({...newEventForm, notes:e.target.value})}/></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => { setShowAddEventModal(false); setEditingEvent(null); }}>Cancel</button>
                <button type="submit" className="primary-btn">{editingEvent ? 'Save Changes' : 'Save Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Log Firm Expense</h2>
            <form onSubmit={handleAddExpense}>
              <div className="form-grid">
                <div className="form-group"><label>Amount (KES) *</label><input type="number" required min="1" value={newExpenseForm.amount} onChange={e => setNewExpenseForm({...newExpenseForm, amount:e.target.value})}/></div>
                <div className="form-group"><label>Category</label><select value={newExpenseForm.category} onChange={e => setNewExpenseForm({...newExpenseForm, category:e.target.value})}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Link to Case (Optional)</label><select value={newExpenseForm.case_id} onChange={e=>setNewExpenseForm({...newExpenseForm, case_id:e.target.value})}><option value="">Office General (No Case Link)</option>{cases.map(c=><option key={c.id} value={c.id}>{c.client_name} ({c.tracking_token})</option>)}</select></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Description</label><input placeholder="e.g. Taxi to Milimani Court" value={newExpenseForm.description} onChange={e => setNewExpenseForm({...newExpenseForm, description:e.target.value})}/></div>
                <div className="form-group"><label>Recorded By</label><select value={newExpenseForm.recorded_by} onChange={e => setNewExpenseForm({...newExpenseForm, recorded_by:e.target.value})}><option>Secretary</option>{lawyersList.map(l => <option key={l}>{l}</option>)}</select></div>
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowAddExpenseModal(false)}>Cancel</button><button type="submit" className="primary-btn">Save Expense</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Reference Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Update Payment Reference</h2>
            <p style={{color:'var(--text-secondary)',fontSize:'0.8rem',marginBottom:'16px',lineHeight:'1.6'}}>
              Think of this like a sticky note. We are only writing down <em>confirmation</em> that the client paid and their receipt code — not moving any real money. The actual cash stays in the firm's bank account.
            </p>
            <form onSubmit={handlePaymentUpdate}>
              <div className="form-grid">
                <div className="form-group"><label>Payment Status</label><select value={paymentForm.trust_payment_status} onChange={e => setPaymentForm({...paymentForm, trust_payment_status:e.target.value})}><option value="none">No Payment Logged</option><option value="pending">Payment Pending</option><option value="paid">Confirmed Paid</option></select></div>
                <div className="form-group">
                  <label>Trust / Escrow Payment Reference(s)</label>
                  <input placeholder="e.g. CHEQUE-9923, RTGS-011" value={paymentForm.trust_payment_ref} onChange={e => setPaymentForm({...paymentForm, trust_payment_ref:e.target.value})}/>
                  <small style={{color:'var(--text-muted)'}}>Add or update references. Separate multiple references with commas.</small>
                </div>
                <div className="form-group"><label>Total Agreed Fee (KES)</label><input type="number" placeholder="e.g. 150000" value={paymentForm.total_fee} onChange={e => setPaymentForm({...paymentForm, total_fee:e.target.value})}/></div>
                <div className="form-group"><label>Outstanding Balance (KES)</label><input type="number" placeholder="e.g. 100000" value={paymentForm.outstanding_balance} onChange={e => setPaymentForm({...paymentForm, outstanding_balance:e.target.value})}/></div>
                <div className="form-group"><label>Fee Status (Internal)</label><select value={paymentForm.fee_status} onChange={e => setPaymentForm({...paymentForm, fee_status:e.target.value})}><option value="pending">Pending</option><option value="paid">Paid</option><option value="pro_bono">Pro Bono</option></select></div>
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowPaymentModal(false)}>Cancel</button><button type="submit" className="primary-btn">Save Reference</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Case Fee Modal */}
      {showEditFeeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Edit Case Fee</h2>
            <p style={{color:'var(--text-secondary)',fontSize:'0.85rem',marginBottom:'16px'}}>
              Update the total agreed fee and internal fee status for this matter. The outstanding balance is automatically calculated from logged installments.
            </p>
            <form onSubmit={handleEditFeeSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Total Agreed Fee (KES)</label>
                  <input type="number" placeholder="e.g. 150000" value={editFeeForm.total_fee} onChange={e => setEditFeeForm({...editFeeForm, total_fee:e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Fee Status</label>
                  <select value={editFeeForm.fee_status} onChange={e => setEditFeeForm({...editFeeForm, fee_status:e.target.value})}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="pro_bono">Pro Bono</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowEditFeeModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Judiciary IDs Modal */}
      {/* Mobile Menu Drawer Modal */}
      {showMobileDrawer && (
        <div className="modal-overlay" onClick={() => setShowMobileDrawer(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{background:'var(--navy-900)', borderTop:'2px solid var(--gold-500)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', borderBottom:'1px solid var(--border-default)', paddingBottom:'10px'}}>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <img src={avatarSrc || logoImg} alt="Avatar" style={{width:'40px', height:'40px', borderRadius:'50%', border:'2px solid var(--gold-500)', objectFit:'cover'}} />
                <div>
                  <div style={{fontWeight:700, fontSize:'0.95rem', color:'white'}}>{userDisplayName}</div>
                  <div style={{fontSize:'0.75rem', color:'var(--gold-400)'}}>@{session?.username} • {userRole?.toUpperCase()}</div>
                </div>
              </div>
              <button className="secondary-btn" onClick={() => setShowMobileDrawer(false)} style={{padding:'4px 10px'}}>✕ Close</button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'15px'}}>
              {[
                { id:'home', icon:'🏛️', label:"Today's Cause List" },
                { id:'matters', icon:'⚖️', label:'Active Matters' },
                { id:'leads', icon:'📥', label:'CRM Inbox' },
                { id:'archives', icon:'🏛️', label:'Archives Vault' },
                { id:'calendar', icon:'📅', label:'Firm Calendar' },
                ...(userRole !== 'advocate' ? [{ id:'finance', icon:'💰', label:'Firm Finance' }] : []),
                { id:'documents', icon:'📄', label:'Document Studio' },
                { id:'report', icon:'📋', label:'Weekly Report' },
                ...(userRole === 'admin' || userRole === 'developer' ? [{ id:'settings', icon:'🛡️', label:'Admin & Users' }] : [])
              ].map(item => (
                <button
                  key={item.id}
                  className="secondary-btn"
                  onClick={() => {
                    setActiveTab(item.id);
                    setActiveMatterId(null);
                    setShowMobileDrawer(false);
                    if (item.id === 'settings') fetchUsers();
                  }}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:'8px',
                    padding:'12px 14px',
                    borderRadius:'8px',
                    fontSize:'0.82rem',
                    textAlign:'left',
                    background: activeTab === item.id ? 'rgba(201,168,76,0.15)' : 'var(--navy-800)',
                    borderColor: activeTab === item.id ? 'var(--gold-500)' : 'var(--border-default)',
                    color: activeTab === item.id ? 'var(--gold-300)' : 'white'
                  }}
                >
                  <span style={{fontSize:'1.1rem'}}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div style={{display:'flex', justifyContent:'space-between', gap:'10px', borderTop:'1px solid var(--border-default)', paddingTop:'12px'}}>
              <button className="secondary-btn" onClick={() => { setShowMobileDrawer(false); setShowProfileModal(true); }} style={{flex:1, fontSize:'0.8rem'}}>⚙️ Edit Profile</button>
              <button className="secondary-btn" onClick={() => { setShowMobileDrawer(false); handleLogout(); }} style={{borderColor:'var(--red-500)', color:'var(--red-400)', fontSize:'0.8rem'}}>🚪 Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {showJudiciaryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">⚖️ Judiciary E-Filing References</h2>
            <p style={{color:'var(--text-secondary)',fontSize:'0.8rem',marginBottom:'16px'}}>
              Log the official Judiciary Case ID and Filing Token from <a href="https://efiling.court.go.ke" target="_blank" rel="noreferrer" style={{color:'var(--gold-400)'}}>efiling.court.go.ke</a> to link this matter to the official court system.
            </p>
            <form onSubmit={handleJudiciaryUpdate}>
              <div className="form-grid">
                <div className="form-group"><label>Judiciary Case ID</label><input placeholder="e.g. ELC/001/2026" value={judiciaryForm.judiciary_case_id} onChange={e => setJudiciaryForm({...judiciaryForm, judiciary_case_id:e.target.value})}/></div>
                <div className="form-group"><label>Court Station / Venue</label><input placeholder="e.g. Milimani Commercial Court" value={judiciaryForm.court_station} onChange={e => setJudiciaryForm({...judiciaryForm, court_station:e.target.value})}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Filing Token / Receipt</label><input placeholder="e.g. JCC-2026-ABCDE" value={judiciaryForm.judiciary_filing_token} onChange={e => setJudiciaryForm({...judiciaryForm, judiciary_filing_token:e.target.value})}/></div>
              </div>
              <div style={{marginTop:'12px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {currentCase && <>
                  <button type="button" className="secondary-btn" style={{fontSize:'0.75rem'}} onClick={() => copyToClipboard(currentCase.client_name)}>📋 Copy Client Name</button>
                  <button type="button" className="secondary-btn" style={{fontSize:'0.75rem'}} onClick={() => copyToClipboard(currentCase.case_title)}>📋 Copy Case Title</button>
                  <button type="button" className="secondary-btn" style={{fontSize:'0.75rem'}} onClick={() => copyToClipboard(currentCase.tracking_token)}>📋 Copy Reference</button>
                  <a href="https://efiling.court.go.ke" target="_blank" rel="noreferrer" className="secondary-btn" style={{fontSize:'0.75rem',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px'}}>🔗 Open E-Filing Portal</a>
                </>}
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowJudiciaryModal(false)}>Cancel</button><button type="submit" className="primary-btn">Save IDs</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Disbursement Modal */}
      {showAddDisbursementModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'500px'}}>
            <h2 className="modal-title">Log Case Disbursement</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'15px'}}>
              Log a case-specific cost (e.g. filing fees, search charges, process servers) paid on behalf of the client.
            </p>
            <form onSubmit={handleAddDisbursementSubmit}>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Amount (KES) *</label>
                <input type="number" required min="1" value={newDisbursementForm.amount} onChange={e => setNewDisbursementForm({...newDisbursementForm, amount:e.target.value})} />
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Description *</label>
                <input type="text" placeholder="e.g. Court filing fees Milimani" value={newDisbursementForm.description} onChange={e => setNewDisbursementForm({...newDisbursementForm, description:e.target.value})} required />
              </div>
              <div className="form-group" style={{marginBottom:'15px'}}>
                <label>Payment Method</label>
                <select value={newDisbursementForm.payment_method} onChange={e => setNewDisbursementForm({...newDisbursementForm, payment_method:e.target.value})}>
                  <option value="M-PESA">M-PESA</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowAddDisbursementModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save Disbursement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showGenerateInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'600px'}}>
            <h2 className="modal-title">Generate Client Invoice</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'15px'}}>
              Create an invoice for the client. You can select unbilled disbursements to roll them automatically into this bill.
            </p>
            <form onSubmit={handleGenerateInvoiceSubmit}>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Invoice Number *</label>
                <input type="text" required value={newInvoiceForm.invoice_number} onChange={e => setNewInvoiceForm({...newInvoiceForm, invoice_number:e.target.value})} />
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Invoice Total Amount (KES) *</label>
                <input type="number" required min="1" value={newInvoiceForm.amount} onChange={e => setNewInvoiceForm({...newInvoiceForm, amount:e.target.value})} />
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Due Date</label>
                <input type="date" value={newInvoiceForm.due_date} onChange={e => setNewInvoiceForm({...newInvoiceForm, due_date:e.target.value})} />
              </div>
              
              {caseDisbursements.filter(d => d.status === 'unbilled').length > 0 && (
                <div className="form-group" style={{marginBottom:'15px'}}>
                  <label style={{display:'block', marginBottom:'5px'}}>Include Unbilled Disbursements</label>
                  <div style={{maxHeight:'120px', overflowY:'auto', background:'var(--navy-950)', border:'1px solid var(--border-default)', borderRadius:'6px', padding:'10px'}}>
                    {caseDisbursements.filter(d => d.status === 'unbilled').map(d => (
                      <label key={d.id} style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'4px'}}>
                        <input type="checkbox" checked={newInvoiceForm.selectedDisbursements.includes(d.id)} onChange={e => {
                          const checked = e.target.checked;
                          let selected = [...newInvoiceForm.selectedDisbursements];
                          if (checked) {
                            selected.push(d.id);
                            const newAmt = Number(newInvoiceForm.amount || 0) + d.amount;
                            setNewInvoiceForm({...newInvoiceForm, selectedDisbursements: selected, amount: newAmt});
                          } else {
                            selected = selected.filter(id => id !== d.id);
                            const newAmt = Math.max(0, Number(newInvoiceForm.amount || 0) - d.amount);
                            setNewInvoiceForm({...newInvoiceForm, selectedDisbursements: selected, amount: newAmt});
                          }
                        }} />
                        {d.description} (KES {d.amount.toLocaleString()})
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group" style={{marginBottom:'15px'}}>
                <label>Notes / Billing Details</label>
                <textarea rows="2" placeholder="e.g. Conveyance fee for phase 1 drafting + land search disbursement." value={newInvoiceForm.notes} onChange={e => setNewInvoiceForm({...newInvoiceForm, notes:e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowGenerateInvoiceModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Generate Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trust Transfer Modal */}
      {showTrustTransferModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'500px'}}>
            <h2 className="modal-title">💵 Pay Invoice using Trust Account Funds</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginBottom:'15px'}}>
              Perform an administrative transfer. This draws down from the client trust balance to pay an outstanding operating invoice.
            </p>
            <form onSubmit={handleTrustTransferSubmit}>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Invoice Code</label>
                <input type="text" value={trustTransferForm.invoice_id} readOnly style={{background:'var(--navy-900)'}} />
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}>
                <label>Transfer Amount (KES) *</label>
                <input type="number" required min="1" value={trustTransferForm.amount} onChange={e => setTrustTransferForm({...trustTransferForm, amount:e.target.value})} />
              </div>
              <div className="form-group" style={{marginBottom:'15px'}}>
                <label>Transfer Details / Memo</label>
                <textarea rows="2" value={trustTransferForm.notes} onChange={e => setTrustTransferForm({...trustTransferForm, notes:e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowTrustTransferModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Perform Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Judiciary API Settings Modal */}
      {showJudiciaryApiSettingsModal && (
        <JudiciaryApiSettingsModal
          onClose={() => setShowJudiciaryApiSettingsModal(false)}
          showToast={showToast}
        />
      )}

      {/* Document Text Editor Modal */}
      {showDocModal && (
        <div className="modal-overlay" onClick={() => setShowDocModal(null)}>
          <div className="modal-content printing-modal" style={{maxWidth:'800px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{TEMPLATES.find(t => t.id === showDocModal)?.title} Editor</h2>
            <p style={{color:'var(--text-secondary)', fontSize:'0.75rem', marginBottom:'10px'}}>
              You can edit the document content below freely. The changes are local and will print exactly as displayed.
            </p>
            
            {/* Built-in raw text editor */}
            <div style={{flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column'}}>
              <textarea
                style={{
                  width: '100%',
                  flex: 1,
                  background: '#ffffff',
                  color: '#1a1a1a',
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  padding: '20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  resize: 'none',
                  outline: 'none'
                }}
                value={editedDocContent}
                onChange={e => setEditedDocContent(e.target.value)}
              />
            </div>
            
            {/* Hidden printable print container with Times styling */}
            <div id="print-area" style={{display: 'none'}}>
              {bulkPrintDocs && bulkPrintDocs.length > 0 ? (
                bulkPrintDocs.map((docText, idx) => (
                  <div key={idx} className={idx < bulkPrintDocs.length - 1 ? "page-break" : ""}>
                    <div className="print-letterhead">
                      <h1>Sam Ogola & Co. Advocates</h1>
                      <div className="subtitle">Commissioners for Oaths & Patent Agents</div>
                      <div className="contact-info">
                        5th Floor, Plaza House, Nairobi | P.O. Box 12345-00100 Nairobi<br/>
                        Tel: +254 700 000 000 | Email: info@samogolaadvocates.co.ke
                      </div>
                    </div>
                    <div className="doc-body">
                      {docText}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="print-letterhead">
                    <h1>Sam Ogola & Co. Advocates</h1>
                    <div className="subtitle">Commissioners for Oaths & Patent Agents</div>
                    <div className="contact-info">
                      5th Floor, Plaza House, Nairobi | P.O. Box 12345-00100 Nairobi<br/>
                      Tel: +254 700 000 000 | Email: info@samogolaadvocates.co.ke
                    </div>
                  </div>
                  <div className="doc-body">
                    {editedDocContent}
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions" style={{marginTop:'15px', display:'flex', justifyContent:'space-between', width:'100%'}}>
              <div style={{display:'flex', gap:'8px'}}>
                <button type="button" className="secondary-btn" onClick={handleCopyToClipboardDoc}>📋 Copy Text</button>
                <button type="button" className="secondary-btn" style={{borderColor:'#4db6ac', color:'#4db6ac'}} onClick={handleSendWhatsAppDoc}>💬 Send to WhatsApp</button>
              </div>
              <div style={{display:'flex', gap:'8px'}}>
                <button type="button" className="secondary-btn" onClick={() => setShowDocModal(null)}>Close</button>
                <button type="button" className="primary-btn" onClick={handlePrintDoc}>🖨️ Print / Save PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Judiciary Multi-Portal Ingestion & Identification Modal */}
      {showJudiciaryIngestionModal && (
        <JudiciaryIngestionModal
          cases={cases}
          onClose={() => setShowJudiciaryIngestionModal(false)}
          onIngestSuccess={() => {
            fetchData();
          }}
          showToast={showToast}
        />
      )}

      {/* PWA Install Banner — appears on mobile above bottom tab bar */}
      {showInstallBanner && (
        <div className="pwa-install-banner">
          <div className="pwa-install-banner__icon">⚖️</div>
          <div className="pwa-install-banner__text">
            <div className="pwa-install-banner__title">Install Legal OS</div>
            <div className="pwa-install-banner__sub">Add to home screen for quick access</div>
          </div>
          <button className="pwa-install-banner__btn" onClick={handleInstall}>Install</button>
          <button className="pwa-install-banner__close" onClick={() => setShowInstallBanner(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

function ClientProfileTab({ activeCase, fetchData, userRole, showToast }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (activeCase) {
      setForm({
        client_name: activeCase.client_name || '',
        client_phone: activeCase.client_phone || '',
        client_email: activeCase.client_email || '',
        id_number: activeCase.id_number || '',
        kra_pin: activeCase.kra_pin || '',
        address: activeCase.address || '',
        dob: activeCase.dob || '',
        occupation: activeCase.occupation || '',
        case_title: activeCase.case_title || '',
        case_type: activeCase.case_type || '',
        assigned_lawyer: activeCase.assigned_lawyer || '',
        opposing_party: activeCase.opposing_party || '',
        opposing_party_contact: activeCase.opposing_party_contact || '',
        ref_no: activeCase.ref_no || '',
        court_station: activeCase.court_station || '',
        judiciary_case_id: activeCase.judiciary_case_id || '',
        billing_type: activeCase.billing_type || 'flat',
        emergency_name: activeCase.emergency_name || '',
        emergency_phone: activeCase.emergency_phone || '',
        emergency_relation: activeCase.emergency_relation || '',
        custom_kyc: activeCase.custom_kyc || '',
        is_sensitive: activeCase.is_sensitive === 1,
        alternative_phone: activeCase.alternative_phone || '',
        alternative_email: activeCase.alternative_email || '',
        opposing_counsel_name: activeCase.opposing_counsel_name || '',
        opposing_counsel_firm: activeCase.opposing_counsel_firm || '',
        opposing_counsel_phone: activeCase.opposing_counsel_phone || '',
        opposing_counsel_email: activeCase.opposing_counsel_email || '',
        opposing_counsel_address: activeCase.opposing_counsel_address || '',
        assigned_judge: activeCase.assigned_judge || '',
        court_division: activeCase.court_division || '',
        case_brief: activeCase.case_brief || ''
      });
    }
  }, [activeCase, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${BASE}/api/cases/${activeCase.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        is_sensitive: form.is_sensitive ? 1 : 0
      })
    });
    if (res.ok) {
      setIsEditing(false);
      fetchData();
      showToast("Client profile updated successfully!");
    } else {
      alert("Error updating client profile");
    }
  };

  if (!activeCase) return null;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3 style={{color:'var(--gold-400)', fontSize:'1rem', margin:0}}>👤 Client Profile & Legal Intake</h3>
        {userRole !== 'advocate' && !isEditing && (
          <button className="primary-btn" style={{padding:'6px 14px', fontSize:'0.8rem'}} onClick={() => setIsEditing(true)}>✏️ Edit Profile</button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:'20px'}}>
          {/* Card 1: Client Personal details */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>Personal Information</h4>
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Client Full Name</label>
                {isEditing ? (
                  <input required style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    value={form.client_name} onChange={e=>setForm({...form, client_name:e.target.value})}/>
                ) : (
                  <strong style={{color:'white', fontSize:'0.9rem'}}>{activeCase.client_name}</strong>
                )}
              </div>
              
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Phone Number</label>
                  {isEditing ? (
                    <input required style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.client_phone} onChange={e=>setForm({...form, client_phone:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace', color:'var(--gold-400)'}}>
                      {activeCase.client_phone ? <a href={`tel:${activeCase.client_phone}`} style={{color:'inherit', textDecoration:'none'}}>📞 {activeCase.client_phone}</a> : '—'}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Email Address</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.client_email} onChange={e=>setForm({...form, client_email:e.target.value})}/>
                  ) : (
                    <span style={{color:'var(--text-secondary)'}}>
                      {activeCase.client_email ? <a href={`mailto:${activeCase.client_email}`} style={{color:'inherit', textDecoration:'none'}}>✉️ {activeCase.client_email}</a> : '—'}
                    </span>
                  )}
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Alternative Phone(s)</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="Alt phone numbers" value={form.alternative_phone} onChange={e=>setForm({...form, alternative_phone:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace', color:'var(--text-secondary)'}}>
                      {activeCase.alternative_phone ? (
                        activeCase.alternative_phone.split(/,+/).map((p, idx) => (
                          <div key={idx} style={{marginTop: idx > 0 ? '3px' : '0'}}>
                            <a href={`tel:${p.trim()}`} style={{color:'inherit', textDecoration:'none'}}>📞 {p.trim()}</a>
                          </div>
                        ))
                      ) : '—'}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Alternative Email(s)</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="Alt email addresses" value={form.alternative_email} onChange={e=>setForm({...form, alternative_email:e.target.value})}/>
                  ) : (
                    <span style={{color:'var(--text-secondary)'}}>
                      {activeCase.alternative_email ? (
                        activeCase.alternative_email.split(/,+/).map((em, idx) => (
                          <div key={idx} style={{marginTop: idx > 0 ? '3px' : '0'}}>
                            <a href={`mailto:${em.trim()}`} style={{color:'inherit', textDecoration:'none'}}>✉️ {em.trim()}</a>
                          </div>
                        ))
                      ) : '—'}
                    </span>
                  )}
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Date of Birth</label>
                  {isEditing ? (
                    <input type="date" style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})}/>
                  ) : (
                    <span style={{color:'var(--text-secondary)'}}>{activeCase.dob || '—'}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Occupation</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.occupation} onChange={e=>setForm({...form, occupation:e.target.value})}/>
                  ) : (
                    <span style={{color:'var(--text-secondary)'}}>{activeCase.occupation || '—'}</span>
                  )}
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>National ID / Passport</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.id_number} onChange={e=>setForm({...form, id_number:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace', color:'white'}}>{activeCase.id_number || '—'}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>KRA PIN</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.kra_pin} onChange={e=>setForm({...form, kra_pin:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace', color:'white'}}>{activeCase.kra_pin || '—'}</span>
                  )}
                </div>
              </div>

              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Physical & Postal Address</label>
                {isEditing ? (
                  <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/>
                ) : (
                  <span style={{color:'var(--text-secondary)'}}>{activeCase.address || '—'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Legal Case Info & Opposing Party */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>Legal & Matter Information</h4>
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Official Matter Title</label>
                {isEditing ? (
                  <input required style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    value={form.case_title} onChange={e=>setForm({...form, case_title:e.target.value})}/>
                ) : (
                  <strong style={{color:'white', fontSize:'0.9rem'}}>{activeCase.case_title}</strong>
                )}
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Category</label>
                  {isEditing ? (
                    <select style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.case_type} onChange={e=>setForm({...form, case_type:e.target.value})}>
                      <option>Civil Disputes</option><option>Conveyancing & Land</option><option>Corporate Law</option><option>Family Law</option><option>Criminal Defense</option><option>Employment Law</option><option>Succession</option><option>Litigation</option>
                    </select>
                  ) : (
                    <span style={{color:'var(--text-primary)'}}>{activeCase.case_type}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Assigned Advocate</label>
                  {isEditing ? (
                    <select style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.assigned_lawyer} onChange={e=>setForm({...form, assigned_lawyer:e.target.value})}>
                      {['Sam Ogola', 'Patricia Advocates', 'Partner Omollo'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  ) : (
                    <span style={{color:'var(--text-primary)'}}>{activeCase.assigned_lawyer}</span>
                  )}
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Opposing Party</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.opposing_party} onChange={e=>setForm({...form, opposing_party:e.target.value})}/>
                  ) : (
                    <span style={{color:'white'}}>{activeCase.opposing_party || '—'}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Opposing Party Contact</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.opposing_party_contact} onChange={e=>setForm({...form, opposing_party_contact:e.target.value})}/>
                  ) : (
                    <span style={{color:'var(--text-secondary)'}}>{activeCase.opposing_party_contact || '—'}</span>
                  )}
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Internal Ref No</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.ref_no} onChange={e=>setForm({...form, ref_no:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace'}}>{activeCase.ref_no || '—'}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Billing Arrangement</label>
                  {isEditing ? (
                    <select style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.billing_type} onChange={e=>setForm({...form, billing_type:e.target.value})}>
                      <option value="flat">Flat Fee Remuneration</option><option value="hourly">Hourly Rate</option><option value="contingency">Contingency / Success Fee</option>
                    </select>
                  ) : (
                    <span style={{color:'var(--gold-400)', fontWeight:600}}>{(form.billing_type || 'flat').toUpperCase()}</span>
                  )}
                </div>
              </div>

              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Tracker Token (WhatsApp Ref)</label>
                <span style={{fontFamily:'monospace', display:'block', marginTop:'5px', color:'var(--gold-400)', fontWeight:700}}>{activeCase.tracking_token}</span>
              </div>
            </div>
          </div>

          {/* Card 2B: Court & Judicial Details */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>⚖️ Court & Judicial Details</h4>
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Court Station / Registry</label>
                {isEditing ? (
                  <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    placeholder="e.g. Milimani Commercial Court" value={form.court_station} onChange={e=>setForm({...form, court_station:e.target.value})}/>
                ) : (
                  <span style={{color:'white'}}>{activeCase.court_station || '—'}</span>
                )}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Judiciary Suit / Case No</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="e.g. HCCC/E001/2026" value={form.judiciary_case_id} onChange={e=>setForm({...form, judiciary_case_id:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace', color:'var(--gold-400)', fontWeight:600}}>{activeCase.judiciary_case_id || '—'}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Assigned Judge / Magistrate</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="e.g. Hon. Justice J. Mutungi" value={form.assigned_judge} onChange={e=>setForm({...form, assigned_judge:e.target.value})}/>
                  ) : (
                    <span style={{color:'white'}}>{activeCase.assigned_judge || '—'}</span>
                  )}
                </div>
              </div>
              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Court Division</label>
                {isEditing ? (
                  <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    placeholder="e.g. Land & Environment Division" value={form.court_division} onChange={e=>setForm({...form, court_division:e.target.value})}/>
                ) : (
                  <span style={{color:'var(--text-secondary)'}}>{activeCase.court_division || '—'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Emergency Contact */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>🚨 Next of Kin / Emergency Contact</h4>
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <div>
                <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Contact Full Name</label>
                {isEditing ? (
                  <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    value={form.emergency_name} onChange={e=>setForm({...form, emergency_name:e.target.value})}/>
                ) : (
                  <strong style={{color:'white'}}>{activeCase.emergency_name || '—'}</strong>
                )}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Relationship</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.emergency_relation} onChange={e=>setForm({...form, emergency_relation:e.target.value})}/>
                  ) : (
                    <span style={{color:'var(--text-secondary)'}}>{activeCase.emergency_relation || '—'}</span>
                  )}
                </div>
                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Phone Number</label>
                  {isEditing ? (
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      value={form.emergency_phone} onChange={e=>setForm({...form, emergency_phone:e.target.value})}/>
                  ) : (
                    <span style={{fontFamily:'monospace', color:'var(--gold-400)'}}>{activeCase.emergency_phone || '—'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3B: Opposing Counsel Details */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>💼 Opposing Advocate / Law Firm</h4>
            
            {isEditing ? (
              <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginBottom:'4px', background:'rgba(255,255,255,0.03)', padding:'6px 10px', borderRadius:'4px'}}>
                  💡 You can record multiple opposing counsels by separating each entry with a semicolon (<code>;</code>).
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                  <div>
                    <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Opposing Advocate Name(s)</label>
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="e.g. John Doe; Jane Smith" value={form.opposing_counsel_name} onChange={e=>setForm({...form, opposing_counsel_name:e.target.value})}/>
                  </div>
                  <div>
                    <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Opposing Law Firm(s)</label>
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="e.g. Doe & Co; Smith Advocates" value={form.opposing_counsel_firm} onChange={e=>setForm({...form, opposing_counsel_firm:e.target.value})}/>
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                  <div>
                    <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Counsel Phone(s)</label>
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="e.g. +254...; +254..." value={form.opposing_counsel_phone} onChange={e=>setForm({...form, opposing_counsel_phone:e.target.value})}/>
                  </div>
                  <div>
                    <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Counsel Email(s)</label>
                    <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                      placeholder="e.g. doe@mail.com; smith@mail.com" value={form.opposing_counsel_email} onChange={e=>setForm({...form, opposing_counsel_email:e.target.value})}/>
                  </div>
                </div>

                <div>
                  <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Counsel Physical Address(es)</label>
                  <input style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'6px 10px', borderRadius:'4px', marginTop:'4px'}}
                    placeholder="e.g. Nairobi Room 4; Mombasa Building 2" value={form.opposing_counsel_address} onChange={e=>setForm({...form, opposing_counsel_address:e.target.value})}/>
                </div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                {(() => {
                  const names = (activeCase.opposing_counsel_name || '').split(';').map(x => x.trim()).filter(Boolean);
                  const firms = (activeCase.opposing_counsel_firm || '').split(';');
                  const phones = (activeCase.opposing_counsel_phone || '').split(';');
                  const emails = (activeCase.opposing_counsel_email || '').split(';');
                  const addresses = (activeCase.opposing_counsel_address || '').split(';');

                  if (names.length === 0) {
                    return <p style={{color:'var(--text-muted)', fontSize:'0.82rem', margin:0, fontStyle:'italic'}}>No opposing counsel recorded.</p>;
                  }

                  return names.map((name, i) => (
                    <div key={i} style={{borderBottom: i < names.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: i < names.length - 1 ? '12px' : '0', marginBottom: i < names.length - 1 ? '4px' : '0'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px'}}>
                        <div>
                          <strong style={{color:'white', fontSize:'0.9rem'}}>👤 {name}</strong>
                          {firms[i]?.trim() && <div style={{fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'2px'}}>🏢 {firms[i].trim()}</div>}
                        </div>
                        <div style={{textAlign:'right', fontSize:'0.82rem'}}>
                          {phones[i]?.trim() && <div><a href={`tel:${phones[i].trim()}`} style={{color:'var(--gold-400)', textDecoration:'none'}}>📞 {phones[i].trim()}</a></div>}
                          {emails[i]?.trim() && <div><a href={`mailto:${emails[i].trim()}`} style={{color:'var(--text-secondary)', textDecoration:'none'}}>✉️ {emails[i].trim()}</a></div>}
                        </div>
                      </div>
                      {addresses[i]?.trim() && <div style={{fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'6px'}}>📍 {addresses[i].trim()}</div>}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Card 4B: Case Facts Brief & Strategy Notes */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>📝 Facts Brief & Strategy Notes</h4>
            <div>
              <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'4px'}}>Advocate's Strategy Notes</label>
              {isEditing ? (
                <textarea rows="4" style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'8px 12px', borderRadius:'4px', resize:'vertical'}}
                  placeholder="Facts brief, client instruction synopsis, and case strategy details..." value={form.case_brief} onChange={e=>setForm({...form, case_brief:e.target.value})}/>
              ) : (
                <div style={{whiteSpace:'pre-wrap', color:'var(--text-secondary)', background:'var(--navy-950)', border:'1px solid var(--border-default)', padding:'10px 12px', borderRadius:'6px', fontSize:'0.82rem', minHeight:'100px'}}>
                  {activeCase.case_brief || 'No case brief or strategy notes logged yet.'}
                </div>
              )}
            </div>
          </div>

          {/* Card 4: KYC Notes */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'20px'}}>
            <h4 style={{color:'var(--gold-300)', borderBottom:'1px solid var(--border-default)', paddingBottom:'8px', margin:0, marginBottom:'12px', fontSize:'0.9rem'}}>📑 KYC Verification & Case Notes</h4>
            <div>
              <label style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'4px'}}>Additional Administrative Notes</label>
              {isEditing ? (
                <textarea rows="4" style={{width:'100%', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'8px 12px', borderRadius:'4px', resize:'vertical'}}
                  value={form.custom_kyc} onChange={e=>setForm({...form, custom_kyc:e.target.value})}/>
              ) : (
                <div style={{whiteSpace:'pre-wrap', color:'var(--text-secondary)', background:'var(--navy-950)', border:'1px solid var(--border-default)', padding:'10px 12px', borderRadius:'6px', fontSize:'0.82rem', minHeight:'100px'}}>
                  {activeCase.custom_kyc || 'No additional KYC or administrative notes recorded for this matter.'}
                </div>
              )}
            </div>
            {isEditing && (
              <div style={{marginTop:'12px'}}>
                <label className="checkbox-label"><input type="checkbox" checked={form.is_sensitive} onChange={e=>setForm({...form, is_sensitive:e.target.checked})}/> 🔒 Mark as Highly Sensitive Case</label>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div style={{display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'20px'}}>
            <button type="button" className="secondary-btn" onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="submit" className="primary-btn">Save Client Profile</button>
          </div>
        )}
      </form>
    </div>
  );
}

export default App;
