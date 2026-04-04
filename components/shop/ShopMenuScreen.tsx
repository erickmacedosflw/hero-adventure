import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Heart, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon, GameAssetIconName } from '../ui/game-asset-icon';
import { getRarityColor, getRarityLabel, isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { RpgMenuPanel, RpgMenuSectionTitle, RpgMenuShell, RpgMenuStat, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';
import { getUnlockedShopRaritiesByStage } from '../../game/mechanics/shopProgression';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';

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

const getFilterTabHighlightClass = (active: boolean) => {
  if (!active) return '';
  return 'border-[#e2b652] bg-[#f3cf6f] text-[#5c3f0d] shadow-[0_10px_24px_rgba(142,102,35,0.28)]';
};

const getFilterIconClass = (active: boolean) => {
  if (!active) return 'opacity-80';
  return 'rounded-full border-2 border-white bg-[#fff2cf] p-0.5 shadow-[0_4px_10px_rgba(92,63,13,0.18)]';
};

const getRarityBorderClass = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'border-[3px] border-[#b88956]';
  if (rarity === 'silver') return 'border-[3px] border-slate-400';
  return 'border-[3px] border-amber-400';
};

const getRarityCardBackgroundClass = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'bg-[#f2e3cf] hover:bg-[#ead8bf]';
  if (rarity === 'silver') return 'bg-[#ece9e1] hover:bg-[#e3dfd6]';
  return 'bg-[#f3ead2] hover:bg-[#ecdfbf]';
};

const getRarityDisplayLabel = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'Comum';
  if (rarity === 'silver') return 'Raro';
  return 'Lendario';
};

const getTypeIconAssetName = (type: Item['type']): GameAssetIconName => {
  if (type === 'potion') return 'potionRed';
  if (type === 'weapon') return 'sword';
  if (type === 'shield') return 'shield';
  if (type === 'helmet') return 'helm';
  if (type === 'armor') return 'armor';
  if (type === 'legs') return 'boots';
  return 'gear';
};

const getTypeIconToneClass = (type: Item['type']) => {
  if (type === 'weapon') return 'border-[#b83a4b] bg-[#fff2f4]';
  if (type === 'shield') return 'border-[#567a9d] bg-[#f2f8ff]';
  if (type === 'helmet') return 'border-[#7662a6] bg-[#f5f1ff]';
  if (type === 'armor') return 'border-[#4e8f70] bg-[#edf9f2]';
  if (type === 'legs') return 'border-[#8a6f4a] bg-[#fff7eb]';
  if (type === 'potion') return 'border-[#8e3f7a] bg-[#fff1fb]';
  return 'border-[#9a7b64] bg-[#fff6ea]';
};

const renderFilterIcon = (iconName: GameAssetIconName, active: boolean, size = 22) => {
  return <GameAssetIcon name={iconName} size={size} className={getFilterIconClass(active)} />;
};

const getRarityWeight = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 1;
  if (rarity === 'silver') return 2;
  return 3;
};

const clampQuantity = (value: number, max: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.floor(value)));
};

type EffectCard = {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  panel: string;
};

type ItemAttributeBadge = {
  id: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  panel: string;
};

const getTypeFilterIcon = (type: Item['type']) => {
  if (type === 'potion') return <GameAssetIcon name="potionRed" size={18} />;
  if (type === 'weapon') return <GameAssetIcon name="sword" size={18} />;
  if (type === 'shield') return <GameAssetIcon name="shield" size={18} />;
  if (type === 'helmet') return <GameAssetIcon name="helm" size={18} />;
  if (type === 'armor') return <GameAssetIcon name="armor" size={18} />;
  if (type === 'legs') return <GameAssetIcon name="boots" size={18} />;
  return <GameAssetIcon name="gear" size={18} />;
};

const createEffectCard = (id: string, label: string, value: string, icon: React.ReactNode, tone: string, panel: string): EffectCard => {
  return { id, label, value, icon, tone, panel };
};

const formatPercent = (value: number) => {
  if (Math.abs(value) <= 1) {
    return `${Math.round(value * 100)}%`;
  }
  return `${Math.round(value)}%`;
};

