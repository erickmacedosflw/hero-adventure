/**
 * GamepadActionLegend — legenda de controle (fixed bottom-right ou barra inline).
 */

import React, { useEffect } from 'react';
import { useInputMode } from '../../game/hooks/useInputMode';

// Contador global para rastrear quantas legendas inline estão montadas.
// Quando > 0, sinaliza ao GamepadIndicator para se ocultar.
let _inlineLegendCount = 0;
function _incrementInline() {
  _inlineLegendCount++;
  document.body.setAttribute('data-inline-legend', String(_inlineLegendCount));
}
function _decrementInline() {
  _inlineLegendCount = Math.max(0, _inlineLegendCount - 1);
  if (_inlineLegendCount === 0) document.body.removeAttribute('data-inline-legend');
  else document.body.setAttribute('data-inline-legend', String(_inlineLegendCount));
}

interface ButtonIconProps {
  bg: string;
  label: React.ReactNode;
}

function ButtonIcon({ bg, label }: ButtonIconProps) {
  return (
    <div style={{
      width:          26,
      height:         26,
      borderRadius:   '50%',
      background:     bg,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexShrink:     0,
      color:          '#fff',
      fontWeight:     900,
      fontSize:       13,
      fontFamily:     'system-ui, sans-serif',
      lineHeight:     1,
    }}>
      {label}
    </div>
  );
}

type BrandConfig = {
  confirm: { bg: string; label: React.ReactNode };
  cancel:  { bg: string; label: React.ReactNode };
  skill1:  { bg: string; label: React.ReactNode };
  skill2:  { bg: string; label: React.ReactNode };
};

const BRAND_BUTTONS: Record<string, BrandConfig> = {
  xbox:     { confirm: { bg: '#107C10', label: 'A' }, cancel: { bg: '#E52420', label: 'B' }, skill1: { bg: '#0055A5', label: 'X' }, skill2: { bg: '#F7B000', label: 'Y' } },
  sony:     { confirm: { bg: '#0070D1', label: '✕' }, cancel: { bg: '#E80000', label: '○' }, skill1: { bg: '#B54DC0', label: '□' }, skill2: { bg: '#19B86A', label: '△' } },
  nintendo: { confirm: { bg: '#107C10', label: 'A' }, cancel: { bg: '#E52420', label: 'B' }, skill1: { bg: '#0055A5', label: 'X' }, skill2: { bg: '#F7B000', label: 'Y' } },
  generic:  { confirm: { bg: '#4a4a9a', label: 'A' }, cancel: { bg: '#9a4a4a', label: 'B' }, skill1: { bg: '#1a6a9a', label: 'X' }, skill2: { bg: '#9a8a00', label: 'Y' } },
};

const BRAND_META: Record<string, { name: string; accent: string }> = {
  xbox:     { name: 'Xbox',        accent: '#107C10' },
  sony:     { name: 'PlayStation', accent: '#003087' },
  nintendo: { name: 'Nintendo',    accent: '#E60012' },
  generic:  { name: 'Gamepad',     accent: '#4a4a9a' },
};

/** Badge "🎮 Xbox" exibido à esquerda na barra inline */
function BrandBadge({ brand }: { brand: string }) {
  const meta = BRAND_META[brand] ?? BRAND_META.generic;
  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         5,
      borderRadius: 8,
      border:      '1px solid rgba(255,255,255,0.12)',
      background:  'rgba(255,255,255,0.06)',
      padding:     '3px 9px 3px 5px',
      flexShrink:  0,
    }}>
      {/* dot colorido com a cor da marca */}
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: meta.accent, flexShrink: 0,
        boxShadow: `0 0 5px ${meta.accent}80`,
      }} />
      <span style={{
        fontSize: 10, fontWeight: 900, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {meta.name}
      </span>
    </div>
  );
}

interface RowProps {
  bg: string;
  label: React.ReactNode;
  text: string;
}

function LegendRow({ bg, label, text }: RowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <ButtonIcon bg={bg} label={label} />
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
        {text}
      </span>
    </div>
  );
}

