// SocaPaAssistant.jsx — Chambers Co-Counsel & Practice Operations Desk
import React, { useState, useRef, useEffect } from 'react';
import { apiPost, apiGet, apiDelete, apiUpload, clearAppCacheAndReload } from '../api';
import MarkdownRenderer from './MarkdownRenderer';
import {
  AssistantIcon, DocumentIcon, SyncIcon, ClockIcon, SettingsIcon,
  EditIcon, HistoryIcon, TrashIcon, CheckIcon, ScalesIcon, CalendarIcon, BriefcaseIcon
} from './Icons';

const QUICK_PROMPTS = [
  'Summary of upcoming court mentions and hearings this week',
  'Draft formal client status update for active case',
  'Review procedural requirements for High Court e-Filing submission',
  'Explain fee assessment and billing under Advocates Remuneration Order'
];

function extractSuggestionsAndClean(rawContent) {
  if (!rawContent) return { cleanContent: '', suggestions: [] };
  let suggestions = [];
  let cleanContent = rawContent.replace(/<!--SUGGESTIONS:(.*?)-->/gs, (_, jsonStr) => {
    try {
      suggestions = JSON.parse(jsonStr.trim());
    } catch (e) {}
    return '';
  }).replace(/<!--ACTION:(.*?)-->/gs, '');
  return { cleanContent: cleanContent.trim(), suggestions };
}

