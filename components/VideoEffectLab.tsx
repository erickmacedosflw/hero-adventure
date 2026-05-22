/**
 * VideoEffectLab — Developer lab for authoring video-based special attack effects.
 *
 * Features:
 *  • Upload MP4 video + MP3 audio as separate files
 *  • Real-time luma key GLSL shader applied to the video plane in 3D
 *  • Free-drag positioning of the video plane over a hero reference character
 *  • Dual-track timeline with trim handles for video and audio independently
 *  • Export JSON config (positions, luma key params, timing) + original files
 */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ENEMY_DATA } from '../constants';
import { getPlayerClassById, PLAYER_CLASSES } from '../game/data/classes';
import type { PlayerClassId } from '../types';
import { hasRuntimeFbxAssets } from './scene3d/animation';
import { AnimatedClassHero, EnemyCharacter } from './scene3d/characters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LumaKeyParams {
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

interface RefinementParams {
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

interface VideoEffectConfig {
  version: string;
  videoFileName: string;
  audioFileName: string;
  timeline: {
    videoIn: number;
    videoOut: number;
    audioOffset: number;
    audioIn: number;
    audioOut: number;
    totalDuration: number;
  };
  placement: {
    position: [number, number, number];
    scale: number;
  };
  lumaKey: LumaKeyParams;
  refinement: RefinementParams;
  playback: {
    speed: number;
    loop: boolean;
  };
}

const DEFAULT_LUMA: LumaKeyParams = {
  threshold: 0.12,
  smoothness: 0.08,
  softness: 0.0,
  blackClip: 0.0,
  whiteClip: 1.0,
  edgeSoftness: 0.0,
  alphaFade: 1.0,
  gamma: 1.0,
  contrast: 0.0,
  brightness: 0.0,
  exposure: 0.0,
  saturation: 0.0,
};

const DEFAULT_REFINEMENT: RefinementParams = {
  blurAlpha: 0.0,
  edgeBlur: 0.0,
  despillDark: 0.0,
  noiseReduction: 0.0,
  feather: 0.0,
  clampAlpha: 0.0,
  vignette: 0.0,
  vignetteWarmth: 0.0,
  vignetteShape: 0.0,
};

// ─── GLSL Shaders ────────────────────────────────────────────────────────────

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
  uniform float blurAlpha;    // suaviza a borda do mask inteiro (3x3 blur)
  uniform float edgeBlur;     // suaviza somente a zona de transição (5x5 edge-only)
  uniform float noiseReduction; // comprime valores near-0 → elimina ruido no alpha
  uniform float invertMask; // 0.0 = remove fundo escuro (preto), 1.0 = remove fundo claro (branco)
  uniform float vignette;       // 0 = off, 1 = fade total nas bordas
  uniform float vignetteWarmth; // 0 = só transparência, 1 = tinte quente nas bordas
  uniform float vignetteShape;  // 0 = circular (cantos arredondados), 1 = retangular (bordas planas)
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(videoTex, vUv);
    vec3 col = color.rgb;

    // Luminance (BT.709)
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

    // Luma key mask — por padrão remove escuros (fundo preto)
    float halfSmooth = max(0.001, lumaSmoothness * 0.5);
    float mask = smoothstep(lumaThreshold - halfSmooth, lumaThreshold + halfSmooth, luma);

    // Inverter para fundo branco/claro
    if (invertMask > 0.5) { mask = 1.0 - mask; }

    // Softness curve
    if (lumaSoftness > 0.0) {
      mask = pow(clamp(mask, 0.0, 1.0), 1.0 + lumaSoftness * 3.0);
    }

    // ── Refinement: Blur Alpha — 3×3 weighted box blur on the mask ──────────
    if (blurAlpha > 0.0) {
      float bStep = blurAlpha * 0.013;
      float sumM = 0.0; float sumW = 0.0;
      float hSB = max(0.001, lumaSmoothness * 0.5);
      for (int bx = -1; bx <= 1; bx++) {
        for (int by_ = -1; by_ <= 1; by_++) {
          float w = float((bx == 0 ? 2 : 1) * (by_ == 0 ? 2 : 1));
          vec2 buv = clamp(vUv + vec2(float(bx), float(by_)) * bStep, 0.001, 0.999);
          float bl = dot(texture2D(videoTex, buv).rgb, vec3(0.2126, 0.7152, 0.0722));
          float bm = smoothstep(lumaThreshold - hSB, lumaThreshold + hSB, bl);
          if (invertMask > 0.5) bm = 1.0 - bm;
          sumM += bm * w; sumW += w;
        }
      }
      mask = mix(mask, sumM / sumW, blurAlpha);
    }

    // ── Refinement: Edge Blur — 5×5 blur applied only at mask boundaries ────
    if (edgeBlur > 0.0) {
      float eStep = edgeBlur * 0.022;
      float sumE = 0.0;
      float hSE = max(0.001, lumaSmoothness * 0.5);
      for (int ex = -2; ex <= 2; ex++) {
        for (int ey = -2; ey <= 2; ey++) {
          vec2 euv = clamp(vUv + vec2(float(ex), float(ey)) * eStep, 0.001, 0.999);
          float el = dot(texture2D(videoTex, euv).rgb, vec3(0.2126, 0.7152, 0.0722));
          float em = smoothstep(lumaThreshold - hSE, lumaThreshold + hSE, el);
          if (invertMask > 0.5) em = 1.0 - em;
          sumE += em;
        }
      }
      float blurredEdge = sumE / 25.0;
      // Blend only where mask is in the transition zone (0.05 – 0.95)
      float edgeZone = smoothstep(0.0, 0.45, mask) * smoothstep(0.0, 0.45, 1.0 - mask);
      mask = mix(mask, blurredEdge, edgeBlur * edgeZone);
    }

    // ── Refinement: Noise Reduction — choke near-transparent areas ──────────
    if (noiseReduction > 0.0) {
      float ct = noiseReduction * 0.22;
      mask = smoothstep(ct, ct + max(0.02, lumaSmoothness * 0.5), mask);
    }

    // Black/White clip on the luma range
    float clampedLuma = clamp((luma - blackClip) / max(0.001, whiteClip - blackClip), 0.0, 1.0);

    // Edge softness — attenuate near edges of mask
    if (edgeSoftness > 0.0) {
      float edgeFactor = smoothstep(0.0, edgeSoftness * 0.5, mask) *
                         smoothstep(0.0, edgeSoftness * 0.5, 1.0 - mask);
      mask = mix(mask, edgeFactor, edgeSoftness);
    }

    // Feather — compress alpha range away from 0/1 extremes
    if (feather > 0.0) {
      float f = feather * 0.45;
      mask = clamp(mix(mask, clamp(mask, f, 1.0 - f), feather), 0.0, 1.0);
    }

    // Clamp alpha floor
    mask = clamp(mask, clampAlpha, 1.0);

    // Final alpha
    float alpha = clamp(mask * alphaFade, 0.0, 1.0);

    // ── Color corrections ──────────────────────────────────────────────
    // Exposure
    col = col * pow(2.0, exposure);

