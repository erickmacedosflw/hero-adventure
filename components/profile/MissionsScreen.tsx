import React, { useEffect, useRef, useState } from 'react';
import type { Mission } from '../../types';

const BOOK_IMAGE_URL = new URL('../../game/assets/Icons/Missoes/Book_missoes.png', import.meta.url).href;
const BANNER_MISSIONS_URL = new URL('../../game/assets/Imagens/Banner_Missoes.png', import.meta.url).href;
const COIN_URL       = new URL('../../game/assets/Icons/Misc/Golden Coin.png', import.meta.url).href;
const GEM_URL        = new URL('../../game/assets/Icons/Ore & Gem/Emerald.png', import.meta.url).href;

// -- Keyframes ---------------------------------------------------------------
if (typeof document !== 'undefined') {
  let s = document.getElementById('missions-anim-style-v3') as HTMLStyleElement | null;
  if (!s) { s = document.createElement('style'); s.id = 'missions-anim-style-v3'; document.head.appendChild(s); }
  s.textContent = `
    @keyframes msn-claim-flash {
      0%   { opacity: 0; }
      30%  { opacity: 0.55; }
      100% { opacity: 0; }
    }
    @keyframes msn-coin-fly {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      80%  { opacity: 0.7; transform: translateY(-48px) scale(1.15); }
      100% { opacity: 0; transform: translateY(-72px) scale(0.8); }
    }
    @keyframes msn-badge-pop {
      0%   { opacity: 0; transform: scale(0.5); }
      65%  { opacity: 1; transform: scale(1.18); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes msn-btn-press {
      0%   { transform: scale(1); }
      40%  { transform: scale(0.94); }
      100% { transform: scale(1); }
    }
    @keyframes msn-reward-float {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-56px) scale(1.2); }
    }
  `;
}

// -- Helpers -----------------------------------------------------------------
const formatDesc = (template: string, meta: number): React.ReactNode => {
  const resolved = template.replace('{meta}', String(meta));
  const parts = resolved.split(/(\d+)/);
  if (parts.length === 1) return resolved;
  return (
    <>
      {parts.map((part, i) =>
        /^\d+$/.test(part)
          ? <span key={i} style={{ color: '#fbbf24', fontWeight: 900 }}>{part}</span>
          : part
      )}
    </>
  );
};

// -- Coin burst overlay ------------------------------------------------------
// -- Coin burst overlay ------------------------------------------------------
const CoinBurst: React.FC<{ reward: number }> = ({ reward }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20, borderRadius: 'inherit', overflow: 'hidden' }}>
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at 50% 80%, rgba(251,191,36,0.45) 0%, transparent 70%)',
      animation: 'msn-claim-flash 0.55s ease-out forwards',
    }} />
    <div style={{
      position: 'absolute', left: '50%', top: '25%',
      transform: 'translateX(-50%)',
      fontSize: 18, fontWeight: 900, color: '#fcd34d',
      textShadow: '0 0 12px rgba(251,191,36,0.90)',
      whiteSpace: 'nowrap',
      animation: 'msn-reward-float 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
    }}>
      +{reward} ✦
    </div>
    {[-16, 0, 16].map((x, i) => (
      <div key={i} style={{
        position: 'absolute', bottom: 12, left: `calc(50% + ${x}px)`,
        transform: 'translateX(-50%)',
        animation: `msn-coin-fly 0.65s cubic-bezier(0.22,1,0.36,1) ${i * 60}ms forwards`,
      }}>
        <img src={COIN_URL} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
      </div>
    ))}
  </div>
);

