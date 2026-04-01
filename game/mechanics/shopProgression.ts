import { Rarity } from '../../types';

export const getUnlockedShopRaritiesByStage = (stage: number): Rarity[] => {
  if (stage >= 10) {
    return ['bronze', 'silver', 'gold'];
  }
  if (stage >= 5) {
    return ['bronze', 'silver'];
  }
  return ['bronze'];
};

export const getNewlyUnlockedShopRarityByStage = (stage: number): Rarity | null => {
  if (stage === 5) {
    return 'silver';
  }
  if (stage === 10) {
    return 'gold';
  }
  return null;
};
