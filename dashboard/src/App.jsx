import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomeDashboard from './components/HomeDashboard';
import CalendarTab from './components/CalendarTab';
import './App.css';
import Login from './Login';
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
const LAWYERS = ['Sam Ogola', 'Kincy Nangami', 'Muchiri Mutegi'];

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
  const firm = 'Sam Ogola & Co. Advocates';
  const date = new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' });
  if (tplId === 'notice_of_appearance') return `SAM OGOLA & CO. ADVOCATES
NOTICE OF APPEARANCE

Date: ${date}
Matter: ${data.case_title || '_______________'}
Case Type: ${data.case_type || '_______________'}
File Reference: ${data.ref_no || data.tracking_token || '_______________'}
Client: ${data.client_name || '_______________'}
Opposing Party: ${data.opposing_party || '_______________'}

TAKE NOTICE that Sam Ogola & Co. Advocates hereby enters appearance on behalf of the client in the above-captioned matter.

All correspondence regarding this matter should be directed to:
${data.assigned_lawyer || 'The Advocate'}
Sam Ogola & Co. Advocates

___________________________
For: SAM OGOLA & CO. ADVOCATES`;

  if (tplId === 'intake_confirmation') return `SAM OGOLA & CO. ADVOCATES
CLIENT INTAKE CONFIRMATION

Date: ${date}

Dear ${data.client_name || '_______________'},

RE: CLIENT INTAKE — "${data.case_title || '_______________'}"

We write to confirm that your matter has been formally registered with our firm.
Your case tracking reference is: ${data.tracking_token || '_______________'}
Your assigned advocate is: ${data.assigned_lawyer || '_______________'}

You may check the status of your case at any time by sending your tracking reference via WhatsApp.

Yours faithfully,
___________________________
For: SAM OGOLA & CO. ADVOCATES`;

  if (tplId === 'hearing_notice') return `SAM OGOLA & CO. ADVOCATES
HEARING NOTICE

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

  if (tplId === 'blank_letter') return `SAM OGOLA & CO. ADVOCATES
CUSTOM LETTER

Date: ${date}
Client: ${data.client_name || '_______________'}