export default function SocaPaAssistant({ cases = [], activeMatterId = null, onActionExecuted = null }) {
  const [selectedCaseId, setSelectedCaseId] = useState(activeMatterId || '');
  const [currentSessionId, setCurrentSessionId] = useState(() => 'sess_' + Date.now());
  const [savedSessions, setSavedSessions] = useState([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Derive active selectedCase object safely from cases list
  const selectedCase = cases.find(c => String(c.id) === String(selectedCaseId)) || null;

  useEffect(() => {
    if (activeMatterId) {
      setSelectedCaseId(activeMatterId);
    }
  }, [activeMatterId]);

  const INITIAL_GREETING = {
    role: 'assistant',
    content: `Greetings. I am **SocaBot** — chambers research and practice operations assistant for Sam Ogola & Co. Advocates.

Directly synchronized with your active Legal OS docket, here is what I can assist with:
* **Pleadings & Ingestion:** Process e-Filing documents, extract citations & prepare verification dockets
* **Court Diary & Mentions:** Monitor hearing notices, cause list appearances & filing deadlines
* **Client Briefings:** Draft professional legal notices, formal email summaries & WhatsApp dispatch
* **Firm Ledgers & Compliance:** Calculate fees under Advocates Remuneration Order (ARO) & manage trust accounts

Please select an active matter or state your inquiry.`
  };

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('socabot_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [INITIAL_GREETING];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingStage, setThinkingStage] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');

  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  // Fetch account-linked chat sessions from backend
  const fetchSessions = async () => {
    try {
      const res = await apiGet('/api/soca-pa/sessions');
      const data = await res.json();
      if (Array.isArray(data)) setSavedSessions(data);
    } catch (e) {
      console.warn('Could not fetch saved sessions:', e.message);
    }
  };

  useEffect(() => {
    fetchSessions();
    const mainContent = document.querySelector('.dash-content');
    if (mainContent) mainContent.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);

  // Save session to backend whenever messages update
  const syncSessionToBackend = async (newMessages) => {
    if (!newMessages || newMessages.length <= 1) return;
    try {
      const firstUserMsg = newMessages.find(m => m.role === 'user')?.content || 'New Research Session';
      const title = firstUserMsg.slice(0, 35) + (firstUserMsg.length > 35 ? '...' : '');

      await apiPost('/api/soca-pa/sessions', {
        id: currentSessionId,
        session_title: title,
        case_id: selectedCaseId || null,
        messages: newMessages
      });
      fetchSessions();
    } catch (e) {
      console.warn('Session sync warning:', e.message);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, loading, thinkingStage]);

  // Persist local storage cache
  useEffect(() => {
    try {
      localStorage.setItem('socabot_chat_history', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  const handleStartNewChat = () => {
    const newId = 'sess_' + Date.now();
    setCurrentSessionId(newId);
    setMessages([INITIAL_GREETING]);
    setShowHistoryPanel(false);
  };

  const handleLoadSession = (session) => {
    setCurrentSessionId(session.id);
    if (session.case_id) setSelectedCaseId(session.case_id);
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      setMessages(session.messages);
    }
    setShowHistoryPanel(false);
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await apiDelete(`/api/soca-pa/sessions/${sessionId}`);
      setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error('Delete session error:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const handleSend = async (overridePrompt = null, isEdit = false, historyToUse = null) => {
    const textToSend = overridePrompt !== null ? overridePrompt : input;
    if ((!textToSend.trim() && !attachedFile) || loading) return;

    let userMessageContent = textToSend.trim();
    if (attachedFile) {
      userMessageContent += `\n\n[Attached: ${attachedFile.name}]`;
    }

    const currentHistory = historyToUse || messages;
    const newMessages = [...currentHistory, { role: 'user', content: userMessageContent }];

    setMessages(newMessages);
    if (!overridePrompt) setInput('');
    setLoading(true);

    const fileToUpload = attachedFile;
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const stages = [
      'Scanning matter chronology & active pleadings...',
      'Cross-referencing Kenyan statutes & CTS dockets...',
      'Synthesizing legal analysis & drafting response...'
    ];
    let stageIdx = 0;
    setThinkingStage(stages[0]);
    const stageInterval = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      setThinkingStage(stages[stageIdx]);
    }, 2500);

    abortControllerRef.current = new AbortController();

    try {
      let endpoint = '/api/soca-pa/chat';
      let payload;

      if (fileToUpload) {
        endpoint = '/api/soca-pa/analyze-doc';
        payload = new FormData();
        payload.append('file', fileToUpload);
        payload.append('case_id', selectedCaseId || '');
        payload.append('matter_id', selectedCaseId || '');
        payload.append('prompt', textToSend || 'Review and summarize this legal document.');
        payload.append('message', textToSend || 'Review and summarize this legal document.');
        payload.append('history', JSON.stringify(currentHistory));
      } else {
        payload = {
          message: textToSend,
          messages: newMessages,
          history: currentHistory,
          case_id: selectedCaseId || null,
          matter_id: selectedCaseId || null,
          user_role: 'advocate'
        };
      }

      const res = fileToUpload
        ? await apiUpload(endpoint, payload)
        : await apiPost(endpoint, payload);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }

      const finalMessages = [...newMessages, {
        role: 'assistant',
        content: data.reply || data.analysis || 'Analysis complete.'
      }];

      setMessages(finalMessages);
      syncSessionToBackend(finalMessages);

      if (data.executed_action && onActionExecuted) {
        onActionExecuted(data.executed_action);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const rawMsg = err.message || 'Unknown network error';
        let friendlyText = `Operational Notice: ${rawMsg}`;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: friendlyText
        }]);
      }
    } finally {
      clearInterval(stageInterval);
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRegenerate = (idx) => {
    const historyUpTo = messages.slice(0, idx);
    const lastUserMsg = historyUpTo.filter(m => m.role === 'user').pop();
    if (lastUserMsg) {
      setMessages(historyUpTo);
      handleSend(lastUserMsg.content, true, historyUpTo);
    }
  };

  const handleSaveEdit = (idx) => {
    if (!editText.trim()) return;
    const historyUpTo = messages.slice(0, idx);
    historyUpTo.push({ role: 'user', content: editText });
    setMessages(historyUpTo);
    setEditingIndex(null);
    setEditText('');
    handleSend(editText, true, historyUpTo);
  };

  return (
    <div className="socabot-workbench-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: '1 1 auto', background: 'var(--navy-900)', color: 'white', fontFamily: 'var(--font-body)', borderRadius: 'var(--radius-md, 4px)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
      {/* ── Top Bar ── */}
      <div className="socabot-workbench-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--navy-950)', borderBottom: '1px solid var(--border-default)', flexShrink: 0, gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm, 3px)', background: 'rgba(201,168,76,0.1)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AssistantIcon size={16} color="var(--gold-400)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <div style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--gold-400)', letterSpacing: '0.01em', lineHeight: 1.2 }}>
              Co-Counsel Practice Desk
            </div>
            <div className="desktop-only-header-item" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              Statutory Research, Pleadings Synthesis & Practice Operations
            </div>
          </div>
        </div>

        {/* Controls: Context Selector, Sessions Drawer & New Chat */}
        <div className="socabot-workbench-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select 
            value={selectedCaseId} 
            onChange={e => setSelectedCaseId(e.target.value)} 
            style={{ background: 'var(--navy-900)', border: '1px solid var(--border-default)', color: 'white', padding: '5px 10px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.76rem', maxWidth: '220px', cursor: 'pointer' }}
          >
            <option value="">General Firm Practice</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>Matter: {c.client_name} — {c.case_title}</option>
            ))}
          </select>

          <button 
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className="secondary-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm, 3px)', color: showHistoryPanel ? 'var(--gold-400)' : 'var(--text-primary)', borderColor: showHistoryPanel ? 'var(--gold-500)' : 'var(--border-default)', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="View previous account-linked chat sessions"
          >
            <HistoryIcon size={12} />
            <span>Threads ({savedSessions.length})</span>
          </button>

          <button 
            onClick={handleStartNewChat}
            className="primary-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Start a new fresh chat session"
          >
            <span>+ New Thread</span>
          </button>

          <button 
            onClick={clearAppCacheAndReload}
            className="secondary-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm, 3px)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Force refresh and clear cached browser data"
          >
            <SyncIcon size={12} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── Account-Linked Previous Chat Sessions History Drawer ── */}
      {showHistoryPanel && (
        <div style={{ background: 'var(--navy-950)', borderBottom: '1px solid var(--border-default)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HistoryIcon size={14} color="var(--gold-400)" />
              <span>Saved Research Threads ({savedSessions.length})</span>
            </div>
            <button className="secondary-btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setShowHistoryPanel(false)}>
              Close Panel
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {savedSessions.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                No prior research sessions recorded for your advocate profile.
              </div>
            )}
            {savedSessions.map((sess) => (
              <div 
                key={sess.id}
                onClick={() => handleLoadSession(sess)}
                style={{
                  background: sess.id === currentSessionId ? 'rgba(201,168,76,0.1)' : 'var(--navy-900)',
                  border: `1px solid ${sess.id === currentSessionId ? 'var(--gold-500)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm, 3px)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'border-color 0.15s'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sess.session_title || 'Untitled Research Thread'}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    {new Date(sess.updated_at).toLocaleString('en-KE')} · {sess.messages?.length || 0} items
                  </div>
                </div>

                <button 
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  style={{ background: 'none', border: 'none', color: '#ef5350', fontSize: '0.75rem', cursor: 'pointer', padding: '4px' }}
                  title="Delete session"
                >
                  <TrashIcon size={12} color="#ef5350" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Context Indicator Banner ── */}
      {selectedCase && (
        <div style={{ background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid var(--border-default)', padding: '6px 20px', fontSize: '0.72rem', color: 'var(--gold-400)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BriefcaseIcon size={12} color="var(--gold-400)" />
          <span><strong>Active Case Context:</strong> {selectedCase.judiciary_case_id || selectedCase.id} ({selectedCase.client_name}) &bull; Milestone: {selectedCase.current_milestone || 'ACTIVE'}</span>
        </div>
      )}

      {/* ── Message History Stream ── */}
      <div ref={messagesContainerRef} className="socabot-chat-stream" style={{ flex: '1 1 auto', minHeight: '350px', overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, i) => {
          const { cleanContent } = extractSuggestionsAndClean(msg.content);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              
              <div style={{ display: 'flex', gap: '10px', maxWidth: '90%', width: '100%', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <AssistantIcon size={14} color="var(--gold-400)" />
                  </div>
                )}

                {editingIndex === i ? (
                  /* Edit User Prompt Mode */
                  <div style={{ width: '100%', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', borderRadius: 'var(--radius-sm, 3px)', padding: '12px' }}>
                    <textarea 
                      value={editText} 
                      onChange={e => setEditText(e.target.value)} 
                      rows={3} 
                      style={{ width: '100%', background: 'var(--navy-900)', border: '1px solid var(--border-default)', color: 'white', borderRadius: 'var(--radius-sm, 3px)', padding: '8px', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button className="secondary-btn" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => setEditingIndex(null)}>Cancel</button>
                      <button className="primary-btn" style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700 }} onClick={() => handleSaveEdit(i)}>Save & Submit</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: msg.role === 'user' ? '10px 14px' : '4px 6px',
                    borderRadius: 'var(--radius-sm, 3px)',
                    background: msg.role === 'user' ? 'rgba(201,168,76,0.1)' : 'transparent',
                    border: msg.role === 'user' ? '1px solid var(--border-default)' : 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    lineHeight: 1.6,
                    position: 'relative',
                    width: '100%'
                  }}>
                    <MarkdownRenderer content={cleanContent} />

                    {/* Starter Prompts for Initial Greeting */}
                    {i === 0 && msg.role === 'assistant' && messages.length === 1 && (
                      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                        {QUICK_PROMPTS.map((prompt, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => handleSend(prompt)}
                            disabled={loading}
                            style={{
                              padding: '10px 12px',
                              background: 'var(--navy-950)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-sm, 3px)',
                              color: 'var(--text-primary)',
                              fontSize: '0.76rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{prompt}</span>
                            <span style={{ color: 'var(--gold-400)', fontSize: '0.8rem', marginLeft: '6px' }}>&rarr;</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Inline Action Bar */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginTop: '8px', opacity: 0.8 }}>
                      <button 
                        onClick={() => handleCopy(cleanContent, i)}
                        style={{ background: 'none', border: 'none', color: copiedIndex === i ? '#4db6ac' : 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedIndex === i ? 'Copied' : 'Copy'}
                      </button>

                      {msg.role === 'user' && (
                        <button 
                          onClick={() => { setEditingIndex(i); setEditText(msg.content); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          Edit
                        </button>
                      )}

                      {msg.role === 'assistant' && i === messages.length - 1 && !loading && (
                        <button 
                          onClick={() => handleRegenerate(i)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '4px 0', padding: '8px 12px', background: 'var(--navy-950)', borderLeft: '3px solid var(--gold-500)', borderRadius: 'var(--radius-sm, 3px)', maxWidth: '420px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--gold-400)', fontWeight: 600 }}>
              {thinkingStage || 'Analyzing inquiry...'}
            </span>
          </div>
        )}
      </div>

      {/* ── Chat Input Footer & Disclaimer ── */}
      <div className="socabot-workbench-footer" style={{ padding: '12px 20px 14px', background: 'var(--navy-950)', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* Hidden File Input */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp,.txt,.csv,.md" 
          style={{ display: 'none' }} 
          onChange={handleFileSelect}
        />

        {/* Attached File Preview */}
        {attachedFile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(201,168,76,0.08)', border: '1px solid var(--gold-500)', borderRadius: 'var(--radius-sm, 3px)', padding: '6px 12px', fontSize: '0.76rem', color: 'var(--gold-300)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DocumentIcon size={13} color="var(--gold-400)" />
              <strong>{attachedFile.name}</strong>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({(attachedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button 
              type="button" 
              onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Court Document or Pleading"
            className="secondary-btn"
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.8rem', color: attachedFile ? 'var(--gold-400)' : 'var(--text-secondary)', borderColor: attachedFile ? 'var(--gold-500)' : 'var(--border-default)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <DocumentIcon size={14} />
          </button>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={attachedFile ? `Add instructions for ${attachedFile.name} (e.g. "Draft notice of motion" or "Review citations")...` : "Inquire with research assistant or attach a court pleading..."}
            rows={2}
            style={{ flex: 1, background: 'var(--navy-900)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm, 3px)', color: 'white', padding: '8px 12px', fontSize: '0.82rem', resize: 'none', fontFamily: 'inherit' }}
          />
          {loading ? (
            <button
              onClick={handleStopResponse}
              className="secondary-btn"
              style={{ padding: '8px 14px', fontWeight: 700, borderRadius: 'var(--radius-sm, 3px)', borderColor: '#ef5350', color: '#ef5350', fontSize: '0.78rem' }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() && !attachedFile}
              className="primary-btn"
              style={{ padding: '8px 16px', fontWeight: 700, borderRadius: 'var(--radius-sm, 3px)', fontSize: '0.8rem' }}
            >
              Submit
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Statutory research assistant for internal legal practice management. Always verify court citations, filing dates, and case ratios against Kenya Law Reports.
        </div>
      </div>
    </div>
  );
}
