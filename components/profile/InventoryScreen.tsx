import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, FlaskConical, Heart, Shield, Sparkles, Star, Sword, Trash2, Wind, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { isEquipmentType, ItemIcon, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';
import { onAction, pushInputLayer } from '../../game/mechanics/inputManager';
import { useInputMode } from '../../game/hooks/useInputMode';
import { uiSfx } from '../../game/audio/uiSfx';
import { GamepadActionLegend } from '../ui/GamepadActionLegend';

const BAG_POTION_URL = new URL('../../game/assets/Mochila/Mochila_Aberta_Consumiveis.png', import.meta.url).href;
const BAG_EQUIPMENT_URL = new URL('../../game/assets/Mochila/Mochila_Aberta_Equipamentos.png', import.meta.url).href;
const BAG_MATERIAL_URL = new URL('../../game/assets/Mochila/Mochila_Aberta_Materiais.png', import.meta.url).href;
const BAG_CLOSED_URL = new URL('../../game/assets/Mochila/Mochilla_Fechada.png', import.meta.url).href;

const BAG_IMAGE: Record<string, string> = {
  potion: BAG_POTION_URL,
  equipment: BAG_EQUIPMENT_URL,
  material: BAG_MATERIAL_URL,
  weapon: BAG_EQUIPMENT_URL,
  shield: BAG_EQUIPMENT_URL,
  helmet: BAG_EQUIPMENT_URL,
  armor: BAG_EQUIPMENT_URL,
  legs: BAG_EQUIPMENT_URL,
};

// Inject bag keyframes once
if (typeof document !== 'undefined' && !document.getElementById('bag-anim-style')) {
  const s = document.createElement('style');
  s.id = 'bag-anim-style';
  s.textContent = `
    @keyframes bag-shake {
      0%   { transform: translateX(-50%) rotate(0deg) scale(1); }
      20%  { transform: translateX(calc(-50% - 4px)) rotate(-2deg) scale(0.97); }
      40%  { transform: translateX(calc(-50% + 4px)) rotate(2deg) scale(0.97); }
      60%  { transform: translateX(calc(-50% - 3px)) rotate(-1.5deg) scale(0.98); }
      80%  { transform: translateX(calc(-50% + 3px)) rotate(1deg) scale(0.99); }
      100% { transform: translateX(-50%) rotate(0deg) scale(1); }
    }
    @keyframes bag-open-in {
      0%   { opacity: 0; transform: translateX(-50%) scale(0.92) translateY(8px); }
      100% { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
    }
    @keyframes bag-appear {
      0%   { opacity: 0; transform: translateX(-50%) translateY(40px) scale(0.88); }
      60%  { opacity: 1; transform: translateX(-50%) translateY(-6px) scale(1.02); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(s);
}

type InventoryScreenProps = {
  player: Player;
  shopItems: Item[];
  onClose: () => void;
  onOpenShop?: () => void;
  onEquip: (item: Item) => void;
  onUnequip: (item: Item) => void;
  onUse: (itemId: string) => void;
  onSell?: (item: Item, quantity: number) => void;
  isBattleContext?: boolean;
  initialFilter?: 'all' | 'equipment' | 'potion' | 'material' | 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs';
  isClosing?: boolean;
  targetItemSlotIndex?: number | null;
  onEquipItemToSlot?: (slotIndex: number, itemId: string | null) => void;
  inShopContext?: boolean;
};

type InventoryFilter = 'potion' | 'equipment' | 'material';
type EquipmentSubType = 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs';

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS: Array<{ id: InventoryFilter; label: string; icon: React.ReactNode }> = [
  { id: 'potion', label: 'Consumíveis', icon: <GameAssetIcon name="potionBlue" size={22} /> },
  { id: 'equipment', label: 'Equipamentos', icon: <GameAssetIcon name="helm" size={22} /> },
  { id: 'material', label: 'Materiais', icon: <GameAssetIcon name="gear" size={22} /> },
];

// ── Rarity helpers ────────────────────────────────────────────────────────────

const getRarityBorder = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'border-[#b88956]';
  if (rarity === 'silver') return 'border-slate-400';
  return 'border-amber-400';
};

const getRarityGlow = (rarity: Item['rarity']) => {
  if (rarity === 'silver') return 'shadow-[0_0_14px_rgba(148,163,184,0.35)]';
  if (rarity === 'gold') return 'shadow-[0_0_18px_rgba(251,191,36,0.5)]';
  return '';
};

const getRarityLabel = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'Comum';
  if (rarity === 'silver') return 'Raro';
  return 'Lendário';
};

const getRarityLabelColor = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'text-[#b88956]';
  if (rarity === 'silver') return 'text-slate-400';
  return 'text-amber-400';
};

// ── Effect card helpers ───────────────────────────────────────────────────────

type EffectCard = { id: string; label: string; value: string; icon: React.ReactNode; tone: string; panel: string };

const createEffectCard = (id: string, label: string, value: string, icon: React.ReactNode, tone: string, panel: string): EffectCard => ({ id, label, value, icon, tone, panel });

const formatPercent = (value: number) => Math.abs(value) <= 1 ? `${Math.round(value * 100)}%` : `${Math.round(value)}%`;

const getItemEffectCards = (item: Item): EffectCard[] => {
  if (item.type === 'weapon') {
    const bonuses = getEquipmentBonuses(item);
    const cards: EffectCard[] = [];
    if (bonuses.atk > 0) cards.push(createEffectCard('atk', 'ATK', `+${bonuses.atk}`, <Sword size={15} />, 'text-[#f87171]', 'border-[#7f1d1d]/40 bg-[#450a0a]/60'));
    if (bonuses.magic > 0) cards.push(createEffectCard('mag', 'MAG', `+${bonuses.magic}`, <Sparkles size={15} />, 'text-[#c4b5fd]', 'border-[#4c1d95]/40 bg-[#2e1065]/60'));
    if (bonuses.speed > 0) cards.push(createEffectCard('spd', 'VEL', `+${bonuses.speed}`, <Wind size={15} />, 'text-[#34d399]', 'border-[#065f46]/40 bg-[#022c22]/60'));
    if (bonuses.luck > 0) cards.push(createEffectCard('luck', 'SRT', `+${bonuses.luck}`, <Star size={15} />, 'text-[#fbbf24]', 'border-[#a16207]/40 bg-[#422006]/60'));
    return cards;
  }
  if (item.type === 'armor' || item.type === 'helmet' || item.type === 'legs' || item.type === 'shield') {
    const bonuses = getEquipmentBonuses(item);
    const cards: EffectCard[] = [];
    if (bonuses.def > 0) cards.push(createEffectCard('def', 'DEF', `+${bonuses.def}`, <Shield size={15} />, 'text-[#fb923c]', 'border-[#9a3412]/40 bg-[#431407]/60'));
    if (bonuses.magicDef > 0) cards.push(createEffectCard('magic-def', 'D.MAG', `+${bonuses.magicDef}`, <Shield size={15} />, 'text-[#60a5fa]', 'border-[#1d4ed8]/40 bg-[#172554]/60'));
    if (bonuses.maxHp > 0) cards.push(createEffectCard('hp', 'VIDA', `+${bonuses.maxHp}`, <Heart size={15} />, 'text-[#86efac]', 'border-[#14532d]/40 bg-[#052e16]/60'));
    if (bonuses.maxMp > 0) cards.push(createEffectCard('mp', 'MANA', `+${bonuses.maxMp}`, <Zap size={15} />, 'text-[#7dd3fc]', 'border-[#075985]/40 bg-[#082f49]/60'));
    if (bonuses.speed > 0) cards.push(createEffectCard('spd', 'VEL', `+${bonuses.speed}`, <Wind size={15} />, 'text-[#34d399]', 'border-[#065f46]/40 bg-[#022c22]/60'));
    if (bonuses.luck > 0) cards.push(createEffectCard('luck', 'SRT', `+${bonuses.luck}`, <Star size={15} />, 'text-[#fbbf24]', 'border-[#a16207]/40 bg-[#422006]/60'));
    return cards;
  }
  if (item.type === 'potion') {
    if (item.id === 'pot_2') return [createEffectCard('mana', 'MANA', `+${item.value}`, <Zap size={15} />, 'text-[#7dd3fc]', 'border-[#075985]/40 bg-[#082f49]/60')];
    if (item.id === 'pot_atk') return [
      createEffectCard('atk_boost', 'ATK', `+${formatPercent(item.value)}`, <Sword size={15} />, 'text-[#f87171]', 'border-[#7f1d1d]/40 bg-[#450a0a]/60'),
      createEffectCard('duration', 'TURNOS', `${item.duration ?? 3}t`, <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60'),
    ];
    if (item.id === 'pot_def') return [
      createEffectCard('def_boost', 'DEF', `+${formatPercent(item.value)}`, <Shield size={15} />, 'text-[#fb923c]', 'border-[#9a3412]/40 bg-[#431407]/60'),
      createEffectCard('duration', 'TURNOS', `${item.duration ?? 3}t`, <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60'),
    ];
    const lower = item.description.toLowerCase();
    const chips: EffectCard[] = [];
    if (lower.includes('hp') || lower.includes('vida') || lower.includes('cura')) chips.push(createEffectCard('hp', 'VIDA', `+${item.value}`, <Heart size={15} />, 'text-[#86efac]', 'border-[#14532d]/40 bg-[#052e16]/60'));
    if (lower.includes('mp') || lower.includes('mana')) chips.push(createEffectCard('mp', 'MANA', `+${item.value}`, <Zap size={15} />, 'text-[#7dd3fc]', 'border-[#075985]/40 bg-[#082f49]/60'));
    if (chips.length > 0) return chips;
    return [createEffectCard('special', 'ESPECIAL', 'Ativo', <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60')];
  }
  return [createEffectCard('craft', 'CRAFT', 'Material', <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60')];
};

// ── Equipment comparison ──────────────────────────────────────────────────────

const getEquippedItemForType = (player: Player, type: Item['type']): Item | null => {
  if (type === 'weapon') return player.equippedWeapon ?? null;
  if (type === 'shield') return player.equippedShield ?? null;
  if (type === 'helmet') return player.equippedHelmet ?? null;
  if (type === 'armor') return player.equippedArmor ?? null;
  if (type === 'legs') return player.equippedLegs ?? null;
  return null;
};

const getEquipmentComparableScore = (item: Item): number => {
  if (!isEquipmentType(item.type)) return 0;
  const bonuses = getEquipmentBonuses(item);
  return bonuses.def + bonuses.magicDef + bonuses.maxHp + bonuses.maxMp + bonuses.speed + bonuses.luck + (item.type === 'weapon' ? bonuses.atk + bonuses.magic : 0);
};

const getEquipmentComparisonTrend = (player: Player, item: Item): 'up' | 'down' | 'equal' | null => {
  if (!isEquipmentType(item.type)) return null;
  const equipped = getEquippedItemForType(player, item.type);
  if (!equipped) return 'up';
  const delta = getEquipmentComparableScore(item) - getEquipmentComparableScore(equipped);
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'equal';
};

const clampQuantity = (value: number, max: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.floor(value)));
};

// ── Inventory Card (horizontal scroll card) ───────────────────────────────────

const InventoryCard: React.FC<{
  item: Item;
  quantity: number;
  player: Player;
  isSelected: boolean;
  isEquipped: boolean;
  onClick: () => void;
  onEquipToggle?: (item: Item) => void;
  isBattleContext: boolean;
  inSlotIndex?: number;
  isPicking?: boolean;
  isMultiSelectMode?: boolean;
  isMultiSelected?: boolean;
  isGpFocused?: boolean;
  gpFocusRef?: React.Ref<HTMLButtonElement>;
  gpHoldXProgress?: number;
}> = ({ item, quantity, player, isSelected, isEquipped, onClick, onEquipToggle, isBattleContext, inSlotIndex, isPicking, isMultiSelectMode, isMultiSelected, isGpFocused, gpFocusRef, gpHoldXProgress }) => {
  const trend = getEquipmentComparisonTrend(player, item);
  const isEquipCard = isEquipmentType(item.type);
  const effectCards = getItemEffectCards(item);
  const statCards = effectCards.filter((e) => e.label !== 'TURNOS' && e.label !== 'ESPECIAL' && e.label !== 'CRAFT');
  const isInSlot = inSlotIndex !== undefined && inSlotIndex >= 0;

  return (
    <button
      ref={gpFocusRef}
      onClick={onClick}
      className={`relative shrink-0 w-[130px] flex flex-col rounded-[20px] border-2 ${
        isMultiSelectMode
          ? isMultiSelected ? 'border-emerald-400' : 'border-white/20'
          : isPicking ? 'border-amber-400/60' : getRarityBorder(item.rarity)
      } bg-white/8 backdrop-blur-md p-3 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 ${getRarityGlow(item.rarity)} ${
        isGpFocused
          ? 'ring-[3px] ring-white/90 shadow-[0_0_28px_rgba(255,255,255,0.40)] -translate-y-2 scale-[1.06]'
          : isSelected && !isMultiSelectMode ? 'ring-2 ring-white/30 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'opacity-85 hover:opacity-100'
      }`}
    >
      {/* Hold-X progress fill on whole card */}
      {(gpHoldXProgress ?? 0) > 0 && (
        <span style={{ position: 'absolute', inset: 0, background: (isEquipped && !isPicking) ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.18)', transform: `scaleX(${gpHoldXProgress ?? 0})`, transformOrigin: 'left', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 2 }} />
      )}
      {/* Multi-select overlay */}
      {isMultiSelectMode && (
        <div className={`absolute inset-0 rounded-[18px] pointer-events-none transition-all duration-150 ${
          isMultiSelected ? 'bg-emerald-500/20 ring-2 ring-emerald-400/60' : 'bg-black/10'
        }`}>
          <div className={`absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
            isMultiSelected ? 'border-emerald-400 bg-emerald-400' : 'border-white/40 bg-black/50'
          }`}>
            {isMultiSelected && <CheckCircle2 size={14} className="text-black" />}
          </div>
        </div>
      )}
      {/* Hold-X progress bar removed — moved into equip button below */}

      {/* Quantity badge */}
      <span className="absolute right-2 top-2 z-10 rounded-full border border-white/20 bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-white">
        x{quantity}
      </span>

      {/* Slot badge — top-left (potion in a slot) */}
      {isInSlot && !isPicking && (
        <span className="absolute left-2 top-2 z-10 rounded-full border border-amber-400/50 bg-amber-500/25 px-1.5 py-0.5 text-[8px] font-black text-amber-300 uppercase tracking-widest">S{(inSlotIndex ?? 0) + 1}</span>
      )}

      {/* Trend badge — equipment only (not equipped), top-left */}
      {!isInSlot && trend && !isEquipped && !isPicking && (
        <span className={`absolute left-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 ${trend === 'up' ? 'bg-emerald-500/80 text-white' : trend === 'down' ? 'bg-rose-500/80 text-white' : 'bg-amber-500/80 text-white'}`}>
          {trend === 'up' ? <ArrowUp size={10} /> : trend === 'down' ? <ArrowDown size={10} /> : <span className="text-[10px] leading-none font-black">—</span>}
        </span>
      )}

      {/* Equipped badge — top-left */}
      {isEquipped && !isInSlot && !isPicking && (
        <span className="absolute left-2 top-2 z-10 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black text-emerald-400 uppercase tracking-widest">E</span>
      )}

      {/* Icon */}
      <div className="mx-auto mt-3 flex h-14 w-14 items-center justify-center">
        <ItemIcon item={item} emojiClassName="text-[38px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_10px_rgba(255,255,255,0.4)]" />
      </div>

      {/* Name */}
      <div className="mt-2 text-center text-[11px] font-black leading-tight text-white line-clamp-2 min-h-[2rem]">
        {item.name}
      </div>

      {/* Rarity label */}
      <div className={`mt-1 text-center text-[9px] font-black uppercase tracking-widest ${getRarityLabelColor(item.rarity)}`}>
        {getRarityLabel(item.rarity)}
      </div>

      {/* Stat badges */}
      {statCards.length > 0 && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {statCards.slice(0, 2).map((s) => (
            <span key={s.id} className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${s.panel} ${s.tone}`}>
              {React.isValidElement(s.icon) ? React.cloneElement(s.icon as React.ReactElement<{ size?: number }>, { size: 10 }) : s.icon}
              {s.value}
            </span>
          ))}
        </div>
      )}

      {/* Picking mode badge — potion only */}
      {isPicking && item.type === 'potion' && (
        <div className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-300 pointer-events-none">
          <FlaskConical size={10} />
          <span>Equipar</span>
        </div>
      )}

      {/* Equip/Unequip inline button — equipment only, camp only, not picking */}
      {!isPicking && isEquipCard && !isBattleContext && onEquipToggle && (() => {
        const holdPct = gpHoldXProgress ?? 0;
        const isHolding = holdPct > 0;
        return (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onEquipToggle(item); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onEquipToggle(item); } }}
            style={{ position: 'relative', overflow: 'hidden' }}
            className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
              isHolding
                ? (isEquipped ? 'border-amber-400 bg-amber-500/40 text-amber-200' : 'border-emerald-400 bg-emerald-500/40 text-emerald-200')
                : (isEquipped ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300')
            }`}
          >
            {/* Hold fill */}
            {isHolding && (
              <span style={{
                position: 'absolute', inset: 0,
                background: isEquipped ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)',
                transform: `scaleX(${holdPct})`,
                transformOrigin: 'left',
                borderRadius: 'inherit',
                pointerEvents: 'none',
              }} />
            )}
            <Shield size={10} style={{ position: 'relative', zIndex: 1 }} />
            <span style={{ position: 'relative', zIndex: 1 }}>
              {isHolding
                ? (holdPct < 1 ? '...' : (isEquipped ? '✓ Desequip.' : '✓ Equipado!'))
                : (isEquipped ? 'Desequipar' : 'Equipar')}
            </span>
          </div>
        );
      })()}
    </button>
  );
};

// ── Item Detail Modal ─────────────────────────────────────────────────────────

const ItemDetailModal: React.FC<{
  item: Item;
  quantity: number;
  player: Player;
  closing: boolean;
  onClose: () => void;
  onEquip?: (item: Item) => void;
  onUnequip?: (item: Item) => void;
  onUse?: (itemId: string) => void;
  onSell?: (item: Item, qty: number) => void;
  isEquipped: boolean;
  isBattleContext: boolean;
  inShopContext?: boolean;
  onGamepadAction?: () => void; // CONFIRM do controle → equipa/usa/desequipa
  isPicking?: boolean;
  targetItemSlotIndex?: number | null;
  onEquipItemToSlot?: (slotIndex: number, itemId: string | null) => void;
  equippedItemSlots?: Array<{ itemId: string; qty: number }>;
}> = ({ item, quantity, player, closing, onClose, onEquip, onUnequip, onUse, onSell, isEquipped, isBattleContext, inShopContext, onGamepadAction, isPicking, targetItemSlotIndex, onEquipItemToSlot, equippedItemSlots }) => {
  const overlayClass = closing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in';
  const panelClass = closing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in';
  const effectCards = getItemEffectCards(item);
  const trend = getEquipmentComparisonTrend(player, item);
  const isEquipCard = isEquipmentType(item.type);
  const ownedQty = player.inventory[item.id] ?? 0;
  const canEquip = !isBattleContext && isEquipCard && !isEquipped;
  const canUnequip = !isBattleContext && isEquipCard && isEquipped;
  const canUse = isBattleContext && item.type === 'potion';
  const canSell = !!inShopContext && !!onSell && ownedQty > 0;
  const targetSlotId = (isPicking && targetItemSlotIndex != null && equippedItemSlots?.length)
    ? (equippedItemSlots[targetItemSlotIndex!]?.itemId ?? '')
    : '';
  const isInSlot = isPicking && item.type === 'potion' && targetSlotId === item.id;
  const canEquipToSlot = !!(isPicking && item.type === 'potion' && onEquipItemToSlot && targetItemSlotIndex != null);
  const sellValue = Math.floor(item.cost / 2);
  const [sellQty, setSellQty] = useState(1);
  const sellTotal = sellQty * sellValue;
  const { uiProfile: detailUiProfile, gamepadBrand: detailBrand } = useInputMode();
  const BRAND_CONFIRM: Record<string, React.ReactNode> = {
    xbox: 'A', sony: '✕', nintendo: 'A', generic: 'A',
  };
  const BRAND_CANCEL: Record<string, React.ReactNode> = {
    xbox: 'B', sony: '○', nintendo: 'B', generic: 'B',
  };
  const BRAND_BG: Record<string, string> = {
    xbox: '#107C10', sony: '#0070D1', nintendo: '#107C10', generic: '#4a4a9a',
  };
  const BRAND_BG_CANCEL: Record<string, string> = {
    xbox: '#c0392b', sony: '#c0392b', nintendo: '#c0392b', generic: '#c0392b',
  };
  const gpConfirmLabel = BRAND_CONFIRM[detailBrand] ?? 'A';
  const gpCancelLabel  = BRAND_CANCEL[detailBrand]  ?? 'B';
  const gpConfirmBg    = BRAND_BG[detailBrand]        ?? '#4a4a9a';
  const gpCancelBg     = BRAND_BG_CANCEL[detailBrand] ?? '#c0392b';
  const showGpConfirm  = detailUiProfile === 'gamepad' && (canEquip || canUnequip || canUse || canEquipToSlot);
  const showGpCancel   = detailUiProfile === 'gamepad';

  // ── Hold-A mechanic ───────────────────────────────────────────────────────
  const HOLD_DURATION = 600; // ms to hold A to confirm action
  const [holdProgress, setHoldProgress] = useState(0); // 0..1
  const holdStartRef   = useRef<number | null>(null);
  const holdRafRef     = useRef<number | null>(null);
  const onGamepadActionRef = useRef(onGamepadAction);
  onGamepadActionRef.current = onGamepadAction;

  useEffect(() => {
    if (detailUiProfile !== 'gamepad') return;
    // Wait for A to be released before accepting a hold (avoids auto-fire
    // from the press that opened the detail modal)
    let waitingForRelease = true;
    let fired = false;

    function poll() {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const aDown = gp ? (gp.buttons[0]?.pressed || (gp.buttons[0]?.value ?? 0) > 0.5) : false;

      if (waitingForRelease) {
        // Don't start until A is fully released
        if (!aDown) waitingForRelease = false;
        holdRafRef.current = requestAnimationFrame(poll);
        return;
      }

      if (aDown && (canEquip || canUnequip || canUse || canEquipToSlot) && !fired) {
        if (holdStartRef.current === null) holdStartRef.current = performance.now();
        const elapsed = performance.now() - holdStartRef.current;
        const pct = Math.min(elapsed / HOLD_DURATION, 1);
        setHoldProgress(pct);
        if (pct >= 1) {
          fired = true;
          setHoldProgress(1);
          onGamepadActionRef.current?.();
          // Stop polling after action fires — modal will close
          return;
        }
      } else if (!aDown) {
        // A released before completion — reset
        if (!fired) {
          holdStartRef.current = null;
          setHoldProgress(0);
        }
      }

      holdRafRef.current = requestAnimationFrame(poll);
    }

    holdRafRef.current = requestAnimationFrame(poll);
    return () => {
      if (holdRafRef.current !== null) cancelAnimationFrame(holdRafRef.current);
      setHoldProgress(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailUiProfile, canEquip, canUnequip, canUse]);

  // B fecha modal — usa pushInputLayer para ter prioridade sobre o inventário
  useEffect(() => {
    return pushInputLayer((action) => {
      if (action === 'BACK') { onClose(); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${overlayClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md max-h-[85vh] rounded-[24px] border border-white/10 bg-[#0d1117] shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col ${panelClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="shrink-0 flex items-start gap-3 p-5 pb-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/5">
            <ItemIcon item={item} emojiClassName="text-[42px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_12px_rgba(255,255,255,0.5)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-black uppercase tracking-widest ${getRarityLabelColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
              {isEquipped && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black text-emerald-400">Equipado</span>
              )}
              {trend && !isEquipped && (
                <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[9px] font-black ${trend === 'up' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' : trend === 'down' ? 'border-rose-400/30 bg-rose-400/10 text-rose-400' : 'border-amber-400/30 bg-amber-400/10 text-amber-400'}`}>
                  {trend === 'up' ? <ArrowUp size={10} /> : trend === 'down' ? <ArrowDown size={10} /> : <span className="leading-none">—</span>}
                  {trend === 'up' ? 'Melhora' : trend === 'down' ? 'Piora' : 'Igual'}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black text-white/50">x{quantity}</span>
            </div>
            <h2 className="mt-1 text-lg font-black text-white leading-tight">{item.name}</h2>
            <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-white/40">
              <ItemTypeIcon type={item.type} size={11} />
              <ItemTypeLabel type={item.type} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2" data-scrollable>
          <p className="text-sm text-white/60 leading-relaxed">{item.description}</p>

          {/* Icon preview — igual à loja */}
          <div className="mt-3 relative flex items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-b from-white/5 to-black/30 border border-white/8 h-[11rem]">
            <ItemIcon item={item} emojiClassName="text-8xl leading-none select-none" />
          </div>

          {/* Effect cards */}
          {effectCards.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {effectCards.map((e) => (
                <div key={e.id} className={`rounded-[14px] border px-3 py-2 ${e.panel}`}>
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">{e.label}</div>
                  <div className={`mt-1 inline-flex items-center gap-1 text-lg font-black ${e.tone}`}>{e.icon}{e.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Sell section with inline quantity picker */}
          {canSell && (
            <div className="mt-3 rounded-[18px] border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-amber-400/60">Vender</div>
                  <div className="flex items-center gap-1 text-sm font-black text-amber-300">
                    <GameAssetIcon name="coin" size={13} />{sellValue}/un.
                    <span className="text-white/30">→</span>
                    <GameAssetIcon name="coin" size={13} />+{sellTotal}
                  </div>
                </div>
                <button
                  onClick={() => setSellQty(ownedQty)}
                  className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300 hover:bg-amber-400/20"
                >
                  Tudo
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSellQty((q) => Math.max(1, q - 1))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base font-black text-white/70 hover:bg-white/10"
                >-</button>
                <input
                  type="number"
                  min={1}
                  max={ownedQty}
                  value={sellQty}
                  onChange={(e) => setSellQty(Math.max(1, Math.min(ownedQty, Math.floor(Number(e.target.value)) || 1)))}
                  className="h-10 w-full rounded-xl border border-amber-400/20 bg-black/40 px-3 text-center text-base font-black text-amber-300 outline-none focus:border-amber-400/50"
                />
                <button
                  onClick={() => setSellQty((q) => Math.min(ownedQty, q + 1))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base font-black text-white/70 hover:bg-white/10"
                >+</button>
              </div>
              <div className="mt-1.5 text-[10px] text-white/30 font-semibold">Disponível: {ownedQty}</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 border-t border-white/8 p-4 flex flex-col gap-2">
          {canEquipToSlot && (
            <button
              onClick={() => onGamepadAction?.()}
              className="relative overflow-hidden inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-600/80 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-95"
            >
              {showGpConfirm && holdProgress > 0 && (
                <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.18)', transform: `scaleX(${holdProgress})`, transformOrigin: 'left', transition: 'transform 60ms linear', borderRadius: 'inherit', pointerEvents: 'none' }} />
              )}
              {showGpConfirm && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: '#fff', fontSize: 11, fontWeight: 900, color: '#111', flexShrink: 0, position: 'relative' }}>{gpConfirmLabel}</span>
              )}
              <FlaskConical size={16} style={{ position: 'relative' }} />
              <span style={{ position: 'relative' }}>
                {`Equipar no Slot ${(targetItemSlotIndex ?? 0) + 1}`}
              </span>
              {showGpConfirm && holdProgress > 0 && (
                <span style={{ position: 'relative', fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                  {holdProgress < 1 ? 'Segure...' : '✓'}
                </span>
              )}
            </button>
          )}
          {(canEquip || canUnequip) && (
            <button
              onClick={() => { canEquip ? onEquip?.(item) : onUnequip?.(item); onClose(); }}
              className={`relative overflow-hidden inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 ${canEquip ? 'border-emerald-500/50 bg-emerald-600/80 text-white hover:bg-emerald-500' : 'border-amber-500/50 bg-amber-600/80 text-white hover:bg-amber-500'}`}
            >
              {/* Hold-A progress fill */}
              {showGpConfirm && holdProgress > 0 && (
                <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.18)', transform: `scaleX(${holdProgress})`, transformOrigin: 'left', transition: 'transform 60ms linear', borderRadius: 'inherit', pointerEvents: 'none' }} />
              )}
              {showGpConfirm && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: '#fff', fontSize: 11, fontWeight: 900, color: '#111', flexShrink: 0, position: 'relative' }}>{gpConfirmLabel}</span>
              )}
              <Shield size={16} style={{ position: 'relative' }} />
              <span style={{ position: 'relative' }}>{canEquip ? 'Equipar' : 'Desequipar'}</span>
              {showGpConfirm && holdProgress > 0 && (
                <span style={{ position: 'relative', fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                  {holdProgress < 1 ? 'Segure...' : '✓'}
                </span>
              )}
            </button>
          )}
          {canUse && (
            <button
              onClick={() => { onUse?.(item.id); onClose(); }}
              className="relative overflow-hidden inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-600/80 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-sky-500 active:scale-95"
            >
              {showGpConfirm && holdProgress > 0 && (
                <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.18)', transform: `scaleX(${holdProgress})`, transformOrigin: 'left', transition: 'transform 60ms linear', borderRadius: 'inherit', pointerEvents: 'none' }} />
              )}
              {showGpConfirm && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: '#fff', fontSize: 11, fontWeight: 900, color: '#111', flexShrink: 0, position: 'relative' }}>{gpConfirmLabel}</span>
              )}
              <FlaskConical size={16} style={{ position: 'relative' }} />
              <span style={{ position: 'relative' }}>Usar Item</span>
              {showGpConfirm && holdProgress > 0 && (
                <span style={{ position: 'relative', fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                  {holdProgress < 1 ? 'Segure...' : '✓'}
                </span>
              )}
            </button>
          )}
          {canSell && (
            <button
              onClick={() => { onSell?.(item, sellQty); onClose(); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-600/80 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-amber-500 active:scale-95"
            >
              <GameAssetIcon name="coin" size={16} /> Vender{sellQty > 1 ? ` ${sellQty}x` : ''} +{sellTotal}
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/50 transition-all hover:bg-white/10"
          >
            {showGpCancel && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: gpCancelBg, fontSize: 10, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{gpCancelLabel}</span>
            )}
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sell Quantity Modal ───────────────────────────────────────────────────────

const SellQuantityModal: React.FC<{
  item: Item;
  player: Player;
  closing: boolean;
  onClose: () => void;
  onConfirm: (item: Item, qty: number) => void;
}> = ({ item, player, closing, onClose, onConfirm }) => {
  const overlayClass = closing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in';
  const panelClass = closing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in';
  const maxQty = player.inventory[item.id] ?? 0;
  const [qty, setQty] = useState(1);
  const sellValue = Math.floor(item.cost / 2);
  const total = qty * sellValue;

  return (
    <div
      className={`absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 ${overlayClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0d1117] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.8)] ${panelClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Vender item</div>
        <h3 className="mt-1 inline-flex items-center gap-2.5 text-lg font-black text-white">
          <span className="inline-flex h-8 w-8 items-center justify-center">
            <ItemIcon item={item} emojiClassName="text-[32px] leading-none" />
          </span>
          {item.name}
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[14px] border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-amber-400/60">Você ganha</div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-base font-black text-amber-300">
              <GameAssetIcon name="coin" size={16} />{total}
            </div>
          </div>
          <div className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Ouro depois</div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-base font-black text-white/70">
              <GameAssetIcon name="coin" size={16} />{player.gold + total}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Quantidade</span>
            <button
              onClick={() => setQty(maxQty)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-black text-white/50 hover:bg-white/10"
            >
              Tudo
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setQty((q) => clampQuantity(q - 1, maxQty))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white/70 hover:bg-white/10"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(clampQuantity(Number(e.target.value), maxQty))}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center text-lg font-black text-white outline-none focus:border-amber-400/40"
            />
            <button
              onClick={() => setQty((q) => clampQuantity(q + 1, maxQty))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white/70 hover:bg-white/10"
            >
              +
            </button>
          </div>
          <div className="mt-2 text-[10px] font-black text-white/30">Disponível: {maxQty}</div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/50 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(item, qty)}
            disabled={maxQty <= 0}
            className="flex-1 rounded-xl border border-amber-500/60 bg-amber-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Vender
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Batch Sell Modal ─────────────────────────────────────────────────────────

const BatchSellModal: React.FC<{
  entries: Array<{ item: Item; qty: number }>;
  player: Player;
  onRemove: (itemId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ entries, player, onRemove, onConfirm, onClose }) => {
  const totalGold = entries.reduce((s, e) => s + Math.floor(e.item.cost / 2) * e.qty, 0);

  return (
    <div
      className="absolute inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 rpg-modal-overlay-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0d1117] shadow-[0_24px_60px_rgba(0,0,0,0.9)] overflow-hidden rpg-modal-panel-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Venda em lote</div>
            <h3 className="mt-0.5 text-base font-black text-white">{entries.length} {entries.length === 1 ? 'item' : 'itens'} selecionados</h3>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-black text-emerald-300">
            <GameAssetIcon name="coin" size={16} />+{totalGold}
          </div>
        </div>

        {/* Item list */}
        <div className="max-h-[40vh] overflow-y-auto px-5 py-3 flex flex-col gap-2" data-scrollable>
          {entries.map(({ item, qty }) => {
            const unitPrice = Math.floor(item.cost / 2);
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-white/5 px-3 py-2.5">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center">
                  <ItemIcon item={item} emojiClassName="text-[28px] leading-none" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-white truncate">{item.name}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-black text-emerald-400">
                    <GameAssetIcon name="coin" size={11} />{unitPrice} × {qty} = {unitPrice * qty}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mx-5 rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-white/50">Ouro após venda</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-black text-amber-300">
            <GameAssetIcon name="coin" size={16} />{player.gold + totalGold}
          </span>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/50 hover:bg-white/10 active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={entries.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <GameAssetIcon name="coin" size={18} />Vender Tudo
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Export ───────────────────────────────────────────────────────────────

export const InventoryScreen = ({
  player,
  shopItems,
  onClose,
  onEquip,
  onUnequip,
  onUse,
  onSell,
  isBattleContext = false,
  initialFilter = 'all',
  isClosing = false,
  targetItemSlotIndex = null,
  onEquipItemToSlot,
  inShopContext = false,
}: InventoryScreenProps) => {
  const MODAL_CLOSE_MS = 180;

  const EQUIP_SUB_TYPES: EquipmentSubType[] = ['weapon', 'shield', 'helmet', 'armor', 'legs'];
  const equipmentSubFilter: EquipmentSubType | null =
    initialFilter && EQUIP_SUB_TYPES.includes(initialFilter as EquipmentSubType)
      ? (initialFilter as EquipmentSubType)
      : null;

  const resolveInitialFilter = (): InventoryFilter => {
    if (initialFilter === 'equipment' || equipmentSubFilter) return 'equipment';
    if (initialFilter === 'material') return 'material';
    return 'potion';
  };

  const [filter, setFilter] = useState<InventoryFilter>(resolveInitialFilter);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [sellingItem, setSellingItem] = useState<Item | null>(null);
  const [sellClosing, setSellClosing] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSellOpen, setBatchSellOpen] = useState(false);
  const bagAnimKey = useRef(0);
  const bagTimerRef = useRef<number | null>(null);
  const detailTimerRef = useRef<number | null>(null);
  const sellTimerRef = useRef<number | null>(null);

  // ── Gamepad state ──────────────────────────────────────────────────────────
  const { uiProfile: invUiProfile } = useInputMode();
  const [gpIdx, setGpIdx] = useState(0);
  const gpIdxRef = useRef(0);
  gpIdxRef.current = gpIdx;
  const gpFocusedCardRef = useRef<HTMLButtonElement | null>(null);
  const [gpHoldXProgress, setGpHoldXProgress] = useState(0);
  const holdXRafRef = useRef<number | null>(null);
  const holdXStartRef = useRef<number | null>(null);
  const holdXFiredRef = useRef(false);
  const holdXXPrevRef = useRef(false); // edge-detect: só inicia em nova pressionada
  const onEquipRef = useRef(onEquip);
  onEquipRef.current = onEquip;
  const onUnequipRef = useRef(onUnequip);
  onUnequipRef.current = onUnequip;
  // Hold-Y: remover item do slot (picking mode)
  const [gpHoldYProgress, setGpHoldYProgress] = useState(0);
  const holdYRafRef  = useRef<number | null>(null);
  const holdYStartRef = useRef<number | null>(null);
  const holdYFiredRef = useRef(false);
  const holdYYPrevRef = useRef(false);

  // Reset gpIdx when filter changes
  useEffect(() => { setGpIdx(0); }, [filter]);

  useEffect(() => () => {
    if (detailTimerRef.current) window.clearTimeout(detailTimerRef.current);
    if (sellTimerRef.current) window.clearTimeout(sellTimerRef.current);
    if (bagTimerRef.current) window.clearTimeout(bagTimerRef.current);
  }, []);

  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 20); return () => window.clearTimeout(t); }, []);

  const changeFilter = (newFilter: InventoryFilter) => {
    if (newFilter === pendingFilterRef.current) return;
    pendingFilterRef.current = newFilter; // update immediately so SHOULDER nav is correct
    if (bagTimerRef.current) window.clearTimeout(bagTimerRef.current);
    bagAnimKey.current += 1;   // force img remount → replay shake animation
    setShaking(true);
    bagTimerRef.current = window.setTimeout(() => {
      setFilter(newFilter);
      setActiveItemId(null);
      setShaking(false);       // src swaps instantly, no appear animation
    }, 200);
  };

  // Auto-switch to potion tab when entering item slot picking mode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (targetItemSlotIndex !== null) changeFilter('potion'); }, [targetItemSlotIndex]);

  const isPicking = targetItemSlotIndex !== null;
  const equippedItemSlots = player.equippedItemSlots ?? [];

  const getItemSlotIndex = (itemId: string) =>
    equippedItemSlots.findIndex((s) => s.itemId === itemId);

  const handlePickingClick = (item: Item) => {
    if (!isPicking || targetItemSlotIndex === null || !onEquipItemToSlot) return;
    // Check if this exact item is already in the TARGET slot (not any slot)
    const currentSlotItemId = equippedItemSlots[targetItemSlotIndex]?.itemId ?? '';
    if (currentSlotItemId === item.id) {
      // Desequipar from this slot
      onEquipItemToSlot(targetItemSlotIndex, null);
    } else {
      onEquipItemToSlot(targetItemSlotIndex, item.id);
    }
    onClose();
  };

  // Build inventory entry list (include equipped items even if not in inventory dict)
  const inventoryItems = useMemo(() => {
    const entryMap = new Map<string, { item: Item; quantity: number }>();

    Object.entries(player.inventory)
      .filter(([, q]) => q > 0)
      .forEach(([id, q]) => {
        const item = shopItems.find((i) => i.id === id);
        if (!item) return;
        entryMap.set(item.id, { item, quantity: q });
      });

    const ensureEquipped = (equipped: Item | null) => {
      if (!equipped) return;
      const cur = entryMap.get(equipped.id);
      if (cur) {
        entryMap.set(equipped.id, { ...cur, quantity: Math.max(1, cur.quantity) });
        return;
      }
      entryMap.set(equipped.id, { item: equipped, quantity: 1 });
    };

    ensureEquipped(player.equippedWeapon);
    ensureEquipped(player.equippedArmor);
    ensureEquipped(player.equippedHelmet);
    ensureEquipped(player.equippedLegs);
    ensureEquipped(player.equippedShield);

    return Array.from(entryMap.values());
  }, [player.inventory, player.equippedWeapon, player.equippedArmor, player.equippedHelmet, player.equippedLegs, player.equippedShield, shopItems]);

  const EQUIPMENT_TYPE_ORDER: Item['type'][] = ['weapon', 'shield', 'helmet', 'armor', 'legs'];

  // IDs de itens em slots de habilidade/item — não devem aparecer na aba consumíveis
  const slottedItemIds = useMemo(
    () => new Set((player.equippedItemSlots ?? []).map((s) => s.itemId).filter(Boolean) as string[]),
    [player.equippedItemSlots],
  );

  const isItemEquipped = (item: Item) => (
    player.equippedWeapon?.id === item.id
    || player.equippedArmor?.id === item.id
    || player.equippedHelmet?.id === item.id
    || player.equippedLegs?.id === item.id
    || player.equippedShield?.id === item.id
  );

  const filteredItems = useMemo(() => {
    const filtered = inventoryItems.filter(({ item }) => {
      if (filter === 'equipment') {
        if (equipmentSubFilter) return item.type === equipmentSubFilter;
        return isEquipmentType(item.type);
      }
      // Potion/material: ocultar itens em slots de habilidade (exceto no modo seleção de slot)
      if (item.type === 'potion' && slottedItemIds.has(item.id) && !isPicking) return false;
      return item.type === filter;
    });
    if (filter === 'equipment') {
      filtered.sort((a, b) => {
        const ai = EQUIPMENT_TYPE_ORDER.indexOf(a.item.type as Item['type']);
        const bi = EQUIPMENT_TYPE_ORDER.indexOf(b.item.type as Item['type']);
        return ai - bi;
      });
    }
    // No modo seleção de venda: ocultar equipamentos já equipados no herói
    if (selectionMode) {
      return filtered.filter(({ item }) => !isItemEquipped(item));
    }
    return filtered;
  }, [filter, inventoryItems, equipmentSubFilter, slottedItemIds, selectionMode]);

  const totalItems = inventoryItems.reduce((s, e) => s + e.quantity, 0);

  const activeEntry = filteredItems.find((e) => e.item.id === activeItemId) ?? null;

  const openDetail = (item: Item) => {
    setDetailClosing(false);
    setActiveItemId(item.id);
  };

  // ── Stable refs for gamepad handler (avoids stale closures) ───────────────
  const filteredItemsRef   = useRef(filteredItems);
  filteredItemsRef.current = filteredItems;
  const activeItemIdRef    = useRef(activeItemId);
  activeItemIdRef.current  = activeItemId;
  const filterRef          = useRef(filter);
  filterRef.current        = filter;
  // pendingFilterRef: updated immediately when changeFilter is called (before the 200ms state update)
  const pendingFilterRef   = useRef(filter);
  pendingFilterRef.current = filter; // sync with state (if no pending change in flight)
  const isItemEquippedRef  = useRef(isItemEquipped);
  isItemEquippedRef.current = isItemEquipped;
  const isPickingRef       = useRef(isPicking);
  isPickingRef.current     = isPicking;
  const targetItemSlotIndexRef = useRef(targetItemSlotIndex);
  targetItemSlotIndexRef.current = targetItemSlotIndex;
  const equippedItemSlotsRef = useRef(equippedItemSlots);
  equippedItemSlotsRef.current = equippedItemSlots;
  const onEquipItemToSlotRef = useRef(onEquipItemToSlot);
  onEquipItemToSlotRef.current = onEquipItemToSlot;
  // Stable ref for picking-mode equip (used inside RAF)
  const handlePickingClickRef = useRef(handlePickingClick);
  handlePickingClickRef.current = handlePickingClick;

  // Scroll selected card into view when gpIdx changes
  useEffect(() => {
    if (invUiProfile !== 'gamepad') return;
    gpFocusedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [gpIdx, invUiProfile]);

  // Main gamepad handler — uses pushInputLayer so ONLY this handler fires
  // while the inventory is open (suppresses parent screen handlers)
  useEffect(() => {
    if (invUiProfile !== 'gamepad') return;
    return pushInputLayer((action) => {
      // Se o detail modal está aberto, só processa BACK (o modal em si cuida de CONFIRM)
      if (activeItemIdRef.current) {
        if (action === 'BACK') { closeDetail(); }
        return;
      }
      const items = filteredItemsRef.current;
      if (action === 'BACK') { onClose(); return; }
      if (action === 'NAV_LEFT' || action === 'NAV_RIGHT') return; // handled by RAF hold-repeat
      if (action === 'CONFIRM') {
        const entry = items[gpIdxRef.current];
        if (!entry) return;
        openDetail(entry.item);
        return;
      }
      if (action === 'SKILL_2' && !isPickingRef.current) {
        // Y em modo normal = ver detalhes do item focado
        const entry = items[gpIdxRef.current];
        if (!entry) return;
        openDetail(entry.item);
        return;
      }
      if (action === 'SHOULDER_L' && !equipmentSubFilter) {
        const idx = FILTERS.findIndex(f => f.id === pendingFilterRef.current);
        changeFilter(FILTERS[(idx - 1 + FILTERS.length) % FILTERS.length].id);
        return;
      }
      if (action === 'SHOULDER_R' && !equipmentSubFilter) {
        const idx = FILTERS.findIndex(f => f.id === pendingFilterRef.current);
        changeFilter(FILTERS[(idx + 1) % FILTERS.length].id);
        return;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invUiProfile]);

  // Smooth hold-repeat card navigation (RAF polling)
  useEffect(() => {
    if (invUiProfile !== 'gamepad') return;
    const INITIAL_DELAY  = 420;
    const INTERVAL_START = 130;
    const INTERVAL_MIN   = 40;
    const ACCEL = 0.82;

    let rafId: number;
    let leftNextAt: number | null = null;
    let rightNextAt: number | null = null;
    let leftInterval  = INTERVAL_START;
    let rightInterval = INTERVAL_START;
    let prevLeft  = false;
    let prevRight = false;

    const step = (dir: -1 | 1) => {
      if (activeItemIdRef.current) return; // detail open — skip
      const len = filteredItemsRef.current.length;
      if (len === 0) return;
      setGpIdx(i => {
        const next = dir === -1 ? Math.max(0, i - 1) : Math.min(len - 1, i + 1);
        gpIdxRef.current = next;
        return next;
      });
      uiSfx.play('menu_nav');
    };

    const poll = (now: number) => {
      const gps = navigator.getGamepads();
      const gp  = gps[0] ?? gps[1] ?? null;
      const leftDown  = gp ? ((gp.buttons[14]?.pressed) || (gp.axes[6] ?? 0) < -0.5) : false;
      const rightDown = gp ? ((gp.buttons[15]?.pressed) || (gp.axes[6] ?? 0) >  0.5) : false;

      if (leftDown) {
        if (!prevLeft) {
          step(-1);
          leftNextAt   = now + INITIAL_DELAY;
          leftInterval = INTERVAL_START;
        } else if (leftNextAt !== null && now >= leftNextAt) {
          step(-1);
          leftInterval = Math.max(INTERVAL_MIN, leftInterval * ACCEL);
          leftNextAt   = now + leftInterval;
        }
      } else {
        leftNextAt   = null;
        leftInterval = INTERVAL_START;
      }

      if (rightDown) {
        if (!prevRight) {
          step(1);
          rightNextAt   = now + INITIAL_DELAY;
          rightInterval = INTERVAL_START;
        } else if (rightNextAt !== null && now >= rightNextAt) {
          step(1);
          rightInterval = Math.max(INTERVAL_MIN, rightInterval * ACCEL);
          rightNextAt   = now + rightInterval;
        }
      } else {
        rightNextAt   = null;
        rightInterval = INTERVAL_START;
      }

      prevLeft  = leftDown;
      prevRight = rightDown;
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invUiProfile]);

  // Hold-X: equip/unequip diretamente da grade sem abrir detalhes
  useEffect(() => {
    if (invUiProfile !== 'gamepad') return;
    const HOLD_DURATION = 600;
    function poll() {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const xDown = gp ? (gp.buttons[2]?.pressed || (gp.buttons[2]?.value ?? 0) > 0.5) : false;
      const xWas = holdXXPrevRef.current;
      holdXXPrevRef.current = xDown;
      const detailOpen = !!activeItemIdRef.current;
      const entry = filteredItemsRef.current[gpIdxRef.current];
      const isEquipCard = entry ? isEquipmentType(entry.item.type) : false;
      if (!xDown) {
        holdXFiredRef.current = false;
        holdXStartRef.current = null;
        setGpHoldXProgress(0);
      } else if (!detailOpen && isEquipCard && !isPickingRef.current && !holdXFiredRef.current) {
        // Só inicia o hold se X acabou de ser pressionado (borda de subida)
        if (holdXStartRef.current === null) {
          if (!xWas) holdXStartRef.current = performance.now();
        }
        if (holdXStartRef.current !== null) {
          const elapsed = performance.now() - holdXStartRef.current;
          const pct = Math.min(elapsed / HOLD_DURATION, 1);
          setGpHoldXProgress(pct);
          if (pct >= 1) {
            holdXFiredRef.current = true;
            holdXStartRef.current = null;
            setGpHoldXProgress(0);
            if (isItemEquippedRef.current(entry!.item)) {
              onUnequipRef.current(entry!.item);
            } else {
              onEquipRef.current(entry!.item);
            }
          }
        }
      } else if (!detailOpen && isPickingRef.current && !holdXFiredRef.current && entry?.item.type === 'potion') {
        // Picking mode: hold X = equipar item diretamente no slot
        if (holdXStartRef.current === null) {
          if (!xWas) holdXStartRef.current = performance.now();
        }
        if (holdXStartRef.current !== null) {
          const elapsed = performance.now() - holdXStartRef.current;
          const pct = Math.min(elapsed / HOLD_DURATION, 1);
          setGpHoldXProgress(pct);
          if (pct >= 1) {
            holdXFiredRef.current = true;
            holdXStartRef.current = null;
            setGpHoldXProgress(0);
            handlePickingClickRef.current(entry!.item);
          }
        }
      } else if (detailOpen || (!isEquipCard && !isPickingRef.current)) {
        holdXStartRef.current = null;
        setGpHoldXProgress(0);
      }
      holdXRafRef.current = requestAnimationFrame(poll);
    }
    holdXRafRef.current = requestAnimationFrame(poll);
    return () => {
      if (holdXRafRef.current) cancelAnimationFrame(holdXRafRef.current);
      setGpHoldXProgress(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invUiProfile]);

  // Hold-Y: remover item do slot alvo (picking mode)
  useEffect(() => {
    if (invUiProfile !== 'gamepad') return;
    const HOLD_DURATION = 600;
    function poll() {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const yDown = gp ? (gp.buttons[3]?.pressed || (gp.buttons[3]?.value ?? 0) > 0.5) : false;
      const yWas = holdYYPrevRef.current;
      holdYYPrevRef.current = yDown;
      const slotIdx = targetItemSlotIndexRef.current;
      const slots = equippedItemSlotsRef.current;
      const slotHasItem = slotIdx !== null && !!(slots[slotIdx]?.itemId);
      const detailOpen = !!activeItemIdRef.current;
      if (!yDown || !isPickingRef.current || !slotHasItem || detailOpen) {
        holdYFiredRef.current = false;
        holdYStartRef.current = null;
        setGpHoldYProgress(0);
      } else if (!holdYFiredRef.current) {
        if (holdYStartRef.current === null) {
          if (!yWas) holdYStartRef.current = performance.now();
        }
        if (holdYStartRef.current !== null) {
          const elapsed = performance.now() - holdYStartRef.current;
          const pct = Math.min(elapsed / HOLD_DURATION, 1);
          setGpHoldYProgress(pct);
          if (pct >= 1) {
            holdYFiredRef.current = true;
            holdYStartRef.current = null;
            setGpHoldYProgress(0);
            onEquipItemToSlotRef.current?.(slotIdx!, null);
          }
        }
      }
      holdYRafRef.current = requestAnimationFrame(poll);
    }
    holdYRafRef.current = requestAnimationFrame(poll);
    return () => {
      if (holdYRafRef.current) cancelAnimationFrame(holdYRafRef.current);
      setGpHoldYProgress(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invUiProfile]);

  // Gamepad CONFIRM action for detail modal (equip/unequip/use)
  const handleDetailGamepadConfirm = () => {
    if (!activeEntry) return;
    const item = activeEntry.item;
    const isEquipCard = isEquipmentType(item.type);
    // Picking mode: equip/remove potion to/from slot
    if (isPickingRef.current && item.type === 'potion' && onEquipItemToSlotRef.current && targetItemSlotIndexRef.current != null) {
      onEquipItemToSlotRef.current(targetItemSlotIndexRef.current, item.id);
      closeDetail();
      onClose();
      return;
    }
    if (!isBattleContext && isEquipCard) {
      if (isItemEquippedRef.current(item)) { onUnequip(item); }
      else { onEquip(item); onClose(); }
      closeDetail();
    } else if (isBattleContext && item.type === 'potion') {
      onUse(item.id);
      closeDetail();
    }
  };

  const toggleSelectItem = (item: Item) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const openBatchSell = () => {
    if (selectedIds.size === 0) return;
    setBatchSellOpen(true);
  };

  const handleBatchConfirm = () => {
    batchEntries.forEach(({ item, qty }) => onSell?.(item, qty));
    setBatchSellOpen(false);
    exitSelectionMode();
  };

  // Build batch entries: selected items that are not equipped, qty = inventory count
  const batchEntries = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => {
        const entry = inventoryItems.find((e) => e.item.id === id);
        if (!entry) return null;
        const qty = player.inventory[id] ?? 0;
        if (qty <= 0) return null;
        return { item: entry.item, qty };
      })
      .filter(Boolean) as Array<{ item: Item; qty: number }>;
  }, [selectedIds, inventoryItems, player.inventory]);

  const removeBatchEntry = (itemId: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
  };

  const closeDetail = () => {
    if (!activeItemId || detailClosing) return;
    setDetailClosing(true);
    if (detailTimerRef.current) window.clearTimeout(detailTimerRef.current);
    detailTimerRef.current = window.setTimeout(() => {
      setActiveItemId(null);
      setDetailClosing(false);
    }, MODAL_CLOSE_MS);
  };

  const handleEquipToggle = (item: Item) => {
    if (isItemEquipped(item)) {
      onUnequip(item);
    } else {
      onEquip(item);
      onClose();
    }
  };

  const handleSellFromDetail = (item: Item) => {
    closeDetail();
    // small delay so detail modal exits before sell modal opens
    const timer = window.setTimeout(() => {
      setSellingItem(item);
      setSellClosing(false);
    }, MODAL_CLOSE_MS + 20);
    sellTimerRef.current = timer;
  };

  const closeSellModal = () => {
    if (!sellingItem || sellClosing) return;
    setSellClosing(true);
    if (sellTimerRef.current) window.clearTimeout(sellTimerRef.current);
    sellTimerRef.current = window.setTimeout(() => {
      setSellingItem(null);
      setSellClosing(false);
    }, MODAL_CLOSE_MS);
  };

  const handleConfirmSell = (item: Item, qty: number) => {
    onSell?.(item, qty);
    closeSellModal();
  };

  // Panel slide animation driven by isClosing prop from AnimatedModal
  // mounted drives the enter animation: starts off-screen (translate-y-full), slides up on mount
  const panelSlide = isClosing
    ? 'translate-y-full transition-transform duration-[220ms] ease-in'
    : mounted
      ? 'translate-y-0 transition-transform duration-[320ms] ease-out'
      : 'translate-y-full';

  const overlayFade = isClosing
    ? 'opacity-0 transition-opacity duration-[220ms]'
    : 'opacity-100';

  const filterItemCount = (filterId: InventoryFilter) =>
    inventoryItems.filter(({ item }) => {
      if (filterId === 'equipment') return isEquipmentType(item.type);
      return item.type === filterId;
    }).length;

  return (
    <div className={`absolute inset-0 z-[80] flex flex-col overflow-hidden pointer-events-auto backdrop-blur-md ${overlayFade}`}>

      {/* TOP AREA — slight dark tint, bag image bottom-center, click to close */}
      <div
        className="relative flex-1 min-h-0 flex items-start justify-end p-4 cursor-pointer bg-black/30"
        onClick={onClose}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/50 backdrop-blur-sm px-3 py-2 text-xs font-black uppercase tracking-widest text-white/70 hover:bg-black/70 hover:text-white transition-all active:scale-95"
        >
          <ArrowLeft size={14} /> Fechar
        </button>

        {/* Bag image — fixed-size container keeps layout stable across filter changes */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[440px] md:w-[560px] h-[64vh] md:h-[70vh] max-h-[480px] md:max-h-[580px] pointer-events-none select-none">
          <img
            key={bagAnimKey.current}
            src={BAG_IMAGE[equipmentSubFilter ?? filter]}
            alt=""
            className="absolute bottom-0 left-1/2 h-full w-auto object-contain object-bottom"
            style={{
              transform: 'translateX(-50%)',
              filter:
                'drop-shadow(0 2px 8px rgba(0,0,0,0.95)) ' +
                'drop-shadow(0 8px 28px rgba(0,0,0,0.80)) ' +
                'drop-shadow(0 18px 56px rgba(0,0,0,0.55))',
              animation: shaking
                ? 'bag-shake 0.2s ease-in-out'
                : (!mounted
                  ? 'bag-appear 0.38s cubic-bezier(0.22,1,0.36,1)'
                  : 'none'),
            }}
          />
        </div>
      </div>

      {/* BOTTOM PANEL */}
      <div className={`shrink-0 flex flex-col bg-black/75 backdrop-blur-xl border-t border-white/8 ${panelSlide}`}>

        {/* Header row: icon + title + count + gold */}
        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-0">
          <div className="flex items-center gap-2">
            <GameAssetIcon name="bag" size={18} />
            <span className="text-sm font-black uppercase tracking-[0.18em] text-white">Mochila</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/50">
              {totalItems} itens
            </span>
          </div>
          <div className="flex items-center gap-2">
            {inShopContext && onSell && !isPicking && (
              selectionMode ? (
                <button
                  onClick={exitSelectionMode}
                  className="rounded-xl border border-white/20 bg-white/5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
                >
                  <CheckCircle2 size={12} /> Selecionar
                </button>
              )
            )}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-black text-amber-300">
              <GameAssetIcon name="coin" size={16} />
              {player.gold}
            </div>
          </div>
        </div>

        {/* Picking mode banner */}
        {isPicking && (() => {
          const currentSlotItemId = targetItemSlotIndex !== null ? (equippedItemSlots[targetItemSlotIndex]?.itemId ?? '') : '';
          const currentSlotQty    = targetItemSlotIndex !== null ? (equippedItemSlots[targetItemSlotIndex]?.qty ?? 0) : 0;
          const hasCurrentItem = !!currentSlotItemId;
          const currentSlotItemObj = hasCurrentItem ? shopItems.find(it => it.id === currentSlotItemId) : null;
          return (
            <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
              <FlaskConical size={13} className="shrink-0 text-amber-300" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-black text-amber-200">
                  Slot {(targetItemSlotIndex ?? 0) + 1}
                </span>
                {hasCurrentItem && currentSlotItemObj ? (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-black text-amber-100">
                    — <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center"><ItemIcon item={currentSlotItemObj} emojiClassName="text-sm leading-none" imgClassName="h-4 w-4 object-contain" /></span>
                    <span className="truncate">{currentSlotItemObj.name}</span>
                    <span className="text-amber-400/70">×{currentSlotQty}</span>
                  </span>
                ) : (
                  <span className="ml-1 text-[11px] font-black text-amber-300/60"> — vazio</span>
                )}
              </div>
              {hasCurrentItem && (
                <button
                  onClick={() => { if (onEquipItemToSlot && targetItemSlotIndex !== null) { onEquipItemToSlot(targetItemSlotIndex, null); } }}
                  className="shrink-0 relative overflow-hidden inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/25 active:scale-95"
                >
                  {/* hold-Y fill */}
                  {gpHoldYProgress > 0 && (
                    <span className="absolute inset-0 bg-amber-500/35 origin-left rounded-[inherit] pointer-events-none" style={{ transform: `scaleX(${gpHoldYProgress})` }} />
                  )}
                  {invUiProfile === 'gamepad' && (
                    <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-400 text-[7px] font-black text-black shrink-0">Y</span>
                  )}
                  <span className="relative">× Remover</span>
                </button>
              )}
            </div>
          );
        })()}

        {/* Filter tabs — or locked sub-type header when opened from equipment slot */}
        {equipmentSubFilter ? (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-[0_0_10px_rgba(255,255,255,0.08)]">
              <ItemTypeIcon type={equipmentSubFilter} size={13} />
              <ItemTypeLabel type={equipmentSubFilter} />
            </div>
            <span className="text-[10px] text-white/30 font-black">— selecione para equipar</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 pt-1.5 pb-0">
            {FILTERS.filter(entry => !isPicking || entry.id === 'potion').map((entry) => {
              const active = filter === entry.id;
              const count = filterItemCount(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => { changeFilter(entry.id); }}
                  className={`relative shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${active ? 'border-white bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.25)]' : 'border-white/25 bg-white/5 hover:border-white/50 hover:bg-white/10'}`}
                >
                  {entry.icon}
                  {count > 0 && (
                    <span className={`absolute -bottom-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[8px] font-black leading-none ${active ? 'bg-white text-black' : 'bg-white/20 text-white/60'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Active filter label */}
        {!equipmentSubFilter && (
          <div className="px-4 pb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/55">
              {FILTERS.find(f => f.id === filter)?.label ?? ''}
            </span>
          </div>
        )}

        {/* Items horizontal scroll */}
        <div className={`flex items-start gap-3 overflow-x-auto px-4 no-scrollbar min-h-[180px] transition-all duration-200 ${selectionMode ? 'pb-20' : 'pb-3'}`} data-scrollable style={{ isolation: 'isolate' }}>
          {filteredItems.length === 0 ? (
            <div className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/3 px-6 py-8 text-sm text-white/30">
              Nenhum item nesta categoria.
            </div>
          ) : (
            filteredItems.map(({ item, quantity }, cardIdx) => {
              const isGpFocused = invUiProfile === 'gamepad' && !activeItemId && cardIdx === gpIdx;
              return (
                <InventoryCard
                  key={item.id}
                  item={item}
                  quantity={quantity}
                  player={player}
                  isSelected={activeItemId === item.id}
                  isEquipped={isItemEquipped(item)}
                  onClick={
                    selectionMode
                      ? () => toggleSelectItem(item)
                      : () => openDetail(item)
                  }
                  onEquipToggle={selectionMode ? undefined : handleEquipToggle}
                  isBattleContext={isBattleContext}
                  inSlotIndex={getItemSlotIndex(item.id)}
                  isPicking={isPicking && item.type === 'potion'}
                  isMultiSelectMode={selectionMode}
                  isMultiSelected={selectedIds.has(item.id)}
                  isGpFocused={isGpFocused}
                  gpFocusRef={isGpFocused ? gpFocusedCardRef : undefined}
                  gpHoldXProgress={isGpFocused && !isBattleContext
                    ? (isPicking && item.type === 'potion' ? gpHoldXProgress : (isEquipmentType(item.type) && !isPicking ? gpHoldXProgress : 0))
                    : 0}
                />
              );
            })
          )}
        </div>

        {/* GAMEPAD LEGEND — inline, abaixo da lista */}
        {!activeEntry && !selectionMode && (() => {
          const focusedItem = filteredItems[gpIdx]?.item;
          const focusedIsEquip = !!focusedItem && isEquipmentType(focusedItem.type) && !isBattleContext && !isPicking;
          const focusedIsPickingPotion = isPicking && !!focusedItem && focusedItem.type === 'potion';
          // No modo picking: Y segurando remove; X segurando equipa
          const currentSlotHasItem = isPicking && targetItemSlotIndex !== null && !!equippedItemSlots[targetItemSlotIndex]?.itemId;
          return (
            <GamepadActionLegend
              inline
              showConfirm
              confirmText="Ver detalhes"
              showCancel
              showDPad
              dPadText="Navegar itens"
              showLR={!equipmentSubFilter && !isPicking}
              lrText="Trocar filtro"
              showSkill1={focusedIsEquip || focusedIsPickingPotion}
              skill1Text={focusedIsPickingPotion ? 'Segurar X para equipar no slot' : (focusedItem && isItemEquipped(focusedItem) ? 'Segurar para desequipar' : 'Segurar para equipar')}
              showSkill2={currentSlotHasItem || (!isPicking && !!focusedItem)}
              skill2Text={currentSlotHasItem ? 'Segurar Y para remover slot' : 'Ver detalhes'}
            />
          );
        })()}
      </div>

      {/* ITEM DETAIL MODAL */}
      {activeEntry && !selectionMode && (
        <ItemDetailModal
          item={activeEntry.item}
          quantity={activeEntry.quantity}
          player={player}
          closing={detailClosing}
          onClose={closeDetail}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onUse={onUse}
          onSell={onSell ? (item, qty) => { onSell(item, qty); closeDetail(); } : undefined}
          isEquipped={isItemEquipped(activeEntry.item)}
          isBattleContext={isBattleContext}
          inShopContext={inShopContext}
          onGamepadAction={handleDetailGamepadConfirm}
          isPicking={isPicking}
          targetItemSlotIndex={targetItemSlotIndex}
          onEquipItemToSlot={onEquipItemToSlot}
          equippedItemSlots={equippedItemSlots}
        />
      )}

      {/* SELECTION MODE floating bar */}
      {selectionMode && (
        <div className="absolute bottom-0 left-0 right-0 z-[85] px-4 pb-4 pt-3 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
          <div className="pointer-events-auto flex gap-2">
            <button
              onClick={exitSelectionMode}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={openBatchSell}
              disabled={selectedIds.size === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              <GameAssetIcon name="coin" size={18} />
              {selectedIds.size > 0 ? `Vender ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}` : 'Selecione itens'}
            </button>
          </div>
        </div>
      )}

      {/* BATCH SELL MODAL */}
      {batchSellOpen && (
        <BatchSellModal
          entries={batchEntries}
          player={player}
          onRemove={removeBatchEntry}
          onConfirm={handleBatchConfirm}
          onClose={() => setBatchSellOpen(false)}
        />
      )}


    </div>
  );
};
