import React, { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelPart } from '../items/VoxelPart';
import type { RenderQualityProfile } from './types';

export const createModularBuilderQualityProfile = (base: RenderQualityProfile): RenderQualityProfile => ({
  isLowQuality: true,
  dpr: [1, Math.min(base.dpr[1], 1.25)],
  shadowMapSize: Math.min(base.shadowMapSize, 512),
  starsCount: 0,
  contactShadowResolution: Math.min(base.contactShadowResolution, 64),
  antialias: false,
});

export const getRenderQualityProfile = (): RenderQualityProfile => {
  if (typeof window === 'undefined') {
    return {
      isLowQuality: false,
      dpr: [1, 1.5],
      shadowMapSize: 512,
      starsCount: 800,
      contactShadowResolution: 128,
      antialias: false,
    };
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const low = cores <= 4 || memory <= 4 || window.innerWidth < 900;

  return {
    isLowQuality: low,
    dpr: low ? [0.85, 1] : [1, 1.5],
    shadowMapSize: low ? 512 : 1024,
    starsCount: low ? 400 : 800,
    contactShadowResolution: low ? 64 : 128,
    antialias: false,
  };
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

export const Cloud = ({ position, speed }: { position: [number, number, number]; speed: number }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.x = ((position[0] + state.clock.elapsedTime * speed + 15) % 30) - 15;
    }
  });

  return (
    <group ref={ref} position={position}>
      <VoxelPart position={[0, 0, 0]} size={[1.2, 0.4, 0.8]} color="#ffffff" opacity={0.8} castShadow={false} receiveShadow={false} />
      <VoxelPart position={[0.4, 0.2, 0]} size={[0.8, 0.4, 0.6]} color="#ffffff" opacity={0.8} castShadow={false} receiveShadow={false} />
      <VoxelPart position={[-0.4, 0.1, 0.2]} size={[0.6, 0.3, 0.5]} color="#ffffff" opacity={0.8} castShadow={false} receiveShadow={false} />
    </group>
  );
};

const SKYBOX_FACES = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'] as const;

const SKYBOX_PATHS: Record<string, string> = {
  manha: '/skybox/manha/',
  dia: '/skybox/dia/',
  sol: '/skybox/sol/',
  tarde: '/skybox/tarde/',
  noite: '/skybox/noite/',
};

const getGameT = (elapsed: number) => ((elapsed * 2 + 720) / 1440) % 1;

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

    Object.entries(SKYBOX_PATHS).forEach(([key, base]) => {
      loader.load(
        SKYBOX_FACES.map((face) => base + face),
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;

          cubemaps.current[key] = tex;
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
    });

    return () => {
      pmrem.current?.dispose();
      Object.values(cubemaps.current).forEach((texture) => texture.dispose());
      Object.values(iblCache.current).forEach((texture) => texture.dispose());
      skyMaterial.dispose();
      blackCube.dispose();
    };
  }, [blackCube, gl, skyMaterial]);

  useFrame((state) => {
    if (loadedCount.current === 0) return;

    const t = getGameT(state.clock.elapsedTime);
    const { from, to, blend } = getSkyboxBlend(t);
    const anyLoaded = (): THREE.CubeTexture | null => Object.values(cubemaps.current)[0] ?? null;
    const fromTex = cubemaps.current[from] ?? anyLoaded();
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
    if ((scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity !== 0.15) {
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.15;
    }
  });

  return (
    <mesh renderOrder={-1000} material={skyMaterial} frustumCulled={false}>
      <sphereGeometry args={[500, 32, 24]} />
    </mesh>
  );
};

