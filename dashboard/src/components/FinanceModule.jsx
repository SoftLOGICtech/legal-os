import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api';

/**
 * FinanceModule.jsx — Law Firm Accounting Engine
 * Implements Clio-style Trust Ledgers + Kenyan ARO Scale Fees + Tax Engine
 */

const ARO_SCHEDULES = {
  'Schedule 6 — Litigation': {
    calculate: (value) => {
      let fee = 0;
      let remainder = value;
      if (remainder > 0) {
        const tier1 = Math.min(remainder, 1000000);
        fee += tier1 * 0.15;
        remainder -= tier1;
      }
      if (remainder > 0) {
        const tier2 = Math.min(remainder, 4000000);
        fee += tier2 * 0.10;
        remainder -= tier2;
      }
      if (remainder > 0) {
        const tier3 = Math.min(remainder, 15000000);
        fee += tier3 * 0.07;
        remainder -= tier3;
      }
      if (remainder > 0) {
        fee += remainder * 0.05;
      }
      return fee;
    }
  },
  'Schedule 1 — Conveyancing': {
    calculate: (value) => {
      let fee = 0;
      let remainder = value;
      if (remainder > 0) {
        const tier1 = Math.min(remainder, 5000000);
        fee += tier1 * 0.02;
        remainder -= tier1;
      }
      if (remainder > 0) {
        fee += remainder * 0.0125;
      }
      return Math.max(fee, 35000); // Minimum fee 35k
    }
  }
};

