import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AlertTriangle, BookOpen, Crown, Flame, Heart, Home, LogOut, Play, Sparkles, Sword, Wand2, X, Zap } from 'lucide-react';
import { ALL_ITEMS, SKILLS } from '../../constants';
import type { BossVictoryContext, CardRewardOffer, DungeonResult, Item, Player, ProgressionCard, Skill } from '../../types';
import { getNewlyUnlockedShopRarityByStage } from '../../game/mechanics/shopProgression';
import { uiSfx } from '../../game/audio/uiSfx';
import { InventoryScreen as InventoryModal } from '../profile/InventoryScreen';
import { ShopMenuScreen } from '../shop/ShopMenuScreen';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { describeCardEffect, getCardCategoryBadge, getCategoryBannerUrl, getEffectIconUrl } from './cardPresentation';

const MENU_BACKGROUND_IMAGE_URL = new URL('../../game/assets/Imagens/Menu_Screen.png', import.meta.url).href;
const MENU_LOGO_IMAGE_URL = new URL('../../game/assets/Imagens/Logo_Hero_Tower.png', import.meta.url).href;

// ── Skill Unlock Reveal ───────────────────────────────────────────────────
const SKILL_TYPE_CONFIG = {
  physical: { label: 'Físico',  color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  icon: <Sword size={14} /> },
  magic:    { label: 'Mágico',  color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)', icon: <Wand2 size={14} /> },
  heal:     { label: 'Cura',    color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.4)', icon: <Heart size={14} /> },
};

