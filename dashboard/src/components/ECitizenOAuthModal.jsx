// ECitizenOAuthModal.jsx — eCitizen Single Sign-On & Instant Client KYC Verification Modal
import React, { useState } from 'react';
import { apiPost, apiGet } from '../api';

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
      showToast('⚠️ Please enter at least a National ID, KRA PIN, or Business Reg No.', 'error');
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
        showToast('🟢 eCitizen KYC Identity Verification Successful!', 'success');
        if (onKycVerified) onKycVerified(data.kyc);
      } else {
        throw new Error(data?.error || 'Verification failed');
      }
    } catch (err) {
      showToast(`⚠️ KYC Error: ${err.message}`, 'error');
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
        showToast('🔑 Launched eCitizen Single Sign-On Gateway.', 'info');
      }
    } catch (err) {
      showToast(`⚠️ SSO Error: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:9999, backdropFilter:'blur(4px)', padding:'20px'
    }}>
      <div style={{
        background:'var(--navy-900)', border:'1px solid var(--gold-500)', borderRadius:'12px',
        width:'100%', maxWidth:'640px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 50px rgba(0,0,0,0.8)',
        padding:'24px 28px', color:'white'
      }}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-default)', paddingBottom:'14px', marginBottom:'20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <span style={{fontSize:'1.8rem'}}>🇰🇪</span>
            <div>
              <h3 style={{margin:0, color:'var(--gold-400)', fontSize:'1.15rem'}}>
                eCitizen OAuth 2.0 & Instant IPRS KYC Gateway
              </h3>
              <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'2px'}}>
                Official Identity, KRA PIN & Business Registration Verification for Law Firms
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.4rem', cursor:'pointer'}}>✕</button>
        </div>

        {/* Tab Switcher */}
        <div style={{display:'flex', gap:'10px', marginBottom:'20px', borderBottom:'1px solid var(--border-default)', paddingBottom:'10px'}}>
          <button
            onClick={() => setActiveTab('kyc')}
            style={{
              background: activeTab === 'kyc' ? 'var(--gold-500)' : 'var(--navy-800)',
              color: activeTab === 'kyc' ? 'var(--navy-950)' : 'white',
              border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            🔍 Instant Client KYC Lookup
          </button>
          <button
            onClick={() => setActiveTab('sso')}
            style={{
              background: activeTab === 'sso' ? 'var(--gold-500)' : 'var(--navy-800)',
              color: activeTab === 'sso' ? 'var(--navy-950)' : 'white',
              border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            🔑 Firm eCitizen OAuth Single Sign-On
          </button>
        </div>

        {/* TAB 1: INSTANT CLIENT KYC LOOKUP */}
        {activeTab === 'kyc' && (
          <form onSubmit={handleVerifyKyc} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <div style={{fontSize:'0.82rem', color:'var(--text-secondary)'}}>
              Verify client National ID, KRA PIN, or Business CR12 details against the official eCitizen IPRS database prior to matter registration.
            </div>

            <div>
              <label style={{fontSize:'0.78rem', color:'var(--gold-400)', fontWeight:700}}>Client National ID / Passport Number:</label>
              <input
                type="text"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                placeholder="e.g. 34892019"
                style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
              />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              <div>
                <label style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>Client KRA PIN:</label>
                <input
                  type="text"
                  value={kraPin}
                  onChange={e => setKraPin(e.target.value)}
                  placeholder="e.g. A019283749B"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
                />
              </div>
              <div>
                <label style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>Company Reg / CR12 No:</label>
                <input
                  type="text"
                  value={businessReg}
                  onChange={e => setBusinessReg(e.target.value)}
                  placeholder="e.g. CPR/2026/88912"
                  style={{width:'100%', background:'var(--navy-950)', border:'1px solid var(--border-default)', color:'white', padding:'10px', borderRadius:'6px', fontSize:'0.88rem', marginTop:'4px'}}
                />
              </div>
            </div>

            <button
              type="submit"
              className="primary-btn"
              style={{padding:'12px', fontWeight:700, width:'100%', marginTop:'6px'}}
              disabled={verifying}
            >
              {verifying ? 'Verifying with eCitizen IPRS Gateway...' : '🟢 Run Instant eCitizen KYC Verification'}
            </button>

            {/* Verification Result Card */}
            {kycResult && (
              <div style={{
                background: 'rgba(77,182,172,0.12)',
                border: '1px solid rgba(77,182,172,0.5)',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '10px'
              }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <span style={{fontWeight:700, color:'#4db6ac', fontSize:'0.95rem'}}>
                    ✅ {kycResult.status_desc || 'Verified Citizen Identity'}
                  </span>
                  <span className="badge" style={{background:'#4db6ac', color:'black', fontSize:'0.7rem', fontWeight:800}}>
                    IPRS VERIFIED
                  </span>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'0.82rem'}}>
                  <div><strong>Full Name:</strong> {kycResult.full_name}</div>
                  <div><strong>National ID:</strong> {kycResult.id_number}</div>
                  <div><strong>KRA PIN:</strong> {kycResult.kra_pin}</div>
                  <div><strong>Date of Birth:</strong> {kycResult.dob}</div>
                  <div><strong>Gender:</strong> {kycResult.gender}</div>
                  <div><strong>Token:</strong> <code style={{fontSize:'0.7rem'}}>{kycResult.verification_token}</code></div>
                </div>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: FIRM OAUTH SINGLE SIGN-ON */}
        {activeTab === 'sso' && (
          <div style={{display:'flex', flexDirection:'column', gap:'16px', textAlign:'center', padding:'20px 10px'}}>
            <div style={{fontSize:'3rem'}}>🏛️</div>
            <h4 style={{margin:0, color:'var(--gold-400)', fontSize:'1.1rem'}}>
              Authenticate Law Firm Account with eCitizen OAuth 2.0
            </h4>
            <p style={{fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:'1.5', margin:0}}>
              Single Sign-On allows advocates and law firm partners to log into Legal OS using their verified eCitizen Advocate credentials, enabling direct integration with ArdhiSasya Land Searches, BRS Company Registrations, and KRA Tax Compliances.
            </p>

            <button
              onClick={handleLaunchSso}
              className="primary-btn"
              style={{padding:'12px 24px', fontSize:'0.9rem', fontWeight:700, margin:'10px auto 0 auto'}}
            >
              🔑 Log In with eCitizen OAuth 2.0
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
