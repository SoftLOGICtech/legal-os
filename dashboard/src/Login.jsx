import React, { useState } from 'react';
import { setSession, BASE } from './api';
import { ShieldIcon, LockIcon } from './components/Icons';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim().toLowerCase(), password })
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Authentication failed. Please verify credentials.'); setLoading(false); return; }
            setSession(data);
            onLogin(data);
        } catch {
            setError('Could not connect to chambers server. Please verify network connectivity.');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--navy-950, #060E1C)',
            padding: '24px',
            fontFamily: 'var(--font-body, "DM Sans", sans-serif)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                padding: '40px 36px',
                background: 'var(--glass-bg, rgba(10, 22, 40, 0.88))',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border-default, rgba(30, 58, 106, 0.7))',
                borderRadius: 'var(--radius-md, 4px)',
                boxShadow: 'var(--shadow-navy, 0 4px 20px rgba(6, 14, 28, 0.45))'
            }}>
                {/* Chambers Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-sm, 3px)',
                        background: 'var(--navy-900, #0A1628)',
                        border: '1px solid var(--gold-500, #C9A84C)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gold-400, #DFC06A)',
                        marginBottom: '14px'
                    }}>
                        <ShieldIcon size={22} color="var(--gold-400, #DFC06A)" />
                    </div>
                    <h1 style={{
                        color: 'var(--gold-400, #DFC06A)',
                        fontFamily: 'var(--font-display, "DM Serif Display", serif)',
                        fontSize: '1.35rem',
                        fontWeight: 600,
                        margin: 0,
                        letterSpacing: '0.01em'
                    }}>
                        Sam Ogola & Co. Advocates
                    </h1>
                    <p style={{
                        color: 'var(--text-secondary, #94A3B8)',
                        fontSize: '0.72rem',
                        marginTop: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600
                    }}>
                        Chambers Practice Management System
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.68rem',
                            color: 'var(--text-secondary, #94A3B8)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                            marginBottom: '6px'
                        }}>
                            Advocate / Staff Identifier
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="e.g. advocate or admin"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px 12px',
                                background: 'var(--navy-950, #060E1C)',
                                border: '1px solid var(--border-default, rgba(30, 58, 106, 0.7))',
                                borderRadius: 'var(--radius-sm, 3px)',
                                color: 'var(--text-primary, #F0EDE8)',
                                fontSize: '0.88rem',
                                outline: 'none',
                                transition: 'border-color 0.15s ease'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--gold-500, #C9A84C)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default, rgba(30, 58, 106, 0.7))'}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.68rem',
                            color: 'var(--text-secondary, #94A3B8)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                            marginBottom: '6px'
                        }}>
                            Passkey / Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px 12px',
                                background: 'var(--navy-950, #060E1C)',
                                border: '1px solid var(--border-default, rgba(30, 58, 106, 0.7))',
                                borderRadius: 'var(--radius-sm, 3px)',
                                color: 'var(--text-primary, #F0EDE8)',
                                fontSize: '0.88rem',
                                outline: 'none',
                                transition: 'border-color 0.15s ease'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--gold-500, #C9A84C)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default, rgba(30, 58, 106, 0.7))'}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(198, 40, 40, 0.12)',
                            border: '1px solid rgba(198, 40, 40, 0.4)',
                            borderRadius: 'var(--radius-sm, 3px)',
                            padding: '10px 12px',
                            fontSize: '0.78rem',
                            color: '#EF5350'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '11px',
                            borderRadius: 'var(--radius-sm, 3px)',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            background: loading ? 'rgba(201,168,76,0.4)' : 'var(--gold-500, #C9A84C)',
                            color: 'var(--navy-950, #060E1C)',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            transition: 'opacity 0.15s ease',
                            marginTop: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <LockIcon size={14} color="var(--navy-950, #060E1C)" />
                        {loading ? 'Authenticating…' : 'Access Practice Desk'}
                    </button>
                </form>

                <div style={{
                    marginTop: '24px',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    textAlign: 'center',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted, #64748B)',
                    lineHeight: 1.5
                }}>
                    Authorized Advocates & Staff Only • LSK Practice Standards & Data Protection Act 2019 Compliant
                </div>
            </div>
        </div>
    );
}
