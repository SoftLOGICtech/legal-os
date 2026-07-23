import React, { useState, useEffect } from 'react';
import logoImg from '../logo.png';
import { BASE, getSession } from '../api';

const STUDIO_TEMPLATES = [
  {
    id: 'notice_of_appearance',
    category: 'Court Pleadings',
    title: 'Formal Notice of Appearance',
    description: 'Registers Sam Ogola & Co. Advocates as legal representatives in court.',
    defaultBody: (d) => `REPUBLIC OF KENYA
IN THE ${d.court_station ? d.court_station.toUpperCase() : 'HIGH COURT OF KENYA'}
${d.court_division ? d.court_division.toUpperCase() : 'CIVIL / COMMERCIAL DIVISION'}
JUDICIARY CASE NO: ${d.judiciary_case_id || d.ref_no || '_______________'}

BETWEEN:
${(d.client_name || 'CLIENT').toUpperCase()} ................................................................ PLAINTIFF/APPLICANT
AND
${(d.opposing_party || 'DEFENDANT').toUpperCase()} ................................................................ DEFENDANT/RESPONDENT

NOTICE OF APPEARANCE

TAKE NOTICE that SAM OGOLA & CO. ADVOCATES hereby enters appearance for and on behalf of the ${(d.client_name || 'Client').toUpperCase()} in the above-captioned matter.

DATED at NAIROBI this ${d.current_date}.

__________________________________________
SAM OGOLA & CO. ADVOCATES
ADVOCATES FOR THE ${d.client_name ? d.client_name.toUpperCase() : 'CLIENT'}

DRAWN & FILED BY:
Sam Ogola & Co. Advocates
Anniversary Towers, 6th Floor, University Way
P.O. Box 10293-00100, Nairobi, Kenya
Email: info@samogola.co.ke | Tel: +254 700 000 000

TO BE SERVED UPON:
${d.opposing_counsel_firm || d.opposing_party || 'Opposing Counsel / Party'}`
  },
  {
    id: 'submissions_cover',
    category: 'Court Pleadings',
    title: 'Submissions & Skeleton Arguments Cover',
    description: 'Official cover page for written submissions and legal arguments.',
    defaultBody: (d) => `REPUBLIC OF KENYA
IN THE ${d.court_station ? d.court_station.toUpperCase() : 'HIGH COURT OF KENYA'}
${d.court_division ? d.court_division.toUpperCase() : 'COMMERCIAL DIVISION'}
JUDICIARY CASE ID: ${d.judiciary_case_id || '_______________'}

BETWEEN:
${(d.client_name || 'APPLICANT').toUpperCase()} ................................................................ APPLICANT
AND
${(d.opposing_party || 'RESPONDENT').toUpperCase()} ................................................................ RESPONDENT

PLAINTIFF'S / APPLICANT'S WRITTEN SUBMISSIONS & SKELETON ARGUMENTS

MAY IT PLEASE THIS HONOURABLE COURT:

1. INTRODUCTION & BACKGROUND FACTS:
1.1 The Applicant instituted these proceedings seeking reliefs set out in the Notice of Motion dated ${d.current_date}.
1.2 The Respondent was duly served with pleadings and filed an Answering Affidavit in opposition.

2. ISSUES FOR DETERMINATION:
2.1 Whether the Applicant has satisfied the legal threshold for the grant of injunction orders.
2.2 Who should bear the costs of this application.

3. LEGAL ARGUMENTS & AUTHORITIES:
3.1 On the first issue, it is settled law in Kenya (Giella v Cassman Brown & Co. Ltd [1973] EA 358) that a party seeking interlocutory injunction must establish a prima facie case with a probability of success.

DATED at NAIROBI this ${d.current_date}.

__________________________________________
SAM OGOLA & CO. ADVOCATES
COUNSEL FOR THE APPLICANT`
  },
  {
    id: 'authority_list',
    category: 'Court Pleadings',
    title: 'List of Authorities',
    description: 'Index of statutory provisions and judicial precedents cited.',
    defaultBody: (d) => `REPUBLIC OF KENYA
IN THE ${d.court_station ? d.court_station.toUpperCase() : 'HIGH COURT OF KENYA AT NAIROBI'}
JUDICIARY CASE ID: ${d.judiciary_case_id || '_______________'}

BETWEEN:
${(d.client_name || 'CLIENT').toUpperCase()} ................................................................ PLAINTIFF
AND
${(d.opposing_party || 'DEFENDANT').toUpperCase()} ................................................................ DEFENDANT

PLAINTIFF'S LIST OF AUTHORITIES

The Plaintiff intends to rely upon the following statutes and judicial precedents at the hearing of the application:

STATUTES & CONSTITUTIONAL PROVISIONS:
1. The Constitution of Kenya, 2010 — Article 40 (Protection of Right to Property), Article 50 (Fair Hearing).
2. The Civil Procedure Act (Cap 21, Laws of Kenya) — Section 1A, 1B, & Section 3A.
3. The Advocates Act (Cap 16, Laws of Kenya) & Advocates Remuneration Order.

JUDICIAL PRECEDENTS & CASE LAW:
1. Giella v Cassman Brown & Co. Ltd [1973] EA 358.
2. Mrao Ltd v First American Bank of Kenya Ltd & 2 Others [2003] KLR 125.
3. Nguruman Limited v Jan Bonde Nielsen & 2 Others [2014] eKLR.

DATED at NAIROBI this ${d.current_date}.

__________________________________________
SAM OGOLA & CO. ADVOCATES`
  },
  {
    id: 'intake_agreement',
    category: 'Client Communications',
    title: 'Client Intake Engagement & Fee Agreement',
    description: 'Formal engagement letter and remuneration agreement for new clients.',
    defaultBody: (d) => `CONFIDENTIAL CLIENT ENGAGEMENT & RETAINER AGREEMENT

Date: ${d.current_date}
To: ${d.client_name || 'Client Name'}
Address: ${d.address || 'Nairobi, Kenya'} | Tel: ${d.client_phone || 'N/A'} | Email: ${d.client_email || 'N/A'}

RE: LEGAL REPRESENTATION IN MATTER — "${d.case_title || 'Legal Representation'}"
Judiciary Ref: ${d.judiciary_case_id || d.ref_no || 'Pending Allocation'}

Dear ${d.client_name || 'Client'},

We write to formally confirm that Sam Ogola & Co. Advocates has accepted instructions to represent you in respect of the above-referenced matter.

1. SCOPE OF LEGAL SERVICES:
Our services shall include drafting pleadings, filing court documents, conducting legal research, representing you before the presiding court, and offering advisory services.

2. ADVOCATES REMUNERATION & DISBURSEMENTS:
- Professional Retainer Fee: KES ${(parseFloat(d.total_fee) || 50000).toLocaleString()} (exclusive of VAT).
- Court Filing & Process Disbursements: Billed at actual cost as incurred on the Judiciary Portal.
- Escrow / Client Trust Funds: All client deposit money shall be held in our LSK-compliant Client Trust Account with 0% third-party deduction.

3. DEDICATED ADVOCATE & CASE TRACKING:
Your matter will be managed by ${d.assigned_lawyer || 'Sam Ogola, Advocate'}. You may check live case progress 24/7 by sending your tracking token (${d.tracking_token || 'SO-1/26'}) to our automated WhatsApp system.

Yours faithfully,

__________________________________________
SAM OGOLA & CO. ADVOCATES
Accepted & Agreed by Client Signature: _______________________ Date: _________`
  },
  {
    id: 'client_fee_note',
    category: 'Client Communications',
    title: 'Client Fee Note & Payment Notice',
    description: 'Official fee invoice notice for legal retainer and court disbursements.',
    defaultBody: (d) => `OFFICIAL LEGAL FEE NOTE & INVOICE

Date: ${d.current_date}
Fee Note Ref: FN/SOCA/${new Date().getFullYear()}/${Math.floor(Math.random()*900+100)}
Client Name: ${d.client_name || 'Client Name'}
Matter: "${d.case_title || 'Legal Matter'}"
Judiciary Case ID: ${d.judiciary_case_id || 'N/A'}

DESCRIPTION OF PROFESSIONAL SERVICES & DISBURSEMENTS:

1. Initial Legal Consultation & Case Intake Fee ............................. KES 5,000.00
2. Drafting Pleadings & Notice of Motion .................................... KES 25,000.00
3. Court Filing Assessment Fee (Judiciary Paybill 553388) ............. KES 3,450.00
4. Advocate Court Appearance & Mention Fee ................................ KES 15,000.00

--------------------------------------------------------------------------------
TOTAL AMOUNT PAYABLE: .................................................... KES ${(parseFloat(d.total_fee) || 48450).toLocaleString()}
LESS PAYMENTS RECEIVED / TRUST DEPOSITS: ................................. KES ${(parseFloat(d.total_fee - d.outstanding_balance) || 0).toLocaleString()}
--------------------------------------------------------------------------------
NET OUTSTANDING BALANCE DUE: ............................................ KES ${(parseFloat(d.outstanding_balance) || d.total_fee || 48450).toLocaleString()}

PAYMENT REMITTANCE DETAILS:
- M-PESA Paybill / Business No: [553388 / Direct Account]
- Bank Account: Sam Ogola & Co. Advocates Operating Account
- Reference: ${d.tracking_token || 'SO-FEE'}

Yours faithfully,
__________________________________________
SAM OGOLA & CO. ADVOCATES`
  },
  {
    id: 'hearing_outcome_notice',
    category: 'Client Communications',
    title: 'Post-Hearing Outcome Update Letter',
    description: 'Briefs the client on proceedings and court orders issued after a hearing.',
    defaultBody: (d) => `POST-HEARING COURT PROCEEDINGS BRIEF

Date: ${d.current_date}
To: ${d.client_name || 'Client Name'}
Re: COURT PROCEEDINGS UPDATE — "${d.case_title || 'Legal Matter'}"
Judiciary Case ID: ${d.judiciary_case_id || 'N/A'}
Court Station: ${d.court_station || 'Milimani Law Courts'}

Dear ${d.client_name || 'Client'},

We refer to the above matter which came up before ${d.assigned_judge || 'the Presiding Magistrate/Judge'} on ${d.current_date}.

SUMMARY OF COURT PROCEEDINGS & DIRECTIONS GIVEN:
1. The court noted that pleadings were fully filed and served upon the Opposing Advocate (${d.opposing_counsel_firm || d.opposing_party || 'Opposing Party'}).
2. Interim protection / directions were extended in our favour.
3. The court directed that written submissions be filed and served within 14 days.

NEXT COURT SCHEDULED DATE:
- Event: Mention to confirm filing of written submissions
- Date: Scheduled for upcoming session
- Presiding Officer: ${d.assigned_judge || 'Hon. Court'}

We shall prepare the necessary legal submissions and keep you informed.

Yours faithfully,
__________________________________________
SAM OGOLA & CO. ADVOCATES
For: ${d.assigned_lawyer || 'Sam Ogola, Advocate'}`
  },
  {
    id: 'demand_letter',
    category: 'Client Communications',
    title: 'Formal Demand Letter / Notice of Intention to Sue',
    description: 'Legal demand issued to opposing parties prior to instituting suit.',
    defaultBody: (d) => `WITHOUT PREJUDICE / DEMAND LETTER

Date: ${d.current_date}
To: ${d.opposing_party || 'Opposing Party Name'}
Address: ${d.opposing_party_contact || 'Nairobi, Kenya'}

RE: FORMAL DEMAND & NOTICE OF INTENTION TO SUE ON BEHALF OF OUR CLIENT, ${(d.client_name || 'OUR CLIENT').toUpperCase()}

We act for ${d.client_name || 'Our Client'}, on whose strict instructions we address you as follows:

1. That you entered into an agreement / transaction with our client regarding "${d.case_title || 'Commercial Contract/Property'}".
2. That in breach of your legal obligations, you have failed, refused, or neglected to settle outstanding liabilities due to our client.

TAKE NOTICE that we hereby demand from you the immediate payment of the full sum together with interest and legal costs within SEVEN (7) DAYS from the date of receipt of this notice.

TAKE FURTHER NOTICE that should you fail to comply with this demand, our instructions are to institute civil legal proceedings against you in court without any further reference to you, holding you liable for costs and statutory interest.

Yours faithfully,

__________________________________________
SAM OGOLA & CO. ADVOCATES
ADVOCATES FOR ${d.client_name ? d.client_name.toUpperCase() : 'OUR CLIENT'}`
  },
  {
    id: 'deputy_registrar_letter',
    category: 'Registry Correspondence',
    title: 'Letter to Deputy Registrar (Fixing Hearing Date)',
    description: 'Urgent request to Court Registrar for cause list allocation.',
    defaultBody: (d) => `OFFICIAL REGISTRY CORRESPONDENCE

Date: ${d.current_date}
To: The Deputy Registrar / Executive Officer
${d.court_station ? d.court_station.toUpperCase() : 'HIGH COURT OF KENYA AT NAIROBI'}
${d.court_division || 'CIVIL / COMMERCIAL DIVISION'}

RE: URGENT REQUEST TO FIX HEARING DATE — JUDICIARY CASE NO: ${d.judiciary_case_id || '_______________'}
(${d.client_name || 'PLAINTIFF'} VS. ${d.opposing_party || 'DEFENDANT'})

We refer to the above matter.

Pleadings in this matter are fully closed. The Applicant's Notice of Motion filed on ${d.current_date} remains pending hearing.

We respectfully request your office to fix an early hearing date for the inter-partes hearing of the application before the presiding Judge/Magistrate.

We have attached the requisite Judiciary filing receipts for your confirmation.

Yours faithfully,

__________________________________________
SAM OGOLA & CO. ADVOCATES
ADVOCATES FOR THE APPLICANT`
  },
  {
    id: 'certified_copies_request',
    category: 'Registry Correspondence',
    title: 'Application for Certified Copies of Court Orders',
    description: 'Official letter to Court Registry requesting certified copies of decrees/proceedings.',
    defaultBody: (d) => `OFFICIAL REGISTRY APPLICATION

Date: ${d.current_date}
To: The Chief Executive Officer / Executive Registrar
${d.court_station ? d.court_station.toUpperCase() : 'MILIMANI LAW COURTS'}

RE: APPLICATION FOR CERTIFIED COPIES OF PROCEEDINGS AND COURT ORDER
JUDICIARY CASE NO: ${d.judiciary_case_id || '_______________'}
MATTER: ${d.client_name || 'PLAINTIFF'} VS. ${d.opposing_party || 'DEFENDANT'}

We act for the ${(d.client_name || 'Plaintiff').toUpperCase()} in the above-referenced matter.

We write to apply for certified copies of the proceedings and the Court Order / Ruling delivered by ${d.assigned_judge || 'the Hon. Court'} on ${d.current_date}.

We confirm that court fees for certification shall be paid upon assessment by your office.

Thank you for your prompt assistance.

Yours faithfully,

__________________________________________
SAM OGOLA & CO. ADVOCATES`
  }
];

