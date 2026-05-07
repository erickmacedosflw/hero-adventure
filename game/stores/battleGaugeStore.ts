/**
 * battleGaugeStore — zustand store for ATB gauge updates.
 *
 * Moves the ATB gauge state OUT of useBattleTimeline's React state so updates
 * (which fire up to 30 times per second) do NOT re-render the App tree.
 * Components that need gauges (SpeedAttributeBar) subscribe directly via the hook.
 */
import { create } from 'zustand';
import type { BattleActorGaugeMap } from '../../types';

interface BattleGaugeState {
  gauges: BattleActorGaugeMap;
  setGauges: (next: BattleActorGaugeMap) => void;
  clearGauges: () => void;
}

export const useBattleGaugeStore = create<BattleGaugeState>((set) => ({
  gauges: {},
  setGauges: (next) => set({ gauges: next }),
  clearGauges: () => set({ gauges: {} }),
}));
