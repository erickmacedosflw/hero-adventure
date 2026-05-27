/**
 * battleVfxStore — zustand store for high-frequency VFX state.
 *
 * Moves floatingTexts + particles OUT of App.tsx so that every combat hit
 * does NOT cause the entire 5800-line App component tree to re-render.
 * Components subscribe individually and only re-render when relevant slices change.
 */
import { create } from 'zustand';
import type { FloatingText, Particle } from '../../types';

// ── Particle budget tracking (module-level — never causes React re-renders) ─
let _budgetWindowStart = 0;
let _budgetSpawnedInWindow = 0;
const BUDGET_WINDOW_MS = 400;
const BUDGET_HARD_CAP = 45;

interface BattleVfxState {
  floatingTexts: FloatingText[];
  particles: Particle[];

  /** Spawn a floating damage/heal/skill/item text over player or enemy. */
  spawnFloatingText: (
    value: string | number,
    target: 'player' | 'enemy',
    type: 'damage' | 'heal' | 'crit' | 'buff' | 'skill' | 'item',
    color?: string,
    iconImage?: string,
  ) => void;

  /**
   * Spawn particles at a world position. Includes budget throttling so
   * that rapid combat hits don't flood the particle pool.
   */
  spawnParticles: (
    position: [number, number, number],
    count: number,
    color: string,
    type: 'explode' | 'heal' | 'spark',
  ) => void;

  /** Remove expired entries from both arrays — call on a ~180ms interval. */
  pruneExpired: () => void;

  /** Clear all VFX, e.g. on battle exit. */
  clearVfx: () => void;
}

export const useBattleVfxStore = create<BattleVfxState>((set) => ({
  floatingTexts: [],
  particles: [],

  spawnFloatingText: (value, target, type, color, iconImage) => {
    // Damage and crit numbers are delayed so they appear after the impact camera
    // has largely arrived at the victim.
    //   • Basic attacks: hit fires at 400–650ms, camera in impact ≥0.35s → add 650ms so
    //     the camera is ~95% arrived before the number shows.
    //   • Skills with 0ms delay: hit fires at ~1ms, camera buffer waits 350ms → add 650ms
    //     so total = 1000ms from attack start, camera is ~75% arrived.
    const delayMs = (type === 'damage' || type === 'crit') ? 650 : 0;

    const doSpawn = () => {
      const id = Math.random().toString(36);
      const nowMs = Date.now();
      const isNamedActionText = type === 'skill' || type === 'item';
      const durationMs =
        type === 'item' ? 1200
        : isNamedActionText ? 2100
        : type === 'crit' ? 1500
        : 1100;

      set((s) => ({
        floatingTexts: [
          ...s.floatingTexts,
          {
            id,
            text: value.toString(),
            iconImage,
            type,
            target,
            xOffset: isNamedActionText ? 0 : Math.random() * 40 - 20,
            yOffset: isNamedActionText ? 0 : Math.random() * 20 - 10,
            durationMs,
            expiresAt: nowMs + durationMs,
            color,
          },
        ].slice(-8),
      }));
    };

    if (delayMs > 0) {
      window.setTimeout(doSpawn, delayMs);
    } else {
      doSpawn();
    }
  },

  spawnParticles: (position, count, color, particleType) => {
    const densityMultiplier = particleType === 'explode' ? 0.72 : particleType === 'spark' ? 0.68 : 0.78;
    const targetCount = Math.max(6, Math.round(count * densityMultiplier));
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const nowMs = Date.now();

    if (now - _budgetWindowStart > BUDGET_WINDOW_MS) {
      _budgetWindowStart = now;
      _budgetSpawnedInWindow = 0;
    }

    const remainingBudget = Math.max(0, BUDGET_HARD_CAP - _budgetSpawnedInWindow);
    const finalCount = Math.max(4, Math.min(targetCount, remainingBudget));
    if (finalCount <= 0) return;

    _budgetSpawnedInWindow += finalCount;
    const shardChance = particleType === 'explode' ? 0.22 : particleType === 'spark' ? 0.14 : 0.08;
    const newParticles: Particle[] = [];

    for (let i = 0; i < finalCount; i++) {
      const isShard = Math.random() < shardChance;
      const spread = particleType === 'heal' ? 0.55 : isShard ? 1.45 : 1.1;
      const lift = particleType === 'heal' ? 1.75 : isShard ? 0.5 : 0.85;

      newParticles.push({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        position: [position[0], position[1], position[2]],
        color,
        scale: particleType === 'heal' ? 0.18 : isShard ? 0.13 : 0.24,
        life: 1.0,
        ttl: particleType === 'heal' ? 0.8 : isShard ? 0.7 : 0.92,
        expiresAt: nowMs + 1100,
        renderMode: isShard ? 'shard3d' : 'sprite2d',
        velocity: [
          (Math.random() - 0.5) * spread * 2,
          (Math.random() - 0.5) * 1.7 + lift,
          (Math.random() - 0.5) * spread * 2,
        ],
      });
    }

    set((s) => ({ particles: [...s.particles, ...newParticles].slice(-80) }));
  },

  pruneExpired: () => {
    const nowMs = Date.now();
    set((s) => {
      const nextTexts = s.floatingTexts.filter(
        (t) => !t.expiresAt || t.expiresAt > nowMs,
      );
      const nextParticles = s.particles.filter(
        (p) => !p.expiresAt || p.expiresAt > nowMs,
      );
      if (
        nextTexts.length === s.floatingTexts.length &&
        nextParticles.length === s.particles.length
      ) {
        return s; // no change — avoid re-render
      }
      return { floatingTexts: nextTexts, particles: nextParticles };
    });
  },

  clearVfx: () => set({ floatingTexts: [], particles: [] }),
}));