const getItemEffectCards = (item: Item): EffectCard[] => {
  if (item.type === 'weapon') {
    const cards: EffectCard[] = [
      createEffectCard('atk', 'ATK', `+${item.value}`, <Sword size={15} />, 'text-[#b83a4b]', 'border-[#e6b1b9] bg-[linear-gradient(180deg,#fff8f8,#fbe9eb)]'),
    ];
    if ((item.magicBonus ?? 0) > 0) {
      cards.push(createEffectCard('mag', 'MAG', `+${item.magicBonus}`, <Sparkles size={15} />, 'text-[#5f4ab3]', 'border-[#c7bee6] bg-[linear-gradient(180deg,#f7f5ff,#ece8fb)]'));
    }
    return cards;
  }

  if (item.type === 'armor' || item.type === 'helmet' || item.type === 'legs' || item.type === 'shield') {
    const bonuses = getEquipmentBonuses(item);
    const cards: EffectCard[] = [];
    if (bonuses.def > 0) {
      cards.push(createEffectCard('def', 'DEF', `+${bonuses.def}`, <Shield size={15} />, 'text-[#4d6780]', 'border-[#b9c8d7] bg-[linear-gradient(180deg,#f8fbff,#eaf1f8)]'));
    }
    if (bonuses.maxHp > 0) {
      cards.push(createEffectCard('hp', 'VIDA', `+${bonuses.maxHp}`, <Heart size={15} />, 'text-[#2f8f5b]', 'border-[#b7ddc8] bg-[linear-gradient(180deg,#f6fff9,#e8f8ef)]'));
    }
    if (bonuses.maxMp > 0) {
      cards.push(createEffectCard('mp', 'MANA', `+${bonuses.maxMp}`, <Zap size={15} />, 'text-[#2f6fa8]', 'border-[#afc9e2] bg-[linear-gradient(180deg,#f6fbff,#e6f1fb)]'));
    }
    if (bonuses.speed > 0) {
      cards.push(createEffectCard('spd', 'VEL', `+${bonuses.speed}`, <Zap size={15} />, 'text-[#7c4c76]', 'border-[#d3bfd8] bg-[linear-gradient(180deg,#fbf7ff,#f2e9fb)]'));
    }
    return cards;
  }

  if (item.type === 'potion') {
    if (item.id === 'pot_2') {
      return [createEffectCard('mana', 'MANA', `+${item.value}`, <Zap size={15} />, 'text-[#2f6fa8]', 'border-[#afc9e2] bg-[linear-gradient(180deg,#f6fbff,#e6f1fb)]')];
    }

    if (item.id === 'pot_atk') {
      return [
        createEffectCard('atk_boost', 'ATK', `+${formatPercent(item.value)}`, <Sword size={15} />, 'text-[#b83a4b]', 'border-[#e6b1b9] bg-[linear-gradient(180deg,#fff8f8,#fbe9eb)]'),
        createEffectCard('duration', 'TURNOS', `${item.duration ?? 3}t`, <Sparkles size={15} />, 'text-[#8a5a57]', 'border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)]'),
      ];
    }

    if (item.id === 'pot_def') {
      return [
        createEffectCard('def_boost', 'DEF', `+${formatPercent(item.value)}`, <Shield size={15} />, 'text-[#4d6780]', 'border-[#b9c8d7] bg-[linear-gradient(180deg,#f8fbff,#eaf1f8)]'),
        createEffectCard('duration', 'TURNOS', `${item.duration ?? 3}t`, <Sparkles size={15} />, 'text-[#8a5a57]', 'border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)]'),
      ];
    }

    const lowerDescription = item.description.toLowerCase();
    const chips: EffectCard[] = [];
    if (lowerDescription.includes('hp') || lowerDescription.includes('vida') || lowerDescription.includes('cura')) {
      chips.push(createEffectCard('hp', 'VIDA', `+${item.value}`, <Heart size={15} />, 'text-[#2f8f5b]', 'border-[#b7ddc8] bg-[linear-gradient(180deg,#f6fff9,#e8f8ef)]'));
    }
    if (lowerDescription.includes('mp') || lowerDescription.includes('mana')) {
      chips.push(createEffectCard('mp', 'MANA', `+${item.value}`, <Zap size={15} />, 'text-[#2f6fa8]', 'border-[#afc9e2] bg-[linear-gradient(180deg,#f6fbff,#e6f1fb)]'));
    }
    if (chips.length > 0) {
      return chips;
    }

    return [createEffectCard('special', 'ESPECIAL', 'Ativo', <Sparkles size={15} />, 'text-[#8a5a57]', 'border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)]')];
  }

  return [createEffectCard('special', 'ESPECIAL', 'Ativo', <Sparkles size={15} />, 'text-[#8a5a57]', 'border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)]')];
};

const getItemAttributeBadges = (item: Item): ItemAttributeBadge[] => {
  return getItemEffectCards(item)
    .filter((entry) => entry.label !== 'TURNOS' && entry.label !== 'ESPECIAL')
    .map((entry) => ({
      id: entry.id,
      value: entry.value,
      icon: entry.icon,
      tone: entry.tone,
      panel: entry.panel,
    }));
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
  if (!isEquipmentType(item.type)) {
    return 0;
  }

  const bonuses = getEquipmentBonuses(item);

  // Aggregate all relevant attributes for fair comparison between multi-attribute items.
  const defenseScore = bonuses.def;
  const hpScore = bonuses.maxHp;
  const mpScore = bonuses.maxMp;
  const speedScore = bonuses.speed;
  const attackScore = item.type === 'weapon' ? bonuses.atk : 0;
  const magicScore = item.type === 'weapon' ? bonuses.magic : 0;

  return attackScore + magicScore + defenseScore + hpScore + mpScore + speedScore;
};

const getEquipmentComparisonTrend = (player: Player, item: Item): 'up' | 'down' | 'equal' | null => {
  if (!isEquipmentType(item.type)) {
    return null;
  }

  const equipped = getEquippedItemForType(player, item.type);
  if (!equipped) {
    return 'up';
  }

  const delta = getEquipmentComparableScore(item) - getEquipmentComparableScore(equipped);
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'equal';
};

