import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '../api';

/**
 * DepoStudio.jsx — Deposition & Strategy Studio
 * Design: Refined typography, inline prose for statuses, clean inputs.
 */

const WITNESS_STATUSES = { 'Not Yet Called': '#8A92A6', 'Scheduled': '#DFC06A', 'Deposed': '#4db6ac', 'In Cross': '#ef5350', 'Completed': '#4db6ac' };

const DEFAULT_WITNESSES = [
  {
    id: 'w1', name: 'Bawazir Mohamed', role: 'Plaintiff / MD — Dina Management Ltd',
    status: 'Deposed', side: 'Plaintiff', notes: 'Founder and MD of Dina Management. Purchased the property in 2004. Will testify on: circumstances of purchase, due diligence performed, history of quiet possession until revocation. Our key witness.',
    depositionOutline: [
      { id: 'do1', theme: 'Establish role as MD of Dina Management Ltd and business operations', done: true },
      { id: 'do2', theme: 'Walk through the 2004 acquisition — purchase price, searches conducted, legal advice obtained', done: true },
      { id: 'do3', theme: 'Confirm chain of title: Mombasa Beach Holdings → Dina Management via registered transfer', done: true },
      { id: 'do4', theme: 'Describe use and development of the property 2004–2011', done: false },
      { id: 'do5', theme: 'Describe discovery of Gazette Notice No. 4501/2011 revoking the lease', done: false },
      { id: 'do6', theme: 'Confirm no prior hearing or notice was issued before revocation — Article 47 argument', done: false },
    ],
    linkedFacts: [2, 3, 4, 5],
    contradictions: [
      { id: 'c1', witness: 'Their claim in defense', claim: 'The Plaintiff had notice of the 1989 PDP through the registry searches conducted', evidence: 'Registry search certificate dated 2004 shows no adverse entry or PDP notation', pincite: 'SOCA-ELC-022, p.4, l.7', status: 'Prepared' },
    ],
    concessions: ['Confirms purchase price of KES 90,000,000 fully paid', 'Confirms all statutory searches were conducted before completion', 'Confirms quiet possession for 7 years (2004–2011)'],
  },
  {
    id: 'w2', name: 'Chief Lands Officer (DW-1)', role: 'Defense Witness — State Department of Lands',
    status: 'Scheduled', side: 'Defense', notes: 'Critical hostile witness. Their testimony will attempt to justify the revocation on public interest grounds. We attack: (1) PDP not endorsed on register, (2) No hearing given, (3) No compensation offered.',
    depositionOutline: [
      { id: 'do7', theme: 'Confirm designation and authority as Chief Lands Officer in 1989 and 2011', done: false },
      { id: 'do8', theme: 'Confirm PDP No. 340/89 was deposited — and why it was not annotated on the Land Register', done: false },
      { id: 'do9', theme: 'Establish: who authorized the 1992 lease grant despite the PDP?', done: false },
      { id: 'do10', theme: 'Confront: no notice issued before 2011 revocation (Article 47 Constitution / Fair Administrative Action Act)', done: false },
      { id: 'do11', theme: 'Confirm: no compensation has been paid or offered (Article 40(3) Constitution)', done: false },
    ],
    linkedFacts: [1, 2, 4],
    contradictions: [
      { id: 'c2', witness: 'DW-1 WS para 12', claim: 'The Plaintiff and all predecessors had constructive notice of the reserved public access strip from the PDP', evidence: 'PDP No. 340/89 was never endorsed, annotated or registered against Title CR 18452 as required by s.54 of the Government Lands Act', pincite: 'SOCA-ELC-021, p.3, l.14', status: 'Prepared' },
      { id: 'c3', witness: 'DW-1 WS para 18', claim: 'The revocation was carried out in full compliance with the law and the Plaintiff was given opportunity to be heard', evidence: 'No hearing notice addressed to Dina Management Ltd exists in the Lands Ministry file produced as Exh. D-3 — total absence of any record', pincite: 'SOCA-ELC-025, p.1, l.1', status: 'Needs Exhibit' },
    ],
    concessions: ['Will concede PDP was never registered against the title', 'Compelled to admit no WHT certificate or compensation assessed', 'Cannot deny 7-year period of undisturbed possession by Dina Management'],
  },
];

