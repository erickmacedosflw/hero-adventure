/**
 * VfxVideoPlayer — runtime player for video-based VFX authored in the
 * `VideoEffectLab` developer tool.
 *
 * Renders a billboarded video plane with the same luma-key + colour-correction
 * shader as the lab, plus an optional video-driven PointLight + PMREM env map.
 *
 * Mounted inside the battle `<Canvas>` (R3F). Looks up the VFX entry from
 * `VFX_REGISTRY` by `vfxId`, anchors the plane at `worldPosition` (offset by
 * the authored `placement.position`), then loops / ping-pongs / one-shots
 * according to `config.playback`.
 *
 * Lifecycle: caller mounts this component; on natural end (one-shot, no loop,
 * no ping-pong) `onComplete` fires. For looped VFX, the caller controls
 * lifetime via `maxDuration` (wall-clock seconds) or by unmounting.
 *
 * Shader code is duplicated verbatim from `VideoEffectLab.tsx`. The lab
 * remains the source of truth for authoring; do not modify shaders here
 * without re-syncing the lab.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { acquireVfxVideo, getVfxById } from '../../game/vfx/registry';
import type { VfxConfig } from '../../game/vfx/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hexToRgb01 = (hex: string): [number, number, number] => {
  const safe = hex.length === 7 && hex[0] === '#' ? hex : '#ffffff';
  return [
    parseInt(safe.slice(1, 3), 16) / 255,
    parseInt(safe.slice(3, 5), 16) / 255,
    parseInt(safe.slice(5, 7), 16) / 255,
  ];
};

// ─── GLSL Shaders ────────────────────────────────────────────────────────────
// Kept in sync with VideoEffectLab.tsx — do not edit independently.

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D videoTex;
  uniform float lumaThreshold;
  uniform float lumaSmoothness;
  uniform float lumaSoftness;
  uniform float blackClip;
  uniform float whiteClip;
  uniform float edgeSoftness;
  uniform float alphaFade;
  uniform float gamma;
  uniform float contrast;
  uniform float brightness;
  uniform float exposure;
  uniform float saturation;
  uniform float despillDark;
  uniform float feather;
  uniform float clampAlpha;
  uniform float blurAlpha;
  uniform float edgeBlur;
  uniform float noiseReduction;
  uniform float invertMask;
  uniform float vignette;
  uniform float vignetteWarmth;
  uniform float vignetteShape;
  uniform float flipX;
  uniform float flipY;
  uniform vec3  colorTint;
  uniform float colorTintStrength;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    uv.x = mix(uv.x, 1.0 - uv.x, flipX);
    uv.y = mix(uv.y, 1.0 - uv.y, flipY);
    vec4 color = texture2D(videoTex, uv);
    vec3 col = color.rgb;

    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

    float halfSmooth = max(0.001, lumaSmoothness * 0.5);
    float mask = smoothstep(lumaThreshold - halfSmooth, lumaThreshold + halfSmooth, luma);

    if (invertMask > 0.5) { mask = 1.0 - mask; }

    if (lumaSoftness > 0.0) {
      mask = pow(clamp(mask, 0.0, 1.0), 1.0 + lumaSoftness * 3.0);
    }

    if (blurAlpha > 0.0) {
      float bStep = blurAlpha * 0.013;
      float sumM = 0.0; float sumW = 0.0;
      float hSB = max(0.001, lumaSmoothness * 0.5);
      for (int bx = -1; bx <= 1; bx++) {
        for (int by_ = -1; by_ <= 1; by_++) {
          float w = float((bx == 0 ? 2 : 1) * (by_ == 0 ? 2 : 1));
          vec2 buv = clamp(uv + vec2(float(bx), float(by_)) * bStep, 0.001, 0.999);
          float bl = dot(texture2D(videoTex, buv).rgb, vec3(0.2126, 0.7152, 0.0722));
          float bm = smoothstep(lumaThreshold - hSB, lumaThreshold + hSB, bl);
          if (invertMask > 0.5) bm = 1.0 - bm;
          sumM += bm * w; sumW += w;
        }
      }
      mask = mix(mask, sumM / sumW, blurAlpha);
    }

    if (edgeBlur > 0.0) {
      float eStep = edgeBlur * 0.022;
      float sumE = 0.0;
      float hSE = max(0.001, lumaSmoothness * 0.5);
      for (int ex = -2; ex <= 2; ex++) {
        for (int ey = -2; ey <= 2; ey++) {
          vec2 euv = clamp(uv + vec2(float(ex), float(ey)) * eStep, 0.001, 0.999);
          float el = dot(texture2D(videoTex, euv).rgb, vec3(0.2126, 0.7152, 0.0722));
          float em = smoothstep(lumaThreshold - hSE, lumaThreshold + hSE, el);
          if (invertMask > 0.5) em = 1.0 - em;
          sumE += em;
        }
      }
      float blurredEdge = sumE / 25.0;
      float edgeZone = smoothstep(0.0, 0.45, mask) * smoothstep(0.0, 0.45, 1.0 - mask);
      mask = mix(mask, blurredEdge, edgeBlur * edgeZone);
    }

    if (noiseReduction > 0.0) {
      float ct = noiseReduction * 0.22;
      mask = smoothstep(ct, ct + max(0.02, lumaSmoothness * 0.5), mask);
    }

    float clampedLuma = clamp((luma - blackClip) / max(0.001, whiteClip - blackClip), 0.0, 1.0);

    if (edgeSoftness > 0.0) {
      float edgeFactor = smoothstep(0.0, edgeSoftness * 0.5, mask) *
                         smoothstep(0.0, edgeSoftness * 0.5, 1.0 - mask);
      mask = mix(mask, edgeFactor, edgeSoftness);
    }

    if (feather > 0.0) {
      float f = feather * 0.45;
      mask = clamp(mix(mask, clamp(mask, f, 1.0 - f), feather), 0.0, 1.0);
    }

    mask = clamp(mask, clampAlpha, 1.0);

    float alpha = clamp(mask * alphaFade, 0.0, 1.0);

    col = col * pow(2.0, exposure);
    col = pow(max(col, vec3(0.0001)), vec3(1.0 / max(0.001, gamma)));
    col = clamp(col + brightness, 0.0, 1.0);
    col = clamp((col - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0);

    float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(gray), col, 1.0 + saturation), 0.0, 1.0);

    if (despillDark > 0.0) {
      float darkMask = 1.0 - clampedLuma;
      col = mix(col, col * (1.0 - despillDark * 0.35 * darkMask), despillDark);
      col = clamp(col, 0.0, 1.0);
    }

    if (vignette > 0.0) {
      vec2 centered = uv * 2.0 - 1.0;
      float distCircle = length(centered);
      float distRect   = max(abs(centered.x), abs(centered.y));
      float dist = mix(distCircle, distRect, vignetteShape);
      float inner = max(0.0, 1.0 - vignette * 0.9);
      float vFactor = 1.0 - smoothstep(inner, 1.0, dist);
      if (vignetteWarmth > 0.0) {
        float edgeZone = (1.0 - vFactor) * smoothstep(0.0, 0.55, vFactor);
        vec3 warmTint = vec3(1.0, 0.28, 0.06);
        col = mix(col, warmTint, vignetteWarmth * edgeZone * 0.75);
        col = clamp(col, 0.0, 1.0);
      }
      alpha *= vFactor;
    }

    if (colorTintStrength > 0.0) {
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float tintMax = max(max(colorTint.r, colorTint.g), max(colorTint.b, 0.001));
      vec3 tintNorm = colorTint / tintMax;
      vec3 recolored = tintNorm * lum;
      col = mix(col, clamp(recolored, 0.0, 1.0), colorTintStrength);
      col = clamp(col, 0.0, 1.0);
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Plane (mesh + shader) ───────────────────────────────────────────────────

interface VfxPlaneProps {
  videoEl: HTMLVideoElement;
  config: VfxConfig;
  aspectRatio: number;
  anchor: [number, number, number]; // world-space anchor (e.g. character chest)
  /** Ref to wall-clock ms timestamp when `playing` first fired (null until then). */
  playStartedAtRef: React.MutableRefObject<number | null>;
  /** Ref to wall-clock ms when VFX should be fully gone (null = play to natural end). */
  endsAtRef: React.MutableRefObject<number | null>;
}

