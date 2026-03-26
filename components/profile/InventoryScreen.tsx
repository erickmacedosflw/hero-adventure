import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, FlaskConical, LayoutGrid, Shield, Shirt, Sparkles, Sword, X } from 'lucide-react';
import { Item, Player } from '../../types';
import { ItemPreviewThree } from '../items/ItemPreviewThree';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { getItemPowerLabel, getRarityColor, getRarityLabel, isEquipmentType, ItemTypeIcon, ItemTypeLabel } from '../ui/game-display';
import { RpgMenuPanel, RpgMenuSectionTitle, RpgMenuShell, RpgMenuStat, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';

type InventoryScreenProps = {
  player: Player;
  shopItems: Item[];
  onClose: () => void;
  onEquip: (item: Item) => void;
  onUse: (itemId: string) => void;
};

type InventoryFilter = 'all' | 'equipment' | 'potion' | 'material';

const FILTERS: Array<{ id: InventoryFilter; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'Todos', icon: <GameAssetIcon name="bag" size={22} /> },
  { id: 'equipment', label: 'Equip.', icon: <GameAssetIcon name="helm" size={22} /> },
  { id: 'potion', label: 'Consum.', icon: <GameAssetIcon name="potionBlue" size={22} /> },
  { id: 'material', label: 'Materiais', icon: <GameAssetIcon name="gear" size={22} /> },
];

const slotIcons: Record<'weapon' | 'shield' | 'helmet' | 'armor' | 'legs', React.ReactNode> = {
  weapon: <Sword size={16} />,
  shield: <Shield size={16} />,
  helmet: <Crown size={16} />,
  armor: <Shirt size={16} />,
  legs: <GameAssetIcon name="boots" size={20} />,
};

