import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Heart, Shield, ShoppingBag, Sparkles, Sword, X, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon, GameAssetIconName } from '../ui/game-asset-icon';
import { isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { getUnlockedShopRaritiesByStage } from '../../game/mechanics/shopProgression';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';

const MERCHANT_BG_URL = new URL('../../game/assets/Imagens/Background_Mercador.png', import.meta.url).href;
const MERCHANT_AVATAR_URL = new URL('../../game/assets/Avatares/Personagem_Mercante.png', import.meta.url).href;

type ShopFilter = 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

type ShopMenuScreenProps = {
  player: Player;
  items: Item[];
  huntStage: number;
  onBuy: (item: Item, quantity: number) => void;
  onEquip: (item: Item) => void;
  onSell: (item: Item, quantity: number) => void;
  onLeave: () => void;
};

const FILTERS: Array<{ id: ShopFilter; label: string; iconName: GameAssetIconName }> = [
  { id: 'potion', label: 'Itens', iconName: 'potionRed' },
  { id: 'weapon', label: 'Armas', iconName: 'sword' },
  { id: 'shield', label: 'Escudos', iconName: 'shield' },
  { id: 'helmet', label: 'Capacetes', iconName: 'helm' },
  { id: 'armor', label: 'Armaduras', iconName: 'armor' },
  { id: 'legs', label: 'Botas', iconName: 'boots' },
];

const getRarityBorder = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'border-[#b88956]';
  if (rarity === 'silver') return 'border-slate-400';
  return 'border-amber-400';
};

const getRarityGlow = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'shadow-[0_0_14px_rgba(184,137,86,0.35)]';
  if (rarity === 'silver') return 'shadow-[0_0_14px_rgba(148,163,184,0.35)]';
  return 'shadow-[0_0_18px_rgba(251,191,36,0.5)]';
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

const clampQuantity = (value: number, max: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.floor(value)));
};

