// SocaPaAssistant.jsx — Global SocaBot Command Center
import React, { useState, useRef, useEffect } from 'react';
import { apiPost, apiGet, apiDelete, apiUpload, clearAppCacheAndReload } from '../api';
import MarkdownRenderer from './MarkdownRenderer';

const QUICK_PROMPTS = [
  '📅 Summary of upcoming court mentions this week',
  '📄 Help me draft a client update for matter ELC/E102/2026',
  '💡 What administrative determined actions can you perform?',
  '⚙️ Explain how eFiling document ingestion works'
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
    content: `Hello! I am **SocaBot** — your embedded administrative co-counsel.

Equipped with direct awareness of your **Legal OS** practice management environment, here is what I can assist you with today:
• **PDF Ingestion & Review:** Analyze eCitizen documents & preview determined system actions
• **Schedule & Mentions:** Summarize court dates, hearing notices, & deadlines
• **Client Communication:** Draft formal WhatsApp & email updates
• **System Operations & Ledgers:** Guide you through matters, chronologies, & financials

How can I help with your law firm administration today?`
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
      const firstUserMsg = newMessages.find(m => m.role === 'user')?.content || 'New Chat Session';
      const title = firstUserMsg.slice(0, 35) + (firstUserMsg.length > 35 ? '...' : '');

      await apiPost('/api/soca-pa/sessions', {
        id: currentSessionId,
        session_title: title,
        matter_id: selectedCaseId || null,
        messages: newMessages
      });
      fetchSessions();
    } catch (e) {
      console.warn('Error syncing session:', e.message);
    }
  };

  // Persist messages to localStorage and sync backend
  useEffect(() => {
    try {
      localStorage.setItem('socabot_chat_history', JSON.stringify(messages));
    } catch (e) {}
    if (messages.length > 1) {
      syncSessionToBackend(messages);
    }
  }, [messages]);

  const handleStartNewChat = () => {
    setCurrentSessionId('sess_' + Date.now());
    setMessages([INITIAL_GREETING]);
    try {
      localStorage.removeItem('socabot_chat_history');
    } catch (e) {}
  };

  const handleLoadSession = (session) => {
    setCurrentSessionId(session.id);
    setSelectedCaseId(session.matter_id || '');
    setMessages(session.messages && session.messages.length > 0 ? session.messages : [INITIAL_GREETING]);
    setShowHistoryPanel(false);
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await apiDelete(`/api/soca-pa/sessions/${sessionId}`);
      fetchSessions();
      if (sessionId === currentSessionId) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const [thinkingStage, setThinkingStage] = useState('');

  const THINKING_STAGES = [
    '🔍 Analyzing prompt & active matter context...',
    '🧠 Synthesizing operational skill flow...',
    '⚡ Flash executing database operation...',
    '✨ Finalizing PA response...'
  ];

  const handleSend = async (customText = null, isRegenerate = false, overrideHistory = null) => {
    const textToSend = customText || input;
    if ((!textToSend.trim() && !attachedFile) || loading) return;

    const fileToUpload = attachedFile;
    setAttachedFile(null);

    let updatedMessages = overrideHistory ? [...overrideHistory] : [...messages];

    const displayMsg = fileToUpload 
      ? `📎 **[Attached: ${fileToUpload.name}]**\n${textToSend || 'Analyze this document and assign to relevant matter.'}`
      : textToSend;

    if (!isRegenerate && !overrideHistory) {
      updatedMessages.push({ role: 'user', content: displayMsg });
      setMessages(updatedMessages);
      setInput('');
    }

    setLoading(true);
    setThinkingStage(fileToUpload ? '📄 Parsing PDF & analyzing matter intelligence...' : THINKING_STAGES[0]);

    // Animate thinking stages in the background
    const stageInterval = setInterval(() => {
      setThinkingStage(prev => {
        const idx = THINKING_STAGES.indexOf(prev);
        if (idx >= 0 && idx < THINKING_STAGES.length - 1) {
          return THINKING_STAGES[idx + 1];
        }
        return prev;
      });
    }, 1200);

    abortControllerRef.current = new AbortController();

    try {
      let res;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('message', textToSend || 'Please analyze this document, extract key facts, and assign it to the relevant matter or take appropriate action.');
        if (selectedCaseId) formData.append('matter_id', selectedCaseId);
        const historyPayload = updatedMessages.map(m => ({ role: m.role, content: m.content }));
        formData.append('history', JSON.stringify(historyPayload));

        res = await apiUpload('/api/soca-pa/upload-document', formData);
      } else {
        const historyPayload = updatedMessages.map(m => ({ role: m.role, content: m.content }));
        res = await apiPost('/api/soca-pa/chat', {
          message: textToSend,
          history: historyPayload,
          matter_id: selectedCaseId || null
        });
      }

      clearInterval(stageInterval);

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to communicate with SocaBot');

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.actionExecuted && typeof onActionExecuted === 'function') {
        onActionExecuted();
      }
    } catch (err) {
      clearInterval(stageInterval);
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⏹️ *Response generation cancelled by user.*' }]);
      } else {
        const rawMsg = err.message || '';
        let displayContent = rawMsg;

        if (!rawMsg.includes('DIAGNOSTIC BADGE')) {
          let friendlyText = 'SocaBot is temporarily unable to connect to the backend service.';
          let badge = 'ERR_NET_DISCONNECTED';

          if (rawMsg.includes('413') || rawMsg.includes('Too Large')) {
            friendlyText = 'The active prompt context or message history is too large. Starting a fresh chat session will restore performance.';
            badge = 'ERR_HTTP_413_PAYLOAD_EXCEEDED';
          } else if (rawMsg.includes('429') || rawMsg.includes('Rate limit')) {
            friendlyText = 'SocaBot service volume is high across firm users. Retrying automatically...';
            badge = 'ERR_HTTP_429_RATE_LIMIT';
          } else if (rawMsg.includes('404')) {
            friendlyText = 'SocaBot service endpoint is updating.';
            badge = 'ERR_HTTP_404_NOT_FOUND';
          }

          displayContent = `⚠️ **SocaBot Operational Notice**\n\n${friendlyText}\n\n\`[DIAGNOSTIC BADGE: ${badge}]\``;
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: displayContent
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
    // Find last user message prior to this assistant response
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
    <div className="socabot-workbench-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: '1 1 auto', background: 'radial-gradient(ellipse at top, #0c1424 0%, #03060b 100%)', color: 'white', fontFamily: 'var(--font-body)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      {/* ── Top Bar ── */}
      <div className="socabot-workbench-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(5, 10, 18, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/socabot_logo.png" 
            alt="SocaBot" 
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--gold-500)', boxShadow: '0 0 12px rgba(201,168,76,0.35)', flexShrink: 0 }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold-400)', fontFamily: 'var(--font-body)', letterSpacing: '0.01em', lineHeight: 1.2 }}>
              SocaBot
            </div>
            <div className="desktop-only-header-item" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
              Administrative Legal Co-Counsel & Firm Operations Assistant
            </div>
          </div>
        </div>

        {/* Controls: Context Selector, Sessions Drawer & New Chat */}
        <div className="socabot-workbench-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select 
            value={selectedCaseId} 
            onChange={e => setSelectedCaseId(e.target.value)} 
            style={{ background: '#070d18', border: '1px solid var(--gold-500)', color: 'white', padding: '5px 10px', borderRadius: '6px', fontSize: '0.78rem', maxWidth: '200px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            <option value="">🌐 General Firm Admin</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>📁 {c.client_name} — {c.case_title}</option>
            ))}
          </select>

          <button 
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className="secondary-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: '6px', color: showHistoryPanel ? 'var(--gold-400)' : 'var(--text-primary)', borderColor: showHistoryPanel ? 'var(--gold-500)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="View previous account-linked chat sessions"
          >
            📜 History ({savedSessions.length})
          </button>

          <button 
            onClick={handleStartNewChat}
            className="primary-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Start a new fresh chat session"
          >
            ✨ + New
          </button>

          <button 
            onClick={clearAppCacheAndReload}
            className="secondary-btn"
            style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Force refresh and clear cached browser data"
          >
            🔄 Sync Fresh App
          </button>
        </div>
      </div>

      {/* ── Account-Linked Previous Chat Sessions History Drawer ── */}
      {showHistoryPanel && (
        <div style={{ background: '#070d18', borderBottom: '1px solid var(--gold-500)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📜 Account Chat History ({savedSessions.length} Sessions)
            </div>
            <button className="secondary-btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setShowHistoryPanel(false)}>
              ✕ Close Panel
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {savedSessions.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px 0' }}>
                No previous saved chat sessions linked to your account yet.
              </div>
            )}
            {savedSessions.map((sess) => (
              <div 
                key={sess.id}
                onClick={() => handleLoadSession(sess)}
                style={{
                  background: sess.id === currentSessionId ? 'rgba(201,168,76,0.15)' : '#040810',
                  border: `1px solid ${sess.id === currentSessionId ? 'var(--gold-500)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sess.session_title || 'Untitled Session'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {new Date(sess.updated_at).toLocaleString()} · {sess.messages?.length || 0} messages
                  </div>
                </div>

                <button 
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  style={{ background: 'none', border: 'none', color: '#ef5350', fontSize: '0.8rem', cursor: 'pointer', padding: '4px', opacity: 0.7 }}
                  title="Delete session"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Context Indicator Banner ── */}
      {selectedCase && (
        <div style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '6px 24px', fontSize: '0.72rem', color: 'var(--gold-400)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📍 <strong>Active Context:</strong> Matter {selectedCase.judiciary_case_id || selectedCase.id} ({selectedCase.client_name}) — Milestone: {selectedCase.current_milestone || 'ACTIVE'}</span>
        </div>
      )}

      {/* ── Message History Stream ── */}
      <div ref={messagesContainerRef} className="socabot-chat-stream" style={{ flex: '1 1 auto', minHeight: '350px', overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((msg, i) => {
          const { cleanContent, suggestions } = extractSuggestionsAndClean(msg.content);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              
              <div style={{ display: 'flex', gap: '12px', maxWidth: '88%', width: '100%', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <img 
                    src="/socabot_logo.png" 
                    alt="SocaBot" 
                    style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--gold-500)', flexShrink: 0, marginTop: '2px', boxShadow: '0 0 10px rgba(201,168,76,0.3)' }}
                  />
                )}

                {editingIndex === i ? (
                  /* Edit User Prompt Mode */
                  <div style={{ width: '100%', background: '#060b14', border: '1px solid var(--gold-500)', borderRadius: '10px', padding: '12px' }}>
                    <textarea 
                      value={editText} 
                      onChange={e => setEditText(e.target.value)} 
                      rows={3} 
                      style={{ width: '100%', background: '#020408', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '6px', padding: '8px', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button className="secondary-btn" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => setEditingIndex(null)}>Cancel</button>
                      <button className="primary-btn" style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700 }} onClick={() => handleSaveEdit(i)}>Save & Submit</button>
                    </div>
                  </div>
                ) : (
                  /* Floating Message View (Card background removed for assistant text) */
                  <div style={{
                    padding: msg.role === 'user' ? '12px 18px' : '4px 6px',
                    borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '0px',
                    background: msg.role === 'user' ? 'rgba(201,168,76,0.14)' : 'transparent',
                    border: msg.role === 'user' ? '1px solid rgba(201,168,76,0.3)' : 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.86rem',
                    lineHeight: 1.6,
                    boxShadow: msg.role === 'user' ? '0 4px 20px rgba(0,0,0,0.35)' : 'none',
                    position: 'relative',
                    width: '100%'
                  }}>
                    <MarkdownRenderer content={cleanContent} />

                    {/* Starter Prompts Cards inside Chat Interface for Initial Greeting */}
                    {i === 0 && msg.role === 'assistant' && messages.length === 1 && (
                      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                        {QUICK_PROMPTS.map((prompt, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => handleSend(prompt)}
                            disabled={loading}
                            style={{
                              padding: '12px 14px',
                              background: '#070d18',
                              border: '1px solid rgba(201,168,76,0.25)',
                              borderRadius: '10px',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-500)'; e.currentTarget.style.background = 'rgba(201,168,76,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)'; e.currentTarget.style.background = '#070d18'; }}
                          >
                            <span>{prompt}</span>
                            <span style={{ color: 'var(--gold-400)', fontSize: '0.9rem', marginLeft: '6px' }}>➔</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Inline Action Bar */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginTop: '10px', opacity: 0.8 }}>
                      <button 
                        onClick={() => handleCopy(cleanContent, i)}
                        style={{ background: 'none', border: 'none', color: copiedIndex === i ? 'var(--green-400)' : 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedIndex === i ? '✓ Copied' : '📋 Copy'}
                      </button>

                      {msg.role === 'user' && (
                        <button 
                          onClick={() => { setEditingIndex(i); setEditText(msg.content); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          ✏️ Edit Prompt
                        </button>
                      )}

                      {msg.role === 'assistant' && i === messages.length - 1 && !loading && (
                        <button 
                          onClick={() => handleRegenerate(i)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          🔄 Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Executive Understated Status Indicator (No AI capsule) */}
        {loading && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '4px 0 8px', padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--gold-500)', borderRadius: '4px', maxWidth: '400px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--gold-400)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              {thinkingStage || 'Synthesizing response...'}
            </span>
          </div>
        )}
      </div>

      {/* ── Chat Input Footer & Disclaimer ── */}
      <div className="socabot-workbench-footer" style={{ padding: '12px 20px 16px', background: 'var(--navy-900)', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* Hidden File Input for PDF & Doc Attachments */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" 
          style={{ display: 'none' }} 
          onChange={e => {
            if (e.target.files?.[0]) setAttachedFile(e.target.files[0]);
          }} 
        />

        {/* Attached File Preview Chip */}
        {attachedFile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold-500)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: 'var(--gold-300)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📄</span>
              <strong>{attachedFile.name}</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({(attachedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button 
              type="button" 
              onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach PDF or Court Document for SocaBot AI Analysis"
            className="secondary-btn"
            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', color: attachedFile ? 'var(--gold-400)' : 'var(--text-secondary)', borderColor: attachedFile ? 'var(--gold-500)' : 'var(--border-default)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            📎
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
            placeholder={attachedFile ? `Add instructions for ${attachedFile.name} (e.g. "Create new case" or "Assign to matter")...` : "Ask SocaBot anything or attach a PDF document..."}
            rows={2}
            style={{ flex: 1, background: 'var(--navy-950)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'white', padding: '8px 12px', fontSize: '0.84rem', resize: 'none', fontFamily: 'inherit' }}
          />
          {loading ? (
            <button
              onClick={handleStopResponse}
              className="secondary-btn"
              style={{ padding: '8px 14px', fontWeight: 700, borderRadius: '8px', borderColor: '#ef5350', color: '#ef5350', fontSize: '0.8rem' }}
            >
              ⏹️ Stop
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() && !attachedFile}
              className="primary-btn"
              style={{ padding: '8px 16px', fontWeight: 700, borderRadius: '8px', fontSize: '0.84rem' }}
            >
              Send
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
          ⚠️ SocaBot can parse pleadings and auto-file actions. Please verify court dates, case numbers, and financial details.
        </div>
      </div>
    </div>
  );
}
