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
Legacy Plaza, 2nd Floor, Suite 12, Thindigua, along Kiambu Road
P.O. Box 10293-00100, Nairobi, Kenya
Email: info@samogola.co.ke | Tel: +254 700 000 000

TO BE SERVED UPON:
${d.opposing_counsel_firm || d.opposing_party || 'Opposing Counsel / Party'}`
  },
  {
    id: 'certificate_of_urgency',
    category: 'Court Pleadings',
    title: 'Certificate of Urgency',
    description: 'Urgent motion certificate for ex-parte / priority allocation before the Duty Judge.',
    defaultBody: (d) => `REPUBLIC OF KENYA
IN THE ${d.court_station ? d.court_station.toUpperCase() : 'HIGH COURT OF KENYA'}
${d.court_division ? d.court_division.toUpperCase() : 'CIVIL / COMMERCIAL DIVISION'}
JUDICIARY CASE NO: ${d.judiciary_case_id || '_______________'}

BETWEEN:
${(d.client_name || 'APPLICANT').toUpperCase()} ................................................................ APPLICANT
AND
${(d.opposing_party || 'RESPONDENT').toUpperCase()} ................................................................ RESPONDENT

CERTIFICATE OF URGENCY
[Under Order 51 Rule 1 of the Civil Procedure Rules, 2010]

I, ${d.assigned_lawyer || 'SAM OGOLA'}, an Advocate of the High Court of Kenya practicing as such in the firm of SAM OGOLA & CO. ADVOCATES, Counsel for the Applicant herein, DO HEREBY CERTIFY that the Application filed herewith is extremely urgent and deserves to be heard on a priority basis, ex-parte in the first instance, on the following grounds:

1. That the Respondent has threatened and commenced illegal and forceful actions detrimental to the Applicant's lawful rights and proprietary interests.
2. That unless this Honourable Court intervenes urgently and grants interim preservation orders, the subject matter of this suit will be permanently alienated, destroyed, or rendered nugatory.
3. That the Applicant will suffer irreparable injury and catastrophic commercial harm that cannot be adequately compensated in monetary damages.

DATED at NAIROBI this ${d.current_date}.