export default function DocumentStudio({ cases = [], leads = [], activeMatterId = null, lawyersList = [], userDisplayName = '', showToast }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('notice_of_appearance');
  const [selectedCaseId, setSelectedCaseId] = useState(activeMatterId || (cases.length > 0 ? cases[0].id : ''));
  const [docBody, setDocBody] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  // Multi-Recipient Mobile Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [dispatchChannel, setDispatchChannel] = useState('whatsapp'); // 'whatsapp' | 'email'

  // Auto-inject case context whenever template or selected case changes
  useEffect(() => {
    if (activeMatterId && cases.some(c => c.id === activeMatterId)) {
      setSelectedCaseId(activeMatterId);
    }
  }, [activeMatterId, cases]);

  useEffect(() => {
    const tpl = STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId) || STUDIO_TEMPLATES[0];
    const targetCase = cases.find(c => c.id === selectedCaseId) || {};
    
    const formattedDate = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const contextData = {
      client_name: targetCase.client_name || '',
      case_title: targetCase.case_title || '',
      judiciary_case_id: targetCase.judiciary_case_id || '',
      ref_no: targetCase.ref_no || '',
      court_station: targetCase.court_station || '',
      court_division: targetCase.court_division || '',
      opposing_party: targetCase.opposing_party || '',
      opposing_counsel_name: targetCase.opposing_counsel_name || '',
      opposing_counsel_firm: targetCase.opposing_counsel_firm || '',
      assigned_judge: targetCase.assigned_judge || '',
      assigned_lawyer: targetCase.assigned_lawyer || userDisplayName || 'Sam Ogola',
      address: targetCase.address || '',
      client_phone: targetCase.client_phone || '',
      client_email: targetCase.client_email || '',
      total_fee: targetCase.total_fee || 0,
      outstanding_balance: targetCase.outstanding_balance || 0,
      tracking_token: targetCase.tracking_token || '',
      current_date: formattedDate
    };

    setDocBody(tpl.defaultBody(contextData));
  }, [selectedTemplateId, selectedCaseId, cases, userDisplayName]);

  const categories = ['All', 'Court Pleadings', 'Client Communications', 'Registry Correspondence'];
  
  const filteredTemplates = STUDIO_TEMPLATES.filter(t => {
    const matchesCategory = activeCategoryFilter === 'All' || t.category === activeCategoryFilter;
    const matchesSearch = !templateSearchQuery.trim() || 
      t.title.toLowerCase().includes(templateSearchQuery.toLowerCase()) || 
      t.description.toLowerCase().includes(templateSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePrintPDF = () => {
    window.print();
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(docBody);
    if (showToast) showToast('📋 Document text copied to clipboard!', 'success');
    else alert('📋 Document text copied to clipboard!');
  };

  const handleDownloadDocx = () => {
    const headerHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Legal Document</title></head><body>";
    const footerHtml = "</body></html>";
    const htmlContent = headerHtml + `<div style="font-family:'Times New Roman',serif; font-size:12pt; line-height:1.5; white-space:pre-wrap;">${docBody}</div>` + footerHtml;
    
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplateId}_${Date.now()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 1-Tap Save Drafted Document to Case File Locker
  const handleSaveToCaseFiles = async () => {
    if (!selectedCaseId) {
      if (showToast) showToast('⚠️ Please select a target matter to save this document.', 'error');
      else alert('Please select a target matter first.');
      return;
    }
    setSavingFile(true);

    try {
      const targetCase = cases.find(c => c.id === selectedCaseId);
      const tpl = STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId);
      const fileName = `${tpl?.title || 'Legal_Doc'}_${new Date().toISOString().slice(0,10)}.txt`;

      const blob = new Blob([docBody], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('category', 'pleadings');

      const session = getSession();
      const res = await fetch(`${BASE}/api/cases/${selectedCaseId}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save to case file locker');

      if (showToast) showToast(`💾 Draft saved to "${targetCase?.client_name}" File Locker!`, 'success');
      else alert(`Saved to ${targetCase?.client_name} files!`);
    } catch (err) {
      if (showToast) showToast(`⚠️ Save Error: ${err.message}`, 'error');
      else alert(err.message);
    } finally {
      setSavingFile(false);
    }
  };

  // 1-Tap Court PDF Bundle Builder with Sequential Bates Stamping
  const handleGenerateBatesBundle = () => {
    const tpl = STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId);
    const targetCase = cases.find(c => c.id === selectedCaseId) || {};
    
    const bundleText = [
      `================================================================================`,
      `REPUBLIC OF KENYA — JUDICIARY COURT BUNDLE INDEX (BATES STAMPED)`,
      `================================================================================`,
      `MATTER: ${targetCase.client_name || 'CLIENT'} VS. ${targetCase.opposing_party || 'DEFENDANT'}`,
      `JUDICIARY CASE NO: ${targetCase.judiciary_case_id || 'PENDING ALLOCATION'}`,
      `COURT STATION: ${targetCase.court_station || 'MILIMANI LAW COURTS'}`,
      `DATE OF BUNDLE COMPILATION: ${new Date().toLocaleDateString('en-KE')}`,
      `ADVOCATE: ${targetCase.assigned_lawyer || userDisplayName || 'Sam Ogola, Advocate'}`,
      `--------------------------------------------------------------------------------`,
      `TABLE OF CONTENTS & BATES PAGE INDEX:`,
      `1. Document 01: ${tpl?.title || 'Primary Pleading'} ............................ BATES 001 - 003`,
      `2. Document 02: Verification Affidavit & Supporting Exhibits ........... BATES 004 - 008`,
      `3. Document 03: Judiciary Assessment Fee Receipt (Paybill 553388) ...... BATES 009 - 010`,
      `================================================================================\n`,
      `[BATES PAGE 001 — SOCA-OFFICIAL-BUNDLE-STAMP]\n`,
      docBody,
      `\n\n[BATES PAGE 002 — SOCA-OFFICIAL-BUNDLE-STAMP]`,
      `END OF BUNDLE DOCUMENT — PREPARED FOR eFILING UPLOAD LIMITS`
    ].join('\n');

    setDocBody(bundleText);
    if (showToast) showToast('📚 Court-Ready Bates Stamped Bundle Generated!', 'success');
  };

  // Toggle recipient selection for mobile multi-dispatch
  const toggleRecipient = (clientObj) => {
    if (selectedRecipients.some(r => r.id === clientObj.id)) {
      setSelectedRecipients(selectedRecipients.filter(r => r.id !== clientObj.id));
    } else {
      setSelectedRecipients([...selectedRecipients, clientObj]);
    }
  };

  // Execute multi-dispatch via WhatsApp or Email
  const executeDispatch = (recipient) => {
    const text = docBody.replace(/Client Name/g, recipient.client_name || recipient.full_name);
    if (dispatchChannel === 'whatsapp') {
      const phone = (recipient.client_phone || recipient.phone || '').replace(/\+/g, '');
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    } else {
      const email = recipient.client_email || recipient.email || '';
      const tpl = STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId);
      const url = `mailto:${email}?subject=${encodeURIComponent(tpl?.title || 'Legal Document Notice')}&body=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="document-studio-container" style={{display:'flex', flexDirection:'column', gap:'20px', width:'100%'}}>
      {/* Top Controls Header */}
      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px'}}>
        <div>
          <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.1rem', display:'flex', alignItems:'center', gap:'8px'}}>
            📄 Professional Legal Document Studio
          </h3>
          <p style={{margin:'4px 0 0 0', color:'var(--text-secondary)', fontSize:'0.8rem'}}>
            Inject active matter context, draft pleadings, save to file lockers, and dispatch to multiple clients.
          </p>
        </div>
        <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
          <select 
            value={selectedCaseId} 
            onChange={e => setSelectedCaseId(e.target.value)}
            style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--gold-500)', padding:'8px 12px', borderRadius:'6px', fontSize:'0.82rem', fontWeight:600, outline:'none'}}
          >
            <option value="">-- No Matter Link (Manual Entry) --</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>
                ⚖️ {c.client_name} — {c.judiciary_case_id || c.tracking_token}
              </option>
            ))}
          </select>
          <button className="primary-btn" onClick={handleSaveToCaseFiles} disabled={savingFile} style={{padding:'8px 12px', fontSize:'0.8rem'}}>
            {savingFile ? 'Saving...' : '💾 Save to Matter Files'}
          </button>
          <button className="primary-btn" onClick={() => setShowDispatchModal(true)} style={{padding:'8px 12px', fontSize:'0.8rem', background:'var(--gold-gradient)', color:'var(--navy-950)', fontWeight:700}}>
            📲 Multi-Dispatch
          </button>
          <button className="secondary-btn" onClick={handleGenerateBatesBundle} style={{padding:'8px 12px', fontSize:'0.8rem', borderColor:'#4db6ac', color:'#4db6ac'}}>
            📚 Bates Bundle
          </button>
          <button className="secondary-btn" onClick={handlePrintPDF} style={{padding:'8px 12px', fontSize:'0.8rem'}}>
            🖨️ Print PDF
          </button>
          <button className="secondary-btn" onClick={handleDownloadDocx} style={{padding:'8px 12px', fontSize:'0.8rem', borderColor:'var(--gold-400)', color:'var(--gold-300)'}}>
            📄 Word (.doc)
          </button>
        </div>
      </div>

      {/* Main Grid: Template Selector (Left) & Live Letterhead Canvas (Right) */}
      <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:'20px', alignItems:'start'}}>
        
        {/* Left Panel: Template List & Live Search */}
        <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'16px', display:'flex', flexDirection:'column', gap:'12px'}}>
          
          {/* Live Search Input */}
          <div>
            <input
              type="text"
              placeholder="🔍 Search templates..."
              value={templateSearchQuery}
              onChange={e => setTemplateSearchQuery(e.target.value)}
              style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'6px', fontSize:'0.82rem'}}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`action-btn ${activeCategoryFilter === cat ? 'active' : ''}`}
                onClick={() => setActiveCategoryFilter(cat)}
                style={{
                  fontSize:'0.72rem', 
                  padding:'4px 8px', 
                  borderRadius:'12px',
                  background: activeCategoryFilter === cat ? 'var(--gold-500)' : 'var(--navy-900)',
                  color: activeCategoryFilter === cat ? 'var(--navy-950)' : 'var(--text-secondary)',
                  fontWeight: activeCategoryFilter === cat ? 700 : 400,
                  border: '1px solid var(--border-default)'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template Cards */}
          <div style={{display:'flex', flexDirection:'column', gap:'8px', maxHeight:'650px', overflowY:'auto'}}>
            {filteredTemplates.map(t => (
              <div 
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                style={{
                  padding:'12px',
                  borderRadius:'6px',
                  background: selectedTemplateId === t.id ? 'rgba(201,168,76,0.12)' : 'var(--navy-900)',
                  border: selectedTemplateId === t.id ? '1px solid var(--gold-400)' : '1px solid var(--border-default)',
                  cursor:'pointer',
                  transition:'all 0.2s ease'
                }}
              >
                <div style={{fontSize:'0.72rem', color:'var(--gold-400)', fontWeight:700, textTransform:'uppercase'}}>{t.category}</div>
                <div style={{fontSize:'0.88rem', fontWeight:700, color:'white', margin:'2px 0'}}>{t.title}</div>
                <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:'1.3'}}>{t.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: WYSIWYG Letterhead Canvas */}
        <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
          <div className="print-canvas-wrapper" style={{background:'#111', padding:'20px', borderRadius:'8px', border:'1px solid var(--border-default)', overflowX:'auto'}}>
            {/* The Print Paper Container */}
            <div 
              id="soca-letterhead-paper"
              style={{
                width:'100%',
                maxWidth:'800px',
                minHeight:'1000px',
                margin:'0 auto',
                background:'#ffffff',
                color:'#111111',
                padding:'40px 50px',
                boxShadow:'0 10px 30px rgba(0,0,0,0.5)',
                fontFamily:"'Times New Roman', Times, serif",
                display:'flex',
                flexDirection:'column',
                justify:'space-between',
                boxSizing:'border-box'
              }}
            >
              {/* Top Header Branding (Official SOCA Letterhead) */}
              <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'3px double #d4af37', paddingBottom:'12px', marginBottom:'24px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
                    {logoImg && <img src={logoImg} alt="SOCA Logo" style={{height:'55px', width:'auto'}} />}
                    <div>
                      <div style={{fontFamily:"'Cinzel', 'Times New Roman', serif", fontSize:'18pt', fontWeight:900, color:'#060e1c', letterSpacing:'0.5px'}}>
                        SAM OGOLA & CO. ADVOCATES
                      </div>
                      <div style={{fontSize:'8.5pt', color:'#d4af37', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase'}}>
                        ADVOCATES, COMMISSIONERS FOR OATHS & NOTARIES PUBLIC
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:'right', fontSize:'8pt', color:'#444', lineHeight:'1.3'}}>
                    <div><strong>Head Office:</strong> Anniversary Towers, 6th Floor</div>
                    <div>University Way, P.O. Box 10293-00100</div>
                    <div><strong>Nairobi, Kenya</strong></div>
                    <div>Tel: +254 700 000 000 | Email: info@samogola.co.ke</div>
                    <div>Web: www.samogola.co.ke</div>
                  </div>
                </div>

                {/* Document Body Editor / View */}
                <textarea 
                  value={docBody}
                  onChange={e => setDocBody(e.target.value)}
                  style={{
                    width:'100%',
                    minHeight:'700px',
                    border:'none',
                    outline:'none',
                    resize:'vertical',
                    fontFamily:"'Times New Roman', Times, serif",
                    fontSize:'11.5pt',
                    lineHeight:'1.5',
                    color:'#111',
                    background:'transparent',
                    boxSizing:'border-box'
                  }}
                />
              </div>

              {/* Bottom Footer Branding */}
              <div style={{borderTop:'1px solid #d4af37', paddingTop:'8px', marginTop:'30px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'8pt', color:'#666'}}>
                <div>Partners: Sam Ogola (Managing Partner) | Advocates: Ms Ivy</div>
                <div>Official Legal Correspondence • Sam Ogola & Co. Advocates</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 📱 MULTI-RECIPIENT DISPATCH MODAL */}
      {showDispatchModal && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0,
          background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
        }}>
          <div style={{
            background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'12px',
            width:'100%', maxWidth:'650px', maxHeight:'90vh', overflowY:'auto', padding:'24px', color:'white'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'12px', marginBottom:'16px'}}>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.1rem'}}>
                📲 Multi-Recipient Document Dispatch
              </h3>
              <button onClick={() => setShowDispatchModal(false)} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>✕</button>
            </div>

            <p style={{fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'14px'}}>
              Select recipient clients below to dispatch customized copies of this letter directly via 1-tap WhatsApp or Email.
            </p>

            {/* Channel Switcher */}
            <div style={{display:'flex', gap:'10px', marginBottom:'16px'}}>
              <button 
                onClick={() => setDispatchChannel('whatsapp')}
                style={{
                  flex:1, padding:'10px', borderRadius:'8px', cursor:'pointer', fontWeight:700, fontSize:'0.82rem',
                  background: dispatchChannel === 'whatsapp' ? 'var(--gold-500)' : 'var(--navy-800)',
                  color: dispatchChannel === 'whatsapp' ? 'var(--navy-950)' : 'white',
                  border: '1px solid var(--border-default)'
                }}
              >
                💬 WhatsApp Broadcast
              </button>
              <button 
                onClick={() => setDispatchChannel('email')}
                style={{
                  flex:1, padding:'10px', borderRadius:'8px', cursor:'pointer', fontWeight:700, fontSize:'0.82rem',
                  background: dispatchChannel === 'email' ? 'var(--gold-500)' : 'var(--navy-800)',
                  color: dispatchChannel === 'email' ? 'var(--navy-950)' : 'white',
                  border: '1px solid var(--border-default)'
                }}
              >
                ✉️ Email Broadcast
              </button>
            </div>

            {/* Client Selection List */}
            <div style={{display:'flex', flexDirection:'column', gap:'8px', maxHeight:'300px', overflowY:'auto', marginBottom:'16px'}}>
              {cases.map(c => (
                <div key={c.id} style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', padding:'10px 14px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:'0.88rem', fontWeight:700, color:'white'}}>{c.client_name}</div>
                    <div style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>{c.case_title} ({c.client_phone || c.client_email || 'No Contact'})</div>
                  </div>
                  <button 
                    onClick={() => executeDispatch(c)}
                    className="primary-btn"
                    style={{padding:'6px 12px', fontSize:'0.75rem', fontWeight:700}}
                  >
                    {dispatchChannel === 'whatsapp' ? '💬 Send WA' : '✉️ Send Email'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{textAlign:'right'}}>
              <button className="secondary-btn" onClick={() => setShowDispatchModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Print CSS styling injection for clean A4 output */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #soca-letterhead-paper, #soca-letterhead-paper * {
            visibility: visible;
          }
          #soca-letterhead-paper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 20mm !important;
          }
          textarea {
            border: none !important;
            outline: none !important;
          }
        }
      `}</style>
    </div>
  );
}
