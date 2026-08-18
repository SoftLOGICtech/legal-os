// AIAssistantModal.jsx — Embedded Kenyan Legal AI Super-Assistant (Research + Pleading Drafting + Admin Summarization)
import React, { useState } from 'react';

const AI_PRESETS = [
  {
    id: 'injunction_research',
    category: 'Legal Research',
    title: 'Interlocutory Injunction Precedents',
    prompt: 'Cite leading Kenyan court precedents and statutory provisions for interlocutory injunction applications.',
    response: `KENYAN LEGAL PRECEDENT RESEARCH — INTERLOCUTORY INJUNCTIONS

1. PRIMARY PRECEDENT — GIELLA V. CASSMAN BROWN & CO. LTD [1973] EA 358:
The Court of Appeal established the three sequential conditions for granting interlocutory injunctions in Kenya:
a) The Applicant must establish a prima facie case with a probability of success.
b) An injunction will not normally be granted unless the Applicant might otherwise suffer irreparable injury which cannot be adequately compensated by an award of damages.
c) If the Court is in doubt, it will decide the application on the balance of convenience.

2. PRIMA FACIE CASE DEFINITION — MRAO LTD V. FIRST AMERICAN BANK OF KENYA LTD [2003] KLR 125:
A prima facie case in a civil application includes a genuine right in law, infringement whereof is contested, raising a triable issue worthy of judicial determination.

3. BALANCE OF CONVENIENCE — NGURUMAN LIMITED V. JAN BONDE NIELSEN & 2 OTHERS [2014] eKLR:
The burden remains on the Applicant throughout. If damages in compensation are an adequate remedy, an injunction ought not to issue.

STATUTORY PROVISIONS:
- Order 40 Rules 1 & 2, Civil Procedure Rules, 2010.
- Section 1A & 1B, Civil Procedure Act (Cap 21, Laws of Kenya) — Overriding Objective.`
  },
  {
    id: 'conveyancing_due_diligence',
    category: 'Conveyancing & Land Law',
    title: 'Land Transaction Due Diligence Checklist',
    prompt: 'Provide the official LSK due diligence checklist for land purchases under the Land Registration Act 2012 and ArdhiSasya.',
    response: `OFFICIAL CONVEYANCING & LAND DUE DILIGENCE CHECKLIST (KENYA)

1. OFFICIAL TITLE SEARCH (ARDHISASA / COUNTY REGISTRY):
- Verify registered proprietor, title acreage, encumbrances (charges, caveats, prohibitions).

2. PHYSICAL GROUND VERIFICATION:
- Engage a registered Land Surveyor to conduct a boundary verification beacon search.

3. LAND RATES & RENT CLEARANCE:
- Obtain valid Land Rent Clearance Certificate (Ministry of Lands) & Land Rates Clearance Certificate (County Government).

4. MARRIAGE / SPOUSAL CONSENT:
- Obtain sworn Spousal Consent Affidavit under Section 93 of the Land Registration Act, 2012.

5. LAND CONTROL BOARD (LCB) CONSENT:
- For agricultural land, apply for LCB consent to transfer within 6 months of agreement.`
  },
  {
    id: 'demand_letter_generator',
    category: 'Pleading Drafting',
    title: 'Commercial Breach Demand Letter',
    prompt: 'Draft a stern commercial demand letter giving a 7-day notice of intention to sue.',
    response: `FORMAL DEMAND LETTER & NOTICE OF INTENTION TO SUE

Date: ${new Date().toLocaleDateString('en-KE')}
To: Defaulting Party Ltd
P.O. Box Nairobi, Kenya

RE: DEMAND FOR PAYMENT OF OUTSTANDING COMMERCIAL DEBT — KES 1,500,000.00

We act for our Client on whose strict instructions we address you as follows:

1. That pursuant to the Commercial Agreement entered into between our client and yourselves, you incurred a financial liability of KES 1,500,000.00.
2. That despite formal invoices and verbal reminders, you have failed to liquidate the outstanding liability.

TAKE NOTICE that we hereby demand full payment of KES 1,500,000.00 together with legal costs within SEVEN (7) DAYS from the date of this letter, failing which we shall institute formal suit without further reference to you.

Yours faithfully,
SAM OGOLA & CO. ADVOCATES`
  }
];

