import { create } from 'zustand';
import type { PlayerAnimationAction } from '../../types';

interface BattleAnimationState {
  // Player animation
  playerAnimationAction: PlayerAnimationAction;
  isPlayerAttacking: boolean;
  isPlayerHit: boolean;
  isPlayerCritHit: boolean;

  // Enemy animation
  enemyAnimationAction: PlayerAnimationAction;
  isEnemyAttacking: boolean;
  isEnemyHit: boolean;

  // Execution animations
  playerExecutionAnimationId: string | null;
  enemyExecutionAnimationId: string | null;
  playerExecutionAnimationTintColor: string | null;
  enemyExecutionAnimationTintColor: string | null;

  // Impact animations
  playerImpactAnimationId: string | null;
  enemyImpactAnimationId: string | null;
  playerImpactAnimationTintColor: string | null;
  enemyImpactAnimationTintColor: string | null;
  playerImpactAnimationTarget: 'self' | 'target';
  enemyImpactAnimationTarget: 'self' | 'target';

  // Triggers (increment to fire)
  playerImpactAnimationTrigger: number;
  enemyImpactAnimationTrigger: number;
  playerBowShotTrigger: number;
  enemyBowShotTrigger: number;

  // Bow shot results
  playerBowShotDidHit: boolean;
  enemyBowShotDidHit: boolean;

  // Camera
  screenShake: number;

  // Setters
  setPlayerAnimationAction: (v: PlayerAnimationAction) => void;
  setIsPlayerAttacking: (v: boolean) => void;
  setIsPlayerHit: (v: boolean) => void;
  setIsPlayerCritHit: (v: boolean) => void;

  setEnemyAnimationAction: (v: PlayerAnimationAction) => void;
  setIsEnemyAttacking: (v: boolean) => void;
  setIsEnemyHit: (v: boolean) => void;

  setPlayerExecutionAnimationId: (v: string | null) => void;
  setEnemyExecutionAnimationId: (v: string | null) => void;
  setPlayerExecutionAnimationTintColor: (v: string | null) => void;
  setEnemyExecutionAnimationTintColor: (v: string | null) => void;

  setPlayerImpactAnimationId: (v: string | null) => void;
  setEnemyImpactAnimationId: (v: string | null) => void;
  setPlayerImpactAnimationTintColor: (v: string | null) => void;
  setEnemyImpactAnimationTintColor: (v: string | null) => void;
  setPlayerImpactAnimationTarget: (v: 'self' | 'target') => void;
  setEnemyImpactAnimationTarget: (v: 'self' | 'target') => void;

  setPlayerImpactAnimationTrigger: (v: number | ((prev: number) => number)) => void;
  setEnemyImpactAnimationTrigger: (v: number | ((prev: number) => number)) => void;
  setPlayerBowShotTrigger: (v: number | ((prev: number) => number)) => void;
  setEnemyBowShotTrigger: (v: number | ((prev: number) => number)) => void;

  setPlayerBowShotDidHit: (v: boolean) => void;
  setEnemyBowShotDidHit: (v: boolean) => void;

  setScreenShake: (v: number) => void;
}

export const useBattleAnimationStore = create<BattleAnimationState>((set, get) => ({
  playerAnimationAction: 'idle',
  isPlayerAttacking: false,
  isPlayerHit: false,
  isPlayerCritHit: false,

  enemyAnimationAction: 'battle-idle',
  isEnemyAttacking: false,
  isEnemyHit: false,

  playerExecutionAnimationId: null,
  enemyExecutionAnimationId: null,
  playerExecutionAnimationTintColor: null,
  enemyExecutionAnimationTintColor: null,

  playerImpactAnimationId: null,
  enemyImpactAnimationId: null,
  playerImpactAnimationTintColor: null,
  enemyImpactAnimationTintColor: null,
  playerImpactAnimationTarget: 'target',
  enemyImpactAnimationTarget: 'target',

  playerImpactAnimationTrigger: 0,
  enemyImpactAnimationTrigger: 0,
  playerBowShotTrigger: 0,
  enemyBowShotTrigger: 0,

  playerBowShotDidHit: true,
  enemyBowShotDidHit: true,

  screenShake: 0,

  setPlayerAnimationAction: (v) => set({ playerAnimationAction: v }),
  setIsPlayerAttacking: (v) => set({ isPlayerAttacking: v }),
  setIsPlayerHit: (v) => set({ isPlayerHit: v }),
  setIsPlayerCritHit: (v) => set({ isPlayerCritHit: v }),

  setEnemyAnimationAction: (v) => set({ enemyAnimationAction: v }),
  setIsEnemyAttacking: (v) => set({ isEnemyAttacking: v }),
  setIsEnemyHit: (v) => set({ isEnemyHit: v }),

  setPlayerExecutionAnimationId: (v) => set({ playerExecutionAnimationId: v }),
  setEnemyExecutionAnimationId: (v) => set({ enemyExecutionAnimationId: v }),
  setPlayerExecutionAnimationTintColor: (v) => set({ playerExecutionAnimationTintColor: v }),
  setEnemyExecutionAnimationTintColor: (v) => set({ enemyExecutionAnimationTintColor: v }),

  setPlayerImpactAnimationId: (v) => set({ playerImpactAnimationId: v }),
  setEnemyImpactAnimationId: (v) => set({ enemyImpactAnimationId: v }),
  setPlayerImpactAnimationTintColor: (v) => set({ playerImpactAnimationTintColor: v }),
  setEnemyImpactAnimationTintColor: (v) => set({ enemyImpactAnimationTintColor: v }),
  setPlayerImpactAnimationTarget: (v) => set({ playerImpactAnimationTarget: v }),
  setEnemyImpactAnimationTarget: (v) => set({ enemyImpactAnimationTarget: v }),

  setPlayerImpactAnimationTrigger: (v) => set((s) => ({
    playerImpactAnimationTrigger: typeof v === 'function' ? v(s.playerImpactAnimationTrigger) : v,
  })),
  setEnemyImpactAnimationTrigger: (v) => set((s) => ({
    enemyImpactAnimationTrigger: typeof v === 'function' ? v(s.enemyImpactAnimationTrigger) : v,
  })),
  setPlayerBowShotTrigger: (v) => set((s) => ({
    playerBowShotTrigger: typeof v === 'function' ? v(s.playerBowShotTrigger) : v,
  })),
  setEnemyBowShotTrigger: (v) => set((s) => ({
    enemyBowShotTrigger: typeof v === 'function' ? v(s.enemyBowShotTrigger) : v,
  })),

  setPlayerBowShotDidHit: (v) => set({ playerBowShotDidHit: v }),
  setEnemyBowShotDidHit: (v) => set({ enemyBowShotDidHit: v }),

  setScreenShake: (v) => set({ screenShake: v }),
}));
