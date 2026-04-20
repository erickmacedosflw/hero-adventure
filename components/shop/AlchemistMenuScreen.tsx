import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Coins, Crosshair, FlaskConical, Heart, Sparkles, X } from 'lucide-react';
import { AlchemistCardOffer, AlchemistItemOffer, Item, Player, ProgressionCard, Rarity } from '../../types';
import { SKILLS } from '../../constants';
import { GameAssetIcon } from '../ui/game-asset-icon';

const ALCHEMIST_BG_URL = new URL('../../game/assets/Imagens/Background_Alquimista.png', import.meta.url).href;
const ALCHEMIST_AVATAR_URL = new URL('../../game/assets/Avatares/Personagem_Alquimista.png', import.meta.url).href;

// ── Card effect helpers (self-contained, mirroring GameUI.tsx) ────────────────

const PERCENT_CARD_EFFECT_TYPES = new Set([
  'gold_gain_multiplier',
  'xp_gain_multiplier',
  'boss_damage_multiplier',
  'heal_multiplier',
  'opening_atk_buff',
  'opening_def_buff',
  'defend_mana_restore',
]);

const CARD_PERCENT_BY_RARITY: Record<Rarity, number> = {
  bronze: 0.04,
  silver: 0.05,
  gold: 0.07,
};

const OPENING_COMBAT_BOOST_BY_RARITY: Record<Rarity, number> = {
  bronze: 0.1,
  silver: 0.15,
  gold: 0.2,
};

const getScaledEffectValue = (card: ProgressionCard, effect: ProgressionCard['effects'][number]) => {
  if (effect.type === 'opening_atk_buff' || effect.type === 'opening_def_buff') {
    return OPENING_COMBAT_BOOST_BY_RARITY[card.rarity];
  }
  if (PERCENT_CARD_EFFECT_TYPES.has(effect.type)) {
    return CARD_PERCENT_BY_RARITY[card.rarity];
  }
  return effect.value;
};

const getCardRarityLabel = (rarity: Rarity) => {
  if (rarity === 'bronze') return 'Comum';
  if (rarity === 'silver') return 'Rara';
  return 'Lendária';
};

const getCardRarityColor = (rarity: Rarity) => {
  if (rarity === 'bronze') return 'text-[#b88956]';
  if (rarity === 'silver') return 'text-slate-400';
  return 'text-amber-400';
};

const getCardRarityBorder = (rarity: Rarity) => {
  if (rarity === 'bronze') return 'border-[#b88956]';
  if (rarity === 'silver') return 'border-slate-400';
  return 'border-amber-400';
};

const getCardRarityGlow = (rarity: Rarity) => {
  if (rarity === 'bronze') return 'shadow-[0_0_14px_rgba(184,137,86,0.35)]';
  if (rarity === 'silver') return 'shadow-[0_0_14px_rgba(148,163,184,0.35)]';
  return 'shadow-[0_0_18px_rgba(251,191,36,0.5)]';
};

