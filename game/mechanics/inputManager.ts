/**
 * inputManager — Unified input system for Hero Tower.
 *
 * Architecture:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  InputModeManager  tracks lastInputType (MOUSE/TOUCH/GAMEPAD)│
 *  │  GamepadManager    polls Gamepad API, detects real activity  │
 *  │  FocusManager      focusedIndex + cyclic UP/DOWN navigation  │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Rules:
 *  - UI adapts to lastInputType — NOT just because a gamepad is connected.
 *  - Gamepad only becomes active after real input (button press or axis > 0.2).
 *  - Mouse events are suppressed 500ms after touchstart (ghost clicks).
 *  - RAF loop runs continuously when initialized (singleton ref-counted).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputType = 'MOUSE' | 'TOUCH' | 'GAMEPAD';
export type UIProfile = 'mouse' | 'touch' | 'gamepad';

/** Physical controller brand, derived from gamepad.id string. */
export type GamepadBrand = 'xbox' | 'sony' | 'nintendo' | 'generic';

export type GameAction =
  | 'CONFIRM'      // A — select / attack
  | 'BACK'         // B — cancel / close
  | 'SKILL_1'      // X
  | 'SKILL_2'      // Y
  | 'PAUSE'        // Start / Menu
  | 'SHOULDER_L'   // LB — left bumper
  | 'SHOULDER_R'   // RB — right bumper
  | 'NAV_UP'       // D-pad up / left-stick up
  | 'NAV_DOWN'     // D-pad down / left-stick down
  | 'NAV_LEFT'     // D-pad left / left-stick left
  | 'NAV_RIGHT';   // D-pad right / left-stick right

type ActionHandler = (action: GameAction) => void;
type InputModeHandler = (type: InputType) => void;
type BrandHandler = (brand: GamepadBrand) => void;
type GamepadFoundHandler = (found: boolean) => void;

export interface InputState {
  lastInputType: InputType;
  hasGamepad: boolean;
  hasTouch: boolean;
  hasMouse: boolean;
  gamepadBrand: GamepadBrand;
}

// ─── Xbox standard-layout button → GameAction ────────────────────────────────
// https://w3c.github.io/gamepad/#remapping
const BUTTON_MAP: Readonly<Partial<Record<number, GameAction>>> = {
  0:  'CONFIRM',
  1:  'BACK',
  2:  'SKILL_1',
  3:  'SKILL_2',
  4:  'SHOULDER_L',
  5:  'SHOULDER_R',
  9:  'PAUSE',
  12: 'NAV_UP',
  13: 'NAV_DOWN',
  14: 'NAV_LEFT',
  15: 'NAV_RIGHT',
};

// ─── Constants ────────────────────────────────────────────────────────────────
const AXIS_DEADZONE       = 0.2;  // ignore noise below this
const AXIS_NAV_THRESHOLD  = 0.5;  // stick must exceed this to trigger NAV_*
const MOUSE_SUPPRESS_MS   = 500;  // ignore mousemove/mousedown after touchstart

// ─── Singleton state ─────────────────────────────────────────────────────────
const actionHandlers       = new Set<ActionHandler>();
const modeHandlers         = new Set<InputModeHandler>();
const brandHandlers        = new Set<BrandHandler>();
const gamepadFoundHandlers = new Set<GamepadFoundHandler>();

/**
 * Modal input stack — when non-empty, ONLY the top handler fires for actions.
 * Lower handlers (and actionHandlers set) are completely suppressed.
 * Use pushInputLayer() to push a modal overlay (e.g. inventory, dialog).
 */
const modalInputStack: ActionHandler[] = [];

/** Dispatch an action respecting the modal stack. */
function dispatchAction(action: GameAction): void {
  if (modalInputStack.length > 0) {
    modalInputStack[modalInputStack.length - 1](action);
  } else {
    actionHandlers.forEach(h => { h(action); });
  }
}

let _lastInputType: InputType = 'MOUSE';
let _hasGamepad = false;
let _hasTouch   = false;
let _hasMouse   = false;
let _gamepadBrand: GamepadBrand = 'generic';

