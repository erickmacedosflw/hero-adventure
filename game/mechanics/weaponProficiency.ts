import { getPlayerClassById } from '../data/classes';
import { getEquippedWeaponGrip } from '../data/weaponCatalog';
import { Item, PlayerClassId, Stats, WeaponProficiencyBonusStat } from '../../types';

export type WeaponProficiencyAppliedBonuses = Partial<Record<WeaponProficiencyBonusStat, number>>;

const PROFICIENCY_BONUS_STATS: WeaponProficiencyBonusStat[] = ['atk', 'def', 'speed', 'luck', 'magic', 'maxMp'];

const hasPositiveNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

export const getWeaponGripForItem = (item: Item | null | undefined) => (
  item?.type === 'weapon' ? getEquippedWeaponGrip(item.id) : undefined
);

export const isWeaponProficientForClass = (classId: PlayerClassId, item: Item | null | undefined) => {
  const grip = getWeaponGripForItem(item);
  if (!grip) {
    return false;
  }

  const playerClass = getPlayerClassById(classId);
  return playerClass.weaponProficiencies.includes(grip);
};

export const getWeaponProficiencyAppliedBonuses = (classId: PlayerClassId, item: Item | null | undefined): WeaponProficiencyAppliedBonuses => {
  const playerClass = getPlayerClassById(classId);
  if (!isWeaponProficientForClass(classId, item)) {
    return {};
  }

  const configuredBonuses = playerClass.weaponProficiencyBonuses;
  if (!configuredBonuses) {
    return {};
  }

  const applied: WeaponProficiencyAppliedBonuses = {};

  PROFICIENCY_BONUS_STATS.forEach((statKey) => {
    const percent = configuredBonuses[statKey];
    if (!hasPositiveNumber(percent)) {
      return;
    }

    const baseValue = statKey === 'maxMp'
      ? playerClass.baseStats.maxMp
      : playerClass.baseStats[statKey];

    const scaled = Math.floor(baseValue * percent);
    if (scaled > 0) {
      applied[statKey] = scaled;
    }
  });

  return applied;
};

export const applyWeaponProficiencyBonusesToStats = (
  stats: Stats,
  bonuses: WeaponProficiencyAppliedBonuses,
  direction: 1 | -1,
): Stats => {
  const nextStats: Stats = {
    ...stats,
    atk: stats.atk + ((bonuses.atk ?? 0) * direction),
    def: stats.def + ((bonuses.def ?? 0) * direction),
    speed: stats.speed + ((bonuses.speed ?? 0) * direction),
    luck: stats.luck + ((bonuses.luck ?? 0) * direction),
    magic: stats.magic + ((bonuses.magic ?? 0) * direction),
    maxMp: stats.maxMp + ((bonuses.maxMp ?? 0) * direction),
    mp: stats.mp + ((bonuses.maxMp ?? 0) * direction),
  };

  nextStats.maxMp = Math.max(0, nextStats.maxMp);
  nextStats.mp = Math.min(nextStats.maxMp, Math.max(0, nextStats.mp));

  return nextStats;
};
