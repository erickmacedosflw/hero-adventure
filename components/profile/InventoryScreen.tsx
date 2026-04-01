import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FlaskConical, Heart, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { getRarityColor, getRarityLabel, isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
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
  isBattleContext?: boolean;
  initialFilter?: 'all' | 'equipment' | 'potion' | 'material';
  isClosing?: boolean;
};

type InventoryFilter = 'all' | 'equipment' | 'potion' | 'material';

type EffectCard = {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  panel: string;
};

const FILTERS: Array<{ id: InventoryFilter; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'Todos', icon: <GameAssetIcon name="bag" size={22} /> },
  { id: 'equipment', label: 'Equip.', icon: <GameAssetIcon name="helm" size={22} /> },
  { id: 'potion', label: 'Consum.', icon: <GameAssetIcon name="potionBlue" size={22} /> },
  { id: 'material', label: 'Materiais', icon: <GameAssetIcon name="gear" size={22} /> },
];

const getTypeFilterIcon = (type: Item['type']) => {
  if (type === 'potion') return <GameAssetIcon name="potionBlue" size={18} />;
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
  quantity,
  onAction,
  isBattleContext,
  isEquipped,
}: {
  item: Item | null;
  quantity: number;
  onAction: (item: Item, isEquipped: boolean) => void;
  isBattleContext: boolean;
  isEquipped: boolean;
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
  const canUsePotion = isBattleContext && item.type === 'potion';
  const canEquipItem = !isBattleContext && item.type !== 'potion' && item.type !== 'material';
  const canAct = canUsePotion || canEquipItem;
  const actionButtonClass = canUsePotion
    ? 'border-[#3d6f8f] bg-[#3a6f8e] hover:bg-[#4c7f9f]'
    : isEquipped
      ? 'border-[#8a5a35] bg-[#9a6a3f] hover:bg-[#ab7b4f]'
      : 'border-[#3f7344] bg-[#3f7a47] hover:bg-[#4b8a55]';

  return (
    <RpgMenuPanel className="rounded-[26px] p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">{getRarityLabel(item.rarity)}</div>
      <h2 className="mt-1 text-xl font-black text-[#6b3141] sm:text-2xl">{item.name}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{item.description}</p>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)]">
        <div className="rpg-3d-showcase relative overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
          <div className="h-[10.5rem] sm:h-[12rem] lg:h-[12.5rem]"><ItemPreviewThree item={item} variant="menu" /></div>
        </div>

        <div className="grid content-start gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[18px] border border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)] px-3 py-2.5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9a7068]">Qtd</div>
              <div className="mt-1 text-lg font-black text-[#6b3141]">x{quantity}</div>
            </div>
            <div className="rounded-[18px] border border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)] px-3 py-2.5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9a7068]">Tipo</div>
              <div className="mt-1 inline-flex items-center gap-2 text-sm font-black text-[#6b3141]">
                {getTypeFilterIcon(item.type)}
                <ItemTypeLabel type={item.type} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {effectCards.map((entry) => (
              <div key={`${item.id}-${entry.id}`} className={`rounded-[16px] border px-3 py-2 ${entry.panel}`}>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a7068]">{entry.label}</div>
                <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-black ${entry.tone}`}>
                  {entry.icon}
                  {entry.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${getRarityColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
        <span className="rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#7f5b56]"><ItemTypeLabel type={item.type} /></span>
      </div>

      {canAct && (
        <button
          onClick={() => onAction(item, isEquipped)}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-[#f7eadf] transition-all hover:-translate-y-0.5 ${actionButtonClass}`}
        >
          {canUsePotion ? <FlaskConical size={18} /> : <Shield size={18} />}
          {canUsePotion ? 'Usar Item' : isEquipped ? 'Desequipar' : 'Equipar Agora'}
        </button>
      )}
    </RpgMenuPanel>
  );
};

