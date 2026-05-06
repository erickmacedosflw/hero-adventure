/**
 * MissionToast — push notification shown when a mission is completed.
 * Appears at the top of the screen, lasts 4s, click opens missions modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Mission } from '../../types';

const BOOK_URL = new URL('../../game/assets/Icons/Missoes/Book_missoes.png', import.meta.url).href;
const COIN_URL = new URL('../../game/assets/Icons/Misc/Golden Coin.png', import.meta.url).href;

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('mission-toast-style')) {
  const s = document.createElement('style');
  s.id = 'mission-toast-style';
  s.textContent = `
    @keyframes mission-toast-in {
      0%   { opacity: 0; transform: translateY(-32px) scale(0.92); }
      60%  { opacity: 1; transform: translateY(4px) scale(1.02); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes mission-toast-out {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-24px) scale(0.94); }
    }
  `;
  document.head.appendChild(s);
}

export interface MissionToastItem {
  id: string;          // mission id
  title: string;       // mission descricao (formatted)
  reward: number;      // recompensaAtual
}

interface Props {
  toast: MissionToastItem | null;
  onOpen: () => void;  // opens missions modal
}

const DURATION = 4000; // ms

export const MissionToast: React.FC<Props> = ({ toast, onOpen }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [current, setCurrent] = useState<MissionToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;

    // Clear any running timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (leaveRef.current) clearTimeout(leaveRef.current);

    setCurrent(toast);
    setLeaving(false);
    setVisible(true);

    timerRef.current = setTimeout(() => {
      setLeaving(true);
      leaveRef.current = setTimeout(() => {
        setVisible(false);
        setCurrent(null);
      }, 350);
    }, DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (leaveRef.current) clearTimeout(leaveRef.current);
    };
  }, [toast]);

  if (!visible || !current) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(14px, env(safe-area-inset-top, 14px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(90vw, 360px)',
        animation: leaving
          ? 'mission-toast-out 0.35s cubic-bezier(0.4,0,1,1) forwards'
          : 'mission-toast-in 0.42s cubic-bezier(0.22,1,0.36,1) forwards',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => {
        // Stop timers and close, then open modal
        if (timerRef.current) clearTimeout(timerRef.current);
        if (leaveRef.current) clearTimeout(leaveRef.current);
        setLeaving(true);
        leaveRef.current = setTimeout(() => { setVisible(false); setCurrent(null); }, 350);
        onOpen();
      }}
    >
      <div
        style={{
          borderRadius: 18,
          border: '1.5px solid rgba(251,191,36,0.35)',
          background: 'rgba(10,7,2,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(251,191,36,0.10), 0 4px 16px rgba(180,83,9,0.25)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: "'Segoe UI',system-ui,sans-serif",
        }}
      >
        {/* Book icon with white border glow */}
        <div
          style={{
            width: 48, height: 48, flexShrink: 0, borderRadius: 12,
            border: '2px solid #ffffff',
            background: 'rgba(234,179,8,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img src={BOOK_URL} alt="" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0.5px 0 0 #fff) drop-shadow(-0.5px 0 0 #fff) drop-shadow(0 0.5px 0 #fff) drop-shadow(0 -0.5px 0 #fff)' }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.20em', color: '#fbbf24', marginBottom: 3 }}>
            Missão Concluída!
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.90)', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
            {current.title}
          </div>
        </div>

        {/* Reward pill */}
        <div
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            borderRadius: 99, border: '1.5px solid rgba(251,191,36,0.50)',
            background: 'rgba(180,83,9,0.20)',
            padding: '6px 10px',
          }}
        >
          <img src={COIN_URL} alt="" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'drop-shadow(0.5px 0 0 #fff) drop-shadow(-0.5px 0 0 #fff) drop-shadow(0 0.5px 0 #fff) drop-shadow(0 -0.5px 0 #fff)' }} />
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fcd34d' }}>{current.reward}</span>
        </div>
      </div>

      {/* Progress bar — drains over DURATION */}
      <ProgressDrain duration={DURATION} leaving={leaving} />
    </div>
  );
};

// Thin amber bar draining from right to left under the toast
const ProgressDrain: React.FC<{ duration: number; leaving: boolean }> = ({ duration, leaving }) => {
  const [pct, setPct] = useState(100);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setPct(remaining);
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [duration]);

  return (
    <div style={{ height: 3, borderRadius: '0 0 18px 18px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: -1 }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'linear-gradient(90deg,#b45309,#fbbf24)',
        transition: 'none',
        borderRadius: '0 0 0 18px',
        opacity: leaving ? 0 : 1,
      }} />
    </div>
  );
};
