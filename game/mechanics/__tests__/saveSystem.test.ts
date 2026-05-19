import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, TurnState } from '../../../types';
import { INITIAL_PLAYER } from '../../data/player';
import type { SavePayload } from '../saveSystem';
import {
  clearAllSaves,
  clearSlot,
  getActiveSaveSlotId,
  listSaveSlots,
  loadSaveFromSlot,
  saveToActiveSlot,
  saveToSlot,
  setActiveSaveSlotId,
} from '../saveSystem';

const SAVE_STORAGE_KEY = 'hero-adventure-save-v1';

const createLocalStorageMock = () => {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };
};

const createPayload = (overrides: Partial<SavePayload> = {}): SavePayload => ({
  player: { ...INITIAL_PLAYER, stats: { ...INITIAL_PLAYER.stats } },
  stage: 3,
  killCount: 2,
  dungeonEvolution: 1,
  onboardingPhase: 'inventory_unlocked',
  hasPlayerDiedOnce: false,
  skillsActionUnlocked: true,
  gameState: GameState.TAVERN,
  turnState: TurnState.PLAYER_INPUT,
  hasEnemy: false,
  hadDungeonRun: false,
  sceneRegion: 'forest',
  ...overrides,
});

describe('save system', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createLocalStorageMock() });
    vi.spyOn(Date, 'now').mockReturnValue(1_779_155_968_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('saves, loads, and summarizes a selected slot', () => {
    const payload = createPayload({
      gameState: GameState.BATTLE,
      hasEnemy: true,
      hadDungeonRun: true,
      sceneRegion: 'dungeon',
    });

    setActiveSaveSlotId(2);
    const saved = saveToActiveSlot(payload);
    const loaded = loadSaveFromSlot(2);
    const summaries = listSaveSlots();

    expect(getActiveSaveSlotId()).toBe(2);
    expect(saved).toMatchObject({ slotId: 2, interruptedBattle: true, interruptedDungeon: true });
    expect(loaded?.payload).toEqual(payload);
    expect(summaries.find((slot) => slot.slotId === 2)).toMatchObject({
      hasSave: true,
      savedAt: 1_779_155_968_000,
      classId: payload.player.classId,
      level: payload.player.level,
      sceneRegion: 'dungeon',
    });
  });

  it('clears individual slots without changing other saves', () => {
    saveToSlot(1, createPayload({ stage: 1 }));
    saveToSlot(2, createPayload({ stage: 2 }));

    clearSlot(1);

    expect(loadSaveFromSlot(1)).toBeNull();
    expect(loadSaveFromSlot(2)?.payload.stage).toBe(2);
  });

  it('rejects payloads that no longer match validation rules', () => {
    saveToSlot(1, createPayload());

    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    const store = JSON.parse(raw ?? '{}');
    store.slots[1].payload.stage = 0;
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(store));

    expect(loadSaveFromSlot(1)).toBeNull();
    expect(listSaveSlots()[0]).toMatchObject({ hasSave: false, savedAt: null });
  });

  it('rejects saves with corrupted checksums', () => {
    saveToSlot(1, createPayload());

    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    const store = JSON.parse(raw ?? '{}');
    store.slots[1].checksum = 'corrupted';
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(store));

    expect(loadSaveFromSlot(1)).toBeNull();
  });

  it('clears all saves from storage', () => {
    saveToSlot(1, createPayload());

    clearAllSaves();

    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(listSaveSlots().every((slot) => !slot.hasSave)).toBe(true);
  });
});