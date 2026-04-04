import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, FlaskConical, Heart, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { RpgMenuPanel, RpgMenuShell, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';

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

type InventoryFilter = 'equipment' | 'potion' | 'material';

type EffectCard = {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  panel: string;
};

const FILTERS: Array<{ id: InventoryFilter; label: string; icon: React.ReactNode }> = [
  { id: 'potion', label: 'Consum.', icon: <GameAssetIcon name="potionBlue" size={22} /> },
  { id: 'equipment', label: 'Equip.', icon: <GameAssetIcon name="helm" size={22} /> },
  { id: 'material', label: 'Materiais', icon: <GameAssetIcon name="gear" size={22} /> },
];

const getFilterIconClass = (active: boolean) => {
  if (!active) return 'opacity-80';
  return 'rounded-full border-2 border-white bg-[#f7e4e8] p-0.5 shadow-[0_4px_10px_rgba(86,37,50,0.2)]';
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

const EQUIPMENT_GROUP_ORDER: Item['type'][] = ['weapon', 'shield', 'helmet', 'armor', 'legs'];

const getEquipmentGroupMeta = (type: Item['type']) => {
  if (type === 'weapon') return { label: 'Armas', icon: <GameAssetIcon name="sword" size={26} /> };
  if (type === 'shield') return { label: 'Escudos', icon: <GameAssetIcon name="shield" size={26} /> };
  if (type === 'helmet') return { label: 'Capacetes', icon: <GameAssetIcon name="helm" size={26} /> };
  if (type === 'armor') return { label: 'Armaduras', icon: <GameAssetIcon name="armor" size={26} /> };
  if (type === 'legs') return { label: 'Pernas', icon: <GameAssetIcon name="boots" size={26} /> };
  return { label: 'Equipamentos', icon: <GameAssetIcon name="gear" size={26} /> };
};

const createEffectCard = (id: string, label: string, value: string, icon: React.ReactNode, tone: string, panel: string): EffectCard => {
  return { id, label, value, icon, tone, panel };
};

const clampQuantity = (value: number, max: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.floor(value)));
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
  const defenseScore = bonuses.def;
  const hpScore = bonuses.maxHp;
  const mpScore = bonuses.maxMp;
  const speedScore = bonuses.speed;
  const attackScore = item.type === 'weapon' ? item.value : 0;

  return attackScore + defenseScore + hpScore + mpScore + speedScore;
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

const formatPercent = (value: number) => {
  if (Math.abs(value) <= 1) {
    return `${Math.round(value * 100)}%`;
  }
  return `${Math.round(value)}%`;
};

const getItemEffectCards = (item: Item): EffectCard[] => {
  if (item.type === 'weapon') {
    return [createEffectCard('atk', 'ATK', `+${item.value}`, <Sword size={15} />, 'text-[#b83a4b]', 'border-[#e6b1b9] bg-[linear-gradient(180deg,#fff8f8,#fbe9eb)]')];
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

  return [createEffectCard('special', 'ESPECIAL', 'Craft', <Sparkles size={15} />, 'text-[#8a5a57]', 'border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)]')];
};

const ItemDetailCard = ({
  item,
  player,
  quantity,
  onAction,
  onSell,
  isBattleContext,
  isEquipped,
  disableActions = false,
}: {
  item: Item | null;
  player: Player;
  quantity: number;
  onAction: (item: Item, isEquipped: boolean) => void;
  onSell?: (item: Item) => void;
  isBattleContext: boolean;
  isEquipped: boolean;
  disableActions?: boolean;
}) => {
  if (!item) {
    return (
      <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[26px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-5 text-center text-[#8f6c67]">
        <GameAssetIcon name="bag" size={56} className="opacity-50" />
        <h3 className="mt-4 text-lg font-black text-[#6b3141]">Selecione um item</h3>
        <p className="mt-2 max-w-sm text-sm">Escolha um item para ver preview 3D e detalhes.</p>
      </div>
    );
  }

  const effectCards = getItemEffectCards(item);
  const equipmentTrend = getEquipmentComparisonTrend(player, item);
  const ownedQuantity = player.inventory[item.id] || 0;
  const canSellInCamp = !disableActions && !isBattleContext && Boolean(onSell) && ownedQuantity > 0;
  const sellValue = Math.floor(item.cost / 2);
  const canUsePotion = !disableActions && isBattleContext && item.type === 'potion';
  const canEquipItem = !disableActions && !isBattleContext && isEquipmentType(item.type);
  const canAct = !canSellInCamp && (canUsePotion || canEquipItem);
  const actionButtonClass = canUsePotion
    ? 'border-[#365f82] bg-[#4173a0] text-[#edf6ff] hover:bg-[#4b81b2]'
    : isEquipped
      ? 'border-[#8a5a35] bg-[#9a6a3f] text-[#fff4e8] hover:bg-[#ab7b4f]'
      : 'border-[#3f7344] bg-[#4f8a55] text-[#ecffef] hover:bg-[#5a9b62]';
  const actionLabel = canUsePotion ? 'Usar Item' : isEquipped ? 'Desequipar' : 'Equipar';

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
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
              Quantidade x{quantity}
            </span>
            {equipmentTrend && (
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm ${equipmentTrend === 'up' ? 'bg-[#3ea86f] text-white' : equipmentTrend === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
                {equipmentTrend === 'up' ? <ArrowUp size={10} /> : equipmentTrend === 'down' ? <ArrowDown size={10} /> : <span className="text-xs leading-none">-</span>}
              </span>
            )}
            {isEquipped && (
              <span className="inline-flex rounded-full border border-[#7d3d4d] bg-[#fff3e7] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b3141]">
                Equipado
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{item.description}</p>

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
        {canSellInCamp
          ? 'Venda direta na mochila disponivel no acampamento.'
          : item.type === 'material'
          ? 'Material de crafting, sem acao direta na mochila.'
          : canUsePotion
            ? 'Consumivel pronto para uso na batalha.'
            : canEquipItem
              ? isEquipped
                ? 'Esse item ja esta equipado pelo heroi.'
                : 'Equipe este item para aplicar os bonus.'
              : 'Item sem acao disponivel no contexto atual.'}
      </div>

      {canSellInCamp && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onSell?.(item);
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#8f6a24] bg-[#b8892f] px-4 py-3 text-base font-black uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#c79636]"
        >
          <GameAssetIcon name="coin" size={20} className="[filter:drop-shadow(0_0_0_#fff)_drop-shadow(0_0_0_#fff)_drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)_drop-shadow(0_1px_0_#fff)_drop-shadow(0_-1px_0_#fff)_drop-shadow(1px_1px_0_#fff)_drop-shadow(-1px_1px_0_#fff)_drop-shadow(1px_-1px_0_#fff)_drop-shadow(-1px_-1px_0_#fff)]" />
          Vender {sellValue}
        </button>
      )}

      {canAct && (
        <button
          onClick={() => onAction(item, isEquipped)}
          className={`mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-black uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5 ${actionButtonClass}`}
        >
          {canUsePotion ? <FlaskConical size={18} /> : <Shield size={18} />}
          {actionLabel}
        </button>
      )}
    </RpgMenuPanel>
  );
};

export const InventoryScreen = ({ player, shopItems, onClose, onEquip, onUnequip, onUse, onSell, isBattleContext = false, initialFilter = 'all', isClosing = false }: InventoryScreenProps) => {
  const MODAL_CLOSE_MS = 180;
  const [filter, setFilter] = useState<InventoryFilter>(initialFilter === 'all' ? 'potion' : initialFilter);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ item: Item; mode: 'equip' | 'unequip' | 'use' } | null>(null);
  const [sellingItem, setSellingItem] = useState<Item | null>(null);
  const [sellConfirmation, setSellConfirmation] = useState<{ item: Item; quantity: number } | null>(null);
  const [sellConfirmationClosing, setSellConfirmationClosing] = useState(false);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellModalClosing, setSellModalClosing] = useState(false);
  const [bulkSellMode, setBulkSellMode] = useState(false);
  const [bulkSellSelections, setBulkSellSelections] = useState<Record<string, number>>({});
  const [bulkSellReviewOpen, setBulkSellReviewOpen] = useState(false);
  const [bulkSellReviewClosing, setBulkSellReviewClosing] = useState(false);
  const [bulkSellConfirmOpen, setBulkSellConfirmOpen] = useState(false);
  const [bulkSellConfirmClosing, setBulkSellConfirmClosing] = useState(false);
  const [mobileDetailClosing, setMobileDetailClosing] = useState(false);
  const [pendingActionClosing, setPendingActionClosing] = useState(false);
  const sellModalCloseTimerRef = useRef<number | null>(null);
  const sellConfirmationCloseTimerRef = useRef<number | null>(null);
  const bulkSellReviewCloseTimerRef = useRef<number | null>(null);
  const bulkSellConfirmCloseTimerRef = useRef<number | null>(null);
  const mobileDetailCloseTimerRef = useRef<number | null>(null);
  const pendingActionCloseTimerRef = useRef<number | null>(null);

  const inventoryItems = useMemo(() => {
    const entryMap = new Map<string, { item: Item; quantity: number }>();

    Object.entries(player.inventory)
      .filter(([, quantity]) => quantity > 0)
      .forEach(([id, quantity]) => {
        const item = shopItems.find((entry) => entry.id === id);
        if (!item) return;
        entryMap.set(item.id, { item, quantity });
      });

    const ensureEquippedVisible = (equipped: Item | null) => {
      if (!equipped) return;
      const current = entryMap.get(equipped.id);
      if (current) {
        entryMap.set(equipped.id, { ...current, quantity: Math.max(1, current.quantity) });
        return;
      }
      entryMap.set(equipped.id, { item: equipped, quantity: 1 });
    };

    ensureEquippedVisible(player.equippedWeapon);
    ensureEquippedVisible(player.equippedArmor);
    ensureEquippedVisible(player.equippedHelmet);
    ensureEquippedVisible(player.equippedLegs);
    ensureEquippedVisible(player.equippedShield);

    return Array.from(entryMap.values());
  }, [player.inventory, player.equippedWeapon, player.equippedArmor, player.equippedHelmet, player.equippedLegs, player.equippedShield, shopItems]);

  const filteredItems = useMemo(() => {
    const equippedIds = new Set<string>([
      player.equippedWeapon?.id,
      player.equippedArmor?.id,
      player.equippedHelmet?.id,
      player.equippedLegs?.id,
      player.equippedShield?.id,
    ].filter((value): value is string => Boolean(value)));

    return inventoryItems.filter(({ item }) => {
      if (bulkSellMode && isEquipmentType(item.type) && equippedIds.has(item.id)) {
        return false;
      }

      if (filter === 'equipment') {
        return isEquipmentType(item.type);
      }
      return item.type === filter;
    });
  }, [bulkSellMode, filter, inventoryItems, player.equippedArmor, player.equippedHelmet, player.equippedLegs, player.equippedShield, player.equippedWeapon]);

  const groupedEquipmentItems = useMemo(() => {
    if (filter !== 'equipment') {
      return [] as Array<{ type: Item['type']; entries: Array<{ item: Item; quantity: number }> }>;
    }

    return EQUIPMENT_GROUP_ORDER
      .map((type) => ({
        type,
        entries: filteredItems.filter(({ item }) => item.type === type),
      }))
      .filter((group) => group.entries.length > 0);
  }, [filter, filteredItems]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedItemId(null);
      setMobileDetailItemId(null);
      return;
    }

    const exists = filteredItems.some(({ item }) => item.id === selectedItemId);
    if (!exists) {
      setSelectedItemId(filteredItems[0].item.id);
    }

    const mobileExists = filteredItems.some(({ item }) => item.id === mobileDetailItemId);
    if (mobileDetailItemId && !mobileExists) {
      setMobileDetailItemId(null);
    }
  }, [filteredItems, mobileDetailItemId, selectedItemId]);

  useEffect(() => {
    if (mobileDetailItemId) {
      setMobileDetailClosing(false);
    }
  }, [mobileDetailItemId]);

  useEffect(() => {
    if (pendingAction) {
      setPendingActionClosing(false);
    }
  }, [pendingAction]);

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
    if (bulkSellReviewOpen) {
      setBulkSellReviewClosing(false);
    }
  }, [bulkSellReviewOpen]);

  useEffect(() => {
    if (bulkSellConfirmOpen) {
      setBulkSellConfirmClosing(false);
    }
  }, [bulkSellConfirmOpen]);

  useEffect(() => {
    setBulkSellSelections((current) => {
      const next: Record<string, number> = {};
      for (const [itemId, quantity] of Object.entries(current)) {
        const ownedQuantity = player.inventory[itemId] || 0;
        if (ownedQuantity <= 0) {
          continue;
        }
        next[itemId] = clampQuantity(quantity, ownedQuantity);
      }

      const sameKeys = Object.keys(current).length === Object.keys(next).length
        && Object.keys(current).every((key) => current[key] === next[key]);
      return sameKeys ? current : next;
    });
  }, [player.inventory]);

  useEffect(() => {
    return () => {
      if (sellModalCloseTimerRef.current) {
        window.clearTimeout(sellModalCloseTimerRef.current);
      }
      if (sellConfirmationCloseTimerRef.current) {
        window.clearTimeout(sellConfirmationCloseTimerRef.current);
      }
      if (bulkSellReviewCloseTimerRef.current) {
        window.clearTimeout(bulkSellReviewCloseTimerRef.current);
      }
      if (bulkSellConfirmCloseTimerRef.current) {
        window.clearTimeout(bulkSellConfirmCloseTimerRef.current);
      }
      if (mobileDetailCloseTimerRef.current) {
        window.clearTimeout(mobileDetailCloseTimerRef.current);
      }
      if (pendingActionCloseTimerRef.current) {
        window.clearTimeout(pendingActionCloseTimerRef.current);
      }
    };
  }, []);

  const selectedEntry = filteredItems.find(({ item }) => item.id === selectedItemId) ?? null;
  const mobileEntry = filteredItems.find(({ item }) => item.id === mobileDetailItemId) ?? null;
  const inventoryById = useMemo(() => {
    return inventoryItems.reduce<Record<string, { item: Item; quantity: number }>>((accumulator, entry) => {
      accumulator[entry.item.id] = entry;
      return accumulator;
    }, {});
  }, [inventoryItems]);
  const bulkSellSelectedEntries = useMemo(() => {
    return Object.entries(bulkSellSelections)
      .map(([itemId, quantity]) => {
        const inventoryEntry = inventoryById[itemId];
        if (!inventoryEntry) {
          return null;
        }
        const ownedQuantity = player.inventory[itemId] || 0;
        if (ownedQuantity <= 0) {
          return null;
        }
        const safeQuantity = clampQuantity(quantity, ownedQuantity);
        const unitSellPrice = Math.floor(inventoryEntry.item.cost / 2);

        return {
          item: inventoryEntry.item,
          quantity: safeQuantity,
          unitSellPrice,
          totalSellPrice: unitSellPrice * safeQuantity,
        };
      })
      .filter((entry): entry is { item: Item; quantity: number; unitSellPrice: number; totalSellPrice: number } => Boolean(entry));
  }, [bulkSellSelections, inventoryById, player.inventory]);
  const bulkSellGroupedEntries = useMemo(() => {
    const groups = {
      consumables: [] as typeof bulkSellSelectedEntries,
      equipment: [] as typeof bulkSellSelectedEntries,
      materials: [] as typeof bulkSellSelectedEntries,
    };

    for (const entry of bulkSellSelectedEntries) {
      if (entry.item.type === 'potion') {
        groups.consumables.push(entry);
        continue;
      }
      if (isEquipmentType(entry.item.type)) {
        groups.equipment.push(entry);
        continue;
      }
      groups.materials.push(entry);
    }

    return groups;
  }, [bulkSellSelectedEntries]);
  const bulkSellSelectedTypes = bulkSellSelectedEntries.length;
  const bulkSellSelectedUnits = bulkSellSelectedEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const bulkSellTotalValue = bulkSellSelectedEntries.reduce((sum, entry) => sum + entry.totalSellPrice, 0);
  const canBulkSell = !isBattleContext && Boolean(onSell);
  const isItemEquipped = (item: Item) => (
    player.equippedWeapon?.id === item.id
      || player.equippedArmor?.id === item.id
      || player.equippedHelmet?.id === item.id
      || player.equippedLegs?.id === item.id
      || player.equippedShield?.id === item.id
  );

  const handleAction = (item: Item, isEquipped: boolean) => {
    if (item.type === 'potion') {
      if (!isBattleContext) {
        return;
      }
      setPendingAction({ item, mode: 'use' });
      return;
    }

    if (item.type !== 'material' && !isBattleContext) {
      setPendingAction({ item, mode: isEquipped ? 'unequip' : 'equip' });
    }
  };

  const handleSell = (item: Item) => {
    if (isBattleContext || bulkSellMode) {
      return;
    }
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
    if (!sellConfirmation || !onSell) {
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

  const closeMobileDetail = () => {
    if (!mobileDetailItemId || mobileDetailClosing) {
      return;
    }
    setMobileDetailClosing(true);
    if (mobileDetailCloseTimerRef.current) {
      window.clearTimeout(mobileDetailCloseTimerRef.current);
    }
    mobileDetailCloseTimerRef.current = window.setTimeout(() => {
      setMobileDetailItemId(null);
      setMobileDetailClosing(false);
      mobileDetailCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const closePendingAction = () => {
    if (!pendingAction || pendingActionClosing) {
      return;
    }
    setPendingActionClosing(true);
    if (pendingActionCloseTimerRef.current) {
      window.clearTimeout(pendingActionCloseTimerRef.current);
    }
    pendingActionCloseTimerRef.current = window.setTimeout(() => {
      setPendingAction(null);
      setPendingActionClosing(false);
      pendingActionCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const handleConfirmPendingAction = () => {
    if (!pendingAction) {
      return;
    }

    if (pendingAction.mode === 'use') {
      onUse(pendingAction.item.id);
    } else if (pendingAction.mode === 'unequip') {
      onUnequip(pendingAction.item);
    } else {
      onEquip(pendingAction.item);
    }

    closePendingAction();
  };

  const toggleBulkSellSelection = (item: Item, quantity: number) => {
    if (!canBulkSell) {
      return;
    }

    const ownedQuantity = player.inventory[item.id] || 0;
    if (ownedQuantity <= 0) {
      return;
    }

    setBulkSellSelections((current) => {
      if (current[item.id]) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }

      return {
        ...current,
        [item.id]: clampQuantity(Math.max(quantity, 1), ownedQuantity),
      };
    });
  };

  const startBulkSellMode = () => {
    if (!canBulkSell) {
      return;
    }

    setBulkSellMode(true);
    setBulkSellSelections({});
    setBulkSellReviewOpen(false);
    setBulkSellConfirmOpen(false);
  };

  const cancelBulkSellMode = () => {
    setBulkSellMode(false);
    setBulkSellSelections({});
    setBulkSellReviewOpen(false);
    setBulkSellReviewClosing(false);
    setBulkSellConfirmOpen(false);
    setBulkSellConfirmClosing(false);
  };

  const openBulkSellReview = () => {
    if (!bulkSellMode || bulkSellSelectedEntries.length <= 0) {
      return;
    }
    setBulkSellReviewOpen(true);
  };

  const closeBulkSellReview = () => {
    if (!bulkSellReviewOpen || bulkSellReviewClosing || bulkSellConfirmOpen) {
      return;
    }

    setBulkSellReviewClosing(true);
    if (bulkSellReviewCloseTimerRef.current) {
      window.clearTimeout(bulkSellReviewCloseTimerRef.current);
    }
    bulkSellReviewCloseTimerRef.current = window.setTimeout(() => {
      setBulkSellReviewOpen(false);
      setBulkSellReviewClosing(false);
      bulkSellReviewCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const closeBulkSellConfirm = () => {
    if (!bulkSellConfirmOpen || bulkSellConfirmClosing) {
      return;
    }

    setBulkSellConfirmClosing(true);
    if (bulkSellConfirmCloseTimerRef.current) {
      window.clearTimeout(bulkSellConfirmCloseTimerRef.current);
    }
    bulkSellConfirmCloseTimerRef.current = window.setTimeout(() => {
      setBulkSellConfirmOpen(false);
      setBulkSellConfirmClosing(false);
      bulkSellConfirmCloseTimerRef.current = null;
    }, MODAL_CLOSE_MS);
  };

  const handleConfirmBulkSell = () => {
    if (!onSell || bulkSellSelectedEntries.length <= 0) {
      return;
    }

    bulkSellSelectedEntries.forEach((entry) => {
      onSell(entry.item, entry.quantity);
    });

    setBulkSellConfirmClosing(true);
    setBulkSellReviewClosing(true);
    if (bulkSellReviewCloseTimerRef.current) {
      window.clearTimeout(bulkSellReviewCloseTimerRef.current);
    }
    if (bulkSellConfirmCloseTimerRef.current) {
      window.clearTimeout(bulkSellConfirmCloseTimerRef.current);
    }

    bulkSellReviewCloseTimerRef.current = window.setTimeout(() => {
      setBulkSellConfirmOpen(false);
      setBulkSellConfirmClosing(false);
      setBulkSellReviewOpen(false);
      setBulkSellReviewClosing(false);
      setBulkSellMode(false);
      setBulkSellSelections({});
      bulkSellReviewCloseTimerRef.current = null;
      if (bulkSellConfirmCloseTimerRef.current) {
        window.clearTimeout(bulkSellConfirmCloseTimerRef.current);
        bulkSellConfirmCloseTimerRef.current = null;
      }
    }, MODAL_CLOSE_MS);
  };

  const renderInventoryCard = ({ item, quantity }: { item: Item; quantity: number }) => {
    const isSelected = selectedItemId === item.id;
    const isEquipped = isItemEquipped(item);
    const trend = getEquipmentComparisonTrend(player, item);
    const isEquipCard = isEquipmentType(item.type);
    const canEquipFromCard = isEquipCard && !isBattleContext && !bulkSellMode;
    const ownedQuantity = player.inventory[item.id] || 0;
    const canBulkSelectEntry = canBulkSell && ownedQuantity > 0;
    const isCheckedForBulkSell = Boolean(bulkSellSelections[item.id]);

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (bulkSellMode) {
            toggleBulkSellSelection(item, quantity);
            return;
          }
          setSelectedItemId(item.id);
          setMobileDetailItemId(item.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (bulkSellMode) {
              toggleBulkSellSelection(item, quantity);
              return;
            }
            setSelectedItemId(item.id);
            setMobileDetailItemId(item.id);
          }
        }}
        className={`relative w-full cursor-pointer rounded-[20px] p-3 text-left transition-all ${getRarityBorderClass(item.rarity)} ${getRarityCardBackgroundClass(item.rarity)} ${bulkSellMode ? (isCheckedForBulkSell ? 'shadow-[0_14px_30px_rgba(62,168,111,0.2)] ring-2 ring-[#3ea86f]/60' : 'ring-1 ring-[#9a7068]/30') : (isSelected ? 'shadow-[0_14px_30px_rgba(107,49,65,0.15)] ring-2 ring-[#7d3d4d]/40' : '')}`}
      >
        {bulkSellMode ? (
          <div className={`absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white shadow-sm ${isCheckedForBulkSell ? 'bg-[#3ea86f] text-white' : canBulkSelectEntry ? 'bg-white text-[#8a5a57]' : 'bg-[#e8d7c5] text-[#b59683]'}`}>
            {isCheckedForBulkSell ? <Check size={12} /> : <span className="text-[10px] font-black">{canBulkSelectEntry ? '' : 'x'}</span>}
          </div>
        ) : trend && (
          <div className={`absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white shadow-sm ${trend === 'up' ? 'bg-[#3ea86f] text-white' : trend === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
            {trend === 'up' ? <ArrowUp size={12} /> : trend === 'down' ? <ArrowDown size={12} /> : <span className="text-sm leading-none">-</span>}
          </div>
        )}
        <div className="absolute right-2 top-2 z-10 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border border-[#cfab91] bg-white px-1.5 text-[10px] font-black text-[#6b3141]">
          x{quantity}
        </div>

        <div className="mx-auto mt-1 flex h-24 w-24 items-center justify-center">
          <span className="text-[56px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">
            {item.icon}
          </span>
        </div>

        <div className="mt-2 text-center text-[15px] font-black leading-tight text-[#6b3141] whitespace-normal break-words sm:text-[13px] sm:truncate sm:whitespace-nowrap">{item.name}</div>

        {isEquipCard && !bulkSellMode ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (!canEquipFromCard) return;
              handleAction(item, isEquipped);
            }}
            disabled={!canEquipFromCard}
            className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-black uppercase tracking-[0.12em] transition-all ${!canEquipFromCard ? 'border-[#d6b9a3] bg-[#ead8c4] text-[#a08475] cursor-not-allowed' : isEquipped ? 'border-[#8a5a35] bg-[#9a6a3f] text-[#fff4e8] hover:-translate-y-0.5 hover:bg-[#ab7b4f]' : 'border-[#3f7344] bg-[#4f8a55] text-[#ecffef] hover:-translate-y-0.5 hover:bg-[#5a9b62]'}`}
          >
            <Shield size={14} />
            {isEquipped ? 'Desequipar' : 'Equipar'}
          </button>
        ) : null}
      </div>
    );
  };

  const totalItems = inventoryItems.reduce((sum, entry) => sum + entry.quantity, 0);
  const showBulkSellStarter = canBulkSell && !bulkSellMode && !mobileEntry && !pendingAction && !sellingItem && !bulkSellReviewOpen && !bulkSellConfirmOpen;
  const showBulkSellControls = canBulkSell && bulkSellMode && !mobileEntry && !pendingAction && !sellingItem && !bulkSellReviewOpen && !bulkSellConfirmOpen;
  const mobileDetailEffectCards = mobileEntry ? getItemEffectCards(mobileEntry.item) : [];
  const mobileDetailTrend = mobileEntry ? getEquipmentComparisonTrend(player, mobileEntry.item) : null;
  const mobileCanSellInCamp = Boolean(mobileEntry && !bulkSellMode && !isBattleContext && onSell && (player.inventory[mobileEntry.item.id] || 0) > 0);
  const mobileCanUsePotion = Boolean(mobileEntry && isBattleContext && mobileEntry.item.type === 'potion');
  const mobileCanEquipItem = Boolean(mobileEntry && !isBattleContext && isEquipmentType(mobileEntry.item.type));
  const mobileCanAct = !mobileCanSellInCamp && (mobileCanUsePotion || mobileCanEquipItem);

  return (
    <RpgMenuShell
      title="Inventario"
      subtitle="Mochila do aventureiro"
      onClose={onClose}
      closing={isClosing}
      accent="wine"
      valueBadge={<span className="inline-flex items-center gap-2.5 text-lg font-black"><GameAssetIcon name="bag" size={24} /> {totalItems} itens</span>}
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 pb-0">
        <div className="hidden items-center justify-between gap-3 xl:flex">
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {FILTERS.map((entry) => {
              const active = filter === entry.id;
              return (
                <RpgMenuTab
                  key={`desktop-top-${entry.id}`}
                  active={active}
                  onClick={() => setFilter(entry.id)}
                  className={`inline-flex shrink-0 items-center gap-2 ${active ? '!border-[#7d3d4d] !bg-[#8a4154] !text-white shadow-[0_12px_24px_rgba(86,37,50,0.34)]' : ''}`}
                >
                  <span className={`${active ? 'rounded-full bg-[#a6586d] px-1.5 py-0.5' : ''}`}>
                    {React.cloneElement(entry.icon as React.ReactElement, { className: getFilterIconClass(active), size: 28 })}
                  </span>
                  {entry.label}
                </RpgMenuTab>
              );
            })}
          </div>
          {bulkSellMode && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#3ea86f] bg-[#eaf8ef] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#2f7f56]">
              <Check size={14} />
              Selecionando itens para venda
            </span>
          )}
        </div>

        <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,21rem)]">
          <aside className="flex min-h-0 flex-col gap-4">
            <div className="xl:hidden">
              <div className="mt-1 flex items-center gap-2 overflow-x-auto pb-1">
                {FILTERS.map((entry) => {
                  const active = filter === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setFilter(entry.id)}
                      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-all ${active ? 'h-14 min-w-[4.75rem] border-[#7d3d4d] bg-[#8a4154] px-3.5 shadow-[0_10px_20px_rgba(86,37,50,0.3)]' : 'h-12 min-w-[3.1rem] border-[#d6b9a3] bg-[#f8eddf] px-2.5'}`}
                      aria-label={entry.label}
                      title={entry.label}
                    >
                      {React.cloneElement(entry.icon as React.ReactElement, { className: getFilterIconClass(active), size: active ? 30 : 26 })}
                      {active && <span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-white">{entry.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 rounded-[24px] bg-[#f4e7d5] shadow-[0_8px_26px_rgba(107,49,65,0.08)]" viewportClassName="p-4">
              <div className="mb-3 flex">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141]">
                  Itens {filteredItems.length}
                </span>
              </div>

              <div className="space-y-3">
                {filteredItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">
                    Nenhum item encontrado nesse filtro.
                  </div>
                ) : filter === 'equipment' ? (
                  groupedEquipmentItems.map((group) => {
                    const groupMeta = getEquipmentGroupMeta(group.type);
                    return (
                      <section key={`equip-group-${group.type}`} className="space-y-3 pt-2 first:pt-0">
                        <header className="flex min-h-[2.6rem] items-center gap-3 px-1 py-2 text-[#6b3141]">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#f7ecdd] shadow-[0_4px_10px_rgba(107,49,65,0.12)]">
                            {groupMeta.icon}
                          </span>
                          <span className="text-lg font-black leading-none uppercase tracking-[0.22em] text-[#5b2432] [text-shadow:0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(255,255,255,0.5)]">{groupMeta.label}</span>
                        </header>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.8rem,1fr))] gap-2.5">
                          {group.entries.map(renderInventoryCard)}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(8.8rem,1fr))] gap-2.5">
                    {filteredItems.map(renderInventoryCard)}
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="hidden min-h-0 xl:block">
            <ItemDetailCard item={selectedEntry?.item ?? null} player={player} quantity={selectedEntry?.quantity ?? 0} onAction={handleAction} onSell={bulkSellMode ? undefined : handleSell} isBattleContext={isBattleContext} isEquipped={selectedEntry ? isItemEquipped(selectedEntry.item) : false} disableActions={bulkSellMode} />
          </section>
        </div>
      </div>

      {showBulkSellStarter && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] -translate-x-1/2 md:bottom-6">
          <button
            onClick={startBulkSellMode}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#d9b26e] bg-[linear-gradient(135deg,#8a642f,#a9783c)] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#fff6e6] shadow-[0_14px_28px_rgba(112,79,46,0.35)] transition-all hover:-translate-y-0.5 hover:brightness-105 md:gap-2.5 md:px-6 md:py-3 md:text-sm"
            title="Selecionar itens para vender"
          >
            <GameAssetIcon name="coinCopper" size={18} />
            Vender itens
          </button>
        </div>
      )}

      {showBulkSellControls && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] -translate-x-1/2 md:bottom-6">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#fff7ed]/95 p-1.5 shadow-[0_14px_28px_rgba(54,26,33,0.22)]">
            <button
              onClick={cancelBulkSellMode}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2] md:px-4 md:text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={openBulkSellReview}
              disabled={bulkSellSelectedTypes <= 0}
              className="inline-flex items-center gap-2 rounded-full border border-[#3f7344] bg-[#4f8a55] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#ecffef] transition-colors hover:bg-[#5a9b62] disabled:cursor-not-allowed disabled:opacity-60 md:px-4 md:text-xs"
            >
              <Check size={14} />
              Confirmar ({bulkSellSelectedTypes})
            </button>
          </div>
        </div>
      )}

      {mobileEntry && (
        <div className="xl:hidden absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-2 sm:p-4" onClick={closeMobileDetail}>
          <div className={`w-full max-w-lg max-h-[92vh] rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(107,49,65,0.18)] overflow-hidden flex flex-col ${mobileDetailClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="relative shrink-0 p-2">
              <button onClick={closeMobileDetail} className="absolute right-2 top-2 z-10 rounded-xl border border-[#cfab91] bg-[#f4e5d4] p-2 text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="relative mx-auto w-full max-w-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                    <span className="text-[40px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,1.5px_1.5px_0_#fff,-1.5px_1.5px_0_#fff,1.5px_-1.5px_0_#fff,-1.5px_-1.5px_0_#fff,0_0_12px_rgba(255,255,255,0.6)]">
                      {mobileEntry.item.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-[#6b3141]">{mobileEntry.item.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#fff5e6] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7f5b56]">
                        <ItemTypeIcon type={mobileEntry.item.type} size={12} />
                        <ItemTypeLabel type={mobileEntry.item.type} />
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
                        Quantidade x{mobileEntry.quantity}
                      </span>
                      {mobileDetailTrend && (
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm ${mobileDetailTrend === 'up' ? 'bg-[#3ea86f] text-white' : mobileDetailTrend === 'down' ? 'bg-[#d24f61] text-white' : 'bg-[#d9b250] text-white'}`}>
                          {mobileDetailTrend === 'up' ? <ArrowUp size={10} /> : mobileDetailTrend === 'down' ? <ArrowDown size={10} /> : <span className="text-xs leading-none">-</span>}
                        </span>
                      )}
                      {isItemEquipped(mobileEntry.item) && (
                        <span className="inline-flex rounded-full border border-[#7d3d4d] bg-[#fff3e7] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b3141]">
                          Equipado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{mobileEntry.item.description}</p>

                <div className="mt-3 rpg-3d-showcase relative overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
                  <div className="h-[12rem]"><ItemPreviewThree item={mobileEntry.item} variant="menu" /></div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {mobileDetailEffectCards.map((entry) => (
                    <div key={`${mobileEntry.item.id}-${entry.id}`} className={`rounded-[14px] border px-2.5 py-2 ${entry.panel}`}>
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

            {mobileCanSellInCamp && (
              <div className="shrink-0 border-t border-[#c59d82] bg-[#f8eddf] p-4">
                <button
                  onClick={() => {
                    handleSell(mobileEntry.item);
                    closeMobileDetail();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#8f6a24] bg-[#b8892f] px-4 py-3 text-base font-black uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#c79636]"
                >
                  <GameAssetIcon name="coin" size={20} className="[filter:drop-shadow(0_0_0_#fff)_drop-shadow(0_0_0_#fff)_drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)_drop-shadow(0_1px_0_#fff)_drop-shadow(0_-1px_0_#fff)_drop-shadow(1px_1px_0_#fff)_drop-shadow(-1px_1px_0_#fff)_drop-shadow(1px_-1px_0_#fff)_drop-shadow(-1px_-1px_0_#fff)]" />
                  Vender {Math.floor(mobileEntry.item.cost / 2)}
                </button>
              </div>
            )}

            {mobileCanAct && (
              <div className="shrink-0 border-t border-[#c59d82] bg-[#f8eddf] p-4">
                <button
                  onClick={() => {
                    handleAction(mobileEntry.item, isItemEquipped(mobileEntry.item));
                    closeMobileDetail();
                  }}
                  className={`inline-flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-black uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5 ${mobileCanUsePotion ? 'border-[#365f82] bg-[#4173a0] text-[#edf6ff] hover:bg-[#4b81b2]' : isItemEquipped(mobileEntry.item) ? 'border-[#8a5a35] bg-[#9a6a3f] text-[#fff4e8] hover:bg-[#ab7b4f]' : 'border-[#3f7344] bg-[#4f8a55] text-[#ecffef] hover:bg-[#5a9b62]'}`}
                >
                  {mobileCanUsePotion ? <FlaskConical size={18} /> : <Shield size={18} />}
                  {mobileCanUsePotion ? 'Usar Item' : isItemEquipped(mobileEntry.item) ? 'Desequipar' : 'Equipar'}
                </button>
              </div>
            )}
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
              <div className="rounded-[16px] border border-[#d6b9a3] bg-[#fff7eb] px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8a5a57]">Voce ganha</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {sellTotal}</div>
              </div>
              <div className="rounded-[16px] border border-[#d6b9a3] bg-[#fff7eb] px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8a5a57]">Voce fica</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-lg font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {sellGoldAfter}</div>
              </div>
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

      {bulkSellReviewOpen && (
        <div className={`absolute inset-0 z-40 flex items-center justify-center bg-[rgba(32,16,20,0.55)] p-4 backdrop-blur-sm ${bulkSellReviewClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeBulkSellReview}>
          <div className={`w-full max-w-2xl rounded-[22px] border border-[#c59d82] bg-[#f7eddc] p-5 shadow-[0_22px_55px_rgba(40,20,25,0.32)] ${bulkSellReviewClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">
              <GameAssetIcon name="coinCopper" size={16} />
              Vender itens
            </div>
            <h3 className="mt-1 text-xl font-black text-[#6b3141]">Resumo da venda em lote</h3>
            <p className="mt-2 text-sm text-[#7f5b56]">Revise os itens selecionados, remova o que nao deseja vender e confirme no final.</p>

            <div className="mt-4 max-h-[46vh] overflow-y-auto rounded-2xl border border-[#d6b9a3] bg-[#f8eddf] p-3">
              {bulkSellSelectedTypes <= 0 ? (
                <div className="rounded-xl border border-dashed border-[#c59d82] bg-[#fff5e6] px-4 py-8 text-center text-sm text-[#8f6c67]">
                  Nenhum item selecionado.
                </div>
              ) : (
                <div className="space-y-4">
                  {([
                    { key: 'consumables', label: 'Consumiveis', iconName: 'potionBlue' as const, entries: bulkSellGroupedEntries.consumables },
                    { key: 'equipment', label: 'Equipamentos', iconName: 'helm' as const, entries: bulkSellGroupedEntries.equipment },
                    { key: 'materials', label: 'Materiais', iconName: 'gear' as const, entries: bulkSellGroupedEntries.materials },
                  ] as const).map((group) => {
                    if (group.entries.length <= 0) {
                      return null;
                    }

                    return (
                      <section key={group.key} className="space-y-2">
                        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a5a57]">
                          <GameAssetIcon name={group.iconName} size={14} />
                          {group.label}
                        </div>
                        <div className="space-y-2">
                          {group.entries.map((entry) => (
                            <div key={`bulk-sell-${entry.item.id}`} className="flex items-center gap-2 rounded-xl border border-[#d6b9a3] bg-[#fff7eb] px-3 py-2">
                              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d6b9a3] bg-[#f8eddf]">
                                <span className="text-xl leading-none">{entry.item.icon}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-black text-[#6b3141]">{entry.item.name}</div>
                                <div className="mt-0.5 inline-flex items-center rounded-full border border-[#d6b9a3] bg-white px-2.5 py-0.5 text-sm font-black leading-none text-[#6b3141]">
                                  x{entry.quantity}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a5a57]">Valor</div>
                                <div className="inline-flex items-center gap-1 text-base font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={16} /> {entry.totalSellPrice}</div>
                              </div>
                              <button
                                onClick={() => {
                                  setBulkSellSelections((current) => {
                                    const next = { ...current };
                                    delete next[entry.item.id];
                                    return next;
                                  });
                                }}
                                className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d6b9a3] bg-[#f3e5d5] text-[#7f5b56] transition-colors hover:bg-[#efdfcd]"
                                title="Remover item da venda"
                                aria-label={`Remover ${entry.item.name} da venda`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-[#d6b9a3] bg-[#fff7eb] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8a5a57]">Total a receber</span>
                <span className="inline-flex items-center gap-1.5 text-xl font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {bulkSellTotalValue}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={closeBulkSellReview}
                className="rounded-xl border border-[#d6b9a3] bg-[#f3e5d5] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#7f5b56] transition-colors hover:bg-[#efdfcd]"
              >
                Voltar
              </button>
              <button
                onClick={() => setBulkSellConfirmOpen(true)}
                disabled={bulkSellSelectedTypes <= 0}
                className="rounded-xl border border-[#3f7344] bg-[#4f8a55] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#ecffef] transition-colors hover:bg-[#5a9b62] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Vender
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkSellConfirmOpen && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center bg-[rgba(20,10,14,0.62)] p-4 backdrop-blur-sm ${bulkSellConfirmClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeBulkSellConfirm}>
          <div className={`w-full max-w-md rounded-[22px] border border-[#c59d82] bg-[#f7eddc] p-5 shadow-[0_22px_55px_rgba(40,20,25,0.34)] ${bulkSellConfirmClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">
              <GameAssetIcon name="coinCopper" size={16} />
              Confirmacao
            </div>
            <h3 className="mt-1 text-xl font-black text-[#6b3141]">Confirmar venda em lote?</h3>
            <p className="mt-2 text-sm text-[#7f5b56]">
              Deseja vender {bulkSellSelectedTypes} tipos de itens ({bulkSellSelectedUnits} unidades) por {bulkSellTotalValue} moedas?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={closeBulkSellConfirm}
                className="rounded-xl border border-[#d6b9a3] bg-[#f3e5d5] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#7f5b56] transition-colors hover:bg-[#efdfcd]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBulkSell}
                className="rounded-xl border border-[#3f7344] bg-[#4f8a55] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#ecffef] transition-colors hover:bg-[#5a9b62]"
              >
                Confirmar venda
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingAction && (
        <div className={`absolute inset-0 z-30 flex items-center justify-center bg-[rgba(38,18,24,0.5)] p-4 backdrop-blur-sm ${pendingActionClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closePendingAction}>
          <div className={`w-full max-w-md rounded-[22px] border border-[#c59d82] bg-[#f7eddc] p-5 shadow-[0_22px_55px_rgba(40,20,25,0.28)] ${pendingActionClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Confirmacao</div>
            <h3 className="mt-1 text-xl font-black text-[#6b3141]">
              {pendingAction.mode === 'use' ? 'Usar item agora?' : pendingAction.mode === 'unequip' ? 'Desequipar item agora?' : 'Equipar item agora?'}
            </h3>
            <p className="mt-2 text-sm text-[#7f5b56]">
              {pendingAction.mode === 'use'
                ? `Deseja usar ${pendingAction.item.name} nesta batalha?`
                : pendingAction.mode === 'unequip'
                  ? `Deseja desequipar ${pendingAction.item.name} do heroi?`
                  : `Deseja equipar ${pendingAction.item.name} no heroi?`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={closePendingAction}
                className="rounded-xl border border-[#d6b9a3] bg-[#f3e5d5] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#7f5b56] transition-colors hover:bg-[#efdfcd]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPendingAction}
                className="rounded-xl border border-[#7d3d4d] bg-[#6b3141] px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#f7eadf] transition-colors hover:bg-[#7a3d4d]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </RpgMenuShell>
  );
};
