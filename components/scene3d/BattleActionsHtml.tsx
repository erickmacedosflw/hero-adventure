import React from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, FlaskConical, Heart, Info, LogOut, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { ALL_ITEMS } from '../../constants';
import { getBattleItemBadges, getBattleMenuSlotCounts, getPaddedBattleSkillIds } from '../battle/battleMenuModels';
import type { Item, Player, Skill } from '../../types';

export interface BattleActionsConfig {
  isPlayerTurn: boolean;
  showSkillsAction: boolean;
  showItemsAction: boolean;
  impulseUnlocked: boolean;
  impulseCapacity: number;
  impulseReserveColors: string[];
  classImpulseBaseColor: string;
  absorbGlowColor: string;
  usesMagicBasicAttack: boolean;
  usesBowBasicAttack: boolean;
  limitBattleActionsToBasics: boolean;
  shopItems: Item[];
  onAttack: () => void;
  onDefend: () => void;
  onChargeImpulse: () => void;
  onAbsorbImpulse: () => void;
  onSkill: (skill: Skill) => void;
  onUseItem: (itemId: string) => void;
  onRequestDungeonExtract?: (item: Item) => void;
  showFleeAction: boolean;
  onFlee: () => void;
}

export const BattleActionsHtml: React.FC<{
  config: BattleActionsConfig;
  player: Player;
  isMobile?: boolean;
  isSelecting?: boolean;
}> = ({ config, player, isMobile = false, isSelecting = false }) => {
  const [activeMenu, setActiveMenu] = React.useState<'skills' | 'items' | null>(null);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [infoPopup, setInfoPopup] = React.useState<{ type: 'skill' | 'item'; id: string } | null>(null);
  const [pressedBtn, setPressedBtn] = React.useState<string | null>(null);
  const [showFleeConfirm, setShowFleeConfirm] = React.useState(false);
  const [fleeModalVisible, setFleeModalVisible] = React.useState(false);
  const [fleeBtnHover, setFleeBtnHover] = React.useState<'cancel' | 'flee' | null>(null);
  const [fleeBtnPress, setFleeBtnPress] = React.useState<'cancel' | 'flee' | null>(null);
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };
  const {
    isPlayerTurn,
    showSkillsAction,
    showItemsAction,
    impulseUnlocked,
    impulseCapacity,
    impulseReserveColors,
    classImpulseBaseColor,
    absorbGlowColor,
    usesMagicBasicAttack,
    usesBowBasicAttack,
    limitBattleActionsToBasics,
    shopItems,
    onAttack,
    onDefend,
    onChargeImpulse,
    onAbsorbImpulse,
    onSkill,
    onUseItem,
    onRequestDungeonExtract,
    showFleeAction,
    onFlee,
  } = config;

  const hasAbsorbed = player.impulsoAtivo > 0;
  const impulseGlowColor = hasAbsorbed ? absorbGlowColor : null;

  React.useEffect(() => {
    if (activeMenu) {
      const raf = requestAnimationFrame(() => setMenuVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setMenuVisible(false);
  }, [activeMenu]);

  React.useEffect(() => {
    if (!isPlayerTurn) {
      closeMenu();
    }
  }, [isPlayerTurn]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setActiveMenu(null);
    setInfoPopup(null);
  };

  React.useEffect(() => {
    if (showFleeConfirm) {
      const raf = requestAnimationFrame(() => setFleeModalVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setFleeModalVisible(false);
    setFleeBtnHover(null);
    setFleeBtnPress(null);
  }, [showFleeConfirm]);

  const press = (id: string) => setPressedBtn(id);
  const release = () => setPressedBtn(null);

  React.useEffect(() => {
    if (isMobile || activeMenu === null) return;
    const handler = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const timer = setTimeout(() => document.addEventListener('pointerdown', handler), 30);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handler);
    };
  }, [isMobile, activeMenu]);

  const sizing = isMobile
    ? { w: '268px', gap: '11px', btnFont: '15px', btnIcon: 52, btnIco: 24, btnGap: '14px', btnPad: '14px 18px 14px 12px', btnR: '20px', btnIcoR: 14, absFont: '15px', absIco: 20, absSub: '11px', dotW: '30px', dotH: '11px', dotGap: '6px', absGap: '11px', absPad: '13px 18px', absIconS: 40, absIconR: 12 }
    : { w: '155px', gap: '4px', btnFont: '9px', btnIcon: 26, btnIco: 13, btnGap: '7px', btnPad: '6px 9px 6px 6px', btnR: '10px', btnIcoR: 7, absFont: '9px', absIco: 11, absSub: '7px', dotW: '16px', dotH: '5px', dotGap: '3px', absGap: '6px', absPad: '6px 9px', absIconS: 20, absIconR: 6 };

  const btn = (id: string, color: string, disabled: boolean, onClick: () => void, icon: React.ReactNode, label: string, forceColor?: string) => {
    const isPressed = pressedBtn === id && !disabled;
    const glowColor = forceColor ?? (impulseGlowColor && !disabled ? impulseGlowColor : null);
    const effectiveColor = glowColor ?? color;
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        onPointerDown={() => !disabled && press(id)}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        style={{
          display: 'flex', alignItems: 'center', gap: sizing.btnGap,
          background: 'rgba(8,5,22,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: `1.5px solid ${disabled ? 'rgba(255,255,255,0.10)' : effectiveColor + '70'}`,
          borderRadius: sizing.btnR, padding: sizing.btnPad,
          cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.42 : 1,
          boxShadow: disabled
            ? '0 4px 12px rgba(0,0,0,0.25)'
            : glowColor
              ? `0 0 22px ${glowColor}55, 0 0 8px ${glowColor}33, 0 4px 18px rgba(0,0,0,0.35)`
              : `0 0 18px ${color}22, 0 4px 16px rgba(0,0,0,0.35)`,
          transform: isPressed ? 'scale(0.92)' : 'scale(1)',
          transition: 'transform 0.13s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease, border-color 0.25s ease',
          width: '100%',
          ...font,
        }}
      >
        <div style={{
          width: sizing.btnIcon, height: sizing.btnIcon, borderRadius: sizing.btnIcoR, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: disabled ? 'rgba(255,255,255,0.05)' : glowColor ? `${glowColor}28` : `${color}22`,
          border: `1.5px solid ${disabled ? 'rgba(255,255,255,0.10)' : effectiveColor + '55'}`,
          color: disabled ? 'rgba(255,255,255,0.25)' : effectiveColor,
          boxShadow: glowColor && !disabled ? `0 0 14px ${glowColor}66` : 'none',
          transition: 'all 0.25s ease',
        }}>{icon}</div>
        <span style={{ fontSize: sizing.btnFont, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.11em', color: disabled ? 'rgba(255,255,255,0.28)' : '#fff', whiteSpace: 'nowrap' }}>{label}</span>
      </button>
    );
  };

  const skillIds = getPaddedBattleSkillIds(player);
  const { itemSlots: maxBattleItemSlots } = getBattleMenuSlotCounts(player.classId);
  const itemColor = '#fb923c';
  const itemSlots = player.equippedItemSlots ?? [];

  const rowSlotFont = isMobile ? '9px' : '8px';
  const rowNameFont = isMobile ? '13px' : '11px';
  const rowBadgeFont = isMobile ? '9px' : '8px';
  const rowIconSize = isMobile ? 34 : 26;

  const skillRows = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {skillIds.map((skillId, index) => {
        const skill = skillId ? player.skills.find((entry) => entry.id === skillId) : null;
        const typeColor = skill?.type === 'physical' ? '#f87171' : skill?.type === 'magic' ? '#c4b5fd' : '#86efac';
        const typeBg = skill?.type === 'physical' ? 'rgba(248,113,113,0.16)' : skill?.type === 'magic' ? 'rgba(196,181,253,0.16)' : 'rgba(134,239,172,0.16)';
        const typeLabel = skill?.type === 'physical' ? 'Físico' : skill?.type === 'magic' ? 'Magia' : 'Cura';
        const TypeIcon = skill?.type === 'physical' ? <Sword size={13} /> : skill?.type === 'magic' ? <Sparkles size={13} /> : <Heart size={13} />;
        const resourceCost = skill?.resourceEffect?.cost ?? 0;
        const hasResource = player.classResource.value >= resourceCost;
        const manaCost = skill ? (player.impulsoAtivo >= 1 ? Math.max(1, Math.floor(skill.manaCost * 0.7)) : skill.manaCost) : 0;
        const canCast = !!skill && isPlayerTurn && player.stats.mp >= manaCost && hasResource;
        const isEmpty = !skill;
        const infoOpen = infoPopup?.type === 'skill' && infoPopup?.id === skillId && !!skill;

        return (
          <div key={index}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '4px' }}>
              <button
                onClick={() => {
                  if (skill && canCast) {
                    onSkill(skill);
                    closeMenu();
                  }
                }}
                disabled={!canCast}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', borderRadius: '10px', border: isEmpty ? '1px solid rgba(255,255,255,0.09)' : canCast ? `1.5px solid ${typeColor}55` : '1px solid rgba(255,255,255,0.09)', background: isEmpty ? 'rgba(0,0,0,0.18)' : canCast ? typeBg : 'rgba(0,0,0,0.28)', padding: '7px 10px', flex: 1, minWidth: 0, cursor: canCast ? 'pointer' : 'default', textAlign: 'left', opacity: !isEmpty && !canCast ? 0.5 : 1, ...font }}
              >
                <div style={{ width: rowIconSize, height: rowIconSize, flexShrink: 0, borderRadius: 7, border: isEmpty ? '1px solid rgba(255,255,255,0.10)' : `1.5px solid ${typeColor}55`, background: isEmpty ? 'rgba(0,0,0,0.25)' : `${typeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isEmpty ? 'rgba(255,255,255,0.20)' : typeColor }}>{skill ? TypeIcon : <Sparkles size={12} />}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: rowSlotFont, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>Slot {index + 1}</div>
                  <div style={{ fontSize: rowNameFont, fontWeight: 900, color: skill ? '#fff' : 'rgba(255,255,255,0.30)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{skill ? skill.name : 'Vazio'}</div>
                  {skill && <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '3px' }}>
                    <span style={{ fontSize: rowBadgeFont, fontWeight: 800, padding: '2px 5px', borderRadius: '99px', background: `${typeColor}20`, border: `1px solid ${typeColor}44`, color: typeColor, lineHeight: 1 }}>{typeLabel}</span>
                    <span style={{ fontSize: rowBadgeFont, fontWeight: 700, padding: '2px 5px', borderRadius: '99px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.38)', color: '#38bdf8', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Zap size={8} />{manaCost} MP</span>
                    {resourceCost > 0 && <span style={{ fontSize: rowBadgeFont, fontWeight: 700, padding: '2px 5px', borderRadius: '99px', background: hasResource ? `${player.classResource.color}20` : 'rgba(239,68,68,0.15)', border: `1px solid ${hasResource ? player.classResource.color + '44' : 'rgba(239,68,68,0.35)'}`, color: hasResource ? player.classResource.color : '#f87171', lineHeight: 1 }}>{resourceCost} {skill.resourceLabel || player.classResource.name}</span>}
                  </div>}
                </div>
              </button>
              <button onClick={(event) => { event.stopPropagation(); setInfoPopup((previous) => (previous?.id === skillId && previous?.type === 'skill') ? null : (skill ? { type: 'skill', id: skillId } : null)); }} disabled={!skill} style={{ width: 28, flexShrink: 0, borderRadius: '8px', border: skill ? `1px solid ${typeColor}44` : '1px solid rgba(255,255,255,0.08)', background: infoOpen ? `${typeColor}25` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: skill ? 'pointer' : 'default', color: skill ? typeColor : 'rgba(255,255,255,0.18)', alignSelf: 'stretch' }}>
                <Info size={11} />
              </button>
            </div>
            {infoOpen && <div style={{ marginTop: '4px', borderRadius: '9px', background: `${typeColor}10`, border: `1px solid ${typeColor}33`, padding: '7px 9px' }}>
              <div style={{ fontSize: rowBadgeFont, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: typeColor, marginBottom: '3px' }}>{skill!.name}</div>
              <div style={{ fontSize: rowSlotFont, color: 'rgba(255,255,255,0.80)', lineHeight: 1.5 }}>{skill!.description}</div>
            </div>}
          </div>
        );
      })}
    </div>
  );

  const itemRows = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: maxBattleItemSlots }, (_, index) => {
        const slot = itemSlots[index] ?? { itemId: '', qty: 0 };
        const isEmpty = !slot.itemId;
        const hasItem = !isEmpty && slot.qty > 0;
        const itemDef = isEmpty ? null : (ALL_ITEMS.find((entry) => entry.id === slot.itemId) ?? shopItems.find((entry) => entry.id === slot.itemId) ?? null);
        const isDungeonRecall = slot.itemId === 'pot_dg_recall';
        const infoOpen = infoPopup?.type === 'item' && infoPopup?.id === slot.itemId && !!itemDef;
        const badges = itemDef ? getBattleItemBadges(itemDef, 'compact') : [];
        return (
          <div key={index}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '4px' }}>
              <button disabled={!isPlayerTurn || isEmpty || slot.qty <= 0} onClick={() => { if (!hasItem || !itemDef) return; if (isDungeonRecall && onRequestDungeonExtract) { onRequestDungeonExtract(itemDef); closeMenu(); return; } onUseItem(slot.itemId); closeMenu(); }} style={{ display: 'flex', alignItems: 'center', gap: '9px', borderRadius: '10px', border: hasItem ? `1.5px solid ${itemColor}55` : '1px solid rgba(255,255,255,0.09)', background: hasItem ? 'rgba(251,146,60,0.14)' : 'rgba(0,0,0,0.18)', padding: '7px 10px', flex: 1, minWidth: 0, cursor: hasItem ? 'pointer' : 'default', textAlign: 'left', opacity: isEmpty ? 0.38 : !isPlayerTurn ? 0.55 : 1, ...font }}>
                <div style={{ width: rowIconSize, height: rowIconSize, flexShrink: 0, borderRadius: 7, border: hasItem ? `1.5px solid ${itemColor}55` : '1px solid rgba(255,255,255,0.10)', background: hasItem ? `${itemColor}22` : 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasItem ? itemColor : 'rgba(255,255,255,0.20)', fontSize: '16px' }}>
                  {itemDef ? (itemDef.iconImage ? <img src={itemDef.iconImage} style={{ width: 18, height: 18, objectFit: 'contain' }} draggable={false} alt={itemDef.name} /> : <span style={{ lineHeight: 1 }}>{itemDef.icon}</span>) : <FlaskConical size={12} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: rowSlotFont, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>Slot {index + 1}</div>
                  <div style={{ fontSize: rowNameFont, fontWeight: 900, color: hasItem ? '#fff' : 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{isEmpty ? 'Vazio' : itemDef?.name ?? slot.itemId}</div>
                  {hasItem && (
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '3px', alignItems: 'center' }}>
                      <span style={{ fontSize: rowBadgeFont, fontWeight: 800, padding: '2px 5px', borderRadius: '99px', background: `${itemColor}20`, border: `1px solid ${itemColor}44`, color: itemColor, lineHeight: 1 }}>{slot.qty}x</span>
                      {badges.map((badge, badgeIndex) => (
                        <span key={badgeIndex} style={{ fontSize: rowBadgeFont, fontWeight: 800, padding: '2px 5px', borderRadius: '99px', background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, lineHeight: 1 }}>{badge.label}</span>
                      ))}
                    </div>
                  )}
                  {!isEmpty && slot.qty === 0 && <span style={{ fontSize: rowBadgeFont, fontWeight: 800, color: 'rgba(255,255,255,0.30)', lineHeight: 1 }}>Esgotado</span>}
                </div>
              </button>
              {itemDef && <button onClick={(event) => { event.stopPropagation(); setInfoPopup((previous) => (previous?.id === slot.itemId && previous?.type === 'item') ? null : { type: 'item', id: slot.itemId }); }} style={{ width: 28, flexShrink: 0, borderRadius: '8px', border: `1px solid ${itemColor}44`, background: infoOpen ? `${itemColor}25` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: itemColor, alignSelf: 'stretch' }}>
                <Info size={11} />
              </button>}
            </div>
            {infoOpen && <div style={{ marginTop: '4px', borderRadius: '9px', background: `${itemColor}10`, border: `1px solid ${itemColor}33`, padding: '7px 9px' }}>
              <div style={{ fontSize: rowBadgeFont, fontWeight: 900, textTransform: 'uppercase', color: itemColor, marginBottom: '3px' }}>{itemDef!.name}</div>
              <div style={{ fontSize: rowSlotFont, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>{itemDef!.description}</div>
            </div>}
          </div>
        );
      })}
    </div>
  );

  const backdropStyle: React.CSSProperties = { position: 'fixed', inset: '0', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' };
  const mobileCardStyle: React.CSSProperties = { width: 'min(92vw, 390px)', borderRadius: '26px', background: 'rgba(10,6,26,0.72)', backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)', border: '1px solid rgba(255,255,255,0.20)', padding: '24px', boxShadow: '0 32px 80px rgba(0,0,0,0.45)', transform: menuVisible ? 'scale(1)' : 'scale(0.80)', opacity: menuVisible ? 1 : 0, transition: 'transform 0.24s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease', ...font };
  const desktopDropdownStyle: React.CSSProperties = { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 50, width: '260px', borderRadius: '16px', background: 'rgba(8,5,22,0.88)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.18)', padding: '12px', boxShadow: '0 20px 56px rgba(0,0,0,0.60)', transform: menuVisible ? 'scale(1)' : 'scale(0.90)', opacity: menuVisible ? 1 : 0, transformOrigin: 'bottom left', transition: 'transform 0.20s cubic-bezier(0.34,1.56,0.64,1), opacity 0.16s ease', ...font };
  const desktopDropdownHeader = (title: string, icon: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>{icon}{title}</span>
      <button onClick={closeMenu} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
    </div>
  );

  return (
    <div ref={containerRef} style={{
      display: 'flex', flexDirection: 'column', gap: sizing.gap, width: sizing.w, ...font,
      opacity: isPlayerTurn && !isSelecting ? 1 : 0,
      transform: isPlayerTurn && !isSelecting ? 'translateY(0px) scale(1)' : isSelecting ? 'translateY(6px) scale(0.95)' : 'translateY(10px) scale(0.94)',
      transition: isPlayerTurn ? 'opacity 0.22s ease-in, transform 0.22s ease-in' : 'opacity 0.18s ease-in, transform 0.18s ease-in',
      pointerEvents: isPlayerTurn && !isSelecting ? 'auto' : 'none',
    }}>
      {isMobile && showSkillsAction && !limitBattleActionsToBasics && activeMenu === 'skills' && createPortal(
        <div style={backdropStyle} onClick={closeMenu}>
          <div style={mobileCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.60)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16} style={{ color: '#c4b5fd' }} /> Habilidades</span>
              <button onClick={closeMenu} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '10px', padding: '7px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.60)', display: 'flex', alignItems: 'center' }}><X size={15} /></button>
            </div>
            {skillRows}
          </div>
        </div>,
        document.body,
      )}

      {isMobile && showItemsAction && !limitBattleActionsToBasics && activeMenu === 'items' && createPortal(
        <div style={backdropStyle} onClick={closeMenu}>
          <div style={mobileCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.65)' }}><FlaskConical size={16} color={itemColor} /> Itens de Batalha</span>
              <button onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer' }}><X size={15} /></button>
            </div>
            {itemRows}
          </div>
        </div>,
        document.body,
      )}

      {impulseUnlocked && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: sizing.dotGap, marginBottom: '2px' }}>
          {Array.from({ length: impulseCapacity }, (_, slot) => {
            const filled = player.impulso > slot;
            return <span key={slot} style={{ display: 'inline-block', width: sizing.dotW, height: sizing.dotH, borderRadius: '5px', border: filled ? '1.5px solid rgba(255,255,255,0.85)' : '1.5px solid rgba(255,255,255,0.18)', background: filled ? `linear-gradient(135deg,${impulseReserveColors[slot]},${impulseReserveColors[slot]}cc)` : 'rgba(255,255,255,0.05)', boxShadow: filled ? `0 0 8px ${impulseReserveColors[slot]}` : 'none', transition: 'all 0.25s ease' }} />;
          })}
        </div>
      )}

      {impulseUnlocked && player.impulso > 0 && (() => {
        const disabled = !isPlayerTurn || player.impulsoAtivo >= impulseCapacity;
        const isPressed = pressedBtn === 'absorver' && !disabled;
        return (
          <button onClick={() => { closeMenu(); onAbsorbImpulse(); }} disabled={disabled} onPointerDown={() => !disabled && press('absorver')} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: sizing.absGap, borderRadius: sizing.btnR, padding: sizing.absPad, background: disabled ? `${absorbGlowColor}08` : `linear-gradient(135deg, ${absorbGlowColor}28, ${absorbGlowColor}14)`, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: disabled ? `1.5px solid ${absorbGlowColor}22` : `1.5px solid ${absorbGlowColor}88`, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, boxShadow: disabled ? 'none' : `0 0 20px ${absorbGlowColor}55, 0 0 8px ${absorbGlowColor}33, 0 4px 16px rgba(0,0,0,0.30)`, transform: isPressed ? 'scale(0.92)' : 'scale(1)', transition: 'transform 0.13s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease', width: '100%', ...font }}>
            <div style={{ width: sizing.absIconS, height: sizing.absIconS, borderRadius: sizing.absIconR, display: 'flex', alignItems: 'center', justifyContent: 'center', background: disabled ? `${absorbGlowColor}12` : `${absorbGlowColor}35`, border: `1.5px solid ${disabled ? absorbGlowColor + '28' : absorbGlowColor + '77'}`, color: disabled ? `${absorbGlowColor}66` : absorbGlowColor, boxShadow: disabled ? 'none' : `0 0 12px ${absorbGlowColor}55`, flexShrink: 0 }}>
              <Zap size={sizing.absIco} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: sizing.absFont, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.10em', color: disabled ? `${absorbGlowColor}66` : '#fff', lineHeight: 1.1 }}>Absorver</span>
              <span style={{ fontSize: sizing.absSub, fontWeight: 700, color: disabled ? `${absorbGlowColor}44` : absorbGlowColor, letterSpacing: '0.08em', lineHeight: 1.2 }}>Ativar impulso</span>
            </div>
          </button>
        );
      })()}

      {impulseUnlocked && (() => {
        const disabled = !isPlayerTurn || player.impulso >= impulseCapacity;
        return btn('imp', classImpulseBaseColor, disabled, () => { closeMenu(); onChargeImpulse(); }, <Zap size={sizing.btnIco} />, 'IMPULSO', classImpulseBaseColor);
      })()}

      {btn('atk', '#f43f5e', !isPlayerTurn, () => { closeMenu(); onAttack(); }, usesMagicBasicAttack ? <Sparkles size={sizing.btnIco} /> : usesBowBasicAttack ? <Crosshair size={sizing.btnIco} /> : <Sword size={sizing.btnIco} />, usesMagicBasicAttack ? 'MAGIA' : 'ATACAR')}

      {btn('def', '#60a5fa', !isPlayerTurn, () => { closeMenu(); onDefend(); }, <Shield size={sizing.btnIco} />, 'DEFESA')}

      {showSkillsAction && !limitBattleActionsToBasics && (() => {
        const skillsColor = '#a855f7';
        const disabled = !isPlayerTurn || skillIds.every((id) => !id);
        if (!isMobile) {
          return (
            <div style={{ position: 'relative' }}>
              {activeMenu === 'skills' && <div style={desktopDropdownStyle}>{desktopDropdownHeader('Habilidades', <Sparkles size={13} style={{ color: '#c4b5fd' }} />)}{skillRows}</div>}
              {btn('ski', skillsColor, disabled, () => setActiveMenu((previous) => previous === 'skills' ? null : 'skills'), <Sparkles size={sizing.btnIco} />, 'HABILIDADES')}
            </div>
          );
        }
        return btn('ski', skillsColor, disabled, () => setActiveMenu((previous) => previous === 'skills' ? null : 'skills'), <Sparkles size={sizing.btnIco} />, 'HABILIDADES');
      })()}

      {showItemsAction && !limitBattleActionsToBasics && (() => {
        const disabled = !isPlayerTurn || itemSlots.every((slot) => !slot.itemId || slot.qty <= 0);
        if (!isMobile) {
          return (
            <div style={{ position: 'relative' }}>
              {activeMenu === 'items' && <div style={desktopDropdownStyle}>{desktopDropdownHeader('Itens de Batalha', <FlaskConical size={12} color={itemColor} />)}{itemRows}</div>}
              {btn('itm', itemColor, disabled, () => { setInfoPopup(null); setActiveMenu((previous) => previous === 'items' ? null : 'items'); }, <FlaskConical size={sizing.btnIco} />, 'ITENS', itemColor)}
            </div>
          );
        }
        return btn('itm', itemColor, disabled, () => { setInfoPopup(null); setActiveMenu((previous) => previous === 'items' ? null : 'items'); }, <FlaskConical size={sizing.btnIco} />, 'ITENS', itemColor);
      })()}

      {showFleeAction && showFleeConfirm && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fleeModalVisible ? 'rgba(0,0,0,0.52)' : 'rgba(0,0,0,0)', backdropFilter: fleeModalVisible ? 'blur(14px)' : 'blur(0px)', WebkitBackdropFilter: fleeModalVisible ? 'blur(14px)' : 'blur(0px)', transition: 'background 0.22s ease, backdrop-filter 0.22s ease, -webkit-backdrop-filter 0.22s ease' }} onClick={() => setShowFleeConfirm(false)}>
          <style>{`@keyframes _flee_icon { 0%,100%{transform:scale(1) rotate(0deg)} 35%{transform:scale(1.18) rotate(-10deg)} 65%{transform:scale(1.09) rotate(5deg)} }`}</style>
          <div style={{ width: 'min(88vw,320px)', borderRadius: '24px', background: 'rgba(10,6,24,0.92)', backdropFilter: 'blur(44px)', WebkitBackdropFilter: 'blur(44px)', border: '1px solid rgba(156,163,175,0.26)', padding: '28px 22px 22px', boxShadow: '0 28px 72px rgba(0,0,0,0.65)', transform: fleeModalVisible ? 'scale(1) translateY(0px)' : 'scale(0.86) translateY(22px)', opacity: fleeModalVisible ? 1 : 0, transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease', ...font }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 16, background: 'rgba(156,163,175,0.11)', border: '1.5px solid rgba(156,163,175,0.28)', margin: '0 auto 18px', color: '#9ca3af', animation: fleeModalVisible ? '_flee_icon 0.52s ease 0.16s both' : 'none' }}>
              <LogOut size={24} />
            </div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#f3f4f6', textAlign: 'center', marginBottom: '8px', letterSpacing: '-0.01em' }}>Fugir da batalha?</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.44)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.55 }}>Você vai gastar 50 de ouro para escapar.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onMouseEnter={() => setFleeBtnHover('cancel')} onMouseLeave={() => { setFleeBtnHover(null); setFleeBtnPress(null); }} onPointerDown={() => setFleeBtnPress('cancel')} onPointerUp={() => setFleeBtnPress(null)} onClick={() => setShowFleeConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.15)', background: fleeBtnHover === 'cancel' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)', cursor: 'pointer', color: 'rgba(255,255,255,0.62)', fontSize: '13px', fontWeight: 800, transform: fleeBtnPress === 'cancel' ? 'scale(0.94)' : 'scale(1)', transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), background 0.15s ease', outline: 'none', ...font }}>Cancelar</button>
              <button onMouseEnter={() => setFleeBtnHover('flee')} onMouseLeave={() => { setFleeBtnHover(null); setFleeBtnPress(null); }} onPointerDown={() => setFleeBtnPress('flee')} onPointerUp={() => setFleeBtnPress(null)} onClick={() => { setShowFleeConfirm(false); onFlee(); }} style={{ flex: 1, padding: '12px', borderRadius: '13px', border: '1px solid rgba(156,163,175,0.42)', background: fleeBtnHover === 'flee' ? 'rgba(156,163,175,0.26)' : 'rgba(156,163,175,0.13)', cursor: 'pointer', color: '#e5e7eb', fontSize: '13px', fontWeight: 900, transform: fleeBtnPress === 'flee' ? 'scale(0.94)' : fleeBtnHover === 'flee' ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), background 0.15s ease, box-shadow 0.15s ease', boxShadow: fleeBtnHover === 'flee' ? '0 4px 18px rgba(156,163,175,0.22)' : 'none', outline: 'none', ...font }}>Fugir</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showFleeAction && btn('fug', '#9ca3af', !isPlayerTurn, () => setShowFleeConfirm(true), <LogOut size={sizing.btnIco} />, 'FUGIR', '#9ca3af')}
    </div>
  );
};