import React from 'react';
import { Award, Home, Package, Sword, TrendingUp } from 'lucide-react';
import { Item, RunCard, TowerRunRewards, TowerRunState } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TowerResultScreenProps {
  towerRun: TowerRunState;
  outcome: 'victory' | 'defeat' | 'withdrawal';
  // Optional: items acquired during run (for the "keep 1 item" optional mechanic on full clear)
  runItems: Item[];
  onReturnToHub: () => void;
  /** Only shown on full tower clear (floor 15+) */
  onKeepItem?: (item: Item) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARD_TYPE_COLOR: Record<string, string> = {
  attack:  'text-red-400',
  defense: 'text-blue-400',
  passive: 'text-green-400',
  special: 'text-purple-400',
};

const getRarityLabelColor = (rarity: Item['rarity']) => {
  if (rarity === 'bronze') return 'text-[#b88956]';
  if (rarity === 'silver') return 'text-slate-400';
  return 'text-amber-400';
};

// ─── Component ───────────────────────────────────────────────────────────────

export const TowerResultScreen: React.FC<TowerResultScreenProps> = ({
  towerRun,
  outcome,
  runItems,
  onReturnToHub,
  onKeepItem,
}) => {
  const { floor, act, loop, runCards, accumulatedRewards } = towerRun;
  const isVictory = outcome === 'victory';
  const isFullClear = floor >= 15 && isVictory;

  const outcomeConfig = {
    victory: {
      emoji: '🏆',
      title: 'Torre Conquistada!',
      subtitle: `Andar ${floor} — Ato ${act} completado`,
      titleColor: 'text-amber-400',
      bgAccent: 'from-amber-950/30',
    },
    defeat: {
      emoji: '💀',
      title: 'Derrota',
      subtitle: `Caído no Andar ${floor} — Ato ${act}`,
      titleColor: 'text-red-400',
      bgAccent: 'from-red-950/30',
    },
    withdrawal: {
      emoji: '🚪',
      title: 'Retirada',
      subtitle: `Fugiu no Andar ${floor} — Ato ${act}`,
      titleColor: 'text-slate-400',
      bgAccent: 'from-slate-950/30',
    },
  }[outcome];

  return (
    <div className="relative min-h-screen bg-[#0a0c10] text-slate-100 overflow-y-auto">
      {/* Atmospheric gradient */}
      <div className={`absolute inset-0 bg-gradient-to-b ${outcomeConfig.bgAccent} to-transparent pointer-events-none`} />

      {/* Header */}
      <div className="relative px-6 pt-10 pb-6 text-center">
        <div className="text-5xl mb-3">{outcomeConfig.emoji}</div>
        <h1 className={`text-2xl font-bold tracking-wide ${outcomeConfig.titleColor}`}>
          {outcomeConfig.title}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{outcomeConfig.subtitle}</p>
        {loop > 0 && (
          <p className="text-orange-400 text-xs mt-1">Loop {loop}</p>
        )}
      </div>

      <div className="relative max-w-sm mx-auto px-4 pb-8 space-y-4">

        {/* ── Rewards summary ──────────────────────────────────────────── */}
        <section className="bg-slate-900/60 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Award size={16} className="text-amber-400" />
            <span className="text-sm font-semibold">Recompensas</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-amber-400">+{accumulatedRewards.gold}</div>
              <div className="text-xs text-slate-500 mt-0.5">💰 Ouro</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">+{accumulatedRewards.xp}</div>
              <div className="text-xs text-slate-500 mt-0.5">⭐ XP</div>
            </div>
            <div className="text-center">
              <div className={`text-xl font-bold ${accumulatedRewards.essenceEarned > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
                +{accumulatedRewards.essenceEarned}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">🔮 Essência</div>
            </div>
          </div>

          {/* Drops */}
          {Object.keys(accumulatedRewards.drops).length > 0 && (
            <div className="px-4 pb-3">
              <div className="text-xs text-slate-500 mb-1.5">Drops</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(accumulatedRewards.drops).map(([itemId, qty]) => (
                  <span key={itemId} className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-800/50 text-slate-300">
                    {itemId} ×{qty}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <section className="bg-slate-900/60 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-400" />
            <span className="text-sm font-semibold">Estatísticas da Run</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-800/40 rounded-xl py-2 px-3 text-center">
              <div className="text-lg font-bold text-amber-400">{floor}</div>
              <div className="text-xs text-slate-500">Andar alcançado</div>
            </div>
            <div className="bg-slate-800/40 rounded-xl py-2 px-3 text-center">
              <div className="text-lg font-bold text-blue-400">{runCards.length}</div>
              <div className="text-xs text-slate-500">Cartas adquiridas</div>
            </div>
          </div>
        </section>

        {/* ── Cards acquired ────────────────────────────────────────────── */}
        {runCards.length > 0 && (
          <section className="bg-slate-900/60 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
              <Sword size={16} className="text-purple-400" />
              <span className="text-sm font-semibold">Cartas da Run</span>
            </div>
            <div className="p-3 space-y-1.5">
              {runCards.map(card => (
                <div key={card.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700">
                  <span className="text-lg">{card.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{card.name}</div>
                    <div className="text-xs text-slate-500">{card.description}</div>
                  </div>
                  <span className={`text-xs font-medium ${CARD_TYPE_COLOR[card.type] ?? 'text-slate-400'}`}>
                    {card.type}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Optional: Keep 1 item (full clear only) ───────────────────── */}
        {isFullClear && onKeepItem && runItems.length > 0 && (
          <section className="bg-slate-900/60 rounded-2xl border border-amber-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-700/30 flex items-center gap-2">
              <Package size={16} className="text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">Torres Conquistadas — Bônus</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 mb-3">
                Escolha um equipamento da Torre para levar de volta ao Hub:
              </p>
              <div className="space-y-2">
                {runItems.slice(0, 4).map(item => (
                  <button
                    key={item.id}
                    onClick={() => onKeepItem(item)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-amber-700/30 bg-amber-900/10 hover:bg-amber-900/25 transition-colors text-left"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-slate-400 truncate">{item.description}</div>
                    </div>
                    <span className={`text-xs ${getRarityLabelColor(item.rarity)}`}>
                      Manter
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Return CTA ───────────────────────────────────────────────── */}
        <button
          onClick={onReturnToHub}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-bold text-base tracking-wide shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Home size={18} />
          Retornar ao Hub
        </button>

        {!isVictory && (
          <p className="text-center text-xs text-slate-600">
            Equipamentos encontrados na Torre foram perdidos. Loadout do Hub restaurado.
          </p>
        )}
      </div>
    </div>
  );
};
