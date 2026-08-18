import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiGet, apiPost, apiUpload, BASE } from '../api';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const STATUS_COLOR = { Procured: '#4db6ac', Disputed: '#ff9800', Missing: '#ef5350' };
const FACT_COLORS = ['#c9a84c', '#ef5350', '#ff9800', '#4db6ac', '#42a5f5', '#ab47bc'];

const FOLDERS = [
  { id: 'pleadings', label: '🏛️ Pleadings', color: '#ef5350' },
  { id: 'correspondence', label: '✉️ Correspondence', color: '#64b5f6' },
  { id: 'exhibits', label: '🏷️ Exhibits', color: '#4db6ac' },
  { id: 'client_kyc', label: '🪪 KYC & Onboarding', color: '#ffb74d' },
  { id: 'financials', label: '💰 Financials', color: '#81c784' },
  { id: 'research', label: '📚 Legal Research', color: '#ba68c8' },
  { id: 'court_orders', label: '⚖️ Court Orders', color: '#a1887f' },
  { id: 'other', label: '📁 Miscellaneous', color: 'var(--text-muted)' }
];

const S = {
  panel: { background: 'var(--navy-950)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  label: { display: 'block', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-body)' },
  input: { width: '100%', padding: '8px 10px', background: 'var(--navy-800)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '0.85rem' },
  mono:  { fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--gold-400)', letterSpacing: '-0.01em' },
};

export default function DocReviewer({ caseId, caseName, onFactExtracted, existingFacts = [] }) {
  const [caseFiles, setCaseFiles]       = useState([]);
  const [activeDocIdx, setActiveDocIdx] = useState(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');
  const [uploadCategory, setUploadCategory] = useState('exhibits');
  
  const [issuesList, setIssuesList]     = useState([]);
  const [witnessList, setWitnessList]   = useState([]);
  const [newIssueName, setNewIssueName] = useState('');
  
  const fileInputRef                    = useRef(null);
  const docViewerRef                    = useRef(null);

  const [selection, setSelection]       = useState({ text: '', page: '1', line: '1' });
  const [menuPos, setMenuPos]           = useState(null);
  const [showFactForm, setShowFactForm] = useState(false);
  const [copied, setCopied]             = useState(false);

  const emptyFact = { date: '', description: '', sourceText: '', pincite: '', issue_ids: [], witness_ids: [], status: 'Procured', notes: '', color: FACT_COLORS[0] };
  const [factForm, setFactForm]         = useState(emptyFact);
  const [localFacts, setLocalFacts]     = useState(existingFacts);

  const fetchData = useCallback(async () => {
    try {
      const [filesRes, issRes, witRes, factsRes] = await Promise.all([
        apiGet(`/api/cases/${caseId}/files`),
        apiGet(`/api/cases/${caseId}/issues`),
        apiGet(`/api/cases/${caseId}/witnesses`),
        apiGet(`/api/cases/${caseId}/facts`)
      ]);
      const files = await filesRes.json();
      const iss   = await issRes.json();
      const wit   = await witRes.json();
      const facts = await factsRes.json();

      setCaseFiles((files || []).map(f => ({ ...f, ext: f.file_name.split('.').pop().toLowerCase(), content: null })));
      setIssuesList(iss   || []);
      setWitnessList(wit  || []);
      setLocalFacts(facts || []);
    } catch (err) { console.error(err); }
  }, [caseId]);

  const hasAutoLoaded = useRef(false);

  // Reset state when caseId changes
  useEffect(() => {
    setActiveDocIdx(null);
    hasAutoLoaded.current = false;
  }, [caseId]);

  // Auto-open first file when the library first loads (only if nothing is selected yet)
  useEffect(() => {
    if (caseFiles.length > 0 && activeDocIdx === null && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      loadFileContent(0);
    }
  // loadFileContent reads caseFiles from closure — intentionally omit it from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFiles]);

  const handleDeleteFile = async (e, fileId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this file from case locker?')) return;
    try {
      await apiDelete('/api/cases/files/' + fileId);
      setActiveDocIdx(null);
      hasAutoLoaded.current = false;   // allow re-auto-select after delete
      fetchData();
    } catch (err) {
      setError('Failed to delete file: ' + err.message);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (files) => {
    if (!files || !files.length) return;
    setIsLoading(true); setError('');
    let lastUploadedDocId = null;
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', uploadCategory);
        const res = await apiUpload('/api/cases/' + caseId + '/files', formData);
        if (!res?.ok) {
          const errData = await res?.json().catch(() => ({}));
          setError(errData?.error || ('Upload failed for ' + file.name));
        } else {
          const data = await res.json();
          if (data?.id) lastUploadedDocId = data.id;
        }
      }
      const updatedRes = await apiGet(`/api/cases/${caseId}/files`);
      const updatedFiles = await updatedRes.json();
      if (updatedFiles && Array.isArray(updatedFiles)) {
        const mapped = updatedFiles.map(f => ({ ...f, ext: f.file_name.split('.').pop().toLowerCase(), content: null }));
        setCaseFiles(mapped);
        if (lastUploadedDocId) {
          const newIdx = mapped.findIndex(f => f.id === lastUploadedDocId);
          if (newIdx >= 0) setTimeout(() => loadFileContent(newIdx), 100);
        }
      }
    } catch (err) {
      console.error('Upload handler error:', err);
      setError(err.message || 'File upload error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadFileContent = async (idx) => {
    const doc = caseFiles[idx];
    if (doc.content) { setActiveDocIdx(idx); return; }
    setIsLoading(true); setError('');
    try {
      const url = doc.file_path.startsWith('http') ? doc.file_path : (BASE || 'http://localhost:3001') + doc.file_path;
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = doc.ext;
      let content = '';
      let numPages = null;

      if (['txt', 'md', 'csv', 'xml', 'json'].includes(ext)) { 
        content = await blob.text(); 
      } else if (ext === 'pdf') {
        content = url;
      } else if (ext === 'docx') {
        try {
          const { renderAsync } = await import('docx-preview');
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
          document.body.appendChild(container);
          await renderAsync(blob, container);
          content = container.innerText || '[DOCX ' + doc.file_name + ']';
          document.body.removeChild(container);
        } catch (err) { content = '[DOCX ' + doc.file_name + ']'; }
      } else {
        content = '[Format .' + ext + ' Preview not available]';
      }

      setCaseFiles(prev => prev.map((f, i) => i === idx ? { ...f, content, numPages } : f));
      setActiveDocIdx(idx);
    } catch (err) { setError('Failed to read file: ' + err.message); }
    setIsLoading(false);
  };

  const handleDocumentLoadSuccess = ({ numPages }) => {
    setCaseFiles(prev => prev.map((f, i) => i === activeDocIdx ? { ...f, numPages } : f));
  };

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length < 3) { setMenuPos(null); return; }
    
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    const cr    = docViewerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    
    let pageNum = '1';
    let lineNum = '?';
    
    const activeDoc = caseFiles[activeDocIdx];
    
    if (activeDoc?.ext === 'pdf') {
      let node = sel.anchorNode;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains('react-pdf__Page')) {
          pageNum = node.getAttribute('data-page-number') || '1';
          break;
        }
        node = node.parentNode;
      }
    } else {
      const docText  = docViewerRef.current?.innerText || '';
      const selStart = docText.indexOf(sel.toString().trim().slice(0, 40));
      lineNum  = selStart > -1 ? Math.floor(selStart / 80) + 1 : '?';
      const pageMatch = docText.slice(0, selStart).match(/— Page (\d+)/g);
      pageNum   = pageMatch ? pageMatch[pageMatch.length - 1]?.match(/\d+/)?.[0] : '1';
    }

    setSelection({ text: sel.toString().trim(), page: pageNum, line: lineNum });
    setMenuPos({ x: rect.left - cr.left + rect.width / 2, y: rect.bottom - cr.top + 6 });
  }, [activeDocIdx, caseFiles]);

  const handleExtractFact = () => {
    const doc = caseFiles[activeDocIdx];
    const pin = doc?.ext === 'pdf' ? `p.${selection.page}` : `p.${selection.page}, l.${selection.line}`;
    setFactForm({ ...emptyFact, sourceText: selection.text, pincite: `${doc?.file_name}, ${pin}`, date: new Date().toISOString().split('T')[0] });
    setMenuPos(null); setShowFactForm(true);
    window.getSelection()?.removeAllRanges();
  };

  const handleCopyPincite = () => {
    const doc = caseFiles[activeDocIdx];
    const pin = doc?.ext === 'pdf' ? `p.${selection.page}` : `p.${selection.page}, l.${selection.line}`;
    navigator.clipboard.writeText(`${doc?.file_name}, ${pin}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    setMenuPos(null);
  };

  const handleAddNewIssue = async (e) => {
    if (e.key === 'Enter' && newIssueName.trim()) {
      try {
        const res = await apiPost(`/api/cases/${caseId}/issues`, { name: newIssueName.trim(), description: '', color: '#4db6ac' });
        const data = await res.json();
        if (data.id) {
          const newIss = { id: data.id, name: newIssueName.trim(), color: '#4db6ac' };
          setIssuesList([...issuesList, newIss]);
          setFactForm(f => ({ ...f, issue_ids: [...f.issue_ids, data.id] }));
          setNewIssueName('');
        }
      } catch (err) { setError(err.message); }
    }
  };

  const handleSubmitFact = async () => {
    if (!factForm.date || !factForm.description) return;
    try {
      const activeDoc = caseFiles[activeDocIdx];
      const pin = activeDoc?.ext === 'pdf' ? `p.${selection.page}` : `p.${selection.page}, l.${selection.line}`;
      const payload = {
        fact_date: factForm.date,
        description: factForm.description,
        pincite: factForm.pincite,
        status: factForm.status,
        issue_ids: factForm.issue_ids,
        witness_ids: factForm.witness_ids,
        sources: activeDoc ? [{ file_id: activeDoc.id, pincite: pin }] : [],
        color: factForm.color,
        source_text: factForm.sourceText
      };
      const rawRes = await apiPost('/api/cases/' + caseId + '/facts', payload);
      const res = await rawRes.json();
      if (res && res.id) {
        if (onFactExtracted) onFactExtracted({ ...payload, id: res.id });
        setFactForm(emptyFact); 
        setShowFactForm(false);
        fetchData(); // Reload facts
      }
    } catch (err) { setError(err.message); }
  };

  const handleJumpToFact = (fact) => {
    // Navigate to the file and page
    if (!fact.pincite) return;
    const parts = fact.pincite.split(',');
    const filename = parts[0].trim();
    const docIndex = caseFiles.findIndex(f => f.file_name === filename);
    
    if (docIndex >= 0) {
      loadFileContent(docIndex);
      const pageMatch = fact.pincite.match(/p\.(\d+)/i);
      if (pageMatch) {
        setTimeout(() => {
          const pageEl = document.querySelector(`.react-pdf__Page[data-page-number="${pageMatch[1]}"]`);
          if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 1000); // Give PDF time to render if not loaded yet
      }
    }
  };

  // The custom text renderer for react-pdf to highlight matching strings
  const textRenderer = useCallback((textItem) => {
    const str = textItem.str;
    if (str.trim().length > 4) {
      for (let fact of localFacts) {
        // If this PDF text chunk is found inside any fact's source_text
        if (fact.source_text && fact.source_text.includes(str)) {
          return <mark style={{ backgroundColor: `${fact.color || '#c9a84c'}66`, color: 'inherit', padding: '1px 0', borderRadius: '2px' }}>{str}</mark>;
        }
      }
    }
    return str;
  }, [localFacts]);

  const toggleIssue = id => setFactForm(f => ({ ...f, issue_ids: f.issue_ids.includes(id) ? f.issue_ids.filter(i => i !== id) : [...f.issue_ids, id] }));
  const toggleWitness = id => setFactForm(f => ({ ...f, witness_ids: f.witness_ids.includes(id) ? f.witness_ids.filter(i => i !== id) : [...f.witness_ids, id] }));

  const activeDoc = caseFiles[activeDocIdx];

  return (
    <div 
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFileUpload(e.dataTransfer.files); }}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: '600px', fontFamily: 'var(--font-body)' }}
    >

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', borderRadius: '10px 10px 0 0', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--gold-400)', letterSpacing: '0.01em' }}>Doc Reviewer</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Select text in any document to extract a fact into the chronology.</span>
        <div style={{ flex: 1 }} />
        {copied && <span style={{ fontSize: '0.72rem', color: '#4db6ac', fontFamily: 'var(--font-mono)' }}>pincite copied</span>}
        {error  && <span style={{ fontSize: '0.72rem', color: '#ef5350' }}>{error}</span>}
        <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} style={{background:'var(--navy-950)', color:'white', border:'1px solid var(--border-default)', padding:'4px 8px', borderRadius:'4px', fontSize:'0.75rem'}}>
          {FOLDERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button className="secondary-btn" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={() => fileInputRef.current?.click()}>+ Upload Documents</button>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.md,.png,.jpg,.jpeg,.tiff" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files)} />
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Document List (Directory Tree) */}
        <div style={{ width: '230px', flexShrink: 0, ...S.panel }}>
          <div style={{ padding: '8px 12px', ...S.label, borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: '4px' }}>
            Document Library ({caseFiles.length})
          </div>
          {caseFiles.length === 0 ? (
            <div style={{ padding: '24px 14px', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.6, textAlign: 'center' }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}>
              Drop files here or use the upload button above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 8px' }}>
              {FOLDERS.map(folder => {
                const filesInFolder = caseFiles.filter(f => (f.category || 'other') === folder.id);
                if (filesInFolder.length === 0) return null;
                return (
                  <details key={folder.id} open style={{background:'rgba(255,255,255,0.02)', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden'}}>
                    <summary style={{padding:'6px 8px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, color:'white', display:'flex', alignItems:'center', gap:'6px', listStyle:'none', userSelect:'none'}}>
                      <span style={{fontSize:'0.9rem'}}>{folder.label.split(' ')[0]}</span>
                      <span style={{color: folder.color, flex: 1}}>{folder.label.slice(2)}</span>
                      <span style={{fontSize:'0.65rem', color:'var(--text-muted)', background:'rgba(0,0,0,0.3)', padding:'2px 6px', borderRadius:'10px'}}>{filesInFolder.length}</span>
                    </summary>
                    <div style={{padding:'2px 0 6px'}}>
                      {filesInFolder.map(doc => {
                        const originalIdx = caseFiles.findIndex(f => f.id === doc.id);
                        return (
                          <div key={doc.id} onClick={() => { loadFileContent(originalIdx); setShowFactForm(false); setMenuPos(null); }}
                            style={{ padding: '6px 10px 6px 26px', cursor: 'pointer', background: activeDocIdx === originalIdx ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: `2px solid ${activeDocIdx === originalIdx ? folder.color : 'transparent'}`, transition: 'background 0.12s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: activeDocIdx === originalIdx ? 'var(--gold-300)' : 'var(--text-primary)', marginBottom: '2px', wordBreak: 'break-all', lineHeight: 1.3, flex: 1 }}>{doc.file_name}</div>
                              <button onClick={e => handleDeleteFile(e, doc.id)} title="Delete duplicate file" style={{ background: 'none', border: 'none', color: 'rgba(239,83,80,0.6)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }}>✕</button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{doc.ext.toUpperCase()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        {/* CENTER — Document Viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: 'var(--navy-950)' }}>
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,14,28,0.85)', zIndex: 5 }}>
              <div style={{ color: 'var(--gold-400)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>Processing document…</div>
            </div>
          )}

          {!activeDoc ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '10px', userSelect: 'none' }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Upload or drag a document to begin</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PDF, DOCX, TXT, CSV, XLSX, images</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 16px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeDoc.file_name}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>{(activeDoc.file_size / 1024).toFixed(1)} KB</span>
              </div>

              <div ref={docViewerRef} onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}
                style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', fontSize: '0.87rem', lineHeight: '1.8', color: 'var(--text-primary)', userSelect: 'text', cursor: 'text', fontFamily: ['txt','csv','md'].includes(activeDoc.ext) ? 'var(--font-mono)' : 'var(--font-serif)', whiteSpace: ['txt','csv'].includes(activeDoc.ext) ? 'pre-wrap' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                
                {activeDoc.ext === 'pdf' ? (
                  <Document
                    file={activeDoc.content}
                    onLoadSuccess={handleDocumentLoadSuccess}
                    loading={<div style={{ padding: '20px', color: 'var(--text-muted)' }}>Rendering visual document...</div>}
                    error={<div style={{ padding: '20px', color: '#ef5350' }}>Failed to render PDF visually.</div>}
                  >
                    {Array.from(new Array(activeDoc.numPages || 0), (el, index) => (
                      <div key={`page_${index + 1}`} style={{ marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', background: '#fff' }}>
                        <Page 
                          pageNumber={index + 1} 
                          renderTextLayer={true} 
                          renderAnnotationLayer={false}
                          customTextRenderer={textRenderer}
                          width={docViewerRef.current ? Math.min(docViewerRef.current.clientWidth - 72, 850) : 700}
                        />
                      </div>
                    ))}
                  </Document>
                ) : (
                  <div style={{ width: '100%', maxWidth: '850px' }}>
                    {activeDoc.content
                      ? activeDoc.content.split(/— Page (\d+) of (\d+) —/).map((chunk, i) => {
                          if (/^\d+$/.test(chunk)) return null;
                          if (i > 0 && /^\d+$/.test(activeDoc.content.split(/— Page (\d+) of (\d+) —/)[i - 1])) {
                            const pgNum = activeDoc.content.split(/— Page (\d+) of (\d+) —/)[i - 1];
                            return (
                              <React.Fragment key={i}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 18px', opacity: 0.4 }}>
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                  <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PAGE {pgNum}</span>
                                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                </div>
                                <div>{chunk}</div>
                              </React.Fragment>
                            );
                          }
                          return <div key={i}>{chunk}</div>;
                        })
                      : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No text content could be extracted.</span>
                    }
                  </div>
                )}
              </div>

              {menuPos && (
                <div style={{ position: 'absolute', left: `${Math.min(menuPos.x, (docViewerRef.current?.clientWidth || 600) - 220)}px`, top: `${menuPos.y + 50}px`, background: 'var(--navy-800)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: '6px', padding: '6px', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', zIndex: 100, minWidth: '210px' }}>
                  <div style={{ padding: '4px 10px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                      "{selection.text.slice(0, 55)}{selection.text.length > 55 ? '…' : ''}"
                    </span>
                  </div>
                  {[
                    { label: 'Extract → Fact', sub: 'Add to chronology with citation', action: handleExtractFact, primary: true },
                    { label: 'Copy pincite', sub: `${caseFiles[activeDocIdx]?.file_name}, p.${selection.page}`, action: handleCopyPincite, primary: false },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px', padding: '7px 10px', background: item.primary ? 'rgba(201,168,76,0.08)' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', transition: 'background 0.12s', marginBottom: '2px' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = item.primary ? 'rgba(201,168,76,0.08)' : 'transparent'}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: item.primary ? 'var(--gold-300)' : 'var(--text-primary)' }}>{item.label}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.sub}</span>
                    </button>
                  ))}
                  <button onClick={() => { setMenuPos(null); window.getSelection()?.removeAllRanges(); }} style={{ width: '100%', padding: '4px 10px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.68rem', cursor: 'pointer', textAlign: 'left' }}>Dismiss</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT — Fact Panel */}
        <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', background: 'var(--navy-900)', overflowY: 'auto' }}>
          {showFactForm ? (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold-400)' }}>Extract Fact</span>
                <button onClick={() => setShowFactForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.05)', borderLeft: '3px solid rgba(201,168,76,0.3)', borderRadius: '0 4px 4px 0' }}>
                <div style={{ ...S.label, marginBottom: '4px' }}>Source text</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', lineHeight: 1.6, maxHeight: '72px', overflowY: 'auto' }}>"{factForm.sourceText}"</div>
              </div>

              <div>
                <label className="ws-label">Pincite citation</label>
                <input value={factForm.pincite} onChange={e => setFactForm(f => ({ ...f, pincite: e.target.value }))} className="ws-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gold-400)' }} />
              </div>

              <div>
                <label className="ws-label">Date of event</label>
                <input type="date" value={factForm.date} onChange={e => setFactForm(f => ({ ...f, date: e.target.value }))} className="ws-input" />
              </div>

              <div>
                <label className="ws-label">Fact description / paraphrase *</label>
                <textarea value={factForm.description} onChange={e => setFactForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="What does this passage establish or prove?" className="ws-textarea" />
              </div>

              {/* COLOR PICKER */}
              <div>
                <label className="ws-label">Highlight Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {FACT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setFactForm(f => ({ ...f, color: c }))} 
                      style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: factForm.color === c ? '2px solid #fff' : '2px solid transparent', outline: factForm.color === c ? '1px solid var(--gold-400)' : 'none', transition: 'all 0.12s' }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="ws-label">Legal issues (select all that apply)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '4px' }}>
                  {issuesList.map(issue => (
                    <label key={issue.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer', borderRadius: '3px', background: factForm.issue_ids.includes(issue.id) ? 'rgba(201,168,76,0.07)' : 'transparent', transition: 'background 0.12s' }}>
                      <input type="checkbox" checked={factForm.issue_ids.includes(issue.id)} onChange={() => toggleIssue(issue.id)} style={{ accentColor: 'var(--gold-500)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: factForm.issue_ids.includes(issue.id) ? 'var(--gold-300)' : 'var(--text-secondary)' }}>{issue.name}</span>
                    </label>
                  ))}
                  <div style={{ padding: '4px 6px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <input 
                      type="text" 
                      placeholder="+ Add New Issue (press Enter)" 
                      value={newIssueName} 
                      onChange={e => setNewIssueName(e.target.value)}
                      onKeyDown={handleAddNewIssue}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--gold-400)', fontSize: '0.75rem', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="ws-label">Witnesses / Contacts</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '4px' }}>
                  {witnessList.map(w => (
                    <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer', borderRadius: '3px', background: factForm.witness_ids.includes(w.id) ? 'rgba(201,168,76,0.07)' : 'transparent' }}>
                      <input type="checkbox" checked={factForm.witness_ids.includes(w.id)} onChange={() => toggleWitness(w.id)} style={{ accentColor: 'var(--gold-500)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: factForm.witness_ids.includes(w.id) ? 'var(--gold-300)' : 'var(--text-secondary)' }}>{w.name} <span style={{fontSize:'0.65rem', color:'var(--text-muted)'}}>({w.role})</span></span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="ws-label">Evidentiary status</label>
                <div style={{ display: 'flex', gap: '0', border: '1px solid var(--border-default)', borderRadius: '4px', overflow: 'hidden' }}>
                  {['Procured', 'Disputed', 'Missing'].map(s => (
                    <button key={s} onClick={() => setFactForm(f => ({ ...f, status: s }))}
                      style={{ flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: factForm.status === s ? 700 : 400, fontFamily: 'var(--font-body)', transition: 'all 0.12s',
                        background: factForm.status === s ? STATUS_COLOR[s] + '22' : 'transparent',
                        color: factForm.status === s ? STATUS_COLOR[s] : 'var(--text-muted)',
                        borderRight: '1px solid var(--border-default)'
                      }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', marginRight: 5, background: factForm.status === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.1)', verticalAlign: 'middle' }} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="ws-label">Analysis notes (privileged)</label>
                <textarea value={factForm.notes} onChange={e => setFactForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Counsel's private notes…" className="ws-textarea" />
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button onClick={() => setShowFactForm(false)} className="secondary-btn" style={{ flex: 1, fontSize: '0.78rem' }}>Cancel</button>
                <button onClick={handleSubmitFact} className="primary-btn" disabled={!factForm.date || !factForm.description} style={{ flex: 2, fontSize: '0.82rem', fontWeight: 700 }}>Lock to Chronology</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--gold-400)' }}>Extracted Facts</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{localFacts.length} recorded</span>
              </div>

              {localFacts.length === 0 ? (
                <div style={{ padding: '32px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.7, fontFamily: 'var(--font-serif)', fontStyle: 'italic', textAlign: 'center' }}>
                  No facts extracted yet.<br/>Select text in the document to begin.
                </div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {localFacts.map((f, i) => (
                    <div key={f.id} 
                         onClick={() => handleJumpToFact(f)}
                         style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: `4px solid ${f.color || '#c9a84c'}`, cursor: 'pointer', transition: 'background 0.1s' }}
                         onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gold-400)' }}>{f.fact_date || f.date}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: '0.65rem', color: STATUS_COLOR[f.status], fontWeight: 600 }}>{f.status}</span>
                      </div>
                      <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.45, marginBottom: '5px' }}>{f.description}</div>
                      
                      {f.source_text && (
                        <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderLeft: `2px solid ${f.color || '#c9a84c'}50`, borderRadius: '0 4px 4px 0', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', lineHeight: 1.6 }}>
                          "{f.source_text}"
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        {(f.issues || []).map((iss, ii) => (
                          <span key={ii} style={{ fontSize: '0.62rem', color: iss.color || 'var(--text-muted)', border: `1px solid ${iss.color || 'var(--border-default)'}50`, padding: '2px 6px', borderRadius: '4px' }}>
                            {iss.name}
                          </span>
                        ))}
                        {(f.witnesses || []).map((w, wi) => (
                          <span key={wi} style={{ fontSize: '0.62rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                            {w.name}
                          </span>
                        ))}
                      </div>

                      {f.pincite && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{f.pincite}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
