import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { useProgress, useTexture } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DungeonBossTemplate, DungeonEnemyTemplate, EnemyTemplate, PlayerClassDefinition } from '../types';

const PRELOAD_CACHE_NAME = 'hero-adventure-assets-v1';
const PRELOAD_STORAGE_KEY = 'hero-adventure-preload-signature-v1';
const MIN_SPLASH_VISIBILITY_MS = 900;
const MAX_PRELOAD_WAIT_MS = 14000;

const FOREST_SCENARIO_MODEL_URLS = [
  new URL('../game/assets/Scenario/Florest/Tree_1_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Tree_2_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Tree_3_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Tree_4_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Bush_1_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Bush_2_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Bush_3_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Rock_1_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Rock_2_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Rock_3_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Grass_1_A_Color1.fbx', import.meta.url).href,
  new URL('../game/assets/Scenario/Florest/Grass_2_A_Color1.fbx', import.meta.url).href,
] as const;

const FOREST_SCENARIO_TEXTURE_URLS = [
  new URL('../game/assets/Scenario/Florest/forest_texture.png', import.meta.url).href,
] as const;

const SKYBOX_FACE_URLS = [
  '/skybox/manha/px.png', '/skybox/manha/nx.png', '/skybox/manha/py.png', '/skybox/manha/ny.png', '/skybox/manha/pz.png', '/skybox/manha/nz.png',
  '/skybox/dia/px.png', '/skybox/dia/nx.png', '/skybox/dia/py.png', '/skybox/dia/ny.png', '/skybox/dia/pz.png', '/skybox/dia/nz.png',
  '/skybox/sol/px.png', '/skybox/sol/nx.png', '/skybox/sol/py.png', '/skybox/sol/ny.png', '/skybox/sol/pz.png', '/skybox/sol/nz.png',
  '/skybox/tarde/px.png', '/skybox/tarde/nx.png', '/skybox/tarde/py.png', '/skybox/tarde/ny.png', '/skybox/tarde/pz.png', '/skybox/tarde/nz.png',
  '/skybox/noite/px.png', '/skybox/noite/nx.png', '/skybox/noite/py.png', '/skybox/noite/ny.png', '/skybox/noite/pz.png', '/skybox/noite/nz.png',
] as const;

interface OpeningScreenProps {
  classes: PlayerClassDefinition[];
  enemies: Array<EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate>;
  onReady: () => void;
}

interface PreloadManifest {
  modelUrls: string[];
  textureUrls: string[];
  animationUrls: string[];
  totalAssets: number;
  signature: string;
}

const buildPreloadManifest = (
  classes: PlayerClassDefinition[],
  enemies: Array<EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate>,
): PreloadManifest => {
  const modelUrls = new Set<string>();
  const textureUrls = new Set<string>();
  const animationUrls = new Set<string>();

  classes.forEach((playerClass) => {
    const { assets } = playerClass;

    if (assets.implementationStatus !== 'fbx') {
      return;
    }

    if (assets.modelUrl) {
      modelUrls.add(assets.modelUrl);
    }

    if (assets.textureUrl) {
      textureUrls.add(assets.textureUrl);
    }

    assets.animationUrls?.forEach((url) => animationUrls.add(url));
  });

  enemies.forEach((enemy) => {
    const { assets } = enemy;

    if (!assets || assets.implementationStatus !== 'fbx') {
      return;
    }

    if (assets.modelUrl) {
      modelUrls.add(assets.modelUrl);
    }

    if (assets.textureUrl) {
      textureUrls.add(assets.textureUrl);
    }

    assets.animationUrls?.forEach((url) => animationUrls.add(url));
  });

  FOREST_SCENARIO_MODEL_URLS.forEach((url) => modelUrls.add(url));
  FOREST_SCENARIO_TEXTURE_URLS.forEach((url) => textureUrls.add(url));
  SKYBOX_FACE_URLS.forEach((url) => textureUrls.add(url));

  return {
    modelUrls: [...modelUrls],
    textureUrls: [...textureUrls],
    animationUrls: [...animationUrls],
    totalAssets: modelUrls.size + textureUrls.size + animationUrls.size,
    signature: JSON.stringify({
      models: [...modelUrls],
      textures: [...textureUrls],
      animations: [...animationUrls],
    }),
  };
};