    // Gamma
    col = pow(max(col, vec3(0.0001)), vec3(1.0 / max(0.001, gamma)));

    // Brightness
    col = clamp(col + brightness, 0.0, 1.0);

    // Contrast
    col = clamp((col - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0);

    // Saturation
    float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(gray), col, 1.0 + saturation), 0.0, 1.0);

    // Despill dark (approximate: suppress colour in dark areas being keyed)
    if (despillDark > 0.0) {
      float darkMask = 1.0 - clampedLuma;
      col = mix(col, col * (1.0 - despillDark * 0.35 * darkMask), despillDark);
      col = clamp(col, 0.0, 1.0);
    }

    // ── Vignette — fade bordas para transparente com ardência quente opcional ─
    if (vignette > 0.0) {
      vec2 centered = vUv * 2.0 - 1.0;
      // Forma: 0=circular (cantos arredondados), 1=retangular (todas as bordas iguais)
      float distCircle = length(centered);
      float distRect   = max(abs(centered.x), abs(centered.y));
      float dist = mix(distCircle, distRect, vignetteShape);
      // Fade: começa em inner, chega a alpha=0 exatamente na borda do plano (dist=1)
      float inner = max(0.0, 1.0 - vignette * 0.9);
      float vFactor = 1.0 - smoothstep(inner, 1.0, dist);
      // Zona de ardência — anel de transição onde o vídeo vai sumindo
      if (vignetteWarmth > 0.0) {
        float edgeZone = (1.0 - vFactor) * smoothstep(0.0, 0.55, vFactor);
        vec3 warmTint = vec3(1.0, 0.28, 0.06); // laranja-vermelho quente
        col = mix(col, warmTint, vignetteWarmth * edgeZone * 0.75);
        col = clamp(col, 0.0, 1.0);
      }
      alpha *= vFactor;
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── 3D VideoPlane component ─────────────────────────────────────────────────

interface VideoPlaneProps {
  videoEl: HTMLVideoElement;
  lumaKey: LumaKeyParams;
  refinement: RefinementParams;
  invertMask: number;
  position: [number, number, number];
  scale: number;
  aspectRatio: number;
  interactive: boolean;
  billboard: boolean;
  onPositionChange: (pos: [number, number, number]) => void;
  onScaleChange: (scale: number) => void;
}

const VideoPlane: React.FC<VideoPlaneProps> = ({
  videoEl,
  lumaKey,
  refinement,
  invertMask,
  position,
  scale,
  aspectRatio,
  interactive,
  billboard,
  onPositionChange,
  onScaleChange,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const dragRef = useRef<{ x: number; y: number; pos: [number, number, number] } | null>(null);

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

  const uniforms = useMemo<Record<string, THREE.IUniform>>(
    () => ({
      videoTex: { value: videoTexture },
      lumaThreshold: { value: lumaKey.threshold },
      lumaSmoothness: { value: lumaKey.smoothness },
      lumaSoftness: { value: lumaKey.softness },
      blackClip: { value: lumaKey.blackClip },
      whiteClip: { value: lumaKey.whiteClip },
      edgeSoftness: { value: lumaKey.edgeSoftness },
      alphaFade: { value: lumaKey.alphaFade },
      gamma: { value: lumaKey.gamma },
      contrast: { value: lumaKey.contrast },
      brightness: { value: lumaKey.brightness },
      exposure: { value: lumaKey.exposure },
      saturation: { value: lumaKey.saturation },
      despillDark: { value: refinement.despillDark },
      feather: { value: refinement.feather },
      clampAlpha: { value: refinement.clampAlpha },
      blurAlpha: { value: refinement.blurAlpha },
      edgeBlur: { value: refinement.edgeBlur },
      noiseReduction: { value: refinement.noiseReduction },
      invertMask: { value: 0.0 },
      vignette: { value: refinement.vignette },
      vignetteWarmth: { value: refinement.vignetteWarmth },
      vignetteShape: { value: refinement.vignetteShape },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Sync uniforms every frame (cheap — just value assignment, no re-compile)
  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat) return;
    // Billboard — always face camera
    if (billboard && meshRef.current) {
      meshRef.current.quaternion.copy(state.camera.quaternion);
    }
    videoTexture.needsUpdate = true;
    mat.uniforms.lumaThreshold.value = lumaKey.threshold;
    mat.uniforms.lumaSmoothness.value = lumaKey.smoothness;
    mat.uniforms.lumaSoftness.value = lumaKey.softness;
    mat.uniforms.blackClip.value = lumaKey.blackClip;
    mat.uniforms.whiteClip.value = lumaKey.whiteClip;
    mat.uniforms.edgeSoftness.value = lumaKey.edgeSoftness;
    mat.uniforms.alphaFade.value = lumaKey.alphaFade;
    mat.uniforms.gamma.value = lumaKey.gamma;
    mat.uniforms.contrast.value = lumaKey.contrast;
    mat.uniforms.brightness.value = lumaKey.brightness;
    mat.uniforms.exposure.value = lumaKey.exposure;
    mat.uniforms.saturation.value = lumaKey.saturation;
    mat.uniforms.despillDark.value = refinement.despillDark;
    mat.uniforms.feather.value = refinement.feather;
    mat.uniforms.clampAlpha.value = refinement.clampAlpha;
    mat.uniforms.blurAlpha.value = refinement.blurAlpha;
    mat.uniforms.edgeBlur.value = refinement.edgeBlur;
    mat.uniforms.noiseReduction.value = refinement.noiseReduction;
    mat.uniforms.invertMask.value = invertMask;
    mat.uniforms.vignette.value = refinement.vignette;
    mat.uniforms.vignetteWarmth.value = refinement.vignetteWarmth;
    mat.uniforms.vignetteShape.value = refinement.vignetteShape;
  });

  const w = scale * aspectRatio;
  const h = scale;

  return (
    <mesh
      ref={meshRef}
      position={position}
      renderOrder={10}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        dragRef.current = { x: e.clientX, y: e.clientY, pos: [...position] as [number, number, number] };
        (e.target as unknown as THREE.Mesh).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!interactive || !dragRef.current) return;
        e.stopPropagation();
        const dx = (e.clientX - dragRef.current.x) * 0.012;
        const dy = (e.clientY - dragRef.current.y) * 0.012;
        const next: [number, number, number] = [...dragRef.current.pos];
        if (e.shiftKey) {
          next[2] = dragRef.current.pos[2] + dy;
        } else {
          next[0] = dragRef.current.pos[0] + dx;
          next[1] = dragRef.current.pos[1] - dy;
        }
        onPositionChange(next);
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerLeave={() => { dragRef.current = null; }}
      onWheel={(e) => {
        if (!interactive) return;
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        onScaleChange(Math.max(0.1, scale + delta));
      }}
    >
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

// ─── 3D Stage (Canvas) ───────────────────────────────────────────────────────

interface VideoStageProps {
  videoEl: HTMLVideoElement | null;
  lumaKey: LumaKeyParams;
  refinement: RefinementParams;
  invertMask: number;
  videoPos: [number, number, number];
  videoScale: number;
  videoAspect: number;
  heroClassId: PlayerClassId;
  previewReference: 'hero' | 'enemy';
  enemyIndex: number;
  lockOrbit: boolean;
  videoLight: boolean;
  videoLightIntensity: number;
  videoLightLuminance: number;
  videoLightSatBoost: number;
  videoLightGreyThreshold: number;
  billboard: boolean;
  onPositionChange: (pos: [number, number, number]) => void;
  onScaleChange: (scale: number) => void;
}

const VideoStage: React.FC<VideoStageProps> = ({
  videoEl,
  lumaKey,
  refinement,
  invertMask,
  videoPos,
  videoScale,
  videoAspect,
  heroClassId,
  previewReference,
  enemyIndex,
  lockOrbit,
  videoLight,
  videoLightIntensity,
  videoLightLuminance,
  videoLightSatBoost,
  videoLightGreyThreshold,
  billboard,
  onPositionChange,
  onScaleChange,
}) => {
  const heroAssets = getPlayerClassById(heroClassId).assets;
  const hero = hasRuntimeFbxAssets(heroAssets) ? heroAssets : null;
  const enemy = ENEMY_DATA[Math.max(0, Math.min(enemyIndex, ENEMY_DATA.length - 1))];
  const enemyAssets = hasRuntimeFbxAssets(enemy.assets) ? enemy.assets : undefined;

  return (
    <Canvas camera={{ position: [0, 1.5, 7.0], fov: 36 }} dpr={[1, 1.4]}>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={1.0} />
      <hemisphereLight intensity={0.6} color="#dbeafe" groundColor="#0f172a" />
      <directionalLight position={[4, 8, 5]} intensity={1.2} castShadow={false} />

      {/* Floor disc */}
      <mesh position={[0, -1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.5, 48]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>

      {/* Reference character */}
      {previewReference === 'hero' && hero ? (
        <Suspense fallback={null}>
          <group position={[0, -1, 0]} rotation={[0, 0.28, 0]}>
            <AnimatedClassHero assets={hero} animationAction="battle-idle" hasWeapon={false} previewLoopAllActions />
          </group>
        </Suspense>
      ) : null}
      {previewReference === 'enemy' ? (
        <Suspense fallback={null}>
          <EnemyCharacter
            assets={enemyAssets}
            scale={enemy.scale ?? 1.05}
            attackStyle={enemy.attackStyle ?? 'unarmed'}
            animationActionOverride="battle-idle"
            originPosition={[0, -1, 0]}
            baseRotationY={-Math.PI - 0.35}
          />
        </Suspense>
      ) : null}

      <ContactShadows position={[0, -1.06, 0]} opacity={0.35} scale={8} blur={2.4} />

      {/* Video environment — uses the video frames as a dynamic IBL env map, exactly like a skybox */}
      {videoLight && videoEl ? (
        <VideoSceneLighting
          videoEl={videoEl}
          intensity={videoLightIntensity}
          luminance={videoLightLuminance}
          satBoost={videoLightSatBoost}
          greyThreshold={videoLightGreyThreshold}
        />
      ) : null}

      {/* Video plane overlay */}
      {videoEl ? (
        <VideoPlane
          videoEl={videoEl}
          lumaKey={lumaKey}
          refinement={refinement}
          invertMask={invertMask}
          position={videoPos}
          scale={videoScale}
          aspectRatio={videoAspect}
          interactive={lockOrbit}
          billboard={billboard}
          onPositionChange={onPositionChange}
          onScaleChange={onScaleChange}
        />
      ) : null}

      <OrbitControls
        enabled={!lockOrbit}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
        target={[0, 0.5, 0]}
      />
    </Canvas>
  );
};

// ─── Video Scene Lighting ─────────────────────────────────────────────────────
// Camera-following PointLight: positioned at the camera each frame so it ONLY
// illuminates surfaces facing the camera (front of the hero). Back surfaces stay
// unaffected. Same principle as a key-light in photography/cinema.
// Also updates PMREM env-map for reflections on metallic/glossy surfaces.

interface VideoSceneLightingProps {
  videoEl: HTMLVideoElement;
  intensity: number;       // 0–1  overall strength
  luminance: number;       // 0–1  how bright the projected colour is (default 0.42)
  satBoost: number;        // 0–2  multiply the sampled saturation (default 1.0)
  greyThreshold: number;   // 0–0.5  ignore frames below this saturation (default 0.08)
}

const VideoSceneLighting: React.FC<VideoSceneLightingProps> = ({ videoEl, intensity, luminance, satBoost, greyThreshold }) => {
  const { scene, gl } = useThree();
  const frameRef = useRef(0);
  const pointLightRef = useRef<THREE.PointLight>(null);
  // Tiny 4×4 canvas — extremely cheap, used for colour sampling every frame
  const sampleCtx = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    return c.getContext('2d');
  }, []);
  const dominantColor = useRef(new THREE.Color(0, 0, 0));

  // PMREM state — setup once, cleaned up on unmount
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
      if (!s) return;
      scene.environment = s.originalEnv;
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = s.originalEnvIntensity;
      s.currentTarget?.dispose();
      s.canvasTex.dispose();
      s.pmrem.dispose();
      pmremRef.current = null;
    };
  }, [gl, scene]);

  useFrame((state) => {
    if (videoEl.readyState < 2) return;

    // ── Sample dominant colour every frame (4×4 → negligible GPU cost) ──
    if (sampleCtx) {
      sampleCtx.drawImage(videoEl, 0, 0, 4, 4);
      const px = sampleCtx.getImageData(0, 0, 4, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      const n = px.length / 4;
      dominantColor.current.setRGB(r / n / 255, g / n / 255, b / n / 255);
      // Strip brightness — keep only hue + controlled saturation at fixed luminance
      const hsl = { h: 0, s: 0, l: 0 };
      dominantColor.current.getHSL(hsl);
      const boosted = Math.min(1, hsl.s * satBoost);
      const effectiveSat = Math.max(0, boosted - greyThreshold);
      dominantColor.current.setHSL(hsl.h, effectiveSat, luminance);
    }

    // ── PointLight follows camera — only front-facing surfaces are lit ──
    if (pointLightRef.current) {
      pointLightRef.current.position.copy(state.camera.position);
      pointLightRef.current.color.copy(dominantColor.current);
      pointLightRef.current.intensity = intensity * 6.0;
    }

    // ── PMREM env-map — update every 6 frames (~5 fps, GPU-heavy) ──
    frameRef.current++;
    if (frameRef.current % 6 === 0 && pmremRef.current) {
      const s = pmremRef.current;
      const ctx = s.canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, 64, 32);
        s.canvasTex.needsUpdate = true;
        const newTarget = s.pmrem.fromEquirectangular(s.canvasTex);
        s.currentTarget?.dispose();
        s.currentTarget = newTarget;
        scene.environment = newTarget.texture;
      }
    }
    (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = intensity * 5.0;
  });

  return (
    // PointLight at camera origin (updated every frame via ref) — illuminates
    // only the surfaces that face the camera, leaving the back of the hero dark.
    <pointLight
      ref={pointLightRef}
      position={[0, 1.5, 7]}
      intensity={intensity * 6.0}
      distance={20}
      decay={1}
    />
  );
};