// -- Mission Card ------------------------------------------------------------
// -- Mission Card (horizontal strip) -----------------------------------------
const MissionCard: React.FC<{ mission: Mission; onClaim: () => void }> = ({ mission, onClaim }) => {
  const isFixed     = mission.metaIncrement === 0;
  const isComplete  = mission.progressoAtual >= mission.metaAtual;
  const progressPct = Math.min(100, (mission.progressoAtual / mission.metaAtual) * 100);

  const [claiming, setClaiming] = useState(false);
  const [levelPop, setLevelPop] = useState(false);
  const prevNivel = useRef(mission.nivelAtual);

  useEffect(() => {
    if (mission.nivelAtual !== prevNivel.current) {
      prevNivel.current = mission.nivelAtual;
      setLevelPop(true);
      const t = setTimeout(() => setLevelPop(false), 600);
      return () => clearTimeout(t);
    }
  }, [mission.nivelAtual]);

  const handleClaim = () => {
    if (!isComplete || claiming) return;
    setClaiming(true);
    setTimeout(() => { onClaim(); setClaiming(false); }, 480);
  };

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      border: isComplete
        ? '1.5px solid rgba(180,120,20,0.60)'
        : '1.5px solid rgba(255,255,255,0.08)',
      background: isComplete ? 'rgba(120,72,8,0.22)' : 'rgba(255,255,255,0.05)',
      display: 'flex', alignItems: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {claiming && <CoinBurst reward={mission.recompensaAtual} />}

      {/* Top accent line */}
      {isComplete && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #d97706, #fbbf24, #d97706, transparent)' }} />
      )}

      {/* LEFT — coin + reward */}
      <div style={{
        flexShrink: 0, width: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: '14px 0',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}>
        <img
          src={COIN_URL} alt=""
          style={{
            width: 28, height: 28, objectFit: 'contain',
            animation: levelPop ? 'msn-badge-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 900, color: '#fcd34d', lineHeight: 1 }}>
          {mission.recompensaAtual}
        </span>
      </div>

      {/* CENTER — title + progress */}
      <div style={{ flex: 1, minWidth: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isFixed ? (
            <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#fcd34d', opacity: 0.7 }}>∞ Recorrente</span>
          ) : (
            <span key={mission.nivelAtual} style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'rgba(253,230,138,0.65)' }}>
              Desafio {mission.nivelAtual}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1.4, margin: 0 }}>
          {formatDesc(mission.descricao, mission.metaAtual)}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, right: `${100 - progressPct}%`,
              borderRadius: 99,
              background: 'linear-gradient(90deg, #b45309, #d97706, #fbbf24)',
              boxShadow: progressPct > 0 ? '0 0 8px rgba(251,191,36,0.55)' : 'none',
              transition: 'right 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: isComplete ? '#fcd34d' : 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' as const }}>
            {mission.progressoAtual}/{mission.metaAtual}
          </span>
        </div>
      </div>

      {/* RIGHT — button */}
      <div style={{ flexShrink: 0, padding: '0 10px 0 0' }}>
        <button
          onClick={handleClaim}
          disabled={!isComplete || claiming}
          style={{
            borderRadius: 10, padding: '9px 14px',
            fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
            border: 'none',
            background: isComplete
              ? 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #fbbf24 100%)'
              : 'rgba(255,255,255,0.07)',
            color: isComplete ? '#fff' : 'rgba(255,255,255,0.28)',
            cursor: isComplete && !claiming ? 'pointer' : 'not-allowed',
            boxShadow: isComplete ? '0 4px 16px rgba(217,119,6,0.40)' : 'none',
            whiteSpace: 'nowrap' as const, minWidth: 82,
            animation: claiming ? 'msn-btn-press 0.25s ease forwards' : 'none',
          }}
        >
          {isComplete ? (claiming ? 'Resgatando…' : 'Resgatar') : 'Em Progresso'}
        </button>
      </div>
    </div>
  );
};

// -- Main component ----------------------------------------------------------
export type MissionsScreenProps = {
  missions: Mission[];
  onClose: () => void;
  isClosing?: boolean;
  onClaimReward: (missionId: string) => void;
};

export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  missions,
  onClose,
  isClosing = false,
  onClaimReward,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 10); return () => window.clearTimeout(t); }, []);

  const panelSlide = isClosing
    ? 'translate-y-full transition-transform duration-[220ms] ease-in'
    : mounted
      ? 'translate-y-0 transition-transform duration-[320ms] ease-out'
      : 'translate-y-full';

  const overlayFade = isClosing
    ? 'opacity-0 transition-opacity duration-[220ms]'
    : 'opacity-100';

  const completedCount = missions.filter(m => m.progressoAtual >= m.metaAtual).length;

  const sorted = [...missions].sort((a, b) => {
    const ac = a.progressoAtual >= a.metaAtual ? 0 : 1;
    const bc = b.progressoAtual >= b.metaAtual ? 0 : 1;
    return ac - bc;
  });

  return (
    <div
      className={`absolute inset-0 z-[80] flex items-end lg:items-center justify-center pointer-events-auto ${overlayFade}`}
      style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      {/* BOTTOM SHEET */}
      <div
        className={`relative w-full sm:max-w-2xl lg:w-[560px] lg:max-w-none flex flex-col border-t lg:border border-white/10 rounded-t-[24px] sm:rounded-t-[28px] lg:rounded-[24px] max-h-[65dvh] lg:max-h-[80dvh] ${panelSlide}`}
        style={{ background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── BANNER HEADER ── */}
        <div className="relative shrink-0 rounded-t-[24px] sm:rounded-t-[28px] overflow-hidden" style={{ height: 148 }}>
          {/* BG image */}
          <div className="absolute inset-0"
            style={{ backgroundImage: `url(${BANNER_MISSIONS_URL})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          {/* Dark overlay */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(4,4,14,0.45) 0%, rgba(4,4,14,0.72) 100%)' }} />
          {/* Bottom fade to panel */}
          <div className="absolute bottom-0 inset-x-0 h-16"
            style={{ background: 'linear-gradient(0deg, rgba(8,8,18,0.82) 0%, transparent 100%)' }} />
          {/* Drag handle pill — mobile only */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/25 lg:hidden" />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 hover:bg-black/70 active:scale-90 transition-all"
          >
            <span className="text-xs font-black leading-none">✕</span>
          </button>
          {/* Title row — bottom-left */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <img src={BOOK_IMAGE_URL} alt="" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }} />
            <span className="text-sm font-black uppercase tracking-[0.18em] text-white drop-shadow-md">Missões</span>
            {completedCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                style={{ background: 'linear-gradient(135deg,#b45309,#fbbf24)', boxShadow: '0 0 8px rgba(251,191,36,0.5)' }}
              >
                {completedCount} pronta{completedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Mission list */}
        <div
          className="flex flex-col gap-2.5 overflow-y-auto px-3 pb-4 shop-scroll"
          data-scrollable
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        >
          {sorted.map(m => (
            <MissionCard key={m.id} mission={m} onClaim={() => onClaimReward(m.id)} />
          ))}
        </div>

        {/* Safe area — mobile only */}
        <div className="safe-bottom shrink-0 lg:hidden" />
      </div>
    </div>
  );
};

export default MissionsScreen;
