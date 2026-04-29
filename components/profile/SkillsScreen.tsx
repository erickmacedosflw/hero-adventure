import React, { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Zap, Sword, Heart } from 'lucide-react';
import { Player, Skill } from '../../types';
import { getClassSlots } from '../../constants';

const BOOK_IMAGE_URL = new URL('../../game/assets/Icons/Habilidades/Book_habilidades.png', import.meta.url).href;
const BOOK_ICON_URL = new URL('../../game/assets/Icons/Misc/Book 3.png', import.meta.url).href;

// -- Inject keyframes once ----------------------------------------------------

if (typeof document !== 'undefined' && !document.getElementById('skills-anim-style')) {
  const s = document.createElement('style');
  s.id = 'skills-anim-style';
  s.textContent = `
    @keyframes book-appear {
      0%   { opacity: 0; transform: translateX(-50%) translateY(40px) scale(0.88); }
      60%  { opacity: 1; transform: translateX(-50%) translateY(-6px) scale(1.02); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(s);
}

// -- Helpers ------------------------------------------------------------------

const getSkillTypeMeta = (type: Skill['type']) => {
  if (type === 'physical') return { label: 'F�sico', color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', icon: <Sword size={10} /> };
  if (type === 'magic')    return { label: 'Magia',  color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)', border: 'rgba(196,181,253,0.35)', icon: <Sparkles size={10} /> };
  return                          { label: 'Cura',   color: '#86efac', bg: 'rgba(134,239,172,0.15)', border: 'rgba(134,239,172,0.35)', icon: <Heart size={10} /> };
};

// -- Skill Card -------------------------------------------------------------

const SkillCard: React.FC<{
  skill: Skill;
  isEquipped: boolean;
  slotIndex: number | null;
  isPicking: boolean;
  isTargetSlot: boolean;
  canEquip: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  onEquip?: () => void;
}> = ({ skill, isEquipped, slotIndex, isPicking, isTargetSlot, canEquip, onClick, onRemove, onEquip }) => {
  const typeMeta = getSkillTypeMeta(skill.type);
  const accent = typeMeta.color;
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };

  const Tag = isPicking ? 'button' : 'div';

  const showEquipBtn  = !isPicking && !isEquipped && canEquip && !!onEquip;
  const showDesequipBtn = !isPicking && isEquipped && !!onRemove;

  return (
    <Tag
      {...(isPicking ? { onClick } : {})}
      style={{
        ...font,
        width: '138px',
        flexShrink: 0,
        borderRadius: '14px',
        border: isTargetSlot
          ? `2px solid ${accent}cc`
          : isEquipped
            ? `1.5px solid ${accent}99`
            : `1.5px solid ${accent}33`,
        background: isTargetSlot
          ? `${accent}28`
          : isEquipped
            ? `${accent}18`
            : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '10px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        position: 'relative',
        cursor: isPicking ? 'pointer' : 'default',
        boxShadow: isTargetSlot ? `0 0 18px ${accent}44` : isEquipped ? `0 0 10px ${accent}22` : 'none',
        transition: 'border 0.15s, background 0.15s, box-shadow 0.15s',
        textAlign: 'center' as const,
      } as React.CSSProperties}
    >
      {/* Slot badge — top left */}
      {isEquipped && slotIndex !== null && (
        <div style={{
          position: 'absolute', top: '5px', left: '6px',
          fontSize: '6px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '2px 5px', borderRadius: '99px',
          background: `${accent}30`,
          border: `1px solid ${accent}55`,
          color: accent,
        }}>S{slotIndex + 1}</div>
      )}

      {/* Icon — sem caixa, ícone puro com borda branca */}
      <div style={{
        width: '46px', height: '46px', marginTop: isEquipped ? '10px' : '2px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
        flexShrink: 0,
        filter: 'drop-shadow(0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(-0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(0 0.5px 0 rgba(255,255,255,0.7)) drop-shadow(0 -0.5px 0 rgba(255,255,255,0.7))',
      }}>
        {React.cloneElement(typeMeta.icon as React.ReactElement, { size: 28 })}
      </div>

      {/* Name */}
      <div style={{ fontSize: '10px', fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', width: '100%' }}>
        {skill.name}
      </div>

      {/* Type label (colored) + MP badge (mana blue) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
        <span style={{ fontSize: '8px', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', background: typeMeta.bg, border: `1px solid ${typeMeta.border}`, color: accent, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          {typeMeta.icon}{typeMeta.label}
        </span>
        <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', background: 'rgba(56,189,248,0.16)', border: '1px solid rgba(56,189,248,0.40)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <Zap size={9} />{skill.manaCost} MP
        </span>
      </div>

      {/* Description excerpt */}
      {skill.description && (
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', width: '100%' }}>
          {skill.description}
        </div>
      )}

      {/* Action button — Equipar or Desequipar */}
      {showEquipBtn && (
        <button
          onClick={(e) => { e.stopPropagation(); onEquip!(); }}
          className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-300 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          style={font}
        >
          <Sparkles size={10} /> Equipar
        </button>
      )}
      {showDesequipBtn && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove!(); }}
          className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-amber-300 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          style={font}
        >
          Desequipar
        </button>
      )}
    </Tag>
  );
};

// -- Main Export ---------------------------------------------------------------

export type SkillsScreenProps = {
  player: Player;
  onClose: () => void;
  isClosing?: boolean;
  targetSlotIndex?: number | null;
  onEquipSkillToSlot?: (slotIndex: number, skillId: string | null) => void;
};

export const SkillsScreen: React.FC<SkillsScreenProps> = ({ player, onClose, isClosing = false, targetSlotIndex = null, onEquipSkillToSlot }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 20); return () => window.clearTimeout(t); }, []);

  const skills = player.skills ?? [];
  const equippedIds: string[] = player.equippedSkillIds ?? [];
  const maxSkillSlots = getClassSlots(player.classId).skills;
  const paddedIds = [...equippedIds];
  while (paddedIds.length < maxSkillSlots) paddedIds.push('');

  const getSkillSlotIndex = (skillId: string): number | null => {
    const idx = paddedIds.findIndex(id => id === skillId);
    return idx !== -1 ? idx : null;
  };

  const slotsFilledCount = paddedIds.filter(id => !!id).length;
  const isPicking = targetSlotIndex !== null;
  const hasEmptySlot = paddedIds.some(id => !id);

  const handleEquipSkill = (skill: Skill) => {
    if (!onEquipSkillToSlot) return;
    const firstEmpty = paddedIds.findIndex(id => !id);
    if (firstEmpty === -1) return;
    onEquipSkillToSlot(firstEmpty, skill.id);
  };

  const handleSkillClick = (skill: Skill) => {
    if (!isPicking || targetSlotIndex === null || !onEquipSkillToSlot) return;
    const currentInSlot = paddedIds[targetSlotIndex];
    if (currentInSlot === skill.id) {
      // tap same skill already in target slot ? remove it
      onEquipSkillToSlot(targetSlotIndex, null);
    } else {
      onEquipSkillToSlot(targetSlotIndex, skill.id);
    }
    onClose();
  };

  // Panel slide animation
  const panelSlide = isClosing
    ? 'translate-y-full transition-transform duration-[220ms] ease-in'
    : mounted
      ? 'translate-y-0 transition-transform duration-[320ms] ease-out'
      : 'translate-y-full';

  const overlayFade = isClosing ? 'opacity-0 transition-opacity duration-[220ms]' : 'opacity-100';
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };

  return (
    <div className={`absolute inset-0 z-[80] flex flex-col overflow-hidden pointer-events-auto backdrop-blur-md ${overlayFade}`}>

      {/* TOP AREA � click to close, book image */}
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

        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[210px] md:w-[250px] h-[30vh] md:h-[34vh] max-h-[210px] md:max-h-[240px] pointer-events-none select-none">
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
              animation: mounted ? 'none' : 'book-appear 0.38s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </div>
      </div>

      {/* BOTTOM PANEL */}
      <div className={`shrink-0 flex flex-col bg-black/75 backdrop-blur-xl border-t border-white/8 ${panelSlide}`} style={font}>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <img src={BOOK_ICON_URL} alt="" className="h-[20px] w-auto object-contain" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }} />
          <span className="text-sm font-black uppercase tracking-[0.18em] text-white">Habilidades</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/50">
            {slotsFilledCount}/3 ativas
          </span>
          <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/35">
            {skills.length} aprendidas
          </span>
        </div>

        {/* Picking banner */}
        {isPicking && (
          <div className="px-4 pb-1">
            <div className="flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-900/40 px-3 py-2" style={font}>
              <Sparkles size={12} className="text-violet-300 shrink-0" />
              <span className="text-[10px] font-black text-violet-200 flex-1">Escolhendo para Slot {(targetSlotIndex ?? 0) + 1} — toque numa habilidade</span>
              {paddedIds[targetSlotIndex!] && onEquipSkillToSlot && (
                <button
                  onClick={() => { onEquipSkillToSlot(targetSlotIndex!, null); onClose(); }}
                  className="flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-900/50 px-2 py-1 active:scale-95 transition-all"
                  style={{ fontSize: '9px', fontWeight: 900, color: '#fca5a5', cursor: 'pointer' }}
                >
                  × Remover
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hint (display-only mode) */}
        {!isPicking && (
          <div className="px-4 pb-1">
            <p className="text-[9px] text-white/30 font-medium" style={font}>
              Toque num slot no painel 3D do her�i para equipar.
            </p>
          </div>
        )}

        {/* Horizontal scroll of skill cards */}
        {skills.length > 0 ? (
          <div className="flex items-start gap-3 overflow-x-auto px-4 pb-4 no-scrollbar min-h-[180px]">
            {skills.map((skill) => {
              const slotIdx = getSkillSlotIndex(skill.id);
              const isTargetSlot = isPicking && targetSlotIndex !== null && slotIdx === targetSlotIndex;
              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isEquipped={slotIdx !== null}
                  slotIndex={slotIdx}
                  isPicking={isPicking}
                  isTargetSlot={isTargetSlot}
                  canEquip={hasEmptySlot}
                  onClick={() => handleSkillClick(skill)}
                  onEquip={!isPicking && slotIdx === null && !!onEquipSkillToSlot
                    ? () => handleEquipSkill(skill)
                    : undefined}
                  onRemove={!isPicking && slotIdx !== null && !!onEquipSkillToSlot
                    ? () => { onEquipSkillToSlot(slotIdx!, null); }
                    : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center px-4 pb-6 min-h-[180px]">
            <div style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', padding: '20px 32px', textAlign: 'center', color: 'rgba(255,255,255,0.30)' }}>
              <Sparkles size={26} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nenhuma habilidade</div>
              <div style={{ fontSize: '10px', marginTop: '4px', color: 'rgba(255,255,255,0.20)' }}>Conquiste habilidades em batalha.</div>
            </div>
          </div>
        )}

        {/* Safe area */}
        <div className="h-safe-bottom min-h-2" />
      </div>
    </div>
  );
};

export default SkillsScreen;
