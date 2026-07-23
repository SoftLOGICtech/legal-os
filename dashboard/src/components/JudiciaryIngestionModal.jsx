// JudiciaryIngestionModal.jsx — Multi-Portal Judiciary Ingestion & Identification Engine Modal
import React, { useState, useRef } from 'react';
import { BASE, getSession } from '../api';

export default function JudiciaryIngestionModal({ cases, onClose, onIngestSuccess, showToast }) {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);

  // Editable Form Fields (Prefilled by Regex Extraction Engine)
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [docType, setDocType] = useState('RECEIPT');
  const [judiciaryCaseId, setJudiciaryCaseId] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [prnNumber, setPrnNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [courtStation, setCourtStation] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [mentionDate, setMentionDate] = useState('');
  const [teamsLink, setTeamsLink] = useState('');

  // Sync Toggles
  const [updateCaseMeta, setUpdateCaseMeta] = useState(true);
  const [createPayment, setCreatePayment] = useState(true);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(true);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('⚠️ Please upload a valid PDF document.', 'error');
      return;
    }
    setUploadedFile(file);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const session = getSession();
      const res = await fetch(`${BASE}/api/judiciary/parse-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse PDF');
      }

      const ext = data.extracted;
      setExtractedData(ext);
      setMatchInfo(data.match);

      // Prefill Form Fields
      setDocType(ext.docType || 'RECEIPT');
      setJudiciaryCaseId(ext.judiciary_case_id || '');
      setPaymentRef(ext.payment_ref || '');
      setPrnNumber(ext.prn_number || '');
      setAmount(ext.amount ? ext.amount.toString() : '');
      setCourtStation(ext.court_station || '');
      setIdNumber(ext.id_number || '');
      setKraPin(ext.kra_pin || '');
      setMentionDate(ext.mention_date || '');
      setTeamsLink(ext.teams_link || '');

      if (data.match?.case_id) {
        setSelectedCaseId(data.match.case_id);
      } else {
        setSelectedCaseId('CREATE_NEW');
      }

      showToast(`📥 Successfully identified document as Judiciary ${ext.docType}!`, 'success');

    } catch (err) {
      console.error(err);
      showToast(`⚠️ Parsing error: ${err.message}`, 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCaseId) {
      showToast('⚠️ Please select a target case to associate this document.', 'error');
      return;
    }
    setIngesting(true);

    try {
      const formData = new FormData();
      if (uploadedFile) formData.append('file', uploadedFile);
      formData.append('case_id', selectedCaseId);
      formData.append('docType', docType);
      formData.append('judiciary_case_id', judiciaryCaseId);
      formData.append('payment_ref', paymentRef);
      formData.append('prn_number', prnNumber);
      formData.append('amount', amount);
      formData.append('court_station', courtStation);
      formData.append('id_number', idNumber);
      formData.append('kra_pin', kraPin);
      formData.append('mention_date', mentionDate);
      formData.append('teams_link', teamsLink);
      formData.append('update_case_id', updateCaseMeta);
      formData.append('create_payment', createPayment);
      formData.append('create_calendar_event', createCalendarEvent);

      const session = getSession();
      const res = await fetch(`${BASE}/api/judiciary/ingest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ingestion failed');
      }

      showToast('🎉 Judiciary Document Ingested & Synced to Legal OS!', 'success');
      if (onIngestSuccess) onIngestSuccess();
      onClose();

    } catch (err) {
      console.error(err);
      showToast(`⚠️ Ingestion Error: ${err.message}`, 'error');
    } finally {
      setIngesting(false);
    }
  };

  const docTypeLabels = {
    RECEIPT: '💳 Official Payment Receipt (Paybill 553388)',
    PLEADING: '📑 eFiling Stamped Pleading / Motion',
    MENTION_NOTICE: '🏛️ Court Mention / Hearing Notice',
    VIRTUAL_COURT: '💻 Virtual Courtroom Notice (MS Teams)',
    DECREE_ORDER: '⚖️ Court Order / Decree',
    OTHER: '📄 General Court Document'
  };

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
    }}>
      <div style={{
        background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'12px',
        width:'100%', maxWidth:'780px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 50px rgba(0,0,0,0.8)',
        padding:'24px 28px', color:'white'
      }}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'14px', marginBottom:'20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <span style={{fontSize:'1.6rem'}}>🏛️</span>
            <div>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.15rem'}}>
                Judiciary Multi-Portal Ingestion & Identification Engine
              </h3>
              <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                Auto-parses eFiling Receipts (Paybill 553388), Notices, KYC IDs, and Virtual Court Links.
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>
            ✕
          </button>
        </div>

        {/* Dropzone area */}
        {!extractedData ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragActive ? '2px dashed var(--gold-400)' : '2px dashed rgba(212,175,55,0.4)',
              borderRadius: '10px',
              background: dragActive ? 'rgba(212,175,55,0.1)' : 'var(--navy-950)',
              padding: '50px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '16px'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              style={{display:'none'}}
              onChange={handleFileChange}
            />
            {parsing ? (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}}>
                <div style={{fontSize:'2rem', animation:'spin 1s infinite linear'}}>⚙️</div>
                <div style={{fontSize:'0.95rem', color:'var(--gold-400)', fontWeight:600}}>
                  Parsing eFiling PDF Metadata & Classification Pipeline...
                </div>
                <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>
                  Extracting Judiciary Case IDs, M-Pesa Refs, PRNs, KYC IDs & Mention Dates
                </div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}}>
                <div style={{fontSize:'2.8rem'}}>⚡</div>
                <div style={{fontSize:'1rem', fontWeight:700, color:'var(--gold-400)'}}>
                  Upload or Scan Judiciary Document
                </div>
                <button 
                  type="button" 
                  className="primary-btn" 
                  style={{padding:'10px 20px', fontSize:'0.85rem', fontWeight:700, display:'inline-flex', alignItems:'center', gap:'8px', borderRadius:'24px'}}
                >
                  📷 Camera Scan / Select PDF File
                </button>
                <div style={{fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'4px'}}>
                  Auto-parses eFiling Receipts (Paybill 553388), Mentions, Orders & Virtual Court Links
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Extraction Preview & Form Sync */
          <form onSubmit={handleIngestSubmit} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            {/* Classification & File Header */}
            <div style={{
              background: 'var(--navy-800)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700}}>
                  Uploaded File: {extractedData.file_name}
                </div>
                <div style={{fontSize:'0.95rem', fontWeight:700, color:'var(--gold-400)', marginTop:'2px'}}>
                  {docTypeLabels[docType] || docType}
                </div>
              </div>
              <button
                type="button"
                className="secondary-btn"
                style={{fontSize:'0.75rem', padding:'5px 10px'}}
                onClick={() => { setExtractedData(null); setUploadedFile(null); }}
              >
                🔄 Upload Different PDF
              </button>
            </div>

            {/* Target Case Matcher */}
            <div style={{background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.25)', padding:'14px', borderRadius:'8px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                <label style={{fontSize:'0.85rem', fontWeight:700, color:'var(--gold-400)'}}>
                  🎯 Target Legal OS Case (Auto-Matcher Result):
                </label>
                {matchInfo && (
                  <span className="badge" style={{background: matchInfo.confidence.startsWith('HIGH') ? 'rgba(77,182,172,0.2)' : 'rgba(255,255,255,0.1)', color: matchInfo.confidence.startsWith('HIGH') ? '#4db6ac' : 'var(--gold-400)', fontSize:'0.7rem'}}>
                    {matchInfo.confidence}
                  </span>
                )}
              </div>
              <select
                value={selectedCaseId}
                onChange={e => setSelectedCaseId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--navy-950)',
                  border: '1px solid var(--border-default)',
                  color: 'white',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.88rem'
                }}
                required
              >
                <option value="CREATE_NEW" style={{fontWeight:'bold', color:'var(--gold-400)'}}>
                  ✨ [Create Brand New Matter in Legal OS from eFiling Document]
                </option>
                {cases && cases.map(c => (
                  <option key={c.id} value={c.id}>
                    🔗 Link to Existing: {c.client_name} — {c.case_title} ({c.judiciary_case_id || c.tracking_token})
                  </option>
                ))}
              </select>
            </div>

            {/* Extracted Metadata Grid */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'12px'}}>
              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Judiciary Case ID:</label>
                <input
                  type="text"
                  value={judiciaryCaseId}
                  onChange={e => setJudiciaryCaseId(e.target.value)}
                  placeholder="e.g. ECCC/E045/2024"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Payment Ref / M-Pesa Code:</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. SGH8923JKL"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>PRN / Account No:</label>
                <input
                  type="text"
                  value={prnNumber}
                  onChange={e => setPrnNumber(e.target.value)}
                  placeholder="e.g. PRN-2026-9981"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Fee Amount (KES):</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 3450"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Court Station:</label>
                <input
                  type="text"
                  value={courtStation}
                  onChange={e => setCourtStation(e.target.value)}
                  placeholder="e.g. Milimani Law Courts"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Client National ID / Passport:</label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={e => setIdNumber(e.target.value)}
                  placeholder="e.g. 34892019"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Client KRA PIN:</label>
                <input
                  type="text"
                  value={kraPin}
                  onChange={e => setKraPin(e.target.value)}
                  placeholder="e.g. A019283749B"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>

              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>Upcoming Mention / Hearing Date:</label>
                <input
                  type="text"
                  value={mentionDate}
                  onChange={e => setMentionDate(e.target.value)}
                  placeholder="e.g. 28th August 2026 or 2026-08-28"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.85rem', marginTop:'4px'}}
                />
              </div>
            </div>

            {/* Virtual Court Link (if present) */}
            {teamsLink && (
              <div style={{background:'rgba(77,182,172,0.1)', border:'1px solid rgba(77,182,172,0.3)', padding:'10px 14px', borderRadius:'6px', fontSize:'0.8rem'}}>
                <strong style={{color:'#4db6ac'}}>💻 Virtual Courtroom MS Teams Link Detected:</strong>
                <div style={{wordBreak:'break-all', fontFamily:'monospace', fontSize:'0.72rem', color:'white', marginTop:'4px'}}>
                  {teamsLink}
                </div>
              </div>
            )}

            {/* Action Toggles */}
            <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', padding:'14px', borderRadius:'8px', display:'flex', flexDirection:'column', gap:'8px'}}>
              <div style={{fontSize:'0.8rem', fontWeight:700, color:'var(--gold-400)', marginBottom:'4px'}}>
                ⚡ Automated Synchronization Actions:
              </div>
              <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.8rem', cursor:'pointer'}}>
                <input type="checkbox" checked={updateCaseMeta} onChange={e => setUpdateCaseMeta(e.target.checked)} />
                Update Judiciary Case ID, Station, ID & KRA PIN on target case
              </label>
              <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.8rem', cursor:'pointer'}}>
                <input type="checkbox" checked={createPayment} onChange={e => setCreatePayment(e.target.checked)} />
                Log Court Assessment Fee in Operating & Disbursement Ledgers (M-Pesa 553388)
              </label>
              <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.8rem', cursor:'pointer'}}>
                <input type="checkbox" checked={createCalendarEvent} onChange={e => setCreateCalendarEvent(e.target.checked)} />
                Auto-Schedule Court Mention / Hearing on Firm Calendar
              </label>
            </div>

            {/* Actions */}
            <div style={{display:'flex', justifyContent:'flex-end', gap:'12px', marginTop:'10px'}}>
              <button type="button" className="secondary-btn" onClick={onClose} disabled={ingesting}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" style={{padding:'10px 20px', fontWeight:700}} disabled={ingesting}>
                {ingesting ? 'Ingesting & Syncing...' : '📥 Ingest & Sync to Legal OS Ecosystem'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
