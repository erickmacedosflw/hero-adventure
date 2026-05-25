/**
 * BattleVfxLayer — renders all active video VFX inside the battle `<Canvas>`.
 *
 * Mounted as a sibling of the player/enemy characters. Anchors each VFX at
 * the supplied world-space position for its target (player chest by default,
 * enemy chest by default).
 *
 * Driven by the `useVfxQueue` hook exposed from the parent (typically `App.tsx`).
 */
import React from 'react';

import VfxVideoPlayer from './VfxVideoPlayer';
import type { VfxQueueApi } from '../../game/hooks/useVfxQueue';

export interface BattleVfxLayerProps {
  queue: VfxQueueApi;
  /** World-space anchor for player-targeted VFX (chest height). */
  playerAnchor?: [number, number, number];
  /** World-space anchor for enemy-targeted VFX (chest height). */
  enemyAnchor?: [number, number, number];
}

const DEFAULT_PLAYER_ANCHOR: [number, number, number] = [-2, 0.4, 0];
const DEFAULT_ENEMY_ANCHOR:  [number, number, number] = [ 2, 0.4, 0];

const BattleVfxLayer: React.FC<BattleVfxLayerProps> = ({
  queue,
  playerAnchor = DEFAULT_PLAYER_ANCHOR,
  enemyAnchor = DEFAULT_ENEMY_ANCHOR,
}) => (
  <>
    {queue.active.map((v) => (
      <VfxVideoPlayer
        key={v.runtimeId}
        vfxId={v.vfxId}
        worldPosition={v.target === 'player' ? playerAnchor : enemyAnchor}
        maxDuration={v.maxDuration}
        tintColor={v.tintColor}
        tintStrength={v.tintStrength}
        onComplete={() => queue._onComplete(v.runtimeId)}
      />
    ))}
  </>
);

export default BattleVfxLayer;