const renderEquipmentTrendBadge = (trend: 'up' | 'down' | 'equal' | null) => {
  if (!trend) {
    return null;
  }

  return (
    <div className={`absolute right-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white shadow-sm ${trend === 'up' ? 'bg-[#3ea86f] text-white' : trend === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
      {trend === 'up' ? <ArrowUp size={12} /> : trend === 'down' ? <ArrowDown size={12} /> : <span className="text-sm leading-none">-</span>}
    </div>
  );
};

const ShopItemDetail = ({ item, player, onBuy }: { item: Item | null; player: Player; onBuy: (item: Item) => void }) => {
  if (!item) {
    return (
      <div className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-4 text-center text-[#8f6c67]">
        <GameAssetIcon name="chest" size={60} className="opacity-68" />
        <h3 className="mt-4 text-lg font-black text-[#6b3141]">Selecione um item</h3>
        <p className="mt-2 max-w-sm text-sm">Veja atributos, preview 3D e compre com seguranca.</p>
      </div>
    );
  }

  const canAfford = player.gold >= item.cost;
  const hasLevel = player.level >= item.minLevel;
  const isEquipped = player.equippedWeapon?.id === item.id || player.equippedArmor?.id === item.id || player.equippedHelmet?.id === item.id || player.equippedLegs?.id === item.id || player.equippedShield?.id === item.id;
  const effectCards = getItemEffectCards(item);
  const equipmentTrend = getEquipmentComparisonTrend(player, item);

  return (
    <RpgMenuPanel className="relative rounded-[24px] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center">
          <span className="text-[40px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">
            {item.icon}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black text-[#6b3141]">{item.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#fff5e6] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7f5b56]">
              <ItemTypeIcon type={item.type} size={12} />
              <ItemTypeLabel type={item.type} />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#fff8ef] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7f5b56]">
              Nivel {item.minLevel}
            </span>
            {equipmentTrend && (
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm ${equipmentTrend === 'up' ? 'bg-[#3ea86f] text-white' : equipmentTrend === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
                {equipmentTrend === 'up' ? <ArrowUp size={10} /> : equipmentTrend === 'down' ? <ArrowDown size={10} /> : <span className="text-xs leading-none">-</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{item.description}</p>

      <div className="mt-3 rpg-3d-showcase relative overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
        <div className="h-[10rem]"><ItemPreviewThree item={item} variant="menu" /></div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {effectCards.map((entry) => (
          <div key={`${item.id}-${entry.id}`} className={`rounded-[14px] border px-2.5 py-2 ${entry.panel}`}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a7068]">{entry.label}</div>
            <div className={`mt-1 inline-flex items-center gap-1 text-lg font-black ${entry.tone}`}>
              {entry.icon}
              {entry.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-[#7f5b56]">
        {isEquipped ? 'Esse item ja esta equipado pelo heroi.' : !hasLevel ? `Alcance o nivel ${item.minLevel} para liberar a compra.` : !canAfford ? `Faltam ${item.cost - player.gold} moedas.` : 'Compre agora ou ajuste quantidade no detalhe de compra.'}
      </div>

      <button
        onClick={() => onBuy(item)}
        disabled={!canAfford || isEquipped || !hasLevel}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-black uppercase tracking-[0.14em] transition-all ${!canAfford || isEquipped || !hasLevel ? 'border-[#d6b9a3] bg-[#ead8c4] text-[#a08475] cursor-not-allowed' : 'border-[#8f6a24] bg-[#b8892f] text-white hover:-translate-y-0.5 hover:bg-[#c79636]'}`}
      >
        {isEquipped ? (
          <>
            <GameAssetIcon name="helm" size={22} />
            Equipado
          </>
        ) : !hasLevel ? (
          <>
            <AlertTriangle size={16} />
            Nivel {item.minLevel}
          </>
        ) : (
          <>
            <GameAssetIcon name="coin" size={30} className="[filter:drop-shadow(0_0_0_#fff)_drop-shadow(0_0_0_#fff)_drop-shadow(1.5px_0_0_#fff)_drop-shadow(-1.5px_0_0_#fff)_drop-shadow(0_1.5px_0_#fff)_drop-shadow(0_-1.5px_0_#fff)_drop-shadow(1.5px_1.5px_0_#fff)_drop-shadow(-1.5px_1.5px_0_#fff)_drop-shadow(1.5px_-1.5px_0_#fff)_drop-shadow(-1.5px_-1.5px_0_#fff)]" />
            Comprar {item.cost}
          </>
        )}
      </button>
    </RpgMenuPanel>
  );
};

