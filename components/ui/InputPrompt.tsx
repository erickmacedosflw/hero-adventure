/**
 * InputPrompt — Mostra o ícone do botão correto de acordo com o input atual.
 *
 * Troca automaticamente entre Xbox / PlayStation / mouse / teclado conforme
 * o último dispositivo utilizado pelo jogador.
 *
 * @example
 * // Confirmar / Atacar
 * <InputPrompt action="CONFIRM" label="Atacar" />
 *
 * // Voltar / Cancelar
 * <InputPrompt action="BACK" label="Voltar" />
 *
 * // Apenas o ícone, sem label
 * <InputPrompt action="CONFIRM" size={20} />
 *
 * // Forçar tipo (ex: preview na tela de configurações)
 * <InputPrompt action="CONFIRM" forceType="xbox" />
 */

import React, { type CSSProperties } from 'react';
import { useInputMode } from '../../game/hooks/useInputMode';
import { PF } from '../../game/data/promptFont';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PromptAction =
  | 'CONFIRM'     // A / Cross / Click esquerdo / Enter
  | 'BACK'        // B / Circle / Click direito / Escape
  | 'SKILL_1'     // X / Square
  | 'SKILL_2'     // Y / Triangle
  | 'PAUSE'       // Menu / Options / Escape
  | 'NAV_UP'      // D-pad/analógico cima
  | 'NAV_DOWN'    // D-pad/analógico baixo
  | 'NAV_LEFT'    // D-pad/analógico esquerda
  | 'NAV_RIGHT'   // D-pad/analógico direita
  | 'NAV_VERTICAL'   // cima+baixo combinados
  | 'NAV_HORIZONTAL' // esquerda+direita combinados
  | 'L1' | 'R1' | 'L2' | 'R2'; // Shoulders / Triggers

export type PromptControllerType = 'xbox' | 'sony' | 'generic' | 'mouse' | 'keyboard';

// ─── Mapa de ícones por ação × tipo de controle ──────────────────────────────

const ICONS: Record<PromptAction, Record<PromptControllerType, string>> = {
  CONFIRM: {
    xbox:     PF.XBOX_A,
    sony:     PF.SONY_CROSS,
    generic:  PF.GAMEPAD_A,
    mouse:    PF.MOUSE_LEFT,
    keyboard: PF.KEY_ENTER,
  },
  BACK: {
    xbox:     PF.XBOX_B,
    sony:     PF.SONY_CIRCLE,
    generic:  PF.GAMEPAD_B,
    mouse:    PF.MOUSE_RIGHT,
    keyboard: PF.KEY_ESCAPE,
  },
  SKILL_1: {
    xbox:     PF.XBOX_X,
    sony:     PF.SONY_SQUARE,
    generic:  PF.GAMEPAD_X,
    mouse:    PF.MOUSE_LEFT,
    keyboard: PF.KEY_SPACE,
  },
  SKILL_2: {
    xbox:     PF.XBOX_Y,
    sony:     PF.SONY_TRIANGLE,
    generic:  PF.GAMEPAD_Y,
    mouse:    PF.MOUSE_RIGHT,
    keyboard: PF.KEY_SPACE,
  },
  PAUSE: {
    xbox:     PF.XBOX_MENU,
    sony:     PF.SONY_OPTIONS,
    generic:  PF.GAMEPAD_START,
    mouse:    PF.KEY_ESCAPE,
    keyboard: PF.KEY_ESCAPE,
  },
  NAV_UP: {
    xbox:     PF.XBOX_DPAD_UP,
    sony:     PF.XBOX_DPAD_UP,    // D-pad is generic shape
    generic:  PF.XBOX_DPAD_UP,
    mouse:    PF.KEY_UP,
    keyboard: PF.KEY_UP,
  },
  NAV_DOWN: {
    xbox:     PF.XBOX_DPAD_DOWN,
    sony:     PF.XBOX_DPAD_DOWN,
    generic:  PF.XBOX_DPAD_DOWN,
    mouse:    PF.KEY_DOWN,
    keyboard: PF.KEY_DOWN,
  },
  NAV_LEFT: {
    xbox:     PF.XBOX_DPAD_LEFT,
    sony:     PF.XBOX_DPAD_LEFT,
    generic:  PF.XBOX_DPAD_LEFT,
    mouse:    PF.KEY_LEFT,
    keyboard: PF.KEY_LEFT,
  },
  NAV_RIGHT: {
    xbox:     PF.XBOX_DPAD_RIGHT,
    sony:     PF.XBOX_DPAD_RIGHT,
    generic:  PF.XBOX_DPAD_RIGHT,
    mouse:    PF.KEY_RIGHT,
    keyboard: PF.KEY_RIGHT,
  },
  NAV_VERTICAL: {
    xbox:     PF.XBOX_DPAD_UD,
    sony:     PF.XBOX_DPAD_UD,
    generic:  PF.XBOX_DPAD_UD,
    mouse:    PF.KEY_UP,
    keyboard: PF.KEY_UP,
  },
  NAV_HORIZONTAL: {
    xbox:     PF.XBOX_DPAD_LR,
    sony:     PF.XBOX_DPAD_LR,
    generic:  PF.XBOX_DPAD_LR,
    mouse:    PF.KEY_LEFT,
    keyboard: PF.KEY_LEFT,
  },
  L1: {
    xbox:     PF.XBOX_LB,
    sony:     PF.SONY_L1,
    generic:  PF.XBOX_LB,
    mouse:    PF.MOUSE_LEFT,
    keyboard: PF.KEY_SPACE,
  },
  R1: {
    xbox:     PF.XBOX_RB,
    sony:     PF.SONY_R1,
    generic:  PF.XBOX_RB,
    mouse:    PF.MOUSE_RIGHT,
    keyboard: PF.KEY_SPACE,
  },
  L2: {
    xbox:     PF.XBOX_LT,
    sony:     PF.SONY_L2,
    generic:  PF.XBOX_LT,
    mouse:    PF.MOUSE_LEFT,
    keyboard: PF.KEY_SPACE,
  },
  R2: {
    xbox:     PF.XBOX_RT,
    sony:     PF.SONY_R2,
    generic:  PF.XBOX_RT,
    mouse:    PF.MOUSE_RIGHT,
    keyboard: PF.KEY_SPACE,
  },
};