__________________________________________
SAM OGOLA & CO. ADVOCATES
COUNSEL FOR THE APPLICANT`
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
2.1 Whether the Applicant has satisfied the legal threshold for the grant of interlocutory injunction orders.
2.2 Who should bear the costs of this application.

3. LEGAL ARGUMENTS & AUTHORITIES:
3.1 On the first issue, it is settled law in Kenya (Giella v Cassman Brown & Co. Ltd [1973] EA 358) that a party seeking interlocutory injunction must establish a prima facie case with a probability of success.
3.2 In Mrao Ltd v First American Bank of Kenya Ltd & 2 Others [2003] KLR 125, the Court of Appeal defined a prima facie case as one which on the material presented to the court, a tribunal properly directing itself will conclude that there exists a right which has apparently been infringed by the opposite party.

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
1. The Constitution of Kenya, 2010 — Article 40 (Protection of Right to Property), Article 50 (Fair Hearing), Article 159 (Substantive Justice).
2. The Civil Procedure Act (Cap 21, Laws of Kenya) — Section 1A, 1B, & Section 3A.
3. The Advocates Act (Cap 16, Laws of Kenya) & Advocates Remuneration Order.

JUDICIAL PRECEDENTS & CASE LAW:
1. Giella v Cassman Brown & Co. Ltd [1973] EA 358 (Principles governing grant of interlocutory injunctions).
2. Mrao Ltd v First American Bank of Kenya Ltd & 2 Others [2003] KLR 125 (Definition of prima facie case).
3. Nguruman Limited v Jan Bonde Nielsen & 2 Others [2014] eKLR (Irreparable harm threshold).

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
- Professional Retainer Fee: KES ${(parseFloat(d.total_fee) || 50000).toLocaleString()} (exclusive of statutory disbursements).
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

  // AI Co-Drafting & Refinement States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('formal');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingAction, setAiLoadingAction] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState('');
  const [aiModalContent, setAiModalContent] = useState('');
  const [aiModalType, setAiModalType] = useState('audit'); // 'audit' | 'summary'
  const [caseFacts, setCaseFacts] = useState([]);
  const [showFactsMenu, setShowFactsMenu] = useState(false);

  // Auto-inject case context whenever template or selected case changes
  useEffect(() => {
    if (activeMatterId && cases.some(c => c.id === activeMatterId)) {
      setSelectedCaseId(activeMatterId);
    }
  }, [activeMatterId, cases]);

  // Load case facts from database when selectedCaseId changes
  useEffect(() => {
    if (!selectedCaseId) {
      setCaseFacts([]);
      return;
    }
    const session = getSession();
    fetch(`${BASE}/api/cases/${selectedCaseId}/facts`, {
      headers: { 'Authorization': `Bearer ${session?.token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setCaseFacts(d);
        else setCaseFacts([]);
      })
      .catch(() => setCaseFacts([]));
  }, [selectedCaseId]);

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

  // Execute multi-dispatch via Baileys WhatsApp API or Email
  const executeDispatch = async (recipient) => {
    const text = docBody.replace(/Client Name/g, recipient.client_name || recipient.full_name || 'Client');
    if (dispatchChannel === 'whatsapp') {
      const phone = (recipient.client_phone || recipient.phone || '').replace(/\D/g, '');
      if (!phone) {
        if (showToast) showToast('⚠️ No phone number provided for recipient', 'error');
        return;
      }
      try {
        const res = await apiPost('/api/whatsapp/send', { phone, message: text });
        if (res.ok) {
          if (showToast) showToast(`✅ Dispatched to ${recipient.client_name || phone} via WhatsApp!`, 'success');
        } else {
          // Fallback to web link if background desk is not connected
          const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
          window.open(url, '_blank');
        }
      } catch (err) {
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }
    } else {
      const email = recipient.client_email || recipient.email || '';
      const tpl = STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId);
      const url = `mailto:${email}?subject=${encodeURIComponent(tpl?.title || 'Legal Document Notice')}&body=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  // AI Co-Drafting & Refinement Engine Dispatcher (Text-Only)
  const handleRunAiAction = async (action, customInstruction = '') => {
    setAiLoading(true);
    setAiLoadingAction(action);

    try {
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
        opposing_counsel_firm: targetCase.opposing_counsel_firm || '',
        assigned_judge: targetCase.assigned_judge || '',
        assigned_lawyer: targetCase.assigned_lawyer || userDisplayName || 'Sam Ogola, Advocate',
        current_date: formattedDate
      };

      const session = getSession();
      const res = await fetch(`${BASE}/api/documents/ai-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          action,
          docText: docBody,
          contextData,
          userInstruction: customInstruction || aiPrompt,
          tone: aiTone,
          matter_id: selectedCaseId || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Drafting request failed');

      // Strip any residual thinking tokens or outer code fences
      let cleanedResult = (data.resultText || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*/gi, '')
        .trim();
      if (cleanedResult.startsWith('```')) {
        cleanedResult = cleanedResult.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      }

      if (action === 'generate_pleading' || action === 'free_prompt' || action === 'adjust_tone') {
        setDocBody(cleanedResult);
        if (showToast) showToast('✨ Legal draft synthesized directly into canvas!', 'success');
      } else if (action === 'strengthen_citations') {
        setDocBody(cleanedResult);
        if (showToast) showToast('⚡ Precedents and statutory authorities integrated into draft!', 'success');
      } else if (action === 'check_compliance') {
        setAiModalTitle('⚖️ Civil Procedure Compliance Audit');
        setAiModalContent(cleanedResult);
        setAiModalType('audit');
        setShowAiModal(true);
      } else if (action === 'plain_summary') {
        setAiModalTitle('🗣️ Client Plain-English Explanatory Summary');
        setAiModalContent(cleanedResult);
        setAiModalType('summary');
        setShowAiModal(true);
      }
    } catch (err) {
      if (showToast) showToast(`⚠️ AI Service Notice: ${err.message}`, 'error');
      else alert(err.message);
    } finally {
      setAiLoading(false);
      setAiLoadingAction('');
    }
  };

  // Insert locked chronological fact from Strategy Workbench / extracted_facts
  const handleInsertFact = (fact) => {
    const factLine = `\n• On ${fact.fact_date || 'the material date'}, ${fact.description} [Ref: ${fact.pincite || 'Document'}].`;
    setDocBody(prev => prev + '\n' + factLine);
    setShowFactsMenu(false);
    if (showToast) showToast('📥 Matter fact inserted into draft!', 'info');
  };

  return (
    <div className="document-studio-container" style={{display:'flex', flexDirection:'column', gap:'16px', width:'100%'}}>
      
      {/* ── Top Header & Action Controls Bar ── */}
      <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px'}}>
        <div>
          <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.15rem', display:'flex', alignItems:'center', gap:'8px', fontFamily:'var(--font-display)'}}>
            📄 Professional Legal Document Studio
          </h3>
          <p style={{margin:'4px 0 0 0', color:'var(--text-secondary)', fontSize:'0.8rem', fontFamily:'var(--font-body)'}}>
            AI Co-Counsel Drafting, Statutory Citation Engine & Case File Locker
          </p>
        </div>

        <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
          <select 
            value={selectedCaseId} 
            onChange={e => setSelectedCaseId(e.target.value)}
            style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--gold-500)', padding:'7px 12px', borderRadius:'4px', fontSize:'0.82rem', fontWeight:600, outline:'none', fontFamily:'var(--font-body)'}}
          >
            <option value="">-- No Matter Link (Manual Entry) --</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>
                ⚖️ {c.client_name} — {c.judiciary_case_id || c.tracking_token}
              </option>
            ))}
          </select>
          <button className="primary-btn" onClick={handleSaveToCaseFiles} disabled={savingFile} style={{padding:'7px 12px', fontSize:'0.8rem', borderRadius:'4px'}}>
            {savingFile ? 'Saving...' : '💾 Save to Matter Files'}
          </button>
          <button className="primary-btn" onClick={() => setShowDispatchModal(true)} style={{padding:'7px 12px', fontSize:'0.8rem', background:'var(--gold-gradient)', color:'var(--navy-950)', fontWeight:700, borderRadius:'4px'}}>
            📲 Multi-Dispatch
          </button>
          <button className="secondary-btn" onClick={handleGenerateBatesBundle} style={{padding:'7px 12px', fontSize:'0.8rem', borderColor:'#4db6ac', color:'#4db6ac', borderRadius:'4px'}}>
            📚 Bates Bundle
          </button>
          <button className="secondary-btn" onClick={handlePrintPDF} style={{padding:'7px 12px', fontSize:'0.8rem', borderRadius:'4px'}}>
            🖨️ Print PDF
          </button>
          <button className="secondary-btn" onClick={handleDownloadDocx} style={{padding:'7px 12px', fontSize:'0.8rem', borderColor:'var(--gold-400)', color:'var(--gold-300)', borderRadius:'4px'}}>
            📄 Word (.doc)
          </button>
        </div>
      </div>

      {/* ── AI Co-Counsel Pleading Synthesizer Box ── */}
      <div style={{background:'var(--navy-900)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'14px 18px', display:'flex', flexDirection:'column', gap:'10px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.82rem', color:'var(--gold-400)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>
            <span>⚡ AI Bespoke Pleading Generator</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Tone:</span>
            <select 
              value={aiTone} 
              onChange={e => setAiTone(e.target.value)}
              style={{background:'var(--navy-950)', color:'var(--gold-300)', border:'1px solid var(--border-default)', padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem', outline:'none'}}
            >
              <option value="formal">Formal Court Submission</option>
              <option value="aggressive">Aggressive Legal Demand</option>
              <option value="conciliatory">Conciliatory Settlement Brief</option>
            </select>
          </div>
        </div>

        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
          <input
            type="text"
            placeholder="e.g. Draft an urgent Notice of Motion under Section 3A of Civil Procedure Act seeking interim injunction against unlawful eviction..."
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && aiPrompt.trim() && !aiLoading) handleRunAiAction('free_prompt'); }}
            style={{flex:1, background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'9px 14px', borderRadius:'4px', fontSize:'0.82rem', fontFamily:'var(--font-body)'}}
          />
          <button 
            onClick={() => handleRunAiAction('free_prompt')}
            disabled={aiLoading || !aiPrompt.trim()}
            className="primary-btn"
            style={{padding:'9px 16px', fontSize:'0.8rem', fontWeight:700, borderRadius:'4px', whiteSpace:'nowrap', background: aiLoading ? 'var(--navy-700)' : 'var(--gold-gradient)', color: 'var(--navy-950)'}}
          >
            {aiLoading && aiLoadingAction === 'free_prompt' ? '⚡ Synthesizing...' : '✨ AI Draft Pleading'}
          </button>
        </div>
      </div>

      {/* ── Main Workspace Grid: Template Selector (Left) & Live Letterhead Canvas (Right) ── */}
      <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:'20px', alignItems:'start'}}>
        
        {/* Left Panel: Template Library & Category Search */}
        <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'8px', padding:'16px', display:'flex', flexDirection:'column', gap:'12px'}}>
          
          {/* Live Search Input */}
          <div>
            <input
              type="text"
              placeholder="🔍 Search legal templates..."
              value={templateSearchQuery}
              onChange={e => setTemplateSearchQuery(e.target.value)}
              style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'8px 10px', borderRadius:'4px', fontSize:'0.82rem', fontFamily:'var(--font-body)'}}
            />
          </div>

          {/* Category Filter Tags */}
          <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setActiveCategoryFilter(cat)}
                style={{
                  fontSize:'0.72rem', 
                  padding:'4px 8px', 
                  borderRadius:'4px',
                  background: activeCategoryFilter === cat ? 'var(--gold-500)' : 'var(--navy-900)',
                  color: activeCategoryFilter === cat ? 'var(--navy-950)' : 'var(--text-secondary)',
                  fontWeight: activeCategoryFilter === cat ? 700 : 500,
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer'
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
                  borderRadius:'4px',
                  background: selectedTemplateId === t.id ? 'rgba(201,168,76,0.12)' : 'var(--navy-900)',
                  border: selectedTemplateId === t.id ? '1px solid var(--gold-400)' : '1px solid var(--border-default)',
                  cursor:'pointer',
                  transition:'all 0.15s ease'
                }}
              >
                <div style={{fontSize:'0.7rem', color:'var(--gold-400)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>{t.category}</div>
                <div style={{fontSize:'0.86rem', fontWeight:700, color:'white', margin:'2px 0', fontFamily:'var(--font-body)'}}>{t.title}</div>
                <div style={{fontSize:'0.74rem', color:'var(--text-secondary)', lineHeight:'1.3'}}>{t.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: WYSIWYG Letterhead Canvas & Inline AI Actions */}
        <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
          
          {/* Quick Canvas & Inline AI Toolbar */}
          <div style={{background:'var(--navy-800)', border:'1px solid var(--border-default)', borderRadius:'6px', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px'}}>
            
            {/* Inline AI Enhancers */}
            <div style={{display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap'}}>
              <button 
                onClick={() => handleRunAiAction('strengthen_citations')}
                disabled={aiLoading}
                className="secondary-btn"
                style={{fontSize:'0.74rem', padding:'5px 10px', borderColor:'var(--gold-500)', color:'var(--gold-400)', borderRadius:'4px'}}
                title="Inject Kenyan precedents and statutory provisions into current draft"
              >
                {aiLoading && aiLoadingAction === 'strengthen_citations' ? '⚡ Enhancing...' : '⚡ Strengthen Citations'}
              </button>

              <button 
                onClick={() => handleRunAiAction('check_compliance')}
                disabled={aiLoading}
                className="secondary-btn"
                style={{fontSize:'0.74rem', padding:'5px 10px', borderColor:'#64b5f6', color:'#64b5f6', borderRadius:'4px'}}
                title="Audit draft for Civil Procedure Rules compliance"
              >
                {aiLoading && aiLoadingAction === 'check_compliance' ? '⚖️ Auditing...' : '⚖️ Procedure Audit'}
              </button>

              <button 
                onClick={() => handleRunAiAction('adjust_tone')}
                disabled={aiLoading}
                className="secondary-btn"
                style={{fontSize:'0.74rem', padding:'5px 10px', borderColor:'#ba68c8', color:'#ba68c8', borderRadius:'4px'}}
                title="Adjust drafting tone to current selection"
              >
                {aiLoading && aiLoadingAction === 'adjust_tone' ? '🎯 Tuning...' : '🎯 Apply Tone'}
              </button>

              <button 
                onClick={() => handleRunAiAction('plain_summary')}
                disabled={aiLoading}
                className="secondary-btn"
                style={{fontSize:'0.74rem', padding:'5px 10px', borderColor:'#4db6ac', color:'#4db6ac', borderRadius:'4px'}}
                title="Generate client-friendly explanation for WhatsApp or Email"
              >
                {aiLoading && aiLoadingAction === 'plain_summary' ? '🗣️ Summarizing...' : '🗣️ Client Summary'}
              </button>

              {/* Locked Facts Inserter */}
              {caseFacts.length > 0 && (
                <div style={{position:'relative'}}>
                  <button 
                    onClick={() => setShowFactsMenu(!showFactsMenu)}
                    className="secondary-btn"
                    style={{fontSize:'0.74rem', padding:'5px 10px', borderColor:'rgba(255,255,255,0.2)', color:'white', borderRadius:'4px'}}
                    title="Insert locked chronological facts from Strategy Workbench"
                  >
                    📥 Insert Facts ({caseFacts.length}) ▾
                  </button>

                  {showFactsMenu && (
                    <div style={{
                      position:'absolute', top:'100%', left:0, zIndex:100, marginTop:'4px',
                      background:'var(--navy-950)', border:'1px solid var(--gold-500)', borderRadius:'6px',
                      padding:'8px', width:'320px', maxHeight:'240px', overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.6)'
                    }}>
                      <div style={{fontSize:'0.7rem', color:'var(--gold-400)', fontWeight:700, textTransform:'uppercase', marginBottom:'6px'}}>
                        Select Fact to Insert:
                      </div>
                      {caseFacts.map((f, idx) => (
                        <div 
                          key={f.id || idx}
                          onClick={() => handleInsertFact(f)}
                          style={{padding:'6px 8px', borderRadius:'4px', fontSize:'0.75rem', color:'white', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)'}}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{color:'var(--gold-300)', fontWeight:600}}>[{f.fact_date || 'Undated'}]</div>
                          <div style={{color:'var(--text-secondary)'}}>{f.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Standard Utilities */}
            <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
              <button onClick={handleCopyText} className="action-btn" style={{fontSize:'0.75rem', padding:'5px 10px', background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', borderRadius:'4px', cursor:'pointer'}}>
                📋 Copy Text
              </button>
              <button onClick={() => setShowDispatchModal(true)} className="action-btn" style={{fontSize:'0.75rem', padding:'5px 10px', background:'rgba(77,182,172,0.15)', color:'#4db6ac', border:'1px solid rgba(77,182,172,0.4)', borderRadius:'4px', cursor:'pointer'}}>
                💬 WhatsApp
              </button>
              <button onClick={handleSaveToCaseFiles} className="action-btn" style={{fontSize:'0.75rem', padding:'5px 10px', background:'rgba(212,175,55,0.15)', color:'var(--gold-300)', border:'1px solid var(--gold-500)', borderRadius:'4px', cursor:'pointer'}}>
                💾 Save to Files
              </button>
            </div>
          </div>

          {/* Letterhead Print Canvas */}
          <div className="print-canvas-wrapper" style={{background:'#111', padding:'20px', borderRadius:'8px', border:'1px solid var(--border-default)', overflowX:'auto'}}>
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
                    <div><strong>Head Office:</strong> Legacy Plaza, 2nd Floor, Suite 12</div>
                    <div>Thindigua, along Kiambu Road, P.O. Box 10293-00100</div>
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
                <div>Partners: Sam Ogola (Managing Partner) | Advocates: Legal Associates</div>
                <div>Official Legal Correspondence • Sam Ogola & Co. Advocates</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── AI AUDIT / PLAIN-ENGLISH MODAL ── */}
      {showAiModal && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0,
          background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
        }}>
          <div style={{
            background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'8px',
            width:'100%', maxWidth:'700px', maxHeight:'85vh', overflowY:'auto', padding:'24px', color:'white',
            display:'flex', flexDirection:'column', gap:'14px'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'12px'}}>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.05rem', fontFamily:'var(--font-display)'}}>
                {aiModalTitle}
              </h3>
              <button onClick={() => setShowAiModal(false)} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>✕</button>
            </div>

            <div style={{
              background:'var(--navy-950)', border:'1px solid var(--border-default)', borderRadius:'6px',
              padding:'16px', fontSize:'0.84rem', lineHeight:'1.6', whiteSpace:'pre-wrap', color:'#e0e0e0',
              fontFamily: aiModalType === 'summary' ? 'var(--font-body)' : 'var(--font-mono)', maxHeight:'450px', overflowY:'auto'
            }}>
              {aiModalContent}
            </div>

            <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'6px'}}>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(aiModalContent);
                  if (showToast) showToast('📋 Copied to clipboard!', 'success');
                }}
                className="secondary-btn"
                style={{padding:'7px 14px', fontSize:'0.8rem', borderRadius:'4px'}}
              >
                📋 Copy Report
              </button>
              {aiModalType === 'summary' && (
                <button 
                  onClick={() => {
                    const phone = (cases.find(c => c.id === selectedCaseId)?.client_phone || '').replace(/\+/g, '');
                    if (phone) {
                      window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(aiModalContent)}`, '_blank');
                    } else {
                      setShowDispatchModal(true);
                    }
                  }}
                  className="primary-btn"
                  style={{padding:'7px 14px', fontSize:'0.8rem', borderRadius:'4px', background:'var(--gold-gradient)', color:'var(--navy-950)', fontWeight:700}}
                >
                  💬 Send via WhatsApp
                </button>
              )}
              <button 
                onClick={() => setShowAiModal(false)}
                className="secondary-btn"
                style={{padding:'7px 14px', fontSize:'0.8rem', borderRadius:'4px'}}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MULTI-RECIPIENT DISPATCH MODAL ── */}
      {showDispatchModal && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0,
          background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
        }}>
          <div style={{
            background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'8px',
            width:'100%', maxWidth:'650px', maxHeight:'90vh', overflowY:'auto', padding:'24px', color:'white'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'12px', marginBottom:'16px'}}>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.1rem', fontFamily:'var(--font-display)'}}>
                📲 Multi-Recipient Document Dispatch
              </h3>
              <button onClick={() => setShowDispatchModal(false)} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>✕</button>
            </div>

            <p style={{fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'14px', fontFamily:'var(--font-body)'}}>
              Select recipient clients below to dispatch customized copies of this letter directly via 1-tap WhatsApp or Email.
            </p>

            {/* Channel Switcher */}
            <div style={{display:'flex', gap:'10px', marginBottom:'16px'}}>
              <button 
                onClick={() => setDispatchChannel('whatsapp')}
                style={{
                  flex:1, padding:'8px 12px', borderRadius:'4px',
                  background: dispatchChannel === 'whatsapp' ? 'rgba(77,182,172,0.2)' : 'var(--navy-950)',
                  color: dispatchChannel === 'whatsapp' ? '#4db6ac' : 'var(--text-secondary)',
                  border: `1px solid ${dispatchChannel === 'whatsapp' ? '#4db6ac' : 'var(--border-default)'}`,
                  fontWeight: 700, fontSize:'0.82rem', cursor:'pointer'
                }}
              >
                💬 WhatsApp Dispatch
              </button>
              <button 
                onClick={() => setDispatchChannel('email')}
                style={{
                  flex:1, padding:'8px 12px', borderRadius:'4px',
                  background: dispatchChannel === 'email' ? 'rgba(212,175,55,0.2)' : 'var(--navy-950)',
                  color: dispatchChannel === 'email' ? 'var(--gold-400)' : 'var(--text-secondary)',
                  border: `1px solid ${dispatchChannel === 'email' ? 'var(--gold-500)' : 'var(--border-default)'}`,
                  fontWeight: 700, fontSize:'0.82rem', cursor:'pointer'
                }}
              >
                ✉️ Email Dispatch
              </button>
            </div>

            {/* Recipient Selection Table */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>
                Select clients or beneficiaries (e.g. for Succession / Multi-party matters):
              </span>
              {selectedCaseId && (
                <button 
                  type="button"
                  onClick={() => {
                    const activeCase = cases.find(c => c.id === selectedCaseId);
                    if (!activeCase) return;
                    const linked = [];
                    if (activeCase.client_phone) {
                      linked.push({
                        id: `case_${activeCase.id}_primary`,
                        client_name: activeCase.client_name,
                        client_phone: activeCase.client_phone,
                        client_email: activeCase.client_email,
                        label: 'Primary Client'
                      });
                    }
                    if (activeCase.alternative_phone) {
                      activeCase.alternative_phone.split(/[,;]+/).map(x => x.trim()).filter(Boolean).forEach((p, idx) => {
                        linked.push({
                          id: `case_${activeCase.id}_alt_${idx}`,
                          client_name: `${activeCase.client_name} (Beneficiary ${idx + 1})`,
                          client_phone: p,
                          client_email: activeCase.alternative_email ? activeCase.alternative_email.split(/[,;]+/)[idx] || '' : '',
                          label: 'Beneficiary / Co-Party'
                        });
                      });
                    }
                    setSelectedRecipients(linked);
                  }}
                  className="secondary-btn"
                  style={{padding:'3px 8px', fontSize:'0.7rem', color:'var(--gold-400)', borderColor:'rgba(201,168,76,0.3)'}}
                >
                  ⚡ Select All for Active Matter
                </button>
              )}
            </div>

            <div style={{maxHeight:'300px', overflowY:'auto', border:'1px solid var(--border-default)', borderRadius:'6px', marginBottom:'16px'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.8rem', textAlign:'left'}}>
                <thead>
                  <tr style={{background:'var(--navy-950)', color:'var(--gold-400)'}}>
                    <th style={{padding:'8px 12px'}}>Select</th>
                    <th style={{padding:'8px 12px'}}>Party / Beneficiary</th>
                    <th style={{padding:'8px 12px'}}>Role / Type</th>
                    <th style={{padding:'8px 12px'}}>Contact ({dispatchChannel === 'whatsapp' ? 'Phone' : 'Email'})</th>
                    <th style={{padding:'8px 12px'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const expanded = [];
                    cases.forEach(c => {
                      if (c.client_phone || c.client_email) {
                        expanded.push({
                          id: `case_${c.id}_primary`,
                          client_name: c.client_name,
                          client_phone: c.client_phone,
                          client_email: c.client_email,
                          label: 'Primary Client',
                          matter_ref: c.judiciary_case_id || c.tracking_token
                        });
                      }
                      if (c.alternative_phone) {
                        c.alternative_phone.split(/[,;]+/).map(x => x.trim()).filter(Boolean).forEach((p, idx) => {
                          expanded.push({
                            id: `case_${c.id}_alt_${idx}`,
                            client_name: `${c.client_name} (Beneficiary ${idx + 1})`,
                            client_phone: p,
                            client_email: c.alternative_email ? c.alternative_email.split(/[,;]+/)[idx] || '' : '',
                            label: 'Beneficiary / Co-Party',
                            matter_ref: c.judiciary_case_id || c.tracking_token
                          });
                        });
                      }
                    });

                    return expanded.map(c => {
                      const isSelected = selectedRecipients.some(r => r.id === c.id);
                      return (
                        <tr key={c.id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)', background: isSelected ? 'rgba(201,168,76,0.08)' : 'transparent'}}>
                          <td style={{padding:'8px 12px'}}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleRecipient(c)}
                              style={{cursor:'pointer'}}
                            />
                          </td>
                          <td style={{padding:'8px 12px', fontWeight:600}}>{c.client_name}</td>
                          <td style={{padding:'8px 12px', fontSize:'0.72rem', color:'var(--gold-300)'}}>
                            <span style={{background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:'4px'}}>{c.label}</span>
                          </td>
                          <td style={{padding:'8px 12px', color:'var(--text-secondary)', fontFamily:'var(--font-mono)'}}>
                            {dispatchChannel === 'whatsapp' ? (c.client_phone || 'No phone') : (c.client_email || 'No email')}
                          </td>
                          <td style={{padding:'8px 12px'}}>
                            <button 
                              onClick={() => executeDispatch(c)}
                              style={{
                                padding:'4px 8px', borderRadius:'4px',
                                background: dispatchChannel === 'whatsapp' ? '#4db6ac' : 'var(--gold-500)',
                                color:'var(--navy-950)', border:'none', fontSize:'0.72rem', fontWeight:700, cursor:'pointer'
                              }}
                            >
                              ⚡ Send
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>
                {selectedRecipients.length} client{selectedRecipients.length === 1 ? '' : 's'} selected
              </div>
              <div style={{display:'flex', gap:'8px'}}>
                <button 
                  onClick={() => setShowDispatchModal(false)}
                  className="secondary-btn"
                  style={{padding:'6px 14px', fontSize:'0.78rem', borderRadius:'4px'}}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    selectedRecipients.forEach(r => executeDispatch(r));
                    if (showToast) showToast(`🚀 Dispatched to ${selectedRecipients.length} recipients!`, 'success');
                    setShowDispatchModal(false);
                  }}
                  disabled={selectedRecipients.length === 0}
                  className="primary-btn"
                  style={{padding:'6px 14px', fontSize:'0.78rem', borderRadius:'4px', background:'var(--gold-gradient)', color:'var(--navy-950)', fontWeight:700}}
                >
                  🚀 Dispatch to Selected ({selectedRecipients.length})
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
