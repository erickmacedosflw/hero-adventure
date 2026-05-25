/**
 * PersistentImpulseAura — declarative video VFX that mirrors the
 * "impulso ativo" charge of a battle actor.
 *
 * When `level > 0` we mount the muted `impulse_aura_loop` immediately so it
 * starts spinning underneath, AND we layer the audible `impulse_aura_start`
 * one-shot on top for the first ~0.4 s. When the start clip ends we just
 * unmount it — the loop is already playing, so the transition has no visible
 * gap or freeze.
 *
 * Tint colours follow the same tier mapping used by the impulse UI badge:
 *   level 1 → red, 2 → purple, 3+ → blue.
 *
 * Rendered inside the battle `<Canvas>` (R3F) — typically as a sibling of
 * the player/enemy meshes, anchored at the character's group origin via
 * `worldPosition` (matches the lab's `[0, -1, 0]` reference).
 */
import React, { useState } from 'react';

import VfxVideoPlayer from './VfxVideoPlayer';

const IMPULSE_LEVEL_COLOR: Record<number, string> = {
  1: '#ef4444',
  2: '#a855f7',
  3: '#3b82f6',
};

const getImpulseColor = (level: number): string =>
  IMPULSE_LEVEL_COLOR[Math.max(1, Math.min(3, level))] ?? IMPULSE_LEVEL_COLOR[3];

export interface PersistentImpulseAuraProps {
  /** World-space group anchor of the target actor (same y as the character
   *  group's `originPosition`, typically `y = -1`). */
  worldPosition: [number, number, number];
  /** Current active impulse level (0 = no aura, 1/2/3 = red/purple/blue). */
  level: number;
}

const PersistentImpulseAura: React.FC<PersistentImpulseAuraProps> = ({ worldPosition, level }) => {
  const [startDone, setStartDone] = useState(false);

  if (level <= 0) return null;

  const tintColor = getImpulseColor(level);

  return (
    <>
      {/* Persistent muted loop — provides continuous PMREM + PointLight glow.
       *  Renders first (underneath) so start clip overlays on top of it. */}
      <VfxVideoPlayer
        vfxId="impulse_aura_loop"
        worldPosition={worldPosition}
        tintColor={tintColor}
        tintStrength={1.0}
        muted
        lightDistance={2}
      />
      {/* One-shot start with audio, layered on top until it ends.
       *  disableLighting so we don't run two PMREMGenerators simultaneously
       *  (loop already has the persistent lighting). */}
      {!startDone ? (
        <VfxVideoPlayer
          vfxId="impulse_aura_start"
          worldPosition={worldPosition}
          tintColor={tintColor}
          tintStrength={1.0}
          loopOverride={false}
          disableLighting
          onComplete={() => setStartDone(true)}
        />
      ) : null}
    </>
  );
};

export default PersistentImpulseAura;
