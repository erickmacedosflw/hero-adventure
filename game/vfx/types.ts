/**
 * VFX runtime types — shared between the in-game player (`VfxVideoPlayer`)
 * and the authoring editor (`VideoEffectLab`).
 *
 * Mirrors the JSON schema exported by the VideoEffectLab.
 */

export interface VfxLumaKey {
  threshold: number;
  smoothness: number;
  softness: number;
  blackClip: number;
  whiteClip: number;
  edgeSoftness: number;
  alphaFade: number;
  gamma: number;
  contrast: number;
  brightness: number;
  exposure: number;
  saturation: number;
}

export interface VfxRefinement {
  blurAlpha: number;
  edgeBlur: number;
  despillDark: number;
  noiseReduction: number;
  feather: number;
  clampAlpha: number;
  vignette: number;
  vignetteWarmth: number;
  vignetteShape: number;
}

export interface VfxConfig {
  version: string;
  videoFileName: string;
  timeline: { trimIn: number; trimOut: number; duration: number };
  placement: {
    position: [number, number, number];
    scale: number;
    billboard: boolean;
    flipX: boolean;
    flipY: boolean;
  };
  lumaKey: VfxLumaKey;
  refinement: VfxRefinement;
  invertMask: 0 | 1;
  colorTint: { color: string; strength: number };
  videoLight: {
    enabled: boolean;
    intensity: number;
    luminance: number;
    satBoost: number;
    greyThreshold: number;
  };
  playback: { speed: number; loop: boolean; pingPong: boolean };
}

export interface VfxEntry {
  id: string;
  name: string;
  /** Resolved URL of the `.webm` (via Vite `?url` import). */
  videoUrl: string;
  /** Inlined JSON config object. */
  config: VfxConfig;
}