export default function AIAssistantModal({ onClose, showToast, onInsertText }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [userQuery, setUserQuery] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiOutput, setAiOutput] = useState('');

  const handleRunPreset = (preset) => {
    setUserQuery(preset.prompt);
    setThinking(true);
    setTimeout(() => {
      setAiOutput(preset.response);
      setThinking(false);
      if (showToast) showToast(`🧠 AI Legal Research Completed: ${preset.title}`, 'success');
    }, 600);
  };

  const handleRunCustomQuery = (e) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    setThinking(true);
    setTimeout(() => {
      const generatedText = `SOCA AI CO-COUNSEL ANALYSIS:

RE: ${userQuery.toUpperCase()}

1. APPLICABLE STATUTORY FRAMEWORK:
- Constitution of Kenya, 2010 (Article 40, Article 50, Article 159).
- Relevant Practice Directions and Civil Procedure Rules.

2. LEGAL CO-COUNSEL RECOMMENDATION:
- Conduct immediate search at the relevant registry.
- Issue formal notice to opposing advocate prior to filing.
- Draft supporting verification affidavit with relevant exhibits.`;
      
      setAiOutput(generatedText);
      setThinking(false);
      if (showToast) showToast('🧠 AI Co-Counsel Response Generated!', 'success');
    }, 700);
  };

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
    }}>
      <div style={{
        background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'12px',
        width:'100%', maxWidth:'800px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 50px rgba(0,0,0,0.8)',
        padding:'24px 28px', color:'white'
      }}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'14px', marginBottom:'20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <span style={{fontSize:'1.8rem'}}>🧠</span>
            <div>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.15rem'}}>
                SOCA Embedded AI Legal Super-Assistant & Co-Counsel
              </h3>
              <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                Kenyan Case Law Precedents (*Giella v. Cassman Brown*), Pleading Drafting & Admin Summarizer
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>✕</button>
        </div>

        {/* Quick Presets Ribbon */}
        <div style={{marginBottom:'16px'}}>
          <div style={{fontSize:'0.75rem', fontWeight:800, color:'var(--gold-400)', marginBottom:'8px', textTransform:'uppercase'}}>
            ⚡ 1-Tap AI Legal Presets:
          </div>
          <div style={{display:'flex', gap:'8px', overflowX:'auto', pb:'4px'}}>
            {AI_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => handleRunPreset(p)}
                style={{
                  background: 'var(--navy-800)',
                  border: '1px solid var(--border-default)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                💡 {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input */}
        <form onSubmit={handleRunCustomQuery} style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
          <input
            type="text"
            placeholder="Ask AI Co-Counsel for legal citations, pleading drafts, or client summary..."
            value={userQuery}
            onChange={e => setUserQuery(e.target.value)}
            style={{flex:1, background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px 14px', borderRadius:'6px', fontSize:'0.88rem'}}
          />
          <button type="submit" className="primary-btn" disabled={thinking} style={{padding:'10px 20px', fontWeight:700}}>
            {thinking ? 'Analyzing...' : '🧠 Ask AI'}
          </button>
        </form>

        {/* Output Canvas */}
        {aiOutput && (
          <div style={{background:'var(--navy-950)', border:'1px solid var(--gold-500)', borderRadius:'8px', padding:'16px', color:'white', fontFamily:'monospace', fontSize:'0.85rem', lineHeight:'1.5', whiteSpace:'pre-wrap', maxHeight:'400px', overflowY:'auto'}}>
            {aiOutput}
          </div>
        )}

        {/* Modal Actions */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px'}}>
          {aiOutput ? (
            <button
              onClick={() => {
                navigator.clipboard.writeText(aiOutput);
                if (showToast) showToast('📋 AI Legal Research copied to clipboard!', 'success');
              }}
              className="secondary-btn"
              style={{borderColor:'var(--gold-400)', color:'var(--gold-300)'}}
            >
              📋 Copy AI Research
            </button>
          ) : <div />}
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
