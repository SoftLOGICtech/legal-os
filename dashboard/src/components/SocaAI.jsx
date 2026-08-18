import React, { useState, useRef, useEffect } from 'react';

/**
 * SocaAI.jsx — Co-Counsel Command Center
 * Design: Refined typography, unified inputs, elegant Chat UI.
 */

const EAKLR_CASES = [
  { citation: 'Dina Management Ltd v. Attorney General [2021] eKLR', court: 'Supreme Court of Kenya', ratio: 'S.26 Land Registration Act does not protect title derived from an absolutely void or illegal root — bona fide purchaser cannot cure illegality over public land', issue: 'S.26 LRA / Public Land / BFP' },
  { citation: 'Obiero v. Opiyo [1972] EA 227', court: 'East African Court of Appeal', ratio: 'Adverse possession requires actual, peaceful, open possession inconsistent with the true owner\'s title for the full statutory period', issue: 'Adverse Possession' },
  { citation: 'Shimmers Plaza Ltd v. National Bank of Kenya [2014] eKLR', court: 'Court of Appeal', ratio: 'A court of equity will not assist a party who comes with unclean hands; fraud vitiates everything', issue: 'Fraud / Illegality' },
  { citation: 'Wanjiku Muhoro v. Othaya Farmers\' Co-op [2017] eKLR', court: 'Employment & Labour Relations Court', ratio: 'Employer must demonstrate substantive and procedural fairness in termination; burden is on the employer under S.47(5) Employment Act', issue: 'Unfair Termination (S.45 EA)' },
  { citation: 'Republic v. Commissioner of Lands Ex parte Ngong Hills Ltd [2015] eKLR', court: 'High Court (Judicial Review)', ratio: 'Administrative revocation of land rights without prior notice and opportunity to be heard violates Article 47 Constitution and the Fair Administrative Action Act 2015', issue: 'Judicial Review Grounds / Constitutional Violation' },
];

const CAUSE_OF_ACTION_ELEMENTS = {
  'Fraud / Illegality': [
    { element: 'A false representation of a material fact', proof: 'Plaintiff', status: null },
    { element: 'Known to be false (or made recklessly)', proof: 'Plaintiff', status: null },
    { element: 'Made with intent that it be relied upon', proof: 'Plaintiff', status: null },
    { element: 'Plaintiff relied upon the representation to their detriment', proof: 'Plaintiff', status: null },
    { element: 'Resulting damage or loss', proof: 'Plaintiff', status: null },
  ],
  'S.26 LRA — Indefeasibility of Title': [
    { element: 'Plaintiff holds a certificate of title issued under the Land Registration Act', proof: 'Plaintiff', status: null },
    { element: 'Plaintiff acquired the title through a registered transaction', proof: 'Plaintiff', status: null },
    { element: 'Plaintiff gave valuable consideration for the transfer', proof: 'Plaintiff', status: null },
    { element: 'Plaintiff had no actual notice of fraud or illegality', proof: 'Defendant (to rebut)', status: null },
    { element: 'Root of title was not derived from absolutely void act (public land exception)', proof: 'Defendant raises, Plaintiff rebuts', status: null },
  ],
};

const DEADLINE_RULES = [
  { type: 'Notice of Appeal — COA', trigger: 'judgment date', days: 14, rule: 'Rule 75(1) COA Rules', notes: 'Must be filed with the trial court' },
  { type: 'Record of Appeal — COA', trigger: 'notice filing date', days: 60, rule: 'Rule 82(1) COA Rules', notes: 'Includes: certified copies of judgment, proceedings, evidence' },
  { type: 'Bill of Costs Filing', trigger: 'decree date', days: 90, rule: 'O.62 r.12 CPR', notes: 'After entry of decree, costs must be taxed before certificate issued' },
];

const CHAT_HISTORY_INIT = [
  { role: 'assistant', content: 'I am SOCA AI Co-Counsel — your legal research and strategy assistant. I can help you:\n\n• **Analyse issues** and build elements checklists\n• **Draft skeleton arguments** with citation structures\n• **Search eKLR precedents** by topic\n• **Calculate statutory deadlines**\n\nWhat are we working on today?' }
];

