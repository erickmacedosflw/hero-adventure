import React from 'react';
import { TowerSanctuaryOption, TowerSanctuaryOptionKind } from '../../types';

// ─── Option kind meta ─────────────────────────────────────────────────────────

const KIND_BADGE: Record<TowerSanctuaryOptionKind, { label: string; color: string }> = {
  heal:     { label: 'Seguro',    color: 'text-emerald-400 border-emerald-700/50 bg-emerald-900/20' },
  card:     { label: 'Build',     color: 'text-purple-400 border-purple-700/50 bg-purple-900/20'   },
  merchant: { label: 'Variável',  color: 'text-amber-400 border-amber-700/50 bg-amber-900/20'      },
  gold:     { label: 'Variável',  color: 'text-amber-400 border-amber-700/50 bg-amber-900/20'      },
  relic:    { label: 'Variável',  color: 'text-fuchsia-400 border-fuchsia-700/50 bg-fuchsia-900/20'},
  tradeoff: { label: 'Variável',  color: 'text-orange-400 border-orange-700/50 bg-orange-900/20'   },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TowerSanctuaryScreenProps {
  floor: number;
  act: number;
  options: TowerSanctuaryOption[];
  onChoose: (option: TowerSanctuaryOption) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TowerSanctuaryScreen: React.FC<TowerSanctuaryScreenProps> = ({
  floor,
  act,
  options,
  onChoose,
}) => {
  return (
    <div className="relative min-h-screen bg-[#0a0c10] text-slate-100 flex flex-col">
      {/* Atmospheric background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative px-6 pt-10 pb-6 text-center">
        <div className="text-4xl mb-3">🏛️</div>
        <h1 className="text-2xl font-bold text-amber-400 tracking-wide">Santuário</h1>
        <p className="text-slate-400 text-sm mt-1">
          Andar {floor} — Ato {act} concluído
        </p>
        <p className="text-slate-500 text-xs mt-2">
          Escolha uma bênção antes de continuar
        </p>
      </div>

      {/* Options */}
      <div className="relative flex-1 px-4 pb-8 flex flex-col gap-4 max-w-sm mx-auto w-full">
        {options.map((option) => {
          const badge = KIND_BADGE[option.kind] ?? KIND_BADGE.gold;
          return (
            <button
              key={option.id}
              onClick={() => onChoose(option)}
              className="w-full text-left rounded-2xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-600 transition-all active:scale-[0.98] overflow-hidden shadow-lg"
            >
              <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <span className="text-4xl flex-shrink-0">{option.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-slate-100">{option.label}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{option.description}</p>

                    {/* Inline effect preview */}
                    {option.healPercent !== undefined && (
                      <div className="mt-2 text-xs text-emerald-400 font-medium">
                        ❤️ Recupera {option.healPercent}% do HP máximo
                      </div>
                    )}
                    {option.goldAmount !== undefined && option.goldAmount > 0 && (
                      <div className="mt-2 text-xs text-amber-400 font-medium">
                        💰 +{option.goldAmount} ouro
                      </div>
                    )}
                    {option.tradeHpForAtk !== undefined && (
                      <div className="mt-2 text-xs text-orange-400 font-medium">
                        🩸 -{option.tradeHpForAtk} HP máx → +12 ATK
                      </div>
                    )}
                    {option.cardId && (
                      <div className="mt-2 text-xs text-purple-400 font-medium">
                        🃏 Recebe carta de corrida
                      </div>
                    )}
                    {option.relicCardId && (
                      <div className="mt-2 text-xs text-fuchsia-400 font-medium">
                        🔮 Relíquia especial temporária
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
