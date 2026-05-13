import React from 'react';
import { FlaskConical, Heart, Info, Sparkles, Sword, X, Zap } from 'lucide-react';
import { ALL_ITEMS } from '../../constants';
import { getBattleItemBadges, getBattleMenuSlotCounts, getPaddedBattleSkillIds } from '../battle/battleMenuModels';
import { Item, Player, Skill } from '../../types';

export type BattleInfoPopup = { type: 'skill' | 'item'; id: string } | null;

type SharedMenuProps = {
  battleInfoPopup: BattleInfoPopup;
  setBattleInfoPopup: React.Dispatch<React.SetStateAction<BattleInfoPopup>>;
};

type BattleSkillMenuProps = SharedMenuProps & {
  active: boolean;
  player: Player;
  isPlayerTurn: boolean;
  onClose: () => void;
  onSkill: (skill: Skill) => void;
};

export const BattleSkillMenu: React.FC<BattleSkillMenuProps> = ({
  active,
  battleInfoPopup,
  setBattleInfoPopup,
  player,
  isPlayerTurn,
  onClose,
  onSkill,
}) => {
  if (!active) {
    return null;
  }

  const ids = getPaddedBattleSkillIds(player);
  const { skillSlots: maxSlots } = getBattleMenuSlotCounts(player.classId);

  return (
    <div
      className="absolute bottom-full right-[-68px] z-40 mb-2 w-[min(84vw,300px)] animate-fade-in-down sm:right-0"
      style={{
        borderRadius: '16px',
        background: 'rgba(8,5,22,0.40)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.16)',
        padding: '12px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.40)',
        fontFamily: "'Segoe UI',system-ui,sans-serif",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 2px' }}>
        <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.40)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Sparkles size={12} style={{ color: '#c4b5fd' }} />
          Habilidades
        </span>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '7px', padding: '4px 7px', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', lineHeight: 1 }}
          aria-label="Fechar habilidades"
        >
          <X size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {Array.from({ length: maxSlots }, (_, index) => {
          const skillId = ids[index];
          const skill = skillId ? player.skills.find((entry) => entry.id === skillId) ?? null : null;
          const typeColor = skill?.type === 'physical' ? '#f87171' : skill?.type === 'magic' ? '#c4b5fd' : '#86efac';
          const typeBg = skill?.type === 'physical' ? 'rgba(248,113,113,0.14)' : skill?.type === 'magic' ? 'rgba(196,181,253,0.14)' : 'rgba(134,239,172,0.14)';
          const typeLabel = skill?.type === 'physical' ? 'Físico' : skill?.type === 'magic' ? 'Magia' : 'Cura';
          const TypeIcon = skill?.type === 'physical' ? <Sword size={28} /> : skill?.type === 'magic' ? <Sparkles size={28} /> : <Heart size={28} />;
          const requiredResource = skill?.resourceEffect?.cost ?? 0;
          const hasResource = player.classResource.value >= requiredResource;
          const effectiveManaCost = skill ? (player.impulsoAtivo >= 1
            ? Math.max(1, Math.floor(skill.manaCost * 0.7 * (1 - (player.cardBonuses.skillCostReduction ?? 0))))
            : Math.max(1, Math.floor(skill.manaCost * (1 - (player.cardBonuses.skillCostReduction ?? 0))))) : 0;
          const canCast = !!skill && isPlayerTurn && player.stats.mp >= effectiveManaCost && hasResource;
          const isEmpty = !skill;
          const isSkillInfoOpen = battleInfoPopup?.type === 'skill' && battleInfoPopup?.id === skillId && !!skill;

          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '3px', width: '100%', overflow: 'hidden' }}>
                <button
                  onClick={() => {
                    if (skill && canCast) {
                      onSkill(skill);
                      onClose();
                    }
                  }}
                  disabled={!canCast}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    borderRadius: '12px',
                    border: isEmpty ? '1px solid rgba(255,255,255,0.09)' : canCast ? `1.5px solid ${typeColor}55` : '1px solid rgba(255,255,255,0.09)',
                    background: isEmpty ? 'rgba(0,0,0,0.18)' : canCast ? typeBg : 'rgba(0,0,0,0.28)',
                    padding: '7px 9px',
                    boxSizing: 'border-box',
                    flex: 1,
                    minWidth: 0,
                    cursor: canCast ? 'pointer' : 'default',
                    textAlign: 'left',
                    opacity: !isEmpty && !canCast ? 0.5 : 1,
                    boxShadow: canCast ? `0 0 10px ${typeColor}18` : 'none',
                    transition: 'border 0.18s, background 0.18s',
                    fontFamily: "'Segoe UI',system-ui,sans-serif",
                  }}
                >
                  <div
                    style={{
                      width: '44px', height: '44px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isEmpty ? 'rgba(255,255,255,0.20)' : typeColor,
                      filter: skill && !skill.icon ? 'drop-shadow(0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(-0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(0 0.5px 0 rgba(255,255,255,0.7)) drop-shadow(0 -0.5px 0 rgba(255,255,255,0.7))' : undefined,
                    }}
                  >
                    {skill
                      ? skill.icon
                        ? <img src={skill.icon} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} alt="" />
                        : TypeIcon
                      : <Sparkles size={22} />
                    }
                  </div>
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.32)', lineHeight: 1 }}>Slot {index + 1}</div>
                    <div style={{ fontSize: '10px', fontWeight: 900, color: skill ? '#fff' : 'rgba(255,255,255,0.30)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                      {skill ? skill.name : 'Vazio'}
                    </div>
                    {skill && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '7px', fontWeight: 800, padding: '2px 6px', borderRadius: '99px', background: `${typeColor}20`, border: `1px solid ${typeColor}44`, color: typeColor, display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>
                          {typeLabel}
                        </span>
                        <span style={{ fontSize: '7px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.38)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>
                          <Zap size={9} />
                          {effectiveManaCost} MP
                        </span>
                        {requiredResource > 0 && (
                          <span style={{ fontSize: '7px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', background: hasResource ? `${player.classResource.color}20` : 'rgba(239,68,68,0.15)', border: `1px solid ${hasResource ? player.classResource.color + '44' : 'rgba(239,68,68,0.35)'}`, color: hasResource ? player.classResource.color : '#f87171', display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>
                            {requiredResource} {skill.resourceLabel || player.classResource.name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {skill && <span style={{ color: canCast ? `${typeColor}99` : 'rgba(255,255,255,0.18)', fontSize: '16px', flexShrink: 0 }}>›</span>}
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setBattleInfoPopup((previous) => (previous?.id === skillId && previous?.type === 'skill') ? null : (skill ? { type: 'skill', id: skillId } : null));
                  }}
                  disabled={!skill}
                  style={{ width: '32px', flexShrink: 0, borderRadius: '8px', border: skill ? `1px solid ${typeColor}44` : '1px solid rgba(255,255,255,0.08)', background: (battleInfoPopup?.id === skillId && battleInfoPopup?.type === 'skill') ? `${typeColor}25` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: skill ? 'pointer' : 'default', color: skill ? typeColor : 'rgba(255,255,255,0.18)', alignSelf: 'stretch' }}
                  aria-label="Info da habilidade"
                >
                  <Info size={12} />
                </button>
              </div>
              {isSkillInfoOpen && (
                <div style={{ marginTop: '3px', borderRadius: '10px', background: `${typeColor}10`, border: `1px solid ${typeColor}33`, padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: typeColor, lineHeight: 1 }}>{skill.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.78)', lineHeight: 1.4 }}>{skill.description}</span>
                  {(skill.damageMult ?? 0) > 0 && <span style={{ fontSize: '8px', fontWeight: 700, color: typeColor, lineHeight: 1 }}>⚔ Mult. dano: {skill.damageMult}×</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type BattleItemMenuProps = SharedMenuProps & {
  active: boolean;
  isMobile: boolean;
  player: Player;
  shopItems: Item[];
  isPlayerTurn: boolean;
  onClose: () => void;
  onUseItem: (itemId: string) => void;
  onRequestDungeonExtract: (item: Item) => void;
};

export const BattleItemMenu: React.FC<BattleItemMenuProps> = ({
  active,
  battleInfoPopup,
  setBattleInfoPopup,
  isMobile,
  player,
  shopItems,
  isPlayerTurn,
  onClose,
  onUseItem,
  onRequestDungeonExtract,
}) => {
  if (!active) {
    return null;
  }

  const slots = player.equippedItemSlots ?? [];
  const { itemSlots: maxItemSlots } = getBattleMenuSlotCounts(player.classId);
  const itemColor = '#fb923c';
  const itemBg = 'rgba(251,146,60,0.14)';

  return (
    <div
      className="absolute bottom-full right-0 z-40 mb-2 animate-fade-in-down"
      style={{ width: isMobile ? 'min(84vw, 300px)' : '300px', borderRadius: '18px', background: 'rgba(8,5,22,0.40)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.16)', padding: '12px', boxShadow: '0 24px 52px rgba(0,0,0,0.40)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.60)' }}>
          <FlaskConical size={12} color="#fb923c" />
          Itens de Batalha
        </span>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }} aria-label="Fechar itens">
          <X size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {Array.from({ length: maxItemSlots }, (_, index) => {
          const slot = slots[index] ?? { itemId: '', qty: 0 };
          const isEmpty = !slot.itemId;
          const hasItem = !isEmpty && slot.qty > 0;
          const itemDef = isEmpty ? null : (ALL_ITEMS.find((entry) => entry.id === slot.itemId) ?? shopItems.find((entry) => entry.id === slot.itemId) ?? null);
          const isDgRecall = slot.itemId === 'pot_dg_recall';
          const isItemInfoOpen = battleInfoPopup?.type === 'item' && battleInfoPopup?.id === slot.itemId && !!itemDef;

          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '3px', width: '100%', overflow: 'hidden' }}>
                <button
                  disabled={!isPlayerTurn || isEmpty || slot.qty <= 0}
                  onClick={() => {
                    if (!hasItem || !itemDef) {
                      return;
                    }
                    if (isDgRecall) {
                      onRequestDungeonExtract(itemDef);
                      onClose();
                      return;
                    }
                    onUseItem(slot.itemId);
                    onClose();
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    borderRadius: '13px',
                    border: hasItem ? `1.5px solid ${itemColor}55` : '1px solid rgba(255,255,255,0.09)',
                    background: hasItem ? itemBg : 'rgba(0,0,0,0.18)',
                    padding: '7px 9px',
                    boxSizing: 'border-box',
                    flex: 1,
                    minWidth: 0,
                    cursor: hasItem ? 'pointer' : 'default',
                    textAlign: 'left',
                    opacity: isEmpty || (!isPlayerTurn && hasItem) ? (isEmpty ? 0.38 : 0.55) : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ width: '44px', height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasItem ? itemColor : 'rgba(255,255,255,0.20)', fontSize: '28px', filter: hasItem ? 'drop-shadow(0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(-0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(0 0.5px 0 rgba(255,255,255,0.7)) drop-shadow(0 -0.5px 0 rgba(255,255,255,0.7))' : undefined }}>
                    {itemDef ? <span style={{ lineHeight: 1 }}>{itemDef.iconImage ? <img src={itemDef.iconImage} style={{ width: 32, height: 32, objectFit: 'contain' }} draggable={false} alt={itemDef.name} /> : itemDef.icon}</span> : <FlaskConical size={24} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontSize: '6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.32)', lineHeight: 1 }}>Slot {index + 1}</div>
                    <div style={{ fontSize: '10px', fontWeight: 900, color: hasItem ? '#fff' : 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                      {isEmpty ? 'Vazio' : itemDef?.name ?? slot.itemId}
                    </div>
                    {hasItem && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                        <span style={{ fontSize: '7px', fontWeight: 800, padding: '2px 6px', borderRadius: '99px', background: `${itemColor}20`, border: `1px solid ${itemColor}44`, color: itemColor, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
                          {slot.qty}×
                        </span>
                        {itemDef && getBattleItemBadges(itemDef, 'detailed').map((badge, badgeIndex) => (
                          <span key={badgeIndex} style={{ fontSize: '7px', fontWeight: 800, padding: '2px 6px', borderRadius: '99px', background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {!isEmpty && slot.qty === 0 && (
                      <span style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.30)', lineHeight: 1 }}>Esgotado</span>
                    )}
                  </div>
                  {hasItem && <span style={{ color: `${itemColor}80`, fontSize: '16px', flexShrink: 0 }}>›</span>}
                </button>
                {itemDef && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setBattleInfoPopup((previous) => (previous?.id === slot.itemId && previous?.type === 'item') ? null : { type: 'item', id: slot.itemId });
                    }}
                    style={{ width: '32px', flexShrink: 0, borderRadius: '8px', border: `1px solid ${itemColor}44`, background: (battleInfoPopup?.id === slot.itemId && battleInfoPopup?.type === 'item') ? `${itemColor}25` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: itemColor, alignSelf: 'stretch' }}
                    aria-label="Info do item"
                  >
                    <Info size={12} />
                  </button>
                )}
              </div>
              {isItemInfoOpen && (
                <div style={{ marginTop: '3px', borderRadius: '10px', background: `${itemColor}10`, border: `1px solid ${itemColor}33`, padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: itemColor, lineHeight: 1 }}>{itemDef.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{itemDef.description}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};