import React, { useState, useEffect } from 'react';
import emblemPng from '../assets/splash_emblem.png';
import legalOsPng from '../assets/splash_legal_os.png';

export default function SplashScreen({ onFinish }) {
  // Stage 1: 'emblem' (0 - 2.5s)
  // Stage 2: 'legalos' (2.5 - 5.0s)
  // Stage 3: 'exit' (smooth fade out)
  const [stage, setStage] = useState('emblem');

  useEffect(() => {
    // Stage 1 -> Stage 2 transition after 2.5s
    const stageTimer = setTimeout(() => {
      setStage('legalos');
    }, 2500);

    // Finish splash screen after 5.0s
    const finishTimer = setTimeout(() => {
      setStage('exit');
      setTimeout(() => {
        if (onFinish) onFinish();
      }, 600);
    }, 5000);

    return () => {
      clearTimeout(stageTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000000', // Pure pitch dark
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s ease',
      opacity: stage === 'exit' ? 0 : 1,
      transform: stage === 'exit' ? 'scale(1.05)' : 'scale(1)',
      pointerEvents: stage === 'exit' ? 'none' : 'all',
      userSelect: 'none'
    }}>

      {/* Subtle Breathing Ambient Glow */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: stage === 'emblem'
          ? 'radial-gradient(circle, rgba(77, 182, 172, 0.20) 0%, rgba(0, 0, 0, 0) 70%)'
          : 'radial-gradient(circle, rgba(201, 168, 76, 0.20) 0%, rgba(0, 0, 0, 0) 70%)',
        filter: 'blur(50px)',
        transition: 'background 1.2s ease',
        pointerEvents: 'none'
      }} />

      {/* ════════ STAGE 1: THE EMBLEM ONLY (TRANSPARENT) ════════ */}
      {stage === 'emblem' && (
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'cinematicFade 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <img 
            src={emblemPng} 
            alt="Legal Emblem"
            style={{
              maxWidth: '240px',
              maxHeight: '240px',
              width: '55vw',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 35px rgba(77, 182, 172, 0.45)) drop-shadow(0 15px 40px rgba(0,0,0,0.9))'
            }}
          />
        </div>
      )}

      {/* ════════ STAGE 2: LEGAL OS TYPOGRAPHY ONLY (TRANSPARENT) ════════ */}
      {(stage === 'legalos' || stage === 'exit') && (
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'cinematicFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <img 
            src={legalOsPng} 
            alt="Legal OS"
            style={{
              maxWidth: '340px',
              maxHeight: '160px',
              width: '75vw',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 30px rgba(201, 168, 76, 0.4)) drop-shadow(0 10px 30px rgba(0,0,0,0.8))'
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes cinematicFade {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
