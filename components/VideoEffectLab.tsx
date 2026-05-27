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
import { ENEMIES_2D } from '../game/data/enemies2D';
import { HEROES_2D } from '../game/data/heroes2D';
import type { PlayerClassId } from '../types';
import { hasRuntimeFbxAssets } from './scene3d/animation';
import { AnimatedClassHero, EnemyCharacter } from './scene3d/characters';
import { Sprite2DBillboard } from './scene3d/DeveloperEnemy2DScene';

// ─── Types ───────────────────────────────────────────────────────────────────

const hexToRgb01 = (hex: string): [number, number, number] => {
  const safe = hex.length === 7 && hex[0] === '#' ? hex : '#ffffff';
  return [
    parseInt(safe.slice(1, 3), 16) / 255,
    parseInt(safe.slice(3, 5), 16) / 255,
    parseInt(safe.slice(5, 7), 16) / 255,
  ];
};

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
  timeline: {
    trimIn: number;
    trimOut: number;
    duration: number;
  };
  placement: {
    position: [number, number, number];
    scale: number;
    billboard: boolean;
    flipX: boolean;
    flipY: boolean;
  };
  lumaKey: LumaKeyParams;
  refinement: RefinementParams;
  invertMask: 0 | 1;
  videoLight: {
    enabled: boolean;
    intensity: number;
    luminance: number;
    satBoost: number;
    greyThreshold: number;
  };
  colorTint: {
    color: string;   // hex e.g. "#ff6600"
    strength: number;
  };
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
  uniform float flipX;          // 1.0 = espelhar horizontalmente
  uniform float flipY;          // 1.0 = espelhar verticalmente
  uniform vec3  colorTint;      // cor de tint (RGB 0-1)
  uniform float colorTintStrength; // 0 = original, 1 = recolorir totalmente
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    uv.x = mix(uv.x, 1.0 - uv.x, flipX);
    uv.y = mix(uv.y, 1.0 - uv.y, flipY);
    vec4 color = texture2D(videoTex, uv);
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
          vec2 buv = clamp(uv + vec2(float(bx), float(by_)) * bStep, 0.001, 0.999);
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
          vec2 euv = clamp(uv + vec2(float(ex), float(ey)) * eStep, 0.001, 0.999);
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
      vec2 centered = uv * 2.0 - 1.0;
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

    // ── Color tint ─────────────────────────────────────────────
    if (colorTintStrength > 0.0) {
      // Extrair lumância do pixel original
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // Normalizar a cor de tint pelo canal mais brilhante → garante que a
      // intensidade do efeito (brilhante no centro, escuro nas bordas) seja
      // sempre preservada na cor escolhida
      float tintMax = max(max(colorTint.r, colorTint.g), max(colorTint.b, 0.001));
      vec3 tintNorm = colorTint / tintMax;
      vec3 recolored = tintNorm * lum;
      col = mix(col, clamp(recolored, 0.0, 1.0), colorTintStrength);
      col = clamp(col, 0.0, 1.0);
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
  flipX: boolean;
  flipY: boolean;
  colorTint: [number, number, number];
  colorTintStrength: number;
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
  flipX,
  flipY,
  colorTint,
  colorTintStrength,
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
      flipX: { value: 0.0 },
      flipY: { value: 0.0 },
      colorTint: { value: new THREE.Vector3(1, 1, 1) },
      colorTintStrength: { value: 0.0 },
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
    mat.uniforms.flipX.value = flipX ? 1.0 : 0.0;
    mat.uniforms.flipY.value = flipY ? 1.0 : 0.0;
    mat.uniforms.colorTint.value.set(colorTint[0], colorTint[1], colorTint[2]);
    mat.uniforms.colorTintStrength.value = colorTintStrength;
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
  flipX: boolean;
  flipY: boolean;
  colorTint: [number, number, number];
  colorTintStrength: number;
  videoPos: [number, number, number];
  videoScale: number;
  videoAspect: number;
  heroClassId: PlayerClassId;
  previewReference: 'hero' | 'enemy' | 'enemy2d' | 'hero2d';
  enemyIndex: number;
  sprite2DUrl: string;
  sprite2DHeight: number;
  hero2DUrl: string;
  hero2DHeight: number;
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
  flipX,
  flipY,
  colorTint,
  colorTintStrength,
  videoPos,
  videoScale,
  videoAspect,
  heroClassId,
  previewReference,
  enemyIndex,
  sprite2DUrl,
  sprite2DHeight,
  hero2DUrl,
  hero2DHeight,
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
      {/* 2D sprite billboard: billboard visual + shadow caster orientado para a luz [4,8,5] */}
      {previewReference === 'enemy2d' && sprite2DUrl ? (
        <Suspense fallback={null}>
          <Sprite2DBillboard
            spriteUrl={sprite2DUrl}
            heightUnits={sprite2DHeight}
            shadowLightDir={[4, 0, 5]}
            groundY={-1.06}
          />
        </Suspense>
      ) : null}
      {/* Herói 2D: mesmo billboard, usando sprites dos heróis jogáveis */}
      {previewReference === 'hero2d' && hero2DUrl ? (
        <Suspense fallback={null}>
          <Sprite2DBillboard
            spriteUrl={hero2DUrl}
            heightUnits={hero2DHeight}
            shadowLightDir={[4, 0, 5]}
            groundY={-1.06}
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
          colorTint={colorTint}
          colorTintStrength={colorTintStrength}
          lightPos={videoPos}
        />
      ) : null}

      {/* Video plane overlay */}
      {videoEl ? (
        <VideoPlane
          videoEl={videoEl}
          lumaKey={lumaKey}
          refinement={refinement}
          invertMask={invertMask}
          flipX={flipX}
          flipY={flipY}
          colorTint={colorTint}
          colorTintStrength={colorTintStrength}
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
  intensity: number;
  luminance: number;
  satBoost: number;
  greyThreshold: number;
  colorTint: [number, number, number];
  colorTintStrength: number;
  lightPos: [number, number, number]; // posição do efeito de vídeo no cenário
}

const VideoSceneLighting: React.FC<VideoSceneLightingProps> = ({ videoEl, intensity, luminance, satBoost, greyThreshold, colorTint, colorTintStrength, lightPos }) => {
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
      let sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < px.length; i += 4) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; }
      const n = px.length / 4;
      let cr = sr / n / 255, cg = sg / n / 255, cb = sb / n / 255;

      // ── Apply tint — same max-channel formula as the GLSL shader ──────────
      // Must happen on raw sRGB floats BEFORE the HSL normalisation so the
      // emitted light hue matches exactly what the eye sees on the video plane.
      if (colorTintStrength > 0) {
        const tr = colorTint[0], tg = colorTint[1], tb = colorTint[2];
        const tMax = Math.max(tr, tg, tb, 0.001);
        const tnr = tr / tMax, tng = tg / tMax, tnb = tb / tMax;
        const lum = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
        const rr = tnr * lum, rg = tng * lum, rb = tnb * lum;
        cr = cr + (rr - cr) * colorTintStrength;
        cg = cg + (rg - cg) * colorTintStrength;
        cb = cb + (rb - cb) * colorTintStrength;
      }

      // ── Normalise to controlled saturation + fixed luminance ──────────────
      dominantColor.current.setRGB(cr, cg, cb);
      const hsl = { h: 0, s: 0, l: 0 };
      dominantColor.current.getHSL(hsl);
      const boosted = Math.min(1, hsl.s * satBoost);
      const effectiveSat = Math.max(0, boosted - greyThreshold);
      dominantColor.current.setHSL(hsl.h, effectiveSat, luminance);
    }

    // ── PointLight na posição do efeito de vídeo — ilumina as faces voltadas para o efeito ──
    if (pointLightRef.current) {
      pointLightRef.current.position.set(lightPos[0], lightPos[1], lightPos[2]);
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

        // ── Aplicar o mesmo tint do shader nos pixels do env-map ────────────
        // Canvas 64×32 = 2048px — getImageData é barato a 5 fps
        if (colorTintStrength > 0) {
          const imgData = ctx.getImageData(0, 0, 64, 32);
          const d = imgData.data;
          const tr = colorTint[0], tg = colorTint[1], tb = colorTint[2];
          const tMax = Math.max(tr, tg, tb, 0.001);
          const tnr = tr / tMax, tng = tg / tMax, tnb = tb / tMax;
          for (let i = 0; i < d.length; i += 4) {
            const cr = d[i] / 255, cg = d[i + 1] / 255, cb = d[i + 2] / 255;
            const lum = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
            d[i]     = Math.round((cr + (tnr * lum - cr) * colorTintStrength) * 255);
            d[i + 1] = Math.round((cg + (tng * lum - cg) * colorTintStrength) * 255);
            d[i + 2] = Math.round((cb + (tnb * lum - cb) * colorTintStrength) * 255);
          }
          ctx.putImageData(imgData, 0, 0);
        }

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
  duration: number;
  trimIn: number;
  trimOut: number;
  currentTime: number;
  onTrim: (inPt: number, outPt: number) => void;
  onSeek: (t: number) => void;
}

