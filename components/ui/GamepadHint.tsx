/**
 * GamepadHint — Toast discreto exibido quando um gamepad é detectado
 * mas o Chromium ainda não o "desbloqueou" (exige primeiro botão).
 *
 * Desaparece permanentemente ao primeiro input do controle — nunca reaparece.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  initInputManager,
  onInputModeChange,
  onGamepadFound,
  getInputState,
} from '../../game/mechanics/inputManager';
import { PF } from '../../game/data/promptFont';

export function GamepadHint() {
  const [show, setShow] = useState(false);
  // Uma vez que o controle foi usado, nunca mais exibe o hint
  const activatedRef = useRef(false);

  useEffect(() => {
    const cleanup = initInputManager();

    const checkShow = () => {
      // Se já ativou alguma vez, fecha para sempre
      if (activatedRef.current) { setShow(false); return; }

      const s = getInputState();
      if (s.lastInputType === 'GAMEPAD') {
        activatedRef.current = true;
        setShow(false);
        return;
      }
      // Só exibe se controle detectado e ainda não ativado
      setShow(s.hasGamepad);
    };

    const unsubFound = onGamepadFound(() => checkShow());
    const unsubMode  = onInputModeChange(() => checkShow());
    const interval   = setInterval(checkShow, 1000);

    checkShow();

    return () => {
      unsubFound();
      unsubMode();
      clearInterval(interval);
      cleanup();
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position:       'fixed',
        bottom:         '20px',
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         9999,
        display:        'flex',
        alignItems:     'center',
        gap:            '8px',
        padding:        '8px 16px',
        borderRadius:   '999px',
        background:     'rgba(15,23,42,0.85)',
        border:         '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
        pointerEvents:  'none',
        userSelect:     'none',
        whiteSpace:     'nowrap',
      }}
    >
      <span style={{ fontFamily: 'PromptFont', fontSize: '20px', color: '#52b043', lineHeight: 1 }}>
        {PF.GAMEPAD_BUTTONS}
      </span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.78)', letterSpacing: '0.04em' }}>
        Controle detectado — pressione{' '}
        <span style={{ color: '#52b043' }}>
          <span style={{ fontFamily: 'PromptFont', fontSize: '14px', verticalAlign: 'middle' }}>{PF.XBOX_A}</span>
          {' '}no controle
        </span>
        {' '}para ativar
      </span>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: '#52b043',
        boxShadow: '0 0 6px #52b043',
        animation: 'pulse 1.2s ease infinite',
        flexShrink: 0,
      }} />
    </div>
  );
}
