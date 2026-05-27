import { create } from 'zustand';

interface CinematicCameraState {
  /** World-space point the DOF lens focuses on. */
  dofTarget: [number, number, number];
  /** Half-range (world units) around `dofTarget` that stays in focus. */
  dofFocusRange: number;
  /** Bokeh disc scale — higher = more background blur. */
  dofBokehScale: number;
  /** Extra bloom intensity added on top of the scene preset value. */
  bloomBoost: number;
  /**
   * True while a battle is the active view. Activates DOF even in presets
   * that don't normally enable it (balanced / performance).
   */
  battleDofActive: boolean;
  /**
   * Incrementing counter. When it changes, CameraController triggers a brief
   * "enemy intro" zoom toward the new enemy, then returns to wide view.
   */
  enemyIntroToken: number;
  setCinematicCamera: (
    patch: Partial<Omit<CinematicCameraState, 'setCinematicCamera'>>,
  ) => void;
}

export const useCinematicCameraStore = create<CinematicCameraState>((set) => ({
  dofTarget:      [0, 0.9, 0],
  dofFocusRange:  5.0,
  dofBokehScale:  0.4,
  bloomBoost:     0,
  battleDofActive: false,
  enemyIntroToken: 0,
  setCinematicCamera: (patch) => set(patch),
}));
