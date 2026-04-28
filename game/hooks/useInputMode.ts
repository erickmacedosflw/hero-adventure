import { useEffect, useState } from 'react';
import {
  initInputManager,
  onInputModeChange,
  onGamepadBrandChange,
  onGamepadFound,
  getInputState,
} from '../mechanics/inputManager';
import type { InputType, UIProfile, InputState, GamepadBrand } from '../mechanics/inputManager';

export type { InputType, UIProfile, GamepadBrand };

export interface InputModeState extends InputState {
  /** Lowercase UI profile string: "mouse" | "touch" | "gamepad" */
  uiProfile: UIProfile;
}

export function useInputMode(): InputModeState {
  const [state, setState] = useState<InputModeState>(() => {
    const s = getInputState();
    const profile: UIProfile = s.hasGamepad ? 'gamepad' : (s.lastInputType.toLowerCase() as UIProfile);
    return { ...s, uiProfile: profile };
  });

  useEffect(() => {
    const cleanup = initInputManager();

    const unsub = onInputModeChange((type) => {
      const s = getInputState();
      // Once a gamepad has been detected, keep gamepad mode sticky —
      // accidental mouse/touch events don't kick us out of gamepad UI.
      const profile: UIProfile = s.hasGamepad ? 'gamepad' : (type.toLowerCase() as UIProfile);
      setState(prev => ({ ...prev, ...s, uiProfile: profile }));
    });

    // Re-render when brand changes (e.g. Xbox → DualSense hotswap)
    const unsubBrand = onGamepadBrandChange(() => {
      const s = getInputState();
      setState(prev => ({ ...prev, ...s }));
    });

    // Re-render when gamepad connects/disconnects so hasGamepad updates instantly
    const unsubFound = onGamepadFound((found) => {
      const s = getInputState();
      // Switching to gamepad profile as soon as the pad is found
      setState(prev => ({ ...prev, ...s, uiProfile: found ? 'gamepad' : prev.uiProfile }));
    });

    return () => { unsub(); unsubBrand(); unsubFound(); cleanup(); };
  }, []);

  return state;
}
