/**
 * useEffekseer — React Three Fiber hook for optional Effekseer WASM runtime.
 *
 * Effekseer is NOT available on npm. To enable .efk playback:
 *  1. Download effekseer.min.js + effekseer.wasm from
 *     https://github.com/effekseer/EffekseerForWebGL/releases
 *  2. Place both files in   public/effekseer/
 *  3. The hook will dynamically load the script and initialise the context.
 *
 * Without those files the hook returns { ready: false } and the Effect Lab
 * falls back to procedural Three.js effects.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const EFFEKSEER_JS_URL = '/effekseer/effekseer.min.js';
const EFFEKSEER_WASM_URL = '/effekseer/effekseer.wasm';

export interface EffekseerHandle {
  /** True once the runtime has been initialised */
  ready: boolean;
  /** Error string if init failed (e.g. files not found) */
  error: string | null;
  /** Play a .efk effect at a world position; returns a handle id */
  play: (efkUrl: string, position?: [number, number, number]) => void;
  /** Stop current playback */
  stop: () => void;
}

// Module-level cache so the script is only appended once per page load.
let _scriptLoaded = false;
let _scriptLoading = false;
const _onLoadCallbacks: Array<() => void> = [];
const _onErrorCallbacks: Array<(e: string) => void> = [];

function loadEffekseerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_scriptLoaded) { resolve(); return; }
    _onLoadCallbacks.push(resolve);
    _onErrorCallbacks.push(reject);
    if (_scriptLoading) return;
    _scriptLoading = true;
    const s = document.createElement('script');
    s.src = EFFEKSEER_JS_URL;
    s.onload = () => {
      _scriptLoaded = true;
      _onLoadCallbacks.forEach((cb) => cb());
    };
    s.onerror = () => {
      _onErrorCallbacks.forEach((cb) =>
        cb('effekseer.min.js not found. Place it in public/effekseer/')
      );
    };
    document.head.appendChild(s);
  });
}

/** Poll until window.effekseer.createContext exists (Emscripten async init). */
function waitForEffekseerGlobal(timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      // Try common global names: effekseer, Effekseer
      const eff = (window as any).effekseer ?? (window as any).Effekseer;
      if (eff && typeof eff.createContext === 'function') {
        resolve(eff);
        return;
      }
      if (Date.now() > deadline) {
        reject(
          'effekseer global not ready after 5 s. ' +
          'Make sure effekseer.min.js + effekseer.wasm are in public/effekseer/'
        );
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function useEffekseer(efkUrl: string, isPlaying: boolean): EffekseerHandle {
  const { gl, camera, scene } = useThree();
  const contextRef = useRef<any>(null);
  const effectRef = useRef<any>(null);
  const handleRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise Effekseer context once we have the WebGL renderer
  useEffect(() => {
    let cancelled = false;
    loadEffekseerScript()
      .then(() => waitForEffekseerGlobal())
      .then((eff) => {
        if (cancelled) return;
        const ctx = eff.createContext();
        ctx.init(gl.getContext(), EFFEKSEER_WASM_URL, () => {
          if (cancelled) return;
          contextRef.current = ctx;
          setReady(true);
        }, (errMsg: string) => {
          if (cancelled) return;
          setError(errMsg ?? 'Failed to init Effekseer WASM');
        });
      })
      .catch((err: string) => {
        if (!cancelled) setError(typeof err === 'string' ? err : String(err));
      });

    return () => {
      cancelled = true;
      if (contextRef.current) {
        try { contextRef.current.release(); } catch { /* noop */ }
        contextRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // Load .efk when URL changes
  useEffect(() => {
    if (!ready || !efkUrl || !contextRef.current) return;
    const ctx = contextRef.current;
    effectRef.current = ctx.loadEffect(efkUrl, 1.0, () => {
      // loaded
    }, (errMsg: string) => {
      setError(`Failed to load .efk: ${errMsg}`);
    });
    return () => {
      if (effectRef.current) {
        try { ctx.releaseEffect(effectRef.current); } catch { /* noop */ }
        effectRef.current = null;
      }
    };
  }, [ready, efkUrl]);

  // Play / stop
  useEffect(() => {
    if (!ready || !contextRef.current || !effectRef.current) return;
    if (isPlaying) {
      handleRef.current = contextRef.current.play(effectRef.current, 0, 0, 0);
    } else {
      if (handleRef.current != null) {
        try { contextRef.current.stopEffect(handleRef.current); } catch { /* noop */ }
        handleRef.current = null;
      }
    }
  }, [ready, isPlaying, efkUrl]);

  // Per-frame update + draw (hooks into R3F render loop)
  useFrame((_, delta) => {
    if (!ready || !contextRef.current) return;
    contextRef.current.setTime(delta);
    contextRef.current.update(delta * 60); // Effekseer expects frames (60fps base)
    const cam = camera as THREE.PerspectiveCamera;
    const pArr = cam.projectionMatrix.toArray();
    const vArr = cam.matrixWorldInverse.toArray();
    contextRef.current.setProjectionMatrix(Float32Array.from(pArr));
    contextRef.current.setCameraMatrix(Float32Array.from(vArr));
    contextRef.current.draw();
    // Restore Three.js state after Effekseer draw
    gl.resetState();
  });

  const play = useCallback((url: string, position?: [number, number, number]) => {
    if (!ready || !contextRef.current) return;
    const h = contextRef.current.play(effectRef.current, ...(position ?? [0, 0, 0]));
    handleRef.current = h;
  }, [ready]);

  const stop = useCallback(() => {
    if (!ready || !contextRef.current || handleRef.current == null) return;
    try { contextRef.current.stopEffect(handleRef.current); } catch { /* noop */ }
    handleRef.current = null;
  }, [ready]);

  return { ready, error, play, stop };
}
