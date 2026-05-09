import React, { useEffect, useState } from 'react';
import { Sparkles, Zap, Sword, Heart } from 'lucide-react';
import { Player, Skill } from '../../types';
import { getClassSlots } from '../../constants';

const BOOK_ICON_URL = new URL('../../game/assets/Icons/Habilidades/Book_habilidades.png', import.meta.url).href;
const BANNER_SKILLS_URL = new URL('../../game/assets/Imagens/Banner_habilidades.png', import.meta.url).href;

// -- Inject keyframes once ----------------------------------------------------
if (typeof document !== 'undefined' && !document.getElementById('skills-anim-style-v2')) {
  const s = document.createElement('style');
  s.id = 'skills-anim-style-v2';
  s.textContent = `
    @keyframes skl-detail-in  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes skl-detail-out { from { opacity:1; transform:translateY(0);    } to { opacity:0; transform:translateY(10px); } }
    .skl-detail-in  { animation: skl-detail-in  0.20s ease forwards; }
    .skl-detail-out { animation: skl-detail-out 0.16s ease forwards; }
  `;
  document.head.appendChild(s);
}

// -- Visual theme color map ---------------------------------------------------
const THEME_COLOR: Record<string, string> = {
  steel:   '#93c5fd',
  solar:   '#fbbf24',
  ember:   '#fb7185',
  rage:    '#f97316',
  storm:   '#22c55e',
  frost:   '#38bdf8',
  arcane:  '#a78bfa',
  verdant: '#14b8a6',
  thorn:   '#84cc16',
  shadow:  '#818cf8',
  blood:   '#ef4444',
  lunar:   '#c084fc',
};

const TYPE_COLOR: Record<string, string> = {
  physical: '#f87171',
  magic:    '#c4b5fd',
  heal:     '#86efac',
};

const getAccentColor = (skill: Skill): string =>
  (skill.visualTheme ? THEME_COLOR[skill.visualTheme] : null) ?? TYPE_COLOR[skill.type] ?? '#c4b5fd';

const getTypeIcon = (type: Skill['type'], size = 24) => {
  if (type === 'physical') return <Sword size={size} />;
  if (type === 'heal')     return <Heart size={size} />;
  return <Sparkles size={size} />;
};

const getTypeLabel = (type: Skill['type']) => {
  if (type === 'physical') return 'Fisico';
  if (type === 'heal')     return 'Cura';
  return 'Magia';
};

// -- Skill Card (full-bleed icon) --------------------------------------------

