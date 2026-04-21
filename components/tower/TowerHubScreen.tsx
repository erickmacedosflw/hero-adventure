import React, { useState } from 'react';
import { ArrowLeft, Layers, Package, Shield, Sword, Zap } from 'lucide-react';
import { ConsumableSlot, Item, Player, TowerMeta } from '../../types';
import {
  TOWER_CONSUMABLE_SLOTS_BY_LEVEL,
  TOWER_CONSUMABLE_UPGRADE_COST,
  TOWER_MAX_CONSUMABLE_SLOT_LEVEL,
} from '../../constants';
import { createEmptyConsumableSlots } from '../../game/mechanics/towerEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getRarityBorder = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'border-[#b88956]';
  if (rarity === 'silver') return 'border-slate-400';
  return 'border-amber-400';
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

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TowerHubScreenProps {
  player: Player;
  towerMeta: TowerMeta;
  availableConsumables: Item[]; // potions/consumables available in player inventory
  onStartRun: (slots: ConsumableSlot[]) => void;
  onUpgradeSlots: () => void;
  onBack: () => void;
}

// ─── Slot selection state ────────────────────────────────────────────────────

interface SlotDraft {
  itemId: string | null;
  quantity: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TowerHubScreen: React.FC<TowerHubScreenProps> = ({
  player,
  towerMeta,
  availableConsumables,
  onStartRun,
  onUpgradeSlots,
  onBack,
}) => {
  const slotCount = TOWER_CONSUMABLE_SLOTS_BY_LEVEL[towerMeta.consumableSlotsLevel] ?? 3;
  const upgradeCost = TOWER_CONSUMABLE_UPGRADE_COST[towerMeta.consumableSlotsLevel + 1];
  const canUpgrade =
    towerMeta.consumableSlotsLevel < TOWER_MAX_CONSUMABLE_SLOT_LEVEL &&
    upgradeCost !== undefined &&
    towerMeta.essence >= upgradeCost;

  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    Array.from({ length: slotCount }, () => ({ itemId: null, quantity: 1 }))
  );

  // Ensure slots array length stays in sync if meta changes
  const effectiveSlots = slots.length === slotCount ? slots : Array.from({ length: slotCount }, (_, i) => slots[i] ?? { itemId: null, quantity: 1 });

  const setSlot = (index: number, patch: Partial<SlotDraft>) => {
    setSlots(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleStartRun = () => {
    const consumableSlots: ConsumableSlot[] = effectiveSlots.map(s => ({
      itemId: s.itemId,
      quantity: s.itemId ? Math.max(1, s.quantity) : 0,
      maxQuantity: 3,
    }));
    onStartRun(consumableSlots);
  };

  // ── Equipped gear display ──────────────────────────────────────────────────

  const gear: Array<{ label: string; item: Item | null; icon: React.ReactNode }> = [
    { label: 'Arma',     item: player.equippedWeapon,  icon: <Sword  size={14} className="text-slate-400" /> },
    { label: 'Armadura', item: player.equippedArmor,   icon: <Shield size={14} className="text-slate-400" /> },
    { label: 'Capacete', item: player.equippedHelmet,  icon: <Layers size={14} className="text-slate-400" /> },
    { label: 'Botas',    item: player.equippedLegs,    icon: <Zap    size={14} className="text-slate-400" /> },
    { label: 'Escudo',   item: player.equippedShield,  icon: <Package size={14} className="text-slate-400" /> },
  ];

  return (
    <div className="relative min-h-screen bg-[#0a0c10] text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0c10]/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-wide text-amber-400">TORRE</h1>
          <p className="text-xs text-slate-400">Prepare-se para a ascensão</p>
        </div>

        <div className="ml-auto flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700">
          <span className="text-purple-400 text-sm">🔮</span>
          <span className="text-sm font-semibold text-purple-300">{towerMeta.essence}</span>
          <span className="text-xs text-slate-400">Essência</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── Meta stats ────────────────────────────────────────────────── */}
        {(towerMeta.highestFloor > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
              <div className="text-2xl font-bold text-amber-400">{towerMeta.highestFloor}</div>
              <div className="text-xs text-slate-400 mt-0.5">Andar mais alto</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
              <div className="text-2xl font-bold text-amber-400">{towerMeta.highestLoop}</div>
              <div className="text-xs text-slate-400 mt-0.5">Loops completos</div>
            </div>
          </div>
        )}

        {/* ── Loadout / Equipped gear ────────────────────────────────────── */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Shield size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">Equipamento do Hub</span>
            <span className="ml-auto text-xs text-slate-500">(base da run)</span>
          </div>
          <div className="p-3 grid grid-cols-1 gap-2">
            {gear.map(({ label, item, icon }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${
                  item ? `bg-slate-800/50 ${getRarityBorder(item.rarity)}` : 'bg-slate-800/20 border-slate-700'
                }`}
              >
                <span className="text-base w-6 text-center">{item?.icon ?? '—'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="text-sm font-medium truncate">{item?.name ?? 'Nenhum'}</div>
                </div>
                {item && (
                  <span className={`text-xs ${getRarityLabelColor(item.rarity)}`}>
                    {getRarityLabel(item.rarity)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Consumable slots ──────────────────────────────────────────── */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Package size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">Consumíveis</span>
            <span className="ml-auto text-xs text-slate-500">{slotCount} slots</span>
          </div>
          <div className="p-3 space-y-2">
            {effectiveSlots.map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-5 text-right">{i + 1}.</span>
                <select
                  value={slot.itemId ?? ''}
                  onChange={e => setSlot(i, { itemId: e.target.value || null })}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">— Vazio —</option>
                  {availableConsumables.map(item => {
                    const qty = player.inventory[item.id] ?? 0;
                    if (qty < 1) return null;
                    return (
                      <option key={item.id} value={item.id}>
                        {item.icon} {item.name} (×{qty})
                      </option>
                    );
                  })}
                </select>
                {slot.itemId && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSlot(i, { quantity: Math.max(1, (slot.quantity) - 1) })}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-center text-sm leading-none"
                    >-</button>
                    <span className="text-sm w-4 text-center">{slot.quantity}</span>
                    <button
                      onClick={() => setSlot(i, { quantity: Math.min(3, (slot.quantity) + 1) })}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-center text-sm leading-none"
                    >+</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Meta upgrades ─────────────────────────────────────────────── */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <span className="text-purple-400 text-sm">🔮</span>
            <span className="text-sm font-semibold text-slate-200">Progressão Meta</span>
          </div>
          <div className="p-3 space-y-2">
            {/* Consumable slots upgrade */}
            <div className="flex items-center justify-between rounded-lg bg-slate-800/50 border border-slate-700 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Slots de Consumíveis</div>
                <div className="text-xs text-slate-400">
                  Nível {towerMeta.consumableSlotsLevel} → {slotCount} slots
                </div>
              </div>
              {towerMeta.consumableSlotsLevel < TOWER_MAX_CONSUMABLE_SLOT_LEVEL ? (
                <button
                  onClick={onUpgradeSlots}
                  disabled={!canUpgrade}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    canUpgrade
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="text-purple-300">🔮</span>
                  {upgradeCost}
                </button>
              ) : (
                <span className="text-xs text-amber-400 font-medium">Máximo</span>
              )}
            </div>
          </div>
        </section>

        {/* ── Player stats preview ──────────────────────────────────────── */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Sword size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">Stats de Entrada</span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {([
              { label: 'HP',  value: player.stats.maxHp, color: 'text-green-400'  },
              { label: 'MP',  value: player.stats.maxMp, color: 'text-blue-400'   },
              { label: 'ATK', value: player.stats.atk,   color: 'text-red-400'    },
              { label: 'DEF', value: player.stats.def,   color: 'text-slate-300'  },
              { label: 'VEL', value: player.stats.speed, color: 'text-yellow-400' },
              { label: 'MAG', value: player.stats.magic, color: 'text-purple-400' },
            ] as Array<{ label: string; value: number; color: string }>).map(({ label, value, color }) => (
              <div key={label} className="text-center bg-slate-800/50 rounded-lg py-2 px-1">
                <div className={`text-base font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Enter Tower CTA ───────────────────────────────────────────── */}
        <button
          onClick={handleStartRun}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-base tracking-wide shadow-lg shadow-orange-900/40 transition-all active:scale-[0.98]"
        >
          ⚔️ Entrar na Torre
        </button>

        <div className="pb-4 text-center text-xs text-slate-600">
          Equipamentos da torre são temporários. Você retorna com o loadout do Hub.
        </div>
      </div>
    </div>
  );
};
