import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyStatusEffect,
  calculateDamage,
  createEmptyBuffState,
  getEvadeChance,
  tickStatusEffects,
} from '../combat';
import type { StatusEffect } from '../../../types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('combat mechanics', () => {
  it('calculates deterministic non-critical physical damage with defense ratio and multiplier', () => {
    const randomValues = [0.99, 0.5];
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0.99);

    const result = calculateDamage({
      attackerAtk: 100,
      defenderDef: 20,
      attackerSpeed: 10,
      defenderSpeed: 10,
      multiplier: 1.2,
      baseDefenseRatio: 0.5,
      disableCrit: true,
    });

    expect(result).toEqual({ damage: 108, isCrit: false, evaded: false });
  });

  it('applies active attack and defense buffs only while their turns are positive', () => {
    const randomValues = [0.99, 0.5];
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0.99);
    const attackerBuffs = { ...createEmptyBuffState(), atkMod: 0.5, atkTurns: 1 };
    const defenderBuffs = { ...createEmptyBuffState(), defMod: 1, defTurns: 1 };

    const result = calculateDamage({
      attackerAtk: 40,
      defenderDef: 10,
      attackerSpeed: 10,
      defenderSpeed: 10,
      attackerBuffs,
      defenderBuffs,
      applyAttackBuff: true,
      applyDefenseBuff: true,
      disableCrit: true,
    });

    expect(result.damage).toBe(54);
  });

  it('caps evade chance by attack kind and supports perfect evade', () => {
    expect(getEvadeChance(5, 100, false, 'physical')).toBe(0.22);
    expect(getEvadeChance(5, 100, false, 'magic')).toBe(0.12);
    expect(getEvadeChance(100, 5, true, 'physical')).toBe(1);
  });

  it('refreshes matching status effects using the strongest duration and potency', () => {
    const existing: StatusEffect = {
      id: 'burn_old',
      kind: 'burn',
      name: 'Queimadura',
      duration: 2,
      potency: 0.04,
      color: '#fb7185',
      source: 'skill',
    };
    const incoming: StatusEffect = {
      ...existing,
      id: 'burn_new',
      duration: 4,
      potency: 0.03,
    };

    expect(applyStatusEffect([existing], incoming)).toEqual([
      { ...existing, duration: 4, potency: 0.04 },
    ]);
  });

  it('ticks damaging statuses, logs damage, and removes expired entries', () => {
    const statuses: StatusEffect[] = [
      {
        id: 'burn_1',
        kind: 'burn',
        name: 'Queimadura',
        duration: 1,
        potency: 0.05,
        color: '#fb7185',
        source: 'skill',
      },
      {
        id: 'bleed_1',
        kind: 'bleed',
        name: 'Sangramento',
        duration: 2,
        potency: 0.03,
        color: '#ef4444',
        source: 'talent',
      },
    ];

    const result = tickStatusEffects(statuses, 200, { bleedBonus: 0.02 });

    expect(result.damage).toBe(20);
    expect(result.logs).toEqual([
      'Queimadura causa 10 dano.',
      'Sangramento causa 10 dano.',
    ]);
    expect(result.nextStatuses).toEqual([
      { ...statuses[1], duration: 1 },
    ]);
  });
});