export const DayNightCycle = ({
  containerRef,
  onTimeUpdate,
  quality,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onTimeUpdate: (time: string) => void;
  quality: RenderQualityProfile;
}) => {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Group>(null);
  const lastMinuteRef = useRef(-1);
  const lastBgRef = useRef('');
  const lastCloudKeyRef = useRef('');

  const cloudData = useMemo(() => [
    { pos: [-10, 6, -15] as [number, number, number], speed: 0.05 },
    { pos: [0, 7, -18] as [number, number, number], speed: 0.03 },
    { pos: [8, 5, -16] as [number, number, number], speed: 0.07 },
    { pos: [-5, 8, -20] as [number, number, number], speed: 0.02 },
    { pos: [12, 6.5, -17] as [number, number, number], speed: 0.04 },
  ], []);

  useFrame((state) => {
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

    const T_MANHA = 5 / 24;
    const T_DIA = 8 / 24;
    const T_SOL = 11 / 24;
    const T_SOLEND = 13 / 24;
    const T_TARDE = 16 / 24;
    const T_NOITE = 19 / 24;
    const frac = (start: number, end: number) => THREE.MathUtils.clamp((t - start) / (end - start), 0, 1);
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunPos = new THREE.Vector3(Math.cos(angle) * 25, Math.sin(angle) * 15, -15);
    const moonPos = new THREE.Vector3(Math.cos(angle + Math.PI) * 25, Math.sin(angle + Math.PI) * 15, -15);

    let ambientIntensity: number;
    let sunIntensity: number;
    let sunColor = new THREE.Color();
    let hemiSky = new THREE.Color();
    let hemiGround = new THREE.Color();
    let moonIntensity: number;

    const COL = {
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
    };

    if (t >= T_MANHA && t < T_DIA) {
      const p = frac(T_MANHA, T_DIA);
      ambientIntensity = THREE.MathUtils.lerp(0.22, 0.5, p);
      sunIntensity = THREE.MathUtils.lerp(0.3, 1.2, p);
      sunColor.lerpColors(COL.sunNoite, COL.sunManha, p);
      hemiSky.lerpColors(COL.hemiNoiteS, COL.hemiManhaS, p);
      hemiGround.lerpColors(COL.hemiNoiteG, COL.hemiManhaG, p);
      moonIntensity = THREE.MathUtils.lerp(0.35, 0, p);
    } else if (t >= T_DIA && t < T_SOL) {
      const p = frac(T_DIA, T_SOL);
      ambientIntensity = THREE.MathUtils.lerp(0.5, 0.55, p);
      sunIntensity = THREE.MathUtils.lerp(1.2, 1.5, p);
      sunColor.lerpColors(COL.sunManha, COL.sunDia, p);
      hemiSky.lerpColors(COL.hemiManhaS, COL.hemiDiaS, p);
      hemiGround.lerpColors(COL.hemiManhaG, COL.hemiDiaG, p);
      moonIntensity = 0;
    } else if (t >= T_SOL && t < T_SOLEND) {
      ambientIntensity = 0.58;
      sunIntensity = 1.65;
      sunColor.copy(COL.sunSol);
      hemiSky.copy(COL.hemiSolS);
      hemiGround.copy(COL.hemiSolG);
      moonIntensity = 0;
    } else if (t >= T_SOLEND && t < T_TARDE) {
      const p = frac(T_SOLEND, T_TARDE);
      ambientIntensity = THREE.MathUtils.lerp(0.55, 0.46, p);
      sunIntensity = THREE.MathUtils.lerp(1.5, 1.35, p);
      sunColor.lerpColors(COL.sunDia, COL.sunManha, p);
      hemiSky.lerpColors(COL.hemiDiaS, COL.hemiManhaS, p);
      hemiGround.lerpColors(COL.hemiDiaG, COL.hemiManhaG, p);
      moonIntensity = 0;
    } else if (t >= T_TARDE && t < T_NOITE) {
      const p = frac(T_TARDE, T_NOITE);
      ambientIntensity = THREE.MathUtils.lerp(0.46, 0.2, p);
      sunIntensity = THREE.MathUtils.lerp(1.35, 0.2, p);
      sunColor.lerpColors(COL.sunDia, COL.sunTarde, p);
      hemiSky.lerpColors(COL.hemiManhaS, COL.hemiTardeS, p);
      hemiGround.lerpColors(COL.hemiManhaG, COL.hemiTardeG, p);
      moonIntensity = THREE.MathUtils.lerp(0, 0.25, p);
    } else {
      const p = t >= T_NOITE
        ? (t - T_NOITE) / (1 - T_NOITE + T_MANHA)
        : (t + 1 - T_NOITE) / (1 - T_NOITE + T_MANHA);
      ambientIntensity = 0.18;
      sunIntensity = 0;
      sunColor.set(COL.sunNoite);
      hemiSky.set(COL.hemiNoiteS);
      hemiGround.set(COL.hemiNoiteG);
      moonIntensity = 0.55 * Math.max(0, Math.sin(p * Math.PI));
    }

    if (ambientRef.current) ambientRef.current.intensity = ambientIntensity;
    if (hemiRef.current) {
      hemiRef.current.intensity = ambientIntensity * 0.6;
      hemiRef.current.color.copy(hemiSky);
      hemiRef.current.groundColor.copy(hemiGround);
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = sunIntensity;
      sunLightRef.current.color.copy(sunColor);
      sunLightRef.current.position.copy(sunPos);
    }
    if (moonLightRef.current) {
      moonLightRef.current.intensity = moonIntensity;
      moonLightRef.current.position.copy(moonPos);
    }
    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunPos);
      sunMeshRef.current.scale.setScalar(sunPos.y > -1 ? 1 : 0);
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPos);
      moonMeshRef.current.scale.setScalar(moonPos.y > -1 ? 1 : 0);
    }

    let cloudColor = new THREE.Color('#ffffff');
    let cloudOpacity = 0.8;
    if (t < T_MANHA || t >= T_NOITE) {
      cloudColor.set('#3a4a6b');
      cloudOpacity = 0.35;
    } else if (t >= T_TARDE) {
      const p = frac(T_TARDE, T_NOITE);
      cloudColor.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#ff9d6e'), p * 2 > 1 ? 1 : p * 2);
      cloudOpacity = THREE.MathUtils.lerp(0.8, 0.35, p);
    }

    const cloudKey = `${cloudColor.getHexString()}-${cloudOpacity.toFixed(2)}`;
    if (cloudsRef.current && cloudKey !== lastCloudKeyRef.current) {
      lastCloudKeyRef.current = cloudKey;
      cloudsRef.current.children.forEach((cloudGroup) => {
        cloudGroup.children.forEach((voxel) => {
          const material = (voxel as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (material) {
            material.color.copy(cloudColor);
            material.opacity = cloudOpacity;
            material.transparent = cloudOpacity < 1;
          }
        });
      });
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
        castShadow
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-radius={4}
      />
      <directionalLight ref={moonLightRef} color="#c7d2fe" intensity={0} position={[-5, 10, -15]} />
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={2} />
      </mesh>
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[1.2, 8, 8]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#c7d2fe" emissiveIntensity={1.2} />
      </mesh>
      <group ref={cloudsRef}>
        {cloudData.map((cloud, index) => (
          <Cloud key={index} position={cloud.pos} speed={cloud.speed} />
        ))}
      </group>
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

export const DungeonBattlePlatform = () => (
  <group position={[0, -1.15, 0]}>
    <VoxelPart position={[0, -0.65, -8.5]} size={[28, 1.1, 18]} color="#111827" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 4.2, -8.2]} size={[28, 0.9, 18]} color="#1f2937" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 0, 0]} size={[12.5, 0.25, 8.5]} color="#3f3f46" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 0.08, 0]} size={[11.7, 0.12, 7.7]} color="#27272a" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 2.5, -11.2]} size={[28, 7, 1.6]} color="#292524" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[-9.2, 2.2, -6.8]} size={[1.4, 6.6, 10.8]} color="#1c1917" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[9.2, 2.2, -6.8]} size={[1.4, 6.6, 10.8]} color="#1c1917" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[0, 1.3, -13.8]} size={[18, 3.4, 5.4]} color="#1f2937" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[-11.8, 0.9, -8.8]} size={[3.2, 2.2, 5.4]} color="#27272a" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[11.8, 0.9, -8.8]} size={[3.2, 2.2, 5.4]} color="#27272a" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[-7.7, 0.9, -2.5]} size={[2.2, 2.4, 1.6]} color="#3f3f46" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[7.7, 0.9, -2.5]} size={[2.2, 2.4, 1.6]} color="#3f3f46" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[-8.2, -0.2, 0.9]} size={[1.2, 0.35, 1.1]} color="#44403c" material="standard" castShadow={false} receiveShadow />
    <VoxelPart position={[8.1, -0.22, 1.1]} size={[1.4, 0.32, 1.2]} color="#44403c" material="standard" castShadow={false} receiveShadow />
    <Torch position={[-7.1, 0.4, 0.9]} rotation={[0, 0.2, 0]} />
    <Torch position={[7.1, 0.4, 0.9]} rotation={[0, -0.2, 0]} />
    <Torch position={[-5.8, 1.6, -5.7]} rotation={[0, 0.25, 0]} color="#f97316" />
    <Torch position={[5.8, 1.6, -5.7]} rotation={[0, -0.25, 0]} color="#fdba74" />
  </group>
);

