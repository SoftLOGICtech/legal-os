import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../api';
import { ShieldIcon, LockIcon } from './Icons';

export default function DevOpsConsole({ user, onSwitchToPractice }) {
    const [telemetry, setTelemetry] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, sync, whatsapp, ai, logs
    const [logFilterCat, setLogFilterCat] = useState('ALL');
    const [logFilterLevel, setLogFilterLevel] = useState('ALL');
    const [logSearch, setLogSearch] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const logTerminalRef = useRef(null);

    const fetchTelemetry = async () => {
        try {
            const data = await apiGet('/api/dev/ops-telemetry');
            if (data && data.telemetry) {
                setTelemetry(data.telemetry);
            }
        } catch (err) {
            console.error('[DevOps] Failed to fetch telemetry:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const params = new URLSearchParams();
            if (logFilterCat !== 'ALL') params.append('category', logFilterCat);
            if (logFilterLevel !== 'ALL') params.append('level', logFilterLevel);
            params.append('limit', '250');
            const data = await apiGet(`/api/dev/logs?${params.toString()}`);
            if (data && data.logs) {
                setLogs(data.logs);
            }
        } catch (err) {
            console.error('[DevOps] Failed to fetch logs:', err);
        }
    };

    useEffect(() => {
        fetchTelemetry();
        fetchLogs();
        const interval = setInterval(() => {
            fetchTelemetry();
            fetchLogs();
        }, 5000);
        return () => clearInterval(interval);
    }, [logFilterCat, logFilterLevel]);

    useEffect(() => {
        if (autoScroll && logTerminalRef.current) {
            logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleForceSync = async () => {
        setIsSyncing(true);
        setSyncMessage('Dispatching delta sync cycle to cloud...');
        try {
            const res = await apiPost('/api/dev/sync-force', {});
            if (res && res.success) {
                setSyncMessage('✅ Delta sync cycle completed successfully!');
            } else {
                setSyncMessage('⚠️ Sync completed with notice: ' + (res?.error || 'No remote changes'));
            }
            fetchTelemetry();
            fetchLogs();
        } catch (e) {
            setSyncMessage('❌ Sync error: ' + e.message);
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(''), 6000);
        }
    };

    const formatUptime = (seconds) => {
        if (!seconds) return '0m';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    };

    const filteredLogs = logs.filter(l => {
        if (!logSearch) return true;
        const q = logSearch.toLowerCase();
        return l.message?.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q) || l.level?.toLowerCase().includes(q);
    });

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #040914 0%, #071224 100%)',
            color: '#E2E8F0',
            fontFamily: 'var(--font-mono, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace)',
            padding: '24px',
            boxSizing: 'border-box'
        }}>
            {/* Top Navigation & Status Banner */}
            <div style={{
                background: 'rgba(10, 22, 40, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(201, 168, 76, 0.25)',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                        border: '1px solid #C9A84C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <ShieldIcon size={20} color="#C9A84C" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#DFC06A', fontWeight: 700, letterSpacing: '0.04em' }}>
                                LEGAL OS — CENTRAL OPS & FLEET TELEMETRY
                            </h2>
                            <span style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700
                            }}>
                                v1.5.7 LIVE
                            </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '3px', display: 'flex', gap: '12px' }}>
                            <span>Node: {telemetry?.system?.platform || 'win32'}</span>
                            <span>•</span>
                            <span>DB: {telemetry?.system?.databaseType || 'SQLite'}</span>
                            <span>•</span>
                            <span>Uptime: {formatUptime(telemetry?.system?.uptimeSeconds)}</span>
                            <span>•</span>
                            <span>RAM: {telemetry?.system?.memoryHeapUsedMb || 0} MB / {telemetry?.system?.memoryRssMb || 0} MB</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.72rem',
                        color: '#60A5FA',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>🔒</span>
                        <span>Kenya DPA 2019 & LSK Privilege Active</span>
                    </div>

                    <button
                        onClick={handleForceSync}
                        disabled={isSyncing}
                        style={{
                            background: isSyncing ? 'rgba(201, 168, 76, 0.3)' : 'linear-gradient(135deg, #C9A84C 0%, #A8862D 100%)',
                            color: '#060E1C',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 14px',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            cursor: isSyncing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>⚡</span>
                        <span>{isSyncing ? 'Syncing...' : 'Force Sync Fleet'}</span>
                    </button>

                    {onSwitchToPractice && (
                        <button
                            onClick={onSwitchToPractice}
                            style={{
                                background: 'rgba(30, 41, 59, 0.8)',
                                color: '#E2E8F0',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                borderRadius: '6px',
                                padding: '8px 14px',
                                fontWeight: 600,
                                fontSize: '0.76rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>⚖️</span>
                            <span>Chambers Desk</span>
                        </button>
                    )}
                </div>
            </div>

            {syncMessage && (
                <div style={{
                    background: syncMessage.includes('❌') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${syncMessage.includes('❌') ? '#EF4444' : '#10B981'}`,
                    borderRadius: '6px',
                    padding: '10px 16px',
                    fontSize: '0.8rem',
                    marginBottom: '16px',
                    color: syncMessage.includes('❌') ? '#FCA5A5' : '#6EE7B7'
                }}>
                    {syncMessage}
                </div>
            )}

            {/* Core Telemetry Status Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                marginBottom: '20px'
            }}>
                {/* Card 1: Cloud Sync Engine */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '14px 16px'
                }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Delta Sync Engine
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: telemetry?.sync?.isConnected ? '#10B981' : '#F59E0B' }}>
                        {telemetry?.sync?.isConnected ? '🟢 CONNECTED' : '🟡 STANDBY / 15s'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px' }}>
                        Outbox Queue: <b style={{ color: '#E2E8F0' }}>{telemetry?.sync?.pendingOutboxCount || 0} deltas</b>
                    </div>
                </div>

                {/* Card 2: WhatsApp Gateway */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '8px',
                    padding: '14px 16px'
                }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        WhatsApp Gateway (Baileys)
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: telemetry?.whatsapp?.isConnected ? '#10B981' : '#38BDF8' }}>
                        {telemetry?.whatsapp?.isConnected ? '📱 SOCKET LINKED' : (telemetry?.whatsapp?.pairingQrAvailable ? '📲 QR STANDBY' : '🔌 IDLE')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px' }}>
                        Privacy Mode: <b style={{ color: '#10B981' }}>Masked Phone / Strict PII</b>
                    </div>
                </div>

                {/* Card 3: AI Inference Engine */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '8px',
                    padding: '14px 16px'
                }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        AI & OCR Engine
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: telemetry?.ai?.hasSocaKey ? '#A855F7' : '#EF4444' }}>
                        {telemetry?.ai?.hasSocaKey ? '🤖 GROQ LPU (READY)' : '⚠️ NO GROQ KEY'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px' }}>
                        Primary: <b style={{ color: '#E2E8F0' }}>llama-3.3-70b-versatile</b>
                    </div>
                </div>

                {/* Card 4: Firm Active Vault */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(201, 168, 76, 0.3)',
                    borderRadius: '8px',
                    padding: '14px 16px'
                }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Chambers Active Vault
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#DFC06A' }}>
                        {telemetry?.metrics?.activeCases || 0} Matters
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px' }}>
                        Document Locker: <b style={{ color: '#E2E8F0' }}>{telemetry?.metrics?.caseFiles || 0} files</b>
                    </div>
                </div>
            </div>

            {/* Navigation Filter Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                paddingBottom: '12px',
                marginBottom: '16px'
            }}>
                {[
                    { id: 'overview', label: '📊 System Overview & Fleet' },
                    { id: 'whatsapp', label: '📱 WhatsApp Telemetry (Masked)' },
                    { id: 'sync', label: '🔄 Delta Sync Matrix' },
                    { id: 'logs', label: '📜 Live System Logs' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            background: activeTab === tab.id ? 'rgba(201, 168, 76, 0.15)' : 'transparent',
                            color: activeTab === tab.id ? '#DFC06A' : '#94A3B8',
                            border: `1px solid ${activeTab === tab.id ? '#C9A84C' : 'transparent'}`,
                            borderRadius: '6px',
                            padding: '8px 14px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: Overview */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: '8px',
                        padding: '18px'
                    }}>
                        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: '#38BDF8' }}>🌐 Cloud Core & Runtime Environment</h3>
                        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Remote Backend URL</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#60A5FA' }}>{telemetry?.sync?.remoteUrl || 'https://legal-os-lea2.onrender.com'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Active DB Architecture</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#10B981' }}>{telemetry?.system?.databaseType}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Node.js Runtime</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#E2E8F0' }}>{telemetry?.system?.nodeVersion} ({telemetry?.system?.platform})</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Electron Shell Mode</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: telemetry?.system?.isElectron ? '#10B981' : '#94A3B8' }}>
                                        {telemetry?.system?.isElectron ? 'Enabled (Desktop Standalone)' : 'Web/Headless Service'}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Privacy Compliance Standard</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#10B981' }}>Kenya DPA 2019 / LSK Privileged</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: '8px',
                        padding: '18px'
                    }}>
                        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: '#C9A84C' }}>⚖️ AI & Kenyan Judiciary Subsystem</h3>
                        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>SocaBot LLM Key</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: telemetry?.ai?.hasSocaKey ? '#10B981' : '#EF4444' }}>
                                        {telemetry?.ai?.hasSocaKey ? 'Configured & Active' : 'Missing Key'}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Multimodal PDF Vision Key</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: telemetry?.ai?.hasPdfKey ? '#10B981' : '#F59E0B' }}>
                                        {telemetry?.ai?.hasPdfKey ? 'Active (llama-3.2-11b)' : 'Fallback Local OCR'}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>eCitizen SSO & KYC Gateway</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: telemetry?.judiciary?.eCitizenConfigured ? '#10B981' : '#94A3B8' }}>
                                        {telemetry?.judiciary?.eCitizenConfigured ? 'Connected' : 'Standby / Auth Ready'}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 0', color: '#94A3B8' }}>Judiciary Ingestion Crawler</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#38BDF8' }}>Automated (Daily Sync)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: WhatsApp Privacy Stream */}
            {activeTab === 'whatsapp' && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    borderRadius: '8px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#4ADE80' }}>
                                📱 WhatsApp Engine Telemetry & Masked Dispatch Log
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>
                                Protected under Kenya Data Protection Act 2019. Client conversation bodies and sensitive IDs are strictly omitted from Ops stream.
                            </p>
                        </div>
                        <div style={{
                            background: telemetry?.whatsapp?.isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: telemetry?.whatsapp?.isConnected ? '#4ADE80' : '#F59E0B',
                            border: `1px solid ${telemetry?.whatsapp?.isConnected ? '#22C55E' : '#F59E0B'}`,
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                        }}>
                            {telemetry?.whatsapp?.isConnected ? 'SOCKET LIVE' : 'SOCKET RECONNECTING'}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)', textAlign: 'left', color: '#94A3B8' }}>
                                    <th style={{ padding: '8px' }}>Event ID</th>
                                    <th style={{ padding: '8px' }}>Masked Contact</th>
                                    <th style={{ padding: '8px' }}>Direction</th>
                                    <th style={{ padding: '8px' }}>Delivery Status</th>
                                    <th style={{ padding: '8px' }}>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(telemetry?.whatsapp?.recentMaskedEvents || []).map((ev, idx) => (
                                    <tr key={ev.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '8px', color: '#64748B' }}>{ev.id}</td>
                                        <td style={{ padding: '8px', color: '#DFC06A', fontWeight: 600 }}>{ev.maskedPhone}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontSize: '0.68rem',
                                                background: ev.direction === 'outbound' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                                color: ev.direction === 'outbound' ? '#60A5FA' : '#C084FC'
                                            }}>
                                                {ev.direction?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontSize: '0.68rem',
                                                background: ev.status === 'delivered' || ev.status === 'read' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                color: ev.status === 'delivered' || ev.status === 'read' ? '#4ADE80' : '#FBBF24'
                                            }}>
                                                {ev.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px', color: '#94A3B8' }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : 'Just now'}</td>
                                    </tr>
                                ))}
                                {(!telemetry?.whatsapp?.recentMaskedEvents || telemetry?.whatsapp?.recentMaskedEvents.length === 0) && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                                            No recent WhatsApp traffic recorded. Standing by for client messages.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Delta Sync Matrix */}
            {activeTab === 'sync' && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '8px',
                    padding: '20px'
                }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', color: '#60A5FA' }}>
                        🔄 Distributed Delta Sync Engine & Replication Outbox
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Remote Cloud Endpoint</div>
                            <div style={{ fontSize: '0.85rem', color: '#38BDF8', fontWeight: 600, marginTop: '4px' }}>
                                {telemetry?.sync?.remoteUrl}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Local Outbox Deltas Pending</div>
                            <div style={{ fontSize: '0.85rem', color: '#F59E0B', fontWeight: 700, marginTop: '4px' }}>
                                {telemetry?.sync?.pendingOutboxCount || 0} write-ahead mutations
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Sync Heartbeat Cycle</div>
                            <div style={{ fontSize: '0.85rem', color: '#10B981', fontWeight: 600, marginTop: '4px' }}>
                                Every 15 Seconds (Autonomous)
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginBottom: '8px' }}>Tables Replicated Across Multi-Instance Fleet:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(telemetry?.sync?.tablesTracked || []).map(tbl => (
                            <span key={tbl} style={{
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                color: '#E2E8F0'
                            }}>
                                📁 {tbl}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Logs */}
            {activeTab === 'logs' && (
                <div style={{
                    background: 'rgba(10, 15, 30, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '8px',
                    padding: '16px'
                }}>
                    {/* Log Filter Toolbar */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Category:</span>
                            {['ALL', 'SYNC', 'WHATSAPP', 'AI', 'SYSTEM', 'STORAGE'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setLogFilterCat(cat)}
                                    style={{
                                        background: logFilterCat === cat ? 'rgba(201, 168, 76, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                                        color: logFilterCat === cat ? '#DFC06A' : '#94A3B8',
                                        border: `1px solid ${logFilterCat === cat ? '#C9A84C' : 'transparent'}`,
                                        borderRadius: '4px',
                                        padding: '3px 8px',
                                        fontSize: '0.68rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                                style={{
                                    background: '#040914',
                                    border: '1px solid rgba(148, 163, 184, 0.3)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    color: '#E2E8F0',
                                    fontSize: '0.72rem',
                                    outline: 'none',
                                    width: '160px'
                                }}
                            />
                            <label style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={autoScroll}
                                    onChange={e => setAutoScroll(e.target.checked)}
                                />
                                Auto-scroll
                            </label>
                        </div>
                    </div>

                    {/* Log Terminal Window */}
                    <div
                        ref={logTerminalRef}
                        style={{
                            height: '420px',
                            overflowY: 'auto',
                            background: '#020617',
                            border: '1px solid rgba(30, 41, 59, 0.8)',
                            borderRadius: '6px',
                            padding: '12px',
                            fontSize: '0.72rem',
                            lineHeight: '1.6'
                        }}
                    >
                        {filteredLogs.map(log => {
                            let levelColor = '#94A3B8';
                            if (log.level === 'ERROR') levelColor = '#EF4444';
                            else if (log.level === 'WARN') levelColor = '#F59E0B';
                            else if (log.category === 'SYNC') levelColor = '#38BDF8';
                            else if (log.category === 'AI') levelColor = '#C084FC';
                            else if (log.category === 'WHATSAPP') levelColor = '#4ADE80';

                            return (
                                <div key={log.id} style={{ display: 'flex', gap: '8px', wordBreak: 'break-word', borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '2px 0' }}>
                                    <span style={{ color: '#475569', minWidth: '70px' }}>
                                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                                    </span>
                                    <span style={{
                                        color: levelColor,
                                        fontWeight: 700,
                                        minWidth: '55px'
                                    }}>
                                        [{log.level}]
                                    </span>
                                    <span style={{ color: '#64748B', minWidth: '70px' }}>
                                        [{log.category}]
                                    </span>
                                    <span style={{ color: '#E2E8F0', flex: 1 }}>
                                        {log.message}
                                    </span>
                                </div>
                            );
                        })}
                        {filteredLogs.length === 0 && (
                            <div style={{ color: '#64748B', textAlign: 'center', padding: '40px' }}>
                                No log events matching current filter criteria.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