const CONTRA_STATUSES = { 'Prepared': '#4db6ac', 'Needs Exhibit': '#ff9800', 'Deployed in Trial': '#DFC06A' };

export default function DepoStudio({ caseId, caseName, facts }) {
  const [witnesses, setWitnesses] = useState([]);
  const [activeWitnessId, setActiveWitnessId] = useState(null);

  const fetchWitnesses = useCallback(async () => {
    try {
      const res = await apiGet(`/api/cases/${caseId}/witnesses`);
      const data = await res.json();
      setWitnesses(data || []);
      if (data && data.length > 0 && !activeWitnessId) {
        setActiveWitnessId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch witnesses:', err);
    }
  }, [caseId, activeWitnessId]);

  useEffect(() => {
    fetchWitnesses();
  }, [fetchWitnesses]);

  const ALL_FACTS = facts || [];
  const [addWitnessModal, setAddWitnessModal] = useState(false);
  const [newWitness, setNewWitness] = useState({ name: '', role: '', side: 'Plaintiff', status: 'Not Yet Called', notes: '' });
  
  const [newOutlineTheme, setNewOutlineTheme] = useState('');
  const [newContradiction, setNewContradiction] = useState({ claim: '', evidence: '', pincite: '', status: 'Needs Exhibit' });
  const [showAddContra, setShowAddContra] = useState(false);
  const [newConcession, setNewConcession] = useState('');

  const activeWitness = witnesses.find(w => w.id === activeWitnessId);
  const toggleOutlineDone = async (witnessId, themeId, currentDoneStatus) => {
    try {
      await apiPut(`/api/outlines/${themeId}/toggle`, { is_done: !currentDoneStatus });
      fetchWitnesses();
    } catch (err) {
      console.error(err);
    }
  };
  
  const addOutlineTheme = async (witnessId) => {
    if (!newOutlineTheme.trim()) return;
    try {
      await apiPost(`/api/witnesses/${witnessId}/outlines`, { theme: newOutlineTheme });
      setNewOutlineTheme('');
      fetchWitnesses();
    } catch (err) {
      console.error(err);
    }
  };

  const addContradiction = async (witnessId) => {
    if (!newContradiction.claim) return;
    try {
      await apiPost(`/api/witnesses/${witnessId}/impeachment`, newContradiction);
      setNewContradiction({ claim: '', evidence: '', pincite: '', status: 'Needs Exhibit' });
      setShowAddContra(false);
      fetchWitnesses();
    } catch (err) {
      console.error(err);
    }
  };

  const addConcession = async (witnessId) => {
    if (!newConcession.trim()) return;
    const witness = witnesses.find(w => w.id === witnessId);
    const updatedConcessions = [...(witness.concessions || []), newConcession];
    try {
      await apiPut(`/api/witnesses/${witnessId}/concessions`, { concessions: updatedConcessions });
      setNewConcession('');
      fetchWitnesses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWitness = async () => {
    if (!newWitness.name) return;
    try {
      const rawRes = await apiPost(`/api/cases/${caseId}/witnesses`, newWitness);
      const res = await rawRes.json();
      if (res && res.id) setActiveWitnessId(res.id);
      setAddWitnessModal(false);
      setNewWitness({ name: '', role: '', side: 'Plaintiff', status: 'Not Yet Called', notes: '' });
      fetchWitnesses();
    } catch (err) {
      console.error(err);
    }
  };

  const exportAttackScript = (witness) => {
    if (!witness) return;
    let txt = `CROSS-EXAMINATION ATTACK SCRIPT\nWitness: ${witness.name}\nRole: ${witness.role}\nMatter: ${caseName || 'Case'}\n${'═'.repeat(60)}\n\n`;
    txt += `DEPOSITION OUTLINE\n${'─'.repeat(30)}\n`;
    witness.depositionOutline?.forEach((t, i) => { txt += `${i + 1}. [${t.done ? 'X' : ' '}] ${t.theme}\n`; });
    txt += `\nIMPEACHMENT MATRIX\n${'─'.repeat(30)}\n`;
    (witness.contradictions || []).forEach((c, i) => {
      txt += `\nContradiction ${i + 1} (${c.status})\n  Claim: "${c.claim}"\n  Evidence: ${c.evidence}\n  Pincite: ${c.pincite}\n`;
    });
    txt += `\nFAVORABLE CONCESSIONS\n${'─'.repeat(30)}\n`;
    (witness.concessions || []).forEach((c, i) => { txt += `${i + 1}. ${c}\n`; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `AttackScript_${witness.name.replace(/\s+/g, '_')}_${Date.now()}.txt`; a.click();
  };

  // Feature States
  const [previewExhibit, setPreviewExhibit] = useState(null);
  const [isScanningAi, setIsScanningAi] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  // Move outline item up (-1) or down (+1)
  const handleMoveOutline = async (index, direction) => {
    if (!activeWitness || !activeWitness.depositionOutline) return;
    const outline = [...activeWitness.depositionOutline];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= outline.length) return;
    
    const temp = outline[index];
    outline[index] = outline[targetIndex];
    outline[targetIndex] = temp;

    const outline_ids = outline.map(t => t.id);
    try {
      await apiPut(`/api/witnesses/${activeWitnessId}/outlines/reorder`, { outline_ids });
      fetchWitnesses();
    } catch (err) {
      console.error('Failed to reorder outline:', err);
    }
  };

  // Auto-fill contradiction form from selected extracted fact
  const handleSelectExtractedFact = (factId) => {
    if (!factId) return;
    const fact = ALL_FACTS.find(f => String(f.id) === String(factId));
    if (!fact) return;
    
    const pinciteVal = fact.pincite || (fact.source_doc ? `${fact.source_doc}, p.${fact.page_number || 1}` : 'Extracted Evidence');
    const evidenceVal = fact.description || fact.fact_text || fact.source_text || '';
    
    setNewContradiction(c => ({
      ...c,
      evidence: evidenceVal,
      pincite: pinciteVal,
      claim: c.claim || `Witness testimony regarding ${evidenceVal.slice(0, 40)}...`
    }));
  };

  // Trigger AI Contradiction Scan
  const handleAiAutoScan = async () => {
    if (!activeWitnessId) return;
    setIsScanningAi(true);
    setScanMsg('🤖 AI scanning case facts & witness statements...');
    try {
      const res = await apiPost(`/api/witnesses/${activeWitnessId}/auto-contradictions`);
      const data = await res?.json();
      setScanMsg(data?.message || `🤖 AI linked ${data?.count || 0} contradictions!`);
      fetchWitnesses();
    } catch (err) {
      setScanMsg('⚠️ AI scan error: ' + err.message);
    } finally {
      setTimeout(() => {
        setIsScanningAi(false);
        setScanMsg('');
      }, 4000);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', minHeight: '600px', fontFamily: 'var(--font-body)' }}>

      {/* ── LEFT: Roster ── */}
      <div style={{ width: '280px', flexShrink: 0, background: 'var(--navy-950)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold-400)' }}>Witness Roster</span>
          <button onClick={() => setAddWitnessModal(true)} style={{ background: 'none', border: 'none', color: 'var(--gold-400)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>+</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {witnesses.map(w => (
            <div key={w.id} onClick={() => setActiveWitnessId(w.id)} style={{ padding: '16px 18px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: activeWitnessId === w.id ? 'rgba(201,168,76,0.05)' : 'transparent', borderLeft: `3px solid ${activeWitnessId === w.id ? 'var(--gold-500)' : 'transparent'}`, transition: 'all 0.1s' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: activeWitnessId === w.id ? 600 : 400, color: activeWitnessId === w.id ? 'white' : 'var(--text-primary)', marginBottom: '4px' }}>{w.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '6px' }}>{w.role}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: WITNESS_STATUSES[w.status] }} />
                <span style={{ fontSize: '0.68rem', color: WITNESS_STATUSES[w.status] }}>{w.status}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>· {w.side}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Profile ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--navy-900)' }}>
        {!activeWitness ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem' }}>Select a witness from the roster</div>
          </div>
        ) : (
          <div style={{ padding: '32px 40px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: WITNESS_STATUSES[activeWitness.status] }} />
                    <span className="ws-section-label" style={{ color: WITNESS_STATUSES[activeWitness.status], padding: 0 }}>{activeWitness.status} · {activeWitness.side} Witness</span>
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'white' }}>{activeWitness.name}</h2>
                  <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{activeWitness.role}</div>
                </div>
                <button onClick={() => exportAttackScript(activeWitness)} className="secondary-btn">Export Script</button>
              </div>
              {activeWitness.notes && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid var(--border-default)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                  {activeWitness.notes}
                </div>
              )}
            </div>

            {/* SECTION 1: Outline with Reordering */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div className="ws-section-label" style={{ color: 'var(--gold-400)' }}>Deposition Outline</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Use ▲/▼ to reorder themes for trial</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {(activeWitness.depositionOutline || []).map((theme, idx) => (
                  <div key={theme.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: theme.done ? 'transparent' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (theme.done ? 'transparent' : 'var(--border-default)'), borderRadius: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button onClick={() => handleMoveOutline(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--gold-400)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.65rem', padding: 0 }}>▲</button>
                      <button onClick={() => handleMoveOutline(idx, 1)} disabled={idx === (activeWitness.depositionOutline.length - 1)} style={{ background: 'none', border: 'none', color: idx === (activeWitness.depositionOutline.length - 1) ? 'rgba(255,255,255,0.1)' : 'var(--gold-400)', cursor: idx === (activeWitness.depositionOutline.length - 1) ? 'default' : 'pointer', fontSize: '0.65rem', padding: 0 }}>▼</button>
                    </div>
                    <input type="checkbox" checked={theme.done} onChange={() => toggleOutlineDone(activeWitnessId, theme.id, theme.done)} style={{ accentColor: 'var(--gold-500)', cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>{idx + 1}.</span>
                    <span style={{ fontSize: '0.9rem', color: theme.done ? 'var(--text-muted)' : 'white', lineHeight: 1.5, textDecoration: theme.done ? 'line-through' : 'none', flex: 1 }}>{theme.theme}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newOutlineTheme} onChange={e => setNewOutlineTheme(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOutlineTheme(activeWitnessId)} placeholder="Add question theme…" className="ws-input" />
                <button onClick={() => addOutlineTheme(activeWitnessId)} className="secondary-btn">Add</button>
              </div>
            </section>

            {/* SECTION 2: Contradictions with AI Scanner & Fact Selector */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div className="ws-section-label" style={{ color: '#ef5350', padding: 0 }}>Impeachment Matrix</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button 
                    onClick={handleAiAutoScan} 
                    className="secondary-btn" 
                    style={{ borderColor: '#ba68c8', color: '#ba68c8', fontSize: '0.75rem', padding: '4px 10px' }}
                    disabled={isScanningAi}
                  >
                    {isScanningAi ? '🤖 Scanning...' : '🤖 AI Scan Contradictions'}
                  </button>
                  <button onClick={() => setShowAddContra(s => !s)} style={{ background: 'none', border: 'none', color: '#ef5350', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>+ Add Entry</button>
                </div>
              </div>

              {scanMsg && (
                <div style={{ padding: '10px 14px', background: 'rgba(186,104,200,0.1)', border: '1px solid rgba(186,104,200,0.3)', borderRadius: '6px', fontSize: '0.8rem', color: '#ba68c8', marginBottom: '12px' }}>
                  {scanMsg}
                </div>
              )}
              
              {showAddContra && (
                <div style={{ padding: '16px', background: 'rgba(239,83,80,0.04)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Link Extracted Fact Dropdown */}
                  <div>
                    <label className="ws-label" style={{ color: 'var(--gold-400)' }}>🔗 Link Extracted Fact (Auto-Fill Evidence)</label>
                    <select className="ws-select" onChange={e => handleSelectExtractedFact(e.target.value)} defaultValue="">
                      <option value="" disabled>-- Select extracted fact from Doc Reviewer / Chronology --</option>
                      {ALL_FACTS.map(f => (
                        <option key={f.id} value={f.id}>
                          📌 {f.fact_date ? f.fact_date + ': ' : ''}{(f.description || f.source_text || '').slice(0, 70)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  <div><label className="ws-label">Their Claim</label><textarea value={newContradiction.claim} onChange={e => setNewContradiction(c => ({ ...c, claim: e.target.value }))} rows={2} className="ws-textarea" placeholder="e.g. Witness claims notice was given before demolition..." /></div>
                  <div><label className="ws-label">Our Evidence</label><textarea value={newContradiction.evidence} onChange={e => setNewContradiction(c => ({ ...c, evidence: e.target.value }))} rows={2} className="ws-textarea" placeholder="e.g. Police log certificate shows total absence of notice..." /></div>
                  <div><label className="ws-label">Pincite</label><input value={newContradiction.pincite} onChange={e => setNewContradiction(c => ({ ...c, pincite: e.target.value }))} className="ws-input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="e.g. Exh. P-4, p.2, l.14" /></div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowAddContra(false)} className="secondary-btn" style={{ fontSize: '0.75rem' }}>Cancel</button>
                    <button onClick={() => addContradiction(activeWitnessId)} className="primary-btn" style={{ fontSize: '0.75rem' }}>Add Contradiction</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(activeWitness.contradictions || []).length === 0 ? (
                  <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', border: '1px dashed var(--border-default)', textAlign: 'center', borderRadius: '6px' }}>No contradictions added.</div>
                ) : (
                  (activeWitness.contradictions || []).map(c => (
                    <div key={c.id} style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderLeft: '3px solid #ef5350', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Source: {c.witness || 'Witness Testimony'}</span>
                        <span style={{ fontSize: '0.7rem', color: CONTRA_STATUSES[c.status], fontWeight: 600 }}>{c.status}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div className="ws-label" style={{ color: '#ef5350' }}>Their Claim</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>"{c.claim}"</div>
                        </div>
                        <div>
                          <div className="ws-label" style={{ color: '#4db6ac' }}>Our Evidence</div>
                          <div style={{ fontSize: '0.9rem', color: 'white', lineHeight: 1.5 }}>{c.evidence}</div>
                        </div>
                        {c.pincite && (
                          <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="ws-pincite">🎯 {c.pincite}</div>
                            <button 
                              onClick={() => setPreviewExhibit(c)} 
                              className="secondary-btn" 
                              style={{ fontSize: '0.7rem', padding: '2px 8px', borderColor: 'var(--gold-500)', color: 'var(--gold-400)' }}
                            >
                              👁️ Preview Exhibit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* SECTION 3: Concessions */}
            <section>
              <div className="ws-section-label" style={{ marginBottom: '12px', color: '#4db6ac' }}>Favorable Concessions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {(activeWitness.concessions || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: 'rgba(77,182,172,0.05)', border: '1px solid rgba(77,182,172,0.2)', borderRadius: '6px' }}>
                    <span style={{ color: '#4db6ac', fontWeight: 800 }}>✓</span>
                    <span style={{ fontSize: '0.85rem', color: 'white', lineHeight: 1.5 }}>{c}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newConcession} onChange={e => setNewConcession(e.target.value)} onKeyDown={e => e.key === 'Enter' && addConcession(activeWitnessId)} placeholder="Add a concession to extract…" className="ws-input" />
                <button onClick={() => addConcession(activeWitnessId)} className="secondary-btn">Add</button>
              </div>
            </section>

          </div>
        )}
      </div>

      {/* ── Exhibit Side-Drawer / Modal Preview ── */}
      {previewExhibit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,14,28,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--navy-900)', borderLeft: '1px solid var(--border-default)', width: '500px', maxWidth: '90vw', height: '100%', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px' }}>
              <div>
                <span className="ws-section-label" style={{ color: 'var(--gold-400)' }}>EXHIBIT PREVIEW</span>
                <h3 style={{ margin: '4px 0 0', color: 'white', fontSize: '1.2rem' }}>{previewExhibit.pincite || 'Document Snippet'}</h3>
              </div>
              <button onClick={() => setPreviewExhibit(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <div className="ws-label" style={{ color: '#ef5350' }}>Opposing Witness Statement / Claim</div>
              <div style={{ background: 'rgba(239,83,80,0.06)', border: '1px solid rgba(239,83,80,0.2)', padding: '14px', borderRadius: '6px', color: 'white', fontSize: '0.9rem', fontStyle: 'italic' }}>
                "{previewExhibit.claim}"
              </div>
            </div>

            <div>
              <div className="ws-label" style={{ color: '#4db6ac' }}>Direct Evidence Snippet</div>
              <div style={{ background: 'rgba(77,182,172,0.06)', border: '1px solid rgba(77,182,172,0.2)', padding: '16px', borderRadius: '6px', color: 'white', fontSize: '0.92rem', lineHeight: 1.6, fontFamily: 'var(--font-serif)' }}>
                {previewExhibit.evidence}
              </div>
            </div>

            <div style={{ background: 'var(--navy-950)', border: '1px solid var(--border-default)', padding: '14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>🎯 <strong>Formal Pincite Tag:</strong> {previewExhibit.pincite}</div>
              <div>⚖️ <strong>Case Matter:</strong> {caseName || 'SOCA Active Case'}</div>
              <div>📌 <strong>Trial Status:</strong> {previewExhibit.status}</div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
              <button 
                className="primary-btn" 
                style={{ flex: 1 }}
                onClick={() => {
                  navigator.clipboard.writeText(`[Exhibit ${previewExhibit.pincite}]: "${previewExhibit.evidence}"`);
                  alert('Copied formal citation to clipboard!');
                }}
              >
                📋 Copy Citation
              </button>
              <button className="secondary-btn" onClick={() => setPreviewExhibit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {addWitnessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,14,28,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '32px', width: '460px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'white', marginBottom: '8px' }}>Add Witness</div>
            <div>
              <label className="ws-label">Full Name *</label>
              <input value={newWitness.name} onChange={e => setNewWitness(f => ({ ...f, name: e.target.value }))} className="ws-input" />
            </div>
            <div>
              <label className="ws-label">Role / Designation</label>
              <input value={newWitness.role} onChange={e => setNewWitness(f => ({ ...f, role: e.target.value }))} className="ws-input" />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}><label className="ws-label">Side</label><select value={newWitness.side} onChange={e => setNewWitness(f => ({ ...f, side: e.target.value }))} className="ws-select"><option>Plaintiff</option><option>Defense</option><option>Expert</option></select></div>
              <div style={{ flex: 1 }}><label className="ws-label">Status</label><select value={newWitness.status} onChange={e => setNewWitness(f => ({ ...f, status: e.target.value }))} className="ws-select">{Object.keys(WITNESS_STATUSES).map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div>
              <label className="ws-label">Strategic Notes</label>
              <textarea value={newWitness.notes} onChange={e => setNewWitness(f => ({ ...f, notes: e.target.value }))} rows={3} className="ws-textarea" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button onClick={() => setAddWitnessModal(false)} className="secondary-btn" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAddWitness} className="primary-btn" disabled={!newWitness.name} style={{ flex: 2 }}>Add Witness</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
