import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Crosshair,
  FlaskConical,
  Footprints,
  Heart,
  Info,
  Layers,
  Shield,
  Shirt,
  Sparkles,
  Swords,
  Sword,
  User,
  Wind,
  Clover,
  Zap,
} from 'lucide-react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

import { ALL_ITEMS, getClassSlots } from '../../constants';
import { getPlayerClassById } from '../../game/data/classes';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';
import { hasModalLayer, onAction, pushInputLayer } from '../../game/mechanics/inputManager';
import { useInputMode } from '../../game/hooks/useInputMode';
import type { Item, Player, PlayerClassId } from '../../types';
import { BattleItemDetailOverlay, HeroItemDetailOverlay } from './ItemDetailOverlays';

const HERO_CLASS_NAME_PT: Record<PlayerClassId, string> = {
  knight: 'Cavaleiro',
  barbarian: 'Barbaro',
  mage: 'Mago',
  ranger: 'Arqueiro',
  rogue: 'Ladino',
};

const INSPECT_CLASS_ICON: Record<PlayerClassId, React.ComponentType<{ size?: number }>> = {
  knight: Shield,
  barbarian: Sword,
  mage: Sparkles,
  ranger: Crosshair,
  rogue: Zap,
};

const SLOT_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  weapon: Sword,
  shield: Shield,
  helmet: Layers,
  armor: Shirt,
  legs: Footprints,
};

type EquipSlotKey = 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs';

type SlotBadge = { label: string; color: string; bg: string; border: string };

