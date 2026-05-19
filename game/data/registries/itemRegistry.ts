import { ALL_ITEMS } from '../../../constants';
import type { Item } from '../../../types';

const LEGACY_ITEM_ID_MAP: Readonly<Record<string, string>> = {
  wep_b1: 'wep_3d_dagger_a',
  wep_b2: 'wep_3d_axe_a',
  wep_s1: 'wep_3d_sword_b',
  wep_s2: 'wep_3d_spear_a',
  wep_g1: 'wep_3d_sword_d',
  wep_g2: 'wep_3d_sword_e',
};

export const ITEM_REGISTRY: ReadonlyMap<string, Item> = new Map(
  ALL_ITEMS.map((item) => [item.id, item]),
);

export const remapLegacyItemId = (itemId: string) => LEGACY_ITEM_ID_MAP[itemId] ?? itemId;

export const getItemById = (itemId: string | null | undefined): Item | null => {
  if (!itemId) {
    return null;
  }

  return ITEM_REGISTRY.get(remapLegacyItemId(itemId)) ?? null;
};

export const resolveCanonicalItemReference = (item: Item | null | undefined): Item | null => {
  if (!item) {
    return null;
  }

  return getItemById(item.id) ?? item;
};

export const normalizeInventoryItemIds = (inventory: Record<string, number>): Record<string, number> => {
  const normalized: Record<string, number> = {};

  Object.entries(inventory).forEach(([itemId, quantity]) => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const mappedId = remapLegacyItemId(itemId);
    normalized[mappedId] = (normalized[mappedId] ?? 0) + Math.floor(quantity);
  });

  return normalized;
};

export const getItemsByType = (type: Item['type']): Item[] => ALL_ITEMS.filter((item) => item.type === type);

export const getItemsByRarity = (rarity: Item['rarity']): Item[] => ALL_ITEMS.filter((item) => item.rarity === rarity);

export const findDuplicateItemIds = (): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  ALL_ITEMS.forEach((item) => {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
      return;
    }

    seen.add(item.id);
  });

  return Array.from(duplicates).sort();
};