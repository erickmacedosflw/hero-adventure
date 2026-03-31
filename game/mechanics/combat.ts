import { Player, StatusEffect, StatusEffectKind } from '../../types';

export type AttackKind = 'physical' | 'magic';

interface CalculateDamageInput {
  attackerAtk: number;
  defenderDef: number;
  attackerSpeed: number;
  defenderSpeed: number;
  defenderHasPerfectEvade?: boolean;
  multiplier?: number;
  luck?: number;
  attackKind?: AttackKind;
  defenderIsDefending?: boolean;
  attackerBuffs?: Player['buffs'];
  defenderBuffs?: Player['buffs'];
  applyAttackBuff?: boolean;
  applyDefenseBuff?: boolean;
  critChanceBonus?: number;
  critDamageBonus?: number;
  damageReduction?: number;
  defendMitigationBonus?: number;
}

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  evaded: boolean;
}

export interface StatusTickResult {
  nextStatuses: StatusEffect[];
  damage: number;
  logs: string[];
}

export const createEmptyBuffState = (): Player['buffs'] => ({
  atkMod: 0,
  defMod: 0,
  atkTurns: 0,
  defTurns: 0,
  perfectEvadeTurns: 0,
  doubleAttackTurns: 0,
  riposteTurns: 0,
  riposteArmed: false,
  counterChanceBoost: 0,
  counterChanceBoostTurns: 0,
});

export const consumeTurnBuffs = (buffs: Player['buffs']): Player['buffs'] => {
  const nextBuffs = { ...buffs };

  if (nextBuffs.atkTurns > 0) nextBuffs.atkTurns--;
  if (nextBuffs.defTurns > 0) nextBuffs.defTurns--;
  if (nextBuffs.perfectEvadeTurns > 0) nextBuffs.perfectEvadeTurns--;
  if (nextBuffs.doubleAttackTurns > 0) nextBuffs.doubleAttackTurns--;
  if (nextBuffs.counterChanceBoostTurns > 0) {
    nextBuffs.counterChanceBoostTurns--;
    if (nextBuffs.counterChanceBoostTurns <= 0) {
      nextBuffs.counterChanceBoost = 0;
    }
  }

  return nextBuffs;
};

export const getEvadeChance = (
  attackerSpeed: number,
  defenderSpeed: number,
  defenderHasPerfectEvade: boolean = false,
  attackKind: AttackKind = 'physical',
  defenderIsDefending: boolean = false,
) => {
  if (defenderHasPerfectEvade) {
    return 1;
  }

  const speedDelta = defenderSpeed - attackerSpeed;
  let evadeChance = 0.03 + (speedDelta * 0.01);

  if (defenderIsDefending) {
    evadeChance += 0.04;
  }

  if (attackKind === 'magic') {
    evadeChance *= 0.45;
  }

  const cap = attackKind === 'magic' ? 0.12 : 0.22;
  return Math.max(0.01, Math.min(cap, evadeChance));
};

export const calculateDamage = ({
  attackerAtk,
  defenderDef,
  attackerSpeed,
  defenderSpeed,
  defenderHasPerfectEvade = false,
  multiplier = 1,
  luck = 0,
  attackKind = 'physical',
  defenderIsDefending = false,
  attackerBuffs,
  defenderBuffs,
  applyAttackBuff = false,
  applyDefenseBuff = false,
  critChanceBonus = 0,
  critDamageBonus = 0,
  damageReduction = 0,
  defendMitigationBonus = 0,
}: CalculateDamageInput): DamageResult => {
  let finalAtk = attackerAtk;
  let finalDef = defenderDef;

  if (applyAttackBuff && attackerBuffs && attackerBuffs.atkTurns > 0) {
    finalAtk *= (1 + attackerBuffs.atkMod);
  }

  if (applyDefenseBuff && defenderBuffs && defenderBuffs.defTurns > 0) {
    finalDef *= (1 + defenderBuffs.defMod);
  }

  const evadeChance = getEvadeChance(
    attackerSpeed,
    defenderSpeed,
    defenderHasPerfectEvade,
    attackKind,
    defenderIsDefending,
  );
  const evaded = Math.random() < evadeChance;

  if (evaded) {
    return {
      damage: 0,
      isCrit: false,
      evaded: true,
    };
  }

  const base = Math.max(1, finalAtk - (finalDef * 0.3));
  const variance = Math.random() * 0.2 + 0.9;
  const critChance = Math.max(0.02, Math.min(0.45, 0.04 + (luck * 0.012) + critChanceBonus));
  const isCrit = Math.random() < critChance;
  const critMult = isCrit ? Math.min(2.6, 1.5 + critDamageBonus) : 1;
  const defenseMitigation = defenderIsDefending ? defendMitigationBonus : 0;
  const totalDamageReduction = Math.max(0, Math.min(0.8, damageReduction + defenseMitigation));

  return {
    damage: Math.max(1, Math.floor(base * multiplier * variance * critMult * (1 - totalDamageReduction))),
    isCrit,
    evaded: false,
  };
};

const STATUS_LABELS: Record<StatusEffectKind, string> = {
  burn: 'Queimadura',
  bleed: 'Sangramento',
  marked: 'Marca',
};

const STATUS_COLORS: Record<StatusEffectKind, string> = {
  burn: '#fb7185',
  bleed: '#ef4444',
  marked: '#facc15',
};

export const createStatusEffect = (
  kind: StatusEffectKind,
  duration: number,
  potency: number,
  source: StatusEffect['source'],
): StatusEffect => ({
  id: `${kind}_${Math.random().toString(36).slice(2, 9)}`,
  kind,
  name: STATUS_LABELS[kind],
  duration,
  potency,
  color: STATUS_COLORS[kind],
  source,
});

export const applyStatusEffect = (
  statuses: StatusEffect[],
  nextStatus: StatusEffect,
): StatusEffect[] => {
  const existing = statuses.find((status) => status.kind === nextStatus.kind);
  if (!existing) {
    return [...statuses, nextStatus];
  }

  return statuses.map((status) => (
    status.kind === nextStatus.kind
      ? {
          ...status,
          duration: Math.max(status.duration, nextStatus.duration),
          potency: Math.max(status.potency, nextStatus.potency),
        }
      : status
  ));
};

export const tickStatusEffects = (
  statuses: StatusEffect[],
  maxHp: number,
  modifiers?: { burnBonus?: number; bleedBonus?: number },
): StatusTickResult => {
  let damage = 0;
  const logs: string[] = [];

  const nextStatuses = statuses
    .map((status) => {
      if (status.kind === 'burn') {
        const burnDamage = Math.max(1, Math.floor(maxHp * (status.potency + (modifiers?.burnBonus ?? 0))));
        damage += burnDamage;
        logs.push(`${status.name} causa ${burnDamage} dano.`);
      }

      if (status.kind === 'bleed') {
        const bleedDamage = Math.max(1, Math.floor(maxHp * (status.potency + (modifiers?.bleedBonus ?? 0))));
        damage += bleedDamage;
        logs.push(`${status.name} causa ${bleedDamage} dano.`);
      }

      return {
        ...status,
        duration: status.duration - 1,
      };
    })
    .filter((status) => status.duration > 0);

  return {
    nextStatuses,
    damage,
    logs,
  };
};