// ─── Timeline Editor ─────────────────────────────────────────────────────────

interface TimelineProps {
  totalDuration: number;
  videoDuration: number;
  audioDuration: number;
  videoIn: number;
  videoOut: number;
  audioOffset: number;
  audioIn: number;
  audioOut: number;
  currentTime: number;
  hasVideo: boolean;
  hasAudio: boolean;
  onVideoTrim: (inPt: number, outPt: number) => void;
  onAudioChange: (offset: number, inPt: number, outPt: number) => void;
  onSeek: (t: number) => void;
}

type DragTarget =
  | { track: 'video'; handle: 'in' | 'out' | 'body'; startOffset: number; startIn: number; startOut: number }
  | { track: 'audio'; handle: 'in' | 'out' | 'body'; startOffset: number; startIn: number; startOut: number; startAudioOffset: number };

const VideoTimeline: React.FC<TimelineProps> = ({
  totalDuration,
  videoDuration,
  audioDuration,
  videoIn,
  videoOut,
  audioOffset,
  audioIn,
  audioOut,
  currentTime,
  hasVideo,
  hasAudio,
  onVideoTrim,
  onAudioChange,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragTarget | null>(null);
  const dur = Math.max(totalDuration, 0.1);

  const toPercent = (t: number) => `${((t / dur) * 100).toFixed(3)}%`;

  const clientXToTime = useCallback(
    (clientX: number): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return Math.max(0, Math.min(dur, ((clientX - rect.left) / rect.width) * dur));
    },
    [dur],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, target: DragTarget) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { ...target, startOffset: clientXToTime(e.clientX) };
    },
    [clientXToTime],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const t = clientXToTime(e.clientX);
      const delta = t - drag.startOffset;

      if (drag.track === 'video') {
        if (drag.handle === 'in') {
          onVideoTrim(Math.max(0, Math.min(drag.startIn + delta, drag.startOut - 0.05)), drag.startOut);
        } else if (drag.handle === 'out') {
          onVideoTrim(drag.startIn, Math.max(drag.startIn + 0.05, Math.min(drag.startOut + delta, videoDuration)));
        } else {
          const len = drag.startOut - drag.startIn;
          const newIn = Math.max(0, Math.min(drag.startIn + delta, dur - len));
          onVideoTrim(newIn, newIn + len);
        }
      } else {
        const d = drag as Extract<DragTarget, { track: 'audio' }>;
        if (drag.handle === 'in') {
          onAudioChange(d.startAudioOffset, Math.max(0, Math.min(d.startIn + delta, d.startOut - 0.05)), d.startOut);
        } else if (drag.handle === 'out') {
          onAudioChange(d.startAudioOffset, d.startIn, Math.max(d.startIn + 0.05, Math.min(d.startOut + delta, audioDuration)));
        } else {
          const newOffset = Math.max(0, Math.min(d.startAudioOffset + delta, dur - (d.startOut - d.startIn)));
          onAudioChange(newOffset, d.startIn, d.startOut);
        }
      }
    },
    [clientXToTime, onVideoTrim, onAudioChange, videoDuration, audioDuration, dur],
  );

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = dur <= 5 ? 0.5 : dur <= 15 ? 1 : dur <= 60 ? 5 : 10;
    for (let t = 0; t <= dur; t += step) ticks.push(parseFloat(t.toFixed(4)));
    return ticks;
  }, [dur]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    userSelect: 'none',
    touchAction: 'none',
  };

  const trackRowStyle: React.CSSProperties = {
    position: 'relative',
    height: 32,
    background: 'rgba(15,23,42,0.6)',
    borderRadius: 8,
    border: '1px solid rgba(71,85,105,0.4)',
    marginTop: 4,
    overflow: 'hidden',
  };

  const handleStyle = (left: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 8,
    background: 'rgba(148,163,184,0.7)',
    cursor: 'ew-resize',
    zIndex: 4,
    borderRadius: left ? '6px 0 0 6px' : '0 6px 6px 0',
    ...(left ? { left: 0 } : { right: 0 }),
  });

  const clipStyle = (offsetPct: string, widthPct: string, color: string): React.CSSProperties => ({
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: offsetPct,
    width: widthPct,
    background: color,
    borderRadius: 6,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  });

  return (
    <div ref={containerRef} style={containerStyle} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {/* Time ruler */}
      <div
        style={{
          position: 'relative',
          height: 20,
          background: 'rgba(2,6,23,0.8)',
          borderRadius: '6px 6px 0 0',
          border: '1px solid rgba(51,65,85,0.6)',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          onSeek(Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur)));
        }}
      >
        {rulerTicks.map((t) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: `${((t / dur) * 100).toFixed(3)}%`,
              top: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ width: 1, height: 6, background: 'rgba(100,116,139,0.6)', marginTop: 0 }} />
            <span style={{ fontSize: 9, color: '#64748b', lineHeight: 1, marginTop: 1 }}>{t.toFixed(1)}s</span>
          </div>
        ))}
        {/* Playhead on ruler */}
        <div
          style={{
            position: 'absolute',
            left: toPercent(currentTime),
            top: 0,
            bottom: 0,
            width: 2,
            background: '#f43f5e',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Video track */}
      {hasVideo && (
        <div>
          <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6, marginBottom: 2 }}>Video</div>
          <div style={trackRowStyle}>
            {/* Background full duration */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,41,59,0.4)' }} />
            {/* Clip bar */}
            <div
              style={clipStyle(toPercent(videoIn), `${(((videoOut - videoIn) / dur) * 100).toFixed(3)}%`, 'rgba(56,189,248,0.25)')}
              onPointerDown={(e) => onPointerDown(e, { track: 'video', handle: 'body', startOffset: 0, startIn: videoIn, startOut: videoOut })}
            >
              <div style={handleStyle(true)} onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, { track: 'video', handle: 'in', startOffset: 0, startIn: videoIn, startOut: videoOut }); }} />
              <span style={{ fontSize: 9, color: '#7dd3fc', fontWeight: 700, paddingLeft: 12, overflow: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none' }}>VIDEO</span>
              <div style={handleStyle(false)} onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, { track: 'video', handle: 'out', startOffset: 0, startIn: videoIn, startOut: videoOut }); }} />
            </div>
            {/* Playhead line */}
            <div style={{ position: 'absolute', left: toPercent(currentTime), top: 0, bottom: 0, width: 2, background: '#f43f5e', zIndex: 10, pointerEvents: 'none' }} />
          </div>
        </div>
      )}

      {/* Audio track */}
      {hasAudio && (
        <div>
          <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6, marginBottom: 2 }}>Audio</div>
          <div style={trackRowStyle}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,41,59,0.4)' }} />
            {/* Audio clip bar (positioned by audioOffset) */}
            <div
              style={clipStyle(
                toPercent(audioOffset),
                `${(((audioOut - audioIn) / dur) * 100).toFixed(3)}%`,
                'rgba(167,139,250,0.25)',
              )}
              onPointerDown={(e) => onPointerDown(e, { track: 'audio', handle: 'body', startOffset: 0, startIn: audioIn, startOut: audioOut, startAudioOffset: audioOffset })}
            >
              <div style={handleStyle(true)} onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, { track: 'audio', handle: 'in', startOffset: 0, startIn: audioIn, startOut: audioOut, startAudioOffset: audioOffset }); }} />
              <span style={{ fontSize: 9, color: '#c4b5fd', fontWeight: 700, paddingLeft: 12, overflow: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none' }}>AUDIO</span>
              <div style={handleStyle(false)} onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, { track: 'audio', handle: 'out', startOffset: 0, startIn: audioIn, startOut: audioOut, startAudioOffset: audioOffset }); }} />
            </div>
            <div style={{ position: 'absolute', left: toPercent(currentTime), top: 0, bottom: 0, width: 2, background: '#f43f5e', zIndex: 10, pointerEvents: 'none' }} />
          </div>
        </div>
      )}

      {/* Current time display */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#f43f5e', fontWeight: 700, fontFamily: 'monospace' }}>
          {currentTime.toFixed(2)}s / {dur.toFixed(2)}s
        </span>
      </div>
    </div>
  );
};