export default function FinanceModule({ cases }) {
  const [activeTab, setActiveTab] = useState('aro_engine');
  
  const matters = (cases && cases.length > 0) ? cases.map(c => ({
    id: c.id,
    name: c.case_title,
    client: c.client_name,
    trustBalance: 0,
    unbilledDisbursements: 0
  })) : [];
  
  const [selectedMatter, setSelectedMatter] = useState(matters.length > 0 ? matters[0].id : '');
  const [trustBalance, setTrustBalance] = useState(0);

  // Default to first matter if available
  useEffect(() => {
    if (matters.length > 0 && !selectedMatter) {
      setSelectedMatter(matters[0].id);
    }
  }, [cases, selectedMatter]);

  // ARO State
  const [aroValue, setAroValue] = useState(0);
  const [aroSchedule, setAroSchedule] = useState('Schedule 6 — Litigation');
  const [customFees, setCustomFees] = useState([{ desc: 'Instruction Fees', amount: 0 }]);
  const [includeDisbursements, setIncludeDisbursements] = useState(true);

  // Trust Ledger State
  const [ledger, setLedger] = useState([]);
  const [trustForm, setTrustForm] = useState({ amount: '', ref: '' });

  const fetchLedger = useCallback(async () => {
    if (!selectedMatter) return;
    try {
      const res = await apiGet(`/api/cases/${selectedMatter}/payments`);
      const data = await res.json();
      const trustPayments = (data || []).filter(p => p.destination === 'trust');
      setLedger(trustPayments);
      
      const total = trustPayments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      setTrustBalance(total);
    } catch (err) {
      console.error(err);
    }
  }, [selectedMatter]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const activeMatterObj = matters.find(m => m.id === selectedMatter) || {};
  activeMatterObj.trustBalance = trustBalance;

  // --- Calculations ---
  const aroBaseFee = ARO_SCHEDULES[aroSchedule].calculate(Number(aroValue) || 0);
  const totalCustom = customFees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const disbursements = includeDisbursements ? (activeMatterObj?.unbilledDisbursements || 0) : 0;
  
  const subtotalProFees = aroBaseFee + totalCustom;
  const vat = subtotalProFees * 0.16;
  const wht = subtotalProFees * 0.05;
  const totalPayable = subtotalProFees + vat - wht + disbursements;

  // --- Handlers ---
  const handleAddTrust = async () => {
    if (!trustForm.amount) return;
    const amt = parseFloat(trustForm.amount);
    try {
      await apiPost(`/api/cases/${selectedMatter}/payments`, {
        destination: 'trust',
        amount: amt,
        payment_ref: trustForm.ref,
        notes: 'Trust Deposit via Finance Module',
        payment_method: 'Bank Transfer'
      });
      setTrustForm({ amount: '', ref: '' });
      fetchLedger();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateFeeNote = () => {
    let txt = `FEE NOTE & BILL OF COSTS\n`;
    txt += `Client: ${activeMatterObj?.client}\nMatter: ${activeMatterObj?.name}\nDate: ${new Date().toLocaleDateString('en-KE')}\n`;
    txt += `${'═'.repeat(60)}\n\n`;
    txt += `PROFESSIONAL FEES\n`;
    txt += `ARO Scale Fee (${aroSchedule} on KES ${Number(aroValue).toLocaleString()}): KES ${aroBaseFee.toLocaleString()}\n`;
    customFees.forEach(f => {
      if (f.amount > 0) txt += `${f.desc}: KES ${Number(f.amount).toLocaleString()}\n`;
    });
    txt += `\nSubtotal Professional Fees: KES ${subtotalProFees.toLocaleString()}\n`;
    txt += `Add 16% VAT: KES ${vat.toLocaleString()}\n`;
    txt += `Less 5% WHT: (KES ${wht.toLocaleString()})\n\n`;
    txt += `DISBURSEMENTS\n`;
    txt += `Unbilled Disbursements: KES ${disbursements.toLocaleString()}\n\n`;
    txt += `${'─'.repeat(60)}\n`;
    txt += `TOTAL AMOUNT PAYABLE: KES ${totalPayable.toLocaleString()}\n`;
    txt += `${'═'.repeat(60)}\n`;
    
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `Fee_Note_${activeMatterObj?.client.replace(/\s+/g, '_')}_${Date.now()}.txt`; a.click();
  };

  const formatMoney = (val) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-body)', background: 'var(--navy-950)', color: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
      
      {/* ── Header ── */}
      <div style={{ padding: '20px 24px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--gold-400)' }}>Law Firm Accounting & Ledger</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Compliant Trust Ledgers & ARO Scale Engine</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label className="ws-label" style={{ marginBottom: 0 }}>Active Matter:</label>
          <select value={selectedMatter} onChange={e => setSelectedMatter(e.target.value)} className="ws-select" style={{ width: '240px', background: 'var(--navy-950)' }}>
            {matters.map(m => <option key={m.id} value={m.id}>{m.client} — {m.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Context Bar ── */}
      <div style={{ padding: '12px 24px', background: 'rgba(201,168,76,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '40px' }}>
        <div>
          <div className="ws-section-label" style={{ color: 'var(--text-muted)' }}>Trust Escrow Balance</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: '#4db6ac', fontWeight: 600 }}>{formatMoney(activeMatterObj?.trustBalance || 0)}</div>
        </div>
        <div>
          <div className="ws-section-label" style={{ color: 'var(--text-muted)' }}>Unbilled Disbursements</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: '#ffb74d', fontWeight: 600 }}>{formatMoney(activeMatterObj?.unbilledDisbursements || 0)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* ── Sidebar Navigation ── */}
        <div style={{ width: '220px', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          {[
            { id: 'aro_engine', label: 'ARO Fee Engine' },
            { id: 'trust_ledger', label: 'Trust Ledger' },
            { id: 'invoices', label: 'Invoices & Bills' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 20px', textAlign: 'left', background: activeTab === tab.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: 'none', borderLeft: activeTab === tab.id ? '3px solid var(--gold-500)' : '3px solid transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Main Workspace ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          
          {/* TAB: ARO ENGINE */}
          {activeTab === 'aro_engine' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label className="ws-label">Select Remuneration Order Schedule</label>
                    <select value={aroSchedule} onChange={e => setAroSchedule(e.target.value)} className="ws-select">
                      {Object.keys(ARO_SCHEDULES).map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="ws-label">Subject Value (KES)</label>
                    <input type="number" value={aroValue} onChange={e => setAroValue(e.target.value)} className="ws-input" placeholder="e.g. 50000000" style={{ fontFamily: 'var(--font-mono)' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Value of the subject matter in dispute / conveyance</div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                    <label className="ws-label">Additional Custom Fees</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {customFees.map((fee, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '10px' }}>
                          <input value={fee.desc} onChange={e => setCustomFees(fs => fs.map((f, i) => i === idx ? { ...f, desc: e.target.value } : f))} className="ws-input" style={{ flex: 2 }} />
                          <input type="number" value={fee.amount} onChange={e => setCustomFees(fs => fs.map((f, i) => i === idx ? { ...f, amount: e.target.value } : f))} className="ws-input" style={{ flex: 1, fontFamily: 'var(--font-mono)' }} />
                          <button onClick={() => setCustomFees(fs => fs.filter((_, i) => i !== idx))} className="secondary-btn" style={{ borderColor: 'transparent', color: '#ef5350' }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setCustomFees(fs => [...fs, { desc: 'Court Appearance', amount: 0 }])} style={{ background: 'none', border: 'none', color: 'var(--gold-400)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', marginTop: '10px' }}>+ Add Row</button>
                  </div>
                </div>

                {/* Right: Invoice Preview */}
                <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px' }}>
                  <div className="ws-section-label" style={{ marginBottom: '16px' }}>Fee Note Draft Calculation</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>ARO Scale Fee</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(aroBaseFee)}</span>
                  </div>
                  {customFees.map((f, i) => f.amount > 0 && (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{f.desc}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(f.amount)}</span>
                    </div>
                  ))}
                  
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                    <span>Subtotal (Professional Fees)</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(subtotalProFees)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>+ 16% VAT</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{formatMoney(vat)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span style={{ color: '#ef5350' }}>- 5% WHT</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#ef5350' }}>({formatMoney(wht)})</span>
                  </div>
                  
                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '12px' }}>
                    <input type="checkbox" checked={includeDisbursements} onChange={e => setIncludeDisbursements(e.target.checked)} style={{ accentColor: 'var(--gold-500)' }} />
                    Include Unbilled Disbursements ({formatMoney(activeMatterObj?.unbilledDisbursements || 0)})
                  </label>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold-400)', marginTop: '20px' }}>
                    <span>Total Payable</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(totalPayable)}</span>
                  </div>

                  <button onClick={handleGenerateFeeNote} className="primary-btn" style={{ width: '100%', marginTop: '30px', padding: '12px' }}>Export Fee Note (TXT)</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRUST LEDGER */}
          {activeTab === 'trust_ledger' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px', display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="ws-label">Deposit Amount (KES)</label>
                  <input type="number" value={trustForm.amount} onChange={e => setTrustForm(f => ({ ...f, amount: e.target.value }))} className="ws-input" style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label className="ws-label">Bank Reference / Description</label>
                  <input value={trustForm.ref} onChange={e => setTrustForm(f => ({ ...f, ref: e.target.value }))} className="ws-input" placeholder="e.g. RTGS from Client Bank" />
                </div>
                <button onClick={handleAddTrust} disabled={!trustForm.amount} className="primary-btn" style={{ padding: '8px 24px' }}>Log Deposit</button>
              </div>

              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-default)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Reference</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((l, i) => (
                      <tr key={l.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{l.payment_date ? new Date(l.payment_date).toLocaleDateString() : '???'}</td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: Number(l.amount) > 0 ? 'rgba(77,182,172,0.1)' : 'rgba(239,83,80,0.1)', color: Number(l.amount) > 0 ? '#4db6ac' : '#ef5350', fontSize: '0.75rem' }}>{Number(l.amount) > 0 ? 'Deposit' : 'Withdrawal'}</span></td>
                        <td style={{ padding: '12px 16px' }}>{l.payment_ref}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: Number(l.amount) > 0 ? '#4db6ac' : '#ef5350' }}>{Number(l.amount) > 0 ? '+' : ''}{formatMoney(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: INVOICES */}
          {activeTab === 'invoices' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontStyle: 'italic', marginBottom: '8px' }}>No finalized invoices yet.</div>
              <div style={{ fontSize: '0.9rem' }}>Use the ARO Fee Engine to generate a draft fee note, then log it here when sent to the client.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
