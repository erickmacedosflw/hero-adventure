/**
 * battleStatsStore — current HP/MP for player and main enemy.
 *
 * The Three.js scene (GameScene) is the most expensive thing to reconcile.
 * It receives `playerState` and `enemyState` props that change reference on
 * every HP/MP tick during battle, forcing a full scene re-render each hit.
 *
 * By mirroring just the volatile stats (hp/mp) into this store, the HP/MP
 * bars inside 3D nameplates can subscribe directly. GameScene's React.memo
 * can then skip re-renders when ONLY hp/mp changed (custom areEqual).
 */
import { create } from 'zustand';

interface BattleStatsState {
  playerHp: number;
  playerMaxHp: number;
  playerMp: number;
  playerMaxMp: number;
  /** Keyed by enemy id so multiple enemies can be tracked independently. */
  enemyHp: Record<string, number>;
  enemyMaxHp: Record<string, number>;
  enemyMp: Record<string, number>;
  enemyMaxMp: Record<string, number>;

  setPlayerStats: (hp: number, maxHp: number, mp: number, maxMp: number) => void;
  setEnemyStats: (id: string, hp: number, maxHp: number, mp: number, maxMp: number) => void;
  removeEnemyStats: (id: string) => void;
  clearEnemyStats: () => void;
}

export const useBattleStatsStore = create<BattleStatsState>((set) => ({
  playerHp: 0,
  playerMaxHp: 1,
  playerMp: 0,
  playerMaxMp: 1,
  enemyHp: {},
  enemyMaxHp: {},
  enemyMp: {},
  enemyMaxMp: {},

  setPlayerStats: (hp, maxHp, mp, maxMp) => set((s) => {
    if (s.playerHp === hp && s.playerMaxHp === maxHp && s.playerMp === mp && s.playerMaxMp === maxMp) return s;
    return { playerHp: hp, playerMaxHp: maxHp, playerMp: mp, playerMaxMp: maxMp };
  }),

  setEnemyStats: (id, hp, maxHp, mp, maxMp) => set((s) => {
    if (s.enemyHp[id] === hp && s.enemyMaxHp[id] === maxHp && s.enemyMp[id] === mp && s.enemyMaxMp[id] === maxMp) return s;
    return {
      enemyHp: { ...s.enemyHp, [id]: hp },
      enemyMaxHp: { ...s.enemyMaxHp, [id]: maxHp },
      enemyMp: { ...s.enemyMp, [id]: mp },
      enemyMaxMp: { ...s.enemyMaxMp, [id]: maxMp },
    };
  }),

  removeEnemyStats: (id) => set((s) => {
    if (!(id in s.enemyHp)) return s;
    const { [id]: _h, ...restHp } = s.enemyHp;
    const { [id]: _mh, ...restMaxHp } = s.enemyMaxHp;
    const { [id]: _m, ...restMp } = s.enemyMp;
    const { [id]: _mm, ...restMaxMp } = s.enemyMaxMp;
    return { enemyHp: restHp, enemyMaxHp: restMaxHp, enemyMp: restMp, enemyMaxMp: restMaxMp };
  }),

  clearEnemyStats: () => set({ enemyHp: {}, enemyMaxHp: {}, enemyMp: {}, enemyMaxMp: {} }),
}));
