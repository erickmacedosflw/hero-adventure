import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Mission } from '../../types';

const BOOK_IMAGE_URL = new URL('../../game/assets/Icons/Missoes/Book_missoes.png', import.meta.url).href;
const COIN_URL       = new URL('../../game/assets/Icons/Misc/Golden Coin.png', import.meta.url).href;

// -- Inject keyframes --------------------------------------------------------
if (typeof document !== 'undefined') {
  let s = document.getElementById('missions-anim-style-v2') as HTMLStyleElement | null;
  if (!s) { s = document.createElement('style'); s.id = 'missions-anim-style-v2'; document.head.appendChild(s); }
  s.textContent = `
    @keyframes missions-book-appear {
      0%   { opacity: 0; transform: translateX(-50%) translateY(40px) scale(0.88); }
      60%  { opacity: 1; transform: translateX(-50%) translateY(-6px) scale(1.02); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
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
          ? <span key={i} style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.08em', letterSpacing: '-0.01em' }}>{part}</span>
          : part
      )}
    </>
  );
};

// -- Coin burst overlay ------------------------------------------------------
const CoinBurst: React.FC<{ reward: number }> = ({ reward }) => {
  const coins = [
    { x: -18, delay: 0 },
    { x: 0,   delay: 60 },
    { x: 18,  delay: 120 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {/* Flash overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 20,
        background: 'radial-gradient(ellipse at 50% 80%, rgba(251,191,36,0.55) 0%, transparent 70%)',
        animation: 'msn-claim-flash 0.55s ease-out forwards',
      }} />
      {/* Floating reward number */}
      <div style={{
        position: 'absolute', left: '50%', bottom: '56px',
        transform: 'translateX(-50%)',
        fontSize: 20, fontWeight: 900, color: '#fcd34d',
        textShadow: '0 0 12px rgba(251,191,36,0.90)',
        whiteSpace: 'nowrap',
        animation: 'msn-reward-float 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        fontFamily: "'Segoe UI',system-ui,sans-serif",
      }}>
        +{reward} ✦
      </div>
      {/* Flying coins */}
      {coins.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 52, left: `calc(50% + ${c.x}px)`,
          transform: 'translateX(-50%)',
          animation: `msn-coin-fly 0.65s cubic-bezier(0.22,1,0.36,1) ${c.delay}ms forwards`,
        }}>
          <img src={COIN_URL} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
        </div>
      ))}
    </div>
  );
};

// -- Mission Card ------------------------------------------------------------
const MissionCard: React.FC<{ mission: Mission; onClaim: () => void }> = ({ mission, onClaim }) => {
  const isFixed    = mission.metaIncrement === 0;
  const isComplete = mission.progressoAtual >= mission.metaAtual;
  const progressPct = Math.min(100, (mission.progressoAtual / mission.metaAtual) * 100);

  const [hovered,  setHovered]  = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [levelPop, setLevelPop] = useState(false);
  const prevNivel = useRef(mission.nivelAtual);

  // Detect level-up from parent re-render → trigger badge pop
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
    // After flash animation, call real claim
    setTimeout(() => {
      onClaim();
      setClaiming(false);
    }, 480);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 20,
        border: isComplete
          ? '1.5px solid rgba(180,120,20,0.70)'
          : isFixed
            ? '1.5px solid rgba(139,90,43,0.60)'
            : '1.5px solid rgba(100,65,30,0.55)',
        background: isComplete
          ? 'linear-gradient(160deg, rgba(120,72,8,0.22) 0%, rgba(10,6,0,0.80) 100%)'
          : 'linear-gradient(160deg, rgba(60,38,18,0.30) 0%, rgba(8,5,2,0.82) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box' as const,
        overflow: 'hidden',
        position: 'relative',
        // Hover lift + glow
        transform: hovered ? 'translateY(-4px) scale(1.015)' : 'translateY(0) scale(1)',
        transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease',
        boxShadow: hovered
          ? (isComplete
            ? '0 16px 40px rgba(217,119,6,0.35), 0 0 0 1.5px rgba(251,191,36,0.50), inset 0 1px 0 rgba(255,220,100,0.15)'
            : '0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(180,120,60,0.25)')
          : (isComplete
            ? '0 8px 32px rgba(180,120,8,0.20), inset 0 1px 0 rgba(255,220,100,0.10)'
            : '0 4px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(180,120,60,0.08)'),
      }}
    >
      {/* Claim burst overlay */}
      {claiming && <CoinBurst reward={mission.recompensaAtual} />}

      {/* Card top accent bar */}
      <div style={{
        height: 3,
        background: isComplete
          ? 'linear-gradient(90deg, #92400e, #d97706, #fbbf24, #d97706, #92400e)'
          : isFixed
            ? 'linear-gradient(90deg, rgba(180,100,30,0.70), rgba(120,65,18,0.30))'
            : 'linear-gradient(90deg, rgba(120,72,30,0.55), rgba(80,45,15,0.20))',
        flexShrink: 0,
      }} />

      <div style={{ padding: '8px 11px 10px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>

        {/* Top row: badge + reward */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {isFixed ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              borderRadius: 99, border: '1px solid rgba(251,191,36,0.40)',
              background: 'rgba(251,191,36,0.12)',
              padding: '2px 7px',
              fontSize: 8, fontWeight: 900, textTransform: 'uppercase' as const,
              letterSpacing: '0.14em', color: '#fcd34d', lineHeight: 1.4,
            }}>
              ∞ Recorrente
            </span>
          ) : (
            <span
              key={mission.nivelAtual}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                borderRadius: 99, border: '1px solid rgba(253,230,138,0.35)',
                background: 'rgba(253,230,138,0.10)',
                padding: '2px 7px',
                fontSize: 8, fontWeight: 900, textTransform: 'uppercase' as const,
                letterSpacing: '0.14em', color: 'rgba(253,230,138,0.70)', lineHeight: 1.4,
                animation: levelPop ? 'msn-badge-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
              }}>
              Desafio <span style={{ fontSize: 9, color: '#fde68a', fontWeight: 900, letterSpacing: 0 }}>{mission.nivelAtual}</span>
            </span>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <img src={COIN_URL} alt="" style={{ width: 18, height: 18, objectFit: 'contain', filter: 'drop-shadow(0.5px 0 0 #fff) drop-shadow(-0.5px 0 0 #fff) drop-shadow(0 0.5px 0 #fff) drop-shadow(0 -0.5px 0 #fff)' }} />
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fcd34d', letterSpacing: '-0.01em' }}>{mission.recompensaAtual}</span>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.5, margin: 0, flex: 1 }}>
          {formatDesc(mission.descricao, mission.metaAtual)}
        </p>

        {/* Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.20em', color: 'rgba(255,255,255,0.30)' }}>
              Progresso
            </span>
            <span style={{ fontSize: 11, fontWeight: 900, color: isComplete ? '#fcd34d' : 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
              {mission.progressoAtual}<span style={{ opacity: 0.5 }}>/{mission.metaAtual}</span>
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, right: `${100 - progressPct}%`,
              borderRadius: 99,
              background: 'linear-gradient(90deg, #b45309, #d97706, #fbbf24)',
              boxShadow: progressPct > 0 ? '0 0 10px rgba(251,191,36,0.55)' : 'none',
              transition: 'right 0.5s ease',
            }} />
          </div>
        </div>

        {/* Claim button */}
        <button
          onClick={handleClaim}
          disabled={!isComplete || claiming}
          style={{
            width: '100%', borderRadius: 12,
            padding: '8px 0',
            fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
            border: 'none',
            background: isComplete
              ? 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #fbbf24 100%)'
              : 'rgba(255,255,255,0.06)',
            color: isComplete ? '#fff' : 'rgba(255,255,255,0.22)',
            cursor: isComplete && !claiming ? 'pointer' : 'not-allowed',
            boxShadow: isComplete ? '0 6px 22px rgba(217,119,6,0.40), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
            transition: 'all 0.2s, transform 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            animation: claiming ? 'msn-btn-press 0.25s ease forwards' : 'none',
            // Hover effect on button
            ...(hovered && isComplete && !claiming ? { filter: 'brightness(1.12)' } : {}),
          }}
        >
          {isComplete ? (
            <>
              <img src={COIN_URL} alt="" style={{ width: 15, height: 15, objectFit: 'contain', filter: 'drop-shadow(0.5px 0 0 #fff) drop-shadow(-0.5px 0 0 #fff) drop-shadow(0 0.5px 0 #fff) drop-shadow(0 -0.5px 0 #fff)' }} />
              {claiming ? 'Resgatando...' : `Resgatar ${mission.recompensaAtual}`}
            </>
          ) : 'Em progresso'}
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 10); return () => window.clearTimeout(t); }, []);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const panelSlide = isClosing
    ? 'translate-y-full transition-transform duration-[220ms] ease-in'
    : mounted
      ? 'translate-y-0 transition-transform duration-[320ms] ease-out'
      : 'translate-y-full';

  const overlayFade = isClosing ? 'opacity-0 transition-opacity duration-[220ms]' : 'opacity-100';
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };

  const completedCount = missions.filter(m => m.progressoAtual >= m.metaAtual).length;

  const sortedMissions = missions;

  return (
    <div className={`absolute inset-0 z-[80] flex flex-col overflow-hidden pointer-events-auto backdrop-blur-md ${overlayFade}`}>

      {/* Top click-to-close area with book image — oculto no mobile */}
      {!isMobile && (
        <div
          className="relative flex-1 min-h-0 flex items-start justify-end p-4 cursor-pointer bg-black/30"
          onClick={onClose}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/50 backdrop-blur-sm px-3 py-2 text-xs font-black uppercase tracking-widest text-white/70 hover:bg-black/70 hover:text-white transition-all active:scale-95"
            style={font}
          >
            <ArrowLeft size={14} /> Fechar
          </button>

          <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 w-[260px] md:w-[310px] h-[36vh] md:h-[40vh] max-h-[260px] md:max-h-[290px] pointer-events-none select-none">
            <img
              src={BOOK_IMAGE_URL}
              alt=""
              className="absolute bottom-0 left-1/2 h-full w-auto object-contain object-bottom"
              style={{
                transform: 'translateX(-50%)',
                filter:
                  'drop-shadow(0 2px 8px rgba(0,0,0,0.95)) ' +
                  'drop-shadow(0 8px 28px rgba(0,0,0,0.80)) ' +
                  'drop-shadow(0 18px 56px rgba(0,0,0,0.55))',
                animation: mounted ? 'none' : 'missions-book-appear 0.38s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom panel — dark glass */}
      <div
        className={`flex flex-col bg-black/75 backdrop-blur-xl border-t border-white/8 ${isMobile ? 'flex-1' : `shrink-0 ${panelSlide}`}`}
        style={{ ...(isMobile ? {} : { maxHeight: '72vh', minHeight: 320 }), ...font }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(234,179,8,0.15)', border: '1.5px solid rgba(234,179,8,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={BOOK_IMAGE_URL} alt="" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0.5px 0 0 #fff) drop-shadow(-0.5px 0 0 #fff) drop-shadow(0 0.5px 0 #fff) drop-shadow(0 -0.5px 0 #fff)' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Diário de Missões</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {completedCount > 0
                ? `${completedCount} missão${completedCount > 1 ? 'ões' : ''} pronta${completedCount > 1 ? 's' : ''} para resgatar`
                : 'Complete missões de caça e ganhe ouro'}
            </div>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/60 active:scale-95"
              style={font}
            >
              <ArrowLeft size={13} /> Fechar
            </button>
          )}
        </div>

        {/* Mission cards — horizontal (desktop) ou lista vertical (mobile) */}
        {isMobile ? (
          <div
            style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0, padding: '12px 14px 24px', display: 'flex', flexDirection: 'column', gap: 10, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          >
            {sortedMissions.map(m => (
              <div key={m.id} style={{ width: '100%', flexShrink: 0 }}>
                <MissionCard mission={m} onClaim={() => onClaimReward(m.id)} />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{ overflowX: 'auto', overflowY: 'hidden', flex: 1, minHeight: 0, padding: '14px 14px 18px', display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'stretch', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehaviorX: 'contain' as any }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {sortedMissions.map(m => (
              <div key={m.id} style={{ scrollSnapAlign: 'start', flexShrink: 0, width: 180 }}>
                <MissionCard mission={m} onClaim={() => onClaimReward(m.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionsScreen;