// ─── Slider Row helper ────────────────────────────────────────────────────────

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 0.01, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <span style={{ width: 110, fontSize: 11, color: '#94a3b8', flexShrink: 0, fontWeight: 600 }}>{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer' }}
    />
    <span style={{ width: 42, fontSize: 11, color: '#e2e8f0', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>
      {value.toFixed(2)}
    </span>
  </div>
);

// ─── Main exported component ─────────────────────────────────────────────────

export const VideoEffectLab: React.FC = () => {
  // ── File state ────────────────────────────────────────────────────────────
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [videoDuration, setVideoDuration] = useState(3.0);
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [audioDuration, setAudioDuration] = useState(3.0);

  // ── Timeline state ────────────────────────────────────────────────────────
  const [videoIn, setVideoIn] = useState(0);
  const [videoOut, setVideoOut] = useState(3.0);
  const [audioOffset, setAudioOffset] = useState(0);
  const [audioIn, setAudioIn] = useState(0);
  const [audioOut, setAudioOut] = useState(3.0);
  const [currentTime, setCurrentTime] = useState(0);

  // ── Playback state ────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loop, setLoop] = useState(false);

  // ── 3D placement ──────────────────────────────────────────────────────────
  const [videoPos, setVideoPos] = useState<[number, number, number]>([0, 1.2, 0.2]);
  const [videoScale, setVideoScale] = useState(1.8);
  const [lockOrbit, setLockOrbit] = useState(false);
  const [videoLight, setVideoLight] = useState(false);
  const [videoLightIntensity, setVideoLightIntensity] = useState(0.6);
  const [videoLightLuminance, setVideoLightLuminance] = useState(0.42);
  const [videoLightSatBoost, setVideoLightSatBoost] = useState(1.0);
  const [videoLightGreyThreshold, setVideoLightGreyThreshold] = useState(0.08);
  const [videoBillboard, setVideoBillboard] = useState(false);

  // ── Reference character ───────────────────────────────────────────────────
  const [heroClassId, setHeroClassId] = useState<PlayerClassId>(PLAYER_CLASSES[0]?.id ?? 'warrior');
  const [previewReference, setPreviewReference] = useState<'hero' | 'enemy'>('hero');
  const [enemyIndex, setEnemyIndex] = useState(0);

  // ── Luma key / refinement ─────────────────────────────────────────────────
  const [lumaKey, setLumaKey] = useState<LumaKeyParams>({ ...DEFAULT_LUMA });
  const [refinement, setRefinement] = useState<RefinementParams>({ ...DEFAULT_REFINEMENT });
  // 0 = fundo escuro/preto (remove dark pixels), 1 = fundo claro/branco (remove light pixels)
  const [invertMask, setInvertMask] = useState<0 | 1>(0);

  // ── Panel collapse state ──────────────────────────────────────────────────
  const [lumaOpen, setLumaOpen] = useState(true);
  const [refinOpen, setRefinOpen] = useState(false);
  const [playbackOpen, setPlaybackOpen] = useState(true);

  // ── Copy/export state ─────────────────────────────────────────────────────
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok'>('idle');

  // ── DOM refs for media elements ───────────────────────────────────────────
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const videoObjUrlRef = useRef<string | null>(null);
  const audioObjUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartWallRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);

  const totalDuration = videoUrl ? videoDuration : audioDuration;

  // ── Video element setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!videoElRef.current) {
      const el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      videoElRef.current = el;
    }
  }, []);

  useEffect(() => {
    if (!audioElRef.current) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      audioElRef.current = el;
    }
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => () => {
    if (videoObjUrlRef.current) URL.revokeObjectURL(videoObjUrlRef.current);
    if (audioObjUrlRef.current) URL.revokeObjectURL(audioObjUrlRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── File handlers ─────────────────────────────────────────────────────────
  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoObjUrlRef.current) URL.revokeObjectURL(videoObjUrlRef.current);
    setIsPlaying(false);
    const url = URL.createObjectURL(file);
    videoObjUrlRef.current = url;
    setVideoUrl(url);
    setVideoFileName(file.name);
    setCurrentTime(0);

    const el = videoElRef.current;
    if (el) {
      el.src = url;
      el.load();
      el.onloadedmetadata = () => {
        const dur = el.duration || 3;
        setVideoDuration(dur);
        setVideoIn(0);
        setVideoOut(dur);
        if (el.videoWidth && el.videoHeight) {
          setVideoAspect(el.videoWidth / el.videoHeight);
        }
      };
    }
    e.target.value = '';
  };

  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (audioObjUrlRef.current) URL.revokeObjectURL(audioObjUrlRef.current);
    const url = URL.createObjectURL(file);
    audioObjUrlRef.current = url;
    setAudioUrl(url);
    setAudioFileName(file.name);
    setAudioOffset(0);
    setAudioIn(0);

    const el = audioElRef.current;
    if (el) {
      el.src = url;
      el.load();
      el.onloadedmetadata = () => {
        const dur = el.duration || 3;
        setAudioDuration(dur);
        setAudioOut(dur);
      };
    }
    e.target.value = '';
  };

  const clearVideo = () => {
    setIsPlaying(false);
    if (videoObjUrlRef.current) URL.revokeObjectURL(videoObjUrlRef.current);
    videoObjUrlRef.current = null;
    setVideoUrl(null);
    setVideoFileName('');
    if (videoElRef.current) { videoElRef.current.src = ''; videoElRef.current.load(); }
  };

  const clearAudio = () => {
    if (audioObjUrlRef.current) URL.revokeObjectURL(audioObjUrlRef.current);
    audioObjUrlRef.current = null;
    setAudioUrl(null);
    setAudioFileName('');
    if (audioElRef.current) { audioElRef.current.src = ''; audioElRef.current.load(); }
  };

  // ── Playback engine ───────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    videoElRef.current?.pause();
    audioElRef.current?.pause();
  }, []);

  const startPlayback = useCallback(
    (fromTime: number) => {
      const video = videoElRef.current;
      if (!video || !videoUrl) return;

      const clampedStart = Math.max(videoIn, Math.min(fromTime, videoOut - 0.01));
      video.playbackRate = playbackSpeed;
      video.currentTime = clampedStart;
      video.play().catch(() => {});

      // Audio sync
      const audio = audioElRef.current;
      const audioDelay = audioOffset - clampedStart;
      if (audio && audioUrl) {
        if (audioDelay <= 0) {
          // Audio should already be playing; seek into it
          const audioSeekTo = audioIn + Math.max(0, -audioDelay);
          if (audioSeekTo < audioOut) {
            audio.playbackRate = playbackSpeed;
            audio.currentTime = audioSeekTo;
            audio.play().catch(() => {});
          }
        }
        // If audioDelay > 0 the RAF loop will trigger it at the right time
      }

      setIsPlaying(true);
      playStartWallRef.current = performance.now();
      playStartTimeRef.current = clampedStart;

      let audioStarted = audioDelay <= 0;

      const tick = () => {
        const elapsed = (performance.now() - playStartWallRef.current) / 1000;
        const t = playStartTimeRef.current + elapsed * playbackSpeed;

        if (t >= videoOut) {
          if (loop) {
            // Loop back to videoIn
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = videoIn;
            if (video) { video.currentTime = videoIn; video.play().catch(() => {}); }
            if (audio && audioUrl) { audio.currentTime = audioIn; audio.play().catch(() => {}); }
            audioStarted = true;
          } else {
            stopPlayback();
            setCurrentTime(videoOut);
            return;
          }
        } else {
          setCurrentTime(t);

          // Trigger audio after its offset
          if (!audioStarted && audio && audioUrl && t >= audioOffset) {
            const seekTo = audioIn + (t - audioOffset) * playbackSpeed;
            if (seekTo < audioOut) {
              audio.playbackRate = playbackSpeed;
              audio.currentTime = seekTo;
              audio.play().catch(() => {});
            }
            audioStarted = true;
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [videoUrl, audioUrl, videoIn, videoOut, audioOffset, audioIn, audioOut, playbackSpeed, loop, stopPlayback],
  );

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      const from = currentTime >= videoOut ? videoIn : currentTime;
      startPlayback(from);
    }
  };

  const handleReset = () => {
    stopPlayback();
    setCurrentTime(videoIn);
    if (videoElRef.current) { videoElRef.current.currentTime = videoIn; }
  };

  const handleSeek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(totalDuration, t));
      setCurrentTime(clamped);
      if (videoElRef.current && videoUrl) videoElRef.current.currentTime = Math.max(videoIn, Math.min(videoOut, clamped));
    },
    [totalDuration, videoUrl, videoIn, videoOut],
  );

  const handleFrameStep = (dir: 1 | -1) => {
    stopPlayback();
    const step = (1 / 30) * dir;
    const next = Math.max(videoIn, Math.min(videoOut, currentTime + step));
    setCurrentTime(next);
    if (videoElRef.current) videoElRef.current.currentTime = next;
  };

  // ── JSON export ───────────────────────────────────────────────────────────
  const buildConfig = useCallback((): VideoEffectConfig => ({
    version: '1.0',
    videoFileName,
    audioFileName,
    timeline: {
      videoIn,
      videoOut,
      audioOffset,
      audioIn,
      audioOut,
      totalDuration: videoOut - videoIn,
    },
    placement: {
      position: [...videoPos] as [number, number, number],
      scale: videoScale,
    },
    lumaKey: { ...lumaKey },
    refinement: { ...refinement },
    playback: {
      speed: playbackSpeed,
      loop,
      invertMask,
    },
  }), [videoFileName, audioFileName, videoIn, videoOut, audioOffset, audioIn, audioOut, videoPos, videoScale, lumaKey, refinement, playbackSpeed, loop]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildConfig(), null, 2));
      setCopyStatus('ok');
      setTimeout(() => setCopyStatus('idle'), 1800);
    } catch { /* ignore */ }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(buildConfig(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(videoFileName || 'video_effect').replace(/\.[^.]+$/, '')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Timeline handlers ─────────────────────────────────────────────────────
  const handleVideoTrim = useCallback((inPt: number, outPt: number) => {
    setVideoIn(inPt);
    setVideoOut(outPt);
  }, []);

  const handleAudioChange = useCallback((offset: number, inPt: number, outPt: number) => {
    setAudioOffset(offset);
    setAudioIn(inPt);
    setAudioOut(outPt);
  }, []);

  // ── Luma key updater helpers ──────────────────────────────────────────────
  const setLk = <K extends keyof LumaKeyParams>(key: K, val: number) =>
    setLumaKey((prev) => ({ ...prev, [key]: val }));
  const setRf = <K extends keyof RefinementParams>(key: K, val: number) =>
    setRefinement((prev) => ({ ...prev, [key]: val }));

  // ── Panel section style ───────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(51,65,85,0.5)',
    borderRadius: 18,
    padding: '14px 16px',
  };

  const sectionHeader = (label: string, open: boolean, toggle: () => void, accent = '#38bdf8') => (
    <button
      onClick={toggle}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        marginBottom: open ? 12 : 0,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent }}>{label}</span>
      <span style={{ fontSize: 14, color: '#475569' }}>{open ? '▲' : '▼'}</span>
    </button>
  );

  const uploadBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(71,85,105,0.6)',
    borderRadius: 10,
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  };

  const clearBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  };

  const actionBtnStyle = (active: boolean, accentActive = '#0ea5e9', accentInactive = '#334155'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: active ? `${accentActive}22` : 'rgba(15,23,42,0.7)',
    border: `1px solid ${active ? `${accentActive}55` : 'rgba(51,65,85,0.5)'}`,
    borderRadius: 12,
    color: active ? '#e2e8f0' : '#64748b',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ color: '#e2e8f0', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>Video Effect Lab</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
          Upload MP4 + MP3 → posicione o vídeo no 3D → configure luma key → exporte JSON
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

        {/* ── TOP ROW: uploads + 3D canvas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 16, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Upload panel */}
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#38bdf8', marginBottom: 12 }}>Arquivos</div>

              {/* Video upload */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5 }}>Vídeo (MP4)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={uploadBtnStyle}>
                    📹 {videoUrl ? 'Trocar' : 'Subir Vídeo'}
                    <input type="file" accept="video/mp4,video/*" style={{ display: 'none' }} onChange={handleVideoFile} />
                  </label>
                  {videoUrl && (
                    <button style={clearBtnStyle} onClick={clearVideo}>✕ Limpar</button>
                  )}
                </div>
                {videoFileName && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#7dd3fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {videoFileName} · {videoDuration.toFixed(2)}s
                  </div>
                )}
              </div>

              {/* Audio upload */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5 }}>Áudio (MP3 / OGG / WAV)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={uploadBtnStyle}>
                    🎵 {audioUrl ? 'Trocar' : 'Subir Áudio'}
                    <input type="file" accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/*" style={{ display: 'none' }} onChange={handleAudioFile} />
                  </label>
                  {audioUrl && (
                    <button style={clearBtnStyle} onClick={clearAudio}>✕ Limpar</button>
                  )}
                </div>
                {audioFileName && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#c4b5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {audioFileName} · {audioDuration.toFixed(2)}s
                  </div>
                )}
              </div>
            </div>

            {/* Timeline panel */}
            {(videoUrl || audioUrl) && (
              <div style={panelStyle}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 10 }}>Timeline</div>
                <VideoTimeline
                  totalDuration={totalDuration}
                  videoDuration={videoDuration}
                  audioDuration={audioDuration}
                  videoIn={videoIn}
                  videoOut={videoOut}
                  audioOffset={audioOffset}
                  audioIn={audioIn}
                  audioOut={audioOut}
                  currentTime={currentTime}
                  hasVideo={!!videoUrl}
                  hasAudio={!!audioUrl}
                  onVideoTrim={handleVideoTrim}
                  onAudioChange={handleAudioChange}
                  onSeek={handleSeek}
                />
              </div>
            )}

            {/* Playback controls panel */}
            <div style={panelStyle}>
              {sectionHeader('Playback', playbackOpen, () => setPlaybackOpen((v) => !v), '#f59e0b')}
              {playbackOpen && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <button
                      style={actionBtnStyle(isPlaying, '#0ea5e9')}
                      onClick={handlePlayPause}
                      disabled={!videoUrl}
                    >
                      {isPlaying ? '⏸ Pausar' : '▶ Play'}
                    </button>
                    <button style={actionBtnStyle(false)} onClick={handleReset}>↺ Reset</button>
                    <button
                      style={actionBtnStyle(loop, '#f59e0b')}
                      onClick={() => setLoop((v) => !v)}
                    >
                      🔁 Loop
                    </button>
                    <button style={actionBtnStyle(false)} onClick={() => handleFrameStep(-1)} disabled={!videoUrl}>◀ Frame</button>
                    <button style={actionBtnStyle(false)} onClick={() => handleFrameStep(1)} disabled={!videoUrl}>Frame ▶</button>
                  </div>
                  <SliderRow label="Velocidade" value={playbackSpeed} min={0.1} max={3.0} step={0.05} onChange={(v) => { setPlaybackSpeed(v); if (videoElRef.current) videoElRef.current.playbackRate = v; if (audioElRef.current) audioElRef.current.playbackRate = v; }} />
                </>
              )}
            </div>

            {/* Reference character */}
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 10 }}>Referência 3D</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button style={actionBtnStyle(previewReference === 'hero', '#a78bfa')} onClick={() => setPreviewReference('hero')}>Herói</button>
                <button style={actionBtnStyle(previewReference === 'enemy', '#a78bfa')} onClick={() => setPreviewReference('enemy')}>Inimigo</button>
              </div>
              {previewReference === 'hero' && (
                <select
                  value={heroClassId}
                  onChange={(e) => setHeroClassId(e.target.value as PlayerClassId)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }}
                >
                  {PLAYER_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {previewReference === 'enemy' && (
                <select
                  value={enemyIndex}
                  onChange={(e) => setEnemyIndex(parseInt(e.target.value, 10))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }}
                >
                  {ENEMY_DATA.map((en, idx) => (
                    <option key={idx} value={idx}>{en.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Export buttons */}
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#34d399', marginBottom: 10 }}>Exportar Config</div>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>
                O JSON contém posições, luma key, timing e parâmetros. Salve junto com os arquivos originais de vídeo e áudio na pasta do efeito.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  style={actionBtnStyle(copyStatus === 'ok', '#34d399')}
                  onClick={copyJson}
                >
                  {copyStatus === 'ok' ? '✓ Copiado!' : '📋 Copiar JSON'}
                </button>
                <button style={actionBtnStyle(false, '#34d399')} onClick={downloadJson}>
                  ⬇ Baixar JSON
                </button>
              </div>
            </div>

          </div>{/* end LEFT COLUMN */}

          {/* RIGHT COLUMN — 3D Canvas + param panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 3D Canvas */}
            <div style={{ position: 'relative' }}>
              <div style={{ height: 480, borderRadius: 20, border: '1px solid rgba(51,65,85,0.5)', overflow: 'hidden', background: '#020617' }}>
                <Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Carregando cena 3D...
                  </div>
                }>
                  <VideoStage
                    videoEl={videoUrl ? videoElRef.current : null}
                    lumaKey={lumaKey}
                    refinement={refinement}
                    invertMask={invertMask}
                    videoLight={videoLight}
                    videoLightIntensity={videoLightIntensity}
                    videoLightLuminance={videoLightLuminance}
                    videoLightSatBoost={videoLightSatBoost}
                    videoLightGreyThreshold={videoLightGreyThreshold}
                    billboard={videoBillboard}
                    videoPos={videoPos}
                    videoScale={videoScale}
                    videoAspect={videoAspect}
                    heroClassId={heroClassId}
                    previewReference={previewReference}
                    enemyIndex={enemyIndex}
                    lockOrbit={lockOrbit}
                    onPositionChange={setVideoPos}
                    onScaleChange={setVideoScale}
                  />
                </Suspense>
              </div>

              {/* Lock orbit toggle + video light toggle */}
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                <button
                  style={{
                    ...actionBtnStyle(videoBillboard, '#22d3ee'),
                    padding: '5px 12px',
                    fontSize: 10,
                  }}
                  onClick={() => setVideoBillboard((v) => !v)}
                  title="O plano de vídeo acompanha a rotação da câmera (sempre de frente)"
                >
                  {videoBillboard ? '📌 Billboard ON' : '📌 Billboard'}
                </button>
                <button
                  style={{
                    ...actionBtnStyle(videoLight, '#a78bfa'),
                    padding: '5px 12px',
                    fontSize: 10,
                  }}
                  onClick={() => setVideoLight((v) => !v)}
                  title="Projeta a luz/cor do vídeo sobre o cenário 3D"
                >
                  {videoLight ? '💡 Luz ON' : '💡 Luz OFF'}
                </button>
                <button
                  style={{
                    ...actionBtnStyle(lockOrbit, '#f59e0b'),
                    padding: '5px 12px',
                    fontSize: 10,
                  }}
                  onClick={() => setLockOrbit((v) => !v)}
                  title="Ativar para arrastar o vídeo no 3D. Desativar para rotacionar a câmera."
                >
                  {lockOrbit ? '🔒 Mover Vídeo' : '🎥 Órbita'}
                </button>
              </div>
            </div>

            {/* Position / scale display + quick inputs */}
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 10 }}>Posição 3D</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                  <div key={axis}>
                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, marginBottom: 3 }}>{axis}</div>
                    <input
                      type="number"
                      step="0.05"
                      value={videoPos[i].toFixed(2)}
                      onChange={(e) => {
                        const next: [number, number, number] = [...videoPos];
                        next[i] = parseFloat(e.target.value) || 0;
                        setVideoPos(next);
                      }}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '5px 8px', fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, marginBottom: 3 }}>Escala</div>
                  <input
                    type="number"
                    step="0.1"
                    min="0.05"
                    value={videoScale.toFixed(2)}
                    onChange={(e) => setVideoScale(Math.max(0.05, parseFloat(e.target.value) || 1))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '5px 8px', fontSize: 12, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: '#475569' }}>
                🔒 Ativado: arraste o plano no 3D · Scroll: escala · Shift+drag: mover Z
              </div>
              {/* Video light colour controls — shown only when light is ON */}
              {videoLight && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(167,139,250,0.06)', borderRadius: 10, border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>💡 Luz de Vídeo</div>
                  <SliderRow
                    label="Intensidade"
                    value={videoLightIntensity}
                    min={0}
                    max={1}
                    onChange={setVideoLightIntensity}
                  />
                  <SliderRow
                    label="Luminância"
                    value={videoLightLuminance}
                    min={0.05}
                    max={0.85}
                    onChange={setVideoLightLuminance}
                  />
                  <SliderRow
                    label="Boost de Saturação"
                    value={videoLightSatBoost}
                    min={0}
                    max={3}
                    onChange={setVideoLightSatBoost}
                  />
                  <SliderRow
                    label="Suprimir Branco/Cinza"
                    value={videoLightGreyThreshold}
                    min={0}
                    max={0.5}
                    onChange={setVideoLightGreyThreshold}
                  />
                  <div style={{ fontSize: 9, color: '#6d28d9', marginTop: 6, lineHeight: 1.5 }}>
                    Luminância: brilho da cor projetada · Saturação: intensidade da cor · Suprimir: ignora frames acinzentados/brancos
                  </div>
                </div>
              )}
            </div>

            {/* Luma Key panel */}
            <div style={panelStyle}>
              {sectionHeader('Luma Key', lumaOpen, () => setLumaOpen((v) => !v), '#38bdf8')}
              {lumaOpen && (
                <>
                  {/* Background reference toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'rgba(2,6,23,0.5)', borderRadius: 10, border: '1px solid rgba(51,65,85,0.4)' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, flexShrink: 0 }}>Fundo do Vídeo:</span>
                    <button
                      onClick={() => setInvertMask(0)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 900, cursor: 'pointer', border: '1px solid',
                        background: invertMask === 0 ? 'rgba(15,23,42,0.9)' : 'transparent',
                        borderColor: invertMask === 0 ? '#38bdf8' : 'rgba(51,65,85,0.5)',
                        color: invertMask === 0 ? '#7dd3fc' : '#475569',
                      }}
                      title="Remove pixels escuros — ideal para efeitos com fundo preto (fogo, raio, explosão)"
                    >
                      ⬛ Preto / Escuro
                    </button>
                    <button
                      onClick={() => setInvertMask(1)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 900, cursor: 'pointer', border: '1px solid',
                        background: invertMask === 1 ? 'rgba(248,250,252,0.1)' : 'transparent',
                        borderColor: invertMask === 1 ? '#94a3b8' : 'rgba(51,65,85,0.5)',
                        color: invertMask === 1 ? '#f1f5f9' : '#475569',
                      }}
                      title="Remove pixels claros — ideal para efeitos com fundo branco/cinza claro"
                    >
                      ⬜ Branco / Claro
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <div>
                      <SliderRow label="Threshold" value={lumaKey.threshold} min={0} max={1} onChange={(v) => setLk('threshold', v)} />
                      <SliderRow label="Smoothness" value={lumaKey.smoothness} min={0} max={1} onChange={(v) => setLk('smoothness', v)} />
                      <SliderRow label="Softness" value={lumaKey.softness} min={0} max={2} onChange={(v) => setLk('softness', v)} />
                      <SliderRow label="Black Clip" value={lumaKey.blackClip} min={0} max={1} onChange={(v) => setLk('blackClip', v)} />
                      <SliderRow label="White Clip" value={lumaKey.whiteClip} min={0} max={1} onChange={(v) => setLk('whiteClip', v)} />
                      <SliderRow label="Edge Softness" value={lumaKey.edgeSoftness} min={0} max={1} onChange={(v) => setLk('edgeSoftness', v)} />
                    </div>
                    <div>
                      <SliderRow label="Alpha Fade" value={lumaKey.alphaFade} min={0} max={1} onChange={(v) => setLk('alphaFade', v)} />
                      <SliderRow label="Gamma" value={lumaKey.gamma} min={0.1} max={3} onChange={(v) => setLk('gamma', v)} />
                      <SliderRow label="Contrast" value={lumaKey.contrast} min={-1} max={2} onChange={(v) => setLk('contrast', v)} />
                      <SliderRow label="Brightness" value={lumaKey.brightness} min={-1} max={1} onChange={(v) => setLk('brightness', v)} />
                      <SliderRow label="Exposure" value={lumaKey.exposure} min={-3} max={3} onChange={(v) => setLk('exposure', v)} />
                      <SliderRow label="Saturation" value={lumaKey.saturation} min={-1} max={2} onChange={(v) => setLk('saturation', v)} />
                    </div>
                  </div>
                  <button
                    style={{ ...actionBtnStyle(false), marginTop: 8, fontSize: 10 }}
                    onClick={() => setLumaKey({ ...DEFAULT_LUMA })}
                  >
                    ↺ Reset Luma Key
                  </button>
                </>
              )}
            </div>

            {/* Refinement panel */}
            <div style={panelStyle}>
              {sectionHeader('Refinamento', refinOpen, () => setRefinOpen((v) => !v), '#a78bfa')}
              {refinOpen && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <div>
                      <SliderRow label="Blur Alpha" value={refinement.blurAlpha} min={0} max={1} onChange={(v) => setRf('blurAlpha', v)} />
                      <SliderRow label="Edge Blur" value={refinement.edgeBlur} min={0} max={1} onChange={(v) => setRf('edgeBlur', v)} />
                      <SliderRow label="Despill Dark" value={refinement.despillDark} min={0} max={1} onChange={(v) => setRf('despillDark', v)} />
                    </div>
                    <div>
                      <SliderRow label="Noise Reduction" value={refinement.noiseReduction} min={0} max={1} onChange={(v) => setRf('noiseReduction', v)} />
                      <SliderRow label="Feather" value={refinement.feather} min={0} max={0.9} onChange={(v) => setRf('feather', v)} />
                      <SliderRow label="Clamp Alpha" value={refinement.clampAlpha} min={0} max={1} onChange={(v) => setRf('clampAlpha', v)} />
                      <SliderRow label="Vinheta" value={refinement.vignette} min={0} max={1} onChange={(v) => setRf('vignette', v)} />
                      <SliderRow label="Ardência Borda" value={refinement.vignetteWarmth} min={0} max={1} onChange={(v) => setRf('vignetteWarmth', v)} />
                      <SliderRow label="Forma (⬤→▪)" value={refinement.vignetteShape} min={0} max={1} onChange={(v) => setRf('vignetteShape', v)} />
                    </div>
                  </div>
                  <button
                    style={{ ...actionBtnStyle(false), marginTop: 8, fontSize: 10 }}
                    onClick={() => setRefinement({ ...DEFAULT_REFINEMENT })}
                  >
                    ↺ Reset Refinamento
                  </button>
                </>
              )}
            </div>

          </div>{/* end RIGHT COLUMN */}
        </div>

      </div>
    </div>
  );
};
