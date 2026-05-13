import React from 'react';
import { Coins, Crosshair, Heart, Sparkles } from 'lucide-react';
import { SKILLS } from '../../constants';
import type { CardCategory, CardEffectType, ProgressionCard, Rarity } from '../../types';

// ── Asset URLs ────────────────────────────────────────────────────────────────
const _icon = (file: string) => new URL(`../../game/assets/Icons/Cartas/${file}`, import.meta.url).href;

const EFFECT_ICON_MAP: Record<CardEffectType, string> = {
  atk:                           _icon('ataque.png'),
  opening_atk_buff:              _icon('buff_ataque.png'),
  opening_def_buff:              _icon('buff_defesa.png'),
  counter_attack_chance_bonus:   _icon('contra_atque.png'),
  opening_counter_attack_boost:  _icon('contra_atque.png'),
  heal_multiplier:               _icon('cura.png'),
  hp_regen_per_turn:             _icon('cura.png'),
  skill_cost_reduction:          _icon('cuto_habilidades.png'),
  boss_damage_multiplier:        _icon('dano_chefes.png'),
  magic_damage_multiplier:       _icon('dano_magico.png'),
  def:                           _icon('defesa_fisica.png'),
  magic_def:                     _icon('defesa_magica.png'),
  unlock_skill:                  _icon('habilidades.png'),
  max_hp:                        _icon('hp_vida.png'),
  max_mp:                        _icon('mana.png'),
  mp_regen_per_turn:             _icon('mana.png'),
  defend_mana_restore:           _icon('mano_defender.png'),
  gold_instant:                  _icon('ouro.png'),
  gold_gain_multiplier:          _icon('ouro.png'),
  magic:                         _icon('poder_magico.png'),
  luck:                          _icon('sorte.png'),
  speed:                         _icon('velocidade.png'),
  xp_instant:                    _icon('xp.png'),
  xp_gain_multiplier:            _icon('xp.png'),
};

const CATEGORY_BANNER_MAP: Record<CardCategory, string> = {
  atributo: _icon('Banner_Atributo.png'),
  batalha:  _icon('Banner_Batalha.png'),
  economia: _icon('Banner_Economia.png'),
  especial: _icon('Banner_Especial.png'),
};

export const getEffectIconUrl = (type: CardEffectType): string => EFFECT_ICON_MAP[type] ?? _icon('habilidades.png');
export const getCategoryBannerUrl = (category: CardCategory): string => CATEGORY_BANNER_MAP[category];

const CARD_PERCENT_BY_RARITY: Record<Rarity, number> = {
  bronze: 0.03,
  silver: 0.05,
  gold: 0.07,
};

const OPENING_COMBAT_BOOST_BY_RARITY: Record<Rarity, number> = {
  bronze: 0.1,
  silver: 0.15,
  gold: 0.2,
};

export const getScaledCardEffectValue = (
  card: ProgressionCard,
  effect: ProgressionCard['effects'][number],
) => {
  if (effect.type === 'opening_atk_buff' || effect.type === 'opening_def_buff') {
    return OPENING_COMBAT_BOOST_BY_RARITY[card.rarity];
  }

  if (PERCENT_CARD_EFFECT_TYPES.has(effect.type)) {
    return CARD_PERCENT_BY_RARITY[card.rarity];
  }

  return effect.value;
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
    case 'gold_gain_multiplier': return `+${value} ouro por luta`;
    case 'xp_gain_multiplier': return `+${value} XP por luta`;
    case 'boss_damage_multiplier': return `+${value} dano vs chefes`;
    case 'heal_multiplier': return `+${value} cura`;
    case 'opening_atk_buff': return `Comeca com +${value} ATK`;
    case 'opening_def_buff': return `Comeca com +${value} DEF`;
    case 'defend_mana_restore': return `Defender recupera +${value} mana`;
    case 'counter_attack_chance_bonus': return `+${value} contra-ataque`;
    case 'opening_counter_attack_boost': return `+${value} contra nos turnos iniciais`;
    case 'hp_regen_per_turn': return `Regenera ${value} HP por turno`;
    case 'mp_regen_per_turn': return `Regenera ${value} MP por turno`;
    case 'unlock_skill':
      return unlockEffect?.skillId
        ? (SKILLS.find((entry) => entry.id === unlockEffect.skillId)?.name
            ? `Libera ${SKILLS.find((entry) => entry.id === unlockEffect.skillId)?.name}`
            : 'Libera habilidade')
        : 'Libera habilidade';
    default:
      return card.description;
  }
};