export default function SocaAI({ caseId, caseName }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [chatHistory, setChatHistory] = useState(CHAT_HISTORY_INIT);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);

  const [selectedCOA, setSelectedCOA] = useState('S.26 LRA — Indefeasibility of Title');
  const [elementsState, setElementsState] = useState({});
  const [caseSearch, setCaseSearch] = useState('');
  const [deadlineType, setDeadlineType] = useState('');
  const [triggerDate, setTriggerDate] = useState('');
  const [deadlineResult, setDeadlineResult] = useState(null);
  const [skeletonPoints, setSkeletonPoints] = useState(['', '', '']);
  const [skeletonOutput, setSkeletonOutput] = useState('');

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    setChatHistory(h => [...h, { role: 'user', content: chatInput }]);
    setChatInput('');
    setIsThinking(true);
    setTimeout(() => {
      const q = chatInput.toLowerCase();
      let response = `**Strategy Analysis — ${chatInput.slice(0, 40)}…**\n\nBased on the case materials:\n\n**Key legal principle:** Every procedural step must be grounded in substantive rule of law.\n\n**Recommended approach:**\n1. Identify the applicable statutory framework\n2. Extract the elements of the cause of action / defense\n3. Map each element to specific evidence in your chronology`;
      if (q.includes('s.26') || q.includes('bona fide')) response = `**S.26 Land Registration Act — Indefeasibility Analysis**\n\nThe Supreme Court authoritatively settled this in *Dina Management Ltd v. AG [2021] eKLR*:\n\n> "Registration under the Land Registration Act does not confer indefeasibility where the root of title was derived from an absolutely void act over public land."\n\n**Strategic Implication:** This means even a bona fide purchaser for value without notice cannot rely on S.26 if the original alienation was over public land reserved by statute.`;
      setChatHistory(h => [...h, { role: 'assistant', content: response }]);
      setIsThinking(false);
    }, 1500);
  };

  const calculateDeadline = () => {
    const rule = DEADLINE_RULES.find(r => r.type === deadlineType);
    if (!rule || !triggerDate) return;
    const due = new Date(new Date(triggerDate).getTime() + rule.days * 86400000);
    const daysLeft = Math.floor((due - new Date()) / 86400000);
    setDeadlineResult({ ...rule, triggerDate, dueDate: due.toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }), daysLeft });
  };

  const generateSkeleton = () => {
    const points = skeletonPoints.filter(p => p.trim());
    if (points.length === 0) return;
    let skeleton = `SKELETON ARGUMENT\nMatter: ${caseName || 'Case'}\n${'═'.repeat(60)}\n\n`;
    points.forEach((point, i) => {
      skeleton += `${['I','II','III','IV'][i] || i+1}. ${point.toUpperCase()}\n\n   a. [Argument in support] ________________________\n   b. [Authority] __________________________________\n   c. [Application to facts] _______________________\n\n`;
    });
    setSkeletonOutput(skeleton);
  };

  const filteredCases = caseSearch ? EAKLR_CASES.filter(c => c.citation.toLowerCase().includes(caseSearch.toLowerCase()) || c.ratio.toLowerCase().includes(caseSearch.toLowerCase()) || c.issue.toLowerCase().includes(caseSearch.toLowerCase())) : EAKLR_CASES;

  const TABS = [
    { id: 'chat', label: 'AI Chat' },
    { id: 'issues', label: 'Issue Analyser' },
    { id: 'cases', label: 'eKLR Cases' },
    { id: 'deadlines', label: 'Deadlines' },
    { id: 'skeleton', label: 'Skeleton Builder' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: '600px', fontFamily: 'var(--font-body)' }}>
      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', background: 'var(--navy-900)', borderRadius: '10px 10px 0 0' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: activeTab === tab.id ? 'var(--gold-400)' : 'var(--text-muted)', borderBottom: activeTab === tab.id ? '2px solid var(--gold-500)' : '2px solid transparent', transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Chat ── */}
      {activeTab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '12px' }}>
                {msg.role === 'assistant' && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-gradient)', flexShrink: 0 }} />}
                <div style={{ maxWidth: '80%', padding: '16px 20px', borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0', background: msg.role === 'user' ? 'rgba(201,168,76,0.1)' : 'var(--navy-950)', border: '1px solid ' + (msg.role === 'user' ? 'rgba(201,168,76,0.3)' : 'var(--border-default)'), color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {msg.content.split('\n').map((line, j) => {
                    if (line.startsWith('**') && line.endsWith('**')) return <div key={j} style={{ fontWeight: 700, color: 'white', marginBottom: '6px' }}>{line.replace(/\*\*/g, '')}</div>;
                    if (line.startsWith('> ')) return <blockquote key={j} style={{ margin: '8px 0', padding: '8px 14px', borderLeft: '3px solid var(--gold-500)', background: 'rgba(201,168,76,0.04)', fontStyle: 'italic', color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)' }}>{line.slice(2)}</blockquote>;
                    if (line.startsWith('**') || line.includes('**')) return <div key={j} style={{ marginBottom: '6px' }}>{line.replace(/\*\*([^*]+)\*\*/g, (_, m) => m).trim()}</div>;
                    return <div key={j} style={{ minHeight: '12px' }}>{line}</div>;
                  })}
                </div>
              </div>
            ))}
            {isThinking && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-gradient)', flexShrink: 0 }} />
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Analysing…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '16px 32px', background: 'var(--navy-900)', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '12px' }}>
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }} placeholder="Ask SOCA AI a legal question…" rows={2} className="ws-textarea" style={{ flex: 1, resize: 'none' }} />
            <button onClick={handleChatSend} disabled={!chatInput.trim() || isThinking} className="primary-btn" style={{ alignSelf: 'flex-end', padding: '10px 20px' }}>Send</button>
          </div>
        </div>
      )}

      {/* ── Issues ── */}
      {activeTab === 'issues' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <div>
            <label className="ws-label">Cause of Action</label>
            <select value={selectedCOA} onChange={e => { setSelectedCOA(e.target.value); setElementsState({}); }} className="ws-select">
              {Object.keys(CAUSE_OF_ACTION_ELEMENTS).map(coa => <option key={coa}>{coa}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(CAUSE_OF_ACTION_ELEMENTS[selectedCOA] || []).map((el, i) => {
              const status = elementsState[i] || 'Unknown';
              return (
                <div key={i} style={{ padding: '16px 20px', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderLeft: `3px solid ${status === 'Established' ? '#4db6ac' : status === 'Disputed' ? '#ff9800' : status === 'Missing' ? '#ef5350' : 'transparent'}`, borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: 500, marginBottom: '4px' }}>{el.element}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Proof: <span style={{ color: 'var(--gold-400)' }}>{el.proof}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['Established', 'Disputed', 'Missing'].map(s => (
                      <button key={s} onClick={() => setElementsState(st => ({ ...st, [i]: s }))} style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-default)', background: status === s ? 'var(--gold-gradient)' : 'transparent', color: status === s ? 'var(--navy-950)' : 'var(--text-secondary)', fontWeight: status === s ? 700 : 400, cursor: 'pointer' }}>{s}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cases ── */}
      {activeTab === 'cases' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <input value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder="Search eKLR database…" className="ws-input" />
          {filteredCases.map((c, i) => (
            <div key={i} style={{ padding: '20px', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderLeft: '3px solid var(--gold-500)', borderRadius: '8px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'white', marginBottom: '6px' }}>{c.citation}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{c.court}</div>
              <blockquote style={{ margin: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', fontFamily: 'var(--font-serif)', lineHeight: 1.6 }}>"{c.ratio}"</blockquote>
              <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--gold-400)' }}>Issue: {c.issue}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Deadlines ── */}
      {activeTab === 'deadlines' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><label className="ws-label">Procedural Step</label><select value={deadlineType} onChange={e => { setDeadlineType(e.target.value); setDeadlineResult(null); }} className="ws-select"><option value="">— Select action type —</option>{DEADLINE_RULES.map(r => <option key={r.type}>{r.type}</option>)}</select></div>
            <div><label className="ws-label">Trigger Date</label><input type="date" value={triggerDate} onChange={e => { setTriggerDate(e.target.value); setDeadlineResult(null); }} className="ws-input" /></div>
            <button onClick={calculateDeadline} disabled={!deadlineType || !triggerDate} className="primary-btn" style={{ padding: '8px 20px' }}>Calculate</button>
          </div>
          {deadlineResult && (
            <div style={{ padding: '24px', background: 'var(--navy-950)', border: `1px solid ${deadlineResult.daysLeft < 0 ? '#ef5350' : '#4db6ac'}`, borderRadius: '8px', borderLeft: `4px solid ${deadlineResult.daysLeft < 0 ? '#ef5350' : '#4db6ac'}` }}>
              <div className="ws-section-label" style={{ color: 'var(--text-muted)' }}>{deadlineResult.type}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: deadlineResult.daysLeft < 0 ? '#ef5350' : '#4db6ac', marginBottom: '8px' }}>{deadlineResult.daysLeft < 0 ? `Overdue by ${Math.abs(deadlineResult.daysLeft)} days` : `${deadlineResult.daysLeft} days remaining`}</div>
              <div style={{ fontSize: '1.1rem', color: 'white', marginBottom: '8px' }}>Due: {deadlineResult.dueDate}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rule: {deadlineResult.rule}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Skeleton ── */}
      {activeTab === 'skeleton' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', gap: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="ws-section-label">Argument Points</div>
            {skeletonPoints.map((point, i) => (
              <div key={i}>
                <input value={point} onChange={e => setSkeletonPoints(pts => pts.map((p, j) => j === i ? e.target.value : p))} placeholder={`Argument point ${i + 1}`} className="ws-input" />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSkeletonPoints(pts => [...pts, ''])} className="secondary-btn">Add Point</button>
              <button onClick={generateSkeleton} className="primary-btn" disabled={skeletonPoints.every(p => !p.trim())}>Generate Skeleton</button>
            </div>
          </div>
          {skeletonOutput && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="ws-section-label">Generated Draft</div>
              <textarea value={skeletonOutput} readOnly rows={20} className="ws-textarea" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.6 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
