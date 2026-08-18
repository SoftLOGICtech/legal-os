import React from 'react';

export default function TeamsManagement() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--navy-900)', padding: '16px 24px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--gold-400)', fontSize: '1.4rem' }}>Firm & Teams Hierarchy</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage office branches, practice areas, team pods, and custom roles.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="secondary-btn">+ New Custom Role</button>
          <button className="primary-btn">+ Add Team Member</button>
        </div>
      </div>

      {/* THREE COLUMNS: ORG CHART, ROLES, SETTINGS */}
      <div style={{ display: 'flex', gap: '20px', flex: 1, alignItems: 'flex-start' }}>
        
        {/* COLUMN 1: Hierarchy Tree */}
        <div style={{ flex: 2, background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--navy-800)', borderBottom: '1px solid var(--border-default)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Organization Structure
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Office Level */}
            <details open style={{ background: 'var(--navy-950)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--gold-300)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏢 Nairobi HQ
              </summary>
              <div style={{ padding: '10px 0 0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Department Level */}
                <details open style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#64b5f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚖️ Commercial Litigation Dept.
                  </summary>
                  <div style={{ padding: '8px 0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--gold-400)' }}>👑 Sam Ogola</span>
                      <span style={{ color: 'var(--text-muted)' }}>— Managing Partner</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                      <span style={{ color: 'white' }}>👤 Jane Doe</span>
                      <span style={{ color: 'var(--text-muted)' }}>— Senior Associate (Pod Leader)</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                      <span style={{ color: 'white' }}>👤 John Smith</span>
                      <span style={{ color: 'var(--text-muted)' }}>— Paralegal</span>
                    </div>
                  </div>
                </details>

                <details style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#81c784', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤝 Conveyancing & Real Estate Dept.
                  </summary>
                </details>

              </div>
            </details>

            <details style={{ background: 'var(--navy-950)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--gold-300)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏢 Mombasa Branch
              </summary>
            </details>

          </div>
        </div>

        {/* COLUMN 2: Roles & Permissions Matrix */}
        <div style={{ flex: 3, background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--navy-800)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Roles & Permissions Matrix</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--gold-400)', background: 'rgba(201,168,76,0.1)', padding: '2px 6px', borderRadius: '12px' }}>Intelligent Mapping Active</span>
          </div>
          
          <div style={{ padding: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Role Name</th>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Type</th>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Matter Visibility</th>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Financial Data</th>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Managing Partner', type: 'System', vis: 'Global (All Offices)', fin: 'Full Access (P&L)' },
                  { name: 'Partner', type: 'System', vis: 'Department Only', fin: 'Department Billing' },
                  { name: 'Senior Associate', type: 'System', vis: 'Assigned Teams Only', fin: 'Time Entries Only' },
                  { name: 'Associate', type: 'System', vis: 'Assigned Matters Only', fin: 'Own Time Only' },
                  { name: 'Contract Attorney', type: 'Custom', vis: 'Strictly Assigned', fin: 'None' },
                  { name: 'Paralegal', type: 'System', vis: 'Assigned Teams', fin: 'None' },
                  { name: 'External Auditor', type: 'Custom', vis: 'None', fin: 'View Only (Reports)' },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 8px', color: r.type === 'Custom' ? 'var(--gold-400)' : 'white', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ background: r.type === 'System' ? 'rgba(255,255,255,0.1)' : 'rgba(201,168,76,0.15)', color: r.type === 'Custom' ? 'var(--gold-300)' : 'var(--text-muted)', padding: '2px 6px', borderRadius: '12px', fontSize: '0.7rem' }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{r.vis}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{r.fin}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <button style={{ background: 'none', border: 'none', color: '#64b5f6', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.03)', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1rem' }}>🤖</span> 
            The system intelligently maps custom roles (e.g. "Contract Attorney") to UI restrictions (disabling financials, hiding the strategy tab) based on the permissions selected during creation.
          </div>
        </div>

      </div>
    </div>
  );
}
