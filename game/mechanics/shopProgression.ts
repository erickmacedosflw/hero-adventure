import { Rarity } from '../../types';

export const getUnlockedShopRaritiesByStage = (stage: number): Rarity[] => {
  if (stage >= 7) {
    return ['bronze', 'silver', 'gold'];
  }
  if (stage >= 4) {
    return ['bronze', 'silver'];
  }
  return ['bronze'];
};

export const getNewlyUnlockedShopRarityByStage = (stage: number): Rarity | null => {
  if (stage === 4) {
    return 'silver';
  }
  if (stage === 7) {
    return 'gold';
  }
  return null;
};
