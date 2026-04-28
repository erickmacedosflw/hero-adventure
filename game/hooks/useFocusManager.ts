import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import {
  initInputManager,
  onAction,
  onInputModeChange,
  getLastInputType,
} from '../mechanics/inputManager';

// ─── Focus visual styles ──────────────────────────────────────────────────────

const FOCUSED_STYLE: CSSProperties = {
  outline:    '2px solid rgba(255,255,255,0.90)',
  boxShadow:  '0 0 0 4px rgba(255,255,255,0.12), 0 0 14px rgba(255,255,255,0.55)',
  transform:  'scale(1.05)',
  transition: 'outline 150ms ease, box-shadow 150ms ease, transform 150ms ease',
  zIndex:     1,
};

const IDLE_STYLE: CSSProperties = {
  outline:    '2px solid transparent',
  boxShadow:  'none',
  transform:  'scale(1)',
  transition: 'outline 150ms ease, box-shadow 150ms ease, transform 150ms ease',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FocusManagerResult {
  /** Currently focused item index, or null when not in gamepad mode. */
  focusedIndex: number | null;
  /** True when the last input was from a gamepad. */
  isGamepadMode: boolean;
  /**
   * Returns CSS properties for the item at `index`.
   * Apply to the item's `style` prop:
   *   <button style={getFocusStyle(i)} />
   */
  getFocusStyle: (index: number) => CSSProperties;
  /** Manually set the focused item (e.g. on mouse hover entering gamepad mode). */
  setFocusedIndex: (index: number) => void;
}

/**
 * Gamepad-aware focus manager for a list or grid of interactive items.
 *
 * - Activates only when lastInputType === GAMEPAD.
 * - NAV_UP / NAV_LEFT  → move focus up (cyclic).
 * - NAV_DOWN / NAV_RIGHT → move focus down (cyclic).
 * - Applies a white outline + glow + scale to the focused item.
 * - Deactivates (returns null focusedIndex) when mouse/touch is used.
 *
 * @param itemCount  Total number of focusable items in the list.
 *
 * @example
 * const { getFocusStyle, focusedIndex, isGamepadMode } = useFocusManager(skills.length);
 *
 * return skills.map((sk, i) => (
 *   <button
 *     key={sk.id}
 *     style={getFocusStyle(i)}
 *     onClick={() => isGamepadMode && focusedIndex === i ? useSkill(sk) : useSkill(sk)}
 *   >
 *     {sk.name}
 *   </button>
 * ));
 */
export function useFocusManager(itemCount: number): FocusManagerResult {
  const [isGamepadMode, setIsGamepadMode] = useState(
    () => getLastInputType() === 'GAMEPAD',
  );
  const [focusedIndex, setFocusedIndexState] = useState<number | null>(null);

  // Refs so the single useEffect closure always reads current values
  const isGamepadModeRef = useRef(isGamepadMode);
  isGamepadModeRef.current = isGamepadMode;

  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;

  useEffect(() => {
    const cleanupInit = initInputManager();

    // ── Mode changes ────────────────────────────────────────────────────────
    const unsubMode = onInputModeChange((type) => {
      const gp = type === 'GAMEPAD';
      setIsGamepadMode(gp);
      if (gp) {
        // Enter gamepad mode → ensure a focused item exists
        setFocusedIndexState(prev => (prev !== null ? prev : 0));
      }
      // Leaving gamepad mode → keep last index for if player returns to gamepad
    });

    // ── Navigation actions ──────────────────────────────────────────────────
    const unsubAction = onAction((action) => {
      if (!isGamepadModeRef.current) return;
      const count = itemCountRef.current;
      if (count === 0) return;

      if (action === 'NAV_UP' || action === 'NAV_LEFT') {
        setFocusedIndexState(prev => ((prev ?? 0) - 1 + count) % count);
      } else if (action === 'NAV_DOWN' || action === 'NAV_RIGHT') {
        setFocusedIndexState(prev => ((prev ?? 0) + 1) % count);
      }
    });

    return () => {
      unsubMode();
      unsubAction();
      cleanupInit();
    };
  }, []); // stable — dynamic values accessed via refs

  const getFocusStyle = useCallback(
    (index: number): CSSProperties => {
      if (!isGamepadMode || focusedIndex !== index) return IDLE_STYLE;
      return FOCUSED_STYLE;
    },
    [isGamepadMode, focusedIndex],
  );

  const setFocusedIndex = useCallback((index: number) => {
    setFocusedIndexState(index);
  }, []);

  return {
    focusedIndex:    isGamepadMode ? (focusedIndex ?? 0) : null,
    isGamepadMode,
    getFocusStyle,
    setFocusedIndex,
  };
}