function StickRow({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      {/* Ícone analógico: círculo externo (base) + interno (nub) */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: '#3a3a4a', border: '2px solid rgba(255,255,255,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.80)' }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
        {text}
      </span>
    </div>
  );
}

function DPadRow({ text, axis = 'horizontal' }: { text: string; axis?: 'horizontal' | 'vertical' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      {/* D-pad icon: cruz horizontal+vertical */}
      <div style={{ width: 26, height: 26, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* braço vertical */}
        <div style={{ position: 'absolute', width: 8, height: 22, background: '#444', borderRadius: 2 }} />
        {/* braço horizontal */}
        <div style={{ position: 'absolute', width: 22, height: 8, background: '#444', borderRadius: 2 }} />
        {/* setas ativas conforme eixo */}
        {axis === 'horizontal' && (<>
          <span style={{ position: 'absolute', left: 0, color: 'rgba(255,255,255,0.7)', fontSize: 8, lineHeight: 1, fontWeight: 900 }}>&#9664;</span>
          <span style={{ position: 'absolute', right: 0, color: 'rgba(255,255,255,0.7)', fontSize: 8, lineHeight: 1, fontWeight: 900 }}>&#9654;</span>
        </>)}
        {axis === 'vertical' && (<>
          <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: 8, lineHeight: 1, fontWeight: 900 }}>&#9650;</span>
          <span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: 8, lineHeight: 1, fontWeight: 900 }}>&#9660;</span>
        </>)}
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
        {text}
      </span>
    </div>
  );
}

function BumperRow({ text }: { text: string }) {
  const bumperStyle: React.CSSProperties = {
    width: 22, height: 13, borderRadius: '4px 4px 2px 2px',
    background: '#3a3a4a', border: '1px solid rgba(255,255,255,0.30)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 7, fontWeight: 900, color: 'rgba(255,255,255,0.85)',
    letterSpacing: '0.02em',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
        <div style={bumperStyle}>LB</div>
        <div style={bumperStyle}>RB</div>
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
        {text}
      </span>
    </div>
  );
}


export interface LegendExtra {
  /** Which brand button to show ('skill2' = Y/△, 'cancel' = B/○, etc.) */
  button: keyof BrandConfig;
  text: string;
}

interface GamepadActionLegendProps {
  extras?: LegendExtra[];
  showCancel?: boolean;
  showConfirm?: boolean;
  confirmText?: string;
  showScroll?: boolean;
  /** Show D-pad navigation hint row */
  showDPad?: boolean;
  /** Text for the D-pad hint row. Defaults to "Navegar". */
  dPadText?: string;
  /** Which axis to highlight on the D-pad icon. Defaults to 'horizontal'. */
  dPadAxis?: 'horizontal' | 'vertical';
  /** Show LB/RB bumper hint row */
  showLR?: boolean;
  /** Text for the LB/RB hint. Defaults to "Trocar filtro". */
  lrText?: string;
  /** Show X/□ button hint row */
  showSkill1?: boolean;
  /** Text for the X/□ hint. Defaults to "Ação rápida". */
  skill1Text?: string;
  /** Show Y/△ button hint row */
  showSkill2?: boolean;
  /** Text for the Y/△ hint. Defaults to "Detalhe". */
  skill2Text?: string;
  /**
   * When true, renders inline (no position:fixed) so callers can embed the
   * legend inside their own panel layout without overlapping content.
   */
  inline?: boolean;
}