type TrimHandle = 'in' | 'out' | 'body';
interface TrimDrag { handle: TrimHandle; startX: number; startIn: number; startOut: number; }

const ZOOM_LEVELS = [1, 2, 4, 8, 16];

const VideoTimeline: React.FC<TimelineProps> = ({
  duration,
  trimIn,
  trimOut,
  currentTime,
  onTrim,
  onSeek,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);   // outer scrollable container
  const innerRef  = useRef<HTMLDivElement>(null);   // inner wide content div
  const dragRef   = useRef<TrimDrag | null>(null);
  const [zoom, setZoom] = useState(1);
  const dur = Math.max(duration, 0.1);

  // When zoom or playhead changes, keep playhead centred in the scroll view
  useEffect(() => {
    if (zoom <= 1) return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const headFrac = currentTime / dur;
    const target = headFrac * scroll.scrollWidth - scroll.clientWidth / 2;
    scroll.scrollLeft = Math.max(0, Math.min(target, scroll.scrollWidth - scroll.clientWidth));
  }, [currentTime, zoom, dur]);

  // Convert a clientX to a time value using the inner (wide) div rect
  const clientXToTime = useCallback(
    (clientX: number) => {
      const rect = innerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return Math.max(0, Math.min(dur, ((clientX - rect.left) / rect.width) * dur));
    },
    [dur],
  );

  const toPercent = (t: number) => `${Math.min(100, (t / dur) * 100).toFixed(4)}%`;

  const startDrag = useCallback(
    (e: React.PointerEvent, handle: TrimHandle) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { handle, startX: clientXToTime(e.clientX), startIn: trimIn, startOut: trimOut };
    },
    [clientXToTime, trimIn, trimOut],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = clientXToTime(e.clientX) - drag.startX;
      const MIN = 0.02;
      if (drag.handle === 'in') {
        onTrim(Math.max(0, Math.min(drag.startIn + delta, drag.startOut - MIN)), drag.startOut);
      } else if (drag.handle === 'out') {
        onTrim(drag.startIn, Math.max(drag.startIn + MIN, Math.min(drag.startOut + delta, dur)));
      } else {
        const len = drag.startOut - drag.startIn;
        const ni = Math.max(0, Math.min(drag.startIn + delta, dur - len));
        onTrim(ni, ni + len);
      }
    },
    [clientXToTime, onTrim, dur],
  );

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const visibleDur = dur / zoom;
    const step = visibleDur <= 0.5 ? 0.05
      : visibleDur <= 2  ? 0.1
      : visibleDur <= 5  ? 0.5
      : visibleDur <= 15 ? 1
      : visibleDur <= 60 ? 5 : 10;
    for (let t = 0; t <= dur; t += step) ticks.push(parseFloat(t.toFixed(6)));
    return ticks;
  }, [dur, zoom]);

  const clipLeft   = toPercent(trimIn);
  const clipWidth  = `${Math.max(0, ((trimOut - trimIn) / dur) * 100).toFixed(4)}%`;
  const headLeft   = toPercent(currentTime);
  const trimmedSec = (trimOut - trimIn).toFixed(3);

  const zoomBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '1px 7px',
    fontSize: 10,
    fontWeight: 700,
    background: active ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.6)',
    border: `1px solid ${active ? '#38bdf8' : 'rgba(51,65,85,0.5)'}`,
    borderRadius: 5,
    color: active ? '#38bdf8' : '#64748b',
    cursor: 'pointer',
  });

  return (
    <div style={{ userSelect: 'none', touchAction: 'none' }}>

      {/* ── Zoom controls ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 2 }}>Zoom</span>
        {ZOOM_LEVELS.map((z) => (
          <button key={z} style={zoomBtnStyle(zoom === z)} onClick={() => setZoom(z)}>
            {z}×
          </button>
        ))}
        {zoom > 1 && (
          <span style={{ marginLeft: 4, fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
            visível: {(dur / zoom).toFixed(2)}s
          </span>
        )}
      </div>

      {/* ── Scrollable wrapper ─────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{ overflowX: zoom > 1 ? 'scroll' : 'hidden', borderRadius: 8 }}
      >
        {/* Inner wide content — zoom × wider than the viewport */}
        <div
          ref={innerRef}
          style={{ width: `${zoom * 100}%`, position: 'relative' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* ── Ruler ─────────────────────────────────────── */}
          <div
            style={{ position: 'relative', height: 22, background: 'rgba(2,6,23,0.85)', borderRadius: zoom > 1 ? 0 : '8px 8px 0 0', border: '1px solid rgba(51,65,85,0.5)', cursor: 'pointer', overflow: 'hidden' }}
            onClick={(e) => {
              const rect = innerRef.current?.getBoundingClientRect();
              if (!rect) return;
              onSeek(Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur)));
            }}
          >
            {rulerTicks.map((t) => (
              <div key={t} style={{ position: 'absolute', left: toPercent(t), top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 1, height: 8, background: 'rgba(100,116,139,0.5)' }} />
                <span style={{ fontSize: 9, color: '#4b5563', lineHeight: 1, marginTop: 1, transform: 'translateX(-40%)', whiteSpace: 'nowrap' }}>{t.toFixed(zoom >= 8 ? 2 : 1)}s</span>
              </div>
            ))}
            <div style={{ position: 'absolute', left: headLeft, top: 0, bottom: 0, width: 2, background: '#f43f5e', zIndex: 5, pointerEvents: 'none' }} />
          </div>

          {/* ── Track ─────────────────────────────────────── */}
          <div style={{ position: 'relative', height: 46, background: 'rgba(8,14,30,0.7)', border: '1px solid rgba(51,65,85,0.4)', borderTop: 'none', borderRadius: zoom > 1 ? 0 : '0 0 8px 8px', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

            {/* Active clip */}
            <div
              style={{ position: 'absolute', top: 5, bottom: 5, left: clipLeft, width: clipWidth, background: 'linear-gradient(135deg,rgba(14,165,233,0.22),rgba(56,189,248,0.18))', border: '1px solid rgba(56,189,248,0.55)', borderRadius: 6, cursor: 'grab', display: 'flex', alignItems: 'center', overflow: 'hidden' }}
              onPointerDown={(e) => startDrag(e, 'body')}
            >
              {/* IN handle */}
              <div
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: '#38bdf8', cursor: 'ew-resize', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'in'); }}
              >
                <div style={{ width: 2, height: 18, background: 'rgba(2,6,23,0.6)', borderRadius: 1 }} />
              </div>
              {/* Label */}
              <span style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 700, paddingLeft: 18, overflow: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none' }}>
                {trimIn.toFixed(3)}s – {trimOut.toFixed(3)}s &nbsp;({trimmedSec}s)
              </span>
              {/* OUT handle */}
              <div
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, background: '#38bdf8', cursor: 'ew-resize', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, 'out'); }}
              >
                <div style={{ width: 2, height: 18, background: 'rgba(2,6,23,0.6)', borderRadius: 1 }} />
              </div>
            </div>

            {/* Playhead */}
            <div style={{ position: 'absolute', left: headLeft, top: 0, bottom: 0, width: 2, background: '#f43f5e', zIndex: 10, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #f43f5e' }} />
            </div>
          </div>
        </div>{/* end inner */}
      </div>{/* end scroll wrapper */}

      {/* ── Footer ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>Trecho: <span style={{ color: '#7dd3fc' }}>{trimmedSec}s</span></span>
        <span style={{ fontSize: 10, color: '#f43f5e', fontWeight: 700, fontFamily: 'monospace' }}>{currentTime.toFixed(3)}s / {dur.toFixed(2)}s</span>
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

  // ── Timeline state ────────────────────────────────────────────────────────
  const [videoIn, setVideoIn] = useState(0);
  const [videoOut, setVideoOut] = useState(3.0);
  const [currentTime, setCurrentTime] = useState(0);

  // ── Playback state ────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loop, setLoop] = useState(false);
  const [pingPong, setPingPong] = useState(false);
  const pingPongDirRef = useRef<1 | -1>(1); // 1=frente, -1=volta

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
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [colorTintHex, setColorTintHex] = useState('#ffffff');
  const [colorTintStrength, setColorTintStrength] = useState(0);
  const colorTint = hexToRgb01(colorTintHex);

  // ── Reference character ───────────────────────────────────────────────────
  const [heroClassId, setHeroClassId] = useState<PlayerClassId>(PLAYER_CLASSES[0]?.id ?? 'warrior');
  const [previewReference, setPreviewReference] = useState<'hero' | 'enemy' | 'enemy2d' | 'hero2d'>('hero');
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [sprite2DIndex, setSprite2DIndex] = useState(0);
  const [hero2DIndex, setHero2DIndex] = useState(0);

  // Para referências 2D (billboard) o orbit não faz sentido — auto-ativa o modo mover vídeo
  React.useEffect(() => {
    if (previewReference === 'enemy2d' || previewReference === 'hero2d') {
      setLockOrbit(true);
    } else {
      setLockOrbit(false);
    }
  }, [previewReference]);

  const sprite2DEnemy  = ENEMIES_2D[Math.max(0, Math.min(sprite2DIndex, ENEMIES_2D.length - 1))];
  const sprite2DUrl    = sprite2DEnemy?.sprites.idle ?? '';
  const sprite2DHeight = sprite2DEnemy?.scale ?? 2.0;
  const hero2DHero   = HEROES_2D[Math.max(0, Math.min(hero2DIndex, HEROES_2D.length - 1))];
  const hero2DUrl    = hero2DHero?.sprites.idle ?? '';
  const hero2DHeight = hero2DHero?.scale ?? 2.0;

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
  const [effectName, setEffectName] = useState('');
  const [mutePreview, setMutePreview] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ── DOM refs for media elements ───────────────────────────────────────────
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const videoObjUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartWallRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);
  const seekReadyRef = useRef(true); // true quando o decoder terminou o seek anterior

  // ── Video element setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!videoElRef.current) {
      const el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.addEventListener('seeked', () => { seekReadyRef.current = true; });
      videoElRef.current = el;
    }
  }, []);

  // Sync mute preference to the video element
  useEffect(() => {
    if (videoElRef.current) videoElRef.current.muted = mutePreview;
  }, [mutePreview]);

  // Cleanup blob URLs on unmount
  useEffect(() => () => {
    if (videoObjUrlRef.current) URL.revokeObjectURL(videoObjUrlRef.current);
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

  const handleAudioFile = (_e: React.ChangeEvent<HTMLInputElement>) => { /* removed — use video’s own audio */ };

  const clearVideo = () => {
    setIsPlaying(false);
    if (videoObjUrlRef.current) URL.revokeObjectURL(videoObjUrlRef.current);
    videoObjUrlRef.current = null;
    setVideoUrl(null);
    setVideoFileName('');
    if (videoElRef.current) { videoElRef.current.src = ''; videoElRef.current.load(); }
  };

  // ── Playback engine ───────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    videoElRef.current?.pause();
  }, []);

  const startPlayback = useCallback(
    (fromTime: number) => {
      const video = videoElRef.current;
      if (!video || !videoUrl) return;

      const clampedStart = Math.max(videoIn, Math.min(fromTime, videoOut - 0.01));
      video.playbackRate = playbackSpeed;
      video.currentTime = clampedStart;
      video.play().catch(() => {});

      setIsPlaying(true);
      playStartWallRef.current = performance.now();
      playStartTimeRef.current = clampedStart;

      const tick = () => {
        // ── Fase VOLTA (ping-pong revertendo) ────────────────────────────
        if (pingPong && pingPongDirRef.current === -1) {
          const elapsed = (performance.now() - playStartWallRef.current) / 1000;
          const tBack = playStartTimeRef.current - elapsed * playbackSpeed;
          if (tBack <= videoIn) {
            // Chegou no início → inverte para FRENTE
            seekReadyRef.current = true;
            pingPongDirRef.current = 1;
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = videoIn;
            video.currentTime = videoIn;
            video.play().catch(() => {});
            setCurrentTime(videoIn);
          } else if (seekReadyRef.current) {
            // Decoder livre → dispara o próximo seek
            seekReadyRef.current = false;
            video.currentTime = tBack;
            setCurrentTime(tBack);
          }
          // se !seekReady, apenas aguarda o próximo frame sem fazer nada
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // ── Fase FRENTE (normal) ──────────────────────────────────────────
        const elapsed = (performance.now() - playStartWallRef.current) / 1000;
        const t = playStartTimeRef.current + elapsed * playbackSpeed;

        if (t >= videoOut) {
          if (pingPong) {
            // Chegou no fim → inverte para VOLTA
            pingPongDirRef.current = -1;
            seekReadyRef.current = true; // libera o primeiro seek reverso
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = videoOut;
            video.pause();
            video.currentTime = videoOut;
            setCurrentTime(videoOut);
          } else if (loop) {
            playStartWallRef.current = performance.now();
            playStartTimeRef.current = videoIn;
            if (video) { video.currentTime = videoIn; video.play().catch(() => {}); }
          } else {
            stopPlayback();
            setCurrentTime(videoOut);
            return;
          }
        } else {
          setCurrentTime(t);
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [videoUrl, videoIn, videoOut, playbackSpeed, loop, pingPong, stopPlayback],
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
      const clamped = Math.max(0, Math.min(videoDuration, t));
      setCurrentTime(clamped);
      if (videoElRef.current && videoUrl) videoElRef.current.currentTime = Math.max(videoIn, Math.min(videoOut, clamped));
    },
    [videoDuration, videoUrl, videoIn, videoOut],
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
    timeline: {
      trimIn: videoIn,
      trimOut: videoOut,
      duration: videoOut - videoIn,
    },
    placement: {
      position: [...videoPos] as [number, number, number],
      scale: videoScale,
      billboard: videoBillboard,
      flipX,
      flipY,
    },
    lumaKey: { ...lumaKey },
    refinement: { ...refinement },
    invertMask,
    colorTint: {
      color: colorTintHex,
      strength: colorTintStrength,
    },
    videoLight: {
      enabled: videoLight,
      intensity: videoLightIntensity,
      luminance: videoLightLuminance,
      satBoost: videoLightSatBoost,
      greyThreshold: videoLightGreyThreshold,
    },
    playback: {
      speed: playbackSpeed,
      loop,
      pingPong,
    },
  }), [videoFileName, videoIn, videoOut, videoPos, videoScale, videoBillboard, flipX, flipY, lumaKey, refinement, invertMask, colorTintHex, colorTintStrength, videoLight, videoLightIntensity, videoLightLuminance, videoLightSatBoost, videoLightGreyThreshold, playbackSpeed, loop, pingPong]);

  const resolvedName = (effectName.trim() || videoFileName.replace(/\.[^.]+$/, '') || 'video_effect').replace(/\s+/g, '_');

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
    a.download = `${resolvedName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Timeline handlers ─────────────────────────────────────────────────────
  const handleVideoTrim = useCallback((inPt: number, outPt: number) => {
    setVideoIn(inPt);
    setVideoOut(outPt);
  }, []);

  // ── Video export ──────────────────────────────────────────────────────────
  const exportTrimmedVideo = useCallback(async () => {
    const video = videoElRef.current;
    if (!video || !videoUrl) return;
    setExporting(true); setExportProgress(0);
    const wasMuted = video.muted;
    video.muted = false; video.volume = 1;
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus' : 'video/webm';
    const stream = (video as unknown as { captureStream: () => MediaStream }).captureStream();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${resolvedName}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      video.muted = wasMuted; video.pause();
      setExporting(false); setExportProgress(100);
      setTimeout(() => setExportProgress(0), 1500);
    };
    video.currentTime = videoIn;
    await new Promise<void>((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
      video.addEventListener('seeked', onSeeked);
    });
    recorder.start(100);
    video.playbackRate = 1.0; video.play().catch(() => {});
    const duration = videoOut - videoIn;
    const startWall = performance.now();
    const checkInterval = setInterval(() => {
      const elapsed = (performance.now() - startWall) / 1000;
      setExportProgress(Math.min(96, (elapsed / duration) * 100));
      if (video.currentTime >= videoOut - 0.04 || elapsed >= duration + 0.3) {
        clearInterval(checkInterval); video.pause(); recorder.stop();
      }
    }, 50);
  }, [videoUrl, videoIn, videoOut, videoFileName, resolvedName]);

  const exportAll = useCallback(async () => {
    downloadJson();
    await exportTrimmedVideo();
  }, [downloadJson, exportTrimmedVideo]);

  const loadJsonInputRef = useRef<HTMLInputElement>(null);

  const loadJsonFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const cfg = JSON.parse(e.target?.result as string) as VideoEffectConfig;
        // timeline
        if (cfg.timeline) {
          if (cfg.timeline.trimIn  != null) setVideoIn(cfg.timeline.trimIn);
          if (cfg.timeline.trimOut != null) setVideoOut(cfg.timeline.trimOut);
        }
        // placement
        if (cfg.placement) {
          if (cfg.placement.position) setVideoPos(cfg.placement.position);
          if (cfg.placement.scale    != null) setVideoScale(cfg.placement.scale);
          if (cfg.placement.billboard != null) setVideoBillboard(cfg.placement.billboard);
          if (cfg.placement.flipX    != null) setFlipX(cfg.placement.flipX);
          if (cfg.placement.flipY    != null) setFlipY(cfg.placement.flipY);
        }
        // luma key
        if (cfg.lumaKey)    setLumaKey({ ...DEFAULT_LUMA,       ...cfg.lumaKey });
        // refinement
        if (cfg.refinement) setRefinement({ ...DEFAULT_REFINEMENT, ...cfg.refinement });
        // invertMask
        if (cfg.invertMask != null) setInvertMask(cfg.invertMask);
        // color tint
        if (cfg.colorTint) {
          if (cfg.colorTint.color    != null) setColorTintHex(cfg.colorTint.color);
          if (cfg.colorTint.strength != null) setColorTintStrength(cfg.colorTint.strength);
        }
        // video light
        if (cfg.videoLight) {
          if (cfg.videoLight.enabled       != null) setVideoLight(cfg.videoLight.enabled);
          if (cfg.videoLight.intensity     != null) setVideoLightIntensity(cfg.videoLight.intensity);
          if (cfg.videoLight.luminance     != null) setVideoLightLuminance(cfg.videoLight.luminance);
          if (cfg.videoLight.satBoost      != null) setVideoLightSatBoost(cfg.videoLight.satBoost);
          if (cfg.videoLight.greyThreshold != null) setVideoLightGreyThreshold(cfg.videoLight.greyThreshold);
        }
        // playback
        if (cfg.playback) {
          if (cfg.playback.speed    != null) { setPlaybackSpeed(cfg.playback.speed); if (videoElRef.current) videoElRef.current.playbackRate = cfg.playback.speed; }
          if (cfg.playback.loop     != null) setLoop(cfg.playback.loop);
          if ((cfg.playback as { pingPong?: boolean }).pingPong != null) setPingPong((cfg.playback as { pingPong?: boolean }).pingPong!);
          if (cfg.playback.pingPong != null) setPingPong(cfg.playback.pingPong);
        }
        // effect name from filename
        if (cfg.videoFileName) setEffectName(cfg.videoFileName.replace(/\.[^.]+$/, ''));
      } catch {
        // invalid JSON — ignore
      }
    };
    reader.readAsText(file);
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
          Upload MP4 → posicione no 3D → configure luma key → corte na timeline → exporte vídeo e JSON
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

              {/* O áudio é o do próprio vídeo — sem upload separado */}
            </div>

            {/* Timeline panel */}
            {videoUrl && (
              <div style={panelStyle}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 10 }}>Timeline</div>
                <VideoTimeline
                  duration={videoDuration}
                  trimIn={videoIn}
                  trimOut={videoOut}
                  currentTime={currentTime}
                  onTrim={handleVideoTrim}
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
                    <button style={actionBtnStyle(loop, '#f59e0b')} onClick={() => { setLoop((v) => !v); if (pingPong) setPingPong(false); }}>🔁 Loop</button>
                    <button
                      style={actionBtnStyle(pingPong, '#a78bfa')}
                      onClick={() => {
                        setPingPong((v) => {
                          if (!v) { setLoop(false); pingPongDirRef.current = 1; }
                          return !v;
                        });
                      }}
                    >🔀 Vai-e-Volta</button>
                    <button style={actionBtnStyle(pingPong, '#a78bfa')} onClick={() => { setPingPong((v) => !v); if (!pingPong) { setLoop(false); pingPongDirRef.current = 1; } }}>🔀 Vai-e-Volta</button>
                    <button style={actionBtnStyle(mutePreview, '#94a3b8')} onClick={() => setMutePreview((v) => !v)}>{mutePreview ? '🔇 Mudo' : '🔊 Som'}</button>
                    <button style={actionBtnStyle(false)} onClick={() => handleFrameStep(-1)} disabled={!videoUrl}>◀ Frame</button>
                    <button style={actionBtnStyle(false)} onClick={() => handleFrameStep(1)} disabled={!videoUrl}>Frame ▶</button>
                  </div>
                  <SliderRow label="Velocidade" value={playbackSpeed} min={0.1} max={3.0} step={0.05} onChange={(v) => { setPlaybackSpeed(v); if (videoElRef.current) videoElRef.current.playbackRate = v; }} />
                </>
              )}
            </div>

            {/* Reference character */}
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 10 }}>Referência 3D</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button style={actionBtnStyle(previewReference === 'hero', '#a78bfa')} onClick={() => setPreviewReference('hero')}>Herói</button>
                <button style={actionBtnStyle(previewReference === 'enemy', '#a78bfa')} onClick={() => setPreviewReference('enemy')}>Inimigo 3D</button>
                <button style={actionBtnStyle(previewReference === 'enemy2d', '#f472b6')} onClick={() => setPreviewReference('enemy2d')}>Inimigo 2D</button>
                <button style={actionBtnStyle(previewReference === 'hero2d', '#34d399')} onClick={() => setPreviewReference('hero2d')}>Herói 2D</button>
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
              {previewReference === 'enemy2d' && (
                <>
                  <select
                    value={sprite2DIndex}
                    onChange={(e) => setSprite2DIndex(parseInt(e.target.value, 10))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }}
                  >
                    {ENEMIES_2D.map((en, idx) => (
                      <option key={en.id} value={idx}>{en.name} (Lv.{en.level})</option>
                    ))}
                  </select>
                  {sprite2DEnemy && (
                    <div style={{ marginTop: 5, fontSize: 10, color: '#a78bfa' }}>
                      {sprite2DEnemy.race} · scale {sprite2DEnemy.scale ?? 2.0}
                    </div>
                  )}
                </>
              )}
              {previewReference === 'hero2d' && (
                <>
                  <select
                    value={hero2DIndex}
                    onChange={(e) => setHero2DIndex(parseInt(e.target.value, 10))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }}
                  >
                    {HEROES_2D.map((h, idx) => (
                      <option key={h.id} value={idx}>{h.name} — {h.title}</option>
                    ))}
                  </select>
                  {hero2DHero && (
                    <div style={{ marginTop: 5, fontSize: 10, color: '#34d399' }}>
                      {hero2DHero.attackStyle ?? 'melee'} · scale {hero2DHero.scale ?? 2.0}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Export buttons */}
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#34d399', marginBottom: 10 }}>Exportar</div>

              {/* Effect name input */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>Nome do efeito</div>
                <input
                  type="text"
                  value={effectName}
                  onChange={(e) => setEffectName(e.target.value)}
                  placeholder={`${videoFileName.replace(/\.[^.]+$/, '') || 'video_effect'}`}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '6px 10px', fontSize: 12, outline: 'none' }}
                />
                <div style={{ marginTop: 3, fontSize: 9, color: '#475569' }}>Arquivo: <span style={{ color: '#7dd3fc' }}>{resolvedName}.json</span> + <span style={{ color: '#fbbf24' }}>{resolvedName}.webm</span></div>
              </div>

              {/* Export all — primary action */}
              <button
                style={{ ...actionBtnStyle(exporting, '#34d399'), width: '100%', marginBottom: 8, justifyContent: 'center', fontWeight: 900, fontSize: 12 }}
                onClick={exportAll}
                disabled={!videoUrl || exporting}
              >
                {exporting ? `⏳ Gravando… ${exportProgress.toFixed(0)}%` : '🚀 Exportar JSON + Vídeo'}
              </button>

              {exportProgress > 0 && exportProgress < 100 && (
                <div style={{ marginBottom: 8, height: 4, background: 'rgba(51,65,85,0.4)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${exportProgress}%`, background: '#34d399', borderRadius: 4, transition: 'width 0.1s linear' }} />
                </div>
              )}

              {/* Individual exports */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={actionBtnStyle(copyStatus === 'ok', '#94a3b8')} onClick={copyJson}>
                  {copyStatus === 'ok' ? '✓ Copiado!' : '📋 Copiar JSON'}
                </button>
                <button style={actionBtnStyle(false, '#94a3b8')} onClick={downloadJson}>
                  ⬇ Baixar JSON
                </button>
                <button
                  style={actionBtnStyle(exporting, '#f59e0b')}
                  onClick={exportTrimmedVideo}
                  disabled={!videoUrl || exporting}
                >
                  🎬 Só Vídeo
                </button>
              </div>

              {/* Load JSON */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(51,65,85,0.35)' }}>
                <input
                  ref={loadJsonInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadJsonFile(file);
                    e.target.value = '';
                  }}
                />
                <button
                  style={{ ...actionBtnStyle(false, '#818cf8'), width: '100%', justifyContent: 'center' }}
                  onClick={() => loadJsonInputRef.current?.click()}
                >
                  📂 Carregar JSON
                </button>
                <div style={{ marginTop: 4, fontSize: 9, color: '#475569', textAlign: 'center' }}>
                  Restaura todos os parâmetros de um .json exportado
                </div>
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
                    flipX={flipX}
                    flipY={flipY}
                    colorTint={colorTint}
                    colorTintStrength={colorTintStrength}
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
                    sprite2DUrl={sprite2DUrl}
                    sprite2DHeight={sprite2DHeight}
                    hero2DUrl={hero2DUrl}
                    hero2DHeight={hero2DHeight}
                    lockOrbit={lockOrbit}
                    onPositionChange={setVideoPos}
                    onScaleChange={setVideoScale}
                  />
                </Suspense>
              </div>

              {/* Lock orbit toggle + video light toggle */}
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                <button
                  style={{ ...actionBtnStyle(flipX, '#f472b6'), padding: '5px 12px', fontSize: 10 }}
                  onClick={() => setFlipX((v) => !v)}
                  title="Espelhar horizontalmente (esquerda ↔ direita)"
                >
                  ⇔ Flip H
                </button>
                <button
                  style={{ ...actionBtnStyle(flipY, '#f472b6'), padding: '5px 12px', fontSize: 10 }}
                  onClick={() => setFlipY((v) => !v)}
                  title="Espelhar verticalmente (cima ↔ baixo)"
                >
                  ⇕ Flip V
                </button>
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

                  {/* ── Cor do Efeito ────────────────────────── */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(51,65,85,0.4)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f472b6', marginBottom: 8 }}>Cor do Efeito</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <label style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, flexShrink: 0 }}>Cor</label>
                      <input
                        type="color"
                        value={colorTintHex}
                        onChange={(e) => setColorTintHex(e.target.value)}
                        style={{ width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none', padding: 0 }}
                      />
                      <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>{colorTintHex}</span>
                      {colorTintHex !== '#ffffff' && (
                        <button
                          style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 5, color: '#64748b', cursor: 'pointer' }}
                          onClick={() => setColorTintHex('#ffffff')}
                        >
                          reset
                        </button>
                      )}
                    </div>
                    <SliderRow label="Intensidade" value={colorTintStrength} min={0} max={1} onChange={setColorTintStrength} />
                    {colorTintStrength === 0 && <div style={{ fontSize: 9, color: '#374151', marginTop: 2 }}>Intensidade 0 = cor original</div>}
                  </div>
                </>
              )}
            </div>

          </div>{/* end RIGHT COLUMN */}
        </div>

      </div>
    </div>
  );
};
