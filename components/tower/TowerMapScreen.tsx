import React, { useState } from 'react';
import { ArrowLeft, Flame, Gift, Heart, Package, ShoppingCart, Skull, Swords, X, Zap } from 'lucide-react';
import {
  Item,
  Player,
  RunCard,
  TowerEvent,
  TowerEventOption,
  TowerFloorMap,
  TowerNode,
  TowerNodeType,
  TowerRunState,
} from '../../types';
import { getAvailableNodes } from '../../game/mechanics/towerEngine';

// ─── Node type display meta ───────────────────────────────────────────────────

const NODE_META: Record<TowerNodeType, { icon: string; label: string; color: string; bg: string }> = {
  [TowerNodeType.COMBAT]:  { icon: '⚔️', label: 'Combate',   color: 'text-red-400',    bg: 'bg-red-900/40 border-red-700/50'    },
  [TowerNodeType.ELITE]:   { icon: '💀', label: 'Elite',     color: 'text-orange-400', bg: 'bg-orange-900/40 border-orange-700/50' },
  [TowerNodeType.EVENT]:   { icon: '❓', label: 'Evento',    color: 'text-sky-400',    bg: 'bg-sky-900/40 border-sky-700/50'    },
  [TowerNodeType.CHEST]:   { icon: '🎁', label: 'Baú',       color: 'text-amber-400',  bg: 'bg-amber-900/40 border-amber-700/50' },
  [TowerNodeType.UPGRADE]: { icon: '🃏', label: 'Carta',     color: 'text-purple-400', bg: 'bg-purple-900/40 border-purple-700/50' },
  [TowerNodeType.SHOP]:    { icon: '🛒', label: 'Loja',      color: 'text-green-400',  bg: 'bg-green-900/40 border-green-700/50' },
  [TowerNodeType.HEAL]:    { icon: '💚', label: 'Cura',      color: 'text-emerald-400',bg: 'bg-emerald-900/40 border-emerald-700/50' },
  [TowerNodeType.RANDOM]:  { icon: '🎲', label: 'Aleatório', color: 'text-fuchsia-400',bg: 'bg-fuchsia-900/40 border-fuchsia-700/50' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TowerMapScreenProps {
  player: Player;
  towerRun: TowerRunState;
  // Inline event (resolved when player picks an event node)
  activeEvent: TowerEvent | null;
  // Inline card pick (resolved when player picks an upgrade node)
  cardOffer: RunCard[] | null;
  // Inline shop items
  shopItems: Item[] | null;
  onNodeSelect: (node: TowerNode) => void;
  onEventChoice: (option: TowerEventOption) => void;
  onCardPick: (card: RunCard) => void;
  onShopBuy: (item: Item) => void;
  onShopClose: () => void;
  onFlee: () => void; // abandon run
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const HPBar: React.FC<{ hp: number; maxHp: number }> = ({ hp, maxHp }) => {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

// ─── Event Modal ─────────────────────────────────────────────────────────────

const EventModal: React.FC<{
  event: TowerEvent;
  onChoice: (option: TowerEventOption) => void;
}> = ({ event, onChoice }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-sm bg-[#10141a] border border-sky-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-sky-800/50 flex items-center gap-3">
        <span className="text-3xl">{event.icon}</span>
        <div>
          <div className="font-bold text-sky-300 text-base">{event.title}</div>
          <div className="text-xs text-slate-400">Evento</div>
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{event.description}</p>
        <div className="space-y-2">
          {event.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onChoice(opt)}
              className="w-full text-left px-4 py-3 rounded-xl border border-sky-700/40 bg-sky-900/20 hover:bg-sky-900/50 transition-colors"
            >
              <div className="text-sm font-medium text-slate-100">{opt.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Card Pick Modal ──────────────────────────────────────────────────────────

const CARD_TYPE_COLOR: Record<string, string> = {
  attack:  'text-red-400',
  defense: 'text-blue-400',
  passive: 'text-green-400',
  special: 'text-purple-400',
};

const CardPickModal: React.FC<{
  cards: RunCard[];
  onPick: (card: RunCard) => void;
}> = ({ cards, onPick }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-sm bg-[#10141a] border border-purple-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-purple-800/50">
        <div className="font-bold text-purple-300 text-base">🃏 Escolha uma Carta</div>
        <div className="text-xs text-slate-400 mt-0.5">Permanece até o fim da run</div>
      </div>
      <div className="p-4 space-y-2">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => onPick(card)}
            className="w-full text-left px-4 py-3 rounded-xl border border-purple-700/40 bg-purple-900/20 hover:bg-purple-900/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{card.icon}</span>
              <span className="text-sm font-semibold text-slate-100">{card.name}</span>
              <span className={`ml-auto text-xs font-medium ${CARD_TYPE_COLOR[card.type] ?? 'text-slate-400'}`}>
                {card.type}
              </span>
            </div>
            <div className="text-xs text-slate-400">{card.description}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ─── Shop Modal ───────────────────────────────────────────────────────────────

const ShopModal: React.FC<{
  items: Item[];
  player: Player;
  onBuy: (item: Item) => void;
  onClose: () => void;
}> = ({ items, player, onBuy, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-sm bg-[#10141a] border border-green-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-green-800/50 flex items-center gap-2">
        <span className="font-bold text-green-300 text-base flex-1">🛒 Mercador da Torre</span>
        <span className="text-amber-400 text-sm font-semibold">💰 {player.gold}</span>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:bg-slate-700">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/40">
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-xs text-slate-400 truncate">{item.description}</div>
            </div>
            <button
              onClick={() => onBuy(item)}
              disabled={player.gold < item.cost}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                player.gold >= item.cost
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              💰 {item.cost}
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Floor Node Grid ──────────────────────────────────────────────────────────

const NodeCard: React.FC<{
  node: TowerNode;
  available: boolean;
  completed: boolean;
  onClick: () => void;
}> = ({ node, available, completed, onClick }) => {
  const meta = NODE_META[node.type];
  return (
    <button
      onClick={onClick}
      disabled={!available || completed}
      className={`
        relative flex flex-col items-center justify-center gap-1
        w-16 h-16 rounded-xl border text-center transition-all
        ${completed ? 'bg-slate-800/30 border-slate-700/30 opacity-40' : ''}
        ${available && !completed ? `${meta.bg} cursor-pointer hover:scale-105 active:scale-95 shadow-lg` : ''}
        ${!available && !completed ? 'bg-slate-800/20 border-slate-700/20 opacity-30 cursor-default' : ''}
      `}
    >
      <span className="text-xl">{completed ? '✓' : meta.icon}</span>
      <span className={`text-[10px] font-medium ${available ? meta.color : 'text-slate-500'}`}>
        {meta.label}
      </span>
    </button>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const TowerMapScreen: React.FC<TowerMapScreenProps> = ({
  player,
  towerRun,
  activeEvent,
  cardOffer,
  shopItems,
  onNodeSelect,
  onEventChoice,
  onCardPick,
  onShopBuy,
  onShopClose,
  onFlee,
}) => {
  const { currentFloorMap, floor, act, loop } = towerRun;
  const availableIds = new Set(getAvailableNodes(currentFloorMap).map(n => n.id));
  const allNodes = currentFloorMap.nodeColumns.flat();

  const hpPct = player.stats.maxHp > 0 ? Math.round((player.stats.hp / player.stats.maxHp) * 100) : 0;

  return (
    <>
      {/* Inline modals */}
      {activeEvent && <EventModal event={activeEvent} onChoice={onEventChoice} />}
      {cardOffer && <CardPickModal cards={cardOffer} onPick={onCardPick} />}
      {shopItems && <ShopModal items={shopItems} player={player} onBuy={onShopBuy} onClose={onShopClose} />}

      <div className="relative min-h-screen bg-[#0a0c10] text-slate-100 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0c10]/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div>
              <h1 className="text-base font-bold text-amber-400 leading-none">
                Andar {floor} — Ato {act}
                {loop > 0 && <span className="ml-1 text-orange-400 text-xs">(Loop {loop})</span>}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Escolha seu próximo nó</p>
            </div>
            <button
              onClick={onFlee}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-700/50 bg-red-900/20 text-red-400 text-xs hover:bg-red-900/40 transition-colors"
            >
              <ArrowLeft size={12} />
              Fugir
            </button>
          </div>
          {/* HP Bar */}
          <div className="flex items-center gap-2">
            <Heart size={12} className="text-red-400 flex-shrink-0" />
            <HPBar hp={player.stats.hp} maxHp={player.stats.maxHp} />
            <span className="text-xs text-slate-400 flex-shrink-0">
              {player.stats.hp}/{player.stats.maxHp}
            </span>
          </div>
        </div>

        {/* Cards in hand (run cards) */}
        {towerRun.runCards.length > 0 && (
          <div className="px-4 pt-3">
            <div className="text-xs text-slate-500 mb-1.5">Cartas ativas ({towerRun.runCards.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {towerRun.runCards.map(card => (
                <div
                  key={card.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-purple-700/40 bg-purple-900/20 text-xs"
                >
                  <span>{card.icon}</span>
                  <span className="text-purple-300">{card.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Floor Map Grid */}
        <div className="flex-1 px-4 py-4">
          <div className="flex gap-4 justify-center items-start overflow-x-auto pb-2">
            {currentFloorMap.nodeColumns.map((column, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-3 items-center flex-shrink-0">
                {/* Column label */}
                <span className="text-[10px] text-slate-600">
                  {colIdx === 0 ? 'Entrada' : colIdx === currentFloorMap.nodeColumns.length - 1 ? 'Boss' : `Coluna ${colIdx}`}
                </span>
                {column.map(node => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    available={availableIds.has(node.id)}
                    completed={node.completed}
                    onClick={() => onNodeSelect(node)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {(Object.entries(NODE_META) as [TowerNodeType, typeof NODE_META[TowerNodeType]][]).map(([, meta]) => (
              <div key={meta.label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/30 border border-slate-700/30">
                <span className="text-sm">{meta.icon}</span>
                <span className="text-[10px] text-slate-400">{meta.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — consumable quick info */}
        <div className="border-t border-slate-800 px-4 py-2 flex items-center gap-3">
          <Package size={12} className="text-slate-500" />
          <div className="flex gap-2">
            {towerRun.consumableSlots.map((slot, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${
                  slot.itemId ? 'border-slate-600 bg-slate-800/50 text-slate-300' : 'border-slate-700/30 bg-transparent text-slate-600'
                }`}
              >
                {slot.itemId ? `×${slot.quantity}` : '—'}
              </div>
            ))}
          </div>
          <div className="ml-auto text-xs text-slate-500">
            💰 {player.gold}
          </div>
        </div>
      </div>
    </>
  );
};