// ─── Brand detection ──────────────────────────────────────────────────────────
// Gamepad API exposes gamepad.id as a human-readable string like:
//   "Xbox 360 Controller (XInput STANDARD GAMEPAD)"  → xbox
//   "DualSense Wireless Controller (Vendor: 054c)"   → sony
//   "054c" vendor ID (Sony) in the id string         → sony
//   "057e" vendor ID (Nintendo)                      → nintendo
//
// Xbox Vendor IDs on Windows (Microsoft = 045e):
//   045e:02e0 = Xbox One S BT, 045e:02fd = Xbox One S BT (alt)
//   045e:0b00, 0b05, 0b12, 0b20 = Xbox Series X|S variants
const BRAND_PATTERNS: Array<[RegExp, GamepadBrand]> = [
  // Xbox: name, XInput flag, or Microsoft vendor ID 045e
  [/xbox|xinput|microsoft|vendor:\s*045e/i, 'xbox'],
  // Sony: name or vendor ID 054c
  [/dualsense|dualshock|playstation|sony|vendor:\s*054c/i, 'sony'],
  // Nintendo: name or vendor ID 057e
  [/nintendo|vendor:\s*057e|joycon|pro controller/i, 'nintendo'],
];

function detectBrand(id: string): GamepadBrand {
  for (const [pattern, brand] of BRAND_PATTERNS) {
    if (pattern.test(id)) return brand;
  }
  return 'generic';
}

let activeGamepadIndex: number | null = null;
const prevButtonPressed: boolean[] = [];
const prevAxisNav = { up: false, down: false, left: false, right: false };

let lastTouchTime = 0;
let rafId: number | null = null;
let initCount = 0;
// Timer IDs for startup gamepad scan retries (Chromium WGI enumeration delay)
const startupScanTimers: ReturnType<typeof setTimeout>[] = [];

// ─── Internal helpers ─────────────────────────────────────────────────────────

function setInputType(type: InputType): void {
  if (_lastInputType === type) return;
  _lastInputType = type;
  modeHandlers.forEach(h => { h(type); });
}

/** Updates _hasGamepad and notifies subscribers if the value changes. */
function setHasGamepad(found: boolean): void {
  if (_hasGamepad === found) return;
  _hasGamepad = found;
  gamepadFoundHandlers.forEach(h => { h(found); });
}

function setBrand(brand: GamepadBrand): void {
  if (_gamepadBrand === brand) return;
  _gamepadBrand = brand;
  brandHandlers.forEach(h => { h(brand); });
}

// ─── GamepadManager ───────────────────────────────────────────────────────────

function handleGamepadConnected(e: GamepadEvent): void {
  activeGamepadIndex = e.gamepad.index;
  setHasGamepad(true);
  setBrand(detectBrand(e.gamepad.id));
  // Note: do NOT switch UI here — wait for real button/axis activity.
}

function handleGamepadDisconnected(e: GamepadEvent): void {
  if (activeGamepadIndex !== e.gamepad.index) return;
  activeGamepadIndex = null;
  prevButtonPressed.length = 0;
  prevAxisNav.up = prevAxisNav.down = prevAxisNav.left = prevAxisNav.right = false;
  const stillHas = Array.from(navigator.getGamepads()).some(g => g !== null);
  if (!stillHas) {
    setHasGamepad(false);
    setBrand('generic');
    if (_lastInputType === 'GAMEPAD') setInputType('MOUSE');
  } else {
    // Update brand to next active gamepad
    const next = Array.from(navigator.getGamepads()).find(g => g !== null);
    if (next) { activeGamepadIndex = next.index; setBrand(detectBrand(next.id)); }
    if (_lastInputType === 'GAMEPAD') setInputType('MOUSE');
  }
}