function getPotionSlotBadges(item: Item): SlotBadge[] {
  const lower = (item.description ?? '').toLowerCase();
  if (item.id === 'pot_2' || item.id === 'pot_mana_2' || item.id === 'pot_mana_3' || item.id === 'pot_dg_mana') {
    return [{ label: `+${item.value} MP`, color: '#7dd3fc', bg: 'rgba(7,89,133,0.35)', border: 'rgba(125,211,252,0.30)' }];
  }
  if (item.id === 'pot_atk') {
    return [
      { label: `+${Math.round((item.value as number) * 100)}% ATK`, color: '#f87171', bg: 'rgba(127,29,29,0.35)', border: 'rgba(248,113,113,0.30)' },
      { label: `${item.duration ?? 3} turnos`, color: '#fcd34d', bg: 'rgba(120,53,15,0.35)', border: 'rgba(252,211,77,0.30)' },
    ];
  }
  if (item.id === 'pot_def') {
    return [
      { label: `+${Math.round((item.value as number) * 100)}% DEF`, color: '#93c5fd', bg: 'rgba(30,58,95,0.35)', border: 'rgba(147,197,253,0.30)' },
      { label: `${item.duration ?? 3} turnos`, color: '#fcd34d', bg: 'rgba(120,53,15,0.35)', border: 'rgba(252,211,77,0.30)' },
    ];
  }
  if (lower.includes('hp') || lower.includes('vida') || lower.includes('cura') || lower.includes('restaura')) {
    return [{ label: `+${item.value} HP`, color: '#86efac', bg: 'rgba(20,83,45,0.35)', border: 'rgba(134,239,172,0.30)' }];
  }
  if (lower.includes('mp') || lower.includes('mana') || lower.includes('energia')) {
    return [{ label: `+${item.value} MP`, color: '#7dd3fc', bg: 'rgba(7,89,133,0.35)', border: 'rgba(125,211,252,0.30)' }];
  }
  if ((item.duration ?? 0) > 0) {
    return [
      { label: 'BOOST', color: '#fcd34d', bg: 'rgba(120,53,15,0.35)', border: 'rgba(252,211,77,0.30)' },
      { label: `${item.duration}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.25)', border: 'rgba(252,211,77,0.20)' },
    ];
  }
  return [{ label: 'ESPECIAL', color: '#c4b5fd', bg: 'rgba(76,29,149,0.35)', border: 'rgba(196,181,253,0.30)' }];
}

const SkillInfoModal: React.FC<{
  skill: any;
  uiProfile: string;
  onClose: () => void;
}> = ({ skill, uiProfile, onClose }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => pushInputLayer((action) => {
    if (action === 'BACK') {
      onCloseRef.current();
    }
  }), []);

  const typeColor = skill?.type === 'physical' ? '#f87171' : skill?.type === 'magic' ? '#c4b5fd' : '#86efac';
  const typeBorder = skill?.type === 'physical' ? 'rgba(248,113,113,0.30)' : skill?.type === 'magic' ? 'rgba(196,181,253,0.30)' : 'rgba(134,239,172,0.30)';
  const typeBg = skill?.type === 'physical' ? 'rgba(248,113,113,0.10)' : skill?.type === 'magic' ? 'rgba(196,181,253,0.10)' : 'rgba(134,239,172,0.10)';
  const typeLabel = skill?.type === 'physical' ? 'F\u00EDsico' : skill?.type === 'magic' ? 'Magia' : 'Cura';
  const TypeIcon = skill?.type === 'physical' ? <Sword size={26} /> : skill?.type === 'magic' ? <Sparkles size={26} /> : <Heart size={26} />;
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9200,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'rpg-modal-overlay-in 0.22s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...font,
          width: '100%',
          maxWidth: 360,
          background: 'rgba(10,7,28,0.95)',
          border: `1.5px solid ${typeColor}50`,
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: 'rpg-modal-panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 18px 12px', background: `linear-gradient(135deg, ${typeColor}10, transparent)` }}>
          <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 13, background: typeBg, border: `1.5px solid ${typeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeColor }}>
            {TypeIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.20em', padding: '2px 7px', borderRadius: 99, background: typeBg, border: `1px solid ${typeBorder}`, color: typeColor }}>
                {typeLabel}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.35)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Zap size={9} />
                {skill.manaCost} MP
              </span>
              {(skill.damageMult ?? 0) > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}>
                  ATQ {skill.damageMult}x
                </span>
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{skill.name}</div>
          </div>
        </div>

        <div style={{ padding: '4px 18px 16px', fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>{skill.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: '0 18px 18px' }}>
          <div style={{ borderRadius: 12, border: '1px solid rgba(56,189,248,0.25)', background: 'rgba(56,189,248,0.10)', padding: '8px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.40)' }}>CUSTO MP</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>{skill.manaCost}</div>
          </div>
          <div style={{ borderRadius: 12, border: `1px solid ${typeColor}25`, background: typeBg, padding: '8px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.40)' }}>{(skill.damageMult ?? 0) > 0 ? 'MULT. DANO' : 'TIPO'}</div>
            <div style={{ fontSize: (skill.damageMult ?? 0) > 0 ? 18 : 14, fontWeight: 900, color: typeColor, marginTop: 2 }}>{(skill.damageMult ?? 0) > 0 ? `${skill.damageMult}x` : typeLabel}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
            {uiProfile === 'gamepad' && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#c0392b', fontSize: 8, fontWeight: 900, color: '#fff', flexShrink: 0 }}>B</span>}
            Fechar
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const HeroProfileDetailModal: React.FC<{
  player: Player;
  uiProfile: string;
  onClose: () => void;
}> = ({ player, uiProfile, onClose }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [selectedEquipItem, setSelectedEquipItem] = useState<Item | null>(null);
  const [closeBtnHover, setCloseBtnHover] = useState(false);
  const [hoveredEquip, setHoveredEquip] = useState<string | null>(null);

  useEffect(() => pushInputLayer((action) => {
    if (action === 'BACK') {
      onCloseRef.current();
    }
  }), []);

  const playerClass = getPlayerClassById(player.classId);
  const accentColor = playerClass.visualProfile.secondaryColor;
  const primaryColor = playerClass.visualProfile.primaryColor;
  const auraColor = playerClass.visualProfile.auraColor;
  const classNamePt = HERO_CLASS_NAME_PT[player.classId as PlayerClassId] ?? player.classId;
  const ClassIcon = INSPECT_CLASS_ICON[player.classId as PlayerClassId] ?? User;
  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600;

  const equipmentCards: Array<{ key: EquipSlotKey; label: string; item: Item | null; Icon: React.ComponentType<{ size?: number; color?: string }> }> = [
    { key: 'weapon', label: 'Arma', item: player.equippedWeapon ?? null, Icon: Sword },
    { key: 'shield', label: 'Escudo', item: player.equippedShield ?? null, Icon: Shield },
    { key: 'helmet', label: 'Capacete', item: player.equippedHelmet ?? null, Icon: Layers },
    { key: 'armor', label: 'Armadura', item: player.equippedArmor ?? null, Icon: Shirt },
    { key: 'legs', label: 'Pernas', item: player.equippedLegs ?? null, Icon: Footprints },
  ];

  const resourceBars = [
    { label: 'HP', value: player.stats.hp, max: player.stats.maxHp, color: '#4ade80', gradient: 'linear-gradient(90deg,#166534,#4ade80)' },
    { label: 'MP', value: player.stats.mp, max: player.stats.maxMp, color: '#38bdf8', gradient: 'linear-gradient(90deg,#1d4ed8,#38bdf8)' },
    { label: 'XP', value: player.xp, max: player.xpToNext, color: '#fbbf24', gradient: 'linear-gradient(90deg,#b45309,#fbbf24)' },
  ];

  const attributeRows = [
    { label: 'ATQ', value: player.stats.atk, color: '#ef4444', Icon: Swords },
    { label: 'DEF', value: player.stats.def, color: '#3b82f6', Icon: Shield },
    { label: 'MAG', value: player.stats.magic, color: '#a855f7', Icon: Sparkles },
    { label: 'VEL', value: player.stats.speed, color: '#22c55e', Icon: Wind },
    { label: 'SRT', value: player.stats.luck, color: '#fbbf24', Icon: Clover },
  ];

  const portal = createPortal(
    <div
      onClick={selectedEquipItem ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9250,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'rpg-modal-overlay-in 0.22s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...font,
          width: '100%',
          maxWidth: isMobile ? 420 : 460,
          background: 'rgba(7,4,20,0.52)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          border: `1px solid ${accentColor}30`,
          borderRadius: 22,
          boxShadow: `0 32px 96px rgba(0,0,0,0.68), 0 0 0 1px ${accentColor}14, inset 0 1px 0 rgba(255,255,255,0.08)`,
          overflow: 'hidden',
          animation: 'rpg-modal-panel-in 0.26s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '11px 13px 9px',
            borderBottom: `1px solid ${accentColor}28`,
            background: `linear-gradient(135deg, ${accentColor}28 0%, ${primaryColor}0c 55%, transparent 100%)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 10,
                background: `${accentColor}1e`,
                border: `1.5px solid ${accentColor}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
                boxShadow: `0 0 14px ${accentColor}38`,
                transition: 'box-shadow 0.4s ease',
              }}
            >
              <ClassIcon size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: accentColor, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>{classNamePt}</span>
                <span style={{ fontSize: 9, fontWeight: 900, padding: '1px 7px', borderRadius: 999, background: `${primaryColor}1e`, border: `1px solid ${primaryColor}42`, color: '#fff' }}>Nv {player.level}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            onMouseEnter={() => setCloseBtnHover(true)}
            onMouseLeave={() => setCloseBtnHover(false)}
            style={{
              flexShrink: 0,
              border: `1px solid ${closeBtnHover ? accentColor + '70' : 'rgba(255,255,255,0.14)'}`,
              background: closeBtnHover ? `${accentColor}22` : 'rgba(255,255,255,0.06)',
              color: closeBtnHover ? accentColor : 'rgba(255,255,255,0.65)',
              borderRadius: 10,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              transform: closeBtnHover ? 'scale(1.1) rotate(10deg)' : 'scale(1) rotate(0deg)',
              transition: 'transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 13px 10px',
            background: `radial-gradient(circle at 50% 0%, ${auraColor}10 0%, transparent 60%)`,
          }}
        >
          {/* Resource bars — sempre no topo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {resourceBars.map((res) => {
              const pct = res.max > 0 ? Math.min(100, (res.value / res.max) * 100) : 0;
              return (
                <div key={res.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.14em', color: res.color }}>{res.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>{res.value}<span style={{ fontSize: 10, opacity: 0.65 }}>/{res.max}</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.09)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: res.gradient, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flex row: avatar | attrs */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>

            {/* Avatar */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: isMobile ? 220 : 280,
              }}
            >
              <div style={{ position: 'absolute', inset: '5% 10%', borderRadius: '50%', background: `radial-gradient(circle, ${auraColor}28 0%, transparent 70%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
              <img
                src={playerClass.avatars.fullBodyCloseUp.url}
                alt={`Avatar de ${player.name}`}
                draggable={false}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: '100%',
                  maxWidth: isMobile ? 210 : 260,
                  maxHeight: isMobile ? 250 : 300,
                  objectFit: 'contain',
                  filter: `drop-shadow(0 12px 28px ${auraColor}60)`,
                }}
              />
            </div>

            {/* Attributes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 5 : 7, width: isMobile ? 84 : 100, flexShrink: 0, justifyContent: 'center' }}>
              {attributeRows.map(({ label, value, color, Icon }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 10,
                    border: `1px solid ${color}30`,
                    background: `${color}0e`,
                    padding: isMobile ? '5px 7px' : '7px 9px',
                    transition: 'background 0.18s ease',
                  }}
                >
                  <div style={{ color, flexShrink: 0, display: 'flex', alignItems: 'center' }}><Icon size={isMobile ? 11 : 13} /></div>
                  <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.50)', flex: 1 }}>{label}</span>
                  <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Equipment strip ── */}
        <div
          style={{
            borderTop: `1px solid ${accentColor}1e`,
            padding: '8px 13px 11px',
            display: 'flex',
            gap: 7,
            justifyContent: 'center',
          }}
        >
          {equipmentCards.map(({ key, label, item, Icon }) => {
            const isHov = hoveredEquip === key;
            const borderColor = item?.rarity === 'gold'
              ? 'rgba(251,191,36,0.55)'
              : item?.rarity === 'silver'
                ? 'rgba(148,163,184,0.48)'
                : item
                  ? `${accentColor}48`
                  : 'rgba(255,255,255,0.08)';
            const bg = item?.rarity === 'gold'
              ? 'rgba(120,68,12,0.26)'
              : item?.rarity === 'silver'
                ? 'rgba(44,62,89,0.26)'
                : item
                  ? `${accentColor}14`
                  : 'rgba(255,255,255,0.04)';
            return (
              <div
                key={key}
                title={item?.name ?? `${label} vazio`}
                onMouseEnter={() => setHoveredEquip(key)}
                onMouseLeave={() => setHoveredEquip(null)}
                onClick={() => item && setSelectedEquipItem(item)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 13,
                  border: `1px solid ${isHov && item ? accentColor + '80' : borderColor}`,
                  background: isHov && item ? `${accentColor}20` : bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transform: isHov && item ? 'translateY(-3px) scale(1.07)' : 'translateY(0) scale(1)',
                  boxShadow: isHov && item ? `0 8px 20px ${accentColor}35` : 'none',
                  transition: 'transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                  cursor: item ? 'pointer' : 'default',
                }}
              >
                <div style={{ color: item ? '#fff' : 'rgba(255,255,255,0.28)' }}>
                  {item
                    ? item.iconImage
                      ? <img src={item.iconImage} alt={item.name} draggable={false} style={{ width: 27, height: 27, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 21, lineHeight: 1 }}>{item.icon}</span>
                    : <Icon size={15} color="currentColor" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer hint ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '6px 13px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.28)' }}>
            {uiProfile === 'gamepad' && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#c0392b', fontSize: 8, fontWeight: 900, color: '#fff', flexShrink: 0 }}>B</span>}
            Fechar detalhes
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {portal}
      {selectedEquipItem && (
        <HeroItemDetailOverlay item={selectedEquipItem} onClose={() => setSelectedEquipItem(null)} />
      )}
    </>
  );
};

const INSPECT_PAGE_CARD_BASE_STYLE: React.CSSProperties = {
  borderRadius: '16px',
  background: 'rgba(8,5,22,0.40)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255,255,255,0.14)',
  padding: '10px',
  boxSizing: 'border-box',
  top: 0,
  left: 0,
  width: '100%',
};

const getInspectPageCardStyle = (
  active: boolean,
  inactiveTransform: string,
  positioning: 'absolute' | 'relative' = 'absolute',
): React.CSSProperties => ({
  ...INSPECT_PAGE_CARD_BASE_STYLE,
  pointerEvents: active ? 'auto' : 'none',
  opacity: active ? 1 : 0,
  transform: active ? 'translateX(0px) scale(1)' : inactiveTransform,
  transition: 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.4,0,0.2,1)',
  position: positioning,
});

const InspectPageCard = ({
  active,
  inactiveTransform,
  positioning,
  children,
}: {
  active: boolean;
  inactiveTransform: string;
  positioning?: 'absolute' | 'relative';
  children: React.ReactNode;
}) => (
  <div style={getInspectPageCardStyle(active, inactiveTransform, positioning)}>{children}</div>
);

const InspectCardHeading = ({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) => (
  <div style={{ marginBottom: '8px', padding: '0 2px', display: 'flex', alignItems: 'center', gap: icon ? '5px' : '0' }}>
    {icon}
    <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.40)' }}>
      {label}
    </span>
  </div>
);

const InspectSlotLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.32)', lineHeight: 1 }}>
    {children}
  </div>
);

const InspectInfoButton = ({
  color,
  active = false,
  label,
  onClick,
}: {
  color: string;
  active?: boolean;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    onClick={onClick}
    style={{
      width: '28px',
      flexShrink: 0,
      borderRadius: '7px',
      border: `1px solid ${color}44`,
      background: active ? `${color}25` : 'rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color,
      alignSelf: 'stretch',
    }}
    aria-label={label}
  >
    <Info size={11} />
  </button>
);

export const HeroInspectCanvas = ({
  player,
  onClose,
  onEquipSlot,
  onUnequipSlot,
  onSkillSlotClick,
  onItemSlotClick,
  onUnequipItemSlot,
  onUnequipSkillSlot,
  onShowItemDetail,
}: {
  player: Player;
  onClose: () => void;
  onEquipSlot: (slot: EquipSlotKey) => void;
  onUnequipSlot?: (item: any) => void;
  onSkillSlotClick?: (slotIndex: number) => void;
  onItemSlotClick?: (slotIndex: number) => void;
  onUnequipItemSlot?: (slotIndex: number) => void;
  onUnequipSkillSlot?: (slotIndex: number) => void;
  onShowItemDetail?: (item: any) => void;
}) => {
  const { viewport } = useThree();
  const isMobile = (typeof window !== 'undefined' && (window as Window & { electronBridge?: { isElectron: boolean } }).electronBridge?.isElectron) ? false : viewport.width < 9;

  const TAB_ORDER: (0 | 1 | 2 | 3)[] = [1, 0, 3, 2];
  const [tabIdx, setTabIdx] = useState(0);
  const tabIdxRef = useRef(0);
  tabIdxRef.current = tabIdx;
  const cardPage = TAB_ORDER[tabIdx] as 0 | 1 | 2 | 3;

  const { uiProfile: inspectUiProfile } = useInputMode();
  const isEquipTab = tabIdx === 1;
  const isItemsTab = tabIdx === 2;
  const isSkillsTab = tabIdx === 3;

  const [inSlotMode, setInSlotMode] = useState(false);
  const inSlotModeRef = useRef(false);
  inSlotModeRef.current = inSlotMode;

  const [enteredTabIdx, setEnteredTabIdx] = useState(-1);
  const enteredTabIdxRef = useRef(-1);
  enteredTabIdxRef.current = enteredTabIdx;

  const [equipSlotIdx, setEquipSlotIdx] = useState(0);
  const equipSlotIdxRef = useRef(0);
  equipSlotIdxRef.current = equipSlotIdx;

  const [itemSlotIdx, setItemSlotIdx] = useState(0);
  const itemSlotIdxRef = useRef(0);
  itemSlotIdxRef.current = itemSlotIdx;

  const [skillSlotIdx, setSkillSlotIdx] = useState(0);
  const skillSlotIdxRef = useRef(0);
  skillSlotIdxRef.current = skillSlotIdx;

  const maxEquipSlots = 5;
  const maxItemSlots = getClassSlots(player.classId).items;
  const maxSkillSlots = getClassSlots(player.classId).skills;

  useEffect(() => {
    setInSlotMode(false);
    setEnteredTabIdx(-1);
  }, [tabIdx]);

  const [gpHoldXEquip, setGpHoldXEquip] = useState(0);
  const holdXEquipRafRef = useRef<number | null>(null);
  const holdXEquipStartRef = useRef<number | null>(null);
  const holdXEquipFiredRef = useRef(false);
  const holdXEquipXPrevRef = useRef(false);

  const onUnequipSlotRef = useRef(onUnequipSlot);
  onUnequipSlotRef.current = onUnequipSlot;

  const onShowItemDetailRef = useRef(onShowItemDetail);
  onShowItemDetailRef.current = onShowItemDetail;

  const onUnequipItemSlotRef = useRef(onUnequipItemSlot);
  onUnequipItemSlotRef.current = onUnequipItemSlot;

  const onUnequipSkillSlotRef = useRef(onUnequipSkillSlot);
  onUnequipSkillSlotRef.current = onUnequipSkillSlot;

  useEffect(() => {
    if (inspectUiProfile !== 'gamepad') return;
    return onAction((action) => {
      if (!inSlotModeRef.current) {
        if (action === 'NAV_UP') {
          setTabIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (action === 'NAV_DOWN') {
          setTabIdx((i) => Math.min(TAB_ORDER.length - 1, i + 1));
          return;
        }
        if (action === 'CONFIRM') {
          const cur = tabIdxRef.current;
          if (cur === 0) return;
          setEnteredTabIdx(cur);
          if (cur === 1) setEquipSlotIdx(0);
          if (cur === 2) setItemSlotIdx(0);
          if (cur === 3) setSkillSlotIdx(0);
          setInSlotMode(true);
          return;
        }
      } else {
        const cur = tabIdxRef.current;
        if (action === 'BACK') {
          setInSlotMode(false);
          setEnteredTabIdx(-1);
          return;
        }
        if (cur === 1) {
          if (action === 'NAV_UP') {
            setEquipSlotIdx((i) => Math.max(0, i - 1));
            return;
          }
          if (action === 'NAV_DOWN') {
            setEquipSlotIdx((i) => Math.min(maxEquipSlots - 1, i + 1));
            return;
          }
          if (action === 'CONFIRM') {
            onEquipSlot(slots[equipSlotIdxRef.current].key);
            return;
          }
          if (action === 'SKILL_2' && !!slotsRef.current[equipSlotIdxRef.current]?.item) {
            onShowItemDetailRef.current?.(slotsRef.current[equipSlotIdxRef.current].item);
            return;
          }
        }
        if (cur === 2) {
          if (action === 'NAV_UP') {
            setItemSlotIdx((i) => Math.max(0, i - 1));
            return;
          }
          if (action === 'NAV_DOWN') {
            setItemSlotIdx((i) => Math.min(maxItemSlots - 1, i + 1));
            return;
          }
          if (action === 'CONFIRM') {
            onItemSlotClick?.(itemSlotIdxRef.current);
            return;
          }
          if (action === 'SKILL_2') {
            const battleSlot = equippedItemSlotsInspectRef.current[itemSlotIdxRef.current];
            if (battleSlot?.itemId) {
              setCampBattleItemDetailSlotIdx(itemSlotIdxRef.current);
              return;
            }
          }
        }
        if (cur === 3) {
          if (action === 'NAV_UP') {
            setSkillSlotIdx((i) => Math.max(0, i - 1));
            return;
          }
          if (action === 'NAV_DOWN') {
            setSkillSlotIdx((i) => Math.min(maxSkillSlots - 1, i + 1));
            return;
          }
          if (action === 'CONFIRM') {
            onSkillSlotClick?.(skillSlotIdxRef.current);
            return;
          }
          if (action === 'SKILL_2') {
            const skillId = equippedSkillsInspectRef.current[skillSlotIdxRef.current];
            if (skillId) {
              setCampSkillInfoId(skillId);
              return;
            }
          }
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectUiProfile]);

  const [campSkillInfoId, setCampSkillInfoId] = useState<string | null>(null);
  const [campBattleItemDetailSlotIdx, setCampBattleItemDetailSlotIdx] = useState<number | null>(null);

  const [gpHoldXItem, setGpHoldXItem] = useState(0);
  const holdXItemRafRef = useRef<number | null>(null);
  const holdXItemStartRef = useRef<number | null>(null);
  const holdXItemFiredRef = useRef(false);
  const holdXItemXPrevRef = useRef(false);

  const [gpHoldXSkill, setGpHoldXSkill] = useState(0);
  const holdXSkillRafRef = useRef<number | null>(null);
  const holdXSkillStartRef = useRef<number | null>(null);
  const holdXSkillFiredRef = useRef(false);
  const holdXSkillXPrevRef = useRef(false);

  const pClass = getPlayerClassById(player.classId);
  const ClassIcon = INSPECT_CLASS_ICON[player.classId as PlayerClassId] ?? Shield;
  const classNamePt = HERO_CLASS_NAME_PT[player.classId as PlayerClassId] ?? player.classId;
  const accentColor = pClass.visualProfile.secondaryColor;

  const hpPct = player.stats.maxHp > 0 ? Math.min(100, (player.stats.hp / player.stats.maxHp) * 100) : 0;
  const mpPct = player.stats.maxMp > 0 ? Math.min(100, (player.stats.mp / player.stats.maxMp) * 100) : 0;
  const xpPct = player.xpToNext > 0 ? Math.min(100, (player.xp / player.xpToNext) * 100) : 0;

  const slots: { key: EquipSlotKey; label: string; item: any }[] = [
    { key: 'weapon', label: 'Arma', item: player.equippedWeapon },
    { key: 'shield', label: 'Escudo', item: player.equippedShield },
    { key: 'helmet', label: 'Capacete', item: player.equippedHelmet },
    { key: 'armor', label: 'Armadura', item: player.equippedArmor },
    { key: 'legs', label: 'Pernas', item: player.equippedLegs },
  ];

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const equippedItemSlotsInspectRef = useRef(player.equippedItemSlots ?? []);
  equippedItemSlotsInspectRef.current = player.equippedItemSlots ?? [];

  const equippedSkillsInspectRef = useRef(player.equippedSkillIds ?? []);
  equippedSkillsInspectRef.current = player.equippedSkillIds ?? [];

  useEffect(() => {
    if (inspectUiProfile !== 'gamepad') return;
    const HOLD_DURATION = 600;
    function poll() {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const xDown = gp ? (gp.buttons[2]?.pressed || (gp.buttons[2]?.value ?? 0) > 0.5) : false;
      const xWas = holdXEquipXPrevRef.current;
      holdXEquipXPrevRef.current = xDown;
      const isEquipTabActive = tabIdxRef.current === 1 && inSlotModeRef.current;
      const slot = slotsRef.current[equipSlotIdxRef.current];
      const hasItem = !!slot?.item;
      const blocked = hasModalLayer();

      if (!xDown || blocked) {
        holdXEquipFiredRef.current = false;
        holdXEquipStartRef.current = null;
        setGpHoldXEquip(0);
      } else if (isEquipTabActive && hasItem && !holdXEquipFiredRef.current) {
        if (holdXEquipStartRef.current === null) {
          if (!xWas) holdXEquipStartRef.current = performance.now();
        }
        if (holdXEquipStartRef.current !== null) {
          const elapsed = performance.now() - holdXEquipStartRef.current;
          const pct = Math.min(elapsed / HOLD_DURATION, 1);
          setGpHoldXEquip(pct);
          if (pct >= 1) {
            holdXEquipFiredRef.current = true;
            holdXEquipStartRef.current = null;
            setGpHoldXEquip(0);
            onUnequipSlotRef.current?.(slot.item);
          }
        }
      } else if (!isEquipTabActive || !hasItem) {
        holdXEquipStartRef.current = null;
        setGpHoldXEquip(0);
      }

      holdXEquipRafRef.current = requestAnimationFrame(poll);
    }

    holdXEquipRafRef.current = requestAnimationFrame(poll);
    return () => {
      if (holdXEquipRafRef.current) cancelAnimationFrame(holdXEquipRafRef.current);
      setGpHoldXEquip(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectUiProfile]);

  useEffect(() => {
    if (inspectUiProfile !== 'gamepad') return;
    const HOLD_DURATION = 600;
    function poll() {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const xDown = gp ? (gp.buttons[2]?.pressed || (gp.buttons[2]?.value ?? 0) > 0.5) : false;
      const xWas = holdXItemXPrevRef.current;
      holdXItemXPrevRef.current = xDown;
      const isItemsTabActive = tabIdxRef.current === 2 && inSlotModeRef.current;
      const battleSlot = equippedItemSlotsInspectRef.current[itemSlotIdxRef.current];
      const hasItem = !!battleSlot?.itemId;
      const blocked = hasModalLayer();

      if (!xDown || blocked) {
        holdXItemFiredRef.current = false;
        holdXItemStartRef.current = null;
        setGpHoldXItem(0);
      } else if (isItemsTabActive && hasItem && !holdXItemFiredRef.current) {
        if (holdXItemStartRef.current === null) {
          if (!xWas) holdXItemStartRef.current = performance.now();
        }
        if (holdXItemStartRef.current !== null) {
          const elapsed = performance.now() - holdXItemStartRef.current;
          const pct = Math.min(elapsed / HOLD_DURATION, 1);
          setGpHoldXItem(pct);
          if (pct >= 1) {
            holdXItemFiredRef.current = true;
            holdXItemStartRef.current = null;
            setGpHoldXItem(0);
            onUnequipItemSlotRef.current?.(itemSlotIdxRef.current);
          }
        }
      } else if (!isItemsTabActive || !hasItem) {
        holdXItemStartRef.current = null;
        setGpHoldXItem(0);
      }

      holdXItemRafRef.current = requestAnimationFrame(poll);
    }

    holdXItemRafRef.current = requestAnimationFrame(poll);
    return () => {
      if (holdXItemRafRef.current) cancelAnimationFrame(holdXItemRafRef.current);
      setGpHoldXItem(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectUiProfile]);

  useEffect(() => {
    if (inspectUiProfile !== 'gamepad') return;
    const HOLD_DURATION = 600;
    function poll() {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const xDown = gp ? (gp.buttons[2]?.pressed || (gp.buttons[2]?.value ?? 0) > 0.5) : false;
      const xWas = holdXSkillXPrevRef.current;
      holdXSkillXPrevRef.current = xDown;
      const isSkillsTabActive = tabIdxRef.current === 3 && inSlotModeRef.current;
      const skillId = equippedSkillsInspectRef.current[skillSlotIdxRef.current];
      const hasSkill = !!skillId;
      const blocked = hasModalLayer();

      if (!xDown || blocked) {
        holdXSkillFiredRef.current = false;
        holdXSkillStartRef.current = null;
        setGpHoldXSkill(0);
      } else if (isSkillsTabActive && hasSkill && !holdXSkillFiredRef.current) {
        if (holdXSkillStartRef.current === null) {
          if (!xWas) holdXSkillStartRef.current = performance.now();
        }
        if (holdXSkillStartRef.current !== null) {
          const elapsed = performance.now() - holdXSkillStartRef.current;
          const pct = Math.min(elapsed / HOLD_DURATION, 1);
          setGpHoldXSkill(pct);
          if (pct >= 1) {
            holdXSkillFiredRef.current = true;
            holdXSkillStartRef.current = null;
            setGpHoldXSkill(0);
            onUnequipSkillSlotRef.current?.(skillSlotIdxRef.current);
          }
        }
      } else if (!isSkillsTabActive || !hasSkill) {
        holdXSkillStartRef.current = null;
        setGpHoldXSkill(0);
      }

      holdXSkillRafRef.current = requestAnimationFrame(poll);
    }

    holdXSkillRafRef.current = requestAnimationFrame(poll);
    return () => {
      if (holdXSkillRafRef.current) cancelAnimationFrame(holdXSkillRafRef.current);
      setGpHoldXSkill(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectUiProfile]);

  const rarityBorder = (r?: string) => r === 'gold' ? 'rgba(251,191,36,0.6)' : r === 'silver' ? 'rgba(148,163,184,0.6)' : r ? 'rgba(184,137,86,0.6)' : 'rgba(255,255,255,0.10)';
  const rarityBg = (r?: string) => r === 'gold' ? 'rgba(100,40,5,0.55)' : r === 'silver' ? 'rgba(20,30,50,0.65)' : r ? 'rgba(50,30,8,0.55)' : 'rgba(0,0,0,0.14)';
  const rarityLabel = (r?: string) => r === 'gold' ? 'Lend\u00E1rio' : r === 'silver' ? 'Raro' : r ? 'Comum' : '';
  const rarityLabelColor = (r?: string) => r === 'gold' ? '#fbbf24' : r === 'silver' ? '#94a3b8' : '#d4a56a';
  const slotIconColor = (r?: string) => r === 'gold' ? '#fbbf24' : r === 'silver' ? '#94a3b8' : r ? '#d4a56a' : 'rgba(255,255,255,0.72)';

  const font: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };
  const desktopViewportShortfall = !isMobile ? Math.max(0, 6.8 - viewport.height) : 0;
  const equipX = isMobile ? -0.58 : -0.34;
  const statsX = isMobile ? -0.7 : -2.0;
  const statsY = 2.0;
  const equipY = isMobile ? statsY - 1.93 : -0.08 - (desktopViewportShortfall * 0.16);
  const df = isMobile ? 6.0 : 5.8;
  const dfStats = isMobile ? 5.4 : df;

  return (
    <>
      <Html center sprite distanceFactor={dfStats} position={[statsX, statsY, 0]} zIndexRange={[200, 0]} style={{ pointerEvents: 'auto' }}>
        <div
          style={{
            width: '220px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: inspectUiProfile === 'gamepad' ? 'default' : 'pointer',
          }}
        >
          <div style={{ background: 'rgba(8,5,22,0.38)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderRadius: '16px', border: `2px solid ${accentColor}70`, padding: '12px 14px', boxShadow: `0 10px 40px rgba(0,0,0,0.45), 0 0 0 1px ${accentColor}18, 0 0 28px ${accentColor}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '38px', height: '38px', flexShrink: 0, background: `${accentColor}25`, border: `1.5px solid ${accentColor}55`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
                <ClassIcon size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.22em', color: accentColor, opacity: 0.9, lineHeight: 1.2 }}>{classNamePt}</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</div>
              </div>
              <div style={{ flexShrink: 0, background: `${accentColor}30`, border: `1px solid ${accentColor}50`, borderRadius: '8px', padding: '4px 9px', fontSize: '13px', fontWeight: 900, color: accentColor, lineHeight: 1.3 }}>Nv {player.level}</div>
            </div>

            {[
              { label: 'HP', cur: player.stats.hp, max: player.stats.maxHp, pct: hpPct, color: '#f43f5e', grad: 'linear-gradient(90deg,#9f1239,#f43f5e)' },
              { label: 'MP', cur: player.stats.mp, max: player.stats.maxMp, pct: mpPct, color: '#3b82f6', grad: 'linear-gradient(90deg,#1e40af,#3b82f6)' },
              { label: 'XP', cur: player.xp, max: player.xpToNext, pct: xpPct, color: '#f59e0b', grad: 'linear-gradient(90deg,#92400e,#f59e0b)' },
            ].map((bar) => (
              <div key={bar.label} style={{ marginBottom: '7px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: bar.color, opacity: 0.85 }}>{bar.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.03em' }}>{bar.cur}<span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>/ {bar.max}</span></span>
                </div>
                <div style={{ height: '7px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${bar.pct}%`, background: bar.grad, borderRadius: '99px', transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Html>

      <Html center sprite distanceFactor={df} position={[equipX, equipY, 0]} zIndexRange={[200, 0]}>
        <div style={{ ...font, display: 'flex', flexDirection: 'row', gap: '6px', alignItems: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
            {([
              { page: 1 as const, Icon: User as React.FC<{ size?: number }>, label: 'Atributos', color: '#f97316' },
              { page: 0 as const, Icon: Swords as React.FC<{ size?: number }>, label: 'Equipamentos', color: '#60a5fa' },
              { page: 3 as const, Icon: FlaskConical as React.FC<{ size?: number }>, label: 'Itens de Batalha', color: '#34d399' },
              { page: 2 as const, Icon: Zap as React.FC<{ size?: number }>, label: 'Habilidades', color: '#a78bfa' },
            ] as { page: 0 | 1 | 2 | 3; Icon: React.FC<{ size?: number }>; label: string; color: string }[]).map(({ page, Icon, label, color }, visualIdx) => {
              const isActive = tabIdx === visualIdx;
              const isEntered = enteredTabIdx === visualIdx;
              return (
                <button key={page} onClick={(e) => { e.stopPropagation(); setTabIdx(visualIdx); setEnteredTabIdx(-1); }} title={label} style={{ width: isMobile ? '34px' : '28px', height: isMobile ? '34px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', border: isEntered ? `1px solid ${color}80` : isActive ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(255,255,255,0.08)', background: isEntered ? `${color}28` : isActive ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.30)', cursor: 'pointer', color: isEntered ? color : isActive ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s', flexShrink: 0, boxSizing: 'border-box', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: isEntered ? `0 0 8px ${color}40` : 'none' }}>
                  <Icon size={isMobile ? 15 : 13} />
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', width: isMobile ? '270px' : '230px', flexShrink: 0 }}>
            <InspectPageCard active={cardPage === 0} inactiveTransform="translateX(-24px) scale(0.97)" positioning="relative">
              <InspectCardHeading label="Equipamento" />

              {slots.map((slot, i) => {
                const it = slot.item as any;
                const rb = rarityBorder(it?.rarity);
                const bg = rarityBg(it?.rarity);
                const rl = rarityLabel(it?.rarity);
                const rlc = rarityLabelColor(it?.rarity);
                const ic = slotIconColor(it?.rarity);
                const SlotIcon = SLOT_ICON[slot.key];
                const isGpSelected = inspectUiProfile === 'gamepad' && isEquipTab && inSlotMode && equipSlotIdx === i;
                return (
                  <button key={slot.key} onClick={(e) => { e.stopPropagation(); onEquipSlot(slot.key); }} style={{ display: 'flex', alignItems: 'center', gap: '9px', borderRadius: '11px', border: isGpSelected ? '2px solid rgba(255,255,255,0.55)' : `1px solid ${rb}`, background: isGpSelected ? 'rgba(255,255,255,0.10)' : bg, padding: '8px 10px', cursor: 'pointer', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', textAlign: 'left', width: '100%', marginBottom: i < slots.length - 1 ? '5px' : '0', boxSizing: 'border-box', transition: 'border 0.12s, background 0.12s, filter 0.12s', boxShadow: isGpSelected ? '0 0 0 3px rgba(255,255,255,0.15)' : 'none' }} onMouseEnter={(e) => { if (!isGpSelected) e.currentTarget.style.filter = 'brightness(1.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}>
                    {isGpSelected && !!it && gpHoldXEquip > 0 && <span style={{ position: 'absolute', inset: 0, borderRadius: '11px', background: 'rgba(239,68,68,0.38)', transform: `scaleX(${gpHoldXEquip})`, transformOrigin: 'left', pointerEvents: 'none', zIndex: 0 }} />}
                    <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', filter: 'drop-shadow(0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(-0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(0 0.5px 0 rgba(255,255,255,0.7)) drop-shadow(0 -0.5px 0 rgba(255,255,255,0.7))' }}>
                      <span style={{ color: ic, display: it ? 'none' : 'block', position: 'absolute' }}><SlotIcon size={20} /></span>
                      {it && (it.iconImage ? <img src={it.iconImage} style={{ width: 30, height: 30, objectFit: 'contain', position: 'relative', zIndex: 1 }} draggable={false} alt={it.name} /> : <span style={{ fontSize: '24px', lineHeight: 1, position: 'relative', zIndex: 1 }}>{it.icon}</span>)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, position: 'relative', zIndex: 1 }}>
                      <div style={{ fontSize: '6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.62)', lineHeight: 1.3 }}>{slot.label}</div>
                      <div style={{ fontSize: '10px', fontWeight: 900, color: it ? '#fff' : 'rgba(255,255,255,0.20)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>{isGpSelected && !!it && gpHoldXEquip > 0 ? (gpHoldXEquip < 1 ? 'Segure...' : '\u2713 Desequipado!') : (it ? it.name : 'Vazio')}</div>
                      {it && !gpHoldXEquip && <div style={{ fontSize: '7px', fontWeight: 700, color: rlc, lineHeight: 1.2 }}>{rl}</div>}
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '14px', flexShrink: 0, position: 'relative', zIndex: 1 }}>{'\u203A'}</span>
                  </button>
                );
              })}
            </InspectPageCard>

            <InspectPageCard active={cardPage === 1} inactiveTransform={cardPage === 0 ? 'translateX(24px) scale(0.97)' : 'translateX(-24px) scale(0.97)'}>
              <InspectCardHeading label="Atributos" />

              {(() => {
                const miniStats = [
                  { abbr: 'ATQ', value: player.stats.atk, color: '#f43f5e', Icon: Swords as React.FC<{ size?: number }> },
                  { abbr: 'DEF', value: player.stats.def, color: '#3b82f6', Icon: Shield as React.FC<{ size?: number }> },
                  { abbr: 'MAG', value: player.stats.magic, color: '#a855f7', Icon: Sparkles as React.FC<{ size?: number }> },
                  { abbr: 'VEL', value: player.stats.speed, color: '#10b981', Icon: Wind as React.FC<{ size?: number }> },
                  { abbr: 'SRT', value: player.stats.luck, color: '#f59e0b', Icon: Clover as React.FC<{ size?: number }> },
                ] as { abbr: string; value: number; color: string; Icon: React.FC<{ size?: number }> }[];
                return (
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                    {miniStats.map((stat) => (
                      <div key={stat.abbr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderRadius: '9px', padding: '5px 2px', background: `${stat.color}14`, border: `1px solid ${stat.color}30`, boxSizing: 'border-box' }}>
                        <span style={{ color: stat.color, display: 'flex' }}><stat.Icon size={10} /></span>
                        <span style={{ fontSize: '5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: stat.color, opacity: 0.75, lineHeight: 1 }}>{stat.abbr}</span>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {(() => {
                const eqItems = [player.equippedWeapon, player.equippedArmor, player.equippedHelmet, player.equippedLegs, player.equippedShield];
                const eqBonus = { atk: 0, def: 0, speed: 0, magic: 0, luck: 0 };
                eqItems.forEach((it: any) => {
                  if (!it) return;
                  const bonus = getEquipmentBonuses(it);
                  eqBonus.atk += bonus.atk;
                  eqBonus.def += bonus.def;
                  eqBonus.speed += bonus.speed;
                  eqBonus.magic += bonus.magic;
                });
                const hasEquip = eqItems.some(Boolean);
                const radarAxes = [
                  { value: player.stats.atk, base: player.stats.atk - eqBonus.atk, bonus: eqBonus.atk, color: '#f43f5e', Icon: Swords as React.FC<{ size?: number }> },
                  { value: player.stats.magic, base: player.stats.magic - eqBonus.magic, bonus: eqBonus.magic, color: '#a855f7', Icon: Sparkles as React.FC<{ size?: number }> },
                  { value: player.stats.luck, base: player.stats.luck, bonus: 0, color: '#f59e0b', Icon: Clover as React.FC<{ size?: number }> },
                  { value: player.stats.speed, base: player.stats.speed - eqBonus.speed, bonus: eqBonus.speed, color: '#10b981', Icon: Wind as React.FC<{ size?: number }> },
                  { value: player.stats.def, base: player.stats.def - eqBonus.def, bonus: eqBonus.def, color: '#3b82f6', Icon: Shield as React.FC<{ size?: number }> },
                ] as { value: number; base: number; bonus: number; color: string; Icon: React.FC<{ size?: number }> }[];
                const maxVal = Math.max(...radarAxes.map((axis) => axis.value)) + 10;
                const cx = 88;
                const cy = 94;
                const r = 64;
                const angles = radarAxes.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI / radarAxes.length));
                const tip = (dist: number, i: number) => ({ x: cx + dist * Math.cos(angles[i]), y: cy + dist * Math.sin(angles[i]) });
                const vpTotal = (i: number) => tip(r * (radarAxes[i].value / maxVal), i);
                const vpBase = (i: number) => tip(r * (Math.max(0, radarAxes[i].base) / maxVal), i);
                const totalPts = radarAxes.map((_, i) => { const point = vpTotal(i); return `${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join(' ');
                const basePts = radarAxes.map((_, i) => { const point = vpBase(i); return `${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join(' ');
                const gridPts = (lv: number) => radarAxes.map((_, i) => { const point = tip(r * lv, i); return `${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join(' ');
                return (
                  <svg width="176" height="202" style={{ display: 'block', overflow: 'visible' as any }} overflow="visible">
                    {[0.25, 0.5, 0.75, 1].map((lv) => <polygon key={lv} points={gridPts(lv)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />)}
                    {radarAxes.map((_, i) => { const point = tip(r, i); return <line key={i} x1={cx} y1={cy} x2={point.x.toFixed(1)} y2={point.y.toFixed(1)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />; })}
                    {hasEquip && <polygon points={totalPts} fill="rgba(251,191,36,0.16)" stroke="rgba(251,191,36,0.65)" strokeWidth="1.2" strokeLinejoin="round" strokeDasharray="3 2" />}
                    <polygon points={basePts} fill="rgba(130,80,255,0.22)" stroke="rgba(165,105,255,0.85)" strokeWidth="1.5" strokeLinejoin="round" />
                    {radarAxes.map((axis, i) => { const point = vpBase(i); return <circle key={i} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="2.5" fill={axis.color} stroke="rgba(0,0,0,0.45)" strokeWidth="0.7" />; })}
                    {hasEquip && radarAxes.map((axis, i) => { if (axis.bonus <= 0) return null; const point = vpTotal(i); return <circle key={`t${i}`} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="2.5" fill="#fbbf24" stroke="rgba(0,0,0,0.45)" strokeWidth="0.7" />; })}
                    {radarAxes.map((axis, i) => { const point = tip(r + 16, i); return <foreignObject key={i} x={(point.x - 6).toFixed(1)} y={(point.y - 6).toFixed(1)} width="12" height="12"><div style={{ width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: axis.color }}><axis.Icon size={10} /></div></foreignObject>; })}
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="4.5" fill="rgba(255,255,255,0.18)" style={{ fontFamily: 'inherit', letterSpacing: '0.1em' }}>STATS</text>
                  </svg>
                );
              })()}
            </InspectPageCard>

            {(() => {
              const equippedIds: string[] = player.equippedSkillIds ?? [];
              const maxSlots = getClassSlots(player.classId).skills;
              const paddedIds = [...equippedIds];
              while (paddedIds.length < maxSlots) paddedIds.push('');
              const availableSkills = player.skills ?? [];
              return (
                <InspectPageCard active={cardPage === 2} inactiveTransform="translateX(24px) scale(0.97)">
                  <InspectCardHeading label="Habilidades" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {Array.from({ length: maxSlots }, (_, i) => {
                      const skillId = paddedIds[i];
                      const skill = skillId ? availableSkills.find((entry: any) => entry.id === skillId) : null;
                      const typeColor = skill?.type === 'physical' ? '#f87171' : skill?.type === 'magic' ? '#c4b5fd' : '#86efac';
                      const typeBg = skill?.type === 'physical' ? 'rgba(248,113,113,0.14)' : skill?.type === 'magic' ? 'rgba(196,181,253,0.14)' : 'rgba(134,239,172,0.14)';
                      const typeLabel = skill?.type === 'physical' ? 'F\u00EDsico' : skill?.type === 'magic' ? 'Magia' : 'Cura';
                      const TypeIcon = skill?.type === 'physical' ? <Sword size={22} /> : skill?.type === 'magic' ? <Sparkles size={22} /> : <Heart size={22} />;
                      const isGpSkillSel = inspectUiProfile === 'gamepad' && isSkillsTab && inSlotMode && skillSlotIdx === i;
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                          <div style={{ display: 'flex', alignItems: 'stretch', gap: '3px', width: '100%', overflow: 'hidden' }}>
                            <button onClick={(e) => { e.stopPropagation(); onSkillSlotClick?.(i); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '11px', border: isGpSkillSel ? '2px solid rgba(167,139,250,0.7)' : skill ? `1.5px solid ${typeColor}55` : '1px solid rgba(255,255,255,0.09)', background: isGpSkillSel ? 'rgba(167,139,250,0.15)' : skill ? typeBg : 'rgba(0,0,0,0.18)', padding: '7px 9px', boxSizing: 'border-box', flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left', boxShadow: isGpSkillSel ? '0 0 0 3px rgba(167,139,250,0.18)' : skill ? `0 0 10px ${typeColor}18` : 'none', transition: 'border 0.18s, background 0.18s, box-shadow 0.18s', position: 'relative', overflow: 'hidden' }}>
                              {isGpSkillSel && gpHoldXSkill > 0 && <span style={{ position: 'absolute', inset: 0, borderRadius: 11, background: 'rgba(167,139,250,0.30)', transform: `scaleX(${gpHoldXSkill})`, transformOrigin: 'left', pointerEvents: 'none' }} />}
                              <div style={{ width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: skill ? typeColor : 'rgba(255,255,255,0.20)', filter: skill ? 'drop-shadow(0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(-0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(0 0.5px 0 rgba(255,255,255,0.7)) drop-shadow(0 -0.5px 0 rgba(255,255,255,0.7))' : undefined, position: 'relative', zIndex: 1 }}>{skill ? TypeIcon : <Sparkles size={16} />}</div>
                              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative', zIndex: 1 }}>
                                <InspectSlotLabel>Slot {i + 1}</InspectSlotLabel>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: skill ? '#fff' : 'rgba(255,255,255,0.30)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{isGpSkillSel && !!skill && gpHoldXSkill > 0 ? (gpHoldXSkill < 1 ? 'Segure...' : '\u2713 Removido!') : (skill ? skill.name : 'Vazio')}</div>
                                {skill && !gpHoldXSkill && <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><span style={{ fontSize: '7px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '99px', background: `${typeColor}20`, border: `1px solid ${typeColor}44`, color: typeColor, display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>{typeLabel}</span><span style={{ fontSize: '7px', fontWeight: 700, padding: '1.5px 5px', borderRadius: '99px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.38)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}><Zap size={8} />{skill.manaCost} MP</span></div>}
                              </div>
                              <span style={{ color: skill ? `${typeColor}80` : 'rgba(255,255,255,0.20)', fontSize: '14px', flexShrink: 0, position: 'relative', zIndex: 1 }}>{'\u203A'}</span>
                            </button>
                            {skill && inspectUiProfile !== 'gamepad' && <InspectInfoButton color={typeColor} label="Info da habilidade" onClick={(e) => { e.stopPropagation(); setCampSkillInfoId(skillId); }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </InspectPageCard>
              );
            })()}

            {(() => {
              const equippedItemSlots: Array<{ itemId: string; qty: number }> = player.equippedItemSlots ?? [];
              const maxSlots = getClassSlots(player.classId).items;
              const itemColor = '#fb923c';
              const itemBg = 'rgba(251,146,60,0.14)';
              return (
                <InspectPageCard active={cardPage === 3} inactiveTransform="translateX(24px) scale(0.97)">
                  <InspectCardHeading label="Itens de Batalha" icon={<FlaskConical size={11} color={itemColor} />} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {Array.from({ length: maxSlots }, (_, i) => {
                      const slot = equippedItemSlots[i] ?? { itemId: '', qty: 0 };
                      const hasItem = !!slot.itemId && slot.qty > 0;
                      const isEmpty = !slot.itemId;
                      const slotItemForInfo = slot.itemId ? ALL_ITEMS.find((it) => it.id === slot.itemId) : null;
                      const isGpItemSel = inspectUiProfile === 'gamepad' && isItemsTab && inSlotMode && itemSlotIdx === i;
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                          <div style={{ display: 'flex', alignItems: 'stretch', gap: '3px' }}>
                            <button onClick={(e) => { e.stopPropagation(); onItemSlotClick?.(i); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '11px', border: isGpItemSel ? '2px solid rgba(52,211,153,0.7)' : hasItem ? `1.5px solid ${itemColor}55` : '1px solid rgba(255,255,255,0.09)', background: isGpItemSel ? 'rgba(52,211,153,0.15)' : hasItem ? itemBg : 'rgba(0,0,0,0.18)', padding: '7px 9px', boxSizing: 'border-box', flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left', boxShadow: isGpItemSel ? '0 0 0 3px rgba(52,211,153,0.18)' : hasItem ? `0 0 10px ${itemColor}18` : 'none', transition: 'border 0.18s, background 0.18s', opacity: !isEmpty && slot.qty === 0 ? 0.45 : 1, position: 'relative', overflow: 'hidden' }}>
                              {(() => {
                                const slotItem = slot.itemId ? ALL_ITEMS.find((it) => it.id === slot.itemId) : null;
                                return <div style={{ width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasItem ? itemColor : 'rgba(255,255,255,0.20)', fontSize: '24px', lineHeight: 1, filter: hasItem ? 'drop-shadow(0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(-0.5px 0 0 rgba(255,255,255,0.7)) drop-shadow(0 0.5px 0 rgba(255,255,255,0.7)) drop-shadow(0 -0.5px 0 rgba(255,255,255,0.7))' : undefined }}>{slotItem ? (slotItem.iconImage ? <img src={slotItem.iconImage} style={{ width: 28, height: 28, objectFit: 'contain' }} draggable={false} alt={slotItem.name} /> : slotItem.icon) : <FlaskConical size={16} />}</div>;
                              })()}
                              {(() => {
                                const slotItem = slot.itemId ? ALL_ITEMS.find((it) => it.id === slot.itemId) : null;
                                return (
                                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <InspectSlotLabel>Slot {i + 1}</InspectSlotLabel>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: hasItem ? '#fff' : 'rgba(255,255,255,0.30)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{isEmpty ? 'Vazio' : slot.qty === 0 ? 'Esgotado' : (slotItem?.name ?? slot.itemId)}</div>
                                    {hasItem && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}><span style={{ fontSize: '7px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '99px', background: `${itemColor}20`, border: `1px solid ${itemColor}44`, color: itemColor, display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>{slot.qty}x</span>{slotItem && getPotionSlotBadges(slotItem).map((badge, badgeIndex) => <span key={badgeIndex} style={{ fontSize: '7px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '99px', background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>{badge.label}</span>)}</div>}
                                  </div>
                                );
                              })()}
                              <span style={{ color: hasItem ? `${itemColor}80` : 'rgba(255,255,255,0.20)', fontSize: '14px', flexShrink: 0 }}>{'\u203A'}</span>
                              {isGpItemSel && gpHoldXItem > 0 && <span style={{ position: 'absolute', inset: 0, borderRadius: 11, background: 'rgba(251,146,60,0.30)', transform: `scaleX(${gpHoldXItem})`, transformOrigin: 'left', pointerEvents: 'none' }} />}
                              {isGpItemSel && hasItem && gpHoldXItem > 0 && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', pointerEvents: 'none' }}>{gpHoldXItem < 1 ? 'Segure...' : '\u2713 Removido!'}</span>}
                            </button>
                              {slotItemForInfo && inspectUiProfile !== 'gamepad' && <InspectInfoButton color={itemColor} active={campBattleItemDetailSlotIdx === i} label="Info do item" onClick={(e) => { e.stopPropagation(); setCampBattleItemDetailSlotIdx((prev) => prev === i ? null : i); }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </InspectPageCard>
              );
            })()}
          </div>
        </div>

        {campBattleItemDetailSlotIdx !== null && (() => {
          const battleSlots = player.equippedItemSlots ?? [];
          const battleSlot = battleSlots[campBattleItemDetailSlotIdx] ?? { itemId: '', qty: 0 };
          const battleItem = battleSlot.itemId ? ALL_ITEMS.find((it) => it.id === battleSlot.itemId) : null;
          if (!battleItem) return null;
          return <BattleItemDetailOverlay item={battleItem} slotIndex={campBattleItemDetailSlotIdx} qty={battleSlot.qty} onClose={() => setCampBattleItemDetailSlotIdx(null)} />;
        })()}

        {campSkillInfoId && (() => {
          const availableSkills = player.skills ?? [];
          const infoSkill = availableSkills.find((entry: any) => entry.id === campSkillInfoId) ?? null;
          if (!infoSkill) return null;
          return <SkillInfoModal skill={infoSkill} uiProfile={inspectUiProfile} onClose={() => setCampSkillInfoId(null)} />;
        })()}


      </Html>
    </>
  );
};