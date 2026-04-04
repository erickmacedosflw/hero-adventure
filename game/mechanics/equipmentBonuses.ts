import { Item, Stats } from '../../types';

export type EquipmentBonuses = {
  atk: number;
  def: number;
  speed: number;
  magic: number;
  maxHp: number;
  maxMp: number;
};

const toInt = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.floor(value);
};

export const getEquipmentBonuses = (item: Item | null): EquipmentBonuses => {
  if (!item) {
    return { atk: 0, def: 0, speed: 0, magic: 0, maxHp: 0, maxMp: 0 };
  }

  const base = toInt(item.value);
  const hpBonus = toInt(item.hpBonus);
  const mpBonus = toInt(item.mpBonus);
  const magicBonus = toInt(item.magicBonus);

  if (item.type === 'weapon') {
    return { atk: base, def: 0, speed: 0, magic: magicBonus, maxHp: 0, maxMp: 0 };
  }
  if (item.type === 'armor') {
    return { atk: 0, def: base, speed: 0, magic: 0, maxHp: 0, maxMp: mpBonus };
  }
  if (item.type === 'helmet') {
    return { atk: 0, def: base, speed: 0, magic: 0, maxHp: hpBonus, maxMp: 0 };
  }
  if (item.type === 'legs') {
    return { atk: 0, def: 0, speed: base, magic: 0, maxHp: 0, maxMp: 0 };
  }
  if (item.type === 'shield') {
    return { atk: 0, def: base, speed: 0, magic: 0, maxHp: 0, maxMp: 0 };
  }

  return { atk: 0, def: 0, speed: 0, magic: 0, maxHp: 0, maxMp: 0 };
};

export const applyEquipmentBonusesToStats = (stats: Stats, item: Item | null, direction: 1 | -1): Stats => {
  const bonuses = getEquipmentBonuses(item);
  const nextStats: Stats = {
    ...stats,
    atk: stats.atk + (bonuses.atk * direction),
    def: stats.def + (bonuses.def * direction),
    speed: stats.speed + (bonuses.speed * direction),
    magic: stats.magic + (bonuses.magic * direction),
    maxHp: stats.maxHp + (bonuses.maxHp * direction),
    maxMp: stats.maxMp + (bonuses.maxMp * direction),
    hp: stats.hp + (bonuses.maxHp * direction),
    mp: stats.mp + (bonuses.maxMp * direction),
  };

  nextStats.maxHp = Math.max(1, nextStats.maxHp);
  nextStats.maxMp = Math.max(0, nextStats.maxMp);
  nextStats.hp = Math.min(nextStats.maxHp, Math.max(0, nextStats.hp));
  nextStats.mp = Math.min(nextStats.maxMp, Math.max(0, nextStats.mp));

  return nextStats;
};
