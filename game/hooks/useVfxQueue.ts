/**
 * useVfxQueue — small reducer-less hook that manages a list of active VFX
 * playbacks. Each enqueue gets a unique runtime id; the entry stays in the
 * list until its `<VfxVideoPlayer>` reports completion (or the caller
 * dismisses it explicitly).
 *
 * Multiple VFX may play simultaneously on the same target; the layer simply
 * renders them all.
 */
import { useCallback, useRef, useState } from 'react';

export type VfxTarget = 'player' | 'enemy';

export interface ActiveVfx {
  /** Runtime id (unique per enqueue, NOT the vfx asset id). */
  runtimeId: number;
  vfxId: string;
  target: VfxTarget;
  /** Wall-clock max duration in seconds (forwarded to `<VfxVideoPlayer>`). */
  maxDuration?: number;
  /** Optional hex colour override (e.g. `'#ef4444'`). Overrides the JSON's
   *  `colorTint.color` and forces `colorTint.strength` to 1 if it was 0. */
  tintColor?: string;
  /** Optional override for `colorTint.strength` (0..1). */
  tintStrength?: number;
}

export interface EnqueueVfxOptions {
  vfxId: string;
  target: VfxTarget;
  maxDuration?: number;
  tintColor?: string;
  tintStrength?: number;
  onComplete?: () => void;
}

export interface VfxQueueApi {
  active: ActiveVfx[];
  enqueue: (opts: EnqueueVfxOptions) => number;
  dismiss: (runtimeId: number) => void;
  clear: () => void;
  /** Internal — called by the layer when a VFX naturally completes. */
  _onComplete: (runtimeId: number) => void;
}

export function useVfxQueue(): VfxQueueApi {
  const [active, setActive] = useState<ActiveVfx[]>([]);
  const counterRef = useRef(0);
  const completionsRef = useRef<Map<number, () => void>>(new Map());

  const enqueue = useCallback((opts: EnqueueVfxOptions): number => {
    const runtimeId = ++counterRef.current;
    if (opts.onComplete) completionsRef.current.set(runtimeId, opts.onComplete);
    setActive((prev) => [
      ...prev,
      {
        runtimeId,
        vfxId: opts.vfxId,
        target: opts.target,
        maxDuration: opts.maxDuration,
        tintColor: opts.tintColor,
        tintStrength: opts.tintStrength,
      },
    ]);
    return runtimeId;
  }, []);

  const dismiss = useCallback((runtimeId: number) => {
    completionsRef.current.delete(runtimeId);
    setActive((prev) => prev.filter((v) => v.runtimeId !== runtimeId));
  }, []);

  const clear = useCallback(() => {
    completionsRef.current.clear();
    setActive([]);
  }, []);

  const _onComplete = useCallback((runtimeId: number) => {
    const cb = completionsRef.current.get(runtimeId);
    completionsRef.current.delete(runtimeId);
    setActive((prev) => prev.filter((v) => v.runtimeId !== runtimeId));
    cb?.();
  }, []);

  return { active, enqueue, dismiss, clear, _onComplete };
}