const SkillUnlockReveal: React.FC<{ skill: Skill; onClose: () => void }> = ({ skill, onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef    = useRef<HTMLDivElement>(null);
  const ring1Ref   = useRef<HTMLDivElement>(null);
  const ring2Ref   = useRef<HTMLDivElement>(null);
  const iconRef    = useRef<HTMLImageElement>(null);
  const textRef    = useRef<HTMLDivElement>(null);

  const cfg = SKILL_TYPE_CONFIG[skill.type] ?? SKILL_TYPE_CONFIG.physical;

  const { contextSafe } = useGSAP(() => {
    // background fade in
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    // card pop
    gsap.fromTo(cardRef.current,
      { opacity: 0, scale: 0.55, y: 40 },
      { opacity: 1, scale: 1,    y: 0,  duration: 0.55, ease: 'back.out(1.8)', delay: 0.1 }
    );
    // icon bounce
    gsap.fromTo(iconRef.current,
      { scale: 0.3, opacity: 0 },
      { scale: 1,   opacity: 1, duration: 0.5, ease: 'elastic.out(1.1, 0.55)', delay: 0.35 }
    );
    // text slide up
    gsap.fromTo(textRef.current,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0,  duration: 0.4, ease: 'power2.out', delay: 0.5 }
    );
    // pulsing rings — killed immediately in handleClose
    const ringAnim = (el: HTMLDivElement | null, delay: number) => {
      gsap.fromTo(el,
        { scale: 0.7, opacity: 0.7 },
        { scale: 2.2, opacity: 0,  duration: 1.6, ease: 'power1.out', repeat: -1, delay }
      );
    };
    ringAnim(ring1Ref.current, 0.4);
    ringAnim(ring2Ref.current, 0.95);
  }, { scope: overlayRef });

  // contextSafe: exit tweens belong to this context and are killed on unmount.
  // Kill ring tweens immediately so they stop as soon as the user closes.
  const handleClose = contextSafe(() => {
    gsap.killTweensOf([ring1Ref.current, ring2Ref.current]);
    gsap.to(cardRef.current,    { scale: 0.9, opacity: 0, y: -20, duration: 0.3, ease: 'power2.in' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.35, ease: 'power2.in', delay: 0.1, onComplete: onClose });
  });

  return (
    <div ref={overlayRef} className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-auto"
      style={{ background: 'radial-gradient(ellipse at center, rgba(10,5,25,0.96) 0%, rgba(5,2,15,0.98) 100%)' }}>

      <div ref={cardRef} className="relative flex flex-col items-center w-full max-w-sm mx-4">

        {/* Badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em]"
          style={{ borderColor: cfg.color + '88', background: cfg.bg, color: cfg.color }}>
          <Sparkles size={12} /> Habilidade Desbloqueada!
        </div>

        {/* Icon + rings */}
        <div className="relative flex items-center justify-center mb-6" style={{ width: 140, height: 140 }}>
          {/* rings */}
          <div ref={ring1Ref} className="absolute inset-0 rounded-full border-2 pointer-events-none"
            style={{ borderColor: cfg.color + 'cc' }} />
          <div ref={ring2Ref} className="absolute inset-0 rounded-full border pointer-events-none"
            style={{ borderColor: cfg.color + '88' }} />
          {/* glow backdrop */}
          <div className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${cfg.color}33 0%, transparent 70%)` }} />
          {/* icon */}
          {skill.icon
            ? <img ref={iconRef} src={skill.icon} alt={skill.name}
                className="relative z-10 rounded-2xl"
                style={{ width: 90, height: 90, objectFit: 'contain', filter: `drop-shadow(0 0 18px ${cfg.color}cc)` }} />
            : <div ref={iconRef as React.RefObject<HTMLDivElement>} className="relative z-10 flex items-center justify-center rounded-2xl text-4xl"
                style={{ width: 90, height: 90, background: cfg.bg, border: `2px solid ${cfg.border}` }}>
                <BookOpen size={44} style={{ color: cfg.color }} />
              </div>
          }
        </div>

        {/* Text block */}
        <div ref={textRef} className="w-full rounded-2xl border px-6 py-5 text-center flex flex-col items-center gap-3"
          style={{ background: 'rgba(15,8,30,0.95)', borderColor: cfg.color + '55', boxShadow: `0 0 40px ${cfg.color}22` }}>

          {/* Skill name */}
          <h2 className="text-2xl font-black" style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.color}99` }}>
            {skill.name}
          </h2>

          {/* Tags row */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
              style={{ borderColor: cfg.border, background: cfg.bg, color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/50 bg-sky-900/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
              <Zap size={10} /> {skill.manaCost} MP
            </span>
            {skill.type !== 'heal' && skill.damageMult > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/50 bg-orange-900/30 px-2.5 py-0.5 text-[10px] font-bold text-orange-300">
                <Flame size={10} /> {Math.round(skill.damageMult * 100)}% dano
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-[#c0a890] leading-relaxed italic">{skill.description}</p>

          {/* Divider */}
          <div className="w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}55, transparent)` }} />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="mt-1 inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black uppercase tracking-widest transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: cfg.color, color: '#0a0514', boxShadow: `0 4px 24px ${cfg.color}55` }}>
            <X size={15} /> Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export const MenuScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="absolute inset-0 z-50 overflow-hidden pointer-events-auto hero-brand-root">
    <div className="hero-brand-background" style={{ backgroundImage: `url(${MENU_BACKGROUND_IMAGE_URL})` }} />
    <div className="hero-brand-vignette" />
    <div className="hero-brand-noise" />

    <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
      <img
        src={MENU_LOGO_IMAGE_URL}
        alt="Hero Tower"
        className="w-full max-w-[300px] sm:max-w-[410px] hero-brand-logo-shadow hero-brand-logo-intro"
        draggable={false}
      />
      <p className="mt-4 mb-8 text-[10px] font-black uppercase tracking-[0.26em] text-[#f7d6ae] sm:text-xs">RPG tatico de aventura em 3D</p>

      <button
        onClick={onStart}
        className="hero-menu-action hero-menu-action-primary w-full max-w-xs sm:max-w-sm"
      >
        <Play size={18} fill="currentColor" className="shrink-0" /> Iniciar jornada
      </button>
    </div>
  </div>
);

// ── Rarity visual styles ──────────────────────────────────────────────────
const RARITY_STYLE = {
  bronze: {
    border:     'border-[#cd7f32]',
    glow:       'hover:shadow-[0_12px_40px_rgba(205,127,50,0.45)]',
    selectedGlow: '0 0 40px 8px rgba(205,127,50,0.55)',
    shimmer:    '',
    dots:       1,
    label:      'Comum',
    dotColor:   '#cd7f32',
    headerOverlay: 'from-[#cd7f32]/20 via-transparent to-transparent',
  },
  silver: {
    border:     'border-[#a8a9ad]',
    glow:       'hover:shadow-[0_12px_40px_rgba(168,169,173,0.45)] card-silver-pulse',
    selectedGlow: '0 0 40px 8px rgba(200,202,208,0.7)',
    shimmer:    '',
    dots:       2,
    label:      'Raro',
    dotColor:   '#a8a9ad',
    headerOverlay: 'from-[#a8a9ad]/20 via-transparent to-transparent',
  },
  gold: {
    border:     'border-[#ffd700]',
    glow:       'hover:shadow-[0_12px_48px_rgba(255,215,0,0.55)]',
    selectedGlow: '0 0 60px 16px rgba(255,215,0,0.5)',
    shimmer:    'card-gold-shimmer',
    dots:       3,
    label:      'Lendário',
    dotColor:   '#ffd700',
    headerOverlay: 'from-[#ffd700]/30 via-transparent to-transparent',
  },
} as const;

export const CardChoiceScreen: React.FC<{
  offer: CardRewardOffer;
  cards: ProgressionCard[];
  onSelect: (card: ProgressionCard) => void;
}> = ({ offer, cards, onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealSkill, setRevealSkill] = useState<{ skill: Skill; card: ProgressionCard } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPickingRef = useRef(false);

  const { contextSafe } = useGSAP(() => {
    gsap.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' });
    gsap.fromTo(panelRef.current, { opacity: 0, scale: 0.92, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power2.out' });
  }, { scope: containerRef });

  const handlePick = contextSafe((card: ProgressionCard) => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    uiSfx.play('card_select_evolution');
    setSelectedId(card.id);

    const rs = RARITY_STYLE[card.rarity];
    const selectedEl = containerRef.current?.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`);
    const otherEls = containerRef.current?.querySelectorAll<HTMLElement>(`[data-card-id]:not([data-card-id="${card.id}"])`);

    // Check for skill unlock BEFORE building timeline so we know what to do at the end
    const unlockEffect = card.effects.find(e => e.type === 'unlock_skill');
    const unlockedSkill = unlockEffect?.skillId ? SKILLS.find(s => s.id === unlockEffect.skillId) : null;

    const tl = gsap.timeline();

    if (selectedEl) {
      tl.to(selectedEl, { scale: 1.05, boxShadow: rs.selectedGlow, duration: 0.27, ease: 'power2.out' }, 0);
      tl.to(selectedEl, { scale: 1.03, duration: 0.3 }, 0.27);
      tl.to(selectedEl, { scale: 1.0, boxShadow: '0 0 0px 0px transparent', duration: 0.33, ease: 'power1.in' }, 0.57);
    }
    if (otherEls && otherEls.length > 0) {
      tl.to(otherEls, { opacity: 0.28, scale: 0.94, filter: 'grayscale(0.7)', duration: 0.5, ease: 'power1.out' }, 0.1);
    }
    tl.to(containerRef.current, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.9);

    if (unlockedSkill) {
      // Show skill reveal — onSelect is called when user closes the reveal
      tl.call(() => setRevealSkill({ skill: unlockedSkill, card }));
    } else {
      tl.call(() => onSelect(card));
    }
  });

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 pointer-events-auto">
        <div ref={panelRef} className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl sm:rounded-[28px] border border-[#cfab91]/60 bg-[#1a1008]/90 shadow-[0_30px_120px_rgba(0,0,0,0.7)]">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="border-b border-[#cfab91]/25 px-4 py-4 sm:px-8 sm:py-6 text-center"
          style={{ background: 'linear-gradient(180deg, rgba(107,49,65,0.35) 0%, transparent 100%)' }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91]/50 bg-[#6b3141]/30 px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#f0c8a0]">
            <Sparkles size={12} /> {selectedId ? 'Pergaminho Absorvido!' : 'Escolha um Pergaminho'}
          </div>
          <h2 className="mt-2 sm:mt-3 text-xl sm:text-3xl font-black text-[#f7e5cb]">
            {offer.source === 'boss' ? 'Recompensa do Chefão' : 'Recompensa de Evolução'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#c9a07a]">{offer.reason}</p>
        </div>

        {/* ── Card Grid ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 p-4 sm:p-7">
          {cards.map((card) => {
            const rs = RARITY_STYLE[card.rarity];
            const category = getCardCategoryBadge(card);
            const effectLines = describeCardEffect(card);
            const bannerUrl = getCategoryBannerUrl(card.category);
            const isThis = selectedId === card.id;
            const isOther = selectedId !== null && selectedId !== card.id;

            // Glass badge style per category (no solid light bg)
            const glassBadge =
              card.category === 'economia'
                ? 'text-amber-300 border-amber-400/50 bg-amber-900/40'
                : card.category === 'atributo'
                ? 'text-emerald-300 border-emerald-400/50 bg-emerald-900/40'
                : card.category === 'batalha'
                ? 'text-rose-300 border-rose-400/50 bg-rose-900/40'
                : 'text-sky-300 border-sky-400/50 bg-sky-900/40';

            return (
              <button
                key={card.id}
                data-card-id={card.id}
                onClick={() => handlePick(card)}
                disabled={!!selectedId}
                className={[
                  'group text-left rounded-[18px] border-2 transition-all duration-300 relative overflow-hidden',
                  'flex flex-col',
                  rs.border,
                  rs.shimmer,
                  isThis
                    ? 'ring-2 ring-amber-400/60'
                    : !selectedId
                    ? `hover:-translate-y-2 cursor-pointer ${rs.glow}`
                    : '',
                  isOther ? 'cursor-default' : '',
                ].join(' ')}
                style={{
                  background: 'linear-gradient(175deg, #1e1208 0%, #140d05 60%, #0e0802 100%)',
                }}
              >
                {/* Selected glow overlay */}
                {isThis && (
                  <div className="absolute inset-0 pointer-events-none z-10 rounded-[16px]"
                    style={{ background: 'radial-gradient(circle at 50% 30%, rgba(250,204,21,0.18) 0%, transparent 70%)' }} />
                )}

                {/* ── Banner — imagem ocupa toda a área superior ─────────── */}
                <div className="relative w-full overflow-hidden" style={{ height: '100px' }}>
                  {/* Banner image fills entire area */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${bannerUrl})` }}
                  />
                  {/* Bottom gradient fade into card body */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(14,8,2,0.6) 65%, rgba(14,8,2,0.97) 100%)' }} />
                  {/* Rarity accent strip at top */}
                  <div className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: `linear-gradient(90deg, ${rs.dotColor} 0%, ${rs.dotColor}55 60%, transparent 100%)` }} />

                  {/* Name + badge overlaid at bottom of banner */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-black leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,1)]">
                      {card.name}
                    </h3>
                    <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-bold shrink-0 backdrop-blur-md ${glassBadge}`}>
                      {category.icon}
                      <span>{category.label}</span>
                    </div>
                  </div>
                </div>

                {/* ── Card body ───────────────────────────────────────────── */}
                <div className="flex flex-col flex-1 px-4 pb-4 pt-2 gap-2.5">

                  {/* Decorative divider */}
                  <div className="h-px w-full opacity-30" style={{ background: `linear-gradient(90deg, transparent, ${rs.dotColor}, transparent)` }} />

                  {/* Effect rows — image flush to left card edge, no padding left */}
                  <div className="flex flex-col gap-1.5 -mx-4">
                    {card.effects.map((eff, i) => (
                      <div key={i} className="flex items-stretch overflow-hidden border-y border-[#cfab91]/12"
                        style={{ background: 'rgba(207,171,145,0.06)' }}>
                        {/* Image fills full height, no padding, flush left */}
                        <img
                          src={getEffectIconUrl(eff.type)}
                          alt=""
                          className="object-cover self-stretch"
                          style={{ width: '36px', minHeight: '36px', flexShrink: 0, borderRight: '1px solid rgba(207,171,145,0.18)' }}
                        />
                        <span className="flex items-center px-3 text-[11px] sm:text-xs font-semibold text-[#e8cfa8] leading-snug">{effectLines[i]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <p className="text-[10px] sm:text-xs text-[#9a7a5a] leading-relaxed italic">{card.description}</p>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Rarity footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#cfab91]/15">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full border"
                          style={{
                            backgroundColor: i < rs.dots ? rs.dotColor : 'transparent',
                            borderColor: i < rs.dots ? rs.dotColor : 'rgba(207,171,145,0.3)',
                            boxShadow: i < rs.dots ? `0 0 4px ${rs.dotColor}` : 'none',
                          }}
                        />
                      ))}
                      <span className="ml-1 text-[9px] font-black uppercase tracking-[0.25em]"
                        style={{ color: rs.dotColor }}>{rs.label}</span>
                    </div>
                    {isThis && (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">✓ Selecionado</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
      {revealSkill && (
        <SkillUnlockReveal
          skill={revealSkill.skill}
          onClose={() => { setRevealSkill(null); onSelect(revealSkill.card); }}
        />
      )}
    </>
  );
};

export const DungeonResultScreen: React.FC<{ result: DungeonResult; onContinue: () => void }> = ({ result, onContinue }) => {
  const rewardItems = Object.entries(result.rewards.drops)
    .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find((entry) => entry.id === itemId), quantity }))
    .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));
  const isPositiveOutcome = result.outcome !== 'defeat';
  const title = result.outcome === 'victory' ? 'Dungeon Concluida' : result.outcome === 'withdrawal' ? 'Retirada Segura' : 'Dungeon Fracassada';
  const badgeLabel = result.outcome === 'withdrawal' ? 'Extracao' : 'Dungeon';
  const frameClasses = isPositiveOutcome
    ? 'border-[#7fb0d3] bg-[#e7f4ff] shadow-[0_30px_120px_rgba(31,79,120,0.24)]'
    : 'border-[#d3a0a0] bg-[#fdecec] shadow-[0_30px_120px_rgba(120,31,31,0.26)]';
  const headerClasses = isPositiveOutcome ? 'bg-[#1f4f78]' : 'bg-[#7a2525]';
  const headerTextClass = isPositiveOutcome ? 'text-[#bfdcf2]' : 'text-[#f0c5c5]';
  const statCardClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#dff0ff]' : 'border-[#dfb3b3] bg-[#fbe1e1]';
  const statLabelClass = isPositiveOutcome ? 'text-[#557f9f]' : 'text-[#9f5757]';
  const statValueClass = isPositiveOutcome ? 'text-[#214f70]' : 'text-[#7a2525]';
  const lootPanelClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#dff0ff]' : 'border-[#dfb3b3] bg-[#fbe1e1]';
  const lootChipClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff] text-[#4f7694]' : 'border-[#dfb3b3] bg-[#fdecec] text-[#9f5757]';
  const lootItemClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff]' : 'border-[#dfb3b3] bg-[#fdecec]';
  const lootItemInnerClasses = isPositiveOutcome ? 'border-[#b5d2e8] bg-[#dff0ff]' : 'border-[#ebc3c3] bg-[#fbe1e1]';
  const lootItemTextClass = isPositiveOutcome ? 'text-[#214f70]' : 'text-[#7a2525]';
  const emptyLootClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff] text-[#4f7694]' : 'border-[#dfb3b3] bg-[#fdecec] text-[#9f5757]';

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
      <div className={`w-full max-w-4xl rounded-[28px] border overflow-hidden ${frameClasses}`}>
        <div className={`px-6 py-5 sm:px-8 sm:py-6 text-center ${headerClasses}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#e6f4ff]">
            {isPositiveOutcome ? <Sparkles size={14} /> : <AlertTriangle size={14} />} {badgeLabel}
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">{title}</h2>
          <p className={`mt-2 text-sm sm:text-base ${headerTextClass}`}>{result.reason}</p>
          {result.outcome === 'victory' && result.nextEvolution !== undefined && result.nextTotalMonsters !== undefined ? (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs sm:text-sm font-black text-[#e6f4ff]">
              <span>Proxima evolucao: {result.nextEvolution}</span>
              <span className="text-[#bfdcf2]/70">-</span>
              <span>{result.nextTotalMonsters} encontros ate o chefao</span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-6 sm:p-8">
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Encontros</div>
            <div className={`text-2xl font-black ${statValueClass}`}>{result.rewards.clearedMonsters}<span className={`text-sm ${statLabelClass}`}>/{result.rewards.totalMonsters}</span></div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Ouro</div>
            <div className="flex items-center gap-1.5 text-2xl font-black text-amber-700">
              <GameAssetIcon name="coin" size={18} />
              {isPositiveOutcome ? '+' : ''}{result.rewards.gold}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>XP</div>
            <div className={`flex items-center gap-1.5 text-2xl font-black ${isPositiveOutcome ? 'text-[#2d5f85]' : 'text-[#8f3535]'}`}>
              <Zap size={16} className="shrink-0" />
              {isPositiveOutcome ? '+' : ''}{result.rewards.xp}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Diamantes</div>
            <div className="flex items-center gap-1.5 text-2xl font-black text-[#346c7f]">
              <GameAssetIcon name="diamond" size={18} />
              {isPositiveOutcome ? '+' : ''}{result.rewards.diamonds}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Chefao</div>
            <div className={`text-lg font-black ${result.rewards.bossDefeated ? (isPositiveOutcome ? 'text-[#2c6a92]' : 'text-[#9f5757]') : statLabelClass}`}>{result.rewards.bossDefeated ? 'Derrotado' : 'Intacto'}</div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          <div className={`rounded-2xl border p-5 ${lootPanelClasses}`}>
            <div className={`text-[11px] font-black uppercase tracking-[0.3em] mb-3 ${statLabelClass}`}>
              {isPositiveOutcome ? 'Espolio da dungeon' : 'Itens acumulados'}
              {rewardItems.length > 0 ? <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] ${lootChipClasses}`}>{rewardItems.length}</span> : null}
            </div>
            {rewardItems.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-[28vh] overflow-y-auto pr-1">
                {rewardItems.map(({ item, quantity }) => (
                  <div key={item.id} className={`flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1.5 shrink-0 ${lootItemClasses}`}>
                    <div className={`h-7 w-7 rounded-full border flex items-center justify-center text-sm leading-none ${lootItemInnerClasses}`}>{item.iconImage ? <img src={item.iconImage} className="w-5 h-5 object-contain" draggable={false} alt={item.name} /> : item.icon}</div>
                    <span className={`text-sm font-black ${lootItemTextClass}`}>{item.name}</span>
                    {quantity > 1 ? <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-black ${lootChipClasses}`}>x{quantity}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-2xl border border-dashed px-6 py-8 text-center ${emptyLootClasses}`}>Nenhum item ou material foi acumulado.</div>
            )}
          </div>

          <button onClick={onContinue} className={`mt-6 w-full py-4 rounded-xl font-black text-lg text-white transition-all ${isPositiveOutcome ? 'bg-[#2b6b96] hover:bg-[#327aa9] shadow-[0_12px_30px_rgba(43,107,150,0.35)]' : 'bg-[#2c5f82] hover:bg-[#346f97] shadow-[0_12px_30px_rgba(44,95,130,0.35)]'}`}>
            {result.outcome === 'victory' ? 'Receber espolio e continuar' : result.outcome === 'withdrawal' ? 'Receber espolio e voltar' : 'Voltar para o acampamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BossVictoryModal: React.FC<{
  context: BossVictoryContext;
  narration?: string;
  onContinue: () => void;
  onExit: () => void;
}> = ({ context, narration, onContinue, onExit }) => {
  const rewardItems = Object.entries(context.rewards?.drops ?? {})
    .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find((entry) => entry.id === itemId), quantity }))
    .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));

  const isDungeon = context.mode === 'dungeon';
  const newlyUnlockedShopRarity = !isDungeon
    ? (context.newlyUnlockedShopRarity ?? getNewlyUnlockedShopRarityByStage(context.nextStage ?? 0))
    : null;
  const unlockBadgeClass = newlyUnlockedShopRarity === 'gold'
    ? 'border-[#dcb570] bg-[#f3e3c3] text-[#7a5733]'
    : 'border-[#b8becb] bg-[#e9edf4] text-[#4f5d76]';
  const unlockLabel = newlyUnlockedShopRarity === 'gold' ? 'Lendario' : 'Raro';

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-4xl rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] overflow-hidden shadow-[0_30px_120px_rgba(107,49,65,0.22)]">
        <div className="bg-[#6b3141] px-6 py-5 sm:px-8 sm:py-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#f6eadc]">
            <Crown size={14} /> Chefao derrotado
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">
            {isDungeon ? 'Dungeon concluida' : 'Fase concluida'}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#dcc0aa]">
            {isDungeon
              ? `${context.bossName} caiu. Voce domina a dungeon e decide seu proximo passo.`
              : `${context.bossName} foi vencido. Sua proxima fase esta liberada.`}
          </p>
          {narration && !isDungeon ? (
            <p className="mt-2 text-sm text-[#f6eadc] italic">&ldquo;{narration}&rdquo;</p>
          ) : null}
        </div>

        {!isDungeon ? (
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-5 py-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#9a7068]">Proxima fase</div>
              <div className="mt-1 text-4xl font-black text-[#6b3141]">{context.nextStage ?? '-'}</div>
              <div className="mt-1 text-xs text-[#8f6c67]">Inimigos mais fortes aguardam</div>
            </div>
            {newlyUnlockedShopRarity ? (
              <div className="mt-3 rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Mercador</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-black text-[#6b3141]">
                      <GameAssetIcon name="chest" size={18} />
                      Novos itens liberados no mercador
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${unlockBadgeClass}`}>
                    {unlockLabel}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {isDungeon && context.rewards ? (
          <div className="px-6 py-5 sm:px-8 sm:py-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Encontros</div>
                <div className="text-2xl font-black text-[#6b3141]">{context.rewards.clearedMonsters}<span className="text-sm text-[#9a7068]">/{context.rewards.totalMonsters}</span></div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Ouro</div>
                <div className="flex items-center gap-1.5 text-2xl font-black text-amber-700">
                  <GameAssetIcon name="coin" size={18} />+{context.rewards.gold}
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">XP</div>
                <div className="flex items-center gap-1.5 text-2xl font-black text-[#7d3d4d]">
                  <Zap size={16} className="shrink-0" />+{context.rewards.xp}
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Diamantes</div>
                <div className="flex items-center gap-1.5 text-2xl font-black text-[#346c7f]">
                  <GameAssetIcon name="diamond" size={18} />+{context.rewards.diamonds}
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Prox. evolucao</div>
                <div className="text-lg font-black text-[#4d7a96]">Nv. {context.nextEvolution ?? context.rewards.evolution}</div>
              </div>
            </div>

            {context.nextTotalMonsters !== undefined ? (
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 text-sm font-black text-[#6b3141] text-center">
                {context.nextTotalMonsters} encontros para o proximo chefao
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[#9a7068] mb-3">
                Espolio conquistado
                {rewardItems.length > 0 ? <span className="ml-2 rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2 py-0.5 text-[10px] text-[#8f6c67]">{rewardItems.length}</span> : null}
              </div>
              {rewardItems.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-[22vh] overflow-y-auto pr-1">
                  {rewardItems.map(({ item, quantity }) => (
                    <div key={item.id} className="flex items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f7ecdd] pl-1.5 pr-3 py-1.5 shrink-0">
                      <div className="h-7 w-7 rounded-full border border-[#dcc0aa] bg-[#f4e5d4] flex items-center justify-center text-sm leading-none">{item.iconImage ? <img src={item.iconImage} className="w-5 h-5 object-contain" draggable={false} alt={item.name} /> : item.icon}</div>
                      <span className="text-sm font-black text-[#6b3141]">{item.name}</span>
                      {quantity > 1 ? <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-1.5 py-0.5 text-[10px] font-black text-[#8f6c67]">x{quantity}</span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#cfab91] bg-[#f7ecdd] px-6 py-6 text-center text-[#8f6c67]">Nenhum item adicional foi acumulado.</div>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 px-6 pb-6 sm:px-8 sm:pb-8">
          <button
            onClick={onExit}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
          >
            {isDungeon ? <LogOut size={15} /> : <Home size={15} />}
            Descansar
          </button>
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#b87a3a] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(184,122,58,0.3)] transition-all hover:bg-[#c88a4a]"
          >
            <Sword size={15} /> Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export const ShopScreen: React.FC<{
  player: Player;
  items: Item[];
  huntStage: number;
  onBuy: (item: Item, quantity: number) => void;
  onSell: (item: Item, quantity: number) => void;
  onEquip: (item: Item) => void;
  onUnequip: (item: Item) => void;
  onUse?: (itemId: string) => void;
  onLeave: () => void;
}> = ({ player, items, huntStage, onBuy, onSell, onEquip, onUnequip, onUse, onLeave }) => {
  const [showShopInventory, setShowShopInventory] = useState(false);

  return (
    <>
      <ShopMenuScreen
        player={player}
        items={items}
        huntStage={huntStage}
        onBuy={onBuy}
        onSell={onSell}
        onEquip={onEquip}
        onLeave={onLeave}
        onOpenInventory={() => setShowShopInventory(true)}
        inventoryOpen={showShopInventory}
      />
      {showShopInventory ? (
        <div className="absolute inset-0 z-50">
          <InventoryModal
            player={player}
            shopItems={items}
            onClose={() => setShowShopInventory(false)}
            onEquip={onEquip}
            onUnequip={onUnequip}
            onUse={onUse ?? (() => {})}
            onSell={onSell}
            isBattleContext={false}
            inShopContext={true}
          />
        </div>
      ) : null}
    </>
  );
};