const formatPercent = (value: number) => {
  if (Math.abs(value) <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
};

type EffectCard = {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  panel: string;
};

const createEffectCard = (
  id: string, label: string, value: string,
  icon: React.ReactNode, tone: string, panel: string,
): EffectCard => ({ id, label, value, icon, tone, panel });

const getItemEffectCards = (item: Item): EffectCard[] => {
  if (item.type === 'weapon') {
    const cards: EffectCard[] = [
      createEffectCard('atk', 'ATK', `+${item.value}`, <Sword size={15} />, 'text-[#f87171]', 'border-[#7f1d1d]/40 bg-[#450a0a]/60'),
    ];
    if ((item.magicBonus ?? 0) > 0) {
      cards.push(createEffectCard('mag', 'MAG', `+${item.magicBonus}`, <Sparkles size={15} />, 'text-[#c4b5fd]', 'border-[#4c1d95]/40 bg-[#2e1065]/60'));
    }
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
    if (lower.includes('hp') || lower.includes('vida') || lower.includes('cura')) {
      chips.push(createEffectCard('hp', 'VIDA', `+${item.value}`, <Heart size={15} />, 'text-[#86efac]', 'border-[#14532d]/40 bg-[#052e16]/60'));
    }
    if (lower.includes('mp') || lower.includes('mana')) {
      chips.push(createEffectCard('mp', 'MANA', `+${item.value}`, <Zap size={15} />, 'text-[#7dd3fc]', 'border-[#075985]/40 bg-[#082f49]/60'));
    }
    if (chips.length > 0) return chips;
    return [createEffectCard('special', 'ESPECIAL', 'Ativo', <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60')];
  }
  return [createEffectCard('special', 'ESPECIAL', 'Ativo', <Sparkles size={15} />, 'text-[#fcd34d]', 'border-[#78350f]/40 bg-[#451a03]/60')];
};

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
  return bonuses.def + bonuses.maxHp + bonuses.maxMp + bonuses.speed
    + (item.type === 'weapon' ? bonuses.atk + bonuses.magic : 0);
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

const TrendBadge = ({ trend }: { trend: 'up' | 'down' | 'equal' | null }) => {
  if (!trend) return null;
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-white ${trend === 'up' ? 'bg-emerald-500' : trend === 'down' ? 'bg-red-500' : 'bg-amber-400'}`}>
      {trend === 'up' ? <ArrowUp size={10} /> : trend === 'down' ? <ArrowDown size={10} /> : <span className="text-[10px] leading-none font-black">-</span>}
    </span>
  );
};

// Unified Item Detail Modal

type ItemDetailModalProps = {
  item: Item;
  player: Player;
  onClose: () => void;
  onBuyConfirm: (item: Item, qty: number) => void;
  onSellConfirm: (item: Item, qty: number) => void;
  onEquip: (item: Item) => void;
  closing: boolean;
};

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item, player, onClose, onBuyConfirm, onSellConfirm, onEquip, closing,
}) => {
  type Tab = 'buy' | 'sell';
  const ownedQty = player.inventory[item.id] ?? 0;
  const defaultTab: Tab = ownedQty > 0 ? 'sell' : 'buy';
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [buyQty, setBuyQty] = useState(1);
  const [sellQty, setSellQty] = useState(1);

  const isEquipped = (
    player.equippedWeapon?.id === item.id
    || player.equippedArmor?.id === item.id
    || player.equippedHelmet?.id === item.id
    || player.equippedLegs?.id === item.id
    || player.equippedShield?.id === item.id
  );
  const hasLevel = player.level >= item.minLevel;
  const canAfford = player.gold >= item.cost;
  const maxBuyQty = Math.max(0, Math.floor(player.gold / item.cost));
  const buyTotal = buyQty * item.cost;
  const buyGoldAfter = Math.max(0, player.gold - buyTotal);

  const unitSellPrice = Math.floor(item.cost / 2);
  const maxSellQty = ownedQty;
  const sellTotal = sellQty * unitSellPrice;
  const sellGoldAfter = player.gold + sellTotal;

  const effectCards = getItemEffectCards(item);
  const trend = getEquipmentComparisonTrend(player, item);

  const canBuy = canAfford && hasLevel && !isEquipped && maxBuyQty > 0;
  const canSell = ownedQty > 0;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm ${closing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-[28px] border border-white/10 bg-[#0d1117] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden ${closing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 px-5 pt-5 pb-3">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-3 pr-10">
            <span className="text-[44px] leading-none shrink-0 [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_12px_rgba(255,255,255,0.4)]">
              {item.icon}
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white leading-tight">{item.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/60">
                  <ItemTypeIcon type={item.type} size={11} /><ItemTypeLabel type={item.type} />
                </span>
                <span className={`text-[11px] font-black uppercase tracking-wide ${getRarityLabelColor(item.rarity)}`}>
                  {getRarityLabel(item.rarity)}
                </span>
                <span className="text-[10px] text-white/40 font-semibold">Nivel {item.minLevel}</span>
                <TrendBadge trend={trend} />
              </div>
            </div>
          </div>

          {/* Buy / Sell tabs */}
          <div className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setTab('buy')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-black uppercase tracking-widest transition-all ${tab === 'buy' ? 'bg-[#e2b652] text-[#5c3f0d] shadow-sm' : 'text-white/50 hover:text-white/80'}`}
            >
              Comprar
            </button>
            <button
              onClick={() => setTab('sell')}
              disabled={!canSell}
              className={`flex-1 rounded-lg py-1.5 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${tab === 'sell' && canSell ? 'bg-emerald-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
            >
              Vender {canSell ? `(x${ownedQty})` : ''}
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-3" data-scrollable>
          {/* 3D Preview */}
          <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-b from-white/5 to-black/30 border border-white/8">
            <div className="h-[11rem]">
              <ItemPreviewThree item={item} variant="menu" />
            </div>
          </div>

          {/* Description */}
          <p className="mt-3 text-sm leading-relaxed text-white/60">{item.description}</p>

          {/* Effect cards */}
          {effectCards.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {effectCards.map((entry) => (
                <div key={entry.id} className={`rounded-[14px] border px-3 py-2 ${entry.panel}`}>
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">{entry.label}</div>
                  <div className={`mt-1 inline-flex items-center gap-1.5 text-lg font-black ${entry.tone}`}>
                    {entry.icon}{entry.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* BUY tab */}
          {tab === 'buy' && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Voce gasta</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-amber-400">
                    <GameAssetIcon name="coin" size={18} />{buyTotal}
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Ficara com</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-amber-400">
                    <GameAssetIcon name="coin" size={18} />{buyGoldAfter}
                  </div>
                </div>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-white/50">Quantidade</span>
                  <button onClick={() => setBuyQty(maxBuyQty || 1)} disabled={maxBuyQty <= 0} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-30">Max</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setBuyQty((c) => clampQuantity(c - 1, maxBuyQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">-</button>
                  <input type="number" min={1} max={Math.max(1, maxBuyQty)} value={buyQty} onChange={(e) => setBuyQty(clampQuantity(Number(e.target.value), maxBuyQty))} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center text-lg font-black text-white outline-none focus:border-amber-400/50" />
                  <button onClick={() => setBuyQty((c) => clampQuantity(c + 1, maxBuyQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">+</button>
                </div>
                <div className="mt-2 text-[11px] text-white/30 font-semibold">Maximo permitido: {maxBuyQty}</div>
              </div>
              {!hasLevel && (
                <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400">
                  <AlertTriangle size={14} /> Requer nivel {item.minLevel}
                </div>
              )}
            </div>
          )}

          {/* SELL tab */}
          {tab === 'sell' && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Voce recebe</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-emerald-400">
                    <GameAssetIcon name="coin" size={18} />{sellTotal}
                  </div>
                </div>
                <div className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Ficara com</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-emerald-400">
                    <GameAssetIcon name="coin" size={18} />{sellGoldAfter}
                  </div>
                </div>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-white/50">Quantidade</span>
                  <button onClick={() => setSellQty(maxSellQty || 1)} disabled={maxSellQty <= 0} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-30">Tudo</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSellQty((c) => clampQuantity(c - 1, maxSellQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">-</button>
                  <input type="number" min={1} max={Math.max(1, maxSellQty)} value={sellQty} onChange={(e) => setSellQty(clampQuantity(Number(e.target.value), maxSellQty))} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center text-lg font-black text-white outline-none focus:border-emerald-400/50" />
                  <button onClick={() => setSellQty((c) => clampQuantity(c + 1, maxSellQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">+</button>
                </div>
                <div className="mt-2 text-[11px] text-white/30 font-semibold">Disponivel: {maxSellQty}x | Preco unitario: {unitSellPrice}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 bg-black/20 px-5 py-4">
          {tab === 'buy' ? (
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors">Fechar</button>
              {isEquipped ? (
                <button onClick={() => { onEquip(item); onClose(); }} className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/70">Ja equipado</button>
              ) : (
                <button
                  onClick={() => { if (!canBuy) return; onBuyConfirm(item, buyQty); }}
                  disabled={!canBuy}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#c8942f] bg-[#e2b652] px-4 py-2.5 text-sm font-black uppercase tracking-widest text-[#5c3f0d] transition-all hover:-translate-y-0.5 hover:bg-[#ecc265] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <GameAssetIcon name="coin" size={22} />
                  {canBuy ? `Comprar - ${buyTotal}` : !hasLevel ? `Nivel ${item.minLevel}` : 'Sem ouro'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors">Fechar</button>
              <button
                onClick={() => { if (!canSell) return; onSellConfirm(item, sellQty); }}
                disabled={!canSell}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GameAssetIcon name="coinCopper" size={20} />
                {canSell ? `Vender +${sellTotal}` : 'Sem itens'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Item Card

const ItemCard = ({
  item, player, isSelected, onClick,
}: {
  item: Item; player: Player; isSelected: boolean; onClick: () => void;
}) => {
  const isEquipped = (
    player.equippedWeapon?.id === item.id || player.equippedArmor?.id === item.id
    || player.equippedHelmet?.id === item.id || player.equippedLegs?.id === item.id
    || player.equippedShield?.id === item.id
  );
  const canAfford = player.gold >= item.cost;
  const hasLevel = player.level >= item.minLevel;
  const trend = getEquipmentComparisonTrend(player, item);
  const ownedQty = player.inventory[item.id] ?? 0;
  const effectCards = getItemEffectCards(item);
  const statCards = effectCards.filter((e) => e.label !== 'TURNOS' && e.label !== 'ESPECIAL' && e.label !== 'CRAFT');

  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 w-[130px] flex flex-col rounded-[20px] border-2 bg-black/50 backdrop-blur-md p-3 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 ${getRarityBorder(item.rarity)} ${isSelected ? `ring-2 ring-white/30 ${getRarityGlow(item.rarity)}` : 'opacity-85 hover:opacity-100'}`}
    >
      {trend && (
        <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-white z-10 ${trend === 'up' ? 'bg-emerald-500' : trend === 'down' ? 'bg-red-500' : 'bg-amber-400'}`}>
          {trend === 'up' ? <ArrowUp size={9} /> : trend === 'down' ? <ArrowDown size={9} /> : <span className="text-[9px] font-black">-</span>}
        </span>
      )}
      {ownedQty > 0 && (
        <span className="absolute left-2 top-2 z-10 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-400">
          x{ownedQty}
        </span>
      )}
      <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center">
        <span className="text-[38px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_10px_rgba(255,255,255,0.4)]">
          {item.icon}
        </span>
      </div>
      <div className="mt-2 text-center text-[11px] font-black leading-tight text-white line-clamp-2 min-h-[2rem]">
        {item.name}
      </div>
      {statCards.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {statCards.slice(0, 2).map((s) => (
            <span key={s.id} className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${s.panel} ${s.tone}`}>
              {React.isValidElement(s.icon) ? React.cloneElement(s.icon as React.ReactElement<{ size?: number }>, { size: 10 }) : s.icon}
              {s.value}
            </span>
          ))}
        </div>
      ) : (
        <div className={`mt-1 text-center text-[9px] font-black uppercase tracking-widest ${getRarityLabelColor(item.rarity)}`}>
          {getRarityLabel(item.rarity)}
        </div>
      )}
      <div className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border py-1 text-[10px] font-black ${!canAfford || !hasLevel || isEquipped ? 'border-white/10 bg-white/5 text-white/30' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'}`}>
        <GameAssetIcon name="coin" size={12} />
        {isEquipped ? 'Equipado' : !hasLevel ? `Nv.${item.minLevel}` : item.cost}
      </div>
    </button>
  );
};

