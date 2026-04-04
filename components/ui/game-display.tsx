import React from 'react';
import { Crown, FlaskConical, Footprints, Shield, Shirt, Sparkles, Sword } from 'lucide-react';
import { SKILLS } from '../../constants';
import { Item, ProgressionCard, Rarity } from '../../types';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';

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

const getScaledCardEffectValue = (card: ProgressionCard, effect: ProgressionCard['effects'][number]) => {
  if (PERCENT_CARD_EFFECT_TYPES.has(effect.type)) {
    return CARD_PERCENT_BY_RARITY[card.rarity];
  }
  return effect.value;
};

export const getRarityColor = (rarity: Rarity) => {
  switch (rarity) {
    case 'bronze':
      return 'border-orange-700/50 text-orange-100 bg-gradient-to-r from-orange-900/20 to-transparent';
    case 'silver':
      return 'border-slate-400/50 text-slate-100 bg-gradient-to-r from-slate-800/50 to-transparent';
    case 'gold':
      return 'border-amber-400 text-amber-100 bg-gradient-to-r from-amber-900/40 to-transparent shadow-[inset_0_0_20px_rgba(251,191,36,0.1)]';
    default:
      return 'border-slate-700 text-white';
  }
};

export const getRarityLabel = (rarity: Rarity) => {
  if (rarity === 'bronze') return 'Comum';
  if (rarity === 'silver') return 'Raro';
  return 'Lendario';
};

export const ItemTypeIcon = ({ type, size = 14 }: { type: Item['type']; size?: number }) => {
  if (type === 'weapon') return <Sword size={size} />;
  if (type === 'shield') return <Shield size={size} />;
  if (type === 'helmet') return <Crown size={size} />;
  if (type === 'armor') return <Shirt size={size} />;
  if (type === 'legs') return <Footprints size={size} />;
  if (type === 'potion') return <FlaskConical size={size} />;
  return <Sparkles size={size} />;
};

export const ItemTypeLabel = ({ type }: { type: Item['type'] }) => {
  if (type === 'weapon') return <>Arma</>;
  if (type === 'shield') return <>Escudo</>;
  if (type === 'helmet') return <>Capacete</>;
  if (type === 'armor') return <>Armadura</>;
  if (type === 'legs') return <>Pernas</>;
  if (type === 'potion') return <>Consumivel</>;
  return <>Material</>;
};

export const getCardCategoryMeta = (card: ProgressionCard) => {
  if (card.category === 'economia') return { label: 'Economia', tone: 'text-amber-200 bg-amber-500/10 border-amber-400/20' };
  if (card.category === 'atributo') return { label: 'Atributo', tone: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/20' };
  if (card.category === 'batalha') return { label: 'Combate', tone: 'text-rose-200 bg-rose-500/10 border-rose-400/20' };
  return { label: 'Especial', tone: 'text-sky-200 bg-sky-500/10 border-sky-400/20' };
};

export const getCardEffectPreview = (card: ProgressionCard) => {
  const unlockEffect = card.effects.find((effect) => effect.type === 'unlock_skill');
  if (unlockEffect?.skillId) {
    const skill = SKILLS.find((entry) => entry.id === unlockEffect.skillId);
    return skill ? `Libera ${skill.name}` : 'Libera habilidade';
  }

  const primaryEffect = card.effects[0];
  if (!primaryEffect) {
    return card.description;
  }

  const primaryValue = getScaledCardEffectValue(card, primaryEffect);
  const value = Number.isInteger(primaryValue)
    ? primaryValue.toString()
    : `${Math.round(primaryValue * 100)}%`;

  switch (primaryEffect.type) {
    case 'gold_instant': return `+${value} ouro`;
    case 'xp_instant': return `+${value} XP`;
    case 'max_hp': return `+${value} vida maxima`;
    case 'max_mp': return `+${value} mana maxima`;
    case 'atk': return `+${value} ataque`;
    case 'magic': return `+${value} magia`;
    case 'def': return `+${value} defesa`;
    case 'speed': return `+${value} velocidade`;
    case 'luck': return `+${value} sorte`;
    case 'gold_gain_multiplier': return `+${value} ouro por batalha`;
    case 'xp_gain_multiplier': return `+${value} XP por batalha`;
    case 'boss_damage_multiplier': return `+${value} dano em chefes`;
    case 'heal_multiplier': return `+${value} cura`;
    case 'opening_atk_buff': return `+${value} ataque inicial`;
    case 'opening_def_buff': return `+${value} defesa inicial`;
    case 'defend_mana_restore': return `+${value} mana ao defender`;
    case 'hp_regen_per_turn': return `+${value} HP por turno`;
    case 'mp_regen_per_turn': return `+${value} MP por turno`;
    default: return card.description;
  }
};

export const getItemPowerLabel = (item: Item) => {
  if (item.type === 'weapon') {
    if ((item.magicBonus ?? 0) > 0) {
      return `+${item.value} ATK | +${item.magicBonus} MAG`;
    }
    return `+${item.value} ATK`;
  }
  if (item.type === 'potion' && !item.id.includes('pot_atk') && !item.id.includes('pot_def')) return `Recupera ${item.value}`;
  if (item.id.includes('pot_atk')) return `+${item.value * 100}% ATK`;
  if (item.id.includes('pot_def')) return `+${item.value * 100}% DEF`;
  if (item.type === 'material') return 'Ingrediente';
  if (item.type === 'legs') return `+${item.value} VEL`;

  const bonuses = getEquipmentBonuses(item);
  if (item.type === 'armor' && bonuses.maxMp > 0) return `+${bonuses.def} DEF | +${bonuses.maxMp} MP`;
  if (item.type === 'helmet' && bonuses.maxHp > 0) return `+${bonuses.def} DEF | +${bonuses.maxHp} HP`;
  return `+${item.value} DEF`;
};

export const isEquipmentType = (type: Item['type']) => ['weapon', 'armor', 'helmet', 'legs', 'shield'].includes(type);