// ─── Cores padrão por tipo de controle ───────────────────────────────────────

const ACCENT_COLOR: Record<PromptControllerType, string> = {
  xbox:     '#52b043', // verde Xbox
  sony:     '#0070d1', // azul PlayStation
  generic:  '#a78bfa', // roxo neutro
  mouse:    '#94a3b8', // cinza azulado
  keyboard: '#94a3b8',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InputPromptProps {
  /** Ação do jogo que este prompt representa */
  action: PromptAction;
  /** Texto opcional ao lado do ícone */
  label?: string;
  /** Tamanho em px do ícone (default: 18) */
  size?: number;
  /** Forçar um tipo específico (ignora o input atual) */
  forceType?: PromptControllerType;
  /** Tipo de controle Sony detectado externamente (default: 'sony') */
  sonyVariant?: 'sony';
  /** Estilo extra no container */
  style?: CSSProperties;
  /** ClassName extra no container */
  className?: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export const InputPrompt: React.FC<InputPromptProps> = ({
  action,
  label,
  size = 18,
  forceType,
  style,
  className = '',
}) => {
  const { uiProfile, gamepadBrand } = useInputMode();

  // Determinar tipo de controle a mostrar
  let controllerType: PromptControllerType;
  if (forceType) {
    controllerType = forceType;
  } else if (uiProfile === 'gamepad') {
    // Usa a marca real detectada via gamepad.id
    controllerType = (gamepadBrand === 'sony' ? 'sony' : 'xbox') as PromptControllerType;
  } else if (uiProfile === 'touch') {
    controllerType = 'generic';
  } else if (uiProfile === 'mouse') {
    controllerType = 'mouse';
  } else {
    controllerType = 'keyboard';
  }

  const icon   = ICONS[action]?.[controllerType] ?? '';
  const accent = ACCENT_COLOR[controllerType];

  const containerStyle: CSSProperties = {
    display:    'inline-flex',
    alignItems: 'center',
    gap:        label ? '5px' : 0,
    lineHeight: 1,
    ...style,
  };

  const iconStyle: CSSProperties = {
    fontFamily:   'PromptFont',
    fontSize:     `${size}px`,
    color:        accent,
    lineHeight:   1,
    display:      'inline-block',
    userSelect:   'none',
    // Smooth transition when input type changes
    transition:   'color 150ms ease, transform 150ms ease',
    flexShrink:   0,
  };

  const labelStyle: CSSProperties = {
    fontSize:   `${Math.round(size * 0.72)}px`,
    color:      'rgba(255,255,255,0.82)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontWeight: 600,
    lineHeight: 1,
    userSelect: 'none',
  };

  return (
    <span style={containerStyle} className={className} aria-label={label ?? action}>
      <span style={iconStyle} aria-hidden="true">{icon}</span>
      {label && <span style={labelStyle}>{label}</span>}
    </span>
  );
};

// ─── Utilitário: linha de prompts múltiplos ───────────────────────────────────

export interface PromptRowProps {
  prompts: Array<{ action: PromptAction; label: string }>;
  size?: number;
  gap?: number;
  style?: CSSProperties;
}

/**
 * Renderiza uma linha de múltiplos prompts.
 *
 * @example
 * <PromptRow prompts={[
 *   { action: 'CONFIRM', label: 'Confirmar' },
 *   { action: 'BACK',    label: 'Voltar' },
 * ]} />
 */
export const PromptRow: React.FC<PromptRowProps> = ({ prompts, size = 16, gap = 14, style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: `${gap}px`,
      flexWrap: 'wrap',
      ...style,
    }}
  >
    {prompts.map(({ action, label }) => (
      <InputPrompt key={action} action={action} label={label} size={size} />
    ))}
  </div>
);
