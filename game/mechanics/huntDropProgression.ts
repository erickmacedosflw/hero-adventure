import { Enemy } from '../../types';

const pickRandom = <T,>(entries: T[]): T => entries[Math.floor(Math.random() * entries.length)];

export const getUnlockedDropRaritiesByStage = (stage: number) => {
  if (stage >= 10) {
    return ['bronze', 'silver', 'gold'] as const;
  }
  if (stage >= 5) {
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
  const silverPool = SILVER_DROP_BY_TYPE[enemyType].filter((dropId) => dropId !== 'pot_5' || stage >= 8);
  const goldPool = GOLD_DROP_BY_TYPE[enemyType].filter((dropId) => dropId !== 'pot_4' || stage >= 15);

  const shouldDropBase = Math.random() < 0.6 || ensureAtLeastOneDrop || isBoss;
  if (shouldDropBase) {
    drops.push(pickRandom(BRONZE_MATERIAL_BY_TYPE[enemyType]));
  }

  if (!isBoss && Math.random() < 0.15) {
    drops.push('pot_1');
  }

  if (unlockedRarities.includes('silver') && silverPool.length > 0 && Math.random() < (isBoss ? 0.55 : 0.22)) {
    drops.push(pickRandom(silverPool));
  }

  if (unlockedRarities.includes('gold') && goldPool.length > 0 && Math.random() < (isBoss ? 0.35 : 0.12)) {
    drops.push(pickRandom(goldPool));
  }

  // Bosses can roll a rarity above the current phase progression.
  if (isBoss && stage < 5 && silverPool.length > 0 && Math.random() < 0.18) {
    drops.push(pickRandom(silverPool));
  }
  if (isBoss && stage < 10 && goldPool.length > 0 && Math.random() < 0.07) {
    drops.push(pickRandom(goldPool));
  }

  return drops;
};
