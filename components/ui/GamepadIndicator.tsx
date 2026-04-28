/**
 * GamepadIndicator — badge fixo bottom-left.
 * Aparece assim que um controle é detectado (hasGamepad).
 * Modo dim: conectado mas ainda não usado. Modo ativo: uiProfile === 'gamepad'.
 */

import React, { useEffect, useState } from 'react';
import { useInputMode } from '../../game/hooks/useInputMode';
import { PF } from '../../game/data/promptFont';

const BRAND_CONFIG = {
  xbox:     { color: '#52b043', icon: PF.XBOX_A,       label: 'XBOX'        },
  sony:     { color: '#0070d1', icon: PF.SONY_CROSS,   label: 'PLAYSTATION' },
  nintendo: { color: '#e60012', icon: PF.GAMEPAD_A,    label: 'NINTENDO'    },
  generic:  { color: '#a78bfa', icon: PF.GAMEPAD_A,    label: 'CONTROLE'    },
} as const;

export function GamepadIndicator() {
  const { uiProfile, hasGamepad, gamepadBrand } = useInputMode();

  // Oculta quando alguma legenda inline está ativa (mochila, loja, alquimista, habilidades)
  const [inlineLegendActive, setInlineLegendActive] = useState(
    () => document.body.hasAttribute('data-inline-legend'),
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setInlineLegendActive(document.body.hasAttribute('data-inline-legend'));
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-inline-legend'] });
    return () => obs.disconnect();
  }, []);

  // Não mostra se nenhum controle detectado
  if (!hasGamepad) return null;

  // Oculta enquanto a barra inline (com badge integrado) estiver visível
  if (inlineLegendActive) return null;

  const cfg = BRAND_CONFIG[gamepadBrand] ?? BRAND_CONFIG.generic;
  const isActive = uiProfile === 'gamepad';

  // Quando detectado mas não usado ainda, mostra badge cinza/dim
  const color  = isActive ? cfg.color : '#888';
  const label  = isActive ? cfg.label : 'DETECTADO';
  const icon   = isActive ? cfg.icon  : PF.GAMEPAD_BUTTONS;

  return (
    <div
      style={{
        position:      'fixed',
        bottom:        '16px',
        left:          '16px',
        zIndex:        9000,
        display:       'flex',
        alignItems:    'center',
        gap:           '6px',
        padding:       '5px 10px 5px 8px',
        borderRadius:  '999px',
        background:    'rgba(10,14,28,0.82)',
        border:        `1px solid ${color}55`,
        backdropFilter:'blur(8px)',
        boxShadow:     `0 0 10px ${color}22, 0 2px 8px rgba(0,0,0,0.4)`,
        pointerEvents: 'none',
        userSelect:    'none',
        opacity:       isActive ? 1 : 0.6,
        transition:    'opacity 300ms, border-color 300ms, box-shadow 300ms',
      }}
    >
      {/* Dot — pulsa quando ativo, estático quando apenas detectado */}
      <span style={{
        width:        '7px',
        height:       '7px',
        borderRadius: '50%',
        flexShrink:   0,
        background:   color,
        boxShadow:    `0 0 6px ${color}`,
        animation:    isActive ? 'pulse 1.6s ease-in-out infinite' : 'none',
      }} />

      {/* Ícone PromptFont */}
      <span style={{
        fontFamily:  'PromptFont',
        fontSize:    '18px',
        lineHeight:  1,
        color:       color,
      }}>
        {icon}
      </span>

      {/* Label */}
      <span style={{
        fontSize:      '9px',
        fontWeight:    700,
        letterSpacing: '0.08em',
        color:         `${color}cc`,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}
