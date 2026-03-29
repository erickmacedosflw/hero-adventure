import { GameState, Player } from '../../types';

const SAVE_STORAGE_KEY = 'hero-adventure-save-v1';
const SAVE_SCHEMA_VERSION = 1;

export type SaveSlotId = 1 | 2 | 3;

const ALL_SAVE_SLOTS: SaveSlotId[] = [1, 2, 3];

export interface SavePayload {
  player: Player;
  stage: number;
  killCount: number;
  dungeonEvolution: number;
  onboardingPhase: string;
  hasPlayerDiedOnce: boolean;
  skillsActionUnlocked: boolean;
  gameState: GameState;
  hasEnemy: boolean;
  hadDungeonRun: boolean;
  sceneRegion: 'forest' | 'dungeon';
}

interface SaveEnvelope {
  schemaVersion: number;
  savedAt: number;
  payload: SavePayload;
  checksum: string;
}

interface SaveStore {
  schemaVersion: number;
  activeSlotId: SaveSlotId;
  slots: Partial<Record<SaveSlotId, SaveEnvelope>>;
}

export interface SaveSlotSummary {
  slotId: SaveSlotId;
  hasSave: boolean;
  savedAt: number | null;
  classId: Player['classId'] | null;
  level: number | null;
}

export interface SaveLoadResult {
  payload: SavePayload;
  savedAt: number;
  slotId: SaveSlotId;
  interruptedBattle: boolean;
  interruptedDungeon: boolean;
}

const createEmptyStore = (): SaveStore => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  activeSlotId: 1,
  slots: {},
});

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const computeChecksum = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return String(hash >>> 0);
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isPlayerLike = (value: unknown): value is Player => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const player = value as Player;
  if (typeof player.name !== 'string' || typeof player.classId !== 'string') {
    return false;
  }

  if (!isFiniteNumber(player.level) || player.level < 1) {
    return false;
  }

  if (!isFiniteNumber(player.xp) || !isFiniteNumber(player.xpToNext) || player.xp < 0 || player.xpToNext <= 0) {
    return false;
  }

  if (!player.stats || typeof player.stats !== 'object') {
    return false;
  }

  return true;
};

const isSavePayloadLike = (value: unknown): value is SavePayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as SavePayload;

  if (!isPlayerLike(payload.player)) {
    return false;
  }

  if (!isFiniteNumber(payload.stage) || payload.stage < 1) {
    return false;
  }

  if (!isFiniteNumber(payload.killCount) || payload.killCount < 0) {
    return false;
  }

  if (!isFiniteNumber(payload.dungeonEvolution) || payload.dungeonEvolution < 0) {
    return false;
  }

  if (typeof payload.onboardingPhase !== 'string') {
    return false;
  }

  if (typeof payload.hasPlayerDiedOnce !== 'boolean' || typeof payload.skillsActionUnlocked !== 'boolean') {
    return false;
  }

  if (!isFiniteNumber(payload.gameState)) {
    return false;
  }

  if (typeof payload.hasEnemy !== 'boolean' || typeof payload.hadDungeonRun !== 'boolean') {
    return false;
  }

  if (payload.sceneRegion !== 'forest' && payload.sceneRegion !== 'dungeon') {
    return false;
  }

  return true;
};

const readStore = (): SaveStore => {
  if (!canUseStorage()) {
    return createEmptyStore();
  }

  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  if (!raw) {
    return createEmptyStore();
  }

  try {
    const parsed = JSON.parse(raw) as SaveStore;
    const activeSlotId = ALL_SAVE_SLOTS.includes(parsed.activeSlotId) ? parsed.activeSlotId : 1;
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      activeSlotId,
      slots: parsed.slots && typeof parsed.slots === 'object' ? parsed.slots : {},
    };
  } catch {
    return createEmptyStore();
  }
};

const writeStore = (store: SaveStore) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(store));
};

const ensureValidEnvelope = (slotId: SaveSlotId, envelope: SaveEnvelope | undefined): SaveLoadResult | null => {
  if (!envelope || envelope.schemaVersion !== SAVE_SCHEMA_VERSION || !isFiniteNumber(envelope.savedAt)) {
    return null;
  }

  if (!isSavePayloadLike(envelope.payload)) {
    return null;
  }

  const checksumSource = JSON.stringify({
    schemaVersion: envelope.schemaVersion,
    savedAt: envelope.savedAt,
    payload: envelope.payload,
  });
  const expectedChecksum = computeChecksum(checksumSource);
  if (envelope.checksum !== expectedChecksum) {
    return null;
  }

  const interruptedDungeon = envelope.payload.hadDungeonRun;
  const interruptedBattle = envelope.payload.gameState === GameState.BATTLE && envelope.payload.hasEnemy;

  return {
    payload: envelope.payload,
    savedAt: envelope.savedAt,
    slotId,
    interruptedBattle,
    interruptedDungeon,
  };
};

export const listSaveSlots = (): SaveSlotSummary[] => {
  const store = readStore();

  return ALL_SAVE_SLOTS.map((slotId) => {
    const loaded = ensureValidEnvelope(slotId, store.slots[slotId]);
    return {
      slotId,
      hasSave: Boolean(loaded),
      savedAt: loaded?.savedAt ?? null,
      classId: loaded?.payload.player.classId ?? null,
      level: loaded?.payload.player.level ?? null,
    };
  });
};

export const getActiveSaveSlotId = (): SaveSlotId => readStore().activeSlotId;

export const setActiveSaveSlotId = (slotId: SaveSlotId) => {
  const store = readStore();
  store.activeSlotId = slotId;
  writeStore(store);
};

export const loadSaveFromSlot = (slotId: SaveSlotId): SaveLoadResult | null => {
  const store = readStore();
  return ensureValidEnvelope(slotId, store.slots[slotId]);
};

export const loadActiveSave = (): SaveLoadResult | null => {
  const store = readStore();
  return ensureValidEnvelope(store.activeSlotId, store.slots[store.activeSlotId]);
};

export const saveToSlot = (slotId: SaveSlotId, payload: SavePayload): SaveLoadResult | null => {
  if (!canUseStorage()) {
    return null;
  }

  const store = readStore();
  const savedAt = Date.now();
  const base = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt,
    payload,
  };
  const envelope: SaveEnvelope = {
    ...base,
    checksum: computeChecksum(JSON.stringify(base)),
  };

  store.activeSlotId = slotId;
  store.slots[slotId] = envelope;
  writeStore(store);

  return ensureValidEnvelope(slotId, envelope);
};

export const saveToActiveSlot = (payload: SavePayload): SaveLoadResult | null => {
  const slotId = getActiveSaveSlotId();
  return saveToSlot(slotId, payload);
};

export const clearSlot = (slotId: SaveSlotId) => {
  const store = readStore();
  delete store.slots[slotId];
  writeStore(store);
};

export const clearAllSaves = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SAVE_STORAGE_KEY);
};
