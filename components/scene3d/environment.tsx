import React, { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelPart } from '../items/VoxelPart';
import type { RenderQualityProfile } from './types';

const disableRaycast = () => null;

export type RenderPlatform = 'desktop' | 'mobile';
export type RenderQualityPreset = 'performance' | 'balanced' | 'quality';

const MOBILE_USER_AGENT_PATTERN = /android|iphone|ipad|ipod|mobile/i;

const DESKTOP_PERFORMANCE_PROFILE: RenderQualityProfile = {
  isLowQuality: true,
  dpr: [0.8, 1],
  shadowMapSize: 512,
  starsCount: 260,
  contactShadowResolution: 56,
  antialias: false,
};

const DESKTOP_BALANCED_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.15],
  shadowMapSize: 640,
  starsCount: 580,
  contactShadowResolution: 72,
  antialias: false,
};

const DESKTOP_QUALITY_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.2],
  shadowMapSize: 1024,
  starsCount: 760,
  contactShadowResolution: 80,
  antialias: true,
};

const MOBILE_PERFORMANCE_PROFILE: RenderQualityProfile = {
  isLowQuality: true,
  dpr: [0.65, 0.85],
  shadowMapSize: 384,
  starsCount: 140,
  contactShadowResolution: 44,
  antialias: false,
};

const MOBILE_BALANCED_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [0.85, 1.1],
  shadowMapSize: 512,
  starsCount: 460,
  contactShadowResolution: 72,
  antialias: false,
};

const MOBILE_QUALITY_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.5],
  shadowMapSize: 1536,
  starsCount: 900,
  contactShadowResolution: 144,
  antialias: true,
};

// Dedicated high-quality profile used exclusively in the Electron desktop build.
// No mobile / thermal constraints apply — target the best GPU in the machine.
const ELECTRON_QUALITY_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.5],
  shadowMapSize: 2048,
  starsCount: 900,
  contactShadowResolution: 100,
  antialias: true,
};

const cloneRenderQualityProfile = (profile: RenderQualityProfile): RenderQualityProfile => ({
  ...profile,
  dpr: [profile.dpr[0], profile.dpr[1]],
});

// Runtime detection — the preload bridge sets this before the page loads.
const isElectronRuntime = (): boolean =>
  typeof window !== 'undefined' && (window as Window & { electronBridge?: { isElectron: boolean } }).electronBridge?.isElectron === true;

export const getRenderPlatform = (): RenderPlatform => {
  // In the Electron build there is no mobile layout — always desktop.
  if (isElectronRuntime()) return 'desktop';

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }

  const touchPoints = navigator.maxTouchPoints ?? 0;
  const userAgent = navigator.userAgent.toLowerCase();
  const compactViewport = window.innerWidth < 1024;
  const mobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(userAgent);

  if (mobileUserAgent || (touchPoints > 1 && compactViewport)) {
    return 'mobile';
  }

  return 'desktop';
};

export const getDefaultRenderQualityPreset = (platform = getRenderPlatform()): RenderQualityPreset => {
  // Electron desktop: always start in quality mode — no thermal/battery limits.
  if (isElectronRuntime()) return 'quality';
  return platform === 'mobile' ? 'performance' : 'balanced';
};

export const getRenderPowerPreference = (preset?: RenderQualityPreset): WebGLPowerPreference => {
  // In the Electron desktop build always request the high-performance GPU.
  if (isElectronRuntime()) return 'high-performance';

  if (preset === 'quality') {
    return 'high-performance';
  }

  if (preset === 'performance') {
    return 'low-power';
  }

  return getRenderPlatform() === 'mobile' ? 'low-power' : 'high-performance';
};

export const createModularBuilderQualityProfile = (base: RenderQualityProfile): RenderQualityProfile => ({
  isLowQuality: true,
  dpr: [
    Math.min(1, Math.max(base.dpr[0], Math.min(base.dpr[1], 1.25))),
    Math.max(base.dpr[0], Math.min(base.dpr[1], 1.25)),
  ],
  shadowMapSize: Math.min(base.shadowMapSize, 512),
  starsCount: 0,
  contactShadowResolution: Math.min(base.contactShadowResolution, 64),
  antialias: false,
});

export const getRenderQualityProfile = (preset?: RenderQualityPreset): RenderQualityProfile => {
  // Electron desktop: always use the maximum quality profile regardless of
  // preset or platform — no mobile/thermal constraints apply here.
  if (isElectronRuntime()) {
    return cloneRenderQualityProfile(ELECTRON_QUALITY_PROFILE);
  }

  const platform = getRenderPlatform();
  const selectedPreset = preset ?? getDefaultRenderQualityPreset(platform);

  if (platform === 'mobile') {
    if (selectedPreset === 'quality') {
      return cloneRenderQualityProfile(MOBILE_QUALITY_PROFILE);
    }

    if (selectedPreset === 'balanced') {
      return cloneRenderQualityProfile(MOBILE_BALANCED_PROFILE);
    }

    return cloneRenderQualityProfile(MOBILE_PERFORMANCE_PROFILE);
  }

  if (selectedPreset === 'quality') {
    return cloneRenderQualityProfile(DESKTOP_QUALITY_PROFILE);
  }

  if (selectedPreset === 'performance') {
    return cloneRenderQualityProfile(DESKTOP_PERFORMANCE_PROFILE);
  }

  return cloneRenderQualityProfile(DESKTOP_BALANCED_PROFILE);
};

export const GrassFloor = () => {
  const tiles = useMemo(() => {
    const arr = [];
    for (let x = -40; x <= 40; x += 8) {
      for (let z = -50; z <= 20; z += 8) {
        const h = 0.1 + Math.random() * 0.1;
        const greens = ['#166534', '#15803d', '#14532d', '#166534'];
        const color = greens[Math.floor(Math.random() * greens.length)];
        arr.push(
          <VoxelPart
            key={`${x}-${z}`}
            position={[x, -1.1, z]}
            size={[7.8, h, 7.8]}
            color={color}
            material="standard"
            castShadow={false}
            receiveShadow={false}
          />,
        );
      }
    }
    return arr;
  }, []);

  return <group>{tiles}</group>;
};

