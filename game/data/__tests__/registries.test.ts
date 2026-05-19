import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, SKILLS } from '../../../constants';
import {
  ITEM_REGISTRY,
  findDuplicateItemIds,
  getItemById,
  getItemsByRarity,
  getItemsByType,
  normalizeInventoryItemIds,
  remapLegacyItemId,
  resolveCanonicalItemReference,
} from '../registries/itemRegistry';
import {
  SKILL_REGISTRY,
  findDuplicateSkillIds,
  getSkillById,
  mergeCatalogSkill,
  restoreCatalogSkillIcon,
} from '../registries/skillRegistry';

describe('item registry', () => {
  it('indexes every canonical item by id', () => {
    expect(ITEM_REGISTRY.size).toBe(ALL_ITEMS.length);
    expect(findDuplicateItemIds()).toEqual([]);
    expect(getItemById('pot_1')?.id).toBe('pot_1');
  });

  it('remaps legacy weapon ids while normalizing inventory quantities', () => {
    expect(remapLegacyItemId('wep_b1')).toBe('wep_3d_dagger_a');
    expect(getItemById('wep_b1')?.id).toBe('wep_3d_dagger_a');
    expect(normalizeInventoryItemIds({ wep_b1: 1.8, pot_1: 2, empty: 0 })).toEqual({
      wep_3d_dagger_a: 1,
      pot_1: 2,
    });
  });

  it('preserves unknown item references for forward-compatible saves', () => {
    const unknownItem = {
      id: 'future_item',
      name: 'Future Item',
      description: 'Unknown item from a newer build.',
      cost: 0,
      type: 'material' as const,
      value: 0,
      icon: '?',
      rarity: 'bronze' as const,
      minLevel: 1,
    };

    expect(resolveCanonicalItemReference(unknownItem)).toBe(unknownItem);
  });

  it('filters canonical items by gameplay fields', () => {
    expect(getItemsByType('potion').every((item) => item.type === 'potion')).toBe(true);
    expect(getItemsByRarity('gold').every((item) => item.rarity === 'gold')).toBe(true);
  });
});

describe('skill registry', () => {
  it('indexes every canonical skill by id', () => {
    expect(SKILL_REGISTRY.size).toBe(SKILLS.length);
    expect(findDuplicateSkillIds()).toEqual([]);
    expect(getSkillById('skl_1')?.id).toBe('skl_1');
  });

  it('merges saved skill data with the current catalog definition', () => {
    const catalogSkill = getSkillById('skl_1');
    expect(catalogSkill).not.toBeNull();

    const restored = mergeCatalogSkill({ ...catalogSkill!, name: 'Old Name', manaCost: 999 });

    expect(restored.name).toBe(catalogSkill!.name);
    expect(restored.manaCost).toBe(catalogSkill!.manaCost);
  });

  it('backfills missing catalog icons without replacing existing save icons', () => {
    const catalogSkill = SKILLS.find((skill) => skill.icon);
    expect(catalogSkill).toBeTruthy();

    const savedWithoutIcon = { ...catalogSkill!, icon: undefined };
    const savedWithIcon = { ...catalogSkill!, icon: 'custom-icon' };

    expect(restoreCatalogSkillIcon(savedWithoutIcon).icon).toBe(catalogSkill!.icon);
    expect(restoreCatalogSkillIcon(savedWithIcon).icon).toBe('custom-icon');
  });
});