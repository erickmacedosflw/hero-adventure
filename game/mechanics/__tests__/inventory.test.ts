import { describe, expect, it } from 'vitest';
import { INITIAL_PLAYER } from '../../../constants';
import type { Player } from '../../../types';
import { getItemById } from '../../data/registries/itemRegistry';
import { buyItemForPlayer, equipItemOnPlayer, sellItemFromPlayer, useConsumable } from '../inventory';

type PlayerTestOverrides = Partial<Omit<Player, 'stats' | 'buffs'>> & {
  stats?: Partial<Player['stats']>;
  buffs?: Partial<Player['buffs']>;
};

const createPlayer = (overrides: PlayerTestOverrides = {}): Player => ({
  ...INITIAL_PLAYER,
  ...overrides,
  stats: {
    ...INITIAL_PLAYER.stats,
    ...overrides.stats,
  },
  buffs: {
    ...INITIAL_PLAYER.buffs,
    ...overrides.buffs,
  },
  inventory: {
    ...overrides.inventory,
  },
  skills: [...(overrides.skills ?? INITIAL_PLAYER.skills)],
  chosenCards: [...(overrides.chosenCards ?? INITIAL_PLAYER.chosenCards)],
  equippedItemSlots: [...(overrides.equippedItemSlots ?? INITIAL_PLAYER.equippedItemSlots)],
});

describe('inventory mechanics', () => {
  it('buys available items with floored quantity and deducts gold', () => {
    const potion = getItemById('pot_1');
    expect(potion).not.toBeNull();

    const player = createPlayer({ gold: 500, level: potion!.minLevel });
    const nextPlayer = buyItemForPlayer(player, potion!, 2.8);

    expect(nextPlayer.gold).toBe(500 - potion!.cost * 2);
    expect(nextPlayer.inventory[potion!.id]).toBe(2);
  });

  it('does not buy locked or unaffordable items', () => {
    const goldArmor = getItemById('arm_g1');
    expect(goldArmor).not.toBeNull();

    const lowLevelPlayer = createPlayer({ gold: 99999, level: goldArmor!.minLevel - 1 });
    const poorPlayer = createPlayer({ gold: 0, level: goldArmor!.minLevel });

    expect(buyItemForPlayer(lowLevelPlayer, goldArmor!)).toBe(lowLevelPlayer);
    expect(buyItemForPlayer(poorPlayer, goldArmor!)).toBe(poorPlayer);
  });

  it('sells inventory quantities for half item cost', () => {
    const potion = getItemById('pot_1');
    expect(potion).not.toBeNull();

    const player = createPlayer({ gold: 10, inventory: { [potion!.id]: 3 } });
    const nextPlayer = sellItemFromPlayer(player, potion!, 2);

    expect(nextPlayer.gold).toBe(10 + Math.floor(potion!.cost / 2) * 2);
    expect(nextPlayer.inventory[potion!.id]).toBe(1);
  });

  it('equips armor from inventory and applies defensive bonuses', () => {
    const armor = getItemById('arm_b2');
    expect(armor).not.toBeNull();

    const player = createPlayer({ inventory: { [armor!.id]: 1 }, equippedArmor: null });
    const nextPlayer = equipItemOnPlayer(player, armor!);

    expect(nextPlayer.equippedArmor?.id).toBe(armor!.id);
    expect(nextPlayer.stats.def).toBe(player.stats.def + armor!.value);
  });

  it('consumes healing and mana potions without exceeding stat caps', () => {
    const hpPotion = getItemById('pot_1');
    const mpPotion = getItemById('pot_2');
    expect(hpPotion).not.toBeNull();
    expect(mpPotion).not.toBeNull();

    const woundedPlayer = createPlayer({
      stats: { hp: 1, mp: 1 },
      inventory: { [hpPotion!.id]: 1, [mpPotion!.id]: 1 },
    });

    const healed = useConsumable(woundedPlayer, hpPotion!);
    const restored = useConsumable(healed.player, mpPotion!);

    expect(healed.effect).toEqual({ kind: 'heal', amount: Math.min(hpPotion!.value, INITIAL_PLAYER.stats.maxHp - 1) });
    expect(healed.player.stats.hp).toBe(Math.min(INITIAL_PLAYER.stats.maxHp, 1 + hpPotion!.value));
    expect(restored.effect).toEqual({ kind: 'mana', amount: Math.min(mpPotion!.value, INITIAL_PLAYER.stats.maxMp - 1) });
    expect(restored.player.stats.mp).toBe(Math.min(INITIAL_PLAYER.stats.maxMp, 1 + mpPotion!.value));
  });
});