export const DungeonAtmosphere = ({ quality }: { quality: RenderQualityProfile }) => {
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
      <directionalLight position={[0, 6, 6]} intensity={0.78} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
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

export const FogController: React.FC = () => {
  const { scene } = useThree();

  const FOG = {
    noite: new THREE.Color('#0d1525'),
    manha: new THREE.Color('#d8c4a8'),
    dia: new THREE.Color('#c8dde8'),
    sol: new THREE.Color('#d8eaf2'),
    tarde: new THREE.Color('#e0a882'),
  };

  useFrame((state) => {
    const t = getGameT(state.clock.elapsedTime);
    const T_MANHA = 5 / 24;
    const T_DIA = 8 / 24;
    const T_SOL = 11 / 24;
    const T_SOLEND = 13 / 24;
    const T_TARDE = 16 / 24;
    const T_NOITE = 19 / 24;
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;

    let color = new THREE.Color();
    if (t >= T_MANHA && t < T_DIA) {
      color.lerpColors(FOG.noite, FOG.manha, (t - T_MANHA) / (T_DIA - T_MANHA));
    } else if (t >= T_DIA && t < T_SOL) {
      color.lerpColors(FOG.manha, FOG.dia, (t - T_DIA) / (T_SOL - T_DIA));
    } else if (t >= T_SOL && t < T_SOLEND) {
      color.copy(FOG.sol);
    } else if (t >= T_SOLEND && t < T_TARDE) {
      color.lerpColors(FOG.sol, FOG.dia, (t - T_SOLEND) / (T_TARDE - T_SOLEND));
    } else if (t >= T_TARDE && t < T_NOITE) {
      color.lerpColors(FOG.tarde, FOG.noite, (t - T_TARDE) / (T_NOITE - T_TARDE));
    } else {
      color.copy(FOG.noite);
    }
    fog.color.copy(color);
  });

  return <fog attach="fog" args={[FOG.dia.getHex(), 32, 90]} />;
};

export const CameraController = ({ screenShake }: { screenShake?: number }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const isMobile = window.innerWidth < 768;
  const camZ = isMobile ? 12.5 : 11;
  const camFov = isMobile ? 54 : 50;

  useFrame(() => {
    if (cameraRef.current && screenShake) {
      const shake = screenShake;
      cameraRef.current.position.x = (Math.random() - 0.5) * shake;
      cameraRef.current.position.y = 2.5 + (Math.random() - 0.5) * shake;
    } else if (cameraRef.current) {
      cameraRef.current.position.x = THREE.MathUtils.lerp(cameraRef.current.position.x, 0, 0.1);
      cameraRef.current.position.y = THREE.MathUtils.lerp(cameraRef.current.position.y, 2.5, 0.1);
    }
    if (cameraRef.current) {
      cameraRef.current.lookAt(0, 0.9, 0);
    }
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 2.5, camZ]} fov={camFov} near={0.5} far={120} />;
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