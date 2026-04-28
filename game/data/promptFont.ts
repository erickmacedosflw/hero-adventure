/**
 * promptFont — PromptFont codepoint constants for Hero Tower.
 *
 * Font: PromptFont by Yukari "Shinmera" Hafner
 * License: SIL Open Font License
 * Source: https://shinmera.com/promptfont
 *
 * Usage:
 *   import { PF } from './promptFont';
 *   <span style={{ fontFamily: 'PromptFont' }}>{PF.XBOX_A}</span>
 *
 * Or use the <InputPrompt> component which auto-selects the right icon.
 */

/** Single character from a unicode codepoint */
const ch = (cp: number): string => String.fromCodePoint(cp);

// ─── Xbox ─────────────────────────────────────────────────────────────────────
export const PF = {
  // Face buttons
  XBOX_A:              ch(0x21D3),
  XBOX_B:              ch(0x21D2),
  XBOX_X:              ch(0x21D0),
  XBOX_Y:              ch(0x21D1),
  // Shoulders / Triggers
  XBOX_LB:             ch(0x2198),
  XBOX_RB:             ch(0x2199),
  XBOX_LT:             ch(0x2196),
  XBOX_RT:             ch(0x2197),
  // System
  XBOX_MENU:           ch(0x21FB), // ≡ (hamburger)
  XBOX_VIEW:           ch(0x21FA), // ⧉ (back/view)
  // D-Pad
  XBOX_DPAD_UP:        ch(0x219F),
  XBOX_DPAD_DOWN:      ch(0x21A1),
  XBOX_DPAD_LEFT:      ch(0x219E),
  XBOX_DPAD_RIGHT:     ch(0x21A0),
  XBOX_DPAD_UD:        ch(0x21A3),
  XBOX_DPAD_LR:        ch(0x21A2),
  XBOX_DPAD:           ch(0x21CE),

  // ─── Sony / PlayStation ────────────────────────────────────────────────────
  // Face buttons (Cross/Circle/Square/Triangle)
  SONY_CROSS:          ch(0x21E3), // Cross   ✕  (= Confirm in most games)
  SONY_CIRCLE:         ch(0x21E2), // Circle  ○  (= Back in most games)
  SONY_SQUARE:         ch(0x21E0), // Square  □
  SONY_TRIANGLE:       ch(0x21E1), // Triangle △
  // System
  SONY_OPTIONS:        ch(0x21E8), // Options (menu)
  SONY_SHARE:          ch(0x21E6), // Share / Create
  // Shoulders
  SONY_L1:             ch(0x219C),
  SONY_R1:             ch(0x219D),
  SONY_L2:             ch(0x219A),
  SONY_R2:             ch(0x219B),

  // ─── Generic gamepad (fallback) ────────────────────────────────────────────
  GAMEPAD_A:           ch(0x21A7),
  GAMEPAD_B:           ch(0x21A6),
  GAMEPAD_X:           ch(0x21A4),
  GAMEPAD_Y:           ch(0x21A5),
  GAMEPAD_START:       ch(0x21F8),
  GAMEPAD_SELECT:      ch(0x21F7),
  GAMEPAD_BUTTONS:     ch(0x21A8),
  // Analog sticks
  ANALOG_L_UP:         ch(0x21BE),
  ANALOG_L_DOWN:       ch(0x21C2),
  ANALOG_L_LEFT:       ch(0x21BC),
  ANALOG_L_RIGHT:      ch(0x21C0),
  ANALOG_L_UD:         ch(0x21C5),
  ANALOG_L_LR:         ch(0x21C4),
  ANALOG_L_CLICK:      ch(0x21BA),
  ANALOG_R_UP:         ch(0x21BF),
  ANALOG_R_DOWN:       ch(0x21C3),
  ANALOG_R_LEFT:       ch(0x21BD),
  ANALOG_R_RIGHT:      ch(0x21C1),
  ANALOG_R_UD:         ch(0x21C7),   // reuse analog-left for vertical hint
  ANALOG_R_LR:         ch(0x21C6),
  ANALOG_R_CLICK:      ch(0x21BB),

  // ─── Mouse ─────────────────────────────────────────────────────────────────
  MOUSE_LEFT:          ch(0x27F5),
  MOUSE_RIGHT:         ch(0x27F6),
  MOUSE_LR:            ch(0x27FA),

  // ─── Keyboard ──────────────────────────────────────────────────────────────
  KEY_ENTER:           ch(0x242E),
  KEY_ESCAPE:          ch(0x242F),
  KEY_SPACE:           ch(0x2423),
  KEY_UP:              ch(0x2191),
  KEY_DOWN:            ch(0x2193),
  KEY_LEFT:            ch(0x2190),
  KEY_RIGHT:           ch(0x2192),
} as const;

export type PFKey = keyof typeof PF;
