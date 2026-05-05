import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Item } from '../../types';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';
import { pushInputLayer } from '../../game/mechanics/inputManager';
import { ItemIcon, getRarityLabel } from '../ui/game-display';

type DetailChip = {
  label: string;
  value: string;
  color: string;
  bg: string;
};

type DetailBadge = {
  label: string;
  color: string;
  bg: string;
  border: string;
};

type ItemDetailPortalModalProps = {
  item: Item;
  icon: React.ReactNode;
  badges: DetailBadge[];
  chips: DetailChip[];
  maxWidth: number;
  onClose: () => void;
  footerHint: string;
};

const overlayFont: React.CSSProperties = {
  fontFamily: "'Segoe UI',system-ui,sans-serif",
};

const getItemRarityTone = (item: Item) => {
  const rarity = item.rarity ?? '';
  return {
    rarity,
    color: rarity === 'gold' ? '#fbbf24' : rarity === 'silver' ? '#94a3b8' : '#d4a56a',
  };
};

const useBackToClose = (onClose: () => void) => {
  useEffect(() => pushInputLayer((action) => {
    if (action === 'BACK') {
      onClose();
    }
  }), [onClose]);
};

const ItemDetailPortalModal: React.FC<ItemDetailPortalModalProps> = ({
  item,
  icon,
  badges,
  chips,
  maxWidth,
  onClose,
  footerHint,
}) => {
  const { color: rarityColor } = getItemRarityTone(item);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'rpg-modal-overlay-in 0.22s ease both',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          ...overlayFont,
          width: '100%',
          maxWidth: `${maxWidth}px`,
          background: 'rgba(10,7,28,0.92)',
          border: `1.5px solid ${rarityColor}55`,
          borderRadius: '20px',
          boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${rarityColor}22`,
          overflow: 'hidden',
          animation: 'rpg-modal-panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 18px 12px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              flexShrink: 0,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: '0.14em',
                    padding: '2px 8px',
                    borderRadius: 99,
                    border: badge.border,
                    background: badge.bg,
                    color: badge.color,
                    textTransform: 'uppercase',
                  }}
                >
                  {badge.label}
                </span>
              ))}
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1.2,
                marginTop: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.name}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 18px 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
          {item.description}
        </div>

        {chips.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: chips.length === 1 ? '1fr' : 'repeat(2,1fr)', gap: 8, padding: '0 18px 18px' }}>
            {chips.map((chip) => (
              <div key={`${chip.label}-${chip.value}`} style={{ borderRadius: 12, border: `1px solid ${chip.color}30`, background: chip.bg, padding: '8px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.40)' }}>
                  {chip.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: chip.color, marginTop: 2 }}>
                  {chip.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>
            {footerHint}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

const getBattleItemDetailChips = (item: Item): DetailChip[] => {
  const lower = (item.description ?? '').toLowerCase();

  if (item.id === 'pot_atk') {
    return [
      { label: 'ATQ', value: `+${Math.round((item.value as number) * 100)}%`, color: '#f87171', bg: 'rgba(127,29,29,0.35)' },
      { label: 'TURNOS', value: `${item.duration ?? 3}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.35)' },
    ];
  }

  if (item.id === 'pot_def') {
    return [
      { label: 'DEF', value: `+${Math.round((item.value as number) * 100)}%`, color: '#fb923c', bg: 'rgba(154,52,18,0.35)' },
      { label: 'TURNOS', value: `${item.duration ?? 3}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.35)' },
    ];
  }

  if ((item.duration ?? 0) > 0 && !item.id.startsWith('pot_atk') && !item.id.startsWith('pot_def')) {
    return [
      { label: 'BOOST', value: 'Ativo', color: '#fcd34d', bg: 'rgba(120,53,15,0.35)' },
      { label: 'TURNOS', value: `${item.duration}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.25)' },
    ];
  }

  if (
    lower.includes('mp')
    || lower.includes('mana')
    || lower.includes('energia')
    || item.id === 'pot_2'
    || item.id === 'pot_mana_2'
    || item.id === 'pot_mana_3'
    || item.id === 'pot_dg_mana'
  ) {
    return [{ label: 'MANA', value: `+${item.value}`, color: '#7dd3fc', bg: 'rgba(7,89,133,0.35)' }];
  }

  if (lower.includes('hp') || lower.includes('vida') || lower.includes('cura') || lower.includes('restaura')) {
    return [{ label: 'VIDA', value: `+${item.value}`, color: '#86efac', bg: 'rgba(20,83,45,0.35)' }];
  }

  return [{ label: 'ESPECIAL', value: 'Ativo', color: '#c4b5fd', bg: 'rgba(76,29,149,0.35)' }];
};