const SkillCard: React.FC<{
  skill: Skill;
  isEquipped: boolean;
  slotIndex: number | null;
  isPicking: boolean;
  isTargetSlot: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ skill, isEquipped, slotIndex, isPicking, isTargetSlot, isSelected, onClick }) => {
  const accent = getAccentColor(skill);

  const borderColor = isTargetSlot
    ? `${accent}ee`
    : isSelected
      ? `${accent}cc`
      : isEquipped
        ? `${accent}88`
        : `${accent}30`;

  const boxShadow = isTargetSlot || isSelected
    ? `0 0 0 2px ${accent}55, 0 8px 24px rgba(0,0,0,0.6)`
    : isEquipped
      ? `0 0 0 1.5px ${accent}44, 0 6px 18px rgba(0,0,0,0.5)`
      : '0 4px 14px rgba(0,0,0,0.45)';

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        width: 96,
        height: 124,
        flexShrink: 0,
        borderRadius: 16,
        border: `1.5px solid ${borderColor}`,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow,
        transition: 'border 0.15s, box-shadow 0.15s',
        background: 'none',
        padding: 0,
      }}
    >
      {/* BG: full-bleed image or gradient */}
      {skill.icon ? (
        <img src={skill.icon} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 38%, ${accent}55 0%, ${accent}18 52%, rgba(8,8,20,0.96) 100%)` }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, background: `linear-gradient(180deg, ${accent}22 0%, transparent 100%)` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 30, color: accent, filter: `drop-shadow(0 0 14px ${accent}99)` }}>
            {getTypeIcon(skill.type, 40)}
          </div>
        </>
      )}

      {/* Bottom name scrim */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(4,4,12,0.92) 55%, rgba(4,4,12,0.98) 100%)',
        padding: isEquipped ? '18px 6px 22px' : '20px 6px 8px',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 900, color: '#fff', textAlign: 'center',
          lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {skill.name}
        </div>
      </div>

      {/* Equipped badge strip at very bottom â€” same pattern as inventory */}
      {isEquipped && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(16,185,129,0.90)',
          paddingTop: 3, paddingBottom: 3,
          textAlign: 'center',
          fontSize: 7, fontWeight: 900, textTransform: 'uppercase' as const,
          letterSpacing: '0.12em', color: '#fff',
          borderBottomLeftRadius: 15, borderBottomRightRadius: 15,
        }}>
          {slotIndex !== null ? `S${slotIndex + 1} \u00b7 Ativo` : 'Ativo'}
        </div>
      )}

      {/* Target slot indicator */}
      {isTargetSlot && (
        <div style={{
          position: 'absolute', top: 5, right: 5,
          borderRadius: 99, background: `${accent}33`, border: `1px solid ${accent}88`,
          padding: '2px 6px', fontSize: 7, fontWeight: 900, color: accent,
          letterSpacing: '0.1em',
        }}>
          Slot {(slotIndex ?? 0) + 1}
        </div>
      )}
    </button>
  );
};

// -- Main component -----------------------------------------------------------

export type SkillsScreenProps = {
  player: Player;
  onClose: () => void;
  isClosing?: boolean;
  targetSlotIndex?: number | null;
  onEquipSkillToSlot?: (slotIndex: number, skillId: string | null) => void;
};

export const SkillsScreen: React.FC<SkillsScreenProps> = ({
  player, onClose, isClosing = false, targetSlotIndex = null, onEquipSkillToSlot,
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);

  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 20); return () => window.clearTimeout(t); }, []);

  const skills      = player.skills ?? [];
  const equippedIds = player.equippedSkillIds ?? [];
  const maxSlots    = getClassSlots(player.classId).skills;
  const paddedIds   = [...equippedIds];
  while (paddedIds.length < maxSlots) paddedIds.push('');

  const getSlotIndex = (skillId: string): number | null => {
    const idx = paddedIds.findIndex(id => id === skillId);
    return idx !== -1 ? idx : null;
  };

  const slotsFilledCount = paddedIds.filter(id => !!id).length;
  const isPicking        = targetSlotIndex !== null;
  const hasEmptySlot     = paddedIds.some(id => !id);

  const selectedSkill = skills.find(s => s.id === selectedSkillId) ?? null;
  const selectedSlot  = selectedSkill ? getSlotIndex(selectedSkill.id) : null;

  const closeDetail = () => {
    setDetailClosing(true);
    setTimeout(() => { setDetailClosing(false); setSelectedSkillId(null); }, 160);
  };

  const handleCardClick = (skill: Skill) => {
    if (isPicking) {
      if (!onEquipSkillToSlot || targetSlotIndex === null) return;
      const cur = paddedIds[targetSlotIndex];
      onEquipSkillToSlot(targetSlotIndex, cur === skill.id ? null : skill.id);
      onClose();
      return;
    }
    if (selectedSkillId === skill.id) { closeDetail(); }
    else { setDetailClosing(false); setSelectedSkillId(skill.id); }
  };

  const handleEquip = (skill: Skill) => {
    if (!onEquipSkillToSlot) return;
    const firstEmpty = paddedIds.findIndex(id => !id);
    if (firstEmpty === -1) return;
    onEquipSkillToSlot(firstEmpty, skill.id);
  };

  const handleRemove = (skill: Skill, slotIdx: number) => {
    if (!onEquipSkillToSlot) return;
    onEquipSkillToSlot(slotIdx, null);
    closeDetail();
  };

  const panelSlide = isClosing
    ? 'translate-y-full transition-transform duration-[220ms] ease-in'
    : mounted ? 'translate-y-0 transition-transform duration-[320ms] ease-out' : 'translate-y-full';

  const overlayFade = isClosing ? 'opacity-0 transition-opacity duration-[220ms]' : 'opacity-100';
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };

  return (
    <div
      className={`absolute inset-0 z-[80] flex items-end lg:items-center justify-center pointer-events-auto ${overlayFade}`}
      style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      {/* BOTTOM SHEET */}
      <div
        className={`relative w-full sm:max-w-2xl lg:w-[640px] lg:max-w-none flex flex-col border-t lg:border border-white/10 rounded-t-[24px] sm:rounded-t-[28px] lg:rounded-[24px] max-h-[65dvh] lg:max-h-[82dvh] ${panelSlide}`}
        style={{ background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', ...font }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── BANNER HEADER ── */}
        <div className="relative shrink-0 rounded-t-[24px] sm:rounded-t-[28px] overflow-hidden" style={{ height: 148 }}>
          {/* BG image */}
          <div className="absolute inset-0"
            style={{ backgroundImage: `url(${BANNER_SKILLS_URL})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
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
            <span className="text-xs font-black leading-none">{String.fromCharCode(0x2715)}</span>
          </button>
          {/* Title row — bottom-left */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <img src={BOOK_ICON_URL} alt="" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }} />
            <span className="text-sm font-black uppercase tracking-[0.18em] text-white drop-shadow-md">Habilidades</span>
            <span className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-black text-white/60">
              {slotsFilledCount}/{maxSlots} ativas
            </span>
          </div>
        </div>

        {/* Picking banner */}
        {isPicking && (
          <div className="px-3 pb-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-900/40 px-3 py-2">
              <Sparkles size={12} className="text-violet-300 shrink-0" />
              <span className="text-[10px] font-black text-violet-200 flex-1">
                Escolhendo para Slot {(targetSlotIndex ?? 0) + 1} {String.fromCharCode(0x2013)} toque numa habilidade
              </span>
              {paddedIds[targetSlotIndex!] && onEquipSkillToSlot && (
                <button
                  onClick={() => { onEquipSkillToSlot(targetSlotIndex!, null); onClose(); }}
                  className="flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-900/50 px-2 py-1 active:scale-95 transition-all"
                  style={{ fontSize: '9px', fontWeight: 900, color: '#fca5a5', cursor: 'pointer' }}
                >
                  {String.fromCharCode(0xD7)} Remover
                </button>
              )}
            </div>
          </div>
        )}

        {/* DETAIL PANE */}
        {selectedSkill && !isPicking && (
          <div
            className={`shrink-0 mx-3 mb-2 rounded-[18px] overflow-hidden ${detailClosing ? 'skl-detail-out' : 'skl-detail-in'}`}
            style={{ border: `1px solid ${getAccentColor(selectedSkill)}55`, background: 'rgba(6,6,16,0.90)' }}
          >
            <div className="flex">
              {/* LEFT: colored icon panel â€” same concept as inventory rarity panel */}
              {(() => {
                const accent = getAccentColor(selectedSkill);
                return (
                  <div className="relative shrink-0 w-[96px] overflow-hidden" style={{ minHeight: 110 }}>
                    {/* Full-bleed image or gradient */}
                    {selectedSkill.icon ? (
                      <img src={selectedSkill.icon} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 42%, ${accent}44 0%, ${accent}14 55%, rgba(6,6,16,0.96) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, filter: `drop-shadow(0 0 16px ${accent}aa)` }}>
                        {getTypeIcon(selectedSkill.type, 54)}
                      </div>
                    )}
                    {/* Overlay scrim for readability */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.45) 100%)' }} />
                    {/* Slot badge top */}
                    {selectedSlot !== null && (
                      <span className="absolute top-2 left-2 right-2 text-center text-[8px] font-black uppercase tracking-widest py-0.5 rounded-md leading-tight"
                        style={{ color: '#fff', background: 'rgba(0,0,0,0.52)', zIndex: 1 }}>
                        Slot {selectedSlot + 1}
                      </span>
                    )}
                    {/* MP badge bottom */}
                    <span style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 900, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 3, zIndex: 1, background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(56,189,248,0.45)', borderRadius: 99, padding: '3px 8px', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
                      <Zap size={10} />{selectedSkill.manaCost} MP
                    </span>
                  </div>
                );
              })()}

              {/* RIGHT: info */}
              <div className="flex-1 min-w-0 flex flex-col px-3 pt-2.5 pb-3 gap-1.5 relative">
                <button onClick={closeDetail}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 hover:bg-white/15 active:scale-90 transition-all">
                  <span className="text-xs font-black leading-none">{String.fromCharCode(0x2715)}</span>
                </button>

                <div className="flex items-center gap-1.5 flex-wrap pr-7">
                  {selectedSlot !== null && (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black text-emerald-400">Equipado</span>
                  )}
                  {(() => {
                    const accent = getAccentColor(selectedSkill);
                    return (
                      <span className="rounded-full border px-2 py-0.5 text-[9px] font-black"
                        style={{ color: accent, borderColor: `${accent}55`, background: `${accent}15` }}>
                        {getTypeLabel(selectedSkill.type)}
                      </span>
                    );
                  })()}
                </div>

                <h3 className="text-[15px] font-black text-white leading-tight line-clamp-2">{selectedSkill.name}</h3>

                {selectedSkill.description && (
                  <p className="text-[10px] text-white/45 line-clamp-3 leading-snug">{selectedSkill.description}</p>
                )}

                {selectedSkill.damageMult > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black text-amber-300">
                      <Sword size={9} /> {String.fromCharCode(0xD7)}{selectedSkill.damageMult.toFixed(1)} dano
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-auto pt-0.5">
                  {selectedSlot === null && hasEmptySlot && onEquipSkillToSlot && (
                    <button onClick={() => { handleEquip(selectedSkill); closeDetail(); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-600/80 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-500 active:scale-95 transition-all">
                      <Sparkles size={12} /> Equipar
                    </button>
                  )}
                  {selectedSlot !== null && onEquipSkillToSlot && (
                    <button onClick={() => handleRemove(selectedSkill, selectedSlot!)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-600/80 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-amber-500 active:scale-95 transition-all">
                      Desequipar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Horizontal card scroll */}
        {skills.length > 0 ? (
          <div
          className="flex items-end gap-3 overflow-x-auto px-4 pb-4 shrink-0 lg:flex-wrap lg:overflow-x-visible lg:pb-4 lg:pt-1"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehaviorX: 'contain' as any, scrollbarWidth: 'none' as any }}
          >
            {skills.map((skill) => {
              const slotIdx      = getSlotIndex(skill.id);
              const isTargetSlot = isPicking && targetSlotIndex !== null && slotIdx === targetSlotIndex;
              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isEquipped={slotIdx !== null}
                  slotIndex={slotIdx}
                  isPicking={isPicking}
                  isTargetSlot={isTargetSlot}
                  isSelected={selectedSkillId === skill.id}
                  onClick={() => handleCardClick(skill)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center px-4 pb-6 min-h-[160px]">
            <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', padding: '20px 32px', textAlign: 'center', color: 'rgba(255,255,255,0.30)' }}>
              <Sparkles size={26} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nenhuma habilidade</div>
              <div style={{ fontSize: 10, marginTop: 4, color: 'rgba(255,255,255,0.20)' }}>Conquiste habilidades em batalha.</div>
            </div>
          </div>
        )}

        {/* Safe area — mobile only */}
        <div className="safe-bottom shrink-0 lg:hidden" />
      </div>
    </div>
  );
};

export default SkillsScreen;