export const Tree = ({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) => (
  <group position={position} scale={scale}>
    <VoxelPart position={[0, 0.5, 0]} size={[0.3, 1, 0.3]} color="#451a03" material="leather" castShadow={false} receiveShadow={false} />
    <group position={[0, 1.2, 0]}>
      <VoxelPart position={[0, 0.4, 0]} size={[1.2, 0.8, 1.2]} color="#15803d" material="cloth" castShadow={false} receiveShadow={false} />
      <VoxelPart position={[0, 1.0, 0]} size={[0.8, 0.6, 0.8]} color="#166534" material="cloth" castShadow={false} receiveShadow={false} />
      <VoxelPart position={[0, 1.4, 0]} size={[0.4, 0.4, 0.4]} color="#14532d" material="cloth" castShadow={false} receiveShadow={false} />
    </group>
  </group>
);

const SKYBOX_FACES = ['px.webp', 'nx.webp', 'py.webp', 'ny.webp', 'pz.webp', 'nz.webp'] as const;

// Use BASE_URL as prefix so paths are relative (./skybox/…) in the Electron
// file:// build and absolute (/skybox/…) in the normal web build.
const SKYBOX_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const SKYBOX_PATHS: Record<string, string> = {
  manha: `${SKYBOX_BASE}/skybox/manha/`,
  dia: `${SKYBOX_BASE}/skybox/dia/`,
  sol: `${SKYBOX_BASE}/skybox/sol/`,
  tarde: `${SKYBOX_BASE}/skybox/tarde/`,
  noite: `${SKYBOX_BASE}/skybox/noite/`,
};

type SkyboxTheme = keyof typeof SKYBOX_PATHS;

const getSkyboxLoadOrder = (): SkyboxTheme[] => ['sol', 'dia', 'tarde', 'noite', 'manha'];

const shouldStageSkyboxLoading = () => {
  // In Electron there are no thermal or memory constraints to work around —
  // load all skybox cubemaps at once for instant day/night transitions.
  if (isElectronRuntime()) return false;

  if (typeof window === 'undefined') {
    return false;
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const compactScreen = window.innerWidth < 900;
  return cores <= 6 || memory <= 6 || compactScreen;
};

const getGameT = (elapsed: number) => ((elapsed * 2 + 720) / 1440) % 1;

const DAY_NIGHT_TIMES = {
  manha: 5 / 24,
  dia: 8 / 24,
  sol: 11 / 24,
  solEnd: 13 / 24,
  tarde: 16 / 24,
  noite: 19 / 24,
} as const;

const DAY_NIGHT_COLORS = {
  sunManha: new THREE.Color('#ffb347'),
  sunDia: new THREE.Color('#fff8e7'),
  sunSol: new THREE.Color('#ffffff'),
  sunTarde: new THREE.Color('#ff7e30'),
  sunNoite: new THREE.Color('#1e3a8a'),
  hemiManhaS: new THREE.Color('#ffe1a0'),
  hemiDiaS: new THREE.Color('#87ceeb'),
  hemiSolS: new THREE.Color('#b0d8f0'),
  hemiTardeS: new THREE.Color('#ffc87a'),
  hemiNoiteS: new THREE.Color('#0b1432'),
  hemiManhaG: new THREE.Color('#5a4400'),
  hemiDiaG: new THREE.Color('#2d5a1b'),
  hemiSolG: new THREE.Color('#3a6b20'),
  hemiTardeG: new THREE.Color('#5c2a00'),
  hemiNoiteG: new THREE.Color('#060c1f'),
} as const;

const createSunSpriteTexture = ({
  size,
  innerAlpha,
  outerAlpha,
}: {
  size: number;
  innerAlpha: number;
  outerAlpha: number;
}) => {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([255, 255, 255, Math.floor(255 * innerAlpha)]);
    const fallback = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    fallback.needsUpdate = true;
    return fallback;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    const data = new Uint8Array([255, 255, 255, Math.floor(255 * innerAlpha)]);
    const fallback = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    fallback.needsUpdate = true;
    return fallback;
  }

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.5,
  );
  gradient.addColorStop(0, `rgba(255,255,255,${innerAlpha})`);
  gradient.addColorStop(0.55, `rgba(255,255,255,${outerAlpha})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  context.clearRect(0, 0, size, size);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const BLEND_WIN = 30 / 1440;
const getSkyboxBlend = (t: number): { from: string; to: string; blend: number } => {
  const B = {
    manha: 5 / 24,
    dia: 8 / 24,
    sol: 11 / 24,
    solEnd: 13 / 24,
    diaEnd: 16 / 24,
    tarde: 16 / 24,
    noite: 19 / 24,
  };

  const inBlend = (edge: number) => {
    const d = ((t - edge + 1) % 1);
    return d < BLEND_WIN ? d / BLEND_WIN : -1;
  };

  const bManha = inBlend(B.manha);
  const bDia = inBlend(B.dia);
  const bSol = inBlend(B.sol);
  const bSolEnd = inBlend(B.solEnd);
  const bTarde = inBlend(B.tarde);
  const bNoite = inBlend(B.noite);

  if (bManha >= 0) return { from: 'noite', to: 'manha', blend: bManha };
  if (bDia >= 0) return { from: 'manha', to: 'dia', blend: bDia };
  if (bSol >= 0) return { from: 'dia', to: 'sol', blend: bSol };
  if (bSolEnd >= 0) return { from: 'sol', to: 'dia', blend: bSolEnd };
  if (bTarde >= 0) return { from: 'dia', to: 'tarde', blend: bTarde };
  if (bNoite >= 0) return { from: 'tarde', to: 'noite', blend: bNoite };
  if (t >= B.manha && t < B.dia) return { from: 'manha', to: 'manha', blend: 0 };
  if (t >= B.dia && t < B.sol) return { from: 'dia', to: 'dia', blend: 0 };
  if (t >= B.sol && t < B.solEnd) return { from: 'sol', to: 'sol', blend: 0 };
  if (t >= B.solEnd && t < B.tarde) return { from: 'dia', to: 'dia', blend: 0 };
  if (t >= B.tarde && t < B.noite) return { from: 'tarde', to: 'tarde', blend: 0 };
  return { from: 'noite', to: 'noite', blend: 0 };
};

const createBlackCubeTexture = (): THREE.CubeTexture => {
  const data = new Uint8Array([0, 0, 0, 255]);
  const face = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  face.needsUpdate = true;
  const cube = new THREE.CubeTexture(Array(6).fill(face) as THREE.Texture[]);
  cube.needsUpdate = true;
  return cube;
};

const skyboxVertexShader = `
varying vec3 vDir;
void main() {
  vDir = normalize(vec3(-position.x, position.y, position.z));
  vec4 pos = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = pos.xyww;
}`;

const skyboxFragmentShader = `
uniform samplerCube uSkyFrom;
uniform samplerCube uSkyTo;
uniform float uBlend;
varying vec3 vDir;
void main() {
  gl_FragColor = mix(textureCube(uSkyFrom, vDir), textureCube(uSkyTo, vDir), uBlend);
  #include <colorspace_fragment>
}`;

export const SkyboxController: React.FC = () => {
  const { scene, gl } = useThree();
  const cubemaps = useRef<Record<string, THREE.CubeTexture>>({});
  const iblCache = useRef<Record<string, THREE.Texture>>({});
  const deferredLoadTimersRef = useRef<number[]>([]);
  const fallbackCubeRef = useRef<THREE.CubeTexture | null>(null);
  const skyboxUpdateAccumulatorRef = useRef(0);
  const pmrem = useRef<THREE.PMREMGenerator | null>(null);
  const loadedCount = useRef(0);

  const blackCube = useMemo(() => createBlackCubeTexture(), []);
  const skyMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: skyboxVertexShader,
    fragmentShader: skyboxFragmentShader,
    uniforms: {
      uSkyFrom: { value: blackCube },
      uSkyTo: { value: blackCube },
      uBlend: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  }), [blackCube]);

  useEffect(() => {
    cubemaps.current = {};
    iblCache.current = {};
    loadedCount.current = 0;
    skyMaterial.uniforms.uSkyFrom.value = blackCube;
    skyMaterial.uniforms.uSkyTo.value = blackCube;

    pmrem.current = new THREE.PMREMGenerator(gl);
    pmrem.current.compileCubemapShader();
    const loader = new THREE.CubeTextureLoader();
    const loadOrder = getSkyboxLoadOrder();
    const stageLoads = shouldStageSkyboxLoading();
    const immediateCount = stageLoads ? 2 : loadOrder.length;

    const loadCubemap = (key: SkyboxTheme) => {
      if (cubemaps.current[key]) {
        return;
      }

      const base = SKYBOX_PATHS[key];
      loader.load(
        SKYBOX_FACES.map((face) => base + face),
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;

          cubemaps.current[key] = tex;
          if (!fallbackCubeRef.current) {
            fallbackCubeRef.current = tex;
          }
          if (pmrem.current) {
            iblCache.current[key] = pmrem.current.fromCubemap(tex).texture;
          }
          loadedCount.current += 1;
          if (loadedCount.current === 1) {
            skyMaterial.uniforms.uSkyFrom.value = tex;
            skyMaterial.uniforms.uSkyTo.value = tex;
          }
        },
        undefined,
        (error) => console.warn(`[SkyboxController] failed to load "${key}":`, error),
      );
    };

    loadOrder.slice(0, immediateCount).forEach((key) => {
      loadCubemap(key);
    });

    if (immediateCount < loadOrder.length) {
      loadOrder.slice(immediateCount).forEach((key, index) => {
        const timer = window.setTimeout(() => {
          loadCubemap(key);
        }, 800 + index * 450);
        deferredLoadTimersRef.current.push(timer);
      });
    }

    return () => {
      deferredLoadTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      deferredLoadTimersRef.current = [];
      pmrem.current?.dispose();
      Object.values(cubemaps.current).forEach((texture) => texture.dispose());
      Object.values(iblCache.current).forEach((texture) => texture.dispose());
      fallbackCubeRef.current = null;
      skyMaterial.dispose();
      blackCube.dispose();
    };
  }, [blackCube, gl, skyMaterial]);

  useFrame((state, delta) => {
    if (loadedCount.current === 0) return;

    skyboxUpdateAccumulatorRef.current += delta;
    if (skyboxUpdateAccumulatorRef.current < (1 / 24)) {
      return;
    }
    skyboxUpdateAccumulatorRef.current = 0;

    const t = getGameT(state.clock.elapsedTime);
    const { from, to, blend } = getSkyboxBlend(t);
    const fromTex = cubemaps.current[from] ?? fallbackCubeRef.current;
    const toTex = cubemaps.current[to] ?? fromTex;

    if (!fromTex) {
      return;
    }

    if (skyMaterial.uniforms.uSkyFrom.value !== fromTex || skyMaterial.uniforms.uSkyTo.value !== toTex) {
      skyMaterial.uniforms.uSkyFrom.value = fromTex;
      skyMaterial.uniforms.uSkyTo.value = toTex;
    }
    skyMaterial.uniforms.uBlend.value = blend;

    const domKey = blend > 0.5 ? to : from;
    const iblTex = iblCache.current[domKey] ?? iblCache.current[from];
    if (iblTex && scene.environment !== iblTex) {
      scene.environment = iblTex;
    }
    if ((scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity !== 0.24) {
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.24;
    }
  });

  return (
    <mesh renderOrder={-1000} material={skyMaterial} frustumCulled={false} raycast={disableRaycast}>
      <sphereGeometry args={[500, 32, 24]} />
    </mesh>
  );
};

export const DayNightCycle = ({
  containerRef,
  onTimeUpdate,
  quality,
  noMainShadow = false,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onTimeUpdate: (time: string) => void;
  quality: RenderQualityProfile;
  /** When true the directional sun light does not cast shadows (saves the main shadow map render pass on mobile). */
  noMainShadow?: boolean;
}) => {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const sunGlowRef = useRef<THREE.Sprite>(null);
  const sunRaysRef = useRef<THREE.Sprite>(null);
  const sunGlowMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const sunRaysMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const lastMinuteRef = useRef(-1);
  const lastBgRef = useRef('');
  const sunPosRef = useRef(new THREE.Vector3());
  const moonPosRef = useRef(new THREE.Vector3());
  const sunColorRef = useRef(new THREE.Color());
  const hemiSkyRef = useRef(new THREE.Color());
  const hemiGroundRef = useRef(new THREE.Color());
  const cycleUpdateAccumulatorRef = useRef(0);
  const sunGlowTexture = useMemo(
    () => createSunSpriteTexture({ size: 256, innerAlpha: 1, outerAlpha: 0.24 }),
    [],
  );
  const sunRaysTexture = useMemo(
    () => createSunSpriteTexture({ size: 512, innerAlpha: 0.42, outerAlpha: 0.06 }),
    [],
  );

  useEffect(() => () => {
    sunGlowTexture.dispose();
    sunRaysTexture.dispose();
  }, [sunGlowTexture, sunRaysTexture]);

  useFrame((state, delta) => {
    cycleUpdateAccumulatorRef.current += delta;
    if (cycleUpdateAccumulatorRef.current < (1 / 30)) {
      return;
    }
    const sampledDelta = cycleUpdateAccumulatorRef.current;
    cycleUpdateAccumulatorRef.current = 0;

    const cycleDuration = 1440;
    const gameTimeMultiplier = 2;
    const t = ((state.clock.elapsedTime * gameTimeMultiplier + 720) / cycleDuration) % 1;
    const totalMinutes = Math.floor(t * 1440);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    if (totalMinutes !== lastMinuteRef.current) {
      lastMinuteRef.current = totalMinutes;
      onTimeUpdate(timeString);
    }

    const T_MANHA = DAY_NIGHT_TIMES.manha;
    const T_DIA = DAY_NIGHT_TIMES.dia;
    const T_SOL = DAY_NIGHT_TIMES.sol;
    const T_SOLEND = DAY_NIGHT_TIMES.solEnd;
    const T_TARDE = DAY_NIGHT_TIMES.tarde;
    const T_NOITE = DAY_NIGHT_TIMES.noite;
    const frac = (start: number, end: number) => THREE.MathUtils.clamp((t - start) / (end - start), 0, 1);
    const angle = t * Math.PI * 2 - Math.PI / 2;
    sunPosRef.current.set(Math.cos(angle) * 25, Math.sin(angle) * 15, 15);
    moonPosRef.current.set(Math.cos(angle + Math.PI) * 25, Math.sin(angle + Math.PI) * 15, 15);

    let ambientIntensity: number;
    let sunIntensity: number;
    const sunColor = sunColorRef.current;
    const hemiSky = hemiSkyRef.current;
    const hemiGround = hemiGroundRef.current;
    let moonIntensity: number;

    if (t >= T_MANHA && t < T_DIA) {
      const p = frac(T_MANHA, T_DIA);
      ambientIntensity = THREE.MathUtils.lerp(0.40, 0.56, p);
      sunIntensity = THREE.MathUtils.lerp(0.45, 1.25, p);
      sunColor.lerpColors(DAY_NIGHT_COLORS.sunNoite, DAY_NIGHT_COLORS.sunManha, p);
      hemiSky.lerpColors(DAY_NIGHT_COLORS.hemiNoiteS, DAY_NIGHT_COLORS.hemiManhaS, p);
      hemiGround.lerpColors(DAY_NIGHT_COLORS.hemiNoiteG, DAY_NIGHT_COLORS.hemiManhaG, p);
      moonIntensity = THREE.MathUtils.lerp(0.45, 0, p);
    } else if (t >= T_DIA && t < T_SOL) {
      const p = frac(T_DIA, T_SOL);
      ambientIntensity = THREE.MathUtils.lerp(0.56, 0.62, p);
      sunIntensity = THREE.MathUtils.lerp(1.25, 1.55, p);
      sunColor.lerpColors(DAY_NIGHT_COLORS.sunManha, DAY_NIGHT_COLORS.sunDia, p);
      hemiSky.lerpColors(DAY_NIGHT_COLORS.hemiManhaS, DAY_NIGHT_COLORS.hemiDiaS, p);
      hemiGround.lerpColors(DAY_NIGHT_COLORS.hemiManhaG, DAY_NIGHT_COLORS.hemiDiaG, p);
      moonIntensity = 0;
    } else if (t >= T_SOL && t < T_SOLEND) {
      ambientIntensity = 0.64;
      sunIntensity = 1.72;
      sunColor.copy(DAY_NIGHT_COLORS.sunSol);
      hemiSky.copy(DAY_NIGHT_COLORS.hemiSolS);
      hemiGround.copy(DAY_NIGHT_COLORS.hemiSolG);
      moonIntensity = 0;
    } else if (t >= T_SOLEND && t < T_TARDE) {
      const p = frac(T_SOLEND, T_TARDE);
      ambientIntensity = THREE.MathUtils.lerp(0.6, 0.52, p);
      sunIntensity = THREE.MathUtils.lerp(1.55, 1.38, p);
      sunColor.lerpColors(DAY_NIGHT_COLORS.sunDia, DAY_NIGHT_COLORS.sunManha, p);
      hemiSky.lerpColors(DAY_NIGHT_COLORS.hemiDiaS, DAY_NIGHT_COLORS.hemiManhaS, p);
      hemiGround.lerpColors(DAY_NIGHT_COLORS.hemiDiaG, DAY_NIGHT_COLORS.hemiManhaG, p);
      moonIntensity = 0;
    } else if (t >= T_TARDE && t < T_NOITE) {
      const p = frac(T_TARDE, T_NOITE);
      ambientIntensity = THREE.MathUtils.lerp(0.52, 0.40, p);
      sunIntensity = THREE.MathUtils.lerp(1.38, 0.3, p);
      sunColor.lerpColors(DAY_NIGHT_COLORS.sunDia, DAY_NIGHT_COLORS.sunTarde, p);
      hemiSky.lerpColors(DAY_NIGHT_COLORS.hemiManhaS, DAY_NIGHT_COLORS.hemiTardeS, p);
      hemiGround.lerpColors(DAY_NIGHT_COLORS.hemiManhaG, DAY_NIGHT_COLORS.hemiTardeG, p);
      moonIntensity = THREE.MathUtils.lerp(0, 0.45, p);
    } else {
      const p = t >= T_NOITE
        ? (t - T_NOITE) / (1 - T_NOITE + T_MANHA)
        : (t + 1 - T_NOITE) / (1 - T_NOITE + T_MANHA);
      ambientIntensity = 0.40;
      sunIntensity = 0;
      sunColor.copy(DAY_NIGHT_COLORS.sunNoite);
      hemiSky.copy(DAY_NIGHT_COLORS.hemiNoiteS);
      hemiGround.copy(DAY_NIGHT_COLORS.hemiNoiteG);
      moonIntensity = 0.90 * Math.max(0, Math.sin(p * Math.PI));
    }

    if (ambientRef.current) ambientRef.current.intensity = ambientIntensity * 0.72;
    if (hemiRef.current) {
      hemiRef.current.intensity = ambientIntensity * 0.52;
      hemiRef.current.color.copy(hemiSky);
      hemiRef.current.groundColor.copy(hemiGround);
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = sunIntensity * 1.65;
      sunLightRef.current.color.copy(sunColor);
      sunLightRef.current.position.copy(sunPosRef.current);
      sunLightRef.current.target.position.set(0, 0.5, 0);
      sunLightRef.current.target.updateMatrixWorld();
    }
    if (moonLightRef.current) {
      moonLightRef.current.intensity = moonIntensity * 1.35;
      moonLightRef.current.position.copy(moonPosRef.current);
    }
    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunPosRef.current);
      sunMeshRef.current.scale.setScalar(sunPosRef.current.y > -1 ? 1 : 0);
    }
    if (sunGlowRef.current && sunRaysRef.current) {
      const visible = sunPosRef.current.y > -1 && sunIntensity > 0.05;
      const glowStrength = THREE.MathUtils.clamp(sunIntensity / 1.75, 0, 1.2);

      sunGlowRef.current.visible = visible;
      sunRaysRef.current.visible = visible;
      sunGlowRef.current.position.copy(sunPosRef.current);
      sunRaysRef.current.position.copy(sunPosRef.current);
      sunGlowRef.current.scale.setScalar(4.8 + glowStrength * 2.6);
      sunRaysRef.current.scale.setScalar(9.8 + glowStrength * 4.2);

      if (sunGlowMaterialRef.current) {
        sunGlowMaterialRef.current.opacity = 0.2 + glowStrength * 0.5;
      }
      if (sunRaysMaterialRef.current) {
        sunRaysMaterialRef.current.opacity = 0.06 + glowStrength * 0.2;
        sunRaysMaterialRef.current.rotation += sampledDelta * 0.05;
      }
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPosRef.current);
      moonMeshRef.current.scale.setScalar(moonPosRef.current.y > -1 ? 1 : 0);
    }

    const bgColor = t >= T_MANHA && t < T_DIA
      ? '#6baed6'
      : t >= T_DIA && t < T_TARDE
        ? '#38bdf8'
        : t >= T_TARDE && t < T_NOITE
          ? '#d4680a'
          : '#020617';
    if (bgColor !== lastBgRef.current) {
      lastBgRef.current = bgColor;
      if (containerRef.current) {
        containerRef.current.style.backgroundColor = bgColor;
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} />
      <hemisphereLight ref={hemiRef} groundColor="#475569" />
      <directionalLight
        ref={sunLightRef}
        castShadow={!noMainShadow}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <directionalLight ref={moonLightRef} color="#c7d2fe" intensity={0} position={[-5, 10, -15]} />
      <mesh ref={sunMeshRef} raycast={disableRaycast}>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={2} />
      </mesh>
      <sprite ref={sunRaysRef} raycast={disableRaycast} renderOrder={4}>
        <spriteMaterial
          ref={sunRaysMaterialRef}
          map={sunRaysTexture}
          color="#ffd27a"
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          alphaTest={0.01}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={sunGlowRef} raycast={disableRaycast} renderOrder={5}>
        <spriteMaterial
          ref={sunGlowMaterialRef}
          map={sunGlowTexture}
          color="#ffe9a8"
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          alphaTest={0.01}
          toneMapped={false}
        />
      </sprite>
      <mesh ref={moonMeshRef} raycast={disableRaycast}>
        <sphereGeometry args={[1.2, 8, 8]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#c7d2fe" emissiveIntensity={1.2} />
      </mesh>
    </>
  );
};

export const BattlePlatform = () => (
  <group position={[0, -1.15, 0]}>
    <VoxelPart position={[0, 0, 0]} size={[12, 0.2, 8]} color="#334155" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 0.05, 0]} size={[11.5, 0.1, 7.5]} color="#1e293b" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 0.1, 3.9]} size={[12.2, 0.3, 0.2]} color="#475569" material="metal" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 0.1, -3.9]} size={[12.2, 0.3, 0.2]} color="#475569" material="metal" castShadow={false} receiveShadow />
    <VoxelPart position={[6.1, 0.1, 0]} size={[0.2, 0.3, 8.2]} color="#475569" material="metal" castShadow={false} receiveShadow />
    <VoxelPart position={[-6.1, 0.1, 0]} size={[0.2, 0.3, 8.2]} color="#475569" material="metal" castShadow={false} receiveShadow />
    {[[-6, 4], [6, 4], [-6, -4], [6, -4]].map((pos, index) => (
      <group key={index} position={[pos[0], 0.5, pos[1]]}>
        <VoxelPart position={[0, 0, 0]} size={[0.6, 1, 0.6]} color="#1e293b" material="standard" />
        <VoxelPart position={[0, 0.6, 0]} size={[0.4, 0.2, 0.4]} color="#facc15" material="gem" emissive="#facc15" emissiveIntensity={1} />
      </group>
    ))}
  </group>
);

export const Torch = ({
  position,
  rotation = [0, 0, 0] as [number, number, number],
  color = '#fb923c',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) => {
  const flameRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 8 + position[0]) * 0.08;
    if (flameRef.current) {
      flameRef.current.scale.set(1.05 * pulse, 1.2 * pulse, 1.05 * pulse);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.8 * pulse;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <VoxelPart position={[0, -0.35, 0]} size={[0.12, 0.7, 0.12]} color="#4b2e16" material="leather" />
      <VoxelPart position={[0, 0.05, 0.08]} size={[0.22, 0.08, 0.18]} color="#64748b" material="metal" />
      <mesh ref={flameRef} position={[0, 0.35, 0.02]}>
        <boxGeometry args={[0.18, 0.28, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.6} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.45, 0.3]} color={color} distance={11} decay={1.5} intensity={2.8} />
    </group>
  );
};

export const DungeonAtmosphere = ({ quality, noMainShadow = false }: { quality: RenderQualityProfile; noMainShadow?: boolean }) => {
  const embers = useMemo(() => {
    const total = quality.isLowQuality ? 6 : 12;
    return Array.from({ length: total }, (_, index) => ({
      key: index,
      position: [
        (Math.random() - 0.5) * 10,
        0.6 + Math.random() * 2.6,
        -4 - Math.random() * 7,
      ] as [number, number, number],
      speed: 0.15 + Math.random() * 0.18,
    }));
  }, [quality.isLowQuality]);

  return (
    <group>
      <ambientLight intensity={1.08} color="#f8fafc" />
      <hemisphereLight intensity={0.82} color="#e2e8f0" groundColor="#334155" />
      <directionalLight position={[0, 6, 6]} intensity={0.78} color="#f8fafc" castShadow={!noMainShadow} shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
      <pointLight position={[0, 1.8, 3.5]} intensity={1.8} distance={18} decay={1.7} color="#fff7ed" />
      {embers.map((ember) => (
        <mesh key={ember.key} position={ember.position}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={1.2} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
};

// Pre-allocated outside the component to avoid per-frame GC allocations
const FOG_COLORS = {
  noite:  new THREE.Color('#0d1525'),
  manha:  new THREE.Color('#d8c4a8'),
  dia:    new THREE.Color('#c8dde8'),
  sol:    new THREE.Color('#d8eaf2'),
  tarde:  new THREE.Color('#e0a882'),
};
const FOG_T_MANHA  = 5 / 24;
const FOG_T_DIA    = 8 / 24;
const FOG_T_SOL    = 11 / 24;
const FOG_T_SOLEND = 13 / 24;
const FOG_T_TARDE  = 16 / 24;
const FOG_T_NOITE  = 19 / 24;

export const FogController: React.FC = () => {
  const { scene } = useThree();
  // Reuse a single Color instance — no per-frame allocation.
  const workColorRef = useRef(new THREE.Color());
  const fogThrottleRef = useRef(0);

  useFrame((state, delta) => {
    // Fog transitions are imperceptible above 10fps — throttle to save CPU.
    fogThrottleRef.current += delta;
    if (fogThrottleRef.current < 0.1) return;
    fogThrottleRef.current = 0;

    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;

    const t = getGameT(state.clock.elapsedTime);
    const color = workColorRef.current;

    if (t >= FOG_T_MANHA && t < FOG_T_DIA) {
      color.lerpColors(FOG_COLORS.noite, FOG_COLORS.manha, (t - FOG_T_MANHA) / (FOG_T_DIA - FOG_T_MANHA));
    } else if (t >= FOG_T_DIA && t < FOG_T_SOL) {
      color.lerpColors(FOG_COLORS.manha, FOG_COLORS.dia, (t - FOG_T_DIA) / (FOG_T_SOL - FOG_T_DIA));
    } else if (t >= FOG_T_SOL && t < FOG_T_SOLEND) {
      color.copy(FOG_COLORS.sol);
    } else if (t >= FOG_T_SOLEND && t < FOG_T_TARDE) {
      color.lerpColors(FOG_COLORS.sol, FOG_COLORS.dia, (t - FOG_T_SOLEND) / (FOG_T_TARDE - FOG_T_SOLEND));
    } else if (t >= FOG_T_TARDE && t < FOG_T_NOITE) {
      color.lerpColors(FOG_COLORS.tarde, FOG_COLORS.noite, (t - FOG_T_TARDE) / (FOG_T_NOITE - FOG_T_TARDE));
    } else {
      color.copy(FOG_COLORS.noite);
    }
    fog.color.copy(color);
  });

  return <fog attach="fog" args={[FOG_COLORS.dia.getHex(), 14, 45]} />;
};

export const CameraController = ({
  screenShake,
  menuFocus = false,
  menuPortalTravelCinematicToken = 0,
  menuPortalFocusPoint,
  runtimeBattleCamera,
  heroInspectMode = false,
  portalInspectMode = false,
  bossEntryCinematicToken = 0,
}: {
  screenShake?: number;
  menuFocus?: boolean;
  menuPortalTravelCinematicToken?: number;
  menuPortalFocusPoint?: [number, number, number];
  runtimeBattleCamera?: { fov: number; distance: number; height: number };
  heroInspectMode?: boolean;
  portalInspectMode?: boolean;
  bossEntryCinematicToken?: number;
}) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const clockRef = useRef(0);
  const isMobile = isElectronRuntime() ? false : window.innerWidth < 768;
  const menuDistance = isMobile ? 10.6 : 6.8;
  // Static defaults — these never change so the PerspectiveCamera element props stay stable
  // and don't trigger R3F reconciler snaps during animations.
  const defaultBattleDistance = isMobile ? 16.2 : 11;
  const defaultBattleHeight = isMobile ? 4.1 : 2.5;
  const defaultBattleFov = isMobile ? 54 : 50;
  const menuFov = isMobile ? 62 : 50;
  const battleFov = defaultBattleFov;
  const focusBlendRef = useRef(menuFocus ? 1 : 0);
  const focusBlendTargetRef = useRef(menuFocus ? 1 : 0);
  const inspectBlendRef = useRef(0);
  const inspectBlendTargetRef = useRef(0);
  const portalBlendRef = useRef(0);
  const portalBlendTargetRef = useRef(0);
  const lookTarget = useMemo(() => new THREE.Vector3(0, isMobile ? 1.55 : 0.9, 0), [isMobile]);
  const menuLookTarget = useMemo(() => new THREE.Vector3(-2, 0.82, 0), []);
  // Hero inspect: look at lower torso so legs stay in frame with bottom padding
  const inspectLookTarget = useMemo(() => new THREE.Vector3(-2, 0.05, 0), []);
  // Portal inspect: look at portal center
  const portalLookTarget = useMemo(() => new THREE.Vector3(-4.22, 0.5, 0.58), []);
  const mixedLookTarget = useMemo(() => new THREE.Vector3(), []);
  const menuOrbitRef = useRef(0);
  const menuOrbitTargetRef = useRef(0);
  const menuHeightRef = useRef(0);
  const menuHeightTargetRef = useRef(0);
  const dragActiveRef = useRef(false);
  const dragXRef = useRef(0);
  const cinematicTokenRef = useRef(0);
  const cinematicPosition = useMemo(() => new THREE.Vector3(), []);
  const cinematicLook = useMemo(() => new THREE.Vector3(), []);
  const cinematicStateRef = useRef({
    active: false,
    phase: 'idle' as 'idle' | 'zoom-in' | 'hold' | 'zoom-out',
    elapsed: 0,
    startPosition: new THREE.Vector3(),
    startLook: new THREE.Vector3(),
    startFov: battleFov,
    targetPosition: new THREE.Vector3(),
    targetLook: new THREE.Vector3(),
    targetFov: battleFov,
  });
  useEffect(() => {
    focusBlendTargetRef.current = menuFocus ? 1 : 0;
  }, [menuFocus]);
  useEffect(() => {
    inspectBlendTargetRef.current = heroInspectMode ? 1 : 0;
  }, [heroInspectMode]);
  useEffect(() => {
    portalBlendTargetRef.current = portalInspectMode ? 1 : 0;
  }, [portalInspectMode]);

  // ── Boss entry cinematic ───────────────────────────────────────────────────
  const bossTokenRef = useRef(0);
  useEffect(() => {
    if (bossEntryCinematicToken <= 0) return;
    if (bossEntryCinematicToken === bossTokenRef.current) return;
    bossTokenRef.current = bossEntryCinematicToken;
    const camera = cameraRef.current;
    if (!camera) return;
    const battleDistance = isMobile ? 16.2 : 11;
    const battleHeight = isMobile ? 4.1 : 2.5;
    // Snap camera to default battle position before animating
    camera.position.set(0, battleHeight, battleDistance);
    const startLook = new THREE.Vector3(0, isMobile ? 1.55 : 0.9, 0);
    cinematicStateRef.current = {
      active: true,
      phase: 'zoom-in',
      elapsed: 0,
      startPosition: camera.position.clone(),
      startLook,
      startFov: camera.fov,
      // Close-up angle toward enemy side
      targetPosition: new THREE.Vector3(isMobile ? 2.2 : 1.5, isMobile ? 2.6 : 1.8, isMobile ? 9.5 : 6.5),
      targetLook: new THREE.Vector3(2.2, 1.0, 0),
      targetFov: isMobile ? 44 : 38,
    };
  }, [bossEntryCinematicToken, isMobile]);

  useEffect(() => {
    if (!menuFocus || typeof window === 'undefined') {
      dragActiveRef.current = false;
      menuOrbitTargetRef.current = 0;
      menuHeightTargetRef.current = 0;
      return;
    }
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const updateFromPoint = (x: number, y: number) => {
      const nx = clamp((x / window.innerWidth) * 2 - 1, -1, 1);
      const ny = clamp((y / window.innerHeight) * 2 - 1, -1, 1);
      menuOrbitTargetRef.current = nx * 0.55;
      menuHeightTargetRef.current = -ny * 0.16;
    };
    const onPointerDown = (event: PointerEvent) => {
      dragActiveRef.current = true;
      dragXRef.current = event.clientX;
      updateFromPoint(event.clientX, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragActiveRef.current) {
        const delta = (event.clientX - dragXRef.current) / Math.max(window.innerWidth, 1);
        dragXRef.current = event.clientX;
        menuOrbitTargetRef.current = clamp(menuOrbitTargetRef.current + delta * 2.2, -0.75, 0.75);
      } else {
        updateFromPoint(event.clientX, event.clientY);
      }
    };
    const onPointerUp = () => {
      dragActiveRef.current = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      updateFromPoint(touch.clientX, touch.clientY);
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [menuFocus]);
  useEffect(() => {
    if (!menuFocus || menuPortalTravelCinematicToken <= 0) {
      return;
    }
    if (menuPortalTravelCinematicToken === cinematicTokenRef.current) {
      return;
    }

    cinematicTokenRef.current = menuPortalTravelCinematicToken;
    // Snap portal blend back to 0 immediately so cinematic starts from menu position
    portalBlendTargetRef.current = 0;
    portalBlendRef.current = 0;
    inspectBlendTargetRef.current = 0;
    inspectBlendRef.current = 0;
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    // Snap camera to the approximate menu position so the cinematic zoom-in to the
    // portal always starts from a sensible angle (not the portal-inspect camera).
    const sway = 0;
    const snapMenuX = (isMobile ? -0.6 : -0.95) + Math.sin(menuOrbitRef.current) * 0.55 + sway;
    const snapMenuY = 1.65 + menuHeightRef.current;
    const snapMenuZ = menuDistance + Math.cos(menuOrbitRef.current) * 0.25;
    camera.position.set(snapMenuX, snapMenuY, snapMenuZ);

    const focusPoint = menuPortalFocusPoint ?? [-4.22, 0.08, 0.58];
    const portalLook = new THREE.Vector3(focusPoint[0], focusPoint[1], focusPoint[2]);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const cameraLook = camera.position.clone().add(forward.multiplyScalar(8));
    const portalCameraPosition = new THREE.Vector3(
      portalLook.x + (isMobile ? 1.85 : 1.5),
      portalLook.y + (isMobile ? 1.2 : 0.95),
      portalLook.z + (isMobile ? 2.45 : 1.95),
    );

    cinematicStateRef.current = {
      active: true,
      phase: 'zoom-in',
      elapsed: 0,
      startPosition: camera.position.clone(),
      startLook: cameraLook,
      startFov: camera.fov,
      targetPosition: portalCameraPosition,
      targetLook: portalLook,
      targetFov: Math.max(36, camera.fov - (isMobile ? 5 : 7)),
    };
  }, [isMobile, menuFocus, menuPortalFocusPoint, menuPortalTravelCinematicToken]);
  useFrame((_, delta) => {
    const easeInOut = (value: number) => value * value * (3 - (2 * value));
    const ZOOM_IN_SECONDS = 0.72;
    const HOLD_SECONDS = 1.8; // synced with portal overlay hold: overlay fades at t=720+1800ms, zoom-out starts then
    const ZOOM_OUT_SECONDS = 0.82;
    clockRef.current += delta;
    const t = clockRef.current;
    const transitionDurationSeconds = 2.5;
    const blendDiff = focusBlendTargetRef.current - focusBlendRef.current;
    const maxBlendStep = delta / transitionDurationSeconds;
    if (Math.abs(blendDiff) <= maxBlendStep) {
      focusBlendRef.current = focusBlendTargetRef.current;
    } else {
      focusBlendRef.current += Math.sign(blendDiff) * maxBlendStep;
    }
    const focusBlend = THREE.MathUtils.clamp(focusBlendRef.current, 0, 1);
    // Inspect blend (zoom in when hero inspect is open)
    const inspBlendDiff = inspectBlendTargetRef.current - inspectBlendRef.current;
    const maxInspBlend = delta / 1.0;
    if (Math.abs(inspBlendDiff) <= maxInspBlend) {
      inspectBlendRef.current = inspectBlendTargetRef.current;
    } else {
      inspectBlendRef.current += Math.sign(inspBlendDiff) * maxInspBlend;
    }
    const inspectBlend = THREE.MathUtils.clamp(inspectBlendRef.current, 0, 1);
    // Portal inspect blend
    const portalBlendDiff = portalBlendTargetRef.current - portalBlendRef.current;
    const maxPortalBlend = delta / 0.8;
    if (Math.abs(portalBlendDiff) <= maxPortalBlend) {
      portalBlendRef.current = portalBlendTargetRef.current;
    } else {
      portalBlendRef.current += Math.sign(portalBlendDiff) * maxPortalBlend;
    }
    const portalBlend = THREE.MathUtils.clamp(portalBlendRef.current, 0, 1);
    // Menu camera target
    // Frame-rate independent smoothing: 1 - exp(-speed * delta)
    // Equivalent to lerp 0.08 at 60fps but consistent at any framerate.
    const orbitAlpha = 1 - Math.exp(-5 * delta);
    menuOrbitRef.current = THREE.MathUtils.lerp(menuOrbitRef.current, menuOrbitTargetRef.current, orbitAlpha);
    menuHeightRef.current = THREE.MathUtils.lerp(menuHeightRef.current, menuHeightTargetRef.current, orbitAlpha);
    const sway = Math.sin(t * 0.4) * 0.06;
    const menuTargetX = (isMobile ? -0.6 : -0.95) + Math.sin(menuOrbitRef.current) * 0.55 + sway;
    const menuTargetY = 1.65 + Math.sin(t * 0.35) * 0.04 + menuHeightRef.current;
    const menuTargetZ = menuDistance + Math.cos(menuOrbitRef.current) * 0.25 + Math.cos(t * 0.45) * 0.05;
    // Hero inspect: camera shifts right so hero is framed left, full body visible with leg padding
    const inspectCamX = isMobile ? 0.7 : 1.0;
    const inspectCamY = isMobile ? 1.4 : 1.4;
    const heroInspectDistance = isMobile ? 5.2 : 4.9;
    const heroInspectFov = isMobile ? 52 : 49;
    // Portal inspect: camera faces the portal from the front-right
    const portalInspectCamX = isMobile ? -2.8 : -2.2;
    const portalInspectCamY = isMobile ? 1.8 : 1.6;
    const portalInspectDistance = isMobile ? 6.5 : 5.8;
    const portalInspectFov = isMobile ? 55 : 50;
    const heroMenuX = THREE.MathUtils.lerp(menuTargetX, inspectCamX, inspectBlend);
    const heroMenuY = THREE.MathUtils.lerp(menuTargetY, inspectCamY, inspectBlend);
    const heroMenuZ = THREE.MathUtils.lerp(menuTargetZ, heroInspectDistance, inspectBlend);
    const heroMenuFov = THREE.MathUtils.lerp(menuFov, heroInspectFov, inspectBlend);
    const finalMenuX = THREE.MathUtils.lerp(heroMenuX, portalInspectCamX, portalBlend);
    const finalMenuY = THREE.MathUtils.lerp(heroMenuY, portalInspectCamY, portalBlend);
    const finalMenuZ = THREE.MathUtils.lerp(heroMenuZ, portalInspectDistance, portalBlend);
    const finalMenuFov = THREE.MathUtils.lerp(heroMenuFov, portalInspectFov, portalBlend);
    // Battle camera target — apply runtimeBattleCamera here (inside useFrame) to avoid
    // R3F reconciler snapping the camera when the prop changes mid-cinematic.
    const activeBattleDistance = runtimeBattleCamera
      ? (isMobile ? runtimeBattleCamera.distance * (16.2 / 11) : runtimeBattleCamera.distance)
      : defaultBattleDistance;
    const activeBattleHeight = runtimeBattleCamera
      ? (isMobile ? runtimeBattleCamera.height * (4.1 / 2.5) : runtimeBattleCamera.height)
      : defaultBattleHeight;
    const activeBattleFov = runtimeBattleCamera
      ? (isMobile ? runtimeBattleCamera.fov + (54 - 50) : runtimeBattleCamera.fov)
      : defaultBattleFov;
    const orbitAngle = Math.sin(t * 0.06) * 0.175;
    const orbitX = Math.sin(orbitAngle) * activeBattleDistance;
    const orbitZ = Math.cos(orbitAngle) * activeBattleDistance;
    const driftX = Math.sin(t * 0.13) * 0.40 + Math.sin(t * 0.07) * 0.18;
    const driftY = Math.cos(t * 0.11) * 0.20 + Math.sin(t * 0.05) * 0.10;
    const driftZ = Math.sin(t * 0.09) * 0.22 + Math.cos(t * 0.14) * 0.08;
    const microX = Math.sin(t * 3.7) * 0.008 + Math.cos(t * 5.3) * 0.005;
    const microY = Math.cos(t * 4.1) * 0.006 + Math.sin(t * 6.7) * 0.004;
    const battleTargetX = orbitX + driftX + microX;
    const battleTargetY = activeBattleHeight + driftY + microY;
    const battleTargetZ = orbitZ + driftZ;
    const targetX = THREE.MathUtils.lerp(battleTargetX, finalMenuX, focusBlend);
    const targetY = THREE.MathUtils.lerp(battleTargetY, finalMenuY, focusBlend);
    const targetZ = THREE.MathUtils.lerp(battleTargetZ, finalMenuZ, focusBlend);

    const cinematicState = cinematicStateRef.current;
    const hasActiveCinematic = Boolean(cameraRef.current && cinematicState.active);
    let cinematicFov: number | null = null;

    if (hasActiveCinematic && cameraRef.current) {
      cinematicState.elapsed += delta;

      if (cinematicState.phase === 'zoom-in') {
        const progress = THREE.MathUtils.clamp(cinematicState.elapsed / ZOOM_IN_SECONDS, 0, 1);
        const eased = easeInOut(progress);
        cinematicPosition.lerpVectors(cinematicState.startPosition, cinematicState.targetPosition, eased);
        cinematicLook.lerpVectors(cinematicState.startLook, cinematicState.targetLook, eased);
        cinematicFov = THREE.MathUtils.lerp(cinematicState.startFov, cinematicState.targetFov, eased);
        if (progress >= 1) {
          cinematicState.phase = 'hold';
          cinematicState.elapsed = 0;
        }
      } else if (cinematicState.phase === 'hold') {
        cinematicPosition.copy(cinematicState.targetPosition);
        cinematicLook.copy(cinematicState.targetLook);
        cinematicFov = cinematicState.targetFov;
        if (cinematicState.elapsed >= HOLD_SECONDS) {
          cinematicState.phase = 'zoom-out';
          cinematicState.elapsed = 0;
        }
      } else if (cinematicState.phase === 'zoom-out') {
        const progress = THREE.MathUtils.clamp(cinematicState.elapsed / ZOOM_OUT_SECONDS, 0, 1);
        const eased = easeInOut(progress);
        // Zoom-out target is the LIVE new scene menu position (not the old startPosition)
        cinematicPosition.lerpVectors(
          cinematicState.targetPosition,
          new THREE.Vector3(targetX, targetY, targetZ),
          eased
        );
        cinematicLook.lerpVectors(cinematicState.targetLook, menuLookTarget, eased);
        cinematicFov = THREE.MathUtils.lerp(cinematicState.targetFov, finalMenuFov, eased);
        if (progress >= 1) {
          cinematicState.active = false;
          cinematicState.phase = 'idle';
          cinematicState.elapsed = 0;
        }
      }

      cameraRef.current.position.lerp(cinematicPosition, 1 - Math.exp(-14 * delta));
      mixedLookTarget.copy(cinematicLook);
    } else if (cameraRef.current && screenShake && focusBlend < 0.2) {
      const shake = screenShake;
      cameraRef.current.position.x = targetX + (Math.random() - 0.5) * shake;
      cameraRef.current.position.y = targetY + (Math.random() - 0.5) * shake;
      cameraRef.current.position.z = targetZ;
    } else if (cameraRef.current) {
      // Frame-rate independent camera follow: smooth at 30fps or 60fps.
      const camAlpha = 1 - Math.exp(-5 * delta);
      cameraRef.current.position.x = THREE.MathUtils.lerp(cameraRef.current.position.x, targetX, camAlpha);
      cameraRef.current.position.y = THREE.MathUtils.lerp(cameraRef.current.position.y, targetY, camAlpha);
      cameraRef.current.position.z = THREE.MathUtils.lerp(cameraRef.current.position.z, targetZ, camAlpha);
    }

    if (cameraRef.current) {
      if (!hasActiveCinematic) {
        // True pan: look target shifts by the same delta as camera moves from menu base.
        // This keeps the view direction constant instead of orbiting the hero.
        const menuBaseX = isMobile ? -0.6 : 0.95;
        const menuBaseY = 1.65;
        inspectLookTarget.set(
          -2 + (inspectCamX - menuBaseX),
          0.82 + (inspectCamY - menuBaseY),
          0
        );
        // Blend look target: battle → menu → hero inspect → portal inspect
        const blendedMenuLook = new THREE.Vector3().lerpVectors(menuLookTarget, inspectLookTarget, inspectBlend);
        const blendedWithPortal = new THREE.Vector3().lerpVectors(blendedMenuLook, portalLookTarget, portalBlend);
        mixedLookTarget.lerpVectors(lookTarget, blendedWithPortal, focusBlend);
      }
      cameraRef.current.lookAt(mixedLookTarget);
      const targetFov = cinematicFov ?? THREE.MathUtils.lerp(activeBattleFov, finalMenuFov, focusBlend);
      if (Math.abs(cameraRef.current.fov - targetFov) > 0.01) {
        cameraRef.current.fov = targetFov;
        cameraRef.current.updateProjectionMatrix();
      }
    }
  });
  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, defaultBattleHeight, defaultBattleDistance]} fov={defaultBattleFov} near={0.5} far={120} />;
};
export const NightEnemyGlow = ({ gameTime }: { gameTime: string }) => {
  const glowRef = useRef<THREE.PointLight>(null);
  const rimRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const hours = parseInt(gameTime.split(':')[0], 10);
    const isNight = hours < 6 || hours >= 20;
    const isDusk = hours >= 17 && hours < 20;
    const isDawn = hours >= 5 && hours < 7;

    let intensity = 0.6;
    if (isNight) intensity = 1.6;
    else if (isDusk) intensity = THREE.MathUtils.lerp(0.6, 1.6, (hours - 17) / 3);
    else if (isDawn) intensity = THREE.MathUtils.lerp(1.6, 0.6, (hours - 5) / 2);

    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08;
    if (glowRef.current) glowRef.current.intensity = intensity * pulse;
    if (rimRef.current) rimRef.current.intensity = intensity * 0.5 * pulse;
  });

  return (
    <>
      <pointLight ref={glowRef} position={[2, 2.5, 1.5]} color="#ff4444" distance={12} decay={2} />
      <pointLight ref={rimRef} position={[2, 1, -3]} color="#7c3aed" distance={10} decay={2} />
    </>
  );
};
