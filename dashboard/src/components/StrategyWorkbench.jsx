import React, { useState, useEffect, useCallback } from 'react';
import DocReviewer   from './DocReviewer';
import ChronologyView from './ChronologyView';
import EBundleDesk  from './EBundleDesk';
import DepoStudio   from './DepoStudio';
import SocaAI       from './SocaAI';
import { apiGet } from '../api';

/**
 * StrategyWorkbench.jsx — 5-Workspace Deep Litigation Command Center Router
 *
 * This is the thin router shell. All actual logic lives in the 5 sub-components.
 *
 * Workspaces:
 * 1. 📄 Doc Reviewer & OCR — Document review & fact extraction pipeline
 * 2. 📋 Scalable Chronology — Filtered timeline with event gaps
 * 3. 📑 Master e-Bundle Desk — 4-section tree + Podium Mode
 * 4. 📝 Strategy & Depo Studio — Witness attack cards & impeachment prep
 * 5. 🤖 SOCA AI Co-Counsel — AI chat, issue analyser, eKLR, deadlines, skeleton builder
 *
 * Shared State: facts array is shared between DocReviewer → ChronologyView
 */

const WORKSPACES = [
  { id: 'doc_reviewer', icon: '📄', label: 'Doc Reviewer', sublabel: 'OCR & Fact Extraction' },
  { id: 'chronology',   icon: '📋', label: 'Chronology',   sublabel: 'Scalable Timeline' },
  { id: 'ebundle',      icon: '📑', label: 'e-Bundle Desk', sublabel: 'Digital Bundle Manager' },
  { id: 'depo_studio',  icon: '📝', label: 'Depo Studio',  sublabel: 'Strategy & Witnesses' },
  { id: 'soca_ai',      icon: '🤖', label: 'SOCA AI',      sublabel: 'Co-Counsel' },
];

export default function StrategyWorkbench({ activeMatter, userRole, activeTab: parentTab }) {
  // Map parent activeTab → initial workspace
  const PARENT_TAB_MAP = {
    'doc_reviewer': 'doc_reviewer',
    'chronology':   'chronology',
    'ebundle':      'ebundle',
    'strategy':     'doc_reviewer',
    'soca_ai':      'soca_ai',
  };
  const [activeWorkspace, setActiveWorkspace] = useState(PARENT_TAB_MAP[parentTab] || 'doc_reviewer');
  const [sharedFacts, setSharedFacts] = useState([]);

  // ── Active Matter Picker ──────────────────────────────────────────
  // If activeMatter is passed from parent use it, otherwise let user pick from their cases
  const [allCases, setAllCases]             = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(activeMatter?.id || null);

  useEffect(() => {
    apiGet('/api/cases').then(r => r?.json()).then(data => {
      if (!data || !Array.isArray(data)) return;
      setAllCases(data);
      // Auto-select: prefer activeMatter, then first case in list
      if (!selectedCaseId) {
        const firstId = activeMatter?.id || data[0]?.id || null;
        setSelectedCaseId(firstId);
      }
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatter?.id]);

  // Keep in sync if parent pushes a new active matter
  useEffect(() => {
    if (activeMatter?.id) setSelectedCaseId(activeMatter.id);
  }, [activeMatter?.id]);

  const resolvedCase = allCases.find(c => c.id === selectedCaseId) || activeMatter;
  const caseId   = resolvedCase?.id   || selectedCaseId || 'SOCA-ELC-2026';
  const caseName = resolvedCase?.case_title || resolvedCase?.name || 'Active Matter';
  // ─────────────────────────────────────────────────────────────────

  const fetchFacts = useCallback(async () => {
    try {
      const res = await apiGet(`/api/cases/${caseId}/facts`);
      const facts = await res.json();
      setSharedFacts(facts || []);
    } catch (err) {
      console.error('Failed to fetch facts:', err);
    }
  }, [caseId]);

  useEffect(() => {
    if (parentTab && PARENT_TAB_MAP[parentTab]) {
      setActiveWorkspace(PARENT_TAB_MAP[parentTab]);
    }
  }, [parentTab]);

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  const handleFactExtracted = (fact) => {
    fetchFacts(); // Re-fetch from server after extraction
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--navy-950)', borderRadius: '12px',
      border: '1px solid var(--border-default)', overflow: 'hidden'
    }}>
      {/* ── Workspace Tab Bar ── */}
      <div style={{
        display: 'flex', gap: '0', borderBottom: '1px solid var(--border-default)',
        background: 'var(--navy-900)', overflowX: 'auto', flexShrink: 0
      }}>
        {WORKSPACES.map(ws => {
          const isActive = activeWorkspace === ws.id;
          return (
            <button
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '10px 18px', background: isActive ? 'var(--navy-800)' : 'transparent',
                border: 'none', cursor: 'pointer', minWidth: '130px', flexShrink: 0,
                borderBottom: isActive ? '2px solid var(--gold-500)' : '2px solid transparent',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.15s', textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.88rem' }}>{ws.icon}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? 'var(--gold-300)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ws.label}</span>
              </div>
              <span style={{ fontSize: '0.62rem', color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ws.sublabel}</span>
            </button>
          );
        })}

        {/* Matter context + picker (right side) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>Working on:</span>
          {allCases.length > 0 ? (
            <select
              value={selectedCaseId || ''}
              onChange={e => setSelectedCaseId(e.target.value)}
              style={{ background: 'var(--navy-950)', color: 'var(--gold-400)', border: '1px solid var(--border-default)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, maxWidth: '220px', cursor: 'pointer' }}
            >
              {allCases.map(c => (
                <option key={c.id} value={c.id}>{c.case_title || c.name || c.id}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold-400)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caseName}</span>
          )}
          {sharedFacts.length > 0 && (
            <span style={{ fontSize: '0.65rem', background: 'rgba(201,168,76,0.15)', color: 'var(--gold-400)', padding: '2px 7px', borderRadius: '10px', fontWeight: 700, flexShrink: 0 }}>
              {sharedFacts.length} facts
            </span>
          )}
        </div>
      </div>

      {/* ── Active Workspace Content ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeWorkspace === 'doc_reviewer' && (
          <DocReviewer
            caseId={caseId}
            caseName={caseName}
            onFactExtracted={handleFactExtracted}
            existingFacts={sharedFacts}
          />
        )}
        {activeWorkspace === 'chronology' && (
          <ChronologyView
            caseId={caseId}
            caseName={caseName}
            facts={sharedFacts.length > 0 ? sharedFacts : undefined}
            onFactsChange={setSharedFacts}
          />
        )}
        {activeWorkspace === 'ebundle' && (
          <EBundleDesk
            caseId={caseId}
            caseName={caseName}
          />
        )}
        {activeWorkspace === 'depo_studio' && (
          <DepoStudio
            caseId={caseId}
            caseName={caseName}
            facts={sharedFacts}
          />
        )}
        {activeWorkspace === 'soca_ai' && (
          <SocaAI
            caseId={caseId}
            caseName={caseName}
          />
        )}
      </div>
    </div>
  );
}
