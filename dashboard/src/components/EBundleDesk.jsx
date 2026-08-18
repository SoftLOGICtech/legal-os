import React, { useState, useRef, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete, apiPut, BASE } from '../api';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

/**
 * EBundleDesk.jsx — Master Electronic Bundle Desk
 * Design: Refined table/list views. Minimal badge usage. Monospace Bate stamps.
 */

export default function EBundleDesk({ caseId, caseName }) {
  const [bundle, setBundle]             = useState({ caseRef: caseId, sections: [] });

  const fetchBundle = useCallback(async () => {
    try {
      const res = await apiGet(`/api/cases/${caseId}/ebundle`);
      const data = await res.json();
      setBundle({ caseRef: caseId, sections: data || [] });
    } catch (err) {
      console.error(err);
    }
  }, [caseId]);

  const [caseFiles, setCaseFiles] = useState([]);
  const fetchFiles = useCallback(async () => {
    try {
      const res = await apiGet(`/api/cases/${caseId}/files`);
      const data = await res.json();
      setCaseFiles(data || []);
    } catch (err) { console.error(err); }
  }, [caseId]);

  useEffect(() => {
    fetchBundle();
    fetchFiles();
  }, [fetchBundle, fetchFiles]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [podiumMode, setPodiumMode]     = useState(false);
  const [podiumSearch, setPodiumSearch] = useState('');
  const [podiumIdx, setPodiumIdx]       = useState(0);
  const [addingTo, setAddingTo]         = useState(null);
  const [newDocForm, setNewDocForm]     = useState({ fileId: '', name: '', detail: '', pages: '', type: 'PDF' });
  const [dragItem, setDragItem]         = useState(null);
  const [dragOver, setDragOver]         = useState(null);

  const allItems = bundle.sections.flatMap(s => s.items);
  const podiumItems = podiumSearch
    ? allItems.filter(it => it.name.toLowerCase().includes(podiumSearch.toLowerCase()) || it.bate.toLowerCase().includes(podiumSearch.toLowerCase()))
    : allItems;

  // Blob-based PDF state for Podium Mode
  const [podiumBlobUrl, setPodiumBlobUrl] = useState(null);
  const [podiumNumPages, setPodiumNumPages] = useState(null);
  const [podiumLoadErr, setPodiumLoadErr]   = useState(null);
  const podiumViewerRef = useRef(null);

  useEffect(() => {
    if (!podiumMode) { setPodiumBlobUrl(null); return; }
    const item = podiumItems[podiumIdx];
    if (!item) return;
    const matchedFile = caseFiles.find(cf =>
      cf.file_name === item.name ||
      cf.file_name.toLowerCase() === item.name.toLowerCase()
    );
    if (!matchedFile?.file_path) { setPodiumBlobUrl(null); return; }
    const url = matchedFile.file_path.startsWith('http')
      ? matchedFile.file_path
      : `${BASE}${matchedFile.file_path}`;
    setPodiumBlobUrl(null); setPodiumLoadErr(null);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(blob => setPodiumBlobUrl(URL.createObjectURL(blob)))
      .catch(err => setPodiumLoadErr(err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podiumMode, podiumIdx, caseFiles]);

  const handleDragStart = (sectionId, itemId) => setDragItem({ sectionId, itemId });
  const handleDragOver  = (sectionId, itemId) => { if (dragItem && dragItem.sectionId === sectionId) setDragOver(itemId); };
  const handleDrop      = (sectionId, targetItemId) => {
    if (!dragItem || dragItem.sectionId !== sectionId || dragItem.itemId === targetItemId) return;
    setBundle(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        const items = [...s.items];
        const fromIdx = items.findIndex(i => i.id === dragItem.itemId);
        const toIdx   = items.findIndex(i => i.id === targetItemId);
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...s, items };
      })
    }));
    setDragItem(null); setDragOver(null);
  };

  const handleAddDoc = async (sectionId) => {
    if (!newDocForm.name) return;
    const bate = `SOCA-ELC-${String(Math.floor(Math.random()*1000)).padStart(3, '0')}`;
    const payload = {
      bate_stamp: bate,
      name: newDocForm.name,
      detail: newDocForm.detail,
      pages: parseInt(newDocForm.pages) || 1,
      doc_type: newDocForm.type,
      sort_order: 0
    };
    try {
      await apiPost(`/api/ebundle/sections/${sectionId}/docs`, payload);
      setNewDocForm({ name: '', detail: '', pages: '', type: 'PDF' });
      setAddingTo(null);
      fetchBundle();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveItem = async (sectionId, itemId) => {
    try {
      await apiDelete(`/api/ebundle/docs/${itemId}`);
      if (selectedItem?.id === itemId) setSelectedItem(null);
      fetchBundle();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToSection = async (item, fromSectionId, toSectionId) => {
    if (fromSectionId === toSectionId) return;
    try {
      await apiPut(`/api/ebundle/docs/${item.id}/move`, { section_id: toSectionId });
      fetchBundle();
    } catch (err) {
      console.error(err);
    }
  };

  const generateIndex = () => {
    const cName = caseName || 'ACTIVE LEGAL MATTER';
    const refId = bundle.caseRef || caseId || 'SOCA-ELC-2026';
    let txt = `                                REPUBLIC OF KENYA\n`;
    txt += `                 IN THE ENVIRONMENT AND LAND COURT AT NAIROBI\n`;
    txt += `                          ELC SUIT NO. ${refId}\n\n`;
    txt += `BETWEEN:\n`;
    txt += `SAMUEL OGOLA ............................................................................ PLAINTIFF\n`;
    txt += `                                     VERSUS\n`;
    txt += `KILIMANI PROPERTIES LIMITED & OTHERS ......................................... DEFENDANTS\n\n`;
    txt += `════════════════════════════════════════════════════════════════════════════════════════════\n`;
    txt += `                     MASTER INDEX TO ELECTRONIC TRIAL BUNDLE\n`;
    txt += `════════════════════════════════════════════════════════════════════════════════════════════\n`;
    txt += `Filed By: SAM OGOLA & CO. ADVOCATES          Date Generated: ${new Date().toLocaleDateString('en-KE', { day:'2-digit', month:'long', year:'numeric' })}\n\n`;

    let globalItemNo = 1;
    bundle.sections.forEach(section => {
      txt += `┌──────────────────────────────────────────────────────────────────────────────────────────┐\n`;
      txt += `│ ${section.label.padEnd(88)} │\n`;
      txt += `└──────────────────────────────────────────────────────────────────────────────────────────┘\n`;
      txt += `${'NO.'.padEnd(5)} | ${'BATE STAMP'.padEnd(16)} | ${'DOCUMENT DESCRIPTION'.padEnd(42)} | ${'PAGES'.padEnd(8)} | STATUS\n`;
      txt += `${'─'.repeat(88)}\n`;
      if (!section.items || section.items.length === 0) {
        txt += `  -- No documents indexed in this section --\n\n`;
      } else {
        section.items.forEach(item => {
          const numStr = String(globalItemNo).padStart(2, '0');
          const bateStr = (item.bate || 'N/A').padEnd(16);
          const descStr = (item.name + (item.detail ? ` (${item.detail})` : '')).slice(0, 42).padEnd(42);
          const pagesStr = `${item.pages || 1} pp`.padEnd(8);
          txt += `${numStr.padEnd(5)} | ${bateStr} | ${descStr} | ${pagesStr} | Admitted\n`;
          globalItemNo++;
        });
        txt += `\n`;
      }
    });

    txt += `════════════════════════════════════════════════════════════════════════════════════════════\n`;
    txt += `ADVOCATE CERTIFICATION:\n`;
    txt += `I hereby certify that this Index accurately details all documents contained within the Master\n`;
    txt += `Electronic Trial Bundle pursuant to Kenya ELC Practice Directions 2024.\n\n`;
    txt += `DATED at NAIROBI this ${new Date().getDate()}th day of ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}.\n\n`;
    txt += `___________________________________________\n`;
    txt += `SAM OGOLA & CO. ADVOCATES\n`;
    txt += `Counsel for the Plaintiff\n`;

    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `Master_Court_Bundle_Index_${refId}_${Date.now()}.txt`; a.click();
  };

  const [isAutoIndexing, setIsAutoIndexing] = useState(false);
  const [autoIndexMsg, setAutoIndexMsg]     = useState('');

  const handleAutoIndex = async () => {
    setIsAutoIndexing(true);
    setAutoIndexMsg('⚡ Auto-indexing case files into court bundle sections...');
    try {
      const res = await apiPost(`/api/cases/${caseId}/ebundle/auto-index`);
      const data = await res?.json();
      setAutoIndexMsg(data?.message || `Indexed ${data?.count || 0} files!`);
      fetchBundle();
    } catch (err) {
      console.error(err);
      setAutoIndexMsg('⚠️ Auto-index error: ' + err.message);
    } finally {
      setTimeout(() => {
        setIsAutoIndexing(false);
        setAutoIndexMsg('');
      }, 4000);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: '600px', fontFamily: 'var(--font-body)' }}>

        {/* ── Top Bar ── */}
        <div style={{ padding: '10px 18px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--gold-400)' }}>Master e-Bundle Desk</span>
            <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{allItems.length} docs · {allItems.reduce((s, i) => s + (i.pages || 0), 0)} pages</span>
            {autoIndexMsg && <span style={{ marginLeft: '14px', fontSize: '0.75rem', color: '#4db6ac' }}>{autoIndexMsg}</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleAutoIndex} 
              className="secondary-btn" 
              style={{ borderColor: 'var(--gold-500)', color: 'var(--gold-400)', padding: '5px 12px', fontSize: '0.75rem' }}
              disabled={isAutoIndexing}
            >
              {isAutoIndexing ? '⚡ Indexing...' : '⚡ Auto-Index All Case Files'}
            </button>
            <button onClick={generateIndex} className="secondary-btn" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>Download Court Index</button>
            <button onClick={() => { setPodiumMode(true); setPodiumIdx(0); setPodiumSearch(''); }} className="primary-btn" style={{ padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700 }}>Launch Podium Mode</button>
          </div>
        </div>

        {/* ── Main layout ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: Tree */}
          <div style={{ width: '360px', flexShrink: 0, overflowY: 'auto', background: 'var(--navy-950)', borderRight: '1px solid var(--border-default)' }}>
            {bundle.sections.map(section => (
              <div key={section.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Header */}
                <div style={{ padding: '10px 16px', background: `linear-gradient(90deg, ${section.color}10, transparent)`, borderLeft: `3px solid ${section.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 2 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: section.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{section.label}</span>
                  <button onClick={() => { setAddingTo(section.id); setNewDocForm({ name: '', detail: '', pages: '', type: 'PDF' }); }} style={{ background: 'none', border: 'none', color: section.color, fontSize: '1rem', cursor: 'pointer', lineHeight: 1 }}>+</button>
                </div>

                {/* Add Form */}
                {addingTo === section.id && (
                  <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label className="ws-label">Select from Case Files *</label>
                      <select value={newDocForm.fileId} onChange={e => {
                        const f = caseFiles.find(cf => cf.id === e.target.value);
                        if(f) setNewDocForm({ fileId: f.id, name: f.file_name, detail: '', pages: 1, type: f.file_name.split('.').pop().toUpperCase() });
                      }} className="ws-select">
                        <option value="">-- Choose File --</option>
                        {caseFiles.map(cf => <option key={cf.id} value={cf.id}>{cf.file_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="ws-label">Document Name (Override)</label>
                      <input value={newDocForm.name} onChange={e => setNewDocForm(f => ({ ...f, name: e.target.value }))} className="ws-input" />
                    </div>
                    <div>
                      <label className="ws-label">Detail (Date, Party, etc.)</label>
                      <input value={newDocForm.detail} onChange={e => setNewDocForm(f => ({ ...f, detail: e.target.value }))} className="ws-input" />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="ws-label">Pages</label>
                        <input type="number" value={newDocForm.pages} onChange={e => setNewDocForm(f => ({ ...f, pages: e.target.value }))} className="ws-input" />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label className="ws-label">Type</label>
                        <select value={newDocForm.type} onChange={e => setNewDocForm(f => ({ ...f, type: e.target.value }))} className="ws-select">
                          {['PDF', 'DOCX', 'XLSX', 'TXT', 'IMG'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button onClick={() => setAddingTo(null)} className="secondary-btn" style={{ flex: 1, padding: '5px', fontSize: '0.72rem' }}>Cancel</button>
                      <button onClick={() => handleAddDoc(section.id)} className="primary-btn" disabled={!newDocForm.name} style={{ flex: 2, padding: '5px', fontSize: '0.72rem', fontWeight: 700 }}>Add</button>
                    </div>
                  </div>
                )}

                {/* Items */}
                {section.items.length === 0 && (
                  <div style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>Empty section.</div>
                )}
                {section.items.map(item => (
                  <div
                    key={item.id} draggable
                    onDragStart={() => handleDragStart(section.id, item.id)} onDragOver={e => { e.preventDefault(); handleDragOver(section.id, item.id); }} onDrop={e => { e.preventDefault(); handleDrop(section.id, item.id); }}
                    onClick={() => setSelectedItem({ ...item, sectionId: section.id, sectionColor: section.color })}
                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: selectedItem?.id === item.id ? 'rgba(201,168,76,0.06)' : dragOver === item.id ? 'rgba(255,255,255,0.04)' : 'transparent', borderLeft: `3px solid ${selectedItem?.id === item.id ? 'var(--gold-500)' : 'transparent'}`, transition: 'all 0.1s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                      <span className="ws-pincite" style={{ color: section.color }}>{item.bate}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{item.type}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{item.pages}pp</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: selectedItem?.id === item.id ? 'white' : 'var(--text-primary)', fontWeight: selectedItem?.id === item.id ? 600 : 400, lineHeight: 1.4 }}>{item.name}</div>
                    {item.detail && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.detail}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* RIGHT: Preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--navy-900)' }}>
            {!selectedItem ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.2rem', marginBottom: '8px' }}>Select a document</div>
                <div style={{ fontSize: '0.8rem' }}>Drag items within sections to reorder.</div>
              </div>
            ) : (
              <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                
                {/* Header */}
                <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px' }}>
                    <span className="ws-pincite" style={{ fontSize: '1rem', color: selectedItem.sectionColor }}>{selectedItem.bate}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{selectedItem.type} · {selectedItem.pages} Pages</span>
                  </div>
                  <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'white', lineHeight: 1.2 }}>{selectedItem.name}</h2>
                  {selectedItem.detail && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{selectedItem.detail}</div>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={() => { const idx = allItems.findIndex(i => i.id === selectedItem.id); setPodiumMode(true); setPodiumIdx(idx >= 0 ? idx : 0); setPodiumSearch(''); }} className="primary-btn">Launch in Podium</button>
                  <select onChange={e => { if (e.target.value) { handleMoveToSection(selectedItem, selectedItem.sectionId, e.target.value); setSelectedItem(null); } e.target.value = ''; }} defaultValue="" className="ws-select" style={{ width: 'auto' }}>
                    <option value="" disabled>Move to section…</option>
                    {bundle.sections.filter(s => s.id !== selectedItem.sectionId).map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <span style={{ flex: 1 }} />
                  <button onClick={() => handleRemoveItem(selectedItem.sectionId, selectedItem.id)} className="secondary-btn" style={{ borderColor: 'transparent', color: '#ef5350' }}>Remove</button>
                </div>

                {/* Fake Viewer */}
                <div style={{ flex: 1, background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '6px', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>[ Document viewer bounds — upload via DocReviewer to inspect text ]</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PODIUM MODE ── */}
      {podiumMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#02060d', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
          {/* Top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--gold-400)' }}>Podium Mode</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{bundle.caseRef || caseName}</div>
            <div style={{ flex: 1 }} />
            <input placeholder="Search exhibits…" value={podiumSearch} onChange={e => { setPodiumSearch(e.target.value); setPodiumIdx(0); }} className="ws-input" style={{ width: '260px', background: 'rgba(255,255,255,0.03)' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setPodiumIdx(i => Math.max(0, i - 1))} disabled={podiumIdx === 0} className="secondary-btn" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>← Prev</button>
              <button onClick={() => setPodiumIdx(i => Math.min((podiumItems.length - 1), i + 1))} disabled={podiumIdx >= podiumItems.length - 1} className="secondary-btn" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>Next →</button>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', width: '60px', textAlign: 'center' }}>{podiumIdx + 1}/{podiumItems.length}</span>
            <button onClick={() => setPodiumMode(false)} className="secondary-btn" style={{ borderColor: '#ef5350', color: '#ef5350' }}>Exit</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto' }}>
              {podiumItems.map((item, idx) => {
                const section = bundle.sections.find(s => s.items.some(i => i.id === item.id));
                return (
                  <div key={item.id} onClick={() => setPodiumIdx(idx)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', background: podiumIdx === idx ? 'rgba(255,255,255,0.03)' : 'transparent', borderLeft: `3px solid ${podiumIdx === idx ? 'var(--gold-500)' : 'transparent'}` }}>
                    <div className="ws-pincite" style={{ color: section?.color || 'var(--gold-400)', marginBottom: '4px' }}>{item.bate}</div>
                    <div style={{ fontSize: '0.85rem', color: podiumIdx === idx ? 'white' : 'var(--text-primary)', fontWeight: podiumIdx === idx ? 600 : 400, lineHeight: 1.4 }}>{item.name}</div>
                  </div>
                );
              })}
            </div>

            {/* Exhibit Display (Live Document Viewer) */}
            <div ref={podiumViewerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', background: '#060e1c', overflow: 'hidden' }}>
              {podiumItems[podiumIdx] ? (() => {
                const item = podiumItems[podiumIdx];
                const ext = item.name?.split('.').pop().toLowerCase();

                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Exhibit Banner */}
                    <div style={{ padding: '12px 20px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span className="ws-pincite" style={{ fontSize: '1.2rem', color: 'var(--gold-400)', fontWeight: 700 }}>{item.bate}</span>
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.15rem', fontWeight: 600 }}>{item.name}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {item.detail && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{item.detail}</span>}
                        <span style={{ fontSize: '0.75rem', background: 'rgba(201,168,76,0.15)', color: 'var(--gold-400)', padding: '3px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                          {podiumNumPages ? `${podiumNumPages} PP` : `${item.pages || 1} PP`} · {(ext || item.type || 'PDF').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Document Content */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', background: '#1e293b', gap: '16px' }}>
                      {podiumBlobUrl && ext === 'pdf' ? (
                        <Document
                          file={podiumBlobUrl}
                          onLoadSuccess={({ numPages }) => setPodiumNumPages(numPages)}
                          loading={<div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading PDF…</div>}
                          error={<div style={{ color: '#ef5350', padding: '20px' }}>Failed to render PDF.</div>}
                        >
                          {Array.from(new Array(podiumNumPages || 0), (_, i) => (
                            <div key={i} style={{ marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                              <Page
                                pageNumber={i + 1}
                                renderTextLayer={true}
                                renderAnnotationLayer={false}
                                width={podiumViewerRef.current ? Math.min(podiumViewerRef.current.clientWidth - 120, 950) : 850}
                              />
                            </div>
                          ))}
                        </Document>
                      ) : podiumLoadErr ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', color: 'var(--gold-400)', marginBottom: '16px' }}>{item.bate}</div>
                          <h2 style={{ color: 'white', fontSize: '1.8rem', margin: '0 0 10px' }}>{item.name}</h2>
                          <div style={{ fontSize: '0.85rem', color: '#ef5350', marginBottom: '8px' }}>Could not load file: {podiumLoadErr}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload the source file via Doc Reviewer to enable live preview.</div>
                        </div>
                      ) : !podiumBlobUrl ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', color: 'var(--gold-400)', marginBottom: '16px' }}>{item.bate}</div>
                          <h2 style={{ color: 'white', fontSize: '1.8rem', margin: '0 0 10px' }}>{item.name}</h2>
                          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '8px' }}>{item.detail || 'Indexed Court Exhibit'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload the source file via Doc Reviewer to view live rendering here.</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })() : (
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic', margin: 'auto' }}>No exhibits found in bundle.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
