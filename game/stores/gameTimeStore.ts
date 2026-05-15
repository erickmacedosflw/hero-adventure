/**
 * gameTimeStore - moves gameTime OUT of App state.
 * DayNightCycle writes here directly (no prop callback),
 * so the 2x/second update never triggers an App re-render.
 * GameUI / BattleHUD read with useGameTimeStore() and only
 * those small clock widgets re-render.
 */
import { create } from 'zustand';

interface GameTimeState {
  gameTime: string;
  setGameTime: (t: string) => void;
}

export const useGameTimeStore = create<GameTimeState>((set) => ({
  gameTime: '12:00',
  setGameTime: (t) => set((state) => (state.gameTime === t ? state : { gameTime: t })),
}));
