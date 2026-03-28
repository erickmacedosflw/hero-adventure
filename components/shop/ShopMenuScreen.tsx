import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, MousePointerClick, X } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { getItemPowerLabel, getRarityColor, getRarityLabel, isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { RpgMenuPanel, RpgMenuSectionTitle, RpgMenuShell, RpgMenuStat, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';

type ShopFilter = 'all' | 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs' | 'potion';

type ShopMenuScreenProps = {
  player: Player;
  items: Item[];
  onBuy: (item: Item) => void;
  onEquip: (item: Item) => void;
  onSell: (item: Item) => void;
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

  return (
    <div className="grid h-full min-h-0 gap-4">
      <div className="rpg-3d-showcase relative overflow-hidden rounded-[28px] border border-[#c59d82] bg-[linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
        <div className="absolute left-4 top-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#8a5a57]">Preview 3D</div>
        <div className="h-[20rem] sm:h-[24rem]"><ItemPreviewThree item={item} variant="menu" /></div>
      </div>

      <RpgMenuPanel className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">{getRarityLabel(item.rarity)}</div>
            <h2 className="mt-1 text-2xl font-black text-[#6b3141] sm:text-3xl">{item.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{item.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-[18rem]">
            <RpgMenuStat label="Preco" value={<span className="text-[#8d5e29]">{item.cost}</span>} />
            <RpgMenuStat label="Nivel" value={item.minLevel} />
            <RpgMenuStat label="Tipo" value={<span className="text-base">{<ItemTypeLabel type={item.type} />}</span>} />
            <RpgMenuStat label="Poder" value={<span className="text-[#49774c]">+{item.value}</span>} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${getRarityColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
          <span className="rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#7f5b56]"><ItemTypeLabel type={item.type} /></span>
          <span className="rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#7f5b56]">{getItemPowerLabel(item)}</span>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-[#7f5b56]">
            {isEquipped ? 'Esse item ja esta equipado pelo heroi.' : !hasLevel ? `Alcance o nivel ${item.minLevel} para liberar a compra.` : !canAfford ? `Faltam ${item.cost - player.gold} moedas.` : 'Compra imediata e envio direto para o inventario.'}
          </div>
          <button
            onClick={() => onBuy(item)}
            disabled={!canAfford || isEquipped || !hasLevel}
            className={`inline-flex items-center justify-center gap-3 rounded-2xl border px-6 py-4 text-sm font-black uppercase tracking-[0.18em] transition-all ${!canAfford || isEquipped || !hasLevel ? 'border-[#d6b9a3] bg-[#ead8c4] text-[#a08475] cursor-not-allowed' : 'border-[#7d3d4d] bg-[#6b3141] text-[#f7eadf] hover:-translate-y-0.5 hover:bg-[#7a3d4d]'}`}
          >
            {isEquipped ? <GameAssetIcon name="helm" size={22} /> : !hasLevel ? <AlertTriangle size={18} /> : <GameAssetIcon name="coin" size={22} />}
            {isEquipped ? 'Equipado' : !hasLevel ? `Nivel ${item.minLevel}` : 'Comprar'}
          </button>
        </div>
      </RpgMenuPanel>
    </div>
  );
};

export const ShopMenuScreen: React.FC<ShopMenuScreenProps> = ({ player, items, onBuy, onEquip, onSell, onLeave }) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ShopFilter>('all');
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);
  const [mobileShowSell, setMobileShowSell] = useState(false);
  const [pendingEquipItem, setPendingEquipItem] = useState<Item | null>(null);

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

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;
  const mobileDetailItem = filteredItems.find((item) => item.id === mobileDetailItemId) ?? null;

  const handleBuyItem = (item: Item) => {
    onBuy(item);
    if (isEquipmentType(item.type)) {
      setPendingEquipItem(item);
    }
  };

  return (
    <RpgMenuShell
      title="Loja"
      subtitle="Mercador do Vazio"
      onClose={onLeave}
      closeLabel="Voltar"
      accent="gold"
      valueBadge={<span className="inline-flex items-center gap-2.5"><GameAssetIcon name="coin" size={24} /> {player.gold}</span>}
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 pb-16 xl:grid-cols-[minmax(21rem,27rem)_minmax(0,1fr)_17rem] xl:pb-0">
        <aside className="flex min-h-0 flex-col gap-4">
          <RpgMenuPanel className="rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <RpgMenuSectionTitle>Catalogo</RpgMenuSectionTitle>
              <button onClick={() => setMobileShowSell(true)} className="rpg-menu-tab inline-flex items-center gap-2.5 xl:hidden"><GameAssetIcon name="coinCopper" size={22} /> Vender</button>
            </div>
            <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
              {FILTERS.map((entry) => (
                <RpgMenuTab key={entry.id} active={filter === entry.id} onClick={() => setFilter(entry.id)} className="inline-flex items-center gap-2">
                  {entry.icon}
                  {entry.label}
                </RpgMenuTab>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b3141]">Itens {filteredItems.length}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#8d5e29]"><GameAssetIcon name="coinCopper" size={16} /> {player.gold}</span>
            </div>
          </RpgMenuPanel>

          <ScrollArea className="min-h-0 flex-1 rounded-[24px] border border-[#c59d82] bg-[#f4e7d5] shadow-[0_8px_26px_rgba(107,49,65,0.08)]" viewportClassName="p-4">
            <div className="grid gap-3">
              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">Nenhum item encontrado.</div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setMobileDetailItemId(item.id);
                      }}
                      className={`flex items-center gap-3 rounded-[22px] border p-3 text-left transition-all ${isSelected ? 'bg-[#f3e3d2] shadow-[0_14px_30px_rgba(107,49,65,0.15)] scale-[1.01]' : 'bg-[#f8eddf] hover:bg-[#f3e3d2]'} ${getRarityColor(item.rarity)}`}
                    >
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f3e5d5] shrink-0">
                        <span className="text-2xl leading-none">{item.icon}</span>
                        <span className="absolute -bottom-1 -right-1 game-icon-badge h-4 w-4 text-cyan-300"><ItemTypeIcon type={item.type} size={8} /></span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#6b3141]">{item.name}</div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#8a5a57]"><ItemTypeLabel type={item.type} /></span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-2 py-0.5 text-[9px] font-black text-[#8d5e29]"><GameAssetIcon name="coinCopper" size={14} /> {item.cost}</span>
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
          <ShopItemDetail item={selectedItem} player={player} onBuy={handleBuyItem} />
        </section>

        <aside className="hidden min-h-0 xl:block">
          <RpgMenuPanel className="flex h-full min-h-0 flex-col rounded-[24px] p-4">
            <RpgMenuSectionTitle className="mb-4"><span className="inline-flex items-center gap-2.5"><GameAssetIcon name="coinSilver" size={22} /> Venda rapida</span></RpgMenuSectionTitle>
            <ScrollArea className="min-h-0 flex-1 rounded-[20px] border border-[#dcc0aa] bg-[#f8eddf]" viewportClassName="p-3">
              <div className="grid gap-3">
                {Object.entries(player.inventory).map(([id, qty]) => {
                  if (qty <= 0) return null;
                  const itemDef = items.find((item) => item.id === id);
                  if (!itemDef) return null;
                  const sellPrice = Math.floor(itemDef.cost / 2);

                  return (
                    <button key={id} onClick={() => onSell(itemDef)} className={`rounded-[20px] border p-3 text-left transition-all hover:-translate-y-0.5 bg-[#f3e3d2] hover:bg-[#efdac6] ${getRarityColor(itemDef.rarity)}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f6eadb] text-2xl">{itemDef.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-[#6b3141]">{itemDef.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">x{qty}</div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-right text-xs font-black text-[#8d5e29]"><GameAssetIcon name="coinCopper" size={18} /> {sellPrice} G</div>
                      </div>
                    </button>
                  );
                })}
                {Object.entries(player.inventory).every(([, qty]) => qty <= 0) && (
                  <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">Nenhum item para vender.</div>
                )}
              </div>
            </ScrollArea>
          </RpgMenuPanel>
        </aside>
      </div>

      {mobileDetailItem && (
        <div className="absolute inset-0 z-20 bg-[rgba(40,20,25,0.36)] backdrop-blur xl:hidden" onClick={() => setMobileDetailItemId(null)}>
          <div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#c59d82] bg-[#7a5733] px-4 py-3 text-[#fff5e7]">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em]"><ArrowLeft size={16} /> Detalhes do item</h3>
              <button onClick={() => setMobileDetailItemId(null)} className="rounded-xl border border-white/15 bg-white/10 p-2 transition-opacity hover:opacity-80"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ShopItemDetail item={mobileDetailItem} player={player} onBuy={(item) => { handleBuyItem(item); setMobileDetailItemId(null); }} />
            </div>
          </div>
        </div>
      )}

      {!mobileDetailItem && !mobileShowSell && !pendingEquipItem && (
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
                  {Object.entries(player.inventory).map(([id, qty]) => {
                    if (qty <= 0) return null;
                    const itemDef = items.find((item) => item.id === id);
                    if (!itemDef) return null;
                    const sellPrice = Math.floor(itemDef.cost / 2);

                    return (
                      <button key={id} onClick={() => onSell(itemDef)} className={`flex items-center gap-3 rounded-[20px] border p-3 text-left transition-all bg-[#f3e3d2] hover:bg-[#efdac6] ${getRarityColor(itemDef.rarity)}`}>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#f6eadb] text-2xl">{itemDef.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-[#6b3141]">{itemDef.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9a7068]">x{qty}</div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-right text-xs font-black text-[#8d5e29]"><GameAssetIcon name="coinCopper" size={18} /> {sellPrice} G</div>
                      </button>
                    );
                  })}
                </div>
              </RpgMenuPanel>
            </div>
          </div>
        </div>
      )}
    </RpgMenuShell>
  );
};