// Main component

export const ShopMenuScreen: React.FC<ShopMenuScreenProps> = ({
  player, items, huntStage, onBuy, onEquip, onSell, onLeave,
}) => {
  const MODAL_CLOSE_MS = 180;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 20); return () => window.clearTimeout(t); }, []);
  const [filter, setFilter] = useState<ShopFilter>('potion');
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [pendingEquipItem, setPendingEquipItem] = useState<Item | null>(null);
  const [sellConfirmItem, setSellConfirmItem] = useState<{ item: Item; qty: number } | null>(null);
  const [sellConfirmClosing, setSellConfirmClosing] = useState(false);
  const detailCloseTimerRef = useRef<number | null>(null);
  const sellConfirmCloseTimerRef = useRef<number | null>(null);

  const unlockedRarities = useMemo(() => getUnlockedShopRaritiesByStage(huntStage), [huntStage]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.type !== 'material')
      .filter((item) => item.source !== 'dungeon' && item.source !== 'alchemist')
      .filter((item) => unlockedRarities.includes(item.rarity))
      .filter((item) => item.type === filter)
      .sort((a, b) => {
        const rw = (r: Item['rarity']) => r === 'bronze' ? 1 : r === 'silver' ? 2 : 3;
        return rw(a.rarity) - rw(b.rarity) || a.cost - b.cost;
      });
  }, [filter, items, unlockedRarities]);

  useEffect(() => {
    if (filteredItems.length > 0 && !filteredItems.some((i) => i.id === detailItemId)) {
      setDetailItemId(null);
    }
  }, [filteredItems, detailItemId]);

  useEffect(() => () => {
    if (detailCloseTimerRef.current) window.clearTimeout(detailCloseTimerRef.current);
    if (sellConfirmCloseTimerRef.current) window.clearTimeout(sellConfirmCloseTimerRef.current);
  }, []);

  const detailItem = filteredItems.find((i) => i.id === detailItemId) ?? null;

  const openDetail = (item: Item) => {
    setDetailClosing(false);
    setDetailItemId(item.id);
  };

  const closeDetail = () => {
    if (!detailItem || detailClosing) return;
    setDetailClosing(true);
    if (detailCloseTimerRef.current) window.clearTimeout(detailCloseTimerRef.current);
    detailCloseTimerRef.current = window.setTimeout(() => {
      setDetailItemId(null);
      setDetailClosing(false);
    }, MODAL_CLOSE_MS);
  };

  const handleBuyConfirm = (item: Item, qty: number) => {
    onBuy(item, qty);
    if (isEquipmentType(item.type)) setPendingEquipItem(item);
    closeDetail();
  };

  const handleSellConfirm = (item: Item, qty: number) => {
    setSellConfirmItem({ item, qty });
    setSellConfirmClosing(false);
    closeDetail();
  };

  const closeSellConfirm = () => {
    if (!sellConfirmItem || sellConfirmClosing) return;
    setSellConfirmClosing(true);
    if (sellConfirmCloseTimerRef.current) window.clearTimeout(sellConfirmCloseTimerRef.current);
    sellConfirmCloseTimerRef.current = window.setTimeout(() => {
      setSellConfirmItem(null);
      setSellConfirmClosing(false);
    }, MODAL_CLOSE_MS);
  };

  const handleConfirmSell = () => {
    if (!sellConfirmItem) return;
    onSell(sellConfirmItem.item, sellConfirmItem.qty);
    closeSellConfirm();
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${MERCHANT_BG_URL})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />

      {/* Merchant avatar — anchored so ~40% of figure shows above bottom panel */}
      <img
        src={MERCHANT_AVATAR_URL}
        alt=""
        className="absolute bottom-[34%] md:bottom-[18%] left-1/2 -translate-x-1/2 z-[5] h-[90vh] md:h-[72vh] max-h-[640px] md:max-h-[480px] w-auto object-contain object-bottom pointer-events-none select-none"
        style={{
          filter:
            'drop-shadow(0 2px 6px rgba(0,0,0,0.9)) ' +
            'drop-shadow(0 8px 24px rgba(0,0,0,0.75)) ' +
            'drop-shadow(0 20px 60px rgba(0,0,0,0.55))',
          animation: mounted ? 'bag-appear 0.42s cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      />

      {/* TOP BAR */}
      <header className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-white/8">
        <button
          onClick={onLeave}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="flex items-center gap-2">
          <ShoppingBag size={17} className="text-amber-400 shrink-0" />
          <span className="text-base font-black uppercase tracking-[0.18em] text-white">Mercador</span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-300">
          <GameAssetIcon name="coin" size={20} />
          {player.gold}
        </div>
      </header>

      {/* Spacer — background visible here */}
      <div className="relative z-0 flex-1 min-h-0" />

      {/* BOTTOM PANEL */}
      <div className={`relative z-10 shrink-0 flex flex-col bg-black/65 backdrop-blur-xl border-t border-white/8 transition-transform duration-[320ms] ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}>

        {/* Filter row */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 no-scrollbar" data-scrollable>
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => setFilter(entry.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${active ? 'border-amber-400/60 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80'}`}
              >
                <GameAssetIcon name={entry.iconName} size={15} />
                {entry.label}
              </button>
            );
          })}
        </div>

        {/* Cards horizontal scroll */}
        <div className="flex items-stretch gap-3 overflow-x-auto px-4 pb-5 no-scrollbar" data-scrollable>
          {filteredItems.length === 0 ? (
            <div className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/3 px-6 py-8 text-sm text-white/30">
              Nenhum item disponivel nesta categoria.
            </div>
          ) : (
            filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                player={player}
                isSelected={detailItemId === item.id}
                onClick={() => openDetail(item)}
              />
            ))
          )}
        </div>
      </div>

      {/* ITEM DETAIL MODAL */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          player={player}
          closing={detailClosing}
          onClose={closeDetail}
          onBuyConfirm={handleBuyConfirm}
          onSellConfirm={handleSellConfirm}
          onEquip={(item) => { onEquip(item); setPendingEquipItem(null); }}
        />
      )}

      {/* SELL CONFIRMATION */}
      {sellConfirmItem && (
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm ${sellConfirmClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`}
          onClick={closeSellConfirm}
        >
          <div
            className={`w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0d1117] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)] ${sellConfirmClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Confirmacao de venda</div>
            <h3 className="mt-1 text-lg font-black text-white">Confirmar venda?</h3>
            <p className="mt-2 text-sm text-white/60">
              Vender {sellConfirmItem.qty}x {sellConfirmItem.item.name} por{' '}
              <span className="font-black text-emerald-400">{Math.floor(sellConfirmItem.item.cost / 2) * sellConfirmItem.qty} moedas</span>?
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={closeSellConfirm} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10">Cancelar</button>
              <button onClick={handleConfirmSell} className="flex-1 rounded-xl border border-emerald-500/60 bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-500">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* EQUIP PROMPT */}
      {pendingEquipItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0d1117] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Compra concluida</div>
            <h3 className="mt-1 text-lg font-black text-white">Equipar agora?</h3>
            <p className="mt-2 text-sm text-white/60">{pendingEquipItem.name} foi comprado. Deseja equipar no heroi?</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setPendingEquipItem(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10">Depois</button>
              <button onClick={() => { onEquip(pendingEquipItem); setPendingEquipItem(null); }} className="flex-1 rounded-xl border border-amber-500/60 bg-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[#3d2000] hover:bg-amber-400">Equipar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
