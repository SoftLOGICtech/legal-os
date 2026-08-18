import React, { useState, useMemo, useEffect } from 'react';
import { apiPost, apiDelete, apiPut } from '../api';

/**
 * ChronologyView.jsx — Scalable Case Chronology
 * Design: Stripped-back table-style timeline. Facts as rows, not cards of pills.
 * Source text revealed inline. Citations in monospace. Status as coloured dot + word.
 */

const STATUS = {
  Procured: { color: '#4db6ac', dot: '#4db6ac' },
  Disputed: { color: '#ff9800', dot: '#ff9800' },
  Missing:  { color: '#ef5350', dot: '#ef5350' },
};

const SAMPLE_FACTS = [
  { id: 1, date: '1989-04-15', description: 'Part Development Plan (PDP No. 340/89) deposited at Land Registry designating Plot MN/I/8342 as reserved public beach access road.', sourceText: 'The Commissioner of Lands hereby deposits the Part Development Plan designating the demarcated coastal strip as reserved public access road under regulation 5 of the Land Planning Act.', pincite: 'SOCA-ELC-021, p.3, l.14', issues: ['Public Land / NLC', 'Fraud / Illegality'], witness: 'Commissioner of Lands', status: 'Procured', notes: 'Foundational fact. PDP predates the title grant — establishes the allocation was illegal ab initio. Note: PDP was never endorsed on the land register.', docName: 'Exh. D-1 (1989 PDP)', bate: 'SOCA-ELC-021' },
  { id: 2, date: '1992-11-28', description: 'Lease Grant CR 18452 issued to Mombasa Beach Holdings Ltd notwithstanding existence of the 1989 PDP.', sourceText: 'The Government of Kenya grants to Mombasa Beach Holdings Ltd a 99-year lease over plot MN/I/8342 subject to all existing encumbrances.', pincite: 'SOCA-ELC-020, p.1, l.1', issues: ['Fraud / Illegality', 'S.26 LRA — Bona Fide Purchaser'], witness: 'Chief Lands Officer', status: 'Disputed', notes: 'Respondent claims the grant was regular. Our position: issued in violation of the PDP; S.26 LRA cannot cure an absolutely void act over public land — Dina Management v. AG [2021].', docName: 'Exh. P-1 (Title Deed CR 18452)', bate: 'SOCA-ELC-020' },
  { id: 3, date: '2004-03-12', description: 'Sale Agreement executed — Dina Management Ltd acquires Plot MN/I/8342 from Mombasa Beach Holdings for KES 90,000,000.', sourceText: 'Vendor agrees to sell and Purchaser agrees to purchase the property known as MN/I/8342 for the sum of Kenya Shillings Ninety Million, full purchase price to be paid on completion.', pincite: 'SOCA-ELC-022, p.2, l.5', issues: ['S.26 LRA — Bona Fide Purchaser'], witness: 'Plaintiff / Claimant', status: 'Procured', notes: 'Full purchase price paid. Registry searches conducted prior to completion showed no adverse entry. Foundation for the S.26 LRA bona fide purchaser defense.', docName: 'Exh. P-2 (Sale Agreement)', bate: 'SOCA-ELC-022' },
  { id: 4, date: '2011-06-30', description: 'Gazette Notice No. 4501 published revoking Lease CR 18452 — stated grounds: public interest. No prior notice issued to Dina Management Ltd.', sourceText: 'The Cabinet Secretary for Lands hereby revokes Lease No. CR 18452 in the public interest under section 47 of the Government Lands Act Cap 280.', pincite: 'SOCA-ELC-023, p.1, l.1', issues: ['Public Land / NLC', 'Constitutional Violation (Art.47)'], witness: 'Court Registrar', status: 'Procured', notes: 'Central administrative act challenged. No prior hearing given — violates Article 47 Constitution and Fair Administrative Action Act 2015. No compensation assessed or offered.', docName: 'Exh. P-3 (Gazette Notice)', bate: 'SOCA-ELC-023' },
  { id: 5, date: '2018-03-14', description: 'ELC suit filed — Dina Management Ltd v. Attorney General & 3 Others (ELC No. 12 of 2018 at the Environment & Land Court, Mombasa).', sourceText: 'The Plaintiff avers that the revocation was unconstitutional, null and void, being made without prior notice or hearing, and seeks a declaration and compensation.', pincite: 'SOCA-ELC-001, p.1, l.1', issues: ['Constitutional Violation (Art.47)', 'Judicial Review Grounds'], witness: 'Plaintiff / Claimant', status: 'Procured', notes: 'Causes of action: (1) unconstitutional revocation — Art.47; (2) violation of property rights — Art.40(3); (3) legitimate expectation; (4) malicious exercise of statutory power.', docName: 'Plaint (ELC No. 12/2018)', bate: 'SOCA-ELC-001' },
  { id: 6, date: '2021-09-22', description: 'Supreme Court Petition No. 8 of 2021 filed — challenging Court of Appeal decision upholding dismissal of ELC suit.', sourceText: 'The Petitioner contends that the Court of Appeal erred in holding that S.26 LRA does not protect title acquired from a grant over land reserved under the Government Lands Act.', pincite: 'SOCA-ELC-031, p.4, l.22', issues: ['S.26 LRA — Bona Fide Purchaser', 'Constitutional Violation (Art.47)'], witness: 'Plaintiff / Claimant', status: 'Procured', notes: 'Apex court question: does S.26 LRA protect a bona fide purchaser for value where the root title was over land reserved under statute? SC held: No — Dina Management Ltd v. AG [2021] eKLR.', docName: 'SC Petition No. 8/2021', bate: 'SOCA-ELC-031' },
];

