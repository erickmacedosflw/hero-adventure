import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_DEBOUNCE_MS,
  IMPULSE_UNLOCK_LEVELS,
  getImpulseCapacityByLevel,
  getXpToNextByLevel,
} from '../config';

describe('game config', () => {
  it('keeps impulse unlock thresholds stable', () => {
    expect(IMPULSE_UNLOCK_LEVELS).toEqual([4, 8, 12]);
    expect(getImpulseCapacityByLevel(1)).toBe(0);
    expect(getImpulseCapacityByLevel(4)).toBe(1);
    expect(getImpulseCapacityByLevel(8)).toBe(2);
    expect(getImpulseCapacityByLevel(12)).toBe(3);
  });

  it('calculates the existing XP curve from the configured base and growth', () => {
    expect(getXpToNextByLevel(0)).toBe(150);
    expect(getXpToNextByLevel(1)).toBe(150);
    expect(getXpToNextByLevel(2)).toBe(225);
    expect(getXpToNextByLevel(3)).toBe(337);
  });

  it('keeps autosave debounce timing centralized', () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBe(2500);
  });
});