export const InventoryScreen = ({ player, shopItems, onClose, onOpenShop, onEquip, onUnequip, onUse, isBattleContext = false, initialFilter = 'all', isClosing = false }: InventoryScreenProps) => {
  const MODAL_CLOSE_MS = 180;
  const [filter, setFilter] = useState<InventoryFilter>(initialFilter);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ item: Item; mode: 'equip' | 'unequip' | 'use' } | null>(null);
  const [mobileDetailClosing, setMobileDetailClosing] = useState(false);
  const [pendingActionClosing, setPendingActionClosing] = useState(false);
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
    return inventoryItems.filter(({ item }) => {
      if (filter === 'all') {
        return true;
      }
      if (filter === 'equipment') {
        return isEquipmentType(item.type);
      }
      return item.type === filter;
    });
  }, [filter, inventoryItems]);

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
    return () => {
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

  const totalItems = inventoryItems.reduce((sum, entry) => sum + entry.quantity, 0);
  const showShopShortcut = !isBattleContext && Boolean(onOpenShop) && !mobileEntry && !pendingAction;

  return (
    <RpgMenuShell
      title="Inventario"
      subtitle="Mochila do aventureiro"
      onClose={onClose}
      closing={isClosing}
      accent="wine"
      valueBadge={<span className="inline-flex items-center gap-2.5 text-lg font-black"><GameAssetIcon name="bag" size={24} /> {totalItems} itens</span>}
    >
      <div className="flex h-full min-h-0 flex-col gap-3 pb-16 xl:pb-0">
        <div className="hidden xl:flex xl:flex-nowrap xl:gap-2 xl:overflow-x-auto xl:pb-1">
          {FILTERS.map((entry) => (
            <RpgMenuTab key={`desktop-top-${entry.id}`} active={filter === entry.id} onClick={() => setFilter(entry.id)} className="inline-flex h-11 shrink-0 items-center gap-2 px-4 py-0">
              {entry.icon}
              {entry.label}
            </RpgMenuTab>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(34rem,1.2fr)_minmax(19rem,0.8fr)]">
          <aside className="flex min-h-0 flex-col gap-4">
            <ScrollArea className="min-h-0 flex-1 rounded-[24px] border border-[#c59d82] bg-[#f4e7d5] shadow-[0_8px_26px_rgba(107,49,65,0.08)]" viewportClassName="p-4">
              <div className="mb-3 flex">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141]">
                  Itens {totalItems}
                </span>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {filteredItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67] xl:col-span-2">
                    Nenhum item encontrado nesse filtro.
                  </div>
                ) : (
                  filteredItems.map(({ item, quantity }) => {
                    const isSelected = selectedItemId === item.id;
                    const isEquipped = isItemEquipped(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setMobileDetailItemId(item.id);
                        }}
                        className={`flex h-full min-h-[5.6rem] items-center gap-3 rounded-[22px] border p-3 text-left transition-colors ${isSelected ? 'bg-[#f3e3d2] shadow-[0_14px_30px_rgba(107,49,65,0.15)]' : 'bg-[#f8eddf] hover:bg-[#f3e3d2]'} ${getRarityColor(item.rarity)}`}
                      >
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f3e5d5]">
                          <span className="text-2xl leading-none">{item.icon}</span>
                          <span className="absolute -bottom-1 -right-1 game-icon-badge h-4 w-4 text-cyan-300"><ItemTypeIcon type={item.type} size={8} /></span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-[#6b3141]">{item.name}</div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="inline-flex rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#8a5a57]"><ItemTypeLabel type={item.type} /></span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${getRarityColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
                            {isEquipped && (
                              <span className="inline-flex rounded-full border border-[#7d3d4d] bg-[#fff3e7] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#6b3141]">
                                Equipado
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[#d6b9a3] bg-[#f3e5d5] px-2 py-1 text-xs font-black text-[#6b3141]">x{quantity}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="hidden min-h-0 xl:block">
            <ItemDetailCard item={selectedEntry?.item ?? null} quantity={selectedEntry?.quantity ?? 0} onAction={handleAction} isBattleContext={isBattleContext} isEquipped={selectedEntry ? isItemEquipped(selectedEntry.item) : false} />
          </section>
        </div>
      </div>

      {!mobileEntry && (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 sm:hidden">
        <div className="pointer-events-auto grid w-full max-w-md grid-cols-4 gap-1.5 rounded-[16px] border border-[#c59d82] bg-[#f7eddc]/92 p-1.5 shadow-[0_14px_28px_rgba(54,26,33,0.18)] backdrop-blur-md">
          {FILTERS.map((entry) => {
            const active = filter === entry.id;

            return (
              <button
                key={`mobile-nav-${entry.id}`}
                onClick={() => setFilter(entry.id)}
                className={`flex h-[3.2rem] flex-col items-center justify-center rounded-[12px] px-2 py-1.5 transition-colors ${active ? 'bg-[#fff4e7] text-[#6b3141] shadow-sm' : 'text-[#8f6c67]'}`}
              >
                <span className={`${active ? '' : 'opacity-80'}`}>{entry.icon}</span>
                <span className={`mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${active ? '' : 'opacity-70'}`}>{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {showShopShortcut && (
        <div className="pointer-events-none fixed bottom-[5.6rem] right-4 z-[95] md:bottom-6 md:right-6">
          <button
            onClick={() => onOpenShop?.()}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#d9b26e] bg-[linear-gradient(135deg,#8a642f,#a9783c)] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#fff6e6] shadow-[0_14px_28px_rgba(112,79,46,0.35)] transition-all hover:-translate-y-0.5 hover:brightness-105 md:gap-2.5 md:px-5 md:py-3 md:text-sm"
            title="Ir ao mercador"
          >
            <GameAssetIcon name="chest" size={18} />
            Mercador
          </button>
        </div>
      )}

      {mobileEntry && (
        <div className={`absolute inset-0 z-20 bg-[rgba(40,20,25,0.36)] backdrop-blur md:hidden ${mobileDetailClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeMobileDetail}>
          <div className={`flex h-full flex-col ${mobileDetailClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#c59d82] bg-[#6b3141] px-4 py-3 text-[#f7eadf]">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em]"><ArrowLeft size={16} /> Detalhes do item</h3>
              <button onClick={closeMobileDetail} className="rounded-xl border border-white/15 bg-white/10 p-2 transition-opacity hover:opacity-80"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ItemDetailCard item={mobileEntry.item} quantity={mobileEntry.quantity} onAction={handleAction} isBattleContext={isBattleContext} isEquipped={isItemEquipped(mobileEntry.item)} />
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
