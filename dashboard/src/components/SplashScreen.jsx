import React, { useState, useEffect } from 'react';
import emblemImg from '../assets/splash_emblem.jpg';
import legalOsImg from '../assets/splash_legal_os.png';

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

      {/* ════════ STAGE 1: THE EMBLEM ONLY (SEAMLESS PURE BLACK) ════════ */}
      {stage === 'emblem' && (
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'cinematicFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <img 
            src={emblemImg} 
            alt="Emblem"
            style={{
              maxWidth: '280px',
              maxHeight: '280px',
              width: '60vw',
              height: 'auto',
              objectFit: 'contain',
              background: '#000000',
              border: 'none',
              outline: 'none',
              boxShadow: 'none'
            }}
          />
        </div>
      )}

      {/* ════════ STAGE 2: LEGAL OS TYPOGRAPHY ONLY (SEAMLESS PURE BLACK) ════════ */}
      {(stage === 'legalos' || stage === 'exit') && (
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'cinematicFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <img 
            src={legalOsImg} 
            alt="Legal OS"
            style={{
              maxWidth: '340px',
              maxHeight: '180px',
              width: '75vw',
              height: 'auto',
              objectFit: 'contain',
              background: '#000000',
              border: 'none',
              outline: 'none',
              boxShadow: 'none'
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes cinematicFade {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