const VfxPlane: React.FC<VfxPlaneProps> = ({ videoEl, config, aspectRatio, anchor, playStartedAtRef, endsAtRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const videoTexture = useMemo(() => {
    const tex = new THREE.VideoTexture(videoEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [videoEl]);

  useEffect(() => () => { videoTexture.dispose(); }, [videoTexture]);

  const tintRgb = useMemo(() => hexToRgb01(config.colorTint.color), [config.colorTint.color]);

  const uniforms = useMemo<Record<string, THREE.IUniform>>(() => ({
    videoTex:          { value: videoTexture },
    lumaThreshold:     { value: config.lumaKey.threshold },
    lumaSmoothness:    { value: config.lumaKey.smoothness },
    lumaSoftness:      { value: config.lumaKey.softness },
    blackClip:         { value: config.lumaKey.blackClip },
    whiteClip:         { value: config.lumaKey.whiteClip },
    edgeSoftness:      { value: config.lumaKey.edgeSoftness },
    alphaFade:         { value: config.lumaKey.alphaFade },
    gamma:             { value: config.lumaKey.gamma },
    contrast:          { value: config.lumaKey.contrast },
    brightness:        { value: config.lumaKey.brightness },
    exposure:          { value: config.lumaKey.exposure },
    saturation:        { value: config.lumaKey.saturation },
    despillDark:       { value: config.refinement.despillDark },
    feather:           { value: config.refinement.feather },
    clampAlpha:        { value: config.refinement.clampAlpha },
    blurAlpha:         { value: config.refinement.blurAlpha },
    edgeBlur:          { value: config.refinement.edgeBlur },
    noiseReduction:    { value: config.refinement.noiseReduction },
    invertMask:        { value: config.invertMask },
    vignette:          { value: config.refinement.vignette },
    vignetteWarmth:    { value: config.refinement.vignetteWarmth },
    vignetteShape:     { value: config.refinement.vignetteShape },
    flipX:             { value: config.placement.flipX ? 1.0 : 0.0 },
    flipY:             { value: config.placement.flipY ? 1.0 : 0.0 },
    colorTint:         { value: new THREE.Vector3(tintRgb[0], tintRgb[1], tintRgb[2]) },
    colorTintStrength: { value: config.colorTint.strength },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Smooth fade envelope: 120 ms fade-in once `playing` fires (hides the
  // stale last-frame from the cached video) + 180 ms fade-out before the
  // hard cutoff so the VFX never pops out abruptly.
  const FADE_IN_MS = 120;
  const FADE_OUT_MS = 180;
  const baseAlphaFadeRef = useRef<number>(config.lumaKey.alphaFade);

  useFrame((state) => {
    videoTexture.needsUpdate = true;
    if (config.placement.billboard && meshRef.current) {
      meshRef.current.quaternion.copy(state.camera.quaternion);
    }
    const mat = materialRef.current;
    if (!mat) return;
    const now = performance.now();
    const startedAt = playStartedAtRef.current;
    const endsAt = endsAtRef.current;
    let envelope = 0;
    if (startedAt !== null) {
      const sinceStart = now - startedAt;
      const fadeIn = Math.min(1, sinceStart / FADE_IN_MS);
      let fadeOut = 1;
      if (endsAt !== null) {
        const remaining = endsAt - now;
        fadeOut = Math.max(0, Math.min(1, remaining / FADE_OUT_MS));
      }
      envelope = fadeIn * fadeOut;
    }
    const u = mat.uniforms.alphaFade;
    if (u) u.value = baseAlphaFadeRef.current * envelope;
  });

  const localPos = config.placement.position;
  const groupPos: [number, number, number] = [
    anchor[0] + localPos[0],
    anchor[1] + localPos[1],
    anchor[2] + localPos[2],
  ];
  const w = config.placement.scale * aspectRatio;
  const h = config.placement.scale;

  return (
    <mesh ref={meshRef} position={groupPos} renderOrder={10}>
      <planeGeometry args={[w, h]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ─── Dynamic lighting (PointLight + PMREM env-map) ───────────────────────────
// Matches VideoSceneLighting from VideoEffectLab.tsx exactly:
//   • 1 PointLight at the video plane world position (lightPos = videoPos)
//   • PMREM env-map rebuilt from video frames every 6 frames, restored on unmount
//   • environmentIntensity = intensity * 5.0 (same formula as the lab)
// This is the only way to replicate the editor's coloured model wrap-around
// without adding a custom shader to each character mesh.

interface VfxLightingProps {
  videoEl: HTMLVideoElement;
  config: VfxConfig;
  /** World-space position of the video plane = anchor + config.placement.position.
   *  Matches the lab's `lightPos = videoPos`. */
  videoPos: [number, number, number];
  playStartedAtRef: React.MutableRefObject<number | null>;
  endsAtRef: React.MutableRefObject<number | null>;
  /** When set, limits the PMREM env-map reach via per-mesh `envMapIntensity`
   *  falloff: objects farther than this distance (world units) from `videoPos`
   *  receive progressively less env-map contribution, reaching zero at the
   *  limit. Undefined = global `scene.environmentIntensity` (no distance limit). */
  lightDistance?: number;
}

const VfxLighting: React.FC<VfxLightingProps> = ({ videoEl, config, videoPos, playStartedAtRef, endsAtRef, lightDistance }) => {
  const { scene, gl } = useThree();
  const frameRef = useRef(0);
  const pointLightRef = useRef<THREE.PointLight>(null);
  // Reusable vectors for per-mesh distance falloff (avoid per-frame allocations)
  const vpVec = useMemo(() => new THREE.Vector3(), []);
  const wPos  = useMemo(() => new THREE.Vector3(), []);
  // Per-mesh envMap state (used only when lightDistance is defined).
  // Three.js v0.181 ignores material.envMapIntensity when scene.environment is
  // active (WebGLRenderer line 2512 overwrites the uniform with
  // scene.environmentIntensity). The only way to get per-mesh intensity control
  // is to assign material.envMap directly and set scene.environment = null.
  const touchedMatsRef   = useRef<Set<THREE.MeshStandardMaterial>>(new Set());
  const perMeshInitRef   = useRef<Set<THREE.MeshStandardMaterial>>(new Set());
  const materialFadesRef = useRef<Map<THREE.MeshStandardMaterial, number>>(new Map());
  const sampleCtx = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    return c.getContext('2d');
  }, []);
  const dominantColor = useRef(new THREE.Color(0, 0, 0));
  const tintRgb = useMemo(() => hexToRgb01(config.colorTint.color), [config.colorTint.color]);
  const tintStrength = config.colorTint.strength;
  const { intensity, luminance, satBoost, greyThreshold } = config.videoLight;
  const FADE_IN_MS = 120;
  const FADE_OUT_MS = 180;
  const sampledOnceRef = useRef(false);

  // PMREM state — setup once, restored on unmount (same lifecycle as the lab)
  const pmremRef = useRef<{
    pmrem: THREE.PMREMGenerator;
    canvas: HTMLCanvasElement;
    canvasTex: THREE.CanvasTexture;
    currentTarget: THREE.WebGLRenderTarget | null;
    originalEnv: THREE.Texture | null;
    originalEnvIntensity: number;
  } | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 32;
    const canvasTex = new THREE.CanvasTexture(canvas);
    canvasTex.mapping = THREE.EquirectangularReflectionMapping;
    canvasTex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    pmremRef.current = {
      pmrem, canvas, canvasTex,
      currentTarget: null,
      originalEnv: scene.environment,
      originalEnvIntensity: (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity ?? 1.0,
    };
    return () => {
      const s = pmremRef.current;
      if (s) {
        scene.environment = s.originalEnv;
        (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = s.originalEnvIntensity;
        s.currentTarget?.dispose();
        s.canvasTex.dispose();
        s.pmrem.dispose();
        pmremRef.current = null;
      }
      // Restore per-mesh env maps set during lightDistance mode.
      // Setting envMap back to null + needsUpdate recompiles the shader without
      // USE_ENVMAP, returning each material to its original state.
      for (const mat of touchedMatsRef.current) {
        mat.envMap = null;
        mat.envMapIntensity = 1.0;
        mat.needsUpdate = true;
      }
      touchedMatsRef.current.clear();
      perMeshInitRef.current.clear();
      materialFadesRef.current.clear();
    };
  }, [gl, scene]);

  useFrame(() => {
    if (videoEl.readyState < 2) return;
    frameRef.current++;

    // Sample dominant colour every 5 frames (cheap 4×4 canvas blit)
    if (sampleCtx && frameRef.current % 5 === 0) {
      sampleCtx.drawImage(videoEl, 0, 0, 4, 4);
      const px = sampleCtx.getImageData(0, 0, 4, 4).data;
      let sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < px.length; i += 4) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; }
      const n = px.length / 4;
      let cr = sr / n / 255, cg = sg / n / 255, cb = sb / n / 255;

      // Apply tint — same max-channel formula as the GLSL shader + VideoSceneLighting
      if (tintStrength > 0) {
        const tr = tintRgb[0], tg = tintRgb[1], tb = tintRgb[2];
        const tMax = Math.max(tr, tg, tb, 0.001);
        const tnr = tr / tMax, tng = tg / tMax, tnb = tb / tMax;
        const lum = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
        const rr = tnr * lum, rg = tng * lum, rb = tnb * lum;
        cr = cr + (rr - cr) * tintStrength;
        cg = cg + (rg - cg) * tintStrength;
        cb = cb + (rb - cb) * tintStrength;
      }

      dominantColor.current.setRGB(cr, cg, cb);
      const hsl = { h: 0, s: 0, l: 0 };
      dominantColor.current.getHSL(hsl);
      // Match VideoSceneLighting colour formula exactly.
      // When authored luminance = 0 (e.g. impulse aura — visual driven by PMREM),
      // use a non-zero fallback so the PointLight still adds directional fill.
      const effectiveLuminance = luminance > 0 ? luminance : 0.38;
      const boosted = Math.min(1, hsl.s * (satBoost > 0 ? satBoost : 1));
      const effectiveSat = Math.max(0.15, boosted - greyThreshold);
      dominantColor.current.setHSL(hsl.h, effectiveSat, effectiveLuminance);
      sampledOnceRef.current = true;
    }

    // Fade envelope — keeps lights in sync with plane fade-in/out
    let envelope = 0;
    const startedAt = playStartedAtRef.current;
    const endsAt = endsAtRef.current;
    if (sampledOnceRef.current && startedAt !== null) {
      const now = performance.now();
      const fadeIn = Math.min(1, (now - startedAt) / FADE_IN_MS);
      let fadeOut = 1;
      if (endsAt !== null) {
        fadeOut = Math.max(0, Math.min(1, (endsAt - now) / FADE_OUT_MS));
      }
      envelope = Math.max(0, fadeIn * fadeOut);
    }

    // PointLight at the video plane position — matches lab's `lightPos = videoPos`
    if (pointLightRef.current) {
      pointLightRef.current.position.set(videoPos[0], videoPos[1], videoPos[2]);
      pointLightRef.current.color.copy(dominantColor.current);
      pointLightRef.current.intensity = intensity * 6.0 * envelope;
    }

    // PMREM env-map — update every 6 frames (~5 fps) with tint applied to pixels
    if (frameRef.current % 6 === 0 && pmremRef.current) {
      const s = pmremRef.current;
      const ctx = s.canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, 64, 32);
        if (tintStrength > 0) {
          const imgData = ctx.getImageData(0, 0, 64, 32);
          const d = imgData.data;
          const tr = tintRgb[0], tg = tintRgb[1], tb = tintRgb[2];
          const tMax = Math.max(tr, tg, tb, 0.001);
          const tnr = tr / tMax, tng = tg / tMax, tnb = tb / tMax;
          for (let i = 0; i < d.length; i += 4) {
            const cr2 = d[i] / 255, cg2 = d[i + 1] / 255, cb2 = d[i + 2] / 255;
            const lum2 = cr2 * 0.2126 + cg2 * 0.7152 + cb2 * 0.0722;
            d[i]     = Math.round((cr2 + (tnr * lum2 - cr2) * tintStrength) * 255);
            d[i + 1] = Math.round((cg2 + (tng * lum2 - cg2) * tintStrength) * 255);
            d[i + 2] = Math.round((cb2 + (tnb * lum2 - cb2) * tintStrength) * 255);
          }
          ctx.putImageData(imgData, 0, 0);
        }
        s.canvasTex.needsUpdate = true;
        const newTarget = s.pmrem.fromEquirectangular(s.canvasTex);
        s.currentTarget?.dispose();
        s.currentTarget = newTarget;

        if (lightDistance !== undefined) {
          // Per-mesh mode: assign envMap directly so material.envMapIntensity
          // is honoured (Three.js only uses material.envMapIntensity when
          // material.envMap !== null; otherwise scene.environmentIntensity wins).
          vpVec.set(videoPos[0], videoPos[1], videoPos[2]);
          materialFadesRef.current.clear();
          scene.traverse((obj) => {
            if (!(obj as THREE.Mesh).isMesh) return;
            const mesh = obj as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mesh.getWorldPosition(wPos);
            const dist = wPos.distanceTo(vpVec);
            const fade = Math.max(0, 1 - dist / lightDistance);
            for (const m of mats) {
              if (!(m as THREE.MeshStandardMaterial)?.isMeshStandardMaterial) continue;
              const sm = m as THREE.MeshStandardMaterial;
              sm.envMap = newTarget.texture;
              if (!perMeshInitRef.current.has(sm)) {
                sm.needsUpdate = true; // one-time recompile to enable USE_ENVMAP
                perMeshInitRef.current.add(sm);
              }
              touchedMatsRef.current.add(sm);
              materialFadesRef.current.set(sm, fade);
            }
          });
        } else {
          scene.environment = newTarget.texture;
        }
      }
    }

    // Env-map intensity — per-frame for smooth fade envelope
    if (lightDistance !== undefined) {
      // Global env disabled; intensity is driven per-material via envMap
      scene.environment = null;
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0;
      for (const [mat, fade] of materialFadesRef.current) {
        mat.envMapIntensity = intensity * 5.0 * envelope * fade;
      }
    } else {
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = intensity * 5.0 * envelope;
    }
  });

  return (
    <pointLight
      ref={pointLightRef}
      position={[videoPos[0], videoPos[1], videoPos[2]]}
      intensity={0}
      distance={10}
      decay={1}
      color={0x000000}
    />
  );
};

// ─── Public component ────────────────────────────────────────────────────────

export interface VfxVideoPlayerProps {
  /** Id from `VFX_REGISTRY` (e.g. `'heal_life'`). */
  vfxId: string;
  /** World-space anchor (typically the target character's chest). */
  worldPosition: [number, number, number];
  /**
   * Optional wall-clock max duration in seconds. After this elapses
   * `onComplete` fires (used to terminate looped VFX after a set time).
   * Ignored if undefined — the VFX runs to its natural end.
   */
  maxDuration?: number;
  /** Optional hex colour override (e.g. `'#ef4444'`) applied to the video's
   *  `colorTint.color`. When supplied, `colorTint.strength` is forced to at
   *  least `tintStrength ?? 0.85` so the recolour is actually visible. */
  tintColor?: string;
  /** Optional override for `colorTint.strength` (0..1). Only used when
   *  `tintColor` is also provided. */
  tintStrength?: number;
  /** When true, force the video element to be muted regardless of authored
   *  config. Used for ambient/persistent loops to avoid audio spam. */
  muted?: boolean;
  /** Force `playback.loop` on/off, overriding the authored config. Used to
   *  run a normally-looping clip as a one-shot (e.g. the impulse-aura start
   *  variant before chaining into the loop variant). */
  loopOverride?: boolean;
  /** Called when playback finishes (natural end or `maxDuration` reached). */
  onComplete?: () => void;
  /** When true, skip mounting the VfxLighting (PMREM + PointLight) for this
   *  instance. Use on short overlay clips that share a persistent PMREM from
   *  another concurrently-mounted VfxVideoPlayer to avoid double shader
   *  compilation and scene.environment conflicts. */
  disableLighting?: boolean;
  /** Forwarded to VfxLighting: limits PMREM env-map reach. Objects farther
   *  than this distance (world units) from the video plane receive less
   *  env-map reflection, reaching zero at the limit.
   *  Undefined = no distance limit (current global behaviour). */
  lightDistance?: number;
}

const VfxVideoPlayer: React.FC<VfxVideoPlayerProps> = ({ vfxId, worldPosition, maxDuration, tintColor, tintStrength, muted, loopOverride, onComplete, disableLighting, lightDistance }) => {
  const baseEntry = getVfxById(vfxId);
  // Apply runtime tint overrides without mutating the registry entry.
  const entry = useMemo(() => {
    if (!baseEntry) return undefined;
    if (tintColor === undefined && loopOverride === undefined) return baseEntry;
    return {
      ...baseEntry,
      config: {
        ...baseEntry.config,
        colorTint: tintColor
          ? {
              color: tintColor,
              strength: tintStrength ?? Math.max(baseEntry.config.colorTint.strength, 0.85),
            }
          : baseEntry.config.colorTint,
        playback: loopOverride === undefined
          ? baseEntry.config.playback
          : { ...baseEntry.config.playback, loop: loopOverride },
      },
    };
  }, [baseEntry, tintColor, tintStrength, loopOverride]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartWallRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);
  const seekReadyRef = useRef(true);
  const pingPongDirRef = useRef<1 | -1>(1);
  const completedRef = useRef(false);
  const mountWallRef = useRef<number>(0);
  // Set when the video element fires its first `playing` event ─ used by the
  // fade-in envelope so we never display the stale last-frame from a cached
  // play ("começa com o fim do vídeo anterior").
  const playStartedAtRef = useRef<number | null>(null);
  // Wall-clock ms when the VFX should be fully invisible (fade-out target).
  // Null = let the video reach its natural end without a forced fade-out.
  const endsAtRef = useRef<number | null>(null);
  const [videoReady, setVideoReady] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState(16 / 9);

  // Stable callback ref (avoid re-running playback effect on parent re-renders)
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const fireComplete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.();
  };

  // Build video element + start playback when entry is available
  useEffect(() => {
    if (!entry) {
      // Unknown id — fail soft, fire complete on next tick so caller can recover.
      const t = window.setTimeout(() => fireComplete(), 0);
      return () => window.clearTimeout(t);
    }
    const { config, videoUrl } = entry;
    // Note: `config.timeline.trimIn/trimOut` are *editor-only* — the exported
    // .webm is already trimmed. At runtime we always play the whole clip.
    const videoIn = 0;
    let videoOut = Number.POSITIVE_INFINITY; // set on loadedmetadata
    const playbackSpeed = config.playback.speed;
    const loop = config.playback.loop;
    const pingPong = config.playback.pingPong;

    const el = acquireVfxVideo(vfxId) ?? document.createElement('video');
    el.muted = muted === true;
    // VFX audio volume (leave headroom for SFX/music). Change here only.
    const VFX_AUDIO_VOLUME = 0.3;
    el.volume = VFX_AUDIO_VOLUME;
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    // Let the browser seamlessly loop short clips when possible. Manual
    // currentTime resets in our tick() are visibly hitchy on sub-second
    // clips (e.g. the 0.4 s impulse aura), so prefer the native loop
    // attribute whenever we don't need ping-pong or a hard wall-clock cutoff.
    const useNativeLoop = loop && !pingPong && maxDuration === undefined;
    el.loop = useNativeLoop;
    // Only (re)assign src if the warm element wasn't already pointing at it.
    if (el.src !== videoUrl && !el.currentSrc.endsWith(videoUrl)) {
      el.src = videoUrl;
      try { el.load(); } catch { /* noop */ }
    }
    el.addEventListener('seeked', () => { seekReadyRef.current = true; });
    // Mark the first real playback frame so the plane fades in only after
    // the decoder produced a fresh frame (avoids showing the cached last
    // frame of a previous play).
    el.addEventListener('playing', () => {
      if (playStartedAtRef.current === null) {
        playStartedAtRef.current = performance.now();
      }
    }, { once: false });
    videoElRef.current = el;
    mountWallRef.current = performance.now();

    const startPlayback = () => {
      const video = videoElRef.current;
      if (!video) return;
      const clampedStart = Math.max(videoIn, Math.min(videoIn, videoOut - 0.01));
      video.playbackRate = playbackSpeed;
      // Always rewind to the intended start before play. New <video> elements
      // start at 0, but if the browser keeps the element warm (cache, dev
      // HMR, etc.) currentTime may carry over from a previous instance.
      video.currentTime = clampedStart;
      // Compute fade-out target. For loop/pingPong with maxDuration, use
      // the wall-clock cutoff; otherwise (one-shot) use natural duration.
      const now = performance.now();
      if (maxDuration !== undefined) {
        endsAtRef.current = mountWallRef.current + maxDuration * 1000;
      } else if (!loop && !pingPong && isFinite(videoOut)) {
        // Estimate end relative to when `playing` fires; we don't know that
        // yet, so seed with start+duration and let the playing handler refine.
        endsAtRef.current = now + ((videoOut - clampedStart) / playbackSpeed) * 1000;
      } else {
        endsAtRef.current = null;
      }
      // Re-assert volume right before play (some browsers clamp it during
      // the load → metadata transition).
      video.volume = VFX_AUDIO_VOLUME;
      // Try with audio; if autoplay policy blocks (no user gesture), fall
      // back to muted so the visual VFX still plays.
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => { if (muted !== true) video.volume = VFX_AUDIO_VOLUME; })
          .catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
      }

      playStartWallRef.current = performance.now();
      playStartTimeRef.current = clampedStart;
      pingPongDirRef.current = 1;
      seekReadyRef.current = true;

      const tick = () => {
        // Hard cutoff via maxDuration (wall clock, independent of video time)
        if (maxDuration !== undefined && performance.now() - mountWallRef.current >= maxDuration * 1000) {
          video.pause();
          fireComplete();
          return;
        }

        // Reverse phase (ping-pong)
        if (pingPong && pingPongDirRef.current === -1) {
          const elapsed = (performance.now() - playStartWallRef.current) / 1000;
          const tBack = playStartTimeRef.current - elapsed * playbackSpeed;
          if (tBack <= videoIn) {
            seekReadyRef.current = true;
            pingPongDirRef.current = 1;
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = videoIn;
            video.currentTime = videoIn;
            video.play().catch(() => {});
          } else if (seekReadyRef.current) {
            seekReadyRef.current = false;
            video.currentTime = tBack;
          }
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // Forward phase
        const elapsed = (performance.now() - playStartWallRef.current) / 1000;
        const t = playStartTimeRef.current + elapsed * playbackSpeed;

        if (t >= videoOut) {
          if (pingPong) {
            pingPongDirRef.current = -1;
            seekReadyRef.current = true;
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = videoOut;
            video.pause();
            video.currentTime = videoOut;
          } else if (loop) {
            // Realign internal wall-clock to the actual video position
            // (native loop already wrapped currentTime back to ~videoIn
            // without a visible hitch). No manual seek needed.
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = video.currentTime;
          } else {
            video.pause();
            fireComplete();
            return;
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    el.onloadedmetadata = () => {
      if (el.videoWidth && el.videoHeight) {
        setAspectRatio(el.videoWidth / el.videoHeight);
      }
      videoOut = isFinite(el.duration) && el.duration > 0 ? el.duration : 3;
      setVideoReady(true);
    };
    // Start playback as soon as the first frame is decoded. Waiting for
    // `canplaythrough` adds noticeable latency (hundreds of ms) on a fresh
    // <video> element even when the asset is in HTTP cache, because the
    // browser is still filling the playback buffer. `loadeddata` fires the
    // moment the decoder has a usable frame — the `playing` event still
    // gates the visual fade-in, so we don't risk showing a black frame.
    const startedRef = { current: false };
    const tryStart = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      startPlayback();
    };
    el.onloadeddata = tryStart;
    el.oncanplay = tryStart;
    el.oncanplaythrough = tryStart;

    // Warm-pool fast path: the pooled <video> often already has metadata +
    // first frame decoded (readyState >= HAVE_CURRENT_DATA = 2). In that case
    // none of the load* events will refire, so kick off playback immediately.
    if (el.readyState >= 2) {
      if (el.videoWidth && el.videoHeight) {
        setAspectRatio(el.videoWidth / el.videoHeight);
      }
      videoOut = isFinite(el.duration) && el.duration > 0 ? el.duration : 3;
      setVideoReady(true);
      tryStart();
    } else {
      el.load();
    }

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      el.pause();
      el.src = '';
      el.load();
      videoElRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vfxId]);

  if (!entry || !videoReady || !videoElRef.current) return null;

  const localPos = entry.config.placement.position;
  const videoPos: [number, number, number] = [
    worldPosition[0] + localPos[0],
    worldPosition[1] + localPos[1],
    worldPosition[2] + localPos[2],
  ];

  return (
    <>
      <VfxPlane
        videoEl={videoElRef.current}
        config={entry.config}
        aspectRatio={aspectRatio}
        anchor={worldPosition}
        playStartedAtRef={playStartedAtRef}
        endsAtRef={endsAtRef}
      />
      {entry.config.videoLight.enabled && !disableLighting ? (
        <VfxLighting
          videoEl={videoElRef.current}
          config={entry.config}
          videoPos={videoPos}
          playStartedAtRef={playStartedAtRef}
          endsAtRef={endsAtRef}
          lightDistance={lightDistance}
        />
      ) : null}
    </>
  );
};

export default VfxVideoPlayer;
