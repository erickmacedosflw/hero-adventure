import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Heart, Shield, ShoppingBag, Sparkles, Star, Sword, Wind, X, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { GameAssetIcon, GameAssetIconName } from '../ui/game-asset-icon';
import { isEquipmentType, ItemIcon, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { getUnlockedShopRaritiesByStage } from '../../game/mechanics/shopProgression';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';
import { GamepadActionLegend } from '../ui/GamepadActionLegend';
import { onAction, pushInputLayer } from '../../game/mechanics/inputManager';
import { useInputMode } from '../../game/hooks/useInputMode';
import { uiSfx } from '../../game/audio/uiSfx';

const MERCHANT_BG_URL = new URL('../../game/assets/Imagens/Background_Mercador.png', import.meta.url).href;
const MERCHANT_AVATAR_URL = new URL('../../game/assets/Avatares/Personagem_Mercante.png', import.meta.url).href;
const ICONE_MOCHILA_URL = new URL('../../game/assets/Icons/Menu/Icone_Mochila.png', import.meta.url).href;

type ShopFilter = 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

type ShopMenuScreenProps = {
  player: Player;
  items: Item[];
  huntStage: number;
  onBuy: (item: Item, quantity: number) => void;
  onEquip: (item: Item) => void;
  onSell: (item: Item, quantity: number) => void;
  onLeave: () => void;
  onOpenInventory?: () => void;
  inventoryOpen?: boolean;
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
  return bonuses.def + bonuses.magicDef + bonuses.maxHp + bonuses.maxMp + bonuses.speed + bonuses.luck
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

  // ── Gamepad support ────────────────────────────────────────────────────────
  const { uiProfile: detailProfile, gamepadBrand: detailBrand } = useInputMode();
  const isGp = detailProfile === 'gamepad';
  const BRAND_A_BG:  Record<string, string> = { xbox: '#107C10', sony: '#0070D1', nintendo: '#107C10', generic: '#4a4a9a' };
  const BRAND_A_LBL: Record<string, string> = { xbox: 'A', sony: '✕', nintendo: 'A', generic: 'A' };
  const BRAND_B_BG:  Record<string, string> = { xbox: '#E52420', sony: '#E80000', nintendo: '#E52420', generic: '#9a4a4a' };
  const BRAND_B_LBL: Record<string, string> = { xbox: 'B', sony: '○', nintendo: 'B', generic: 'B' };
  const BRAND_X_BG:  Record<string, string> = { xbox: '#0055A5', sony: '#B54DC0', nintendo: '#0055A5', generic: '#1a6a9a' };
  const BRAND_X_LBL: Record<string, string> = { xbox: 'X', sony: '□', nintendo: 'X', generic: 'X' };
  const BRAND_Y_BG:  Record<string, string> = { xbox: '#F7B000', sony: '#19B86A', nintendo: '#F7B000', generic: '#9a8a00' };
  const BRAND_Y_LBL: Record<string, string> = { xbox: 'Y', sony: '△', nintendo: 'Y', generic: 'Y' };
  const aBg  = BRAND_A_BG[detailBrand]  ?? '#107C10';
  const aLbl = BRAND_A_LBL[detailBrand] ?? 'A';
  const bBg  = BRAND_B_BG[detailBrand]  ?? '#E52420';
  const bLbl = BRAND_B_LBL[detailBrand] ?? 'B';
  const xBg  = BRAND_X_BG[detailBrand]  ?? '#0055A5';
  const xLbl = BRAND_X_LBL[detailBrand] ?? 'X';
  const yBg  = BRAND_Y_BG[detailBrand]  ?? '#F7B000';
  const yLbl = BRAND_Y_LBL[detailBrand] ?? 'Y';

  // Stable refs
  const tabRef = useRef(tab); tabRef.current = tab;
  const buyQtyRef = useRef(buyQty); buyQtyRef.current = buyQty;
  const sellQtyRef = useRef(sellQty); sellQtyRef.current = sellQty;
  const canBuyRef  = useRef(canBuy);  canBuyRef.current  = canBuy;
  const canSellRef = useRef(canSell); canSellRef.current = canSell;
  const maxBuyQtyRef  = useRef(maxBuyQty);  maxBuyQtyRef.current  = maxBuyQty;
  const maxSellQtyRef = useRef(maxSellQty); maxSellQtyRef.current = maxSellQty;
  const onBuyConfirmRef  = useRef(onBuyConfirm);  onBuyConfirmRef.current  = onBuyConfirm;
  const onSellConfirmRef = useRef(onSellConfirm); onSellConfirmRef.current = onSellConfirm;
  const itemRef = useRef(item); itemRef.current = item;

  const HOLD_MS = 600;

  // Hold-A (buy) RAF
  const [holdBuyProgress, setHoldBuyProgress] = useState(0);
  const holdBuyRafRef   = useRef<number | null>(null);
  const holdBuyStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isGp) return;
    let waitRelease = true;
    let fired = false;
    const poll = () => {
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const aDown = gp ? (gp.buttons[0]?.pressed || (gp.buttons[0]?.value ?? 0) > 0.5) : false;
      if (waitRelease) { if (!aDown) waitRelease = false; holdBuyRafRef.current = requestAnimationFrame(poll); return; }
      if (aDown && canBuyRef.current && !fired && tabRef.current === 'buy') {
        if (holdBuyStartRef.current === null) holdBuyStartRef.current = performance.now();
        const pct = Math.min((performance.now() - holdBuyStartRef.current) / HOLD_MS, 1);
        setHoldBuyProgress(pct);
        if (pct >= 1) { fired = true; setHoldBuyProgress(1); onBuyConfirmRef.current(itemRef.current, buyQtyRef.current); return; }
      } else if (!aDown) {
        if (!fired) { holdBuyStartRef.current = null; setHoldBuyProgress(0); }
      }
      holdBuyRafRef.current = requestAnimationFrame(poll);
    };
    holdBuyRafRef.current = requestAnimationFrame(poll);
    return () => { if (holdBuyRafRef.current !== null) cancelAnimationFrame(holdBuyRafRef.current); setHoldBuyProgress(0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGp, canBuy]);

  // Hold-X (sell) RAF
  const [holdSellProgress, setHoldSellProgress] = useState(0);
  const holdSellRafRef   = useRef<number | null>(null);
  const holdSellStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isGp || !canSell) return;
    let waitRelease = true;
    let fired = false;
    const poll = () => {
      if (tabRef.current !== 'sell') { holdSellRafRef.current = requestAnimationFrame(poll); return; }
      const gp = navigator.getGamepads()[0] ?? navigator.getGamepads()[1] ?? null;
      const xDown = gp ? (gp.buttons[2]?.pressed || (gp.buttons[2]?.value ?? 0) > 0.5) : false;
      if (waitRelease) { if (!xDown) waitRelease = false; holdSellRafRef.current = requestAnimationFrame(poll); return; }
      if (xDown && canSellRef.current && !fired) {
        if (holdSellStartRef.current === null) holdSellStartRef.current = performance.now();
        const pct = Math.min((performance.now() - holdSellStartRef.current) / HOLD_MS, 1);
        setHoldSellProgress(pct);
        if (pct >= 1) { fired = true; setHoldSellProgress(1); onSellConfirmRef.current(itemRef.current, sellQtyRef.current); return; }
      } else if (!xDown) {
        if (!fired) { holdSellStartRef.current = null; setHoldSellProgress(0); }
      }
      holdSellRafRef.current = requestAnimationFrame(poll);
    };
    holdSellRafRef.current = requestAnimationFrame(poll);
    return () => { if (holdSellRafRef.current !== null) cancelAnimationFrame(holdSellRafRef.current); setHoldSellProgress(0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGp, canSell]);

  // D-pad qty hold-repeat (smooth acceleration) — tab-aware
  useEffect(() => {
    if (!isGp) {
      return pushInputLayer((action) => {
        if (action === 'BACK') { onClose(); return true; }
        if (action === 'SKILL_1') { setBuyQty(q => q >= (maxBuyQtyRef.current || 1) ? 1 : (maxBuyQtyRef.current || 1)); uiSfx.play('menu_nav'); return true; }
        if (action === 'SKILL_2' && canSellRef.current) { setTab(t => t === 'buy' ? 'sell' : 'buy'); uiSfx.play('menu_nav'); return true; }
        return false;
      });
    }

    const INITIAL_DELAY = 450;
    const INTERVAL_START = 140;
    const INTERVAL_MIN = 45;
    const ACCEL = 0.82;

    let rafId: number;
    let leftNextAt: number | null = null;
    let rightNextAt: number | null = null;
    let leftInterval = INTERVAL_START;
    let rightInterval = INTERVAL_START;
    let prevLeft = false;
    let prevRight = false;

    const stepQty = (dir: -1 | 1) => {
      if (tabRef.current === 'sell') {
        setSellQty(q => clampQuantity(q + dir, maxSellQtyRef.current));
      } else {
        setBuyQty(q => clampQuantity(q + dir, maxBuyQtyRef.current));
      }
      uiSfx.play('menu_nav');
    };

    const poll = (now: number) => {
      const gps = navigator.getGamepads();
      const gp = gps[0] ?? gps[1] ?? null;
      const leftDown  = gp ? ((gp.buttons[14]?.pressed) || (gp.axes[6] ?? 0) < -0.5) : false;
      const rightDown = gp ? ((gp.buttons[15]?.pressed) || (gp.axes[6] ?? 0) >  0.5) : false;

      if (leftDown) {
        if (!prevLeft) { stepQty(-1); leftNextAt = now + INITIAL_DELAY; leftInterval = INTERVAL_START; }
        else if (leftNextAt !== null && now >= leftNextAt) { stepQty(-1); leftInterval = Math.max(INTERVAL_MIN, leftInterval * ACCEL); leftNextAt = now + leftInterval; }
      } else { leftNextAt = null; leftInterval = INTERVAL_START; }

      if (rightDown) {
        if (!prevRight) { stepQty(1); rightNextAt = now + INITIAL_DELAY; rightInterval = INTERVAL_START; }
        else if (rightNextAt !== null && now >= rightNextAt) { stepQty(1); rightInterval = Math.max(INTERVAL_MIN, rightInterval * ACCEL); rightNextAt = now + rightInterval; }
      } else { rightNextAt = null; rightInterval = INTERVAL_START; }

      prevLeft  = leftDown;
      prevRight = rightDown;
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);

    const cleanup = pushInputLayer((action) => {
      if (action === 'BACK') { onClose(); return true; }
      if (action === 'SKILL_1') {
        // On buy tab: Max/Min toggle; on sell tab: swallowed (hold-X RAF handles it)
        if (tabRef.current === 'buy') { setBuyQty(q => q >= (maxBuyQtyRef.current || 1) ? 1 : (maxBuyQtyRef.current || 1)); uiSfx.play('menu_nav'); }
        return true;
      }
      if (action === 'SKILL_2' && canSellRef.current) { setTab(t => t === 'buy' ? 'sell' : 'buy'); uiSfx.play('menu_nav'); return true; }
      if (action === 'NAV_LEFT' || action === 'NAV_RIGHT') return true;
      return false;
    });

    return () => { cancelAnimationFrame(rafId); cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGp]);

  // Badge helper
  const BtnBadge = ({ bg, lbl }: { bg: string; lbl: React.ReactNode }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: bg, fontSize: 11, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{lbl}</span>
  );

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
          <button onClick={onClose} className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <div className="h-[44px] w-[44px] shrink-0 flex items-center justify-center">
              <ItemIcon item={item} emojiClassName="text-[44px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_12px_rgba(255,255,255,0.4)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white leading-tight">{item.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/60">
                  <ItemTypeIcon type={item.type} size={11} /><ItemTypeLabel type={item.type} />
                </span>
                <span className={`text-[11px] font-black uppercase tracking-wide ${getRarityLabelColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
                <span className="text-[10px] text-white/40 font-semibold">Nivel {item.minLevel}</span>
                <TrendBadge trend={trend} />
              </div>
            </div>
          </div>

          {/* Tab toggle (shown only if player owns some) */}
          {canSell && (
            <div className="mt-3 flex rounded-xl border border-white/10 bg-white/5 p-0.5 gap-0.5">
              <button
                onClick={() => setTab('buy')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${tab === 'buy' ? 'bg-amber-400/20 text-amber-300' : 'text-white/40 hover:text-white/70'}`}
              >
                Comprar
              </button>
              <button
                onClick={() => setTab('sell')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${tab === 'sell' ? 'bg-emerald-400/20 text-emerald-300' : 'text-white/40 hover:text-white/70'}`}
              >
                {isGp && <BtnBadge bg={yBg} lbl={yLbl} />}
                Vender
              </button>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-3" data-scrollable>
          {/* Icon Preview */}
          <div className="relative flex items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-b from-white/5 to-black/30 border border-white/8 h-[11rem]">
            {item.iconImage
              ? <img src={item.iconImage} draggable={false} alt={item.name} className="w-32 h-32 object-contain drop-shadow-2xl" />
              : <span className="text-8xl leading-none select-none">{item.icon}</span>
            }
          </div>

          <p className="mt-3 text-sm leading-relaxed text-white/60">{item.description}</p>

          {effectCards.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {effectCards.map((entry) => (
                <div key={entry.id} className={`rounded-[14px] border px-3 py-2 ${entry.panel}`}>
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">{entry.label}</div>
                  <div className={`mt-1 inline-flex items-center gap-1.5 text-lg font-black ${entry.tone}`}>{entry.icon}{entry.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* BUY SECTION */}
          {tab === 'buy' && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Voce gasta</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-amber-400"><GameAssetIcon name="coin" size={18} />{buyTotal}</div>
                </div>
                <div className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Ficara com</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-amber-400"><GameAssetIcon name="coin" size={18} />{buyGoldAfter}</div>
                </div>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-white/50">Quantidade</span>
                  <button
                    onClick={() => setBuyQty(q => q >= (maxBuyQty || 1) ? 1 : (maxBuyQty || 1))}
                    disabled={maxBuyQty <= 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-30"
                  >
                    {isGp && <BtnBadge bg={xBg} lbl={xLbl} />}
                    {buyQty >= (maxBuyQty || 1) ? 'Min' : 'Max'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setBuyQty(c => clampQuantity(c - 1, maxBuyQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">-</button>
                  <input type="number" min={1} max={Math.max(1, maxBuyQty)} value={buyQty} onChange={e => setBuyQty(clampQuantity(Number(e.target.value), maxBuyQty))} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center text-lg font-black text-white outline-none focus:border-amber-400/50" />
                  <button onClick={() => setBuyQty(c => clampQuantity(c + 1, maxBuyQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">+</button>
                </div>
                {isGp && <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/35 font-semibold"><span style={{ fontFamily: 'system-ui', fontSize: 13 }}>◀▶</span> Ajustar quantidade</div>}
                <div className="mt-1 text-[11px] text-white/30 font-semibold">Maximo permitido: {maxBuyQty}</div>
              </div>
              {!hasLevel && (
                <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400">
                  <AlertTriangle size={14} /> Requer nivel {item.minLevel}
                </div>
              )}
            </div>
          )}

          {/* SELL SECTION */}
          {tab === 'sell' && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-[14px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Voce recebe</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-emerald-400"><GameAssetIcon name="coin" size={18} />{sellTotal}</div>
                </div>
                <div className="rounded-[14px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Total de ouro</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-emerald-400"><GameAssetIcon name="coin" size={18} />{sellGoldAfter}</div>
                </div>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-white/50">Quantidade</span>
                  <button
                    onClick={() => setSellQty(q => q >= maxSellQty ? 1 : maxSellQty)}
                    disabled={maxSellQty <= 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-30"
                  >
                    {sellQty >= maxSellQty ? 'Min' : 'Max'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSellQty(c => clampQuantity(c - 1, maxSellQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">-</button>
                  <input type="number" min={1} max={Math.max(1, maxSellQty)} value={sellQty} onChange={e => setSellQty(clampQuantity(Number(e.target.value), maxSellQty))} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center text-lg font-black text-white outline-none focus:border-emerald-400/50" />
                  <button onClick={() => setSellQty(c => clampQuantity(c + 1, maxSellQty))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-black text-white hover:bg-white/10">+</button>
                </div>
                {isGp && <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/35 font-semibold"><span style={{ fontFamily: 'system-ui', fontSize: 13 }}>◀▶</span> Ajustar quantidade</div>}
                <div className="mt-1 text-[11px] text-white/30 font-semibold">Voce possui: {ownedQty}</div>
              </div>
              <div className="mt-2 rounded-[12px] border border-white/8 bg-white/5 px-3 py-2 text-[11px] text-white/40 font-semibold">
                Preco unitario de venda: <span className="text-emerald-400">{unitSellPrice}</span> ouro
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 bg-black/20 px-5 py-4">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors"
            >
              {isGp && <BtnBadge bg={bBg} lbl={bLbl} />}
              Fechar
            </button>

            {tab === 'buy' && (
              isEquipped ? (
                <button onClick={() => { onEquip(item); onClose(); }} className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/70">Ja equipado</button>
              ) : (
                <button
                  onClick={() => { if (!canBuy) return; onBuyConfirm(item, buyQty); }}
                  disabled={!canBuy}
                  className="relative overflow-hidden flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#c8942f] bg-[#e2b652] px-4 py-2.5 text-sm font-black uppercase tracking-widest text-[#5c3f0d] transition-all hover:-translate-y-0.5 hover:bg-[#ecc265] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGp && holdBuyProgress > 0 && (
                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', transform: `scaleX(${holdBuyProgress})`, transformOrigin: 'left', transition: 'transform 60ms linear', borderRadius: 'inherit', pointerEvents: 'none' }} />
                  )}
                  {isGp && <BtnBadge bg="#fff" lbl={<span style={{ color: aBg, fontWeight: 900, fontSize: 11 }}>{aLbl}</span>} />}
                  <GameAssetIcon name="coin" size={22} />
                  <span style={{ position: 'relative' }}>
                    {canBuy
                      ? (isGp && holdBuyProgress > 0 ? (holdBuyProgress < 1 ? 'Segure...' : '✓ Comprado!') : `Comprar - ${buyTotal}`)
                      : !hasLevel ? `Nivel ${item.minLevel}` : 'Sem ouro'}
                  </span>
                </button>
              )
            )}

            {tab === 'sell' && (
              <button
                onClick={() => { if (!canSell) return; onSellConfirm(item, sellQty); }}
                disabled={!canSell}
                className="relative overflow-hidden flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGp && holdSellProgress > 0 && (
                  <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', transform: `scaleX(${holdSellProgress})`, transformOrigin: 'left', transition: 'transform 60ms linear', borderRadius: 'inherit', pointerEvents: 'none' }} />
                )}
                {isGp && <BtnBadge bg={xBg} lbl={xLbl} />}
                <GameAssetIcon name="coin" size={22} />
                <span style={{ position: 'relative' }}>
                  {isGp && holdSellProgress > 0
                    ? (holdSellProgress < 1 ? 'Segure...' : '✓ Vendido!')
                    : `Vender - ${sellTotal}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Item Card

const ItemCard = ({
  item, player, isSelected, onClick, isGpFocused, gpFocusRef,
}: {
  item: Item; player: Player; isSelected: boolean; onClick: () => void;
  isGpFocused?: boolean; gpFocusRef?: React.Ref<HTMLButtonElement>;
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
      ref={gpFocusRef}
      onClick={onClick}
      className={`relative shrink-0 w-[130px] flex flex-col rounded-[20px] border-2 bg-black/50 backdrop-blur-md p-3 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 ${getRarityBorder(item.rarity)} ${
        isGpFocused
          ? `ring-[3px] ring-white/90 shadow-[0_0_28px_rgba(255,255,255,0.40)] -translate-y-2 scale-[1.06] ${getRarityGlow(item.rarity)}`
          : isSelected ? `ring-2 ring-white/30 ${getRarityGlow(item.rarity)}` : 'opacity-85 hover:opacity-100'
      }`}
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
        <ItemIcon item={item} emojiClassName="text-[38px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_10px_rgba(255,255,255,0.4)]" />
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
      <div className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-sm font-black ${!canAfford || !hasLevel || isEquipped ? 'border-white/10 bg-white/5 text-white/30' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'}`}>
        <GameAssetIcon name="coin" size={14} />
        {isEquipped ? 'Equipado' : !hasLevel ? `Nv.${item.minLevel}` : item.cost}
      </div>
    </button>
  );
};

// Main component

export const ShopMenuScreen: React.FC<ShopMenuScreenProps> = ({
  player, items, huntStage, onBuy, onEquip, onSell, onLeave, onOpenInventory, inventoryOpen = false,
}) => {
  const MODAL_CLOSE_MS = 180;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!document.getElementById('shop-anim-style')) {
      const s = document.createElement('style');
      s.id = 'shop-anim-style';
      s.textContent = [
        '@keyframes avatar-fade-in{0%{opacity:0}100%{opacity:1}}',
        '@keyframes shop-filter-in{0%{opacity:0;transform:translateX(24px)}100%{opacity:1;transform:translateX(0)}}',
      ].join('');
      document.head.appendChild(s);
    }
    const t = window.setTimeout(() => setMounted(true), 20);
    return () => window.clearTimeout(t);
  }, []);
  const [filter, setFilter] = useState<ShopFilter>('potion');
  const [filterKey, setFilterKey] = useState(0);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [pendingEquipItem, setPendingEquipItem] = useState<Item | null>(null);
  const [sellConfirmItem, setSellConfirmItem] = useState<{ item: Item; qty: number } | null>(null);
  const [sellConfirmClosing, setSellConfirmClosing] = useState(false);
  const detailCloseTimerRef = useRef<number | null>(null);
  const sellConfirmCloseTimerRef = useRef<number | null>(null);

  const { uiProfile: shopUiProfile, gamepadBrand: shopBrand } = useInputMode();
  const isGamepad = shopUiProfile === 'gamepad';
  const BRAND_Y_BG: Record<string, string> = { xbox: '#F7B000', sony: '#19B86A', nintendo: '#F7B000', generic: '#9a8a00' };
  const BRAND_Y_LABEL: Record<string, string> = { xbox: 'Y', sony: '△', nintendo: 'Y', generic: 'Y' };
  const yBg    = BRAND_Y_BG[shopBrand]    ?? '#F7B000';
  const yLabel = BRAND_Y_LABEL[shopBrand] ?? 'Y';

  // Gamepad card navigation
  const [gpIdx, setGpIdx] = useState(0);
  const gpIdxRef = useRef(0);
  gpIdxRef.current = gpIdx;
  const gpFocusedCardRef = useRef<HTMLButtonElement | null>(null);

  // Reset cursor when filter changes
  useEffect(() => { setGpIdx(0); }, [filter]);

  // Auto-scroll focused card into view
  useEffect(() => {
    if (!isGamepad) return;
    gpFocusedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [gpIdx, isGamepad]);

  // Refs for stale-closure safety in gamepad handler
  const detailItemIdRef = useRef(detailItemId);
  detailItemIdRef.current = detailItemId;
  const detailClosingRef = useRef(detailClosing);
  detailClosingRef.current = detailClosing;
  const pendingFilterRef = useRef<ShopFilter>(filter);
  pendingFilterRef.current = filter;
  const onOpenInventoryRef = useRef(onOpenInventory);
  onOpenInventoryRef.current = onOpenInventory;

  const changeFilter = (newFilter: ShopFilter) => {
    if (newFilter === pendingFilterRef.current) return;
    pendingFilterRef.current = newFilter;
    setFilter(newFilter);
    setFilterKey(k => k + 1);
  };

  // Gamepad: BACK + LB/RB filter cycling + D-pad nav + Confirm + Y=Mochila
  useEffect(() => {
    return onAction((action) => {
      const hasModal = !!detailItemIdRef.current;
      // LB/RB — filter cycling (blocked when modal open)
      if (action === 'SHOULDER_L' && !hasModal) {
        const idx = FILTERS.findIndex(f => f.id === pendingFilterRef.current);
        changeFilter(FILTERS[(idx - 1 + FILTERS.length) % FILTERS.length].id);
        uiSfx.play('menu_nav');
        return;
      }
      if (action === 'SHOULDER_R' && !hasModal) {
        const idx = FILTERS.findIndex(f => f.id === pendingFilterRef.current);
        changeFilter(FILTERS[(idx + 1) % FILTERS.length].id);
        uiSfx.play('menu_nav');
        return;
      }
      // D-pad left/right handled by RAF hold-repeat effect below — swallow here
      if ((action === 'NAV_LEFT' || action === 'NAV_RIGHT') && !hasModal) return;
      // A — open detail of focused card
      if (action === 'CONFIRM' && !hasModal) {
        const item = filteredItemsRef.current[gpIdxRef.current];
        if (item) { openDetail(item); uiSfx.play('modal_open'); }
        return;
      }
      // Y — open inventory/mochila
      if (action === 'SKILL_2' && !hasModal) {
        if (onOpenInventoryRef.current) { onOpenInventoryRef.current(); uiSfx.play('modal_open'); }
        return;
      }
      // BACK
      if (action !== 'BACK') return;
      if (hasModal && !detailClosingRef.current) {
        closeDetail();
      } else if (!hasModal) {
        onLeave();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // filteredItemsRef must be after filteredItems useMemo
  const filteredItemsRef = useRef(filteredItems);
  filteredItemsRef.current = filteredItems;

  // Smooth hold-repeat card navigation (RAF polling) — must be after filteredItemsRef
  useEffect(() => {
    if (!isGamepad) return;
    const INITIAL_DELAY = 420;
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
      if (detailItemIdRef.current) return; // modal open → skip
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
          leftNextAt    = now + INITIAL_DELAY;
          leftInterval  = INTERVAL_START;
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
          rightNextAt    = now + INITIAL_DELAY;
          rightInterval  = INTERVAL_START;
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
  }, [isGamepad]);

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

      {/* Merchant avatar — hidden for now */}
      {false && <img
        src={MERCHANT_AVATAR_URL}
        alt=""
        className="absolute bottom-[34%] md:bottom-[18%] left-1/2 -translate-x-1/2 z-[5] h-[90vh] md:h-[72vh] max-h-[640px] md:max-h-[480px] w-auto object-contain object-bottom pointer-events-none select-none"
        style={{
          filter:
            'drop-shadow(0 2px 6px rgba(0,0,0,0.9)) ' +
            'drop-shadow(0 8px 24px rgba(0,0,0,0.75)) ' +
            'drop-shadow(0 20px 60px rgba(0,0,0,0.55))',
          animation: mounted ? 'none' : 'avatar-fade-in 0.5s ease-out forwards',
        }}
      />}

      {/* TOP BAR */}
      <header className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-white/8">
        <button
          onClick={onLeave}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
        >
          {isGamepad && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#ef4444', fontSize: 10, fontWeight: 900, color: '#fff', flexShrink: 0 }}>B</span>
          )}
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="flex items-center gap-2">
          <ShoppingBag size={17} className="text-amber-400 shrink-0" />
          <span className="text-base font-black uppercase tracking-[0.18em] text-white">Mercador</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-300">
            <GameAssetIcon name="coin" size={20} />
            {player.gold}
          </div>
        </div>
      </header>

      {/* SIDE RAIL — mochila */}
      {onOpenInventory && !inventoryOpen && (
        <div className="absolute right-3 sm:right-5 top-[4.5rem] sm:top-20 z-10 flex flex-col gap-4">
          <button
            onClick={onOpenInventory}
            className="group flex flex-col items-center gap-1 p-0 bg-transparent border-0 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95"
            title="Mochila"
            aria-label="Mochila"
          >
            <div className="flex items-center justify-center w-full relative">
              <img src={ICONE_MOCHILA_URL} alt="" className="h-14 w-14 object-contain group-hover:scale-110 group-hover:-translate-y-0.5" style={{ filter: 'drop-shadow(0.5px 0 0 #fff) drop-shadow(-0.5px 0 0 #fff) drop-shadow(0 0.5px 0 #fff) drop-shadow(0 -0.5px 0 #fff)', transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              {isGamepad && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: yBg, fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{yLabel}</span>
              )}
              <GameAssetIcon name="coin" size={11} />Vender
            </span>
          </button>
        </div>
      )}

      {/* Spacer — background visible here */}
      <div className="relative z-0 flex-1 min-h-0" />

      {/* BOTTOM PANEL */}
      <div className={`relative z-10 shrink-0 flex flex-col bg-black/65 backdrop-blur-xl border-t border-white/8 transition-transform duration-[320ms] ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}>

        {/* Filter row — icon only */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => changeFilter(entry.id)}
                className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${active ? 'border-white bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.30)]' : 'border-white/25 bg-white/5 hover:border-white/50 hover:bg-white/10'}`}
              >
                <GameAssetIcon name={entry.iconName} size={26} />
              </button>
            );
          })}
        </div>

        {/* Active filter label */}
        <div className="px-4 pb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/55">
            {FILTERS.find(f => f.id === filter)?.label ?? ''}
          </span>
        </div>

        {/* Cards horizontal scroll */}
        <div
          key={filterKey}
          className="flex items-stretch gap-3 overflow-x-auto px-4 pb-4 no-scrollbar min-h-[240px]"
          style={{ animation: 'shop-filter-in 220ms cubic-bezier(0.22,1,0.36,1) both' }}
          data-scrollable
        >
          {filteredItems.length === 0 ? (
            <div className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/3 px-6 py-8 text-sm text-white/30">
              Nenhum item disponivel nesta categoria.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                player={player}
                isSelected={detailItemId === item.id}
                isGpFocused={isGamepad && gpIdx === idx}
                gpFocusRef={isGamepad && gpIdx === idx ? gpFocusedCardRef : undefined}
                onClick={() => openDetail(item)}
              />
            ))
          )}
        </div>

        {/* Gamepad legend — inline, base do painel */}
        <GamepadActionLegend
          inline
          showConfirm
          confirmText="Ver detalhes"
          showCancel
          showDPad
          dPadText="Navegar itens"
          showLR
          lrText="Trocar categoria"
          showSkill2={!!onOpenInventory}
          skill2Text="Mochila"
        />
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
