import React, { useState } from 'react';
import { setSession, BASE } from './api';

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
                method:'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ username: username.trim().toLowerCase(), password })
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Login failed.'); setLoading(false); return; }
            setSession(data);
            onLogin(data);
        } catch {
            setError('Could not connect to server. Please verify your internet connection or backend status.');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
            background:'radial-gradient(ellipse at 30% 40%, #0d1f3c 0%, #060e1c 70%)',
            fontFamily: 'var(--font-body, "DM Sans", sans-serif)'
        }}>
            <div style={{
                width:'100%', maxWidth:'400px', padding:'48px 40px',
                background:'rgba(255,255,255,0.04)', backdropFilter:'blur(20px)',
                border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px',
                boxShadow:'0 25px 60px rgba(0,0,0,0.5)'
            }}>
                {/* Logo */}
                <div style={{textAlign:'center', marginBottom:'32px'}}>
                    <div style={{
                        width:'60px', height:'60px', borderRadius:'10px',
                        background:'linear-gradient(135deg, #c9a84c, #a67c30)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        fontSize:'1.4rem', fontWeight:'900', color:'#fff',
                        letterSpacing:'-1px', marginBottom:'16px',
                        boxShadow:'0 8px 20px rgba(201,168,76,0.35)'
                    }}>SO</div>
                    <h1 style={{color:'#c9a84c', fontFamily: 'var(--font-display, "DM Serif Display", serif)', fontSize:'1.35rem', fontWeight700, margin:0, letterSpacing:'0.02em'}}>
                        Sam Ogola & Co Advocates
                    </h1>
                    <p style={{color:'rgba(255,255,255,0.45)', fontSize:'0.78rem', marginTop:'6px', margin:'6px 0 0', textTransform: 'uppercase', letterSpacing: '0.08em'}}>
                        Staff Portal
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                    <div>
                        <label style={{display:'block', fontSize:'0.7rem', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px'}}>
                            Username
                        </label>
                        <input
                            type="text" required autoFocus
                            value={username} onChange={e => setUsername(e.target.value)}
                            placeholder="e.g. admin"
                            style={{
                                width:'100%', boxSizing:'border-box', padding:'12px 16px',
                                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                                borderRadius:'8px', color:'white', fontSize:'0.9rem', outline:'none',
                                transition:'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = '#c9a84c'}
                            onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>
                    <div>
                        <label style={{display:'block', fontSize:'0.7rem', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px'}}>
                            Password
                        </label>
                        <input
                            type="password" required
                            value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width:'100%', boxSizing:'border-box', padding:'12px 16px',
                                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                                borderRadius:'8px', color:'white', fontSize:'0.9rem', outline:'none',
                                transition:'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = '#c9a84c'}
                            onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background:'rgba(239,83,80,0.15)', border:'1px solid rgba(239,83,80,0.4)',
                            borderRadius:'8px', padding:'10px 14px', fontSize:'0.8rem', color:'#ef5350'
                        }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={{
                        padding:'13px', borderRadius:'8px', border:'none', cursor: loading ? 'not-allowed' : 'pointer',
                        background: loading ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #c9a84c, #a67c30)',
                        color:'white', fontWeight:700, fontSize:'0.9rem',
                        boxShadow:'0 4px 15px rgba(201,168,76,0.3)',
                        transition:'opacity 0.2s', marginTop:'4px'
                    }}>
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <div style={{marginTop:'24px', textAlign:'center', fontSize:'0.7rem', color:'rgba(255,255,255,0.2)'}}>
                    Secure staff access only. Contact admin for credentials.
                </div>
            </div>
        </div>
    );
}
