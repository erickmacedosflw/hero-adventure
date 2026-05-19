export const GAME_CONFIG = {
  progression: {
    xpToNextBase: 150,
    xpToNextGrowth: 1.5,
  },
  impulse: {
    unlockLevels: [4, 8, 12] as const,
  },
  save: {
    autosaveDebounceMs: 2500,
  },
} as const;

export const IMPULSE_UNLOCK_LEVELS = GAME_CONFIG.impulse.unlockLevels;
export const AUTOSAVE_DEBOUNCE_MS = GAME_CONFIG.save.autosaveDebounceMs;

export const getImpulseCapacityByLevel = (level: number) => (
  level >= 12 ? 3 : level >= 8 ? 2 : level >= 4 ? 1 : 0
);

export const getXpToNextByLevel = (level: number) => {
  const safeLevel = Math.max(1, Math.floor(level));
  let xpToNext: number = GAME_CONFIG.progression.xpToNextBase;

  for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
    xpToNext = Math.floor(xpToNext * GAME_CONFIG.progression.xpToNextGrowth);
  }

  return xpToNext;
};