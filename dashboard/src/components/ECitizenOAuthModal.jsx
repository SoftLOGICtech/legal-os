// ECitizenOAuthModal.jsx — eCitizen Single Sign-On & Instant Client KYC Verification Modal
import React, { useState } from 'react';
import { apiPost, apiGet } from '../api';
import { ShieldIcon, CheckIcon, UserIcon, LockIcon, ScalesIcon } from './Icons';

export default function ECitizenOAuthModal({ onClose, showToast, onKycVerified }) {
  const [activeTab, setActiveTab] = useState('kyc'); // 'kyc' | 'sso'

  // KYC Verification Form
  const [idNumber, setIdNumber] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [businessReg, setBusinessReg] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [kycResult, setKycResult] = useState(null);

  const handleVerifyKyc = async (e) => {
    e.preventDefault();
    if (!idNumber && !kraPin && !businessReg) {
      showToast('Please enter at least a National ID, KRA PIN, or Business Reg No.', 'error');
      return;
    }
    setVerifying(true);
    setKycResult(null);

    try {
      const res = await apiPost('/api/ecitizen/verify-kyc', {
        id_number: idNumber,
        kra_pin: kraPin,
        business_reg_no: businessReg
      });
      const data = await res?.json();

      if (res && res.ok && data && data.success) {
        setKycResult(data.kyc);
        showToast('eCitizen KYC Identity Verification Successful', 'success');
        if (onKycVerified) onKycVerified(data.kyc);
      } else {
        throw new Error(data?.error || 'Verification failed');
      }
    } catch (err) {
      showToast(`KYC Error: ${err.message}`, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleLaunchSso = async () => {
    try {
      const res = await apiGet('/api/ecitizen/auth-url');
      const data = await res?.json();
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        showToast('Launched eCitizen Single Sign-On Gateway', 'info');
      }
    } catch (err) {
      showToast(`SSO Error: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
    }}>
      <div style={{
        background:'var(--navy-900)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md, 4px)',
        width:'100%', maxWidth:'640px', maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--shadow-navy, 0 4px 20px rgba(0,0,0,0.8))',
        padding:'24px 28px', color:'white'
      }}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'14px', marginBottom:'20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldIcon size={16} color="var(--gold-400)" />
            </div>
            <div>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.05rem', fontFamily: 'var(--font-display)'}}>
                eCitizen OAuth 2.0 & IPRS Identity Gateway
              </h3>
              <div style={{fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                Official Identity, KRA PIN & Business Registration Verification
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.2rem', cursor:'pointer'}}>✕</button>
        </div>

        {/* Tab Switcher */}
        <div style={{display:'flex', gap:'8px', marginBottom:'18px', borderBottom:'1px solid var(--border-default)', paddingBottom:'10px'}}>
          <button
            onClick={() => setActiveTab('kyc')}
            style={{
              background: activeTab === 'kyc' ? 'var(--gold-500)' : 'var(--navy-800)',
              color: activeTab === 'kyc' ? 'var(--navy-950)' : 'var(--text-primary)',
              border: 'none', padding: '7px 14px', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <UserIcon size={13} color={activeTab === 'kyc' ? 'var(--navy-950)' : 'var(--text-muted)'} />
            <span>Client KYC Lookup</span>
          </button>
          <button
            onClick={() => setActiveTab('sso')}
            style={{
              background: activeTab === 'sso' ? 'var(--gold-500)' : 'var(--navy-800)',
              color: activeTab === 'sso' ? 'var(--navy-950)' : 'var(--text-primary)',
              border: 'none', padding: '7px 14px', borderRadius: 'var(--radius-sm, 3px)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <LockIcon size={13} color={activeTab === 'sso' ? 'var(--navy-950)' : 'var(--text-muted)'} />
            <span>Firm eCitizen SSO</span>
          </button>
        </div>

        {/* TAB 1: INSTANT CLIENT KYC LOOKUP */}
        {activeTab === 'kyc' && (
          <form onSubmit={handleVerifyKyc} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <div style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>
              Verify client National ID, KRA PIN, or Business CR12 details against the official eCitizen IPRS database prior to matter registration.
            </div>

            <div>
              <label style={{fontSize:'0.76rem', color:'var(--gold-400)', fontWeight:600, textTransform: 'uppercase', letterSpacing: '0.04em'}}>Client National ID / Passport Number:</label>
              <input
                type="text"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                placeholder="e.g. 34892019"
                style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'9px 12px', borderRadius:'var(--radius-sm, 3px)', fontSize:'0.84rem', marginTop:'4px'}}
              />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              <div>
                <label style={{fontSize:'0.76rem', color:'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600}}>Client KRA PIN:</label>
                <input
                  type="text"
                  value={kraPin}
                  onChange={e => setKraPin(e.target.value)}
                  placeholder="e.g. A019283749B"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'9px 12px', borderRadius:'var(--radius-sm, 3px)', fontSize:'0.84rem', marginTop:'4px'}}
                />
              </div>
              <div>
                <label style={{fontSize:'0.76rem', color:'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600}}>Company Reg / CR12 No:</label>
                <input
                  type="text"
                  value={businessReg}
                  onChange={e => setBusinessReg(e.target.value)}
                  placeholder="e.g. CPR/2026/88912"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'9px 12px', borderRadius:'var(--radius-sm, 3px)', fontSize:'0.84rem', marginTop:'4px'}}
                />
              </div>
            </div>

            <button
              type="submit"
              className="primary-btn"
              style={{padding:'10px', fontWeight:700, width:'100%', marginTop:'6px', borderRadius:'var(--radius-sm, 3px)'}}
              disabled={verifying}
            >
              {verifying ? 'Verifying with eCitizen IPRS Gateway...' : 'Execute eCitizen KYC Verification'}
            </button>

            {/* Verification Result Card */}
            {kycResult && (
              <div style={{
                background: 'rgba(77,182,172,0.1)',
                border: '1px solid rgba(77,182,172,0.4)',
                borderRadius: 'var(--radius-sm, 3px)',
                padding: '16px',
                marginTop: '10px'
              }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <span style={{fontWeight:600, color:'#4db6ac', fontSize:'0.9rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <CheckIcon size={14} color="#4db6ac" />
                    <span>{kycResult.status_desc || 'Verified Citizen Identity'}</span>
                  </span>
                  <span className="badge" style={{background:'#4db6ac', color:'var(--navy-950)', fontSize:'0.68rem', fontWeight:700, borderRadius: '2px'}}>
                    IPRS VERIFIED
                  </span>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'0.8rem'}}>
                  <div><strong>Full Name:</strong> {kycResult.full_name}</div>
                  <div><strong>National ID:</strong> {kycResult.id_number}</div>
                  <div><strong>KRA PIN:</strong> {kycResult.kra_pin}</div>
                  <div><strong>Date of Birth:</strong> {kycResult.dob}</div>
                  <div><strong>Gender:</strong> {kycResult.gender}</div>
                  <div><strong>Token:</strong> <code style={{fontSize:'0.68rem'}}>{kycResult.verification_token}</code></div>
                </div>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: FIRM OAUTH SINGLE SIGN-ON */}
        {activeTab === 'sso' && (
          <div style={{display:'flex', flexDirection:'column', gap:'14px', textAlign:'center', padding:'20px 10px'}}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm, 3px)', background: 'var(--navy-950)', border: '1px solid var(--gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <LockIcon size={24} color="var(--gold-400)" />
            </div>
            <h4 style={{margin:0, color:'var(--gold-400)', fontSize:'1.05rem'}}>
              Authenticate Law Firm Account with eCitizen OAuth 2.0
            </h4>
            <p style={{fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:'1.5', margin:0}}>
              Single Sign-On allows advocates and law firm partners to log into Legal OS using their verified eCitizen Advocate credentials, enabling direct integration with ArdhiSasya Land Searches, BRS Company Registrations, and KRA Tax Compliances.
            </p>

            <button
              onClick={handleLaunchSso}
              className="primary-btn"
              style={{padding:'10px 22px', fontSize:'0.86rem', fontWeight:700, margin:'10px auto 0 auto', borderRadius: 'var(--radius-sm, 3px)'}}
            >
              Sign In via eCitizen OAuth 2.0
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