const getCategoryBadge = (card: ProgressionCard) => {
  if (card.category === 'economia') return { icon: <Coins size={12} />, label: 'Economia', color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' };
  if (card.category === 'atributo') return { icon: <Heart size={12} />, label: 'Atributos', color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' };
  if (card.category === 'batalha') return { icon: <Crosshair size={12} />, label: 'Combate', color: 'text-rose-400 border-rose-400/30 bg-rose-400/10' };
  return { icon: <Sparkles size={12} />, label: 'Especial', color: 'text-sky-400 border-sky-400/30 bg-sky-400/10' };
};

const describeCardEffects = (card: ProgressionCard): string[] =>
  card.effects.map((effect) => {
    const sv = getScaledEffectValue(card, effect);
    const value = Number.isInteger(sv) ? sv : `${Math.round(sv * 100)}%`;
    const skillName = effect.skillId ? SKILLS.find((s) => s.id === effect.skillId)?.name : null;
    switch (effect.type) {
      case 'gold_instant': return `+${value} Ouro agora`;
      case 'xp_instant': return `+${value} XP agora`;
      case 'max_hp': return `+${value} Vida máxima`;
      case 'max_mp': return `+${value} Mana máxima`;
      case 'atk': return `+${value} Ataque`;
      case 'magic': return `+${value} Magia`;
      case 'def': return `+${value} Defesa`;
      case 'speed': return `+${value} Velocidade`;
      case 'luck': return `+${value} Sorte`;
      case 'gold_gain_multiplier': return `+${value} de ouro por batalha`;
      case 'xp_gain_multiplier': return `+${value} de XP por batalha`;
      case 'boss_damage_multiplier': return `+${value} de dano contra chefes`;
      case 'heal_multiplier': return `+${value} de cura em habilidades`;
      case 'opening_atk_buff': return `Buff inicial de ataque: +${value}`;
      case 'opening_def_buff': return `Buff inicial de defesa: +${value}`;
      case 'defend_mana_restore': return `Recupera +${value} de mana ao defender`;
      case 'counter_attack_chance_bonus': return `+${value} de chance de contra-ataque`;
      case 'opening_counter_attack_boost': return `+${value} de contra-ataque nos 2 primeiros turnos`;
      case 'hp_regen_per_turn': return `Regenera ${value} HP por turno`;
      case 'mp_regen_per_turn': return `Regenera ${value} MP por turno`;
      case 'unlock_skill': return skillName ? `Desbloqueia: ${skillName}` : 'Desbloqueia habilidade';
      default: return card.description;
    }
  });

const getRelicMeta = (item: Item) => {
  if (item.id === 'pot_dg_recall') {
    return {
      badge: 'Extração',
      lines: [
        'Fuga estável da dungeon sem perder ouro, XP, diamantes ou drops acumulados.',
        'Ao usar, abre a tela de espólio resgatado.',
      ],
      footer: 'Vai para o inventário e pode ser usada durante a dungeon.',
    };
  }
  if (item.id === 'pot_alc_phantom_veil') {
    return {
      badge: 'Combate',
      lines: [
        'Ativa evasão perfeita: ignora ataques inimigos por 4 turnos.',
        'Duração diminui a cada turno inimigo, mesmo com golpe falho.',
      ],
      footer: 'Vai para o inventário e pode ser usada em qualquer batalha.',
    };
  }
  if (item.id === 'pot_alc_twin_fang') {
    return {
      badge: 'Ofensiva',
      lines: [
        'O comando Atacar desfere dois golpes seguidos por 6 turnos.',
        'Habilidades físicas também são repetidas uma segunda vez sem custo extra.',
      ],
      footer: 'Vai para o inventário e pode ser usada em qualquer batalha.',
    };
  }
  return {
    badge: 'Relíquia',
    lines: [item.description],
    footer: 'Vai para o inventário ao ser comprada.',
  };
};

// ── Types ────────────────────────────────────────────────────────────────────

type ActiveOffer =
  | { kind: 'card'; offer: AlchemistCardOffer }
  | { kind: 'item'; offer: AlchemistItemOffer };

// ── Offer detail modal ────────────────────────────────────────────────────────

const OfferDetailModal: React.FC<{
  activeOffer: ActiveOffer;
  player: Player;
  closing: boolean;
  onClose: () => void;
  onBuyCard: (offer: AlchemistCardOffer) => void;
  onBuyItem: (offer: AlchemistItemOffer) => void;
}> = ({ activeOffer, player, closing, onClose, onBuyCard, onBuyItem }) => {
  const overlayClass = closing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in';
  const panelClass = closing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in';

  if (activeOffer.kind === 'card') {
    const { offer } = activeOffer;
    const alreadyOwned = player.chosenCards.includes(offer.card.id);
    const canAfford = player.diamonds >= offer.cost;
    const hasLevel = player.level >= offer.card.minLevel;
    const effectLines = describeCardEffects(offer.card);
    const category = getCategoryBadge(offer.card);
    const canBuy = !alreadyOwned && canAfford && hasLevel;

    return (
      <div
        className={`absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm ${overlayClass}`}
        onClick={onClose}
      >
        <div
          className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-[28px] border border-white/10 bg-[#0d1117] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden ${panelClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-5 pt-5 pb-3">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 pr-10">
              <span className="text-[44px] leading-none shrink-0">📜</span>
              <div className="min-w-0">
                <h2 className="text-xl font-black text-white leading-tight">{offer.card.name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${category.color}`}>
                    {category.icon}{category.label}
                  </span>
                  <span className={`text-[11px] font-black uppercase tracking-wide ${getCardRarityColor(offer.card.rarity)}`}>
                    {getCardRarityLabel(offer.card.rarity)}
                  </span>
                  <span className="text-[10px] text-white/40 font-semibold">Nível {offer.card.minLevel}</span>
                </div>
              </div>
            </div>

            {/* Diamond cost bar */}
            <div className="mt-4 flex items-center justify-between rounded-[16px] border border-cyan-400/20 bg-cyan-400/8 px-4 py-3">
              <span className="text-xs font-black uppercase tracking-widest text-white/50">Custo</span>
              <span className="inline-flex items-center gap-1.5 text-lg font-black text-cyan-300">
                <GameAssetIcon name="diamond" size={20} />
                {offer.cost}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-3" data-scrollable>
            <p className="text-sm leading-relaxed text-white/60">{offer.card.description}</p>

            {effectLines.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {effectLines.map((line) => (
                  <div key={line} className="rounded-[14px] border border-white/8 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80">
                    {line}
                  </div>
                ))}
              </div>
            )}

            {alreadyOwned && (
              <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-400">
                <Sparkles size={14} /> Carta já comprada
              </div>
            )}
            {!hasLevel && !alreadyOwned && (
              <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-400">
                <AlertTriangle size={14} /> Requer nível {offer.card.minLevel}
              </div>
            )}
            {!canAfford && !alreadyOwned && hasLevel && (
              <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-slate-400/20 bg-slate-400/10 px-3 py-2 text-xs font-semibold text-slate-400">
                <AlertTriangle size={14} /> Diamantes insuficientes
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/8 bg-black/20 px-5 py-4">
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => { if (!canBuy) return; onBuyCard(offer); onClose(); }}
                disabled={!canBuy}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/60 bg-cyan-600 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GameAssetIcon name="diamond" size={18} />
                {alreadyOwned ? 'Já comprada' : !hasLevel ? `Nível ${offer.card.minLevel}` : !canAfford ? 'Sem diamantes' : `Comprar — ${offer.cost}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Relic branch
  const { offer } = activeOffer;
  const canAfford = player.diamonds >= offer.cost;
  const hasLevel = player.level >= offer.item.minLevel;
  const ownedQty = player.inventory[offer.item.id] ?? 0;
  const relicMeta = getRelicMeta(offer.item);
  const canBuy = canAfford && hasLevel;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm ${overlayClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-[28px] border border-white/10 bg-[#0d1117] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden ${panelClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 px-5 pt-5 pb-3">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-3 pr-10">
            <span className="text-[44px] leading-none shrink-0 [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_12px_rgba(255,255,255,0.4)]">
              {offer.item.icon}
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white leading-tight">{offer.item.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  <Sparkles size={10} />{relicMeta.badge}
                </span>
                {ownedQty > 0 && (
                  <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                    x{ownedQty} no inventário
                  </span>
                )}
                <span className="text-[10px] text-white/40 font-semibold">Nível {offer.item.minLevel}</span>
              </div>
            </div>
          </div>

          {/* Diamond cost bar */}
          <div className="mt-4 flex items-center justify-between rounded-[16px] border border-cyan-400/20 bg-cyan-400/8 px-4 py-3">
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Custo</span>
            <span className="inline-flex items-center gap-1.5 text-lg font-black text-cyan-300">
              <GameAssetIcon name="diamond" size={20} />
              {offer.cost}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-3" data-scrollable>
          <p className="text-sm leading-relaxed text-white/60">{offer.item.description}</p>

          <div className="mt-3 grid grid-cols-1 gap-2">
            {relicMeta.lines.map((line) => (
              <div key={line} className="rounded-[14px] border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-sm font-semibold text-cyan-100/80">
                {line}
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-white/30 font-semibold">{relicMeta.footer}</p>

          {!hasLevel && (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-400">
              <AlertTriangle size={14} /> Requer nível {offer.item.minLevel}
            </div>
          )}
          {!canAfford && hasLevel && (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-slate-400/20 bg-slate-400/10 px-3 py-2 text-xs font-semibold text-slate-400">
              <AlertTriangle size={14} /> Diamantes insuficientes
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 bg-black/20 px-5 py-4">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/10 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={() => { if (!canBuy) return; onBuyItem(offer); onClose(); }}
              disabled={!canBuy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/60 bg-cyan-600 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <GameAssetIcon name="diamond" size={18} />
              {!hasLevel ? `Nível ${offer.item.minLevel}` : !canAfford ? 'Sem diamantes' : `Comprar — ${offer.cost}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Card thumbnail ────────────────────────────────────────────────────────────

const CardOfferCard: React.FC<{
  offer: AlchemistCardOffer;
  player: Player;
  isSelected: boolean;
  onClick: () => void;
}> = ({ offer, player, isSelected, onClick }) => {
  const alreadyOwned = player.chosenCards.includes(offer.card.id);
  const canAfford = player.diamonds >= offer.cost;
  const hasLevel = player.level >= offer.card.minLevel;
  const category = getCategoryBadge(offer.card);

  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 w-[130px] flex flex-col rounded-[20px] border-2 bg-black/50 backdrop-blur-md p-3 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 ${getCardRarityBorder(offer.card.rarity)} ${alreadyOwned ? 'opacity-50' : isSelected ? `ring-2 ring-white/30 ${getCardRarityGlow(offer.card.rarity)}` : 'opacity-85 hover:opacity-100'}`}
    >
      {alreadyOwned && (
        <span className="absolute left-2 top-2 z-10 rounded-full border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-400">✓ Obtida</span>
      )}

      <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center">
        <span className="text-[38px] leading-none">📜</span>
      </div>

      <div className="mt-2 text-center text-[11px] font-black leading-tight text-white line-clamp-2 min-h-[2rem]">
        {offer.card.name}
      </div>

      <div className={`mt-1 text-center text-[9px] font-black uppercase tracking-widest ${getCardRarityColor(offer.card.rarity)}`}>
        {getCardRarityLabel(offer.card.rarity)}
      </div>

      <div className={`mt-1 inline-flex items-center justify-center gap-0.5 w-full rounded-full border px-2 py-0.5 text-[9px] font-black ${category.color}`}>
        {category.icon}{category.label}
      </div>

      <div className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border py-1 text-[10px] font-black ${alreadyOwned || !canAfford || !hasLevel ? 'border-white/10 bg-white/5 text-white/30' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'}`}>
        <GameAssetIcon name="diamond" size={12} />
        {alreadyOwned ? 'Obtida' : !hasLevel ? `Nv.${offer.card.minLevel}` : offer.cost}
      </div>
    </button>
  );
};

// ── Relic thumbnail ───────────────────────────────────────────────────────────

const RelicOfferCard: React.FC<{
  offer: AlchemistItemOffer;
  player: Player;
  isSelected: boolean;
  onClick: () => void;
}> = ({ offer, player, isSelected, onClick }) => {
  const canAfford = player.diamonds >= offer.cost;
  const hasLevel = player.level >= offer.item.minLevel;
  const ownedQty = player.inventory[offer.item.id] ?? 0;
  const relicMeta = getRelicMeta(offer.item);

  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 w-[130px] flex flex-col rounded-[20px] border-2 border-cyan-400/50 bg-black/50 backdrop-blur-md p-3 text-left transition-all duration-200 hover:-translate-y-1 active:scale-95 ${isSelected ? 'ring-2 ring-cyan-400/30 shadow-[0_0_16px_rgba(34,211,238,0.3)]' : 'opacity-85 hover:opacity-100'}`}
    >
      {ownedQty > 0 && (
        <span className="absolute left-2 top-2 z-10 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-400">x{ownedQty}</span>
      )}

      <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center">
        <span className="text-[38px] leading-none [text-shadow:0_2px_0_#fff,0_-2px_0_#fff,2px_0_0_#fff,-2px_0_0_#fff,0_0_10px_rgba(255,255,255,0.4)]">
          {offer.item.icon}
        </span>
      </div>

      <div className="mt-2 text-center text-[11px] font-black leading-tight text-white line-clamp-2 min-h-[2rem]">
        {offer.item.name}
      </div>

      <div className="mt-1 text-center text-[9px] font-black uppercase tracking-widest text-cyan-400">
        {relicMeta.badge}
      </div>

      <div className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border py-1 text-[10px] font-black ${!canAfford || !hasLevel ? 'border-white/10 bg-white/5 text-white/30' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'}`}>
        <GameAssetIcon name="diamond" size={12} />
        {!hasLevel ? `Nv.${offer.item.minLevel}` : offer.cost}
      </div>
    </button>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────

export const AlchemistScreen: React.FC<{
  player: Player;
  offers: AlchemistCardOffer[];
  itemOffers: AlchemistItemOffer[];
  onBuyCard: (offer: AlchemistCardOffer) => void;
  onBuyItem: (offer: AlchemistItemOffer) => void;
  onLeave: () => void;
}> = ({ player, offers, itemOffers, onBuyCard, onBuyItem, onLeave }) => {
  const MODAL_CLOSE_MS = 180;
  type Tab = 'card' | 'item';
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!document.getElementById('shop-anim-style')) {
      const s = document.createElement('style');
      s.id = 'shop-anim-style';
      s.textContent = '@keyframes avatar-fade-in{0%{opacity:0}100%{opacity:1}}';
      document.head.appendChild(s);
    }
    const t = window.setTimeout(() => setMounted(true), 20);
    return () => window.clearTimeout(t);
  }, []);
  const [tab, setTab] = useState<Tab>(offers.length > 0 ? 'card' : 'item');
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  const [modalClosing, setModalClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  // Auto-switch tab if one side becomes empty
  useEffect(() => {
    if (tab === 'card' && offers.length === 0 && itemOffers.length > 0) setTab('item');
    if (tab === 'item' && itemOffers.length === 0 && offers.length > 0) setTab('card');
  }, [tab, offers.length, itemOffers.length]);

  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current); }, []);

  const openOffer = (offer: ActiveOffer) => {
    setModalClosing(false);
    setActiveOffer(offer);
  };

  const closeOffer = () => {
    if (!activeOffer || modalClosing) return;
    setModalClosing(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setActiveOffer(null);
      setModalClosing(false);
    }, MODAL_CLOSE_MS);
  };

  const handleBuyCard = (offer: AlchemistCardOffer) => { onBuyCard(offer); };
  const handleBuyItem = (offer: AlchemistItemOffer) => { onBuyItem(offer); };

  const TABS: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'card', label: 'Cartas', count: offers.length },
    { id: 'item', label: 'Relíquias', count: itemOffers.length },
  ];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${ALCHEMIST_BG_URL})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />

      {/* Alchemist avatar — anchored so ~40% of figure shows above bottom panel */}
      <img
        src={ALCHEMIST_AVATAR_URL}
        alt=""
        className="absolute bottom-[34%] md:bottom-[18%] left-1/2 -translate-x-1/2 z-[5] h-[90vh] md:h-[72vh] max-h-[640px] md:max-h-[480px] w-auto object-contain object-bottom pointer-events-none select-none"
        style={{
          filter:
            'drop-shadow(0 2px 6px rgba(0,0,0,0.9)) ' +
            'drop-shadow(0 8px 24px rgba(0,0,0,0.75)) ' +
            'drop-shadow(0 20px 60px rgba(0,0,0,0.55))',
          animation: mounted ? 'none' : 'avatar-fade-in 0.5s ease-out forwards',
        }}
      />

      {/* TOP BAR */}
      <header className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-white/8">
        <button
          onClick={onLeave}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className="flex items-center gap-2">
          <FlaskConical size={17} className="text-cyan-400 shrink-0" />
          <span className="text-base font-black uppercase tracking-[0.18em] text-white">Alquimista</span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-black text-cyan-300">
          <GameAssetIcon name="diamond" size={20} />
          {player.diamonds}
        </div>
      </header>

      {/* Spacer — background shows through here */}
      <div className="relative z-0 flex-1 min-h-0" />

      {/* BOTTOM PANEL */}
      <div className={`relative z-10 shrink-0 flex flex-col bg-black/65 backdrop-blur-xl border-t border-white/8 transition-transform duration-[320ms] ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}>

        {/* Tab filter row — icon only */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          {TABS.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`relative shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${active ? 'border-white bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.25)]' : 'border-white/25 bg-white/5 hover:border-white/50 hover:bg-white/10'}`}
              >
                {entry.id === 'card' ? <span className="text-[24px] leading-none">📜</span> : <FlaskConical size={24} />}
                {entry.count > 0 && (
                  <span className={`absolute -bottom-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[8px] font-black leading-none ${active ? 'bg-white text-black' : 'bg-white/20 text-white/60'}`}>
                    {entry.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active tab label */}
        <div className="px-4 pb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/55">
            {TABS.find(t => t.id === tab)?.label ?? ''}
          </span>
        </div>

        {/* Cards horizontal scroll */}
        <div className="flex items-stretch gap-3 overflow-x-auto px-4 pb-5 no-scrollbar min-h-[220px]" data-scrollable>
          {tab === 'card' ? (
            offers.length === 0 ? (
              <div className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/3 px-6 py-8 text-sm text-white/30">
                Nenhuma carta disponível.
              </div>
            ) : (
              offers.map((offer) => (
                <CardOfferCard
                  key={offer.id}
                  offer={offer}
                  player={player}
                  isSelected={activeOffer?.kind === 'card' && activeOffer.offer.id === offer.id}
                  onClick={() => openOffer({ kind: 'card', offer })}
                />
              ))
            )
          ) : (
            itemOffers.length === 0 ? (
              <div className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/3 px-6 py-8 text-sm text-white/30">
                Nenhuma relíquia disponível.
              </div>
            ) : (
              itemOffers.map((offer) => (
                <RelicOfferCard
                  key={offer.id}
                  offer={offer}
                  player={player}
                  isSelected={activeOffer?.kind === 'item' && activeOffer.offer.id === offer.id}
                  onClick={() => openOffer({ kind: 'item', offer })}
                />
              ))
            )
          )}
        </div>
      </div>

      {/* OFFER DETAIL MODAL */}
      {activeOffer && (
        <OfferDetailModal
          activeOffer={activeOffer}
          player={player}
          closing={modalClosing}
          onClose={closeOffer}
          onBuyCard={handleBuyCard}
          onBuyItem={handleBuyItem}
        />
      )}
    </div>
  );
};
