// JudiciaryIngestionModal.jsx — Legal OS PDF Engine & Intelligent Matter Ingestion Modal
import React, { useState, useRef } from 'react';
import { BASE, getSession } from '../api';
import {
  IngestionIcon, ScalesIcon, CalendarIcon, LedgerIcon, DocumentIcon,
  CheckIcon, ShieldIcon, ClockIcon, SettingsIcon, WhatsAppIcon, UsersIcon, UserIcon, EditIcon
} from './Icons';

export default function JudiciaryIngestionModal({ cases = [], onClose, onIngestSuccess, showToast }) {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [determinedActions, setDeterminedActions] = useState([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  // ── SECTION 1: Matter & Target Case Selection ─────────────────────────
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [docType, setDocType] = useState('CORRESPONDENCE');
  const [causeOfAction, setCauseOfAction] = useState('');
  const [keyQuote, setKeyQuote] = useState('');

  // ── SECTION 2: Parties & Opposing Counsel ─────────────────────────────
  const [plaintiffs, setPlaintiffs] = useState([{ name: '', idNo: '', kraPin: '' }]);
  const [defendants, setDefendants] = useState([{ name: '', counsel: '' }]);
  const [opposingCounselName, setOpposingCounselName] = useState('');
  const [opposingCounselFirm, setOpposingCounselFirm] = useState('');
  const [opposingCounselPhone, setOpposingCounselPhone] = useState('');
  const [opposingCounselEmail, setOpposingCounselEmail] = useState('');
  const [opposingCounselAddress, setOpposingCounselAddress] = useState('');

  // ── SECTION 3: Court & Case Registry ─────────────────────────────────
  const [judiciaryCaseId, setJudiciaryCaseId] = useState('');
  const [courtStation, setCourtStation] = useState('');
  const [courtDivision, setCourtDivision] = useState('');
  const [courtroomNo, setCourtroomNo] = useState('');
  const [assignedJudge, setAssignedJudge] = useState('');
  const [suitValue, setSuitValue] = useState('');

  // ── SECTION 4: Payment & Fee ──────────────────────────────────────────
  const [paymentRef, setPaymentRef] = useState('');
  const [prnNumber, setPrnNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [feeType, setFeeType] = useState('');

  // ── SECTION 5: Document & Scheduling Details ──────────────────────────
  const [mentionDate, setMentionDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [virtualCourtLink, setVirtualCourtLink] = useState('');
  const [docNotes, setDocNotes] = useState('');

  // ── SECTION 6: Dynamic Custom Fields (User Requirement) ───────────────
  const [customFields, setCustomFields] = useState([]);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [newCustomCat, setNewCustomCat] = useState('Property');
  const [showAddCustomRow, setShowAddCustomRow] = useState(false);

  // Smart Sync Action Toggles
  const [updateCaseMeta, setUpdateCaseMeta] = useState(true);
  const [saveCustomFields, setSaveCustomFields] = useState(true);
  const [addFactLog, setAddFactLog] = useState(true);
  const [createPayment, setCreatePayment] = useState(false);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(false);

  const [showWaPrompt, setShowWaPrompt] = useState(false);
  const fileInputRef = useRef(null);

  const addPlaintiff = () => setPlaintiffs(p => [...p, { name: '', idNo: '', kraPin: '' }]);
  const removePlaintiff = (i) => setPlaintiffs(p => p.filter((_, idx) => idx !== i));
  const updatePlaintiff = (i, field, val) => setPlaintiffs(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const addDefendant = () => setDefendants(d => [...d, { name: '', counsel: '' }]);
  const removeDefendant = (i) => setDefendants(d => d.filter((_, idx) => idx !== i));
  const updateDefendant = (i, field, val) => setDefendants(d => d.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const addCustomField = () => {
    if (!newCustomKey.trim() || !newCustomVal.trim()) return;
    setCustomFields(cf => [...cf, { key: newCustomKey.trim(), value: newCustomVal.trim(), category: newCustomCat }]);
    setNewCustomKey('');
    setNewCustomVal('');
    setShowAddCustomRow(false);
  };

  const removeCustomField = (index) => {
    setCustomFields(cf => cf.filter((_, idx) => idx !== index));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const processFile = async (file) => {
    if (!file) return;
    setUploadedFile(file);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const session = getSession();
      const res = await fetch(`${BASE}/api/judiciary/parse-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to parse document');
      const ext = data.extracted;
      setExtractedData(ext);
      setMatchInfo(data.match);
      setDeterminedActions(data.determined_actions || []);

      setDocType(ext.docType || 'OTHER');
      setJudiciaryCaseId(ext.judiciary_case_id || '');
      setCourtStation(ext.court_station || '');
      setCourtDivision(ext.court_division || '');
      setCourtroomNo(ext.courtroom_no || '');
      setAssignedJudge(ext.assigned_judge || ext.judge_or_coram || '');
      setCauseOfAction(ext.cause_of_action || '');
      setKeyQuote(ext.key_quote || '');

      setOpposingCounselName(ext.opposing_counsel_name || '');
      setOpposingCounselFirm(ext.opposing_counsel_firm || '');
      setOpposingCounselPhone(ext.opposing_counsel_phone || '');
      setOpposingCounselEmail(ext.opposing_counsel_email || '');
      setOpposingCounselAddress(ext.opposing_counsel_address || '');

      setPaymentRef(ext.payment_ref || '');
      setPrnNumber(ext.prn_number || '');
      setAmount(ext.amount ? String(ext.amount) : '');
      setSuitValue(ext.suit_value ? String(ext.suit_value) : (ext.amount ? String(ext.amount) : ''));
      setPaymentDate(ext.payment_date || '');
      setFeeType(ext.fee_type || '');

      setMentionDate(ext.mention_date || '');
      setDeadlineDate(ext.deadline_date || '');
      setVirtualCourtLink(ext.teams_link || ext.virtual_court_link || '');
      setDocNotes(ext.summary || ext.notes || '');

      // Dynamic Custom Fields
      if (Array.isArray(ext.custom_fields) && ext.custom_fields.length > 0) {
        setCustomFields(ext.custom_fields);
      } else {
        setCustomFields([]);
      }

      if (ext.plaintiffs && Array.isArray(ext.plaintiffs) && ext.plaintiffs.length > 0) {
        setPlaintiffs(ext.plaintiffs.map(p => ({
          name: p.name || (typeof p === 'string' ? p : ''),
          idNo: p.id_no || p.idNo || '',
          kraPin: p.kra_pin || p.kraPin || ''
        })));
      } else if (ext.client_name) {
        setPlaintiffs([{ name: ext.client_name, idNo: ext.id_number || '', kraPin: ext.kra_pin || '' }]);
      }

      if (ext.defendants && Array.isArray(ext.defendants) && ext.defendants.length > 0) {
        setDefendants(ext.defendants.map(d => ({
          name: d.name || (typeof d === 'string' ? d : ''),
          counsel: d.counsel || ext.opposing_counsel_firm || ''
        })));
      } else if (ext.opposing_party) {
        setDefendants([{ name: ext.opposing_party, counsel: ext.opposing_counsel_firm || '' }]);
      }

      if (data.match?.case_id) {
        setSelectedCaseId(data.match.case_id);
        const existing = cases.find(c => c.id === data.match.case_id);
        if (existing) setCaseTitle(existing.case_title);
      } else {
        setSelectedCaseId('CREATE_NEW');
        const primaryPl = ext.client_name || (ext.plaintiffs?.[0]?.name) || 'Client';
        const primaryDef = ext.opposing_party || (ext.defendants?.[0]?.name) || 'Opposing Party';
        const suitId = ext.judiciary_case_id ? ` [${ext.judiciary_case_id}]` : '';
        setCaseTitle(ext.case_title || `${primaryPl} vs. ${primaryDef}${suitId}`);
      }

      if (ext.mention_date || ext.deadline_date) setCreateCalendarEvent(true);
      if (ext.payment_ref && ext.amount > 0) setCreatePayment(true);
      if (ext.key_quote || ext.summary) setAddFactLog(true);

      showToast('Document analyzed & PDF Engine extraction docket ready.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
      setUploadedFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    if (!uploadedFile && !extractedData) return;
    setIngesting(true);
    try {
      const formData = new FormData();
      if (uploadedFile) formData.append('file', uploadedFile);
      
      const primaryClient = plaintiffs[0]?.name || extractedData?.client_name || 'Client';
      const primaryOpposing = defendants[0]?.name || extractedData?.opposing_party || 'Opposing Party';

      formData.append('case_id', selectedCaseId);
      formData.append('case_title', caseTitle);
      formData.append('docType', docType);
      formData.append('judiciary_case_id', judiciaryCaseId);
      formData.append('court_station', courtStation);
      formData.append('court_division', courtDivision);
      formData.append('assigned_judge', assignedJudge);
      formData.append('client_name', primaryClient);
      formData.append('opposing_party', primaryOpposing);
      formData.append('opposing_counsel_name', opposingCounselName);
      formData.append('opposing_counsel_firm', opposingCounselFirm);
      formData.append('opposing_counsel_phone', opposingCounselPhone);
      formData.append('opposing_counsel_email', opposingCounselEmail);
      formData.append('opposing_counsel_address', opposingCounselAddress);
      formData.append('cause_of_action', causeOfAction);
      formData.append('key_quote', keyQuote);
      formData.append('case_brief', keyQuote || docNotes);
      formData.append('suit_value', suitValue || amount || 0);
      formData.append('payment_ref', paymentRef);
      formData.append('prn_number', prnNumber);
      formData.append('amount', parseFloat(amount) || 0);
      formData.append('mention_date', mentionDate || deadlineDate);
      formData.append('teams_link', virtualCourtLink);
      formData.append('id_number', plaintiffs[0]?.idNo || '');
      formData.append('kra_pin', plaintiffs[0]?.kraPin || '');
      formData.append('custom_fields', JSON.stringify(customFields));

      formData.append('update_case_id', updateCaseMeta);
      formData.append('create_payment', createPayment);
      formData.append('create_calendar_event', createCalendarEvent);
      formData.append('add_fact', addFactLog);

      const session = getSession();
      const res = await fetch(`${BASE}/api/judiciary/ingest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Ingestion failed');

      showToast(`Matter updated successfully via PDF Engine!`, 'success');
      if (onIngestSuccess) onIngestSuccess(data);
      onClose();
    } catch (err) {
      showToast(`Ingestion Error: ${err.message}`, 'error');
    } finally {
      setIngesting(false);
    }
  };

  const getWaText = () => {
    const targetCase = cases.find(c => c.id === selectedCaseId);
    const clientDisplay = plaintiffs.map(p => p.name).filter(Boolean).join(' & ') || targetCase?.client_name || 'Client';
    return `Hello ${clientDisplay}, update from Sam Ogola & Co Advocates regarding your matter (${judiciaryCaseId || targetCase?.judiciary_case_id || 'Ref'}). We have processed your legal document (${docType.replace('_', ' ')}).${mentionDate ? ` Scheduled court date: ${mentionDate} at ${courtStation || 'Court'}.` : ''}${virtualCourtLink ? ` Virtual hearing link: ${virtualCourtLink}` : ''}`;
  };

  const docTypeLabels = {
    RECEIPT: 'Judiciary eFiling Receipt (Paybill 553388)',
    PLEADING: 'Court Pleading / Motion / Plaint / Chamber Summons',
    DECREE_ORDER: 'Court Decree / Injunction Order / Ruling / Judgment',
    MENTION_NOTICE: 'Court Mention / Hearing Notice / Cause List',
    VIRTUAL_COURT: 'Virtual Courtroom Instructions (MS Teams)',
    CLIENT_KYC: 'Client Identification / KYC / Title Deed / Contract',
    CORRESPONDENCE: 'Formal Letter of Demand / Legal Correspondence',
    OTHER: 'General Legal Document / Court Filing'
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--navy-950)',
    border: '1px solid var(--border-default)',
    color: 'white',
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm, 3px)',
    fontSize: '0.82rem',
    marginTop: '3px'
  };
  const labelStyle = { fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 };
  const cardStyle = {
    background: 'var(--navy-950)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm, 3px)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };
  const cardHeadStyle = {
    margin: 0,
    marginBottom: '4px',
    color: 'var(--gold-400)',
    fontSize: '0.86rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '8px'
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(6px)', padding: '16px'
    }}>
      <div style={{
        background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)',
        width: '100%', maxWidth: '980px', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-navy, 0 4px 20px rgba(0,0,0,0.6))', padding: '24px 28px', color: 'white'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IngestionIcon size={18} color="var(--gold-400)" />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.05rem', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
                Legal OS PDF Engine & Active Matter Ingestion
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Universal Multi-Format Document Extraction, Dynamic Attribute Discovery & Active Matter Sync
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Dropzone */}
        {!extractedData ? (
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragActive ? '2px dashed var(--gold-400)' : '2px dashed rgba(201,168,76,0.3)',
              borderRadius: 'var(--radius-md, 4px)', background: dragActive ? 'rgba(201,168,76,0.06)' : 'var(--navy-950)',
              padding: '48px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp,.txt" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
            {parsing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', border: '2px solid var(--gold-400)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: '0.9rem', color: 'var(--gold-400)', fontWeight: 600 }}>PDF Engine Analyzing Document & Discovering Custom Attributes...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <IngestionIcon size={36} color="var(--gold-400)" />
                <div style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--gold-400)' }}>Select or Drop Any Legal Letter, Court Pleading or Document</div>
                <button type="button" className="primary-btn" style={{ padding: '8px 18px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Browse File (PDF, DOCX, Scanned Image)
                </button>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Extracts Quotes, Plaintiffs vs Defendants, Opposing Counsel, Custom Fields & Court Deadlines
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Doc type banner */}
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Source File: {extractedData.file_name}</span>
                  {extractedData.isScanned && (
                    <span style={{ background: 'rgba(77,182,172,0.15)', color: '#4db6ac', padding: '2px 6px', borderRadius: '2px', fontSize: '0.65rem' }}>OCR Scanned</span>
                  )}
                  {extractedData.subType && (
                    <span style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold-400)', padding: '2px 6px', borderRadius: '2px', fontSize: '0.65rem' }}>{extractedData.subType}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--gold-400)', marginTop: '2px' }}>{docTypeLabels[docType] || docType}</div>
              </div>
              <button type="button" className="secondary-btn" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => { setExtractedData(null); setUploadedFile(null); }}>
                Upload Different File
              </button>
            </div>

            {/* Target Case Selector */}
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: 'var(--radius-sm, 3px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gold-400)' }}>Target Active Matter in Legal OS:</label>
                {matchInfo && (
                  <span className="badge" style={{ background: matchInfo.confidence?.startsWith('HIGH') ? 'rgba(77,182,172,0.15)' : 'rgba(255,255,255,0.06)', color: matchInfo.confidence?.startsWith('HIGH') ? '#4db6ac' : 'var(--gold-400)', fontSize: '0.7rem' }}>
                    Match: {matchInfo.confidence}
                  </span>
                )}
              </div>
              <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} required style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', color: 'white', padding: '9px 12px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.86rem' }}>
                <option value="CREATE_NEW" style={{ fontWeight: 'bold', color: 'var(--gold-400)' }}>[+ Initialize Brand New Active Matter from Document]</option>
                {cases?.map(c => (
                  <option key={c.id} value={c.id}>Update Active Matter: #{c.id} — {c.client_name} ({c.case_title}) [{c.judiciary_case_id || c.tracking_token}]</option>
                ))}
              </select>
            </div>

            {/* Core Extracted Intelligence & Quote */}
            <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldIcon size={16} color="var(--gold-400)" />
                  <span style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--gold-400)' }}>
                    Document Intelligence & Key Quote
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowRawJson(!showRawJson)} 
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', padding: '4px 10px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    {showRawJson ? 'Structured View' : '{ } Raw JSON'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAdvancedFields(!showAdvancedFields)} 
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', padding: '4px 10px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    {showAdvancedFields ? 'Hide Field Editor' : 'Edit All Fields'}
                  </button>
                </div>
              </div>

              {/* Verbatim Key Quote from Document / Letter */}
              {keyQuote ? (
                <div style={{ marginBottom: '14px', background: 'rgba(201,168,76,0.06)', borderLeft: '3px solid var(--gold-500)', padding: '12px 14px', borderRadius: 'var(--radius-sm, 3px)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--gold-400)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Verbatim Document Excerpt / Demand Quote
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'white', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{keyQuote}"
                  </div>
                </div>
              ) : extractedData?.summary && (
                <div style={{ marginBottom: '14px', background: 'rgba(201,168,76,0.04)', borderLeft: '3px solid var(--gold-500)', padding: '12px 14px', borderRadius: 'var(--radius-sm, 3px)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--gold-400)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Executive Document Synopsis
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'white', lineHeight: 1.5 }}>
                    {extractedData.summary}
                  </div>
                </div>
              )}

              {/* High-Level Extraction Matrix */}
              {!showRawJson && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  {[
                    ['Client / Plaintiff', plaintiffs[0]?.name || extractedData?.client_name || '—'],
                    ['Defendant / Opposing', defendants[0]?.name || extractedData?.opposing_party || '—'],
                    ['Opposing Law Firm', opposingCounselFirm || extractedData?.opposing_counsel_firm || '—'],
                    ['Cause of Action', causeOfAction || extractedData?.cause_of_action || '—'],
                    ['Judiciary Case ID', judiciaryCaseId || extractedData?.judiciary_case_id || '—'],
                    ['Court Station', courtStation || extractedData?.court_station || '—'],
                    ['Scheduled Mention / Deadline', mentionDate || deadlineDate || '—'],
                    ['Claim / Suit Value', suitValue ? `KES ${parseFloat(suitValue).toLocaleString()}` : (amount ? `KES ${parseFloat(amount).toLocaleString()}` : '—')],
                  ].map(([label, val], bIdx) => (
                    <div key={bIdx} style={{ background: 'var(--navy-900)', border: '1px solid rgba(255,255,255,0.06)', padding: '9px 12px', borderRadius: 'var(--radius-sm, 3px)' }}>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px', fontWeight: 600 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: val !== '—' ? 'white' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── SECTION: AI-DISCOVERED DYNAMIC CUSTOM FIELDS (User's core requirement) ── */}
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Discovered Custom Attributes ({customFields.length})
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      (Dynamic fields extracted specific to this document)
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowAddCustomRow(!showAddCustomRow)}
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold-500)', color: 'var(--gold-400)', padding: '3px 10px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Add Custom Attribute
                  </button>
                </div>

                {/* Inline Add Custom Attribute Row */}
                {showAddCustomRow && (
                  <div style={{ background: 'var(--navy-900)', border: '1px dashed var(--gold-500)', padding: '10px 12px', borderRadius: 'var(--radius-sm, 3px)', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                    <input 
                      placeholder="Attribute Name (e.g. Land Title No)" 
                      value={newCustomKey} 
                      onChange={e => setNewCustomKey(e.target.value)} 
                      style={inputStyle} 
                    />
                    <input 
                      placeholder="Extracted Value (e.g. L.R. NO. 209/1284)" 
                      value={newCustomVal} 
                      onChange={e => setNewCustomVal(e.target.value)} 
                      style={inputStyle} 
                    />
                    <select 
                      value={newCustomCat} 
                      onChange={e => setNewCustomCat(e.target.value)} 
                      style={{ ...inputStyle, padding: '6px' }}
                    >
                      <option>Property</option>
                      <option>Contract</option>
                      <option>Financial</option>
                      <option>Procedural</option>
                      <option>Evidence</option>
                      <option>Identity</option>
                    </select>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={addCustomField} className="primary-btn" style={{ padding: '6px 10px', fontSize: '0.74rem' }}>Save</button>
                      <button type="button" onClick={() => setShowAddCustomRow(false)} className="secondary-btn" style={{ padding: '6px 8px', fontSize: '0.74rem' }}>✕</button>
                    </div>
                  </div>
                )}

                {customFields.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    No dynamic custom fields detected. Click "+ Add Custom Attribute" to add matter-specific attributes.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    {customFields.map((f, fIdx) => (
                      <div key={fIdx} style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 'var(--radius-sm, 3px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                              {f.category || 'Attribute'}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--gold-400)', fontWeight: 600 }}>
                              {f.key}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'white', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.value}
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeCustomField(fIdx)} 
                          title="Delete attribute"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 6px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── SECTION: DETERMINED ACTIVE MATTER ACTIONS (User's core requirement) ── */}
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gold-400)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Determined Actions to Effect on Active Matter:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--navy-900)', border: `1px solid ${updateCaseMeta ? 'rgba(201,168,76,0.4)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm, 3px)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={updateCaseMeta} onChange={e => setUpdateCaseMeta(e.target.checked)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: updateCaseMeta ? 'white' : 'var(--text-muted)' }}>
                        Sync & Update Matter Details & Opposing Counsel
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Updates Court Station ({courtStation || 'Court'}), Judiciary Case ID ({judiciaryCaseId || 'Ref'}), Opposing Counsel ({opposingCounselFirm || opposingCounselName || 'Counsel'}), and Cause of Action
                      </div>
                    </div>
                  </label>

                  {customFields.length > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--navy-900)', border: `1px solid ${saveCustomFields ? 'rgba(201,168,76,0.4)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm, 3px)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={saveCustomFields} onChange={e => setSaveCustomFields(e.target.checked)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: saveCustomFields ? 'white' : 'var(--text-muted)' }}>
                          Attach {customFields.length} Discovered Custom Attributes to Matter Dossier
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Persists attributes ({customFields.map(f => f.key).slice(0, 3).join(', ')}) into client KYC and matter record
                        </div>
                      </div>
                    </label>
                  )}

                  {(keyQuote || docNotes) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--navy-900)', border: `1px solid ${addFactLog ? 'rgba(201,168,76,0.4)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm, 3px)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={addFactLog} onChange={e => setAddFactLog(e.target.checked)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: addFactLog ? 'white' : 'var(--text-muted)' }}>
                          Log Verbatim Quote & Dispute Fact into Case Chronology
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Locks excerpt into matter's extracted chronology facts table
                        </div>
                      </div>
                    </label>
                  )}

                  {(mentionDate || deadlineDate) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--navy-900)', border: `1px solid ${createCalendarEvent ? 'rgba(201,168,76,0.4)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm, 3px)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={createCalendarEvent} onChange={e => setCreateCalendarEvent(e.target.checked)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: createCalendarEvent ? 'white' : 'var(--text-muted)' }}>
                          Schedule Court Mention / Deadline ({mentionDate || deadlineDate})
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Creates court appearance reminder on Master Calendar{virtualCourtLink ? ' with MS Teams link' : ''}
                        </div>
                      </div>
                    </label>
                  )}

                  {paymentRef && amount && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--navy-900)', border: `1px solid ${createPayment ? 'rgba(201,168,76,0.4)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm, 3px)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={createPayment} onChange={e => setCreatePayment(e.target.checked)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: createPayment ? 'white' : 'var(--text-muted)' }}>
                          Record Payment Ref ({paymentRef}) — KES {parseFloat(amount).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Logs disbursement and payment record in operating ledger
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Collapsible Advanced Field Editing */}
            {showAdvancedFields && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                {/* CARD 1 — PARTIES & OPPOSING COUNSEL */}
                <div style={cardStyle}>
                  <h4 style={cardHeadStyle}>
                    <UsersIcon size={14} color="var(--gold-400)" />
                    <span>Parties & Opposing Counsel Records</span>
                  </h4>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, color: '#4db6ac' }}>Plaintiff(s) / Applicant(s) — Client Record</label>
                      <button type="button" onClick={addPlaintiff} style={{ background: 'rgba(77,182,172,0.12)', border: '1px solid rgba(77,182,172,0.3)', color: '#4db6ac', borderRadius: 'var(--radius-sm, 3px)', padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>+ Add Plaintiff</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {plaintiffs.map((p, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                          <div>
                            {i === 0 && <label style={labelStyle}>Full Name</label>}
                            <input type="text" value={p.name} onChange={e => updatePlaintiff(i, 'name', e.target.value)} placeholder="e.g. Primary Client Name" style={{ ...inputStyle, border: '1px solid rgba(77,182,172,0.3)' }} />
                          </div>
                          <div>
                            {i === 0 && <label style={labelStyle}>National ID / Passport</label>}
                            <input type="text" value={p.idNo} onChange={e => updatePlaintiff(i, 'idNo', e.target.value)} placeholder="e.g. 34892019" style={inputStyle} />
                          </div>
                          <div>
                            {i === 0 && <label style={labelStyle}>KRA PIN</label>}
                            <input type="text" value={p.kraPin} onChange={e => updatePlaintiff(i, 'kraPin', e.target.value)} placeholder="e.g. A019283749B" style={inputStyle} />
                          </div>
                          {plaintiffs.length > 1 && (
                            <button type="button" onClick={() => removePlaintiff(i)} style={{ background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.4)', color: '#ef5350', borderRadius: 'var(--radius-sm, 3px)', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, color: '#ef9a9a' }}>Defendant(s) / Respondent(s)</label>
                      <button type="button" onClick={addDefendant} style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', color: '#ef9a9a', borderRadius: 'var(--radius-sm, 3px)', padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>+ Add Defendant</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {defendants.map((d, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '8px', alignItems: 'end' }}>
                          <div>
                            {i === 0 && <label style={labelStyle}>Full Name / Entity</label>}
                            <input type="text" value={d.name} onChange={e => updateDefendant(i, 'name', e.target.value)} placeholder="e.g. Defendant Name / Company" style={{ ...inputStyle, border: '1px solid rgba(239,83,80,0.3)' }} />
                          </div>
                          <div>
                            {i === 0 && <label style={labelStyle}>Opposing Counsel / Law Firm</label>}
                            <input type="text" value={d.counsel} onChange={e => updateDefendant(i, 'counsel', e.target.value)} placeholder="e.g. Wambua & Co Advocates" style={inputStyle} />
                          </div>
                          {defendants.length > 1 && (
                            <button type="button" onClick={() => removeDefendant(i)} style={{ background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.4)', color: '#ef5350', borderRadius: 'var(--radius-sm, 3px)', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Opposing Counsel Deep Profile */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    <label style={{ ...labelStyle, color: 'var(--gold-400)' }}>Opposing Counsel Contact & Service Address</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '6px' }}>
                      <div>
                        <label style={labelStyle}>Advocate Name</label>
                        <input type="text" value={opposingCounselName} onChange={e => setOpposingCounselName(e.target.value)} placeholder="e.g. Senior Counsel S. Otieno" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Firm Name</label>
                        <input type="text" value={opposingCounselFirm} onChange={e => setOpposingCounselFirm(e.target.value)} placeholder="e.g. Otieno & Associates" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Counsel Phone</label>
                        <input type="text" value={opposingCounselPhone} onChange={e => setOpposingCounselPhone(e.target.value)} placeholder="e.g. 0712345678" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Counsel Email</label>
                        <input type="text" value={opposingCounselEmail} onChange={e => setOpposingCounselEmail(e.target.value)} placeholder="e.g. info@otienoadvocates.ke" style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Physical / Service Address</label>
                        <input type="text" value={opposingCounselAddress} onChange={e => setOpposingCounselAddress(e.target.value)} placeholder="e.g. Reinsurance Plaza 4th Floor, Taifa Road" style={inputStyle} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2 — COURT & CAUSE OF ACTION */}
                <div style={cardStyle}>
                  <h4 style={cardHeadStyle}>
                    <ScalesIcon size={14} color="var(--gold-400)" />
                    <span>Judiciary Case, Division & Cause of Action</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ ...labelStyle, color: 'var(--gold-400)' }}>Legal OS Matter Title</label>
                      <input type="text" value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="e.g. Jane Wambui vs Kiambu County" style={{ ...inputStyle, border: '1px solid var(--gold-500)' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Cause of Action / Dispute Subject</label>
                      <input type="text" value={causeOfAction} onChange={e => setCauseOfAction(e.target.value)} placeholder="e.g. Breach of Commercial Lease" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Judiciary Case ID</label>
                      <input type="text" value={judiciaryCaseId} onChange={e => setJudiciaryCaseId(e.target.value)} placeholder="e.g. ELC/E102/2026" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Court Station</label>
                      <input type="text" value={courtStation} onChange={e => setCourtStation(e.target.value)} placeholder="e.g. Milimani Commercial Court" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Assigned Judge / Coram</label>
                      <input type="text" value={assignedJudge} onChange={e => setAssignedJudge(e.target.value)} placeholder="e.g. Hon. Lady Justice Ouko" style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button type="button" className="secondary-btn" style={{ borderColor: '#4db6ac', color: '#4db6ac', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowWaPrompt(true)}>
                <WhatsAppIcon size={14} color="#4db6ac" />
                <span>Preview WhatsApp Client Notice</span>
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="secondary-btn" onClick={onClose} disabled={ingesting}>Cancel</button>
                <button type="submit" className="primary-btn" style={{ padding: '9px 22px', fontWeight: 700 }} disabled={ingesting}>
                  {ingesting ? 'Synchronizing to Matter...' : 'Effect Actions & Ingest Document'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* WhatsApp modal */}
        {showWaPrompt && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
            <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md, 4px)', width: '100%', maxWidth: '540px', padding: '20px', color: 'white' }}>
              <h4 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WhatsAppIcon size={16} color="var(--gold-400)" />
                <span>Confirm Client WhatsApp Notification</span>
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Review the generated client dispatch text before launching WhatsApp:</p>
              <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', padding: '12px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.82rem', lineHeight: '1.4', color: 'white', marginBottom: '16px' }}>
                {getWaText()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="secondary-btn" onClick={() => setShowWaPrompt(false)}>Cancel</button>
                <button className="primary-btn" onClick={() => {
                  const targetCase = cases.find(c => c.id === selectedCaseId);
                  const phone = (targetCase?.client_phone || '').replace(/\+/g, '');
                  window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(getWaText())}`, '_blank');
                  setShowWaPrompt(false);
                  showToast('WhatsApp Dispatch Launched.', 'info');
                }} style={{ background: '#25D366', color: 'black', fontWeight: 700 }}>
                  Launch WhatsApp Dispatch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
