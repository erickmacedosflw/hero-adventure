import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Heart, Lock, Shield, Sparkles, Star, Sword, Wind, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { GameAssetIcon, GameAssetIconName } from '../ui/game-asset-icon';
import { isEquipmentType, ItemIcon, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { getUnlockedShopRaritiesByStage } from '../../game/mechanics/shopProgression';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';
import { GamepadActionLegend } from '../ui/GamepadActionLegend';
import { onAction } from '../../game/mechanics/inputManager';
import { useInputMode } from '../../game/hooks/useInputMode';
import { uiSfx } from '../../game/audio/uiSfx';

const MERCHANT_BG_URL    = new URL('../../game/assets/Imagens/Background_Mercador.png', import.meta.url).href;
const ICONE_MERCADOR_URL = new URL('../../game/assets/Icons/Menu/Icone_Mercador.png', import.meta.url).href;
const ICONE_MOCHILA_URL  = new URL('../../game/assets/Icons/Menu/Icone_Mochila.png', import.meta.url).href;

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

const RARITY_COLOR: Record<string, string> = {
  bronze: '#c49a5a',
  silver: '#94a3b8',
  gold:   '#fbbf24',
};

const RARITY_CARD_BG: Record<string, string> = {
  bronze: 'linear-gradient(160deg, rgba(110,62,12,0.82) 0%, rgba(58,30,6,0.92) 100%)',
  silver: 'linear-gradient(160deg, rgba(44,54,90,0.82) 0%, rgba(22,30,56,0.92) 100%)',
  gold:   'linear-gradient(160deg, rgba(115,78,6,0.82) 0%, rgba(64,40,3,0.92) 100%)',
};

const RARITY_LEFT_BG: Record<string, string> = {
  bronze: 'radial-gradient(ellipse at 50% 38%, rgba(196,154,90,0.45) 0%, rgba(80,40,8,0.70) 100%)',
  silver: 'radial-gradient(ellipse at 50% 38%, rgba(148,163,184,0.35) 0%, rgba(22,30,56,0.75) 100%)',
  gold:   'radial-gradient(ellipse at 50% 38%, rgba(251,191,36,0.45) 0%, rgba(64,40,3,0.75) 100%)',
};

const getRarityLabel = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'Comum';
  if (rarity === 'silver') return 'Raro';
  return 'Lendário';
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

// ── Shop Card ────────────────────────────────────────────────────────────────

const ShopCard = ({
  item, player, isSelected, isLocked, onClick, isGpFocused, gpFocusRef,
}: {
  item: Item; player: Player; isSelected: boolean; isLocked: boolean; onClick: () => void;
  isGpFocused?: boolean; gpFocusRef?: React.Ref<HTMLButtonElement>;
}) => {
  const rarityColor  = RARITY_COLOR[item.rarity]   ?? RARITY_COLOR['bronze'];
  const rarityCardBg = RARITY_CARD_BG[item.rarity] ?? RARITY_CARD_BG['bronze'];
  const trend = isEquipmentType(item.type) ? getEquipmentComparisonTrend(player, item) : null;
  const ownedQty = player.inventory[item.id] ?? 0;

  if (isLocked) {
    return (
      <button
        ref={gpFocusRef}
        onClick={onClick}
        className={`relative w-full flex flex-col rounded-[14px] overflow-hidden transition-all duration-150 active:scale-95 ${
          isGpFocused ? 'ring-2 ring-white/30 scale-[1.05]' : isSelected ? 'scale-[1.02]' : 'hover:brightness-110'
        }`}
        style={{ background: 'rgba(10,10,18,0.95)', border: '1.5px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        {/* Icon — same size/position as unlocked, dimmed + padlock overlay */}
        <div className="relative mx-auto mt-6 flex h-10 w-10 items-center justify-center">
          <div className="opacity-20 grayscale">
            <ItemIcon item={item} emojiClassName="text-[32px] leading-none" />
          </div>
          <span className="absolute inset-0 flex items-center justify-center opacity-50"><Lock size={14} strokeWidth={2.5} className="text-white/60" /></span>
        </div>
        {/* Name space — invisible placeholder */}
        <div className="px-1 pb-2 pt-1 text-center text-[9px] font-black leading-tight text-white/0 line-clamp-2 min-h-[2rem]">&nbsp;</div>
      </button>
    );
  }

  return (
    <button
      ref={gpFocusRef}
      onClick={onClick}
      className={`relative w-full flex flex-col rounded-[14px] overflow-hidden transition-all duration-150 active:scale-95 ${
        isGpFocused ? 'ring-2 ring-white/80 scale-[1.05]' : isSelected ? 'scale-[1.02]' : 'hover:scale-[1.03]'
      }`}
      style={{
        background: rarityCardBg,
        border: `1.5px solid ${isSelected ? rarityColor + 'cc' : rarityColor + '44'}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Price badge — top left */}
      <span className="absolute top-1.5 left-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
        <GameAssetIcon name="coin" size={10} />
        {item.cost}
      </span>
      {/* Owned qty — below price badge */}
      {ownedQty > 0 && (
        <span className="absolute top-[2.1rem] left-1.5 z-10 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-black text-white/80">
          x{ownedQty}
        </span>
      )}
      {/* Trend badge — top right (equipment only) */}
      {trend && (
        <span className={`absolute top-1.5 right-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-white ${trend === 'up' ? 'bg-emerald-500' : trend === 'down' ? 'bg-red-500' : 'bg-amber-400'}`}>
          {trend === 'up' ? <ArrowUp size={8} /> : trend === 'down' ? <ArrowDown size={8} /> : <span className="text-[8px] font-black">-</span>}
        </span>
      )}
      {/* Icon */}
      <div className="mx-auto mt-6 flex h-10 w-10 items-center justify-center">
        <ItemIcon item={item} emojiClassName="text-[32px] leading-none" />
      </div>
      {/* Name */}
      <div className="px-1 pb-2 pt-1 text-center text-[9px] font-black leading-tight text-white line-clamp-2 min-h-[2rem]">
        {item.name}
      </div>
    </button>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

export const ShopMenuScreen: React.FC<ShopMenuScreenProps> = ({
  player, items, huntStage, onBuy, onEquip, onSell, onLeave, onOpenInventory, inventoryOpen = false,
}) => {
  const MODAL_CLOSE_MS = 160;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!document.getElementById('shop-v2-anim')) {
      const s = document.createElement('style');
      s.id = 'shop-v2-anim';
      // Animations now defined in index.css (.shop-detail-in / .shop-detail-out)
      s.textContent = '';
      document.head.appendChild(s);
    }
    const t = window.setTimeout(() => setMounted(true), 20);
    return () => window.clearTimeout(t);
  }, []);

  const [filter, setFilter] = useState<ShopFilter>('potion');
  const [filterKey, setFilterKey] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const [pendingEquipItem, setPendingEquipItem] = useState<Item | null>(null);
  const [buyQty, setBuyQty] = useState(1);
  const detailCloseTimerRef = useRef<number | null>(null);

  const { uiProfile: shopUiProfile, gamepadBrand: shopBrand } = useInputMode();
  const isGamepad = shopUiProfile === 'gamepad';
  const BRAND_Y_BG: Record<string, string>    = { xbox: '#F7B000', sony: '#19B86A', nintendo: '#F7B000', generic: '#9a8a00' };
  const BRAND_Y_LABEL: Record<string, string> = { xbox: 'Y', sony: String.fromCharCode(0x25b3), nintendo: 'Y', generic: 'Y' };
  const yBg    = BRAND_Y_BG[shopBrand]    ?? '#F7B000';
  const yLabel = BRAND_Y_LABEL[shopBrand] ?? 'Y';

  const [gpIdx, setGpIdx] = useState(0);
  const gpIdxRef = useRef(0);
  gpIdxRef.current = gpIdx;
  const gpFocusedCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { setGpIdx(0); }, [filter]);

  useEffect(() => {
    if (!isGamepad) return;
    gpFocusedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [gpIdx, isGamepad]);

  const selectedItemIdRef = useRef(selectedItemId);
  selectedItemIdRef.current = selectedItemId;
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

  useEffect(() => {
    return onAction((action) => {
      const hasDetail = !!selectedItemIdRef.current;
      if (action === 'SHOULDER_L' && !hasDetail) {
        const idx = FILTERS.findIndex(f => f.id === pendingFilterRef.current);
        changeFilter(FILTERS[(idx - 1 + FILTERS.length) % FILTERS.length].id);
        uiSfx.play('menu_nav'); return;
      }
      if (action === 'SHOULDER_R' && !hasDetail) {
        const idx = FILTERS.findIndex(f => f.id === pendingFilterRef.current);
        changeFilter(FILTERS[(idx + 1) % FILTERS.length].id);
        uiSfx.play('menu_nav'); return;
      }
      if ((action === 'NAV_LEFT' || action === 'NAV_RIGHT') && !hasDetail) return;
      if (action === 'CONFIRM' && !hasDetail) {
        const item = filteredItemsRef.current[gpIdxRef.current];
        if (item) { openDetail(item); uiSfx.play('modal_open'); }
        return;
      }
      if (action === 'SKILL_2' && !hasDetail) {
        if (onOpenInventoryRef.current) { onOpenInventoryRef.current(); uiSfx.play('modal_open'); }
        return;
      }
      if (action !== 'BACK') return;
      if (hasDetail && !detailClosingRef.current) { closeDetail(); }
      else if (!hasDetail) { onLeave(); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockedRarities = useMemo(() => getUnlockedShopRaritiesByStage(huntStage), [huntStage]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.type !== 'material')
      .filter((item) => item.source !== 'dungeon' && item.source !== 'alchemist')
      .filter((item) => item.type === filter)
      .sort((a, b) => {
        const rw = (r: Item['rarity']) => r === 'bronze' ? 1 : r === 'silver' ? 2 : 3;
        return rw(a.rarity) - rw(b.rarity) || a.cost - b.cost;
      });
  }, [filter, items]);

  const filteredItemsRef = useRef(filteredItems);
  filteredItemsRef.current = filteredItems;

  // RAF hold-repeat card navigation
  useEffect(() => {
    if (!isGamepad) return;
    const INITIAL_DELAY = 420; const INTERVAL_START = 130; const INTERVAL_MIN = 40; const ACCEL = 0.82;
    let rafId: number;
    let leftNextAt: number | null = null; let rightNextAt: number | null = null;
    let leftInterval = INTERVAL_START; let rightInterval = INTERVAL_START;
    let prevLeft = false; let prevRight = false;

    const step = (dir: -1 | 1) => {
      if (selectedItemIdRef.current) return;
      const len = filteredItemsRef.current.length; if (len === 0) return;
      setGpIdx(i => { const next = dir === -1 ? Math.max(0, i - 1) : Math.min(len - 1, i + 1); gpIdxRef.current = next; return next; });
      uiSfx.play('menu_nav');
    };

    const poll = (now: number) => {
      const gps = navigator.getGamepads(); const gp = gps[0] ?? gps[1] ?? null;
      const leftDown  = gp ? ((gp.buttons[14]?.pressed) || (gp.axes[6] ?? 0) < -0.5) : false;
      const rightDown = gp ? ((gp.buttons[15]?.pressed) || (gp.axes[6] ?? 0) >  0.5) : false;
      if (leftDown) {
        if (!prevLeft) { step(-1); leftNextAt = now + INITIAL_DELAY; leftInterval = INTERVAL_START; }
        else if (leftNextAt !== null && now >= leftNextAt) { step(-1); leftInterval = Math.max(INTERVAL_MIN, leftInterval * ACCEL); leftNextAt = now + leftInterval; }
      } else { leftNextAt = null; leftInterval = INTERVAL_START; }
      if (rightDown) {
        if (!prevRight) { step(1); rightNextAt = now + INITIAL_DELAY; rightInterval = INTERVAL_START; }
        else if (rightNextAt !== null && now >= rightNextAt) { step(1); rightInterval = Math.max(INTERVAL_MIN, rightInterval * ACCEL); rightNextAt = now + rightInterval; }
      } else { rightNextAt = null; rightInterval = INTERVAL_START; }
      prevLeft = leftDown; prevRight = rightDown;
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGamepad]);

  useEffect(() => () => { if (detailCloseTimerRef.current) window.clearTimeout(detailCloseTimerRef.current); }, []);

  const isLocked = (item: Item) => player.level < item.minLevel || !unlockedRarities.includes(item.rarity);

  const selectedItem = filteredItems.find(i => i.id === selectedItemId) ?? null;

  const openDetail = (item: Item) => { setDetailClosing(false); setSelectedItemId(item.id); setBuyQty(1); };

  const closeDetail = () => {
    if (!selectedItem || detailClosing) return;
    setDetailClosing(true);
    if (detailCloseTimerRef.current) window.clearTimeout(detailCloseTimerRef.current);
    detailCloseTimerRef.current = window.setTimeout(() => { setSelectedItemId(null); setDetailClosing(false); }, MODAL_CLOSE_MS);
  };

  const maxBuyQty = selectedItem && !isLocked(selectedItem) ? Math.max(1, Math.floor(player.gold / selectedItem.cost)) : 1;

  const handleBuy = () => {
    if (!selectedItem || isLocked(selectedItem)) return;
    onBuy(selectedItem, buyQty);
    if (isEquipmentType(selectedItem.type)) setPendingEquipItem(selectedItem);
    closeDetail();
  };

  const [isShopClosing, setIsShopClosing] = useState(false);
  const handleLeave = () => {
    if (isShopClosing) return;
    setIsShopClosing(true);
    uiSfx.play('modal_close');
    setTimeout(() => onLeave(), 280);
  };

  const panelSlide = isShopClosing
    ? 'translate-y-full transition-transform duration-[280ms] ease-in'
    : mounted ? 'translate-y-0 transition-transform duration-[320ms] ease-out' : 'translate-y-full';
  const overlayFade = isShopClosing ? 'opacity-0 transition-opacity duration-[280ms]' : 'opacity-100';

  return (
    <div
      className={`absolute inset-0 z-[70] flex items-end lg:items-center justify-center pointer-events-auto ${overlayFade}`}
      style={{ background: 'rgba(4,4,12,0.72)' }}
      onClick={handleLeave}
    >
      {/* Sheet */}
      <div
        className={`w-full sm:max-w-2xl lg:w-[640px] lg:max-w-none flex flex-col border-t lg:border border-white/10 rounded-t-[24px] lg:rounded-[24px] max-h-[82dvh] ${panelSlide}`}
        style={{ background: 'rgba(8,8,18,0.88)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── BANNER HEADER ── */}
        <div className="relative shrink-0 rounded-t-[24px] overflow-hidden" style={{ height: 148 }}>
          <div className="absolute inset-0" style={{ backgroundImage: `url(${MERCHANT_BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(4,4,14,0.45) 0%, rgba(4,4,14,0.72) 100%)' }} />
          <div className="absolute bottom-0 inset-x-0 h-16" style={{ background: 'linear-gradient(0deg, rgba(8,8,18,0.95) 0%, transparent 100%)' }} />
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/25 lg:hidden" />
          {/* Back button */}
          <button
            onClick={handleLeave}
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/80 hover:bg-black/70 active:scale-95"
          >
            {isGamepad && (
              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:'50%', background:'#ef4444', fontSize:10, fontWeight:900, color:'#fff', flexShrink:0 }}>B</span>
            )}
            <ArrowLeft size={14} /> Voltar
          </button>
          {/* Gold badge */}
          <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-black/50 px-3 py-2 text-sm font-black text-amber-300">
            <GameAssetIcon name="coin" size={20} />{player.gold}
          </div>
          {/* Title */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <img src={ICONE_MERCADOR_URL} alt="" className="h-7 w-7 object-contain" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }} />
            <span className="text-base font-black uppercase tracking-[0.18em] text-white drop-shadow-md">Mercador</span>
          </div>
          {/* Mochila button */}
          {onOpenInventory && !inventoryOpen && (
            <button
              onClick={onOpenInventory}
              className="absolute bottom-3 right-4 inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-900/60 px-2.5 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-emerald-800/70 active:scale-95"
            >
              {isGamepad && (
                <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:16, height:16, borderRadius:'50%', background:yBg, fontSize:9, fontWeight:900, color:'#fff', flexShrink:0 }}>{yLabel}</span>
              )}
              <img src={ICONE_MOCHILA_URL} alt="" className="h-5 w-5 object-contain" />
              Mochila
            </button>
          )}
        </div>

        {/* ── DESCRIPTION ── */}
        <p className="px-4 py-2 text-[11px] italic text-white/45 leading-relaxed shrink-0">
          {'"Boas-vindas, aventureiro. Tudo que precisa para sua jornada, voce encontra aqui."'}
        </p>

        {/* ── FILTER ROW ── */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 shrink-0 no-scrollbar">
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => changeFilter(entry.id)}
                className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${active ? 'border-white bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.25)]' : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'}`}
              >
                <GameAssetIcon name={entry.iconName} size={22} />
              </button>
            );
          })}
          <span className="ml-1 shrink-0 text-[10px] font-black uppercase tracking-widest text-white/40">
            {FILTERS.find(f => f.id === filter)?.label ?? ''}
          </span>
        </div>

        {/* ── INLINE DETAIL PANE — outside scroll ── */}
        {selectedItem && (
          <div
            className={`mx-3 mb-2 shrink-0 rounded-[18px] overflow-hidden relative ${detailClosing ? 'shop-detail-out' : 'shop-detail-in'}`}
              style={{ border: `1.5px solid ${RARITY_COLOR[selectedItem.rarity]}55`, background: 'rgba(6,6,16,0.92)' }}
            >
              {/* Top glow line */}
              <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-[18px]"
                style={{ background: `linear-gradient(90deg, transparent, ${RARITY_COLOR[selectedItem.rarity]}99, transparent)` }} />
              <div className="flex">
                {/* LEFT column */}
                <div
                  className="shrink-0 flex flex-col items-center pt-5 pb-4"
                  style={{
                    width: 96,
                    background: isLocked(selectedItem)
                      ? 'radial-gradient(ellipse at 50% 38%, rgba(30,30,40,0.9) 0%, rgba(8,8,16,0.98) 100%)'
                      : RARITY_LEFT_BG[selectedItem.rarity],
                  }}
                >
                  {isLocked(selectedItem) ? (
                    <>
                      <span className="text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 mb-3 text-white/20 bg-white/5">
                        Bloqueado
                      </span>
                      <div className="relative flex items-center justify-center w-12 h-12 opacity-15">
                        <ItemIcon item={selectedItem} emojiClassName="text-[44px] leading-none grayscale" />
                      </div>
                      <span className="mt-1 text-3xl grayscale opacity-40">🔒</span>
                    </>
                  ) : (
                    <>
                      {/* Rarity badge */}
                      <span
                        className="text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 mb-3"
                        style={{ color: RARITY_COLOR[selectedItem.rarity], background: `${RARITY_COLOR[selectedItem.rarity]}28` }}
                      >
                        {getRarityLabel(selectedItem.rarity)}
                      </span>
                      {/* Icon */}
                      <div className="relative flex items-center justify-center w-12 h-12">
                        <ItemIcon item={selectedItem} emojiClassName="text-[44px] leading-none" />
                      </div>
                      {/* Price */}
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-amber-300">
                        <GameAssetIcon name="coin" size={13} />
                        {selectedItem.cost}
                      </div>
                    </>
                  )}
                </div>

                {/* RIGHT column */}
                <div className="flex-1 px-3 pt-3 pb-3 relative min-w-0">
                  {/* Close */}
                  <button
                    onClick={closeDetail}
                    className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 text-[12px] font-black active:scale-95"
                  >
                    {String.fromCharCode(0x2715)}
                  </button>
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pr-8">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-black text-white/70">
                      <ItemTypeIcon type={selectedItem.type} size={10} />
                      <ItemTypeLabel type={selectedItem.type} />
                    </span>
                    {isLocked(selectedItem) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-900/40 px-2 py-0.5 text-[9px] font-black text-red-400">
                        Nv.{selectedItem.minLevel} {String.fromCharCode(0x2192)} bloqueado
                      </span>
                    )}
                  </div>
                  {/* Name */}
                  <div className="mt-1.5 text-sm font-black text-white leading-tight pr-6">{selectedItem.name}</div>
                  {/* Description */}
                  <div className="mt-1 text-[10px] text-white/50 line-clamp-2 leading-relaxed">{selectedItem.description}</div>
                  {/* Effect chips */}
                  {(() => {
                    const chips = getItemEffectCards(selectedItem).filter(e => e.label !== 'TURNOS' && e.label !== 'ESPECIAL' && e.label !== 'CRAFT');
                    return chips.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {chips.slice(0, 4).map((c) => (
                          <span key={c.id} className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${c.panel} ${c.tone}`}>
                            {React.isValidElement(c.icon) ? React.cloneElement(c.icon as React.ReactElement<{ size?: number }>, { size: 10 }) : c.icon}
                            {c.value}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {/* ACTION ROW */}
                  <div className="mt-2.5 flex items-center gap-2">
                    {isLocked(selectedItem) ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                        Bloqueado
                      </span>
                    ) : (
                      <>
                        {/* Qty control */}
                        <div className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                          <button
                            onClick={() => setBuyQty(q => Math.max(1, q - 1))}
                            className="px-2.5 py-1.5 text-sm font-black text-white/70 hover:bg-white/10 active:scale-95 transition-colors"
                          >
                            {String.fromCharCode(0x2212)}
                          </button>
                          <span className="px-2 text-xs font-black text-white min-w-[1.5rem] text-center">{buyQty}</span>
                          <button
                            onClick={() => setBuyQty(q => Math.min(maxBuyQty, q + 1))}
                            className="px-2.5 py-1.5 text-sm font-black text-white/70 hover:bg-white/10 active:scale-95 transition-colors"
                          >+</button>
                        </div>
                        {/* Buy button */}
                        <button
                          onClick={handleBuy}
                          disabled={player.gold < selectedItem.cost}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#c8942f] bg-[#e2b652] px-3 py-1.5 text-xs font-black text-[#3d2000] hover:bg-[#f0c660] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <GameAssetIcon name="coin" size={13} />
                          Comprar {String.fromCharCode(0x2013)} {selectedItem.cost * buyQty}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* ── SCROLLABLE GRID ── */}
        <div className="flex-1 min-h-0 overflow-y-auto shop-scroll" data-scrollable>
          <div key={filterKey} className="grid grid-cols-4 md:grid-cols-6 gap-2.5 px-3 pb-4 shop-filter-in">
            {filteredItems.length === 0 ? (
              <div className="col-span-4 md:col-span-6 flex items-center justify-center rounded-[16px] border border-dashed border-white/10 bg-white/3 py-10 text-sm text-white/30">
                <Sparkles size={16} className="mr-2 opacity-50" />
                Nenhum item disponivel nesta categoria.
              </div>
            ) : (
              filteredItems.map((item, idx) => (
                <ShopCard
                  key={item.id}
                  item={item}
                  player={player}
                  isSelected={selectedItemId === item.id}
                  isLocked={isLocked(item)}
                  isGpFocused={isGamepad && gpIdx === idx}
                  gpFocusRef={isGamepad && gpIdx === idx ? gpFocusedCardRef : undefined}
                  onClick={() => openDetail(item)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── GAMEPAD LEGEND ── */}
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
        <div className="lg:hidden" style={{ height: 'max(0.5rem, env(safe-area-inset-bottom))' }} />
      </div>

      {/* EQUIP PROMPT */}
      {pendingEquipItem && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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
