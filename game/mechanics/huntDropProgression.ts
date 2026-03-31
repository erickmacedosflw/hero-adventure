import { Enemy } from '../../types';

const pickRandom = <T,>(entries: T[]): T => entries[Math.floor(Math.random() * entries.length)];

export const getUnlockedDropRaritiesByStage = (stage: number) => {
  if (stage >= 7) {
    return ['bronze', 'silver', 'gold'] as const;
  }
  if (stage >= 4) {
    return ['bronze', 'silver'] as const;
  }
  return ['bronze'] as const;
};

const BRONZE_MATERIAL_BY_TYPE: Record<Enemy['type'], string[]> = {
  beast: ['mat_bone', 'mat_slime'],
  humanoid: ['mat_cloth', 'mat_wood'],
  undead: ['mat_bone', 'mat_cloth'],
};

const SILVER_DROP_BY_TYPE: Record<Enemy['type'], string[]> = {
  beast: ['mat_iron', 'pot_5'],
  humanoid: ['mat_iron', 'pot_mana_2'],
  undead: ['mat_iron', 'pot_mix_1'],
};

const GOLD_DROP_BY_TYPE: Record<Enemy['type'], string[]> = {
  beast: ['mat_gold', 'pot_4'],
  humanoid: ['mat_gold', 'pot_mana_3'],
  undead: ['mat_gold', 'pot_mix_2'],
};

type GenerateHuntDropsParams = {
  enemyType: Enemy['type'];
  stage: number;
  isBoss: boolean;
  ensureAtLeastOneDrop?: boolean;
};

export const generateHuntDropsByStage = ({
  enemyType,
  stage,
  isBoss,
  ensureAtLeastOneDrop = false,
}: GenerateHuntDropsParams): string[] => {
  const unlockedRarities = getUnlockedDropRaritiesByStage(stage);
  const drops: string[] = [];

  const shouldDropBase = Math.random() < 0.6 || ensureAtLeastOneDrop || isBoss;
  if (shouldDropBase) {
    drops.push(pickRandom(BRONZE_MATERIAL_BY_TYPE[enemyType]));
  }

  if (!isBoss && Math.random() < 0.15) {
    drops.push('pot_1');
  }

  if (unlockedRarities.includes('silver') && Math.random() < (isBoss ? 0.55 : 0.22)) {
    drops.push(pickRandom(SILVER_DROP_BY_TYPE[enemyType]));
  }

  if (unlockedRarities.includes('gold') && Math.random() < (isBoss ? 0.35 : 0.12)) {
    drops.push(pickRandom(GOLD_DROP_BY_TYPE[enemyType]));
  }

  // Bosses can roll a rarity above the current phase progression.
  if (isBoss && stage < 4 && Math.random() < 0.18) {
    drops.push(pickRandom(SILVER_DROP_BY_TYPE[enemyType]));
  }
  if (isBoss && stage < 7 && Math.random() < 0.07) {
    drops.push(pickRandom(GOLD_DROP_BY_TYPE[enemyType]));
  }

  return drops;
};