Type your custom letter details here...`;

  return '';
}

function App() {
  // ── Auth ────────────────────────────────────────────────────────────
  const [session, setSession_] = useState(() => getSession());

  const handleLogin = (data) => {
    setSession_(data);
  };
  const handleLogout = () => {
    clearSession();
    setSession_(null);
  };

  // If not logged in, show the Login screen
  if (!session) return <Login onLogin={handleLogin} />;

  // ── Main app state ───────────────────────────────────────────────────
  const userRole        = session.role;
  const userDisplayName = session.display_name;
  const userCanEdit     = userRole === 'admin' || userRole === 'secretary';

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

  // Modals
  const [showNewLeadModal, setShowNewLeadModal]       = useState(false);
  const [showNewCaseModal, setShowNewCaseModal]       = useState(false);
  const [showEditMilestoneModal, setShowEditMilestoneModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal]     = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showDocModal, setShowDocModal]               = useState(null); // template id
  const [showPaymentModal, setShowPaymentModal]       = useState(false);
  const [showEditFeeModal, setShowEditFeeModal]       = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showJudiciaryModal, setShowJudiciaryModal]   = useState(false);
  const [editFeeForm, setEditFeeForm]                 = useState({ total_fee: '', fee_status: 'pending' });
  const [selectedLead, setSelectedLead]               = useState(null);
  const [editingEvent, setEditingEvent]               = useState(null);

  // Case Tracker & Matter Dashboard
  const [activeMatterId, setActiveMatterId] = useState(null);
  const [matterTab, setMatterTab] = useState('overview');
  const [caseFiles, setCaseFiles] = useState([]);
  const [casePayments, setCasePayments] = useState([]);
  const [caseInvoices, setCaseInvoices] = useState([]);
  const [caseDisbursements, setCaseDisbursements] = useState([]);
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

  // Forms
  const [newLeadForm, setNewLeadForm] = useState({
    full_name:'', phone:'', email:'', service_category:'Civil Disputes',
    message:'', source:'walk_in', opposing_party:'', is_emergency:false, conflict_checked:false,
    id_number:'', kra_pin:'', address:'', custom_kyc:''
  });
  const [newCaseForm, setNewCaseForm] = useState({
    client_name:'', case_title:'', case_type:'Civil Disputes',
    assigned_lawyer:'Sam Ogola', opposing_party:'', ref_no:'', is_sensitive:false, tracking_token:'',
    id_number:'', kra_pin:'', address:'', custom_kyc:''
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
    } else {
      setCaseFiles([]);
      setCasePayments([]);
      setCaseInvoices([]);
      setCaseDisbursements([]);
    }
  }, [activeMatterId]);

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
    if (lawyerFilter !== 'all' && c.assigned_lawyer !== lawyerFilter) return false;
    if (filterBy === 'active_cases' && c.current_milestone === "CLOSED") return false;
    return true;
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
  const handleNewLeadSubmit = (e) => {
    e.preventDefault();
    if (!newLeadForm.conflict_checked) {
      alert("WARNING: You must perform a conflict of interest check before logging a new lead.");
      return;
    }
    const prefix = newLeadForm.is_emergency ? "[URGENT] " : "";
    apiPost('/api/leads', { ...newLeadForm, message: prefix + newLeadForm.message })
      .then(r => r?.json()).then(() => {
        setShowNewLeadModal(false);
        setNewLeadForm({ full_name:'', phone:'', email:'', service_category:'Civil Disputes', message:'', source:'walk_in', opposing_party:'', is_emergency:false, conflict_checked:false });
        setConflictResults([]); setConflictQuery('');
        fetchData();
      });
  };

  const handleNewCaseSubmit = (e) => {
    e.preventDefault();
    apiPost('/api/cases', newCaseForm).then(r => r?.json()).then(() => {
      setShowNewCaseModal(false);
      setNewCaseForm({ client_name:'', case_title:'', case_type:'Civil Disputes', assigned_lawyer:'Sam Ogola', opposing_party:'', ref_no:'', is_sensitive:false, tracking_token:'' });
      setConflictResults([]); setConflictQuery('');
      fetchData(); setActiveTab('cases');
    });
  };

  const handleLeadActionSubmit = (e) => {
    e.preventDefault();
    if (leadActionForm.convert_to_case) {
      apiPost('/api/cases', {
        client_name: selectedLead.full_name,
        case_title: leadActionForm.case_title || `${selectedLead.service_category} Matter`,
        case_type: selectedLead.service_category,
        assigned_lawyer: leadActionForm.assigned_lawyer,
        tracking_token: leadActionForm.tracking_token,
        lead_id: selectedLead.id
      }).then(r => r?.json()).then(() => {
        alert("Lead successfully converted to an active case!");
        setSelectedLead(null); fetchData();
      });
    } else {
      apiPut(`/api/leads/${selectedLead.id}`, {
        status:'consultation_set',
        consultation_date: leadActionForm.consultation_date,
        consultation_paid: leadActionForm.consultation_paid,
        assigned_lawyer: leadActionForm.assigned_lawyer
      }).then(r => r?.json()).then(() => { setSelectedLead(null); fetchData(); });
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

  const handleMilestoneUpdate = () => {
    if (!selectedCase) return;
    fetch(`${BASE}/api/cases/${selectedCase}/milestone`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ milestone: selectedPhase })
    }).then(r => r.json()).then(() => {
      alert(selectedPhase === "CLOSED" ? 'Case marked as closed and archived!' : 'Milestone updated! This is now live for the client on WhatsApp.');
      
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
        if (res?.status === 403) { alert("ERROR: Invalid Partner Passcode. Rollback unauthorized."); return; }
        alert("Milestone rollback successfully applied and authorized.");
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
    const formData = new FormData();
    formData.append('file', file);
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
    apiPut(`/api/cases/${selectedCase}/payment`, paymentForm)
      .then(r => r?.json()).then(() => { setShowPaymentModal(false); fetchData(); });
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
    logDocAction('Printed/Saved PDF');
    window.print();
  };

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
    return (
      <div style={{background:'rgba(255,152,0,0.12)', border:'1px solid rgba(255,152,0,0.5)', borderRadius:'6px', padding:'10px 14px', marginTop:'10px'}}>
        <div style={{color:'#ff9800', fontWeight:700, fontSize:'0.8rem', marginBottom:'6px'}}>
          ⚠️ POTENTIAL CONFLICT OF INTEREST — {conflictResults.length} match{conflictResults.length > 1 ? 'es' : ''} found
        </div>
        {conflictResults.map((r, i) => (
          <div key={i} style={{fontSize:'0.75rem', color:'var(--text-primary)', borderBottom:'1px solid rgba(255,152,0,0.2)', paddingBottom:'4px', marginBottom:'4px'}}>
            <strong>{r.name}</strong> {r.opposing_party ? `vs. ${r.opposing_party}` : ''} —{' '}
            <span style={{color:'var(--text-secondary)'}}>{r.detail} | {r.lawyer || 'Unassigned'} | {r.type === 'case' ? `Token: ${r.token}` : 'Lead'}</span>{' '}
            <span style={{color:'#ff9800', fontWeight:700}}>{r.score}% match</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard">
      {/* Floating Simulator Button */}
      <a href="/simulator.html" target="_blank" rel="noreferrer"
         style={{position:'fixed',bottom:'30px',right:'30px',background:'var(--brand-red, #B71C1C)',color:'white',padding:'15px 25px',borderRadius:'50px',fontWeight:'bold',boxShadow:'0 10px 25px rgba(183,28,28,0.4)',zIndex:1000,textDecoration:'none',display:'flex',alignItems:'center',gap:'10px'}}>
        <span>📱</span> Test WhatsApp Bot
      </a>

      {/* Header */}
      <div className="dash-header">
        <div className="dash-header__title">
          <span className="dash-header__logo">SO</span>
          Sam Ogola & Co Advocates — Staff Portal
        </div>
        <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
          <select style={{background:'var(--navy-800)',color:'white',padding:'5px 10px',border:'1px solid var(--border-default)',borderRadius:'4px',outline:'none'}}
            value={lawyerFilter} onChange={e => setLawyerFilter(e.target.value)}>
            <option value="all">Global View (All Lawyers)</option>
            {LAWYERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {upcoming48h.length > 0 && (
            <div style={{background:'rgba(255,152,0,0.15)',border:'1px solid rgba(255,152,0,0.5)',padding:'5px 12px',borderRadius:'20px',fontSize:'0.75rem',color:'#ff9800',cursor:'pointer'}}
              onClick={() => setActiveTab('calendar')}>
              ⚠️ {upcoming48h.length} court date{upcoming48h.length > 1 ? 's' : ''} within 48h
            </div>
          )}
          <div className="dash-header__meta">Live • <span>{clock}</span></div>
          <div style={{display:'flex',alignItems:'center',gap:'10px',borderLeft:'1px solid rgba(255,255,255,0.1)',paddingLeft:'15px'}}>
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
      <div className="dash-workspace">
        {/* Sidebar */}
        <div className="dash-sidebar">
          {[
            { id:'home',     label:'🏠 Dashboard' },
            { id:'leads',    label:'📥 CRM Inbox' },
            { id:'matters',  label:'⚖️ Active Matters' },
            { id:'calendar', label:'📅 Firm Calendar' },
            ...(userRole !== 'advocate' ? [{ id:'finance',  label:'💰 Firm Finance' }] : []),
            { id:'documents',label:'📄 Templates' },
            { id:'report',   label:'📋 Weekly Report' },
            ...(userRole === 'admin' ? [{ id:'settings', label:'🛡️ Admin & Users' }] : [])
          ].map(tab => (
            <button key={tab.id} className={`dash-nav-btn ${activeTab===tab.id?'active':''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setFilterBy('all');
                setActiveMatterId(null);
                if (tab.id === 'settings') fetchUsers();
              }}>
              {tab.label}
            </button>
          ))}
          <div style={{flex:1}}/>
          {activeMatterId ? (
            <div style={{padding:'15px', background:'var(--navy-800)', borderTop:'1px solid var(--border-default)', fontSize:'0.85rem'}}>
              <strong style={{color:'var(--gold-400)', display:'block', marginBottom:'5px'}}>Client Profile</strong>
              <div style={{color:'var(--text-secondary)', marginBottom:'2px'}}>📞 {cases.find(c => c.id === activeMatterId)?.client_phone || 'N/A'}</div>
              <div style={{color:'var(--text-secondary)', marginBottom:'8px'}}>✉️ {cases.find(c => c.id === activeMatterId)?.client_email || 'N/A'}</div>
              <div style={{color:'var(--text-secondary)'}}>ID: {cases.find(c => c.id === activeMatterId)?.id_number || 'N/A'}</div>
            </div>
          ) : (
            <button className="dash-nav-btn" style={{color:'var(--gold-400)'}} onClick={handleGenerateWeeklyReport}>
              📋 Generate Report
            </button>
          )}
        </div>

        {/* Content */}
        <div className="dash-content">
          {activeMatterId && (
            <div className="matter-dashboard">
              <div className="matter-header">
                <button className="secondary-btn" style={{marginBottom:'15px', padding:'4px 10px'}} onClick={() => { setActiveMatterId(null); setSelectedCase(null); }}>← Back to Matters</button>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
                  <h2 style={{color:'var(--gold-400)', margin:0}}>
                    {cases.find(c => c.id === activeMatterId)?.client_name}
                    <span style={{color:'var(--text-secondary)', fontSize:'1rem', marginLeft:'10px'}}>
                      {cases.find(c => c.id === activeMatterId)?.case_title}
                    </span>
                  </h2>
                  <div style={{display:'flex',gap:'8px'}}>
                    {userRole !== 'advocate' && <button className="secondary-btn" onClick={() => { setEditableMilestones([...currentMilestonesList]); setShowEditMilestoneModal(true); }}>✏️ Edit Milestones</button>}
                    {userRole !== 'advocate' && <button className="secondary-btn" style={{borderColor:'var(--gold-500)',color:'var(--gold-400)'}} onClick={() => { const c = cases.find(x => x.id === activeMatterId); if(c) { setPaymentForm({trust_payment_status:c.trust_payment_status||'none',trust_payment_ref:c.trust_payment_ref||'',fee_status:c.fee_status||'pending'}); setShowPaymentModal(true); }}}>💳 Payment Ref</button>}
                    {userRole !== 'advocate' && <button className="secondary-btn" style={{borderColor:'#64b5f6',color:'#64b5f6'}} onClick={() => { const c = cases.find(x => x.id === activeMatterId); if(c) { setJudiciaryForm({judiciary_case_id:c.judiciary_case_id||'',judiciary_filing_token:c.judiciary_filing_token||''}); setShowJudiciaryModal(true); }}}>⚖️ Judiciary IDs</button>}
                  </div>
                </div>
                <div className="matter-nav">
                  <button className={`matter-nav-btn ${matterTab==='overview'?'active':''}`} onClick={()=>setMatterTab('overview')}>Overview</button>
                  <button className={`matter-nav-btn ${matterTab==='files'?'active':''}`} onClick={()=>setMatterTab('files')}>Files & Documents</button>
                  <button className={`matter-nav-btn ${matterTab==='calendar'?'active':''}`} onClick={()=>setMatterTab('calendar')}>Calendar</button>
                  {userRole !== 'advocate' && <button className={`matter-nav-btn ${matterTab==='finance'?'active':''}`} onClick={()=>setMatterTab('finance')}>Financials</button>}
                </div>
              </div>

              <div style={{padding:'20px'}}>
                {matterTab === 'overview' && (
                  <div style={{display:'grid', gap:'20px'}}>
                    {/* Activity Log (moved from old cases tab) */}
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
                            {LAWYERS.map(l => <option key={l}>{l}</option>)}
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
                {matterTab === 'files' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    {userRole !== 'advocate' && (
                      <label className={`file-dropzone ${uploadingFile ? 'drag-active' : ''}`}>
                        <input type="file" style={{display:'none'}} onChange={handleFileUpload} disabled={uploadingFile} />
                        {uploadingFile ? 'Uploading...' : 'Drop files here or click to upload case document (Max 20MB)'}
                      </label>
                    )}
                    <div>
                      {caseFiles.length === 0 && <p style={{color:'var(--text-muted)'}}>No files uploaded for this case yet.</p>}
                      {caseFiles.map(f => (
                        <div key={f.id} className="file-item">
                          <div>
                            <strong>📄 {f.original_name}</strong>
                            <div style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>
                              {(f.size/1024/1024).toFixed(2)} MB • Uploaded {new Date(f.uploaded_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{display:'flex', gap:'10px'}}>
                            <a href={`${BASE}${f.file_url}`} target="_blank" rel="noreferrer" className="action-btn" style={{textDecoration:'none'}}>Download</a>
                            {userRole !== 'advocate' && <button className="action-btn" style={{color:'var(--red-400)'}} onClick={() => handleDeleteFile(f.id, f.original_name)}>Delete</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {matterTab === 'calendar' && (
                  <div>
                    {userRole !== 'advocate' && <button className="primary-btn" style={{marginBottom:'15px'}} onClick={() => { setEditingEvent(null); setNewEventForm({case_id:activeMatterId, event_title:'', event_type:'mention', event_date:'', notes:''}); setShowAddEventModal(true); }}>+ Add Court Date</button>}
                    <div className="dash-table-wrapper">
                      <table className="dash-table">
                        <thead><tr><th>Date & Time</th><th>Event</th><th>Type</th><th>Notes</th><th>Action</th></tr></thead>
                        <tbody>
                          {calendar.filter(ev => ev.case_id === activeMatterId).map(ev => (
                            <tr key={ev.id}>
                              <td>{new Date(ev.event_date).toLocaleString('en-KE')}</td>
                              <td><strong>{ev.event_title}</strong></td>
                              <td><span className="badge badge--pending">{ev.event_type?.replace('_',' ')}</span></td>
                              <td>{ev.notes}</td>
                              <td>
                                {userRole !== 'advocate' && <button className="action-btn" onClick={() => handleEditEventClick(ev)}>✏️ Edit</button>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

          {/* ═══════ MATTERS TAB ═══════ */}
          {activeTab === 'matters' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontSize:'1rem',color:'var(--gold-400)'}}>⚖️ Active Matters</h3>
                {filterBy !== 'all' && <span style={{color:'var(--text-secondary)',fontSize:'0.8rem'}}>(Filtered) <button onClick={()=>setFilterBy('all')} style={{background:'none',border:'none',color:'var(--red-400)',cursor:'pointer',textDecoration:'underline'}}>Clear</button></span>}
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
                            <span style={{fontFamily:'monospace',color:'#64b5f6',fontWeight:700}}>{c.judiciary_case_id}</span>
                          ) : <span style={{color:'var(--text-muted)',fontSize:'0.7rem'}}>Not set</span>}
                          {c.ref_no && <div style={{fontFamily:'monospace',fontSize:'0.7rem',color:'var(--gold-400)',marginTop:'2px'}}>Ref: {c.ref_no}</div>}
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
                            <button className="action-btn" onClick={() => { setSelectedCase(c.id); setPaymentForm({trust_payment_status:c.trust_payment_status||'none',trust_payment_ref:c.trust_payment_ref||'',fee_status:c.fee_status||'pending'}); setShowPaymentModal(true); }}>Update</button>
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

          {/* ═══════ DOCUMENTS TAB ═══════ */}
          {activeTab === 'documents' && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px',width:'100%'}}>
              <h3 style={{color:'var(--gold-400)',fontSize:'1rem'}}>📄 Document Automation & Text Editor</h3>
              <p style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>Select a template to auto-fill. Once generated, you can edit it directly inside the built-in editor before printing or sharing.</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
                {TEMPLATES.map(tpl => (
                  <div key={tpl.id} style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'20px',cursor:'pointer',transition:'border-color 0.2s'}}
                    onMouseEnter={e => e.currentTarget.style.borderColor='var(--gold-500)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-default)'}
                    onClick={() => handleOpenDocModal(tpl.id)}>
                    <div style={{fontSize:'1.5rem',marginBottom:'8px'}}>📋</div>
                    <h4 style={{color:'var(--gold-400)',fontSize:'0.9rem',marginBottom:'6px'}}>{tpl.title}</h4>
                    <p style={{color:'var(--text-secondary)',fontSize:'0.75rem'}}>{tpl.description}</p>
                    <div style={{marginTop:'12px'}}>
                      <button className="primary-btn" style={{width:'100%',fontSize:'0.75rem'}}>Edit & Generate</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              </div>
              
              {/* User management form */}
              <div style={{background:'var(--navy-800)',border:'1px solid var(--border-default)',borderRadius:'8px',padding:'16px 20px'}}>
                <h4 style={{marginBottom:'10px',color:'var(--gold-300)'}}>Add / Reset User</h4>
                <form onSubmit={handleUserMgmtSubmit} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:'10px'}}>
                  <input placeholder="Username (login)" value={newUserForm.username} onChange={e=>setNewUserForm({...newUserForm,username:e.target.value})} required style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}/>
                  <input placeholder="Display Name" value={newUserForm.display_name} onChange={e=>setNewUserForm({...newUserForm,display_name:e.target.value})} required style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}/>
                  <input type="password" placeholder="Password" value={newUserForm.password} onChange={e=>setNewUserForm({...newUserForm,password:e.target.value})} required style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}/>
                  <select value={newUserForm.role} onChange={e=>setNewUserForm({...newUserForm,role:e.target.value})} style={{background:'var(--navy-950)',border:'1px solid var(--border-default)',color:'white',padding:'8px',borderRadius:'4px'}}>
                    <option value="advocate">Advocate (Read-Only)</option>
                    <option value="secretary">Secretary</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="submit" className="primary-btn">Save</button>
                </form>
                {userMgmtMsg && <div style={{marginTop:'10px',fontSize:'0.8rem',color:'var(--gold-400)'}}>{userMgmtMsg}</div>}
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
                          {u.id !== session.id && (
                            <button className="action-btn" style={{color:'var(--red-400)'}} onClick={() => handleDeleteUser(u.id, u.username)}>Revoke Access</button>
                          )}
                          {u.id === session.id && <span style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>You</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>


            </div>
          )}
          </div>
        )}

        </div>
      </div>

      {/* ═══════ MODALS ═══════ */}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'680px'}}>
            <h2 className="modal-title">Log New Lead</h2>
            <form onSubmit={handleNewLeadSubmit}>
              <div className="form-grid">
                <div className="form-group"><label>Full Name *</label><input required value={newLeadForm.full_name} onChange={e => { setNewLeadForm({...newLeadForm, full_name:e.target.value}); setConflictQuery(e.target.value); }}/></div>
                <div className="form-group"><label>Phone Number *</label><input required value={newLeadForm.phone} onChange={e => { setNewLeadForm({...newLeadForm, phone:e.target.value}); setConflictQuery(prev => prev || e.target.value); }}/></div>
                <div className="form-group"><label>Email</label><input type="email" value={newLeadForm.email} onChange={e => setNewLeadForm({...newLeadForm, email:e.target.value})}/></div>
                <div className="form-group"><label>Source</label><select value={newLeadForm.source} onChange={e => setNewLeadForm({...newLeadForm, source:e.target.value})}><option value="walk_in">Walk In</option><option value="phone_call">Phone Call</option><option value="referral">Referral</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></div>
                <div className="form-group"><label>ID / Passport No</label><input value={newLeadForm.id_number} onChange={e => setNewLeadForm({...newLeadForm, id_number:e.target.value})}/></div>
                <div className="form-group"><label>KRA PIN</label><input value={newLeadForm.kra_pin} onChange={e => setNewLeadForm({...newLeadForm, kra_pin:e.target.value})}/></div>
                <div className="form-group"><label>Physical / Postal Address</label><input value={newLeadForm.address} onChange={e => setNewLeadForm({...newLeadForm, address:e.target.value})}/></div>
                <div className="form-group"><label>Opposing Party</label><input placeholder="Name of opposing party, if known" value={newLeadForm.opposing_party} onChange={e => { setNewLeadForm({...newLeadForm, opposing_party:e.target.value}); setConflictQuery(e.target.value || newLeadForm.full_name); }}/></div>
                <div className="form-group"><label>Service Category</label><select value={newLeadForm.service_category} onChange={e => setNewLeadForm({...newLeadForm, service_category:e.target.value})}><option>Civil Disputes</option><option>Conveyancing & Land</option><option>Corporate Law</option><option>Family Law</option><option>Criminal Defense</option><option>Employment Law</option><option>Succession</option><option>Intellectual Property</option></select></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Custom KYC Details (e.g. Company Reg No)</label><textarea rows="2" placeholder="Any extra KYC info..." value={newLeadForm.custom_kyc} onChange={e => setNewLeadForm({...newLeadForm, custom_kyc:e.target.value})}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Inquiry Notes *</label><textarea rows="3" required value={newLeadForm.message} onChange={e => setNewLeadForm({...newLeadForm, message:e.target.value})}/></div>
              </div>
              <ConflictBanner />
              <div style={{marginTop:'15px',borderTop:'1px solid var(--border-default)',paddingTop:'15px',display:'flex',flexDirection:'column',gap:'8px'}}>
                <label className="checkbox-label" style={{color:'var(--red-400)'}}><input type="checkbox" checked={newLeadForm.is_emergency} onChange={e => setNewLeadForm({...newLeadForm, is_emergency:e.target.checked})}/> URGENT EMERGENCY (Bail, Injunction, Arrest) — Notify Partner Immediately</label>
                <label className="checkbox-label"><input type="checkbox" checked={newLeadForm.conflict_checked} onChange={e => setNewLeadForm({...newLeadForm, conflict_checked:e.target.checked})}/> I have reviewed the conflict check results above and confirmed no conflict of interest exists.</label>
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => { setShowNewLeadModal(false); setConflictResults([]); setConflictQuery(''); }}>Cancel</button><button type="submit" className="primary-btn">Save Lead</button></div>
            </form>
          </div>
        </div>
      )}

      {/* New Direct Case Modal */}
      {showNewCaseModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:'680px'}}>
            <h2 className="modal-title">Direct Case Intake</h2>
            <p style={{color:'var(--text-secondary)',fontSize:'0.85rem',marginBottom:'15px'}}>Bypass the lead system and immediately generate a tracking reference for a signed client.</p>
            <form onSubmit={handleNewCaseSubmit}>
              <div className="form-grid">
                <div className="form-group"><label>Client Name *</label><input required value={newCaseForm.client_name} onChange={e => { setNewCaseForm({...newCaseForm, client_name:e.target.value}); setConflictQuery(e.target.value); }}/></div>
                <div className="form-group"><label>Official Case Title *</label><input required placeholder="e.g. Divorce - Wanjiku" value={newCaseForm.case_title} onChange={e => setNewCaseForm({...newCaseForm, case_title:e.target.value})}/></div>
                <div className="form-group"><label>ID / Passport No</label><input value={newCaseForm.id_number} onChange={e => setNewCaseForm({...newCaseForm, id_number:e.target.value})}/></div>
                <div className="form-group"><label>KRA PIN</label><input value={newCaseForm.kra_pin} onChange={e => setNewCaseForm({...newCaseForm, kra_pin:e.target.value})}/></div>
                <div className="form-group"><label>Physical / Postal Address</label><input value={newCaseForm.address} onChange={e => setNewCaseForm({...newCaseForm, address:e.target.value})}/></div>
                <div className="form-group"><label>Opposing Party</label><input placeholder="Name of opposing party" value={newCaseForm.opposing_party} onChange={e => { setNewCaseForm({...newCaseForm, opposing_party:e.target.value}); setConflictQuery(e.target.value || newCaseForm.client_name); }}/></div>
                <div className="form-group"><label>Reference No (Ref No)</label><input placeholder="e.g. SOA/2026/001" value={newCaseForm.ref_no} onChange={e => setNewCaseForm({...newCaseForm, ref_no:e.target.value})}/></div>
                <div className="form-group"><label>Service Category</label><select value={newCaseForm.case_type} onChange={e => setNewCaseForm({...newCaseForm, case_type:e.target.value})}><option>Civil Disputes</option><option>Conveyancing & Land</option><option>Corporate Law</option><option>Family Law</option><option>Criminal Defense</option><option>Employment Law</option><option>Succession</option><option>Litigation</option></select></div>
                <div className="form-group"><label>Assign to Lawyer</label><select value={newCaseForm.assigned_lawyer} onChange={e => setNewCaseForm({...newCaseForm, assigned_lawyer:e.target.value})}>{LAWYERS.map(l => <option key={l}>{l}</option>)}</select></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Custom KYC Details</label><textarea rows="2" placeholder="e.g. Company Reg No" value={newCaseForm.custom_kyc} onChange={e => setNewCaseForm({...newCaseForm, custom_kyc:e.target.value})}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Tracking Reference Token (Initials/Count/Year)</label><input placeholder="Generating reference token..." value={newCaseForm.tracking_token} onChange={e => setNewCaseForm({...newCaseForm, tracking_token:e.target.value})}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label className="checkbox-label" style={{marginTop:'8px'}}><input type="checkbox" checked={newCaseForm.is_sensitive} onChange={e => setNewCaseForm({...newCaseForm, is_sensitive:e.target.checked})}/> 🔒 Mark as Highly Sensitive Case (Family Law, High-Profile)</label></div>
              </div>
              <ConflictBanner />
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => { setShowNewCaseModal(false); setConflictResults([]); setConflictQuery(''); }}>Cancel</button><button type="submit" className="primary-btn">Generate Case & Token</button></div>
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
              <div className="form-group"><label>Assign to Lawyer</label><select value={leadActionForm.assigned_lawyer} onChange={e => setLeadActionForm({...leadActionForm, assigned_lawyer:e.target.value})}>{LAWYERS.map(l => <option key={l}>{l}</option>)}</select></div>
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
            <h2 className="modal-title">{editingEvent ? 'Edit Court Date' : 'Add Court Date / Event'}</h2>
            <form onSubmit={handleAddEvent}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Case *</label>
                  <select required value={newEventForm.case_id} disabled={!!editingEvent} onChange={e => setNewEventForm({...newEventForm, case_id:e.target.value})}>
                    <option value="">Select case…</option>
                    {cases.filter(c => c.current_milestone !== 'CLOSED' || c.id === newEventForm.case_id).map(c => <option key={c.id} value={c.id}>{c.client_name} — {c.case_title}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Event Type</label><select value={newEventForm.event_type} onChange={e => setNewEventForm({...newEventForm, event_type:e.target.value})}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Event Title *</label><input required placeholder="e.g. Hearing Phase Mention — XYZ vs Republic" value={newEventForm.event_title} onChange={e => setNewEventForm({...newEventForm, event_title:e.target.value})}/></div>
                <div className="form-group"><label>Date & Time *</label><input type="datetime-local" required value={newEventForm.event_date} onChange={e => setNewEventForm({...newEventForm, event_date:e.target.value})}/></div>
                <div className="form-group"><label>Notes / Venue</label><input placeholder="e.g. Milimani Court, Room 4B" value={newEventForm.notes} onChange={e => setNewEventForm({...newEventForm, notes:e.target.value})}/></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => { setShowAddEventModal(false); setEditingEvent(null); }}>Cancel</button>
                <button type="submit" className="primary-btn">{editingEvent ? 'Save Changes' : 'Save Court Date'}</button>
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
                <div className="form-group"><label>Recorded By</label><select value={newExpenseForm.recorded_by} onChange={e => setNewExpenseForm({...newExpenseForm, recorded_by:e.target.value})}><option>Secretary</option>{LAWYERS.map(l => <option key={l}>{l}</option>)}</select></div>
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
              <div className="doc-body" style={{whiteSpace: 'pre-wrap'}}>
                {editedDocContent}
              </div>
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

    </div>
  );
}

export default App;
