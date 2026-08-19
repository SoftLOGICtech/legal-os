// JudiciaryIngestionModal.jsx — Multi-Portal Judiciary Ingestion & Identification Engine Modal
import React, { useState, useRef } from 'react';
import { BASE, getSession } from '../api';

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
  const [caseTitle, setCaseTitle] = useState('');           // Legal OS Matter Title / Case Ref
  const [docType, setDocType] = useState('RECEIPT');

  // ── SECTION 2: Parties ────────────────────────────────────────────────
  // Plaintiffs / Applicants — supports multiple
  const [plaintiffs, setPlaintiffs] = useState([{ name: '', idNo: '', kraPin: '' }]);
  // Defendants / Respondents — supports multiple
  const [defendants, setDefendants] = useState([{ name: '', counsel: '' }]);
  const [opposingCounselFirm, setOpposingCounselFirm] = useState('');

  // ── SECTION 3: Court & Case Registry ─────────────────────────────────
  const [judiciaryCaseId, setJudiciaryCaseId] = useState('');
  const [courtStation, setCourtStation] = useState('');
  const [courtDivision, setCourtDivision] = useState('');
  const [courtroomNo, setCourtroomNo] = useState('');
  const [assignedJudge, setAssignedJudge] = useState('');

  // ── SECTION 4: Payment & Fee ──────────────────────────────────────────
  const [paymentRef, setPaymentRef] = useState('');
  const [prnNumber, setPrnNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [feeType, setFeeType] = useState('');

  // Payer(s) — supports multiple
  const [payers, setPayers] = useState([{ name: '', idNo: '', phone: '' }]);

  // Payee (who received the money)
  const [payeePaybill, setPayeePaybill] = useState('553388');
  const [payeeAccount, setPayeeAccount] = useState('');
  const [payeeBank, setPayeeBank] = useState('');

  // ── SECTION 5: Document & Scheduling Details ──────────────────────────
  const [mentionDate, setMentionDate] = useState('');
  const [mentionTime, setMentionTime] = useState('');
  const [replyDeadline, setReplyDeadline] = useState('');
  const [virtualCourtLink, setVirtualCourtLink] = useState('');
  const [docNotes, setDocNotes] = useState('');

  // Smart Sync Action Toggles
  const [updateCaseMeta, setUpdateCaseMeta] = useState(true);
  const [createPayment, setCreatePayment] = useState(true);
  const [createInvoice, setCreateInvoice] = useState(true);
  const [advanceMilestone, setAdvanceMilestone] = useState(false);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(false);
  const [createSubmissionDeadline, setCreateSubmissionDeadline] = useState(false);
  const [createDecreeMemo, setCreateDecreeMemo] = useState(false);

  const [showWaPrompt, setShowWaPrompt] = useState(false);
  const fileInputRef = useRef(null);

  // ── Payer row helpers ──
  const addPayer = () => setPayers(p => [...p, { name: '', idNo: '', phone: '' }]);
  const removePayer = (i) => setPayers(p => p.filter((_, idx) => idx !== i));
  const updatePayer = (i, field, val) => setPayers(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  // ── Plaintiff row helpers ──
  const addPlaintiff = () => setPlaintiffs(p => [...p, { name: '', idNo: '', kraPin: '' }]);
  const removePlaintiff = (i) => setPlaintiffs(p => p.filter((_, idx) => idx !== i));
  const updatePlaintiff = (i, field, val) => setPlaintiffs(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  // ── Defendant row helpers ──
  const addDefendant = () => setDefendants(d => [...d, { name: '', counsel: '' }]);
  const removeDefendant = (i) => setDefendants(d => d.filter((_, idx) => idx !== i));
  const updateDefendant = (i, field, val) => setDefendants(d => d.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

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
      setCaseTitle(ext.judiciary_case_id ? `Matter ${ext.judiciary_case_id}` : (ext.client_name ? `${ext.client_name} Matter` : 'eFiling Matter'));
      setPaymentRef(ext.payment_ref || '');
      setPrnNumber(ext.prn_number || '');
      setAmount(ext.amount ? ext.amount.toString() : '');
      setPaymentDate(ext.payment_date || '');

      if (ext.payer_name) {
        setPayers([{ name: ext.payer_name, idNo: ext.id_number || '', phone: '' }]);
      }

      setCourtStation(ext.court_station || '');
      setCourtDivision(ext.court_division || '');
      setCourtroomNo(ext.courtroom_no || '');
      setAssignedJudge(ext.assigned_judge || '');

      if (ext.client_name) {
        setPlaintiffs([{ name: ext.client_name, idNo: ext.id_number || '', kraPin: ext.kra_pin || '' }]);
      }
      if (ext.opposing_party) {
        setDefendants([{ name: ext.opposing_party, counsel: ext.opposing_counsel || '' }]);
      }

      setMentionDate(ext.docType === 'RECEIPT' ? '' : (ext.mention_date || ''));
      setMentionTime(ext.docType === 'RECEIPT' ? '' : (ext.mention_time || ''));
      setReplyDeadline(ext.reply_deadline || '');
      setVirtualCourtLink(ext.virtual_court_link || ext.teams_link || '');

      setCreatePayment(ext.docType === 'RECEIPT' && parseFloat(ext.amount) > 0);
      setCreateInvoice(ext.docType === 'RECEIPT' && parseFloat(ext.amount) > 0);
      setAdvanceMilestone(ext.docType === 'RECEIPT' || ext.docType === 'DECREE_ORDER');
      setCreateCalendarEvent(ext.docType !== 'RECEIPT' && !!ext.mention_date);
      setCreateSubmissionDeadline(!!ext.reply_deadline);
      setCreateDecreeMemo(ext.docType === 'DECREE_ORDER');

      setSelectedCaseId(data.match?.case_id || 'CREATE_NEW');
      const scanNote = ext.isScanned ? ' (OCR Engine)' : '';
      showToast(`📥 Identified: ${ext.subType || ext.docType}${scanNote}!`, 'success');
    } catch (err) {
      showToast(`⚠️ Parsing error: ${err.message}`, 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCaseId) {
      showToast('⚠️ Please select a target case.', 'error');
      return;
    }
    setIngesting(true);
    try {
      const formData = new FormData();
      if (uploadedFile) formData.append('file', uploadedFile);
      formData.append('case_id', selectedCaseId);
      formData.append('case_title', caseTitle);
      formData.append('docType', docType);
      formData.append('judiciary_case_id', judiciaryCaseId);
      formData.append('payment_ref', paymentRef);
      formData.append('prn_number', prnNumber);
      formData.append('payers_json', JSON.stringify(payers));
      formData.append('payer_name', payers[0]?.name || '');
      formData.append('amount', amount);
      formData.append('payment_date', paymentDate);
      formData.append('fee_type', feeType);
      formData.append('payee_paybill', payeePaybill);
      formData.append('payee_account', payeeAccount);
      formData.append('payee_bank', payeeBank);

      formData.append('court_station', courtStation);
      formData.append('court_division', courtDivision);
      formData.append('courtroom_no', courtroomNo);
      formData.append('assigned_judge', assignedJudge);

      formData.append('plaintiffs_json', JSON.stringify(plaintiffs));
      formData.append('defendants_json', JSON.stringify(defendants));
      formData.append('client_name', plaintiffs[0]?.name || '');
      formData.append('id_number', plaintiffs[0]?.idNo || '');
      formData.append('kra_pin', plaintiffs[0]?.kraPin || '');
      formData.append('opposing_party', defendants[0]?.name || '');
      formData.append('opposing_counsel', defendants[0]?.counsel || opposingCounselFirm);

      formData.append('mention_date', mentionDate);
      formData.append('mention_time', mentionTime);
      formData.append('reply_deadline', replyDeadline);
      formData.append('virtual_court_link', virtualCourtLink);
      formData.append('doc_notes', docNotes);

      formData.append('update_case_id', updateCaseMeta);
      formData.append('create_payment', createPayment);
      formData.append('create_invoice', createInvoice);
      formData.append('advance_milestone', advanceMilestone);
      formData.append('create_calendar_event', createCalendarEvent);
      formData.append('create_submission_deadline', createSubmissionDeadline);
      formData.append('create_decree_memo', createDecreeMemo);

      const session = getSession();
      const res = await fetch(`${BASE}/api/judiciary/ingest`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Ingestion failed');

      showToast('🎉 Judiciary Document Ingested & Synced to Legal OS!', 'success');
      if (onIngestSuccess) onIngestSuccess();
      onClose();
    } catch (err) {
      showToast(`⚠️ Ingestion Error: ${err.message}`, 'error');
    } finally {
      setIngesting(false);
    }
  };

  const getWaText = () => {
    const targetCase = cases.find(c => c.id === selectedCaseId);
    const clientDisplay = plaintiffs.map(p => p.name).filter(Boolean).join(' & ') || targetCase?.client_name || 'Client';
    return `Hello ${clientDisplay}, update from Sam Ogola & Co Advocates regarding your matter (${judiciaryCaseId || targetCase?.judiciary_case_id || 'Ref'}). We have processed an official Judiciary eFiling ${docType.replace('_', ' ')}.${mentionDate ? ` Next court date: ${mentionDate}${mentionTime ? ` at ${mentionTime}` : ''} at ${courtStation || 'Court'}.` : ''}${virtualCourtLink ? ` Virtual hearing link: ${virtualCourtLink}` : ''}`;
  };

  const docTypeLabels = {
    RECEIPT: '🧾 Official Judiciary eFiling Receipt (Paybill 553388)',
    PLEADING: '⚖️ Court Pleading / Motion / Urgent Application / Plaint',
    DECREE_ORDER: '📜 Court Decree / Formal Order / Ruling / Judgment',
    MENTION_NOTICE: '🏛️ Court Mention / Hearing Notice / Cause List',
    VIRTUAL_COURT: '💻 Virtual Courtroom Notice (MS Teams Link)',
    CLIENT_KYC: '👤 Client Identification / KYC / Title Deed / Contract',
    CORRESPONDENCE: '✉️ Legal Correspondence / Demand Notice',
    OTHER: '📄 General Court / Legal Document'
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--navy-900)',
    border: '1px solid var(--border-default)',
    color: 'white',
    padding: '7px 10px',
    borderRadius: '6px',
    fontSize: '0.83rem',
    marginTop: '3px'
  };
  const labelStyle = { fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' };
  const cardStyle = {
    background: 'var(--navy-950)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };
  const cardHeadStyle = {
    margin: 0,
    marginBottom: '4px',
    color: 'var(--gold-400)',
    fontSize: '0.88rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '8px'
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(4px)', padding: '12px'
    }}>
      <div style={{
        background: 'var(--navy-900)', border: '1px solid var(--gold-500)', borderRadius: '12px',
        width: '100%', maxWidth: '980px', maxHeight: '94vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.85)', padding: '22px 26px', color: 'white'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.6rem' }}>🏛️</span>
            <div>
              <h3 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.1rem' }}>
                ⚡ Legal OS PDF & Document Engine (with Smart OCR)
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Pleadings & Decrees · Scanned Photocopies · Receipts (Paybill 553388) · Mention Notices · Automated Filing
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Dropzone */}
        {!extractedData ? (
          <div
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragActive ? '2px dashed var(--gold-400)' : '2px dashed rgba(212,175,55,0.4)',
              borderRadius: '10px', background: dragActive ? 'rgba(212,175,55,0.08)' : 'var(--navy-950)',
              padding: '50px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp,.txt" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
            {parsing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '2.2rem', animation: 'spin 1s infinite linear' }}>⚙️</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--gold-400)', fontWeight: 600 }}>Analyzing Document & OCR Text — Extracting Pleadings, Decrees, Parties & CTS Data...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '2.8rem' }}>⚡</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold-400)' }}>Upload or Scan Judiciary Document / Pleading / Decree</div>
                <button type="button" className="primary-btn" style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '24px' }}>
                  📷 Camera Scan / Select PDF or Image File
                </button>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Auto-parses Pleadings · Decrees & Orders · Scanned Court Copies · eFiling Receipts · Mention Notices · Teams Links
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Doc type banner */}
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Uploaded: {extractedData.file_name}</span>
                  {extractedData.isScanned && (
                    <span style={{ background: 'rgba(77,182,172,0.2)', color: '#4db6ac', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>📷 OCR Processed</span>
                  )}
                  {extractedData.subType && (
                    <span style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold-400)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>{extractedData.subType}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--gold-400)', marginTop: '2px' }}>{docTypeLabels[docType] || docType}</div>
              </div>
              <button type="button" className="secondary-btn" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => { setExtractedData(null); setUploadedFile(null); }}>
                🔄 Upload Different Document
              </button>
            </div>

            {/* Case matcher */}
            <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', padding: '14px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold-400)' }}>🎯 Target Legal OS Case (Auto-Matcher Result):</label>
                {matchInfo && (
                  <span className="badge" style={{ background: matchInfo.confidence?.startsWith('HIGH') ? 'rgba(77,182,172,0.2)' : 'rgba(255,255,255,0.1)', color: matchInfo.confidence?.startsWith('HIGH') ? '#4db6ac' : 'var(--gold-400)', fontSize: '0.7rem' }}>
                    {matchInfo.confidence}
                  </span>
                )}
              </div>
              <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} required style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--border-default)', color: 'white', padding: '10px 12px', borderRadius: '6px', fontSize: '0.88rem' }}>
                <option value="CREATE_NEW" style={{ fontWeight: 'bold', color: 'var(--gold-400)' }}>✨ [Create Brand New Matter in Legal OS from eFiling Document]</option>
                {cases?.map(c => (
                  <option key={c.id} value={c.id}>🔗 Link to Existing: {c.client_name} — {c.case_title} ({c.judiciary_case_id || c.tracking_token})</option>
                ))}
              </select>
            </div>
            {/* 🤖 MASTER PROMINENT CARD — SOCA AI EXTRACTED INTELLIGENCE & DETERMINED ACTIONS */}
            <div style={{ background: 'var(--navy-950)', border: '1px solid var(--gold-500)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4db6ac', boxShadow: '0 0 12px #4db6ac' }} />
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold-400)', fontFamily: 'var(--font-display)' }}>
                    🤖 SOCA AI Extracted Intelligence & Determined Actions
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowRawJson(!showRawJson)} 
                    style={{ background: showRawJson ? 'var(--gold-gradient)' : 'rgba(255,255,255,0.06)', color: showRawJson ? 'var(--navy-950)' : 'var(--gold-400)', border: '1px solid var(--gold-500)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    {showRawJson ? '📄 View Badges' : '{ } Raw Extracted JSON'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAdvancedFields(!showAdvancedFields)} 
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    {showAdvancedFields ? '▲ Hide Fine Fields' : '✏️ Edit Fine Fields'}
                  </button>
                </div>
              </div>

              {/* Executive Summary */}
              {extractedData?.summary && (
                <div style={{ fontSize: '0.85rem', color: 'white', background: 'rgba(201,168,76,0.06)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontStyle: 'italic', borderLeft: '4px solid var(--gold-500)', lineHeight: 1.6 }}>
                  "{extractedData.summary}"
                </div>
              )}

              {/* View toggle: RAW JSON or METADATA GRID */}
              {showRawJson ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>RAW GROQ LLM EXTRACTED JSON OBJECT:</div>
                  <pre style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: '8px', fontSize: '0.78rem', color: '#4db6ac', fontFamily: 'var(--font-mono)', overflowX: 'auto', maxHeight: '250px' }}>
                    {JSON.stringify({ extracted: extractedData, match: matchInfo, determined_actions: determinedActions }, null, 2)}
                  </pre>
                </div>
              ) : (
                /* Metadata Key-Value Badges Grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                  {[
                    ['Judiciary Case ID', judiciaryCaseId || extractedData?.judiciary_case_id || '—', '⚖️'],
                    ['Document Type', docTypeLabels[docType] || docType, '📑'],
                    ['Court Station', courtStation || extractedData?.court_station || '—', '🏛️'],
                    ['Scheduled Date / Time', mentionDate ? `${mentionDate} ${mentionTime || ''}` : '—', '📅'],
                    ['Payment Ref / M-Pesa', paymentRef || extractedData?.payment_ref || '—', '💳'],
                    ['Fee Amount', amount ? `KES ${parseFloat(amount).toLocaleString()}` : '—', '💰'],
                    ['Client / Plaintiff', plaintiffs[0]?.name || '—', '👤'],
                    ['Defendant / Opposing', defendants[0]?.name || '—', '⚔️'],
                  ].map(([label, val, icon], bIdx) => (
                    <div key={bIdx} style={{ background: 'var(--navy-900)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '3px' }}>
                        {icon} {label}
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: val !== '—' ? 'white' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Determined Actions List */}
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gold-400)', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>⚡ Proposed System Actions ({determinedActions.filter(a => a.selected !== false).length}/{determinedActions.length} enabled):</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {determinedActions.map((act, idx) => (
                  <div key={act.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', background: 'var(--navy-900)', border: `1px solid ${act.selected !== false ? 'rgba(201,168,76,0.4)' : 'var(--border-default)'}`, borderRadius: '8px', transition: 'all 0.15s' }}>
                    <input 
                      type="checkbox" 
                      checked={act.selected !== false} 
                      onChange={e => {
                        const updated = [...determinedActions];
                        updated[idx].selected = e.target.checked;
                        setDeterminedActions(updated);
                      }}
                      style={{ marginTop: '3px', cursor: 'pointer', transform: 'scale(1.1)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: act.selected !== false ? 'white' : 'var(--text-muted)' }}>
                        {act.title}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {act.description}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--gold-400)', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                      {act.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Collapsible Advanced Field Editing */}
            {showAdvancedFields && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                {/* CARD 1 — PARTIES */}
                <div style={cardStyle}>
                  <h4 style={cardHeadStyle}>👥 Parties — Plaintiffs/Applicants & Defendants/Respondents</h4>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, color: '#4db6ac', fontWeight: 700 }}>✅ Plaintiff(s) / Applicant(s) — Our Client(s)</label>
                      <button type="button" onClick={addPlaintiff} style={{ background: 'rgba(77,182,172,0.15)', border: '1px solid rgba(77,182,172,0.4)', color: '#4db6ac', borderRadius: '4px', padding: '2px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>+ Add Plaintiff</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {plaintiffs.map((p, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                          <div>
                            {i === 0 && <label style={labelStyle}>Full Name</label>}
                            <input type="text" value={p.name} onChange={e => updatePlaintiff(i, 'name', e.target.value)} placeholder="e.g. Primary Client Name" style={{ ...inputStyle, border: '1px solid rgba(77,182,172,0.4)' }} />
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
                            <button type="button" onClick={() => removePlaintiff(i)} style={{ background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.4)', color: '#ef5350', borderRadius: '4px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', marginTop: i === 0 ? '18px' : '0' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, color: '#ef9a9a', fontWeight: 700 }}>⚔️ Defendant(s) / Respondent(s)</label>
                      <button type="button" onClick={addDefendant} style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.35)', color: '#ef9a9a', borderRadius: '4px', padding: '2px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>+ Add Defendant</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {defendants.map((d, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '8px', alignItems: 'end' }}>
                          <div>
                            {i === 0 && <label style={labelStyle}>Full Name / Entity</label>}
                            <input type="text" value={d.name} onChange={e => updateDefendant(i, 'name', e.target.value)} placeholder="e.g. Defendant Name / Company" style={{ ...inputStyle, border: '1px solid rgba(239,83,80,0.35)' }} />
                          </div>
                          <div>
                            {i === 0 && <label style={labelStyle}>Opposing Counsel / Law Firm</label>}
                            <input type="text" value={d.counsel} onChange={e => updateDefendant(i, 'counsel', e.target.value)} placeholder="e.g. Wambua & Co Advocates" style={inputStyle} />
                          </div>
                          {defendants.length > 1 && (
                            <button type="button" onClick={() => removeDefendant(i)} style={{ background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.4)', color: '#ef5350', borderRadius: '4px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.75rem', marginTop: i === 0 ? '18px' : '0' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CARD 2 — COURT */}
                <div style={cardStyle}>
                  <h4 style={cardHeadStyle}>🏛️ Judiciary Case & Court Registry</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ ...labelStyle, color: 'var(--gold-400)', fontWeight: 700 }}>⚖️ Legal OS Matter Title / Case Ref Name</label>
                      <input type="text" value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="e.g. Matter ELC/E102/2026 — Jane Wambui Smith vs Kiambu County" style={{ ...inputStyle, border: '1px solid var(--gold-500)' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Judiciary Case ID</label>
                      <input type="text" value={judiciaryCaseId} onChange={e => setJudiciaryCaseId(e.target.value)} placeholder="e.g. ELC/E102/2026" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Court Station</label>
                      <input type="text" value={courtStation} onChange={e => setCourtStation(e.target.value)} placeholder="e.g. Kiambu Law Courts" style={inputStyle} />
                    </div>
                  </div>
                </div>

                {/* CARD 3 — PAYMENT */}
                <div style={cardStyle}>
                  <h4 style={cardHeadStyle}>💳 Payment, Fee & Payer(s)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Payment Ref / M-Pesa Code</label>
                      <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="e.g. SGH8923JKL" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>PRN / Invoice / Account No</label>
                      <input type="text" value={prnNumber} onChange={e => setPrnNumber(e.target.value)} placeholder="e.g. PRN-2026-9981" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Fee Amount (KES)</label>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 4850" style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Action Toggles */}
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gold-400)', marginBottom: '4px' }}>⚡ Automated Synchronization Actions:</div>
              {[
                [updateCaseMeta, setUpdateCaseMeta, 'Update Judiciary Case ID, Station, Judge & Parties to Case Profile'],
                [createPayment, setCreatePayment, 'Log Court Assessment Fee in Operating Ledger (M-Pesa 553388)'],
                [createInvoice, setCreateInvoice, 'Auto-Generate Paid Invoice from Fee Receipt'],
                [advanceMilestone, setAdvanceMilestone, 'Advance Case to Next Custom Milestone'],
                [createCalendarEvent, setCreateCalendarEvent, 'Auto-Schedule Court Mention on Firm Calendar (with clickable Virtual link)'],
              ].map(([checked, setter, label], idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} />
                  {label}
                </label>
              ))}
              {replyDeadline && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={createSubmissionDeadline} onChange={e => setCreateSubmissionDeadline(e.target.checked)} />
                  Track Reply Deadline ({replyDeadline}) in Submissions Tracker
                </label>
              )}
              {docType === 'DECREE_ORDER' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={createDecreeMemo} onChange={e => setCreateDecreeMemo(e.target.checked)} />
                  Save Starred Court Order Memo to Matter Activity Log
                </label>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="secondary-btn" style={{ borderColor: '#4db6ac', color: '#4db6ac' }} onClick={() => setShowWaPrompt(true)}>
                💬 Preview WhatsApp Alert to Client
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="secondary-btn" onClick={onClose} disabled={ingesting}>Cancel</button>
                <button type="submit" className="primary-btn" style={{ padding: '10px 22px', fontWeight: 700 }} disabled={ingesting}>
                  {ingesting ? 'Ingesting & Syncing...' : '📥 Ingest & Sync to Legal OS'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* WhatsApp modal */}
        {showWaPrompt && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
            <div style={{ background: 'var(--navy-900)', border: '1px solid var(--gold-500)', borderRadius: '10px', width: '100%', maxWidth: '540px', padding: '20px', color: 'white' }}>
              <h4 style={{ margin: 0, color: 'var(--gold-400)', fontSize: '1.05rem', marginBottom: '10px' }}>💬 Confirm WhatsApp Client Update</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Review the auto-generated message before launching WhatsApp Web:</p>
              <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', padding: '12px', borderRadius: '6px', fontSize: '0.82rem', lineHeight: '1.4', color: 'white', marginBottom: '16px' }}>
                {getWaText()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="secondary-btn" onClick={() => setShowWaPrompt(false)}>Cancel</button>
                <button className="primary-btn" onClick={() => {
                  const targetCase = cases.find(c => c.id === selectedCaseId);
                  const phone = (targetCase?.client_phone || '').replace(/\+/g, '');
                  window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(getWaText())}`, '_blank');
                  setShowWaPrompt(false);
                  showToast('💬 WhatsApp Dispatch Launched!', 'info');
                }} style={{ background: '#25D366', color: 'black', fontWeight: 700 }}>
                  💬 Confirm & Open WhatsApp Web
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