const getHeroItemDetailChips = (item: Item): DetailChip[] => {
  const chips: DetailChip[] = [];

  if (item.type === 'weapon') {
    chips.push({ label: 'ATQ', value: `+${item.value}`, color: '#f87171', bg: 'rgba(127,29,29,0.35)' });
    if ((item.magicBonus ?? 0) > 0) {
      chips.push({ label: 'MAG', value: `+${item.magicBonus}`, color: '#c4b5fd', bg: 'rgba(76,29,149,0.35)' });
    }
    return chips;
  }

  if (['armor', 'helmet', 'legs', 'shield'].includes(item.type)) {
    const bonuses = getEquipmentBonuses(item);
    if (bonuses.def > 0) chips.push({ label: 'DEF', value: `+${bonuses.def}`, color: '#fb923c', bg: 'rgba(154,52,18,0.35)' });
    if (bonuses.maxHp > 0) chips.push({ label: 'VIDA', value: `+${bonuses.maxHp}`, color: '#86efac', bg: 'rgba(20,83,45,0.35)' });
    if (bonuses.maxMp > 0) chips.push({ label: 'MANA', value: `+${bonuses.maxMp}`, color: '#7dd3fc', bg: 'rgba(7,89,133,0.35)' });
    if (bonuses.speed > 0) chips.push({ label: 'VEL', value: `+${bonuses.speed}`, color: '#d8b4fe', bg: 'rgba(88,28,135,0.35)' });
  }

  return chips;
};

export const BattleItemDetailOverlay: React.FC<{
  item: Item;
  slotIndex: number;
  qty: number;
  onClose: () => void;
}> = ({ item, slotIndex, qty, onClose }) => {
  useBackToClose(onClose);

  const { color: rarityColor } = getItemRarityTone(item);
  const rarityText = item.rarity === 'gold' ? 'Lendario' : item.rarity === 'silver' ? 'Raro' : 'Comum';

  return (
    <ItemDetailPortalModal
      item={item}
      icon={item.iconImage ? <img src={item.iconImage} style={{ width: 40, height: 40, objectFit: 'contain' }} draggable={false} alt={item.name} /> : item.icon}
      badges={[
        { label: rarityText, color: rarityColor, bg: 'transparent', border: '1px solid transparent' },
        { label: `Slot ${slotIndex + 1}`, color: '#fb923c', bg: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.30)' },
        { label: `x${qty}`, color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' },
      ]}
      chips={getBattleItemDetailChips(item)}
      maxWidth={340}
      onClose={onClose}
      footerHint="B - Fechar"
    />
  );
};

export const HeroItemDetailOverlay: React.FC<{
  item: Item;
  onClose: () => void;
}> = ({ item, onClose }) => {
  useBackToClose(onClose);

  const { color: rarityColor } = getItemRarityTone(item);
  const rarityText = getRarityLabel(item.rarity as any) ?? 'Comum';

  return (
    <ItemDetailPortalModal
      item={item}
      icon={<ItemIcon item={item} emojiClassName="" />}
      badges={[
        { label: rarityText, color: rarityColor, bg: 'transparent', border: '1px solid transparent' },
        { label: 'Equipado', color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.30)' },
      ]}
      chips={getHeroItemDetailChips(item)}
      maxWidth={380}
      onClose={onClose}
      footerHint="B / O - Fechar"
    />
  );
};