function pollGamepadFrame(): void {
  // Auto-detect if no gamepad registered yet via events.
  // This catches controllers connected BEFORE the page loaded (no gamepadconnected event).
  if (activeGamepadIndex === null) {
    const all = navigator.getGamepads();
    for (let i = 0; i < all.length; i++) {
      if (all[i]) {
        activeGamepadIndex = i;
        setHasGamepad(true);
        setBrand(detectBrand(all[i]!.id));
        break;
      }
    }
    if (activeGamepadIndex === null) return;
  }

  const gp = navigator.getGamepads()[activeGamepadIndex];
  if (!gp) return;

  // Keep brand in sync in case id changes (e.g. Steam Input remapping)
  setBrand(detectBrand(gp.id));

  let hasRealActivity = false;

  // Axis deadzone check — any axis above deadzone counts as real activity
  for (let i = 0; i < gp.axes.length; i++) {
    if (Math.abs(gp.axes[i]) > AXIS_DEADZONE) { hasRealActivity = true; break; }
  }

  // Button scan — edge-triggered.
  // Uses btn.pressed || btn.value > 0.5 because some Xbox BT controllers
  // on Windows report value but keep pressed=false in certain polling modes.
  gp.buttons.forEach((btn, i) => {
    const isDown = btn.pressed || btn.value > 0.5;
    const wasPressed = prevButtonPressed[i] ?? false;
    if (isDown && !wasPressed) {
      hasRealActivity = true;
      const action = BUTTON_MAP[i];
      if (action) dispatchAction(action);
    }
    prevButtonPressed[i] = isDown;
  });

  // Left stick navigation — edge-triggered, with threshold
  const axisX = gp.axes[0] ?? 0;
  const axisY = gp.axes[1] ?? 0;
  const navUp    = axisY < -AXIS_NAV_THRESHOLD;
  const navDown  = axisY >  AXIS_NAV_THRESHOLD;
  const navLeft  = axisX < -AXIS_NAV_THRESHOLD;
  const navRight = axisX >  AXIS_NAV_THRESHOLD;

  if (navUp    && !prevAxisNav.up)    { dispatchAction('NAV_UP');    }
  if (navDown  && !prevAxisNav.down)  { dispatchAction('NAV_DOWN');  }
  if (navLeft  && !prevAxisNav.left)  { dispatchAction('NAV_LEFT');  }
  if (navRight && !prevAxisNav.right) { dispatchAction('NAV_RIGHT'); }

  prevAxisNav.up    = navUp;
  prevAxisNav.down  = navDown;
  prevAxisNav.left  = navLeft;
  prevAxisNav.right = navRight;

  if (hasRealActivity) setInputType('GAMEPAD');
}

// ─── InputModeManager — mouse & touch ─────────────────────────────────────────

function handleMouseMove(): void {
  if (Date.now() - lastTouchTime < MOUSE_SUPPRESS_MS) return;
  _hasMouse = true;
  setInputType('MOUSE');
}

function handleMouseDown(): void {
  if (Date.now() - lastTouchTime < MOUSE_SUPPRESS_MS) return;
  _hasMouse = true;
  setInputType('MOUSE');
}

function handleTouchStart(): void {
  lastTouchTime = Date.now();
  _hasTouch = true;
  setInputType('TOUCH');
}

// ─── Startup gamepad scan ─────────────────────────────────────────────────────
// Chromium (with GamepadButtonAxisEvents) may take up to ~200ms to enumerate
// gamepads connected before page load. We retry several times at startup so
// the badge/legend appears as fast as possible without waiting for a button press.
function startupScanOnce(): void {
  if (activeGamepadIndex !== null) return; // already found
  const all = navigator.getGamepads();
  for (let i = 0; i < all.length; i++) {
    if (all[i]) {
      activeGamepadIndex = i;
      setHasGamepad(true);
      setBrand(detectBrand(all[i]!.id));
      return;
    }
  }
}

function scheduleStartupScans(): void {
  // Scan at 100ms, 300ms, 600ms, 1000ms, 2000ms, 4000ms after init
  for (const delay of [100, 300, 600, 1000, 2000, 4000]) {
    startupScanTimers.push(setTimeout(startupScanOnce, delay));
  }
}

function cancelStartupScans(): void {
  while (startupScanTimers.length) clearTimeout(startupScanTimers.pop()!);
}

// Rescan when the window regains focus (e.g. alt-tab with controller)
function handleWindowFocus(): void { startupScanOnce(); }

// ─── RAF loop ─────────────────────────────────────────────────────────────────

function loop(): void {
  pollGamepadFrame();
  rafId = requestAnimationFrame(loop);
}

function startListeners(): void {
  window.addEventListener('gamepadconnected',    handleGamepadConnected);
  window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
  window.addEventListener('mousemove',           handleMouseMove,  { passive: true });
  window.addEventListener('mousedown',           handleMouseDown,  { passive: true });
  window.addEventListener('touchstart',          handleTouchStart, { passive: true });
  window.addEventListener('focus',               handleWindowFocus);
  rafId = requestAnimationFrame(loop);
  scheduleStartupScans();
}