const ItemDetailCard = ({ item, quantity, onAction }: { item: Item | null; quantity: number; onAction: (item: Item) => void }) => {
  if (!item) {
    return (
      <div className="flex h-full min-h-[22rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-6 text-center text-[#8f6c67]">
        <GameAssetIcon name="bag" size={56} className="opacity-50" />
        <h3 className="mt-4 text-lg font-black text-slate-300">Selecione um item</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-500">Escolha um item na lista para ver preview 3D, atributos, raridade e acao disponivel.</p>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-5">
      <div className="rpg-3d-showcase relative overflow-hidden rounded-[28px] border border-[#c59d82] bg-[radial-gradient(circle_at_top,_rgba(107,49,65,0.08),_transparent_38%),linear-gradient(180deg,rgba(251,241,228,0.72),rgba(244,231,214,0.58))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,248,238,0.55),transparent_42%)] opacity-70" />
        <div className="absolute left-4 top-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#8a5a57]">Item Preview</div>
        <div className="h-[18rem] sm:h-[22rem]"><ItemPreviewThree item={item} variant="menu" /></div>
      </div>

      <RpgMenuPanel className="rounded-[28px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">{getRarityLabel(item.rarity)}</div>
            <h2 className="mt-1 text-2xl font-black text-[#6b3141] sm:text-3xl">{item.name}</h2>
          </div>
          <div className="rounded-xl border border-[#d6b9a3] bg-[#f3e5d5] px-3 py-2 text-right">
            <div className="text-[9px] uppercase tracking-[0.24em] text-[#9a7068]">Qtd</div>
            <div className="text-xl font-black text-[#6b3141]">x{quantity}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${getRarityColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</span>
          <span className="rounded-full border border-[#d6b9a3] bg-[#f3e5d5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7f5b56]"><ItemTypeLabel type={item.type} /></span>
          {item.source && <span className="rounded-full border border-[#d0b58a] bg-[#efe4c9] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#8d5e29]">{item.source}</span>}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[#7f5b56]">{item.description}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#d6b9a3] bg-[#f7ecdf] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">Poder</div>
            <div className="mt-2 text-2xl font-black text-[#49774c]">+{item.value}</div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f5b56]">{getItemPowerLabel(item)}</div>
          </div>
          <div className="rounded-2xl border border-[#d6b9a3] bg-[#f7ecdf] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068]">Uso</div>
            <div className="mt-2 text-sm font-bold text-[#6b3141]">{item.type === 'material' ? 'Craft, troca e progresso' : item.type === 'potion' ? 'Consumivel em combate' : 'Equipamento permanente'}</div>
          </div>
        </div>

        {item.type !== 'material' && (
          <button
            onClick={() => onAction(item)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7d3d4d] bg-[#6b3141] px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-[#f7eadf] transition-all hover:-translate-y-0.5 hover:bg-[#7a3d4d]"
          >
            {item.type === 'potion' ? <FlaskConical size={18} /> : <Shield size={18} />}
            {item.type === 'potion' ? 'Usar Item' : 'Equipar Agora'}
          </button>
        )}
      </RpgMenuPanel>
    </div>
  );
};

export const InventoryScreen = ({ player, shopItems, onClose, onEquip, onUse }: InventoryScreenProps) => {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileDetailItemId, setMobileDetailItemId] = useState<string | null>(null);

  const inventoryItems = useMemo(() => {
    return Object.entries(player.inventory)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const item = shopItems.find((entry) => entry.id === id);
        return item ? { item, quantity } : null;
      })
      .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry));
  }, [player.inventory, shopItems]);

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

  const selectedEntry = filteredItems.find(({ item }) => item.id === selectedItemId) ?? null;
  const mobileEntry = filteredItems.find(({ item }) => item.id === mobileDetailItemId) ?? null;

  const handleAction = (item: Item) => {
    if (item.type === 'potion') {
      onUse(item.id);
      return;
    }

    if (item.type !== 'material') {
      onEquip(item);
    }
  };

  const equippedItems = [player.equippedWeapon, player.equippedShield, player.equippedHelmet, player.equippedArmor, player.equippedLegs].filter(Boolean) as Item[];

  return (
    <RpgMenuShell
      title="Inventario"
      subtitle="Mochila do aventureiro"
      onClose={onClose}
      accent="gold"
      valueBadge={<span className="inline-flex items-center gap-2.5"><GameAssetIcon name="bag" size={24} /> {inventoryItems.reduce((sum, entry) => sum + entry.quantity, 0)} itens</span>}
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(21rem,27rem)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-4">
          <RpgMenuPanel className="rounded-[24px] p-4">
            <RpgMenuSectionTitle>Filtros</RpgMenuSectionTitle>
            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((entry) => (
                <RpgMenuTab key={entry.id} active={filter === entry.id} onClick={() => setFilter(entry.id)} className="inline-flex items-center gap-2">
                  {entry.icon}
                  {entry.label}
                </RpgMenuTab>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              <RpgMenuStat label="Itens" value={inventoryItems.reduce((sum, entry) => sum + entry.quantity, 0)} />
              <RpgMenuStat label="Tipos" value={new Set(inventoryItems.map((entry) => entry.item.type)).size} />
              <RpgMenuStat label="Equipados" value={equippedItems.length} />
              <RpgMenuStat label="Filtro" value={FILTERS.find((entry) => entry.id === filter)?.label} />
            </div>
          </RpgMenuPanel>

          <RpgMenuPanel className="rounded-[24px] p-4">
            <RpgMenuSectionTitle>Equipamento atual</RpgMenuSectionTitle>
            <div className="mt-4 grid grid-cols-5 gap-2">
                      {[
                        { label: 'Arma', icon: slotIcons.weapon, item: player.equippedWeapon },
                        { label: 'Escudo', icon: slotIcons.shield, item: player.equippedShield },
                        { label: 'Capacete', icon: slotIcons.helmet, item: player.equippedHelmet },
                        { label: 'Armadura', icon: slotIcons.armor, item: player.equippedArmor },
                        { label: 'Pernas', icon: slotIcons.legs, item: player.equippedLegs },
                      ].map((slot) => (
                        <div key={slot.label} className={`flex h-16 items-center justify-center rounded-2xl border ${slot.item ? `${getRarityColor(slot.item.rarity)} bg-[#f4e5d4]` : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67]'}`}>
                          {slot.item ? <span className="text-2xl">{slot.item.icon}</span> : slot.icon}
                        </div>
                      ))}
            </div>
          </RpgMenuPanel>

          <ScrollArea className="min-h-0 flex-1 rounded-[24px] border border-[#c59d82] bg-[#f4e7d5] shadow-[0_8px_26px_rgba(107,49,65,0.08)]" viewportClassName="p-4">
                    <div className="grid gap-3">
                      {filteredItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#c59d82] bg-[#f8eddf] px-4 py-10 text-center text-sm text-[#8f6c67]">
                          Nenhum item encontrado nesse filtro.
                        </div>
                      ) : (
                        filteredItems.map(({ item, quantity }) => {
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
                                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9a7068]"><ItemTypeLabel type={item.type} /></div>
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
          <ItemDetailCard item={selectedEntry?.item ?? null} quantity={selectedEntry?.quantity ?? 0} onAction={handleAction} />
        </section>
      </div>

        {mobileEntry && (
          <div className="absolute inset-0 z-20 bg-[rgba(40,20,25,0.36)] backdrop-blur md:hidden" onClick={() => setMobileDetailItemId(null)}>
            <div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#c59d82] bg-[#6b3141] px-4 py-3 text-[#f7eadf]">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em]"><ArrowLeft size={16} /> Detalhes do item</h3>
                <button onClick={() => setMobileDetailItemId(null)} className="rounded-xl border border-white/15 bg-white/10 p-2 transition-opacity hover:opacity-80"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ItemDetailCard item={mobileEntry.item} quantity={mobileEntry.quantity} onAction={(item) => { handleAction(item); setMobileDetailItemId(null); }} />
              </div>
            </div>
          </div>
        )}
    </RpgMenuShell>
  );
};