export function GamepadActionLegend({ extras, showCancel = true, showConfirm = true, confirmText = 'Selecionar', showScroll = false, showDPad = false, dPadText = 'Navegar', dPadAxis = 'horizontal', showLR = false, lrText = 'Trocar filtro', showSkill1 = false, skill1Text = 'Ação rápida', showSkill2 = false, skill2Text = 'Detalhe', inline = false }: GamepadActionLegendProps = {}) {
  const { hasGamepad, gamepadBrand } = useInputMode();

  // Hooks SEMPRE antes de qualquer return condicional (Rules of Hooks)
  // Sinaliza ao GamepadIndicator para se ocultar enquanto uma barra inline estiver montada.
  useEffect(() => {
    if (!inline) return;
    _incrementInline();
    return () => _decrementInline();
  }, [inline]);

  if (inline) {
    if (!hasGamepad) return null;

    const cfg = BRAND_BUTTONS[gamepadBrand] ?? BRAND_BUTTONS.generic;
    const controls: React.ReactNode[] = [];
    if (showConfirm) controls.push(<LegendRow key="confirm" bg={cfg.confirm.bg} label={cfg.confirm.label} text={confirmText} />);
    if (showCancel)  controls.push(<LegendRow key="cancel"  bg={cfg.cancel.bg}  label={cfg.cancel.label}  text="Cancelar" />);
    if (showSkill1)  controls.push(<LegendRow key="s1"      bg={cfg.skill1.bg}  label={cfg.skill1.label}  text={skill1Text} />);
    if (showSkill2)  controls.push(<LegendRow key="s2"      bg={cfg.skill2.bg}  label={cfg.skill2.label}  text={skill2Text} />);
    if (showScroll)  controls.push(<StickRow  key="scroll"  text="↑↓ Rolar" />);
    if (showDPad)    controls.push(<DPadRow   key="dpad"    text={dPadText} axis={dPadAxis} />);
    if (showLR)      controls.push(<BumperRow key="lr"      text={lrText} />);
    extras?.forEach((extra, i) => {
      const btn = cfg[extra.button];
      if (btn) controls.push(<LegendRow key={`ex${i}`} bg={btn.bg} label={btn.label} text={extra.text} />);
    });

    return (
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        padding:       '6px 14px 8px',
        background:    'rgba(0,0,0,0.45)',
        borderTop:     '1px solid rgba(255,255,255,0.07)',
        pointerEvents: 'none',
        userSelect:    'none',
        flexShrink:    0,
      }}>
        {/* Esquerda: badge da marca do controle */}
        <BrandBadge brand={gamepadBrand} />

        {/* Separador vertical */}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.10)', margin: '1px 0', flexShrink: 0 }} />

        {/* Direita: ações em linha */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px 12px', flex: 1, justifyContent: 'flex-end' }}>
          {controls}
        </div>
      </div>
    );
  }

  // Non-inline: fixed overlay — hide when no gamepad
  if (!hasGamepad) return null;

  const cfg = BRAND_BUTTONS[gamepadBrand] ?? BRAND_BUTTONS.generic;

  const fixedStyle: React.CSSProperties = {
    position:      'fixed',
    bottom:        '20px',
    right:         '20px',
    zIndex:        9100,
    display:       'flex',
    flexDirection: 'column',
    gap:           '6px',
    padding:       '10px 14px',
    borderRadius:  '14px',
    background:    'rgba(0,0,0,0.55)',
    pointerEvents: 'none',
    userSelect:    'none',
  };

  return (
    <div style={fixedStyle}>
      {showConfirm && <LegendRow bg={cfg.confirm.bg} label={cfg.confirm.label} text={confirmText} />}
      {showCancel  && <LegendRow bg={cfg.cancel.bg}  label={cfg.cancel.label}  text="Cancelar"   />}
      {showSkill1  && <LegendRow bg={cfg.skill1.bg}  label={cfg.skill1.label}  text={skill1Text} />}
      {showSkill2  && <LegendRow bg={cfg.skill2.bg}  label={cfg.skill2.label}  text={skill2Text} />}
      {showScroll  && <StickRow text="↑↓ Rolar" />}
      {showDPad    && <DPadRow  text={dPadText} axis={dPadAxis} />}
      {showLR      && <BumperRow text={lrText} />}
      {extras?.map((extra, i) => {
        const btn = cfg[extra.button];
        if (!btn) return null;
        return <LegendRow key={i} bg={btn.bg} label={btn.label} text={extra.text} />;
      })}
    </div>
  );
}