function stopListeners(): void {
  window.removeEventListener('gamepadconnected',    handleGamepadConnected);
  window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
  window.removeEventListener('mousemove',           handleMouseMove);
  window.removeEventListener('mousedown',           handleMouseDown);
  window.removeEventListener('touchstart',          handleTouchStart);
  window.removeEventListener('focus',               handleWindowFocus);
  cancelStartupScans();
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  actionHandlers.clear();
  modeHandlers.clear();
  prevButtonPressed.length = 0;
  prevAxisNav.up = prevAxisNav.down = prevAxisNav.left = prevAxisNav.right = false;
  activeGamepadIndex = null;
  _hasGamepad = _hasTouch = _hasMouse = false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start input tracking. Ref-counted — safe to call from multiple components.
 * @returns Cleanup function — call on unmount.
 */
export function initInputManager(): () => void {
  initCount++;
  if (initCount === 1) startListeners();

  return () => {
    initCount--;
    if (initCount <= 0) {
      initCount = 0;
      stopListeners();
    }
  };
}

/** Subscribe to game actions (button presses, nav). Returns unsubscribe fn. */
export function onAction(handler: ActionHandler): () => void {
  actionHandlers.add(handler);
  return () => { actionHandlers.delete(handler); };
}

/**
 * Push an exclusive input layer (modal overlay).
 * While this layer is active, NO other handlers fire — only this one.
 * Returns a cleanup function that pops the layer when called.
 *
 * @example
 *   useEffect(() => pushInputLayer(action => { ... }), []);
 */
export function pushInputLayer(handler: ActionHandler): () => void {
  modalInputStack.push(handler);
  return () => {
    const idx = modalInputStack.lastIndexOf(handler);
    if (idx !== -1) modalInputStack.splice(idx, 1);
  };
}

/**
 * Returns true when any modal input layer is active (e.g. inventory, dialog).
 * Use this in hold-X RAFs to prevent firing while an overlay has exclusive input.
 */
export function hasModalLayer(): boolean {
  return modalInputStack.length > 0;
}

/**
 * Returns whether a specific gamepad button is currently held down.
 * buttonIndex follows the standard Gamepad API layout (0=A, 1=B, 4=LB, 5=RB…).
 */
export function isButtonDown(buttonIndex: number): boolean {
  return prevButtonPressed[buttonIndex] === true;
}

/** Subscribe to input mode changes (MOUSE / TOUCH / GAMEPAD). Returns unsubscribe fn. */
export function onInputModeChange(handler: InputModeHandler): () => void {
  modeHandlers.add(handler);
  return () => { modeHandlers.delete(handler); };
}

/**
 * Subscribe to gamepad brand changes (xbox / sony / nintendo / generic).
 * Fires immediately if a gamepad is already connected.
 * Returns unsubscribe fn.
 */
export function onGamepadBrandChange(handler: BrandHandler): () => void {
  brandHandlers.add(handler);
  return () => { brandHandlers.delete(handler); };
}

/**
 * Subscribe to gamepad found/lost events.
 * Fires both when a gamepad is connected (found=true) and disconnected (found=false).
 * Also fires when the RAF loop detects a gamepad that was connected before page load.
 * Returns unsubscribe fn.
 */
export function onGamepadFound(handler: GamepadFoundHandler): () => void {
  gamepadFoundHandlers.add(handler);
  return () => { gamepadFoundHandlers.delete(handler); };
}

/** Current last-used input device. */
export function getLastInputType(): InputType { return _lastInputType; }

/** UI profile string for the last-used input device. */
export function getCurrentUIProfile(): UIProfile {
  return _lastInputType.toLowerCase() as UIProfile;
}

/** Full snapshot of input device state. */
export function getInputState(): InputState {
  return {
    lastInputType: _lastInputType,
    hasGamepad:   _hasGamepad,
    hasTouch:     _hasTouch,
    hasMouse:     _hasMouse,
    gamepadBrand: _gamepadBrand,
  };
}

/**
 * Brand of the currently connected gamepad, detected via gamepad.id.
 * Returns 'generic' when no gamepad is connected.
 */
export function getGamepadBrand(): GamepadBrand { return _gamepadBrand; }

/**
 * @deprecated RAF loop now runs automatically inside initInputManager.
 * Kept for API compatibility with existing call sites.
 */
export function pollGamepad(): void { /* no-op — loop runs in RAF */ }