export const describeCardEffect = (card: ProgressionCard) => {
  return card.effects.map((effect) => {
    const scaledValue = getScaledCardEffectValue(card, effect);
    const value = Number.isInteger(scaledValue) ? scaledValue : `${Math.round(scaledValue * 100)}%`;
    const skillName = effect.skillId ? SKILLS.find((skill) => skill.id === effect.skillId)?.name : null;

    switch (effect.type) {
      case 'gold_instant': return `+${value} Ouro agora`;
      case 'xp_instant': return `+${value} XP agora`;
      case 'max_hp': return `+${value} Vida maxima`;
      case 'max_mp': return `+${value} Mana maxima`;
      case 'atk': return `+${value} Ataque`;
      case 'magic': return `+${value} Magia`;
      case 'def': return `+${value} Defesa`;
      case 'magic_def': return `+${value} Defesa Mágica`;
      case 'speed': return `+${value} Velocidade`;
      case 'luck': return `+${value} Sorte`;
      case 'gold_gain_multiplier': return `+${value} de ouro por batalha`;
      case 'xp_gain_multiplier': return `+${value} de XP por batalha`;
      case 'boss_damage_multiplier': return `+${value} de dano contra chefes`;
      case 'heal_multiplier': return `+${value} de cura em habilidades e itens`;
      case 'magic_damage_multiplier': return `+${value} de dano mágico`;
      case 'skill_cost_reduction': return `-${value} de custo de mana das habilidades`;
      case 'opening_atk_buff': return `Buff inicial de ataque: +${value}`;
      case 'opening_def_buff': return `Buff inicial de defesa: +${value}`;
      case 'defend_mana_restore': return `Recupera +${value} de mana ao defender`;
      case 'counter_attack_chance_bonus': return `+${value} de chance de contra-ataque`;
      case 'opening_counter_attack_boost': return `+${value} de chance de contra nos 2 primeiros turnos`;
      case 'hp_regen_per_turn': return `Regenera ${value} HP a cada turno`;
      case 'mp_regen_per_turn': return `Regenera ${value} MP a cada turno`;
      case 'unlock_skill': return skillName ? `Desbloqueia habilidade: ${skillName}` : 'Desbloqueia nova habilidade';
      default: return card.description;
    }
  });
};

export const getCardCategoryBadge = (card: ProgressionCard) => {
  if (card.category === 'economia') {
    return { icon: <Coins size={14} />, label: 'Economia', color: 'text-amber-700 border-amber-300 bg-amber-100' };
  }

  if (card.category === 'atributo') {
    return { icon: <Heart size={14} />, label: 'Atributos', color: 'text-emerald-700 border-emerald-300 bg-emerald-100' };
  }

  if (card.category === 'batalha') {
    return { icon: <Crosshair size={14} />, label: 'Combate', color: 'text-rose-700 border-rose-300 bg-rose-100' };
  }

  return { icon: <Sparkles size={14} />, label: 'Especial', color: 'text-sky-700 border-sky-300 bg-sky-100' };
};

const PERCENT_CARD_EFFECT_TYPES = new Set([
  'gold_gain_multiplier',
  'xp_gain_multiplier',
  'boss_damage_multiplier',
  'heal_multiplier',
  'counter_attack_chance_bonus',
  'opening_counter_attack_boost',
]);
