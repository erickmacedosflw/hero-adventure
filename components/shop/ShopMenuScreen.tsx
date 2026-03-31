import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Heart, MousePointerClick, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { getRarityColor, getRarityLabel, isEquipmentType, ItemTypeLabel } from '../ui/game-display';
import { RpgMenuPanel, RpgMenuSectionTitle, RpgMenuShell, RpgMenuStat, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';

type ShopFilter = 'all' | 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

type ShopMenuScreenProps = {
  player: Player;
  items: Item[];
  onBuy: (item: Item, quantity: number) => void;
  onEquip: (item: Item) => void;
  onSell: (item: Item, quantity: number) => void;
  onLeave: () => void;
};

const FILTERS: Array<{ id: ShopFilter; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'Todos', icon: <GameAssetIcon name="chest" size={22} /> },
  { id: 'potion', label: 'Itens', icon: <GameAssetIcon name="potionRed" size={22} /> },
  { id: 'weapon', label: 'Armas', icon: <GameAssetIcon name="sword" size={22} /> },
  { id: 'shield', label: 'Escudos', icon: <GameAssetIcon name="shield" size={22} /> },
  { id: 'helmet', label: 'Capacetes', icon: <GameAssetIcon name="helm" size={22} /> },
  { id: 'armor', label: 'Armaduras', icon: <GameAssetIcon name="armor" size={22} /> },
  { id: 'legs', label: 'Botas', icon: <GameAssetIcon name="boots" size={22} /> },
];

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
    return [createEffectCard('atk', 'ATK', `+${item.value}`, <Sword size={15} />, 'text-[#b83a4b]', 'border-[#e6b1b9] bg-[linear-gradient(180deg,#fff8f8,#fbe9eb)]')];
  }

  if (item.type === 'armor' || item.type === 'helmet' || item.type === 'legs' || item.type === 'shield') {
    return [createEffectCard('def', 'DEF', `+${item.value}`, <Shield size={15} />, 'text-[#4d6780]', 'border-[#b9c8d7] bg-[linear-gradient(180deg,#f8fbff,#eaf1f8)]')];
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

const ShopItemDetail = ({ item, player, onBuy }: { item: Item | null; player: Player; onBuy: (item: Item) => void }) => {
  if (!item) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-6 text-center text-[#8f6c67]">
        <GameAssetIcon name="chest" size={60} className="opacity-68" />
        <h3 className="mt-4 text-lg font-black text-[#6b3141]">Selecione um item</h3>
        <p className="mt-2 max-w-sm text-sm">O mercador mostra o preview, o poder e o custo do item selecionado.</p>
      </div>
    );
  }

  const canAfford = player.gold >= item.cost;
  const hasLevel = player.level >= item.minLevel;
  const isEquipped = player.equippedWeapon?.id === item.id || player.equippedArmor?.id === item.id || player.equippedHelmet?.id === item.id || player.equippedLegs?.id === item.id || player.equippedShield?.id === item.id;
  const effectCards = getItemEffectCards(item);

  return (
    <RpgMenuPanel className="rounded-[28px] p-5 sm:p-6">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">{getRarityLabel(item.rarity)}</div>
      <h2 className="mt-1 text-2xl font-black text-[#6b3141] sm:text-3xl">{item.name}</h2>
      <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{item.description}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
        <div className="rpg-3d-showcase relative overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
          <div className="h-[11rem] sm:h-[13rem] lg:h-[15rem]"><ItemPreviewThree item={item} variant="menu" /></div>
        </div>

        <div className="grid content-start gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[18px] border border-[#dcc0aa] bg-[linear-gradient(180deg,#fffdf9,#f7ecdd)] px-3 py-2.5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9a7068]">Nivel</div>
              <div className="mt-1 text-lg font-black text-[#6b3141]">{item.minLevel}</div>
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

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${getRarityColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
        <span className="rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#7f5b56]"><ItemTypeLabel type={item.type} /></span>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-[#7f5b56]">
          {isEquipped ? 'Esse item ja esta equipado pelo heroi.' : !hasLevel ? `Alcance o nivel ${item.minLevel} para liberar a compra.` : !canAfford ? `Faltam ${item.cost - player.gold} moedas.` : 'Escolha a quantidade e confirme a compra.'}
        </div>
        <button
          onClick={() => onBuy(item)}
          disabled={!canAfford || isEquipped || !hasLevel}
          className={`inline-flex items-center justify-center gap-2.5 rounded-2xl border px-6 py-4 text-sm font-black uppercase tracking-[0.18em] transition-all ${!canAfford || isEquipped || !hasLevel ? 'border-[#d6b9a3] bg-[#ead8c4] text-[#a08475] cursor-not-allowed' : 'border-[#7d3d4d] bg-[#6b3141] text-[#f7eadf] hover:-translate-y-0.5 hover:bg-[#7a3d4d]'}`}
        >
          {isEquipped ? (
            <>
              <GameAssetIcon name="helm" size={22} />
              Equipado
            </>
          ) : !hasLevel ? (
            <>
              <AlertTriangle size={18} />
              Nivel {item.minLevel}
            </>
          ) : (
            <>
              <GameAssetIcon name="coin" size={22} />
              {item.cost}
            </>
          )}
        </button>
      </div>
    </RpgMenuPanel>
  );
};

export const ShopMenuScreen: React.FC<ShopMenuScreenProps> = ({ player, items, onBuy, onEquip, onSell, onLeave }) => {
  const MODAL_CLOSE_MS = 180;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ShopFilter>('all');
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);
  const [mobileShowSell, setMobileShowSell] = useState(false);
  const [pendingEquipItem, setPendingEquipItem] = useState<Item | null>(null);
  const [buyingItem, setBuyingItem] = useState<Item | null>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [sellingItem, setSellingItem] = useState<Item | null>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [buyModalClosing, setBuyModalClosing] = useState(false);
  const [sellModalClosing, setSellModalClosing] = useState(false);
  const buyModalCloseTimerRef = useRef<number | null>(null);
  const sellModalCloseTimerRef = useRef<number | null>(null);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.type !== 'material')
      .filter((item) => item.source !== 'dungeon' && item.source !== 'alchemist')
      .filter((item) => filter === 'all' || item.type === filter)
      .sort((left, right) => {
        const rarityDifference = getRarityWeight(left.rarity) - getRarityWeight(right.rarity);
        if (rarityDifference !== 0) {
          return rarityDifference;
        }
        return left.cost - right.cost;
      });
  }, [filter, items]);

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
    return () => {
      if (buyModalCloseTimerRef.current) {
        window.clearTimeout(buyModalCloseTimerRef.current);
      }
      if (sellModalCloseTimerRef.current) {
        window.clearTimeout(sellModalCloseTimerRef.current);
      }
    };
  }, []);

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const mobileDetailItem = filteredItems.find((item) => item.id === mobileDetailItemId) ?? null;

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
    onSell(sellingItem, finalQty);
    closeSellModal();
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
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 pb-16 xl:pb-0">
        <div className="hidden xl:flex xl:flex-nowrap xl:gap-2 xl:overflow-x-auto xl:pb-1">
          {FILTERS.map((entry) => (
            <RpgMenuTab key={`desktop-top-${entry.id}`} active={filter === entry.id} onClick={() => setFilter(entry.id)} className="inline-flex shrink-0 items-center gap-2">
              {entry.icon}
              {entry.label}
            </RpgMenuTab>
          ))}
        </div>

        <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)_minmax(16rem,19rem)]">
          <aside className="flex min-h-0 flex-col gap-4">
            <RpgMenuPanel className="rounded-[24px] p-4 xl:hidden">
              <div className="flex items-center justify-between gap-3">
                <RpgMenuSectionTitle>Catalogo</RpgMenuSectionTitle>
                <button onClick={() => setMobileShowSell(true)} className="rpg-menu-tab inline-flex items-center gap-2.5 xl:hidden"><GameAssetIcon name="coinCopper" size={22} /> Vender</button>
              </div>
              <div className="mt-4 hidden flex-wrap gap-2 sm:flex xl:hidden">
                {FILTERS.map((entry) => (
                  <RpgMenuTab key={entry.id} active={filter === entry.id} onClick={() => setFilter(entry.id)} className="inline-flex items-center gap-2">
                    {entry.icon}
                    {entry.label}
                  </RpgMenuTab>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141]">Itens {filteredItems.length}</span>
              </div>
            </RpgMenuPanel>

            <ScrollArea className="min-h-0 flex-1 rounded-[24px] border border-[#c59d82] bg-[#f4e7d5] shadow-[0_8px_26px_rgba(107,49,65,0.08)]" viewportClassName="p-4">
              <div className="mb-3 hidden xl:flex">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141]">
                  Itens {filteredItems.length}
                </span>
              </div>
              <div className="grid gap-3">
                {filteredItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">Nenhum item encontrado.</div>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    const canAfford = player.gold >= item.cost;
                    const hasLevel = player.level >= item.minLevel;
                    const canBuy = canAfford && hasLevel;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setMobileDetailItemId(item.id);
                        }}
                        className={`flex items-center gap-3 rounded-[22px] border p-3 text-left transition-all ${isSelected ? 'bg-[#f3e3d2] shadow-[0_14px_30px_rgba(107,49,65,0.15)] scale-[1.01]' : 'bg-[#f8eddf] hover:bg-[#f3e3d2]'} ${getRarityColor(item.rarity)} ${canBuy ? '' : 'opacity-75'} ${!canBuy ? 'ring-1 ring-[#c59d82]/55' : ''}`}
                      >
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f3e5d5]">
                          <span className="text-2xl leading-none">{item.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate pr-1 text-[15px] font-black text-[#6b3141]">{item.name}</div>
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2.5 py-0.5 text-base font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {item.cost}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${getRarityColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
                          </div>
                        </div>
                        {isSelected && <MousePointerClick size={18} className="text-[#7d3d4d]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="hidden min-h-0 xl:block">
            <ShopItemDetail item={selectedItem} player={player} onBuy={openBuyModal} />
          </section>

          <aside className="hidden min-h-0 xl:block">
            <RpgMenuPanel className="flex h-full min-h-0 flex-col rounded-[24px] p-4">
              <RpgMenuSectionTitle className="mb-4"><span className="inline-flex items-center gap-2.5"><GameAssetIcon name="coinSilver" size={22} /> Venda rapida</span></RpgMenuSectionTitle>
              <ScrollArea className="min-h-0 flex-1 rounded-[20px] border border-[#dcc0aa] bg-[#f8eddf]" viewportClassName="p-3">
                <div className="grid gap-3">
                  {sellableEntries.map((entry) => (
                    <button key={entry.item.id} onClick={() => openSellModal(entry.item)} className={`rounded-[20px] border bg-[#f3e3d2] p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-[#efdac6] ${getRarityColor(entry.item.rarity)}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f6eadb] text-2xl">{entry.item.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-[#6b3141]">{entry.item.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">x{entry.qty}</div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-right text-base font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {entry.unitSellPrice}</div>
                      </div>
                    </button>
                  ))}
                  {sellableEntries.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">Nenhum item para vender.</div>
                  )}
                </div>
              </ScrollArea>
            </RpgMenuPanel>
          </aside>
        </div>
      </div>

      {mobileDetailItem && (
        <div className="absolute inset-0 z-20 bg-[rgba(40,20,25,0.36)] backdrop-blur xl:hidden" onClick={() => setMobileDetailItemId(null)}>
          <div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#c59d82] bg-[#7a5733] px-4 py-3 text-[#fff5e7]">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em]"><ArrowLeft size={16} /> Detalhes do item</h3>
              <button onClick={() => setMobileDetailItemId(null)} className="rounded-xl border border-white/15 bg-white/10 p-2 transition-opacity hover:opacity-80"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ShopItemDetail item={mobileDetailItem} player={player} onBuy={openBuyModal} />
            </div>
          </div>
        </div>
      )}

      {!mobileDetailItem && !mobileShowSell && !pendingEquipItem && !buyingItem && !sellingItem && (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 xl:hidden">
        <div className="pointer-events-auto grid w-full max-w-lg grid-cols-5 gap-1.5 rounded-[16px] border border-[#c59d82] bg-[#f7eddc]/92 p-1.5 shadow-[0_14px_28px_rgba(54,26,33,0.18)] backdrop-blur-md">
          {FILTERS.slice(0, 5).map((entry) => {
            const active = filter === entry.id;

            return (
              <button
                key={`mobile-nav-${entry.id}`}
                onClick={() => setFilter(entry.id)}
                className={`flex flex-col items-center justify-center rounded-[12px] px-2 py-1.5 transition-all ${active ? 'bg-[#fff4e7] text-[#6b3141] shadow-sm' : 'text-[#8f6c67]'}`}
              >
                <span className={`transition-all duration-200 ${active ? 'scale-105' : 'opacity-80'}`}>{entry.icon}</span>
                <span className={`mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${active ? '' : 'opacity-70'}`}>{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {buyingItem && (
        <div className={`absolute inset-0 z-30 flex items-center justify-center bg-[rgba(40,20,25,0.46)] p-4 backdrop-blur-sm ${buyModalClosing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in'}`} onClick={closeBuyModal}>
          <div className={`w-full max-w-md rounded-[24px] border border-[#c59d82] bg-[#f8eddf] p-5 shadow-[0_20px_48px_rgba(54,26,33,0.28)] ${buyModalClosing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in'}`} onClick={(event) => event.stopPropagation()}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Compra</div>
            <h3 className="mt-1 inline-flex items-center gap-2 text-xl font-black text-[#6b3141]">
              <span className="text-2xl leading-none">{buyingItem.icon}</span>
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
              <span className="text-2xl leading-none">{sellingItem.icon}</span>
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
                  {sellableEntries.map((entry) => (
                    <button key={entry.item.id} onClick={() => openSellModal(entry.item)} className={`flex items-center gap-3 rounded-[20px] border bg-[#f3e3d2] p-3 text-left transition-all hover:bg-[#efdac6] ${getRarityColor(entry.item.rarity)}`}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f6eadb] text-2xl">{entry.item.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#6b3141]">{entry.item.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">x{entry.qty}</div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-right text-base font-black text-[#8d5e29]"><GameAssetIcon name="coin" size={18} /> {entry.unitSellPrice}</div>
                    </button>
                  ))}
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
