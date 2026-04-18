import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, FlaskConical, Heart, Shield, Sparkles, Sword, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';

const BAG_POTION_URL = new URL('../../game/assets/Mochila/Mochila_Aberta_Consumiveis.png', import.meta.url).href;
const BAG_EQUIPMENT_URL = new URL('../../game/assets/Mochila/Mochila_Aberta_Equipamentos.png', import.meta.url).href;
const BAG_MATERIAL_URL = new URL('../../game/assets/Mochila/Mochila_Aberta_Materiais.png', import.meta.url).href;

const BAG_IMAGE: Record<string, string> = {
  potion: BAG_POTION_URL,
  equipment: BAG_EQUIPMENT_URL,
  material: BAG_MATERIAL_URL,
};

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
  initialFilter?: 'all' | 'equipment' | 'potion' | 'material';
  isClosing?: boolean;
};

type InventoryFilter = 'potion' | 'equipment' | 'material';

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS: Array<{ id: InventoryFilter; label: string; icon: React.ReactNode }> = [
  { id: 'potion', label: 'Consumíveis', icon: <GameAssetIcon name="potionBlue" size={14} /> },
  { id: 'equipment', label: 'Equipamentos', icon: <GameAssetIcon name="helm" size={14} /> },
  { id: 'material', label: 'Materiais', icon: <GameAssetIcon name="gear" size={14} /> },
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
    const cards: EffectCard[] = [createEffectCard('atk', 'ATK', `+${item.value}`, <Sword size={15} />, 'text-[#f87171]', 'border-[#7f1d1d]/40 bg-[#450a0a]/60')];
    if ((item.magicBonus ?? 0) > 0) cards.push(createEffectCard('mag', 'MAG', `+${item.magicBonus}`, <Sparkles size={15} />, 'text-[#c4b5fd]', 'border-[#4c1d95]/40 bg-[#2e1065]/60'));
    return cards;
  }
  if (item.type === 'armor' || item.type === 'helmet' || item.type === 'legs' || item.type === 'shield') {
    const bonuses = getEquipmentBonuses(item);
    const cards: EffectCard[] = [];
    if (bonuses.def > 0) cards.push(createEffectCard('def', 'DEF', `+${bonuses.def}`, <Shield size={15} />, 'text-[#93c5fd]', 'border-[#1e3a5f]/40 bg-[#0c1a2e]/60'));
    if (bonuses.maxHp > 0) cards.push(createEffectCard('hp', 'VIDA', `+${bonuses.maxHp}`, <Heart size={15} />, 'text-[#86efac]', 'border-[#14532d]/40 bg-[#052e16]/60'));
    if (bonuses.maxMp > 0) cards.push(createEffectCard('mp', 'MANA', `+${bonuses.maxMp}`, <Zap size={15} />, 'text-[#7dd3fc]', 'border-[#075985]/40 bg-[#082f49]/60'));
    if (bonuses.speed > 0) cards.push(createEffectCard('spd', 'VEL', `+${bonuses.speed}`, <Zap size={15} />, 'text-[#d8b4fe]', 'border-[#581c87]/40 bg-[#2e1065]/60'));
    return cards;
  }
  if (item.type === 'potion') {
    if (item.id === 'pot_2') return [createEffectCard('mana', 'MANA', `+${item.value}`, <Zap size={15} />, 'text-[#7dd3fc]', 'border-[#075985]/40 bg-[#082f49]/60')];
    if (item.id === 'pot_atk') return [
      createEffectCard('atk_boost', 'ATK', `+${formatPercent(item.value)}`, <Sword size={15} />, 'text-[#f87171]', 'border-[#7f1d1d]/40 bg-[#450a0a]/60'),
      createEffectCard('duration', 'TURNOS', `${item.duration ?? 3}t`, <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60'),
    ];
    if (item.id === 'pot_def') return [
      createEffectCard('def_boost', 'DEF', `+${formatPercent(item.value)}`, <Shield size={15} />, 'text-[#93c5fd]', 'border-[#1e3a5f]/40 bg-[#0c1a2e]/60'),
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
  return bonuses.def + bonuses.maxHp + bonuses.maxMp + bonuses.speed + (item.type === 'weapon' ? bonuses.atk + bonuses.magic : 0);
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
}> = ({ item, quantity, player, isSelected, isEquipped, onClick, onEquipToggle, isBattleContext }) => {
  const trend = getEquipmentComparisonTrend(player, item);
  const isEquipCard = isEquipmentType(item.type);
  const effectCards = getItemEffectCards(item);
  const statCards = effectCards.filter((e) => e.label !== 'TURNOS' && e.label !== 'ESPECIAL' && e.label !== 'CRAFT');

  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 w-[130px] flex flex-col rounded-[20px] border-2 ${getRarityBorder(item.rarity)} bg-black/50 backdrop-blur-md p-3 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 ${getRarityGlow(item.rarity)} ${isSelected ? 'ring-2 ring-white/30 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'opacity-85 hover:opacity-100'}`}
    >
      {/* Quantity badge */}
      <span className="absolute right-2 top-2 z-10 rounded-full border border-white/20 bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-white">
        x{quantity}
      </span>

      {/* Trend badge — equipment only (not equipped), top-left */}
      {trend && !isEquipped && (
        <span className={`absolute left-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 ${trend === 'up' ? 'bg-emerald-500/80 text-white' : trend === 'down' ? 'bg-rose-500/80 text-white' : 'bg-amber-500/80 text-white'}`}>
          {trend === 'up' ? <ArrowUp size={10} /> : trend === 'down' ? <ArrowDown size={10} /> : <span className="text-[10px] leading-none font-black">—</span>}
        </span>
      )}

      {/* Equipped badge — top-left */}
      {isEquipped && (
        <span className="absolute left-2 top-2 z-10 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black text-emerald-400 uppercase tracking-widest">E</span>
      )}

      {/* Icon */}
      <div className="mx-auto mt-3 flex h-14 w-14 items-center justify-center">
        <span className="text-[38px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_10px_rgba(255,255,255,0.4)]">
          {item.icon}
        </span>
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

      {/* Equip/Unequip inline button — equipment only, camp only */}
      {isEquipCard && !isBattleContext && onEquipToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onEquipToggle(item); }}
          className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all hover:-translate-y-0.5 active:scale-95 ${isEquipped ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'}`}
        >
          <Shield size={10} />
          {isEquipped ? 'Desequipar' : 'Equipar'}
        </button>
      )}
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
}> = ({ item, quantity, player, closing, onClose, onEquip, onUnequip, onUse, onSell, isEquipped, isBattleContext }) => {
  const overlayClass = closing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in';
  const panelClass = closing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in';
  const effectCards = getItemEffectCards(item);
  const trend = getEquipmentComparisonTrend(player, item);
  const isEquipCard = isEquipmentType(item.type);
  const ownedQty = player.inventory[item.id] ?? 0;
  const canEquip = !isBattleContext && isEquipCard && !isEquipped;
  const canUnequip = !isBattleContext && isEquipCard && isEquipped;
  const canUse = isBattleContext && item.type === 'potion';
  const canSell = !isBattleContext && Boolean(onSell) && ownedQty > 0 && !(isEquipCard && isEquipped);
  const sellValue = Math.floor(item.cost / 2);
  const [sellQty, setSellQty] = useState(1);
  const sellTotal = sellQty * sellValue;

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
            <span className="text-[42px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_12px_rgba(255,255,255,0.5)]">{item.icon}</span>
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

          {/* 3D preview */}
          <div className="mt-3 overflow-hidden rounded-[18px] bg-white/3 border border-white/8">
            <div className="h-[10rem]">
              <ItemPreviewThree item={item} variant="menu" />
            </div>
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
          {(canEquip || canUnequip) && (
            <button
              onClick={() => { canEquip ? onEquip?.(item) : onUnequip?.(item); onClose(); }}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 ${canEquip ? 'border-emerald-500/50 bg-emerald-600/80 text-white hover:bg-emerald-500' : 'border-amber-500/50 bg-amber-600/80 text-white hover:bg-amber-500'}`}
            >
              <Shield size={16} />
              {canEquip ? 'Equipar' : 'Desequipar'}
            </button>
          )}
          {canUse && (
            <button
              onClick={() => { onUse?.(item.id); onClose(); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-600/80 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-sky-500 active:scale-95"
            >
              <FlaskConical size={16} /> Usar Item
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
          <span className="text-[32px] leading-none">{item.icon}</span>
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
}: InventoryScreenProps) => {
  const MODAL_CLOSE_MS = 180;

  const resolveInitialFilter = (): InventoryFilter => {
    if (initialFilter === 'equipment') return 'equipment';
    if (initialFilter === 'material') return 'material';
    return 'potion';
  };

  const [filter, setFilter] = useState<InventoryFilter>(resolveInitialFilter);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [sellingItem, setSellingItem] = useState<Item | null>(null);
  const [sellClosing, setSellClosing] = useState(false);
  const detailTimerRef = useRef<number | null>(null);
  const sellTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (detailTimerRef.current) window.clearTimeout(detailTimerRef.current);
    if (sellTimerRef.current) window.clearTimeout(sellTimerRef.current);
  }, []);

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

  const filteredItems = useMemo(() => {
    return inventoryItems.filter(({ item }) => {
      if (filter === 'equipment') return isEquipmentType(item.type);
      return item.type === filter;
    });
  }, [filter, inventoryItems]);

  const totalItems = inventoryItems.reduce((s, e) => s + e.quantity, 0);

  const isItemEquipped = (item: Item) => (
    player.equippedWeapon?.id === item.id
    || player.equippedArmor?.id === item.id
    || player.equippedHelmet?.id === item.id
    || player.equippedLegs?.id === item.id
    || player.equippedShield?.id === item.id
  );

  const activeEntry = filteredItems.find((e) => e.item.id === activeItemId) ?? null;

  const openDetail = (item: Item) => {
    setDetailClosing(false);
    setActiveItemId(item.id);
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
  const panelSlide = isClosing
    ? 'translate-y-full transition-transform duration-[220ms] ease-in'
    : 'translate-y-0 transition-transform duration-[220ms] ease-out';

  const overlayFade = isClosing
    ? 'opacity-0 transition-opacity duration-[220ms]'
    : 'opacity-100';

  const filterItemCount = (filterId: InventoryFilter) =>
    inventoryItems.filter(({ item }) => {
      if (filterId === 'equipment') return isEquipmentType(item.type);
      return item.type === filterId;
    }).length;

  return (
    <div className={`absolute inset-0 z-[80] flex flex-col overflow-hidden pointer-events-auto ${overlayFade}`}>

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

        {/* Bag image — centered above the bottom panel */}
        <img
          src={BAG_IMAGE[filter]}
          alt=""
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[42vh] max-h-[280px] w-auto object-contain object-bottom pointer-events-none select-none transition-opacity duration-200"
          style={{
            filter:
              'drop-shadow(0 2px 8px rgba(0,0,0,0.95)) ' +
              'drop-shadow(0 8px 28px rgba(0,0,0,0.80)) ' +
              'drop-shadow(0 18px 56px rgba(0,0,0,0.55))',
          }}
        />
      </div>

      {/* BOTTOM PANEL */}
      <div className={`shrink-0 flex flex-col bg-black/75 backdrop-blur-xl border-t border-white/8 ${panelSlide}`}>

        {/* Header row: icon + title + count + gold */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <GameAssetIcon name="bag" size={18} />
            <span className="text-sm font-black uppercase tracking-[0.18em] text-white">Mochila</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/50">
              {totalItems} itens
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-black text-amber-300">
            <GameAssetIcon name="coin" size={16} />
            {player.gold}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 no-scrollbar" data-scrollable>
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            const count = filterItemCount(entry.id);
            return (
              <button
                key={entry.id}
                onClick={() => { setFilter(entry.id); setActiveItemId(null); }}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${active ? 'border-white/30 bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80'}`}
              >
                {entry.icon}
                {entry.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 text-[9px] font-black ${active ? 'bg-white/20 text-white/80' : 'bg-white/10 text-white/40'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Items horizontal scroll */}
        <div className="flex items-stretch gap-3 overflow-x-auto px-4 pb-5 no-scrollbar min-h-[212px]" data-scrollable>
          {filteredItems.length === 0 ? (
            <div className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/3 px-6 py-8 text-sm text-white/30">
              Nenhum item nesta categoria.
            </div>
          ) : (
            filteredItems.map(({ item, quantity }) => (
              <InventoryCard
                key={item.id}
                item={item}
                quantity={quantity}
                player={player}
                isSelected={activeItemId === item.id}
                isEquipped={isItemEquipped(item)}
                onClick={() => openDetail(item)}
                onEquipToggle={handleEquipToggle}
                isBattleContext={isBattleContext}
              />
            ))
          )}
        </div>
      </div>

      {/* ITEM DETAIL MODAL */}
      {activeEntry && (
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
        />
      )}


    </div>
  );
};