export default function ChronologyView({ caseId, caseName, facts: externalFacts, onFactsChange }) {
  const [facts, setFacts]               = useState(externalFacts || []);

  useEffect(() => {
    setFacts(externalFacts || []);
  }, [externalFacts]);

  const [filterIssue, setFilterIssue]   = useState('');
  const [filterWitness, setFilterWitness] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom]     = useState('');
  const [filterTo, setFilterTo]         = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedIds, setExpandedIds]   = useState(new Set([1])); // first one open by default
  const [sortDir, setSortDir]           = useState('asc');
  const [showAddForm, setShowAddForm]   = useState(false);
  const [newFact, setNewFact]           = useState({ date: '', description: '', pincite: '', status: 'Procured', notes: '', witness: '', issues: [] });

  const allIssues    = useMemo(() => [...new Set(facts.flatMap(f => (f.issues || []).map(i => i.name)))], [facts]);
  const allWitnesses = useMemo(() => [...new Set(facts.flatMap(f => (f.witnesses || []).map(w => w.name)))], [facts]);

  const filtered = useMemo(() => facts
    .filter(f => {
      const d = f.fact_date || f.date || '';
      if (filterIssue   && !(f.issues || []).some(i => i.name === filterIssue)) return false;
      if (filterWitness && !(f.witnesses || []).some(w => w.name === filterWitness)) return false;
      if (filterStatus  && f.status !== filterStatus) return false;
      if (filterFrom    && d < filterFrom) return false;
      if (filterTo      && d > filterTo) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!f.description?.toLowerCase().includes(q) && !f.pincite?.toLowerCase().includes(q) && !f.notes?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = a.fact_date || a.date || '';
      const db = b.fact_date || b.date || '';
      return sortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    }),
  [facts, filterIssue, filterWitness, filterStatus, filterFrom, filterTo, filterSearch, sortDir]);

  const gaps = useMemo(() => {
    const s = [...filtered].sort((a, b) => (a.fact_date || a.date || '').localeCompare(b.fact_date || b.date || ''));
    const result = [];
    for (let i = 0; i < s.length - 1; i++) {
      const d1 = s[i].fact_date || s[i].date;
      const d2 = s[i+1].fact_date || s[i+1].date;
      if (!d1 || !d2) continue;
      const days = Math.floor((new Date(d2) - new Date(d1)) / 86400000);
      if (days > 365) result.push({ afterId: s[i].id, days, from: d1, to: d2 });
    }
    return result;
  }, [filtered]);

  const toggle = id => setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const clear  = () => { setFilterIssue(''); setFilterWitness(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); setFilterSearch(''); };
  const hasFilter = filterIssue || filterWitness || filterStatus || filterFrom || filterTo || filterSearch;

  const addFact = async () => {
    if (!newFact.date || !newFact.description) return;
    try {
      const payload = {
        fact_date: newFact.date,
        description: newFact.description,
        pincite: newFact.pincite,
        issues: newFact.issues || [],
        contacts: newFact.witness ? [newFact.witness] : [],
        status: newFact.status || 'Procured'
      };
      const rawRes = await apiPost(`/api/cases/${caseId}/facts`, payload);
      const res = await rawRes.json();
      if (res && res.id) {
        if (onFactsChange) onFactsChange(); // Trigger parent fetch
        setNewFact({ date: '', description: '', pincite: '', status: 'Procured', notes: '', witness: '', issues: [] });
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to add fact:', err);
    }
  };

  const deleteFact = async (id) => {
    try {
      await apiDelete(`/api/cases/${caseId}/facts/${id}`);
      if (onFactsChange) onFactsChange();
    } catch (err) {
      console.error('Failed to delete fact:', err);
    }
  };

  const exportChronology = () => {
    let txt = `CHRONOLOGY OF EVENTS\n${caseName || 'Matter'}\nGenerated: ${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}\n${'═'.repeat(80)}\n\n`;
    filtered.forEach((f, i) => {
      txt += `${i + 1}.\t${f.fact_date || f.date}\n\t${f.description}\n`;
      if (f.sources && f.sources.length > 0) {
        txt += `\tSources: ${f.sources.map(s => `${s.file_name} (${s.pincite})`).join(', ')}\n`;
      }
      if (f.witnesses && f.witnesses.length > 0) {
        txt += `\tWitnesses: ${f.witnesses.map(w => w.name).join(', ')}\n`;
      }
      if (f.issues && f.issues.length > 0) {
        txt += `\tIssues: ${f.issues.map(iss => iss.name).join('; ')}\n`;
      }
      txt += `\tStatus: ${f.status}\n`;
      if (f.notes) txt += `\tNotes: ${f.notes}\n`;
      txt += '\n';
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `Chronology_${caseName || caseId || 'Case'}_${Date.now()}.txt`; a.click();
  };

  const inputSt = { padding: '5px 9px', background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '0.78rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: '600px', fontFamily: 'var(--font-body)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '10px 18px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--gold-400)' }}>Chronology of Events</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{filtered.length}/{facts.length} facts</span>
          {gaps.length > 0 && <span style={{ fontSize: '0.72rem', color: '#ff9800' }}>⚠ {gaps.length} gap{gaps.length > 1 ? 's' : ''}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="secondary-btn" style={{ fontSize: '0.73rem', padding: '4px 10px' }}>{sortDir === 'asc' ? '↑ Oldest first' : '↓ Newest first'}</button>
          <button onClick={exportChronology} className="secondary-btn" style={{ fontSize: '0.73rem', padding: '4px 10px' }}>Export</button>
          <button onClick={() => setShowAddForm(s => !s)} className="primary-btn" style={{ fontSize: '0.75rem', padding: '5px 12px', fontWeight: 700 }}>+ Add Fact</button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ padding: '8px 18px', background: 'var(--navy-950)', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search facts, pincites, notes…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ ...inputSt, minWidth: '180px' }} />
        <select value={filterIssue} onChange={e => setFilterIssue(e.target.value)} style={inputSt}>
          <option value="">All issues</option>
          {allIssues.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterWitness} onChange={e => setFilterWitness(e.target.value)} style={inputSt}>
          <option value="">All witnesses</option>
          {allWitnesses.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputSt}>
          <option value="">All statuses</option>
          <option value="Procured">Procured</option>
          <option value="Disputed">Disputed</option>
          <option value="Missing">Missing</option>
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputSt} title="From" />
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputSt} title="To" />
        {hasFilter && <button onClick={clear} style={{ fontSize: '0.72rem', padding: '4px 9px', background: 'none', border: '1px solid rgba(239,83,80,0.4)', color: '#ef5350', borderRadius: '4px', cursor: 'pointer' }}>✕ Clear</button>}
      </div>

      {/* ── Add Fact Form ── */}
      {showAddForm && (
        <div style={{ padding: '12px 18px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label className="ws-label">Date *</label>
            <input type="date" value={newFact.date} onChange={e => setNewFact(f => ({ ...f, date: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 2, minWidth: '260px' }}>
            <label className="ws-label">Description *</label>
            <input value={newFact.description} onChange={e => setNewFact(f => ({ ...f, description: e.target.value }))} placeholder="What happened?" style={inputSt} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '200px' }}>
            <label className="ws-label">Pincite</label>
            <input value={newFact.pincite} onChange={e => setNewFact(f => ({ ...f, pincite: e.target.value }))} placeholder="SOCA-ELC-001, p.3, l.14" style={{ ...inputSt, fontFamily: 'var(--font-mono)', color: 'var(--gold-400)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label className="ws-label">Status</label>
            <select value={newFact.status} onChange={e => setNewFact(f => ({ ...f, status: e.target.value }))} style={inputSt}>
              <option value="Procured">Procured</option>
              <option value="Disputed">Disputed</option>
              <option value="Missing">Missing</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setShowAddForm(false)} className="secondary-btn" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>Cancel</button>
            <button onClick={addFact} className="primary-btn" disabled={!newFact.date || !newFact.description} style={{ fontSize: '0.75rem', padding: '5px 12px', fontWeight: 700 }}>Add</button>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '0.88rem' }}>
            No facts match the active filters. Adjust the filter bar above or extract facts from the Doc Reviewer.
          </div>
        ) : filtered.map((fact, idx) => {
          const st = STATUS[fact.status] || STATUS.Procured;
          const isExpanded = expandedIds.has(fact.id);
          const gap = gaps.find(g => g.afterId === fact.id);

          return (
            <React.Fragment key={fact.id}>
              {/* ── Row ── */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s', cursor: 'pointer', background: isExpanded ? 'rgba(201,168,76,0.04)' : 'transparent' }} onClick={() => toggle(fact.id)}>

                {/* Spine */}
                <div style={{ width: '52px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '18px', paddingBottom: '18px', gap: 0 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: st.dot, boxShadow: `0 0 6px ${st.dot}60`, flexShrink: 0 }} />
                  {idx < filtered.length - 1 && <div style={{ flex: 1, width: '1px', background: 'rgba(255,255,255,0.06)', minHeight: '20px', marginTop: '4px' }} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '14px 18px 14px 0', minWidth: 0 }}>
                  {/* Row 1 — date + status + witnesses */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--gold-400)', letterSpacing: '0.02em', flexShrink: 0 }}>{fact.fact_date || fact.date}</span>
                    <span style={{ fontSize: '0.7rem', color: st.color, fontWeight: 600 }}>{fact.status}</span>
                    {(fact.witnesses || []).map((w, wi) => (
                      <span key={wi} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{w.name}</span>
                    ))}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '4px' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Row 2 — description */}
                  <div style={{ fontSize: '0.87rem', color: 'var(--text-primary)', lineHeight: 1.55, fontWeight: 500, marginBottom: '5px' }}>{fact.description}</div>

                  {/* Row 3 — sources + issues inline */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    {(fact.sources || []).map((s, si) => (
                      <span key={si} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {s.file_name} {s.pincite ? `(${s.pincite})` : ''}
                      </span>
                    ))}
                    {(fact.issues || []).map((iss, ii) => (
                      <span key={ii} style={{ fontSize: '0.67rem', color: iss.color || 'var(--text-muted)', fontStyle: 'italic', border: `1px solid ${iss.color || 'var(--border-default)'}40`, padding: '2px 6px', borderRadius: '4px' }}>
                        {iss.name}
                      </span>
                    ))}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {fact.sourceText && (
                        <div>
                          <div className="ws-label" style={{ marginBottom: '5px' }}>Source text (verbatim)</div>
                          <blockquote style={{ margin: 0, padding: '9px 14px', borderLeft: `3px solid ${st.dot}50`, background: 'rgba(0,0,0,0.2)', borderRadius: '0 4px 4px 0', color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '0.82rem', lineHeight: 1.65 }}>
                            "{fact.sourceText}"
                          </blockquote>
                        </div>
                      )}
                      {fact.notes && (
                        <div>
                          <div className="ws-label" style={{ marginBottom: '5px' }}>Counsel's analysis</div>
                          <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', lineHeight: 1.6, background: 'rgba(201,168,76,0.04)', padding: '8px 12px', borderRadius: '4px' }}>{fact.notes}</div>
                        </div>
                      )}
                      {fact.docName && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span>Source:</span>
                          <span style={{ color: 'var(--gold-400)' }}>{fact.docName}</span>
                          {fact.bate && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-muted)' }}>{fact.bate}</span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); deleteFact(fact.id); }} className="secondary-btn" style={{ fontSize: '0.7rem', padding: '4px 10px', color: '#ef5350', borderColor: 'rgba(239,83,80,0.3)' }}>
                          Delete Fact
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Gap indicator ── */}
              {gap && (
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,152,0,0.1)', background: 'rgba(255,152,0,0.04)' }}>
                  <div style={{ width: '52px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
                    <div style={{ width: '1px', height: '100%', borderLeft: '2px dashed rgba(255,152,0,0.3)' }} />
                  </div>
                  <div style={{ flex: 1, padding: '8px 18px 8px 0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#ff9800', fontWeight: 600 }}>Evidence gap — {gap.days} days undocumented</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{gap.from} → {gap.to}</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
