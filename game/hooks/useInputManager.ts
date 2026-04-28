import { useEffect, useRef } from 'react';
import { initInputManager, onAction } from '../mechanics/inputManager';
import type { GameAction } from '../mechanics/inputManager';

/**
 * React hook that wires up the InputManager for a component.
 *
 * - Initializes the global singleton (ref-counted, safe to call multiple times).
 * - Starts mouse/touch/gamepad tracking automatically.
 * - Handler does NOT need to be stable — a ref is used internally.
 *
 * @example
 * useInputManager((action) => {
 *   if (action === 'CONFIRM') handleAttack();
 *   if (action === 'NAV_UP')  moveCursorUp();
 *   if (action === 'PAUSE')   openPauseMenu();
 * });
 */
export function useInputManager(handler: (action: GameAction) => void): void {
  const handlerRef = useRef<(action: GameAction) => void>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const cleanup   = initInputManager();
    const unsub     = onAction((action) => { handlerRef.current(action); });

    return () => {
      unsub();
      cleanup();
    };
  }, []);
}