export const ShopMenuScreen: React.FC<ShopMenuScreenProps> = ({ player, items, huntStage, onBuy, onEquip, onSell, onLeave }) => {
  const MODAL_CLOSE_MS = 180;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ShopFilter>('potion');
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);
  const [mobileShowSell, setMobileShowSell] = useState(false);
  const [pendingEquipItem, setPendingEquipItem] = useState<Item | null>(null);
  const [buyingItem, setBuyingItem] = useState<Item | null>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [sellingItem, setSellingItem] = useState<Item | null>(null);
  const [sellConfirmation, setSellConfirmation] = useState<{ item: Item; quantity: number } | null>(null);
  const [sellConfirmationClosing, setSellConfirmationClosing] = useState(false);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [buyModalClosing, setBuyModalClosing] = useState(false);
  const [sellModalClosing, setSellModalClosing] = useState(false);
  const buyModalCloseTimerRef = useRef<number | null>(null);
  const sellModalCloseTimerRef = useRef<number | null>(null);
  const sellConfirmationCloseTimerRef = useRef<number | null>(null);
  const unlockedRarities = useMemo(() => getUnlockedShopRaritiesByStage(huntStage), [huntStage]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.type !== 'material')
      .filter((item) => item.source !== 'dungeon' && item.source !== 'alchemist')
      .filter((item) => unlockedRarities.includes(item.rarity))
      .filter((item) => item.type === filter)
      .sort((left, right) => {
        const rarityDifference = getRarityWeight(left.rarity) - getRarityWeight(right.rarity);
        if (rarityDifference !== 0) {
          return rarityDifference;
        }
        return left.cost - right.cost;
      });
  }, [filter, items, unlockedRarities]);

  const sellableEntries = useMemo(() => {
    return Object.entries(player.inventory)
      .map(([id, qty]) => {
        if (qty <= 0) return null;
        const item = items.find((entry) => entry.id === id);
        if (!item) return null;
        return {
          item,
          qty,
          unitSellPrice: Math.floor(item.cost / 2),
        };
      })
      .filter((entry): entry is { item: Item; qty: number; unitSellPrice: number } => Boolean(entry));
  }, [items, player.inventory]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedItemId(null);
      setMobileDetailItemId(null);
      return;
    }

    if (!filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  useEffect(() => {
    if (buyingItem) {
      setBuyModalClosing(false);
    }
  }, [buyingItem]);

  useEffect(() => {
    if (sellingItem) {
      setSellModalClosing(false);
    }
  }, [sellingItem]);

  useEffect(() => {
    if (sellConfirmation) {
      setSellConfirmationClosing(false);
    }
  }, [sellConfirmation]);

  useEffect(() => {
    return () => {
      if (buyModalCloseTimerRef.current) {
        window.clearTimeout(buyModalCloseTimerRef.current);
      }
      if (sellModalCloseTimerRef.current) {
        window.clearTimeout(sellModalCloseTimerRef.current);
      }
      if (sellConfirmationCloseTimerRef.current) {
        window.clearTimeout(sellConfirmationCloseTimerRef.current);
      }
    };
  }, []);

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const mobileDetailItem = filteredItems.find((item) => item.id === mobileDetailItemId) ?? null;
  const isItemEquipped = (item: Item) => (
    player.equippedWeapon?.id === item.id
      || player.equippedArmor?.id === item.id
      || player.equippedHelmet?.id === item.id
      || player.equippedLegs?.id === item.id
      || player.equippedShield?.id === item.id
  );
  const mobileDetailIsEquipped = mobileDetailItem ? isItemEquipped(mobileDetailItem) : false;
  const mobileDetailHasLevel = mobileDetailItem ? player.level >= mobileDetailItem.minLevel : false;
  const mobileDetailCanAfford = mobileDetailItem ? player.gold >= mobileDetailItem.cost : false;
  const mobileDetailCanBuy = Boolean(mobileDetailItem && !mobileDetailIsEquipped && mobileDetailHasLevel && mobileDetailCanAfford);
  const mobileDetailEffectCards = mobileDetailItem ? getItemEffectCards(mobileDetailItem) : [];

  const openBuyModal = (item: Item) => {
    const isEquipped = player.equippedWeapon?.id === item.id || player.equippedArmor?.id === item.id || player.equippedHelmet?.id === item.id || player.equippedLegs?.id === item.id || player.equippedShield?.id === item.id;
    if (player.level < item.minLevel || isEquipped) {
      return;
    }

    const maxByGold = Math.floor(player.gold / item.cost);
    if (maxByGold <= 0) {
      return;
    }

    setBuyingItem(item);
    setBuyQuantity(1);
  };

  const closeBuyModal = () => {
    if (!buyingItem || buyModalClosing) {
      return;
    }
    setBuyModalClosing(true);
    if (buyModalCloseTimerRef.current) {
      window.clearTimeout(buyModalCloseTimerRef.current);
    }
    buyModalCloseTimerRef.current = window.setTimeout(() => {
      setBuyingItem(null);
      setBuyQuantity(1);
      setBuyModalClosing(false);
      buyModalCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const buyMaxQuantity = buyingItem ? Math.max(0, Math.floor(player.gold / buyingItem.cost)) : 0;
  const buyTotal = buyingItem ? buyQuantity * buyingItem.cost : 0;
  const buyGoldAfter = Math.max(0, player.gold - buyTotal);

  const confirmBuy = () => {
    if (!buyingItem || buyMaxQuantity <= 0) {
      return;
    }

    const finalQty = clampQuantity(buyQuantity, buyMaxQuantity);
    onBuy(buyingItem, finalQty);

    if (isEquipmentType(buyingItem.type)) {
      setPendingEquipItem(buyingItem);
    }

    setMobileDetailItemId(null);
    closeBuyModal();
  };

  const openSellModal = (item: Item) => {
    const qtyOwned = player.inventory[item.id] || 0;
    if (qtyOwned <= 0) {
      return;
    }

    setSellingItem(item);
    setSellQuantity(1);
  };

  const closeSellModal = () => {
    if (!sellingItem || sellModalClosing) {
      return;
    }
    setSellModalClosing(true);
    if (sellModalCloseTimerRef.current) {
      window.clearTimeout(sellModalCloseTimerRef.current);
    }
    sellModalCloseTimerRef.current = window.setTimeout(() => {
      setSellConfirmation(null);
      setSellingItem(null);
      setSellQuantity(1);
      setSellModalClosing(false);
      sellModalCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const sellMaxQuantity = sellingItem ? (player.inventory[sellingItem.id] || 0) : 0;
  const sellUnitPrice = sellingItem ? Math.floor(sellingItem.cost / 2) : 0;
  const sellTotal = sellQuantity * sellUnitPrice;
  const sellGoldAfter = player.gold + sellTotal;

  const confirmSell = () => {
    if (!sellingItem || sellMaxQuantity <= 0) {
      return;
    }

    const finalQty = clampQuantity(sellQuantity, sellMaxQuantity);
    setSellConfirmation({ item: sellingItem, quantity: finalQty });
  };

  const closeSellConfirmation = () => {
    if (!sellConfirmation || sellConfirmationClosing) {
      return;
    }

    setSellConfirmationClosing(true);
    if (sellConfirmationCloseTimerRef.current) {
      window.clearTimeout(sellConfirmationCloseTimerRef.current);
    }
    sellConfirmationCloseTimerRef.current = window.setTimeout(() => {
      setSellConfirmation(null);
      setSellConfirmationClosing(false);
      sellConfirmationCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const handleConfirmSellConfirmation = () => {
    if (!sellConfirmation) {
      return;
    }

    onSell(sellConfirmation.item, sellConfirmation.quantity);

    setSellConfirmationClosing(true);
    setSellModalClosing(true);
    if (sellModalCloseTimerRef.current) {
      window.clearTimeout(sellModalCloseTimerRef.current);
    }
    if (sellConfirmationCloseTimerRef.current) {
      window.clearTimeout(sellConfirmationCloseTimerRef.current);
    }

    sellModalCloseTimerRef.current = window.setTimeout(() => {
      setSellConfirmation(null);
      setSellConfirmationClosing(false);
      setSellingItem(null);
      setSellQuantity(1);
      setSellModalClosing(false);
      sellModalCloseTimerRef.current = null;
      if (sellConfirmationCloseTimerRef.current) {
        window.clearTimeout(sellConfirmationCloseTimerRef.current);
        sellConfirmationCloseTimerRef.current = null;
      }
    }, MODAL_CLOSE_MS);
  };

  return (
    <RpgMenuShell
      title="Loja"
      subtitle="Mercador do Vazio"
      onClose={onLeave}
      closeLabel="Voltar"
      accent="gold"
      valueBadge={<span className="inline-flex items-center gap-2.5 text-lg font-black"><GameAssetIcon name="coin" size={24} /> {player.gold}</span>}
    >
      <div className="flex h-full min-h-0 flex-col gap-4 pb-0">
        <div className="hidden items-center justify-between gap-3 xl:flex">
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {FILTERS.map((entry) => {
              const active = filter === entry.id;
              return (
                <RpgMenuTab
                  key={`desktop-top-${entry.id}`}
                  active={active}
                  onClick={() => setFilter(entry.id)}
                  className={`inline-flex shrink-0 items-center gap-2 ${active ? '!border-[#c8942f] !bg-[#e2b652] !text-white shadow-[0_12px_24px_rgba(142,102,35,0.34)]' : ''}`}
                >
                  <span className={`${active ? 'rounded-full bg-[#f0c86a] px-1.5 py-0.5' : ''}`}>
                    {renderFilterIcon(entry.iconName, active, 28)}
                  </span>
                  {entry.label}
                </RpgMenuTab>
              );
            })}
          </div>
          <button onClick={() => setMobileShowSell(true)} className="rpg-menu-tab inline-flex items-center gap-2.5"><GameAssetIcon name="coinCopper" size={20} /> Vender</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,21rem)]">
          <aside className="flex min-h-0 flex-col gap-4">
            <div className="xl:hidden">
              <div className="mt-1 flex items-center gap-2 overflow-x-auto pb-1">
                {FILTERS.map((entry) => {
                  const active = filter === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setFilter(entry.id)}
                      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-all ${active ? 'h-14 min-w-[4.75rem] border-[#c8942f] bg-[#e2b652] px-3.5 shadow-[0_10px_20px_rgba(142,102,35,0.3)]' : 'h-12 min-w-[3.1rem] border-[#d6b9a3] bg-[#f8eddf] px-2.5'}`}
                      aria-label={entry.label}
                      title={entry.label}
                    >
                      {renderFilterIcon(entry.iconName, active, active ? 30 : 26)}
                      {active && <span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-white">{entry.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <ScrollArea className="min-h-0 rounded-[24px] bg-[#f4e7d5] shadow-[0_8px_26px_rgba(107,49,65,0.08)]" viewportClassName="p-4">
              <div className="mb-3 flex">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141]">
                  Itens {filteredItems.length}
                </span>
              </div>
              <div className="grid auto-rows-max content-start grid-cols-[repeat(auto-fill,minmax(8.8rem,1fr))] gap-2.5">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">Nenhum item encontrado.</div>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    const canAfford = player.gold >= item.cost;
                    const hasLevel = player.level >= item.minLevel;
                    const equipped = isItemEquipped(item);
                    const canBuyQuick = canAfford && hasLevel && !equipped;
                    const equipmentTrend = getEquipmentComparisonTrend(player, item);
                    const attributeBadges = getItemAttributeBadges(item);

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setMobileDetailItemId(item.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedItemId(item.id);
                            setMobileDetailItemId(item.id);
                          }
                        }}
                        className={`relative w-full self-start cursor-pointer rounded-[20px] p-3 text-left transition-all ${getRarityBorderClass(item.rarity)} ${getRarityCardBackgroundClass(item.rarity)} ${isSelected ? 'shadow-[0_14px_30px_rgba(107,49,65,0.15)] ring-2 ring-[#7d3d4d]/40' : ''}`}
                      >
                        {equipmentTrend && (
                          <div className={`absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white shadow-sm ${equipmentTrend === 'up' ? 'bg-[#3ea86f] text-white' : equipmentTrend === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
                            {equipmentTrend === 'up' ? <ArrowUp size={12} /> : equipmentTrend === 'down' ? <ArrowDown size={12} /> : <span className="text-sm leading-none">-</span>}
                          </div>
                        )}

                        <div className="mx-auto mt-0.5 flex h-20 w-20 items-center justify-center">
                          <span className="text-[44px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">
                            {item.icon}
                          </span>
                        </div>

                        <div className="mt-1 text-center text-[15px] font-black leading-tight text-[#6b3141] whitespace-normal break-words sm:text-[13px] sm:truncate sm:whitespace-nowrap">{item.name}</div>

                        {attributeBadges.length > 0 && (
                          <div className="mt-2 flex min-w-0 flex-nowrap items-center justify-center gap-1">
                            {attributeBadges.map((badge) => (
                              <span
                                key={`${item.id}-attr-${badge.id}`}
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-black leading-none sm:px-2 sm:py-0.5 sm:text-[11px] ${badge.panel} ${badge.tone}`}
                              >
                                {React.isValidElement(badge.icon)
                                  ? React.cloneElement(badge.icon as React.ReactElement<{ size?: number }>, { size: 14 })
                                  : badge.icon}
                                {badge.value}
                              </span>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openBuyModal(item);
                          }}
                          disabled={!canBuyQuick}
                          className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all ${canBuyQuick ? 'border-[#8f6a24] bg-[#b8892f] text-white hover:-translate-y-0.5 hover:bg-[#c79636]' : 'border-[#d6b9a3] bg-[#ead8c4] text-[#a08475] cursor-not-allowed'}`}
                        >
                          <GameAssetIcon name="coin" size={16} className="[filter:drop-shadow(0_0_0_#fff)_drop-shadow(0_0_0_#fff)_drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)_drop-shadow(0_1px_0_#fff)_drop-shadow(0_-1px_0_#fff)_drop-shadow(1px_1px_0_#fff)_drop-shadow(-1px_1px_0_#fff)_drop-shadow(1px_-1px_0_#fff)_drop-shadow(-1px_-1px_0_#fff)]" />
                          {canBuyQuick ? item.cost : equipped ? 'Equipado' : !hasLevel ? `Nivel ${item.minLevel}` : 'Sem ouro'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="hidden min-h-0 xl:block">
            <div className="h-full max-h-full">
              <ShopItemDetail item={selectedItem} player={player} onBuy={openBuyModal} />
            </div>
          </section>
        </div>
      </div>

      {mobileDetailItem && (
        <div className="xl:hidden absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-2 sm:p-4" onClick={() => setMobileDetailItemId(null)}>
          <div className="w-full max-w-lg max-h-[92vh] rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.18)] overflow-hidden animate-fade-in-down flex flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="relative shrink-0 p-2">
              <button onClick={() => setMobileDetailItemId(null)} className="absolute right-2 top-2 z-10 rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-2 text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="relative mx-auto w-full max-w-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                    <span className="text-[40px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">
                      {mobileDetailItem.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-[#6b3141]">{mobileDetailItem.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#fff5e6] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7f5b56]">
                        <ItemTypeIcon type={mobileDetailItem.type} size={12} />
                        <ItemTypeLabel type={mobileDetailItem.type} />
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#fff8ef] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7f5b56]">
                        Nivel {mobileDetailItem.minLevel}
                      </span>
                      {getEquipmentComparisonTrend(player, mobileDetailItem) && (
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm ${getEquipmentComparisonTrend(player, mobileDetailItem) === 'up' ? 'bg-[#3ea86f] text-white' : getEquipmentComparisonTrend(player, mobileDetailItem) === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
                          {getEquipmentComparisonTrend(player, mobileDetailItem) === 'up' ? <ArrowUp size={10} /> : getEquipmentComparisonTrend(player, mobileDetailItem) === 'down' ? <ArrowDown size={10} /> : <span className="text-xs leading-none">-</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{mobileDetailItem.description}</p>

                <div className="mt-3 rpg-3d-showcase relative overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
                  <div className="h-[12rem]"><ItemPreviewThree item={mobileDetailItem} variant="menu" /></div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {mobileDetailEffectCards.map((entry) => (
                    <div key={`${mobileDetailItem.id}-${entry.id}`} className={`rounded-[14px] border px-2.5 py-2 ${entry.panel}`}>
                      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a7068]">{entry.label}</div>
                      <div className={`mt-1 inline-flex items-center gap-1 text-lg font-black ${entry.tone}`}>
                        {entry.icon}
                        {entry.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#c59d82] bg-[#f8eddf] p-4">
              <button
                onClick={() => {
                  if (!mobileDetailCanBuy) {
                    return;
                  }
                  openBuyModal(mobileDetailItem);
                  setMobileDetailItemId(null);
                }}
                disabled={!mobileDetailCanBuy}
                className={`inline-flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-black uppercase tracking-[0.14em] transition-all ${mobileDetailCanBuy ? 'border-[#8f6a24] bg-[#b8892f] text-white hover:-translate-y-0.5 hover:bg-[#c79636]' : 'border-[#d6b9a3] bg-[#ead8c4] text-[#a08475] cursor-not-allowed'}`}
              >
                <GameAssetIcon name="coin" size={30} className="[filter:drop-shadow(0_0_0_#fff)_drop-shadow(0_0_0_#fff)_drop-shadow(1.5px_0_0_#fff)_drop-shadow(-1.5px_0_0_#fff)_drop-shadow(0_1.5px_0_#fff)_drop-shadow(0_-1.5px_0_#fff)_drop-shadow(1.5px_1.5px_0_#fff)_drop-shadow(-1.5px_1.5px_0_#fff)_drop-shadow(1.5px_-1.5px_0_#fff)_drop-shadow(-1.5px_-1.5px_0_#fff)]" />
                {mobileDetailCanBuy ? `Comprar ${mobileDetailItem.cost}` : mobileDetailIsEquipped ? 'Equipado' : !mobileDetailHasLevel ? `Nivel ${mobileDetailItem.minLevel}` : 'Sem ouro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile now uses only the top icon filters; bottom floating menu removed. */}

      {buyingItem && (
        <div className={`absolute inset-0 z-30 flex items-center justify-center bg-[rgba(40,20,25,0.46)] p-4 backdrop-blur-sm ${buyModalClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeBuyModal}>
          <div className={`w-full max-w-md rounded-[24px] border border-[#c59d82] bg-[#f8eddf] p-5 shadow-[0_20px_48px_rgba(54,26,33,0.28)] ${buyModalClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Compra</div>
            <h3 className="mt-1 inline-flex items-center gap-2 text-xl font-black text-[#6b3141]">
              <span className="text-[36px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">{buyingItem.icon}</span>
              {buyingItem.name}
            </h3>
            <p className="mt-2 text-sm text-[#7f5b56]">Defina a quantidade e confirme a compra.</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <RpgMenuStat label="Voce gasta" value={<span className="inline-flex items-center gap-1.5 text-lg font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {buyTotal}</span>} />
              <RpgMenuStat label="Voce fica" value={<span className="inline-flex items-center gap-1.5 text-lg font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {buyGoldAfter}</span>} />
            </div>

            <div className="mt-4 rounded-2xl border border-[#d6b9a3] bg-[#f3e5d5] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8a5a57]">Quantidade</span>
                <button onClick={() => setBuyQuantity(buyMaxQuantity || 1)} className="rounded-lg border border-[#cfab91] bg-[#f9f0e6] px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#6b3141]" disabled={buyMaxQuantity <= 0}>Max</button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setBuyQuantity((current) => clampQuantity(current - 1, buyMaxQuantity))} className="rounded-xl border border-[#cfab91] bg-[#f9f0e6] px-3 py-2 text-lg font-black text-[#6b3141]">-</button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, buyMaxQuantity)}
                  value={buyQuantity}
                  onChange={(event) => setBuyQuantity(clampQuantity(Number(event.target.value), buyMaxQuantity))}
                  className="h-11 w-full rounded-xl border border-[#cfab91] bg-[#fff8ef] px-3 text-center text-lg font-black text-[#6b3141] outline-none focus:border-[#7d3d4d]"
                />
                <button onClick={() => setBuyQuantity((current) => clampQuantity(current + 1, buyMaxQuantity))} className="rounded-xl border border-[#cfab91] bg-[#f9f0e6] px-3 py-2 text-lg font-black text-[#6b3141]">+</button>
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a5a57]">Maximo permitido: {buyMaxQuantity}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={closeBuyModal} className="flex-1 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">Cancelar</button>
              <button onClick={confirmBuy} className="flex-1 rounded-xl border border-[#c59a3f] bg-[#e2b652] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#5c3f0d] transition-colors hover:bg-[#edc266] disabled:cursor-not-allowed disabled:opacity-60" disabled={buyMaxQuantity <= 0}>Comprar</button>
            </div>
          </div>
        </div>
      )}

      {sellingItem && (
        <div className={`absolute inset-0 z-30 flex items-center justify-center bg-[rgba(40,20,25,0.46)] p-4 backdrop-blur-sm ${sellModalClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeSellModal}>
          <div className={`w-full max-w-md rounded-[24px] border border-[#c59d82] bg-[#f8eddf] p-5 shadow-[0_20px_48px_rgba(54,26,33,0.28)] ${sellModalClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Venda</div>
            <h3 className="mt-1 inline-flex items-center gap-2 text-xl font-black text-[#6b3141]">
              <span className="text-[36px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">{sellingItem.icon}</span>
              {sellingItem.name}
            </h3>
            <p className="mt-2 text-sm text-[#7f5b56]">Escolha quantos itens vender e veja o valor total de retorno.</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <RpgMenuStat label="Voce ganha" value={<span className="inline-flex items-center gap-1.5 text-lg font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {sellTotal}</span>} />
              <RpgMenuStat label="Voce fica" value={<span className="inline-flex items-center gap-1.5 text-lg font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {sellGoldAfter}</span>} />
            </div>

            <div className="mt-4 rounded-2xl border border-[#d6b9a3] bg-[#f3e5d5] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8a5a57]">Quantidade</span>
                <button onClick={() => setSellQuantity(sellMaxQuantity || 1)} className="rounded-lg border border-[#cfab91] bg-[#f9f0e6] px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#6b3141]" disabled={sellMaxQuantity <= 0}>Tudo</button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setSellQuantity((current) => clampQuantity(current - 1, sellMaxQuantity))} className="rounded-xl border border-[#cfab91] bg-[#f9f0e6] px-3 py-2 text-lg font-black text-[#6b3141]">-</button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, sellMaxQuantity)}
                  value={sellQuantity}
                  onChange={(event) => setSellQuantity(clampQuantity(Number(event.target.value), sellMaxQuantity))}
                  className="h-11 w-full rounded-xl border border-[#cfab91] bg-[#fff8ef] px-3 text-center text-lg font-black text-[#6b3141] outline-none focus:border-[#7d3d4d]"
                />
                <button onClick={() => setSellQuantity((current) => clampQuantity(current + 1, sellMaxQuantity))} className="rounded-xl border border-[#cfab91] bg-[#f9f0e6] px-3 py-2 text-lg font-black text-[#6b3141]">+</button>
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a5a57]">Quantidade disponivel: {sellMaxQuantity}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={closeSellModal} className="flex-1 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]">Cancelar</button>
              <button onClick={confirmSell} className="flex-1 rounded-xl border border-[#3f7344] bg-[#4f8a55] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#ecffef] transition-colors hover:bg-[#5a9b62] disabled:cursor-not-allowed disabled:opacity-60" disabled={sellMaxQuantity <= 0}>Vender</button>
            </div>
          </div>
        </div>
      )}

      {sellConfirmation && (
        <div className={`absolute inset-0 z-40 flex items-center justify-center bg-[rgba(32,16,20,0.55)] p-4 backdrop-blur-sm ${sellConfirmationClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeSellConfirmation}>
          <div className={`w-full max-w-md rounded-[22px] border border-[#c59d82] bg-[#f7eddc] p-5 shadow-[0_22px_55px_rgba(40,20,25,0.32)] ${sellConfirmationClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Confirmacao</div>
            <h3 className="mt-1 text-xl font-black text-[#6b3141]">Confirmar venda?</h3>
            <p className="mt-2 text-sm text-[#7f5b56]">
              Deseja vender {sellConfirmation.quantity}x {sellConfirmation.item.name} por {Math.floor(sellConfirmation.item.cost / 2) * sellConfirmation.quantity} moedas?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={closeSellConfirmation}
                className="rounded-xl border border-[#d6b9a3] bg-[#f3e5d5] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#7f5b56] transition-colors hover:bg-[#efdfcd]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSellConfirmation}
                className="rounded-xl border border-[#3f7344] bg-[#4f8a55] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#ecffef] transition-colors hover:bg-[#5a9b62]"
              >
                Confirmar venda
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingEquipItem && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(40,20,25,0.46)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-[#c59d82] bg-[#f8eddf] p-5 shadow-[0_20px_48px_rgba(54,26,33,0.28)]">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Compra concluida</div>
            <h3 className="mt-1 text-xl font-black text-[#6b3141]">Equipar agora?</h3>
            <p className="mt-2 text-sm text-[#7f5b56]">
              O item {pendingEquipItem.name} foi comprado. Deseja equipar no heroi agora?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPendingEquipItem(null)}
                className="flex-1 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
              >
                Depois
              </button>
              <button
                onClick={() => {
                  onEquip(pendingEquipItem);
                  setPendingEquipItem(null);
                }}
                className="flex-1 rounded-xl border border-[#7d3d4d] bg-[#6b3141] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#f7eadf] transition-colors hover:bg-[#7a3d4d]"
              >
                Equipar
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileShowSell && (
        <div className="absolute inset-0 z-20 bg-[rgba(40,20,25,0.36)] backdrop-blur xl:hidden" onClick={() => setMobileShowSell(false)}>
          <div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#c59d82] bg-[#7a5733] px-4 py-3 text-[#fff5e7]">
              <h3 className="flex items-center gap-2.5 text-sm font-black uppercase tracking-[0.2em]"><GameAssetIcon name="coinCopper" size={22} /> Vender itens</h3>
              <button onClick={() => setMobileShowSell(false)} className="rounded-xl border border-white/15 bg-white/10 p-2 transition-opacity hover:opacity-80"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <RpgMenuPanel className="rounded-[24px] p-4">
                <div className="grid gap-3">
                  {sellableEntries.map((entry) => {
                    const equipped = isItemEquipped(entry.item);
                    return (
                    <button key={entry.item.id} onClick={() => openSellModal(entry.item)} className={`flex items-center gap-3 rounded-[20px] border bg-[#f3e3d2] p-3 text-left transition-all hover:bg-[#efdac6] ${getRarityColor(entry.item.rarity)}`}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f6eadb] text-2xl">{entry.item.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#6b3141]">{entry.item.name}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded-full border border-[#d6b9a3] bg-[#fff5e8] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
                            x{entry.qty}
                          </span>
                          {equipped && (
                            <span className="inline-flex rounded-full border border-[#7d3d4d] bg-[#fff3e7] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b3141]">
                              Equipado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-right text-base font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {entry.unitSellPrice}</div>
                    </button>
                  );})}
                  {sellableEntries.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">Nenhum item para vender.</div>
                  )}
                </div>
              </RpgMenuPanel>
            </div>
          </div>
        </div>
      )}
    </RpgMenuShell>
  );
};