const BootAssetPreloader = ({ manifest }: { manifest: PreloadManifest }) => {
  useLoader(FBXLoader, manifest.modelUrls);
  useTexture(manifest.textureUrls);
  useLoader(FBXLoader, manifest.animationUrls);

  return null;
};

export const OpeningScreen: React.FC<OpeningScreenProps> = ({ classes, enemies, onReady }) => {
  const manifest = useMemo(() => buildPreloadManifest(classes, enemies), [classes, enemies]);
  const readyRef = useRef(false);
  const cacheHitRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const finalizeTimerRef = useRef<number | null>(null);
  const [forceComplete, setForceComplete] = useState(false);
  const { active, progress, loaded, total, item } = useProgress();

  const finalizeBoot = useCallback(() => {
    if (readyRef.current) {
      return;
    }

    readyRef.current = true;
    window.localStorage.setItem(PRELOAD_STORAGE_KEY, manifest.signature);

    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, MIN_SPLASH_VISIBILITY_MS - elapsed);

    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
    }

    finalizeTimerRef.current = window.setTimeout(() => {
      finalizeTimerRef.current = null;
      onReady();
    }, remaining);
  }, [manifest.signature, onReady]);

  useEffect(() => {
    if (manifest.totalAssets === 0 || typeof window === 'undefined' || !('caches' in window)) {
      return;
    }

    const cachedSignature = window.localStorage.getItem(PRELOAD_STORAGE_KEY);
    if (cachedSignature === manifest.signature) {
      cacheHitRef.current = true;
      return;
    }

    const urls = [...manifest.modelUrls, ...manifest.textureUrls, ...manifest.animationUrls];
    void caches.open(PRELOAD_CACHE_NAME)
      .then(async (cache) => {
        await Promise.all(urls.map(async (url) => {
          try {
            const match = await cache.match(url);
            if (!match) {
              await cache.add(url);
            }
          } catch {
            return;
          }
        }));
      })
      .catch(() => undefined);
  }, [manifest.animationUrls, manifest.modelUrls, manifest.signature, manifest.textureUrls, manifest.totalAssets]);

  const manifestPercentage = manifest.totalAssets > 0
    ? (loaded / manifest.totalAssets) * 100
    : 0;
  const loaderPercentage = total > 0
    ? (loaded / total) * 100
    : 0;
  const cachePercentage = cacheHitRef.current && !active ? 100 : 0;
  const rawPercentage = manifest.totalAssets === 0
    ? 100
    : Math.max(progress, manifestPercentage, loaderPercentage, cachePercentage, forceComplete ? 100 : 0);
  const percentage = manifest.totalAssets === 0
    ? 100
    : Math.max(4, Math.min(100, Math.round(rawPercentage)));

  useEffect(() => {
    if (readyRef.current || percentage < 100) {
      return;
    }

    finalizeBoot();
  }, [finalizeBoot, percentage]);

  useEffect(() => {
    if (readyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setForceComplete(true);
    }, cacheHitRef.current ? 1800 : MAX_PRELOAD_WAIT_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => () => {
    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
    }
  }, []);

  const loadingLabel = percentage >= 100
    ? 'Iniciando'
    : active
      ? 'Carregando'
      : item
        ? 'Preparando'
        : 'Carregando';

  return (
    <div className="absolute inset-0 z-[100] overflow-hidden bg-[#f8fafc] text-slate-950 pointer-events-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_52%,#e2e8f0_100%)]" />

      <Canvas
        frameloop="never"
        dpr={1}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <BootAssetPreloader manifest={manifest} />
        </Suspense>
      </Canvas>

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-xl animate-fade-in-down">
          <h1 className="font-gamer text-5xl font-black tracking-tight text-slate-950 sm:text-7xl">
            Hero Adventure
          </h1>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.38em] text-slate-500 sm:text-sm">
            {loadingLabel}
          </p>

          <div className="mx-auto mt-8 h-2.5 w-full overflow-hidden rounded-full bg-white/80 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_55%,#818cf8_100%)] transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="mt-4 font-mono text-sm font-bold tracking-[0.18em] text-slate-600">
            {percentage}%
          </div>
        </div>
      </div>
    </div>
  );
};
