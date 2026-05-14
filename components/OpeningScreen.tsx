import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { useProgress, useTexture } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DungeonBossTemplate, DungeonEnemyTemplate, EnemyTemplate, PlayerClassDefinition } from '../types';
import { primeOfflineBootCache } from '../game/mechanics/offlineCachePriming';
import { configureFBXLoader } from './scene3d/gltfLoader';

const MIN_SPLASH_VISIBILITY_MS = 900;
const MAX_PRELOAD_WAIT_MS = 14000;
const MAX_OFFLINE_PRIME_WAIT_MS = 5200;

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

// Relative prefix so paths resolve correctly both in the web build (base='/') and
// the Electron build (base='./', loaded from file://).
const _SKYBOX_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const _SKYBOX_FACE_NAMES = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'] as const;
const _makeSkyFaces = (theme: string) =>
  _SKYBOX_FACE_NAMES.map((f) => `${_SKYBOX_BASE}/skybox/${theme}/${f}`);

const SKYBOX_THEME_FACE_URLS = {
  manha: _makeSkyFaces('manha'),
  dia:   _makeSkyFaces('dia'),
  sol:   _makeSkyFaces('sol'),
  tarde: _makeSkyFaces('tarde'),
  noite: _makeSkyFaces('noite'),
} as const;

type SkyboxTheme = keyof typeof SKYBOX_THEME_FACE_URLS;

const getBootSkyboxThemes = (): SkyboxTheme[] => {
  if (typeof window === 'undefined') {
    return ['sol', 'dia', 'tarde', 'noite', 'manha'];
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const compactScreen = window.innerWidth < 900;
  const constrainedDevice = cores <= 6 || memory <= 6 || compactScreen;

  return constrainedDevice
    ? ['sol', 'dia']
    : ['sol', 'dia', 'tarde', 'noite', 'manha'];
};

const getSkyboxFaceUrlsForThemes = (themes: SkyboxTheme[]) => (
  themes.flatMap((theme) => SKYBOX_THEME_FACE_URLS[theme])
);

const MUSIC_TRACK_URLS = [
  new URL('../game/assets/Sounds/Music/Triha_Sonora.mp3', import.meta.url).href,
  new URL('../game/assets/Sounds/Music/Montanha.mp3', import.meta.url).href,
  new URL('../game/assets/Sounds/Music/Dungeon.mp3', import.meta.url).href,
] as const;

const MENU_BACKGROUND_IMAGE_URL = new URL('../game/assets/Imagens/Menu_Screen.png', import.meta.url).href;
const MENU_LOGO_IMAGE_URL = new URL('../game/assets/Imagens/Logo_Hero_Tower.png', import.meta.url).href;

const sanitizeUrlList = (urls: string[]) => (
  urls.filter((url) => typeof url === 'string' && url.length > 0 && !url.includes('undefined'))
);

interface OpeningScreenProps {
  classes: PlayerClassDefinition[];
  enemies: Array<EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate>;
  onReady: () => void;
}

interface PreloadManifest {
  modelUrls: string[];
  textureUrls: string[];
  animationUrls: string[];
  audioUrls: string[];
  totalAssets: number;
  signature: string;
}

const buildPreloadManifest = (): PreloadManifest => {
  const modelUrls = new Set<string>();
  const textureUrls = new Set<string>();
  const animationUrls = new Set<string>();
  const audioUrls = new Set<string>(MUSIC_TRACK_URLS);
  const bootSkyboxThemes = getBootSkyboxThemes();
  const bootSkyboxFaceUrls = getSkyboxFaceUrlsForThemes(bootSkyboxThemes);

  FOREST_SCENARIO_MODEL_URLS.forEach((url) => modelUrls.add(url));
  FOREST_SCENARIO_TEXTURE_URLS.forEach((url) => textureUrls.add(url));
  textureUrls.add(MENU_BACKGROUND_IMAGE_URL);
  textureUrls.add(MENU_LOGO_IMAGE_URL);
  bootSkyboxFaceUrls.forEach((url) => textureUrls.add(url));

  const safeModelUrls = sanitizeUrlList([...modelUrls]);
  const safeTextureUrls = sanitizeUrlList([...textureUrls]);
  const safeAnimationUrls = sanitizeUrlList([...animationUrls]);
  const safeAudioUrls = sanitizeUrlList([...audioUrls]);

  return {
    modelUrls: safeModelUrls,
    textureUrls: safeTextureUrls,
    animationUrls: safeAnimationUrls,
    audioUrls: safeAudioUrls,
    totalAssets: safeModelUrls.length + safeTextureUrls.length + safeAnimationUrls.length + safeAudioUrls.length,
    signature: JSON.stringify({
      models: safeModelUrls,
      textures: safeTextureUrls,
      animations: safeAnimationUrls,
      audio: safeAudioUrls,
      bootSkyboxThemes,
    }),
  };
};

const BootAssetPreloader = ({ manifest }: { manifest: PreloadManifest }) => {
  useLoader(FBXLoader, manifest.modelUrls, configureFBXLoader);
  useTexture(manifest.textureUrls);
  useLoader(FBXLoader, manifest.animationUrls, configureFBXLoader);

  return null;
};

export const OpeningScreen: React.FC<OpeningScreenProps> = ({ classes, enemies, onReady }) => {
  const manifest = useMemo(() => buildPreloadManifest(), []);
  const readyRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const finalizeTimerRef = useRef<number | null>(null);
  const [forceComplete, setForceComplete] = useState(false);
  const [offlinePrimeReady, setOfflinePrimeReady] = useState(false);
  const { active, progress, loaded, total, item } = useProgress();

  const finalizeBoot = useCallback(() => {
    if (readyRef.current) {
      return;
    }

    readyRef.current = true;

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

  const manifestPercentage = manifest.totalAssets > 0
    ? (loaded / manifest.totalAssets) * 100
    : 0;
  const loaderPercentage = total > 0
    ? (loaded / total) * 100
    : 0;
  const rawPercentage = manifest.totalAssets === 0
    ? 100
    : Math.max(progress, manifestPercentage, loaderPercentage, forceComplete ? 100 : 0);
  const realPercentage = manifest.totalAssets === 0
    ? 100
    : Math.min(100, Math.round(rawPercentage));

  // Animated display percentage: advances smoothly toward a ceiling that rises
  // over time so the user always sees movement, even when Three.js reports 0 progress
  // (e.g. assets already cached). Snaps to 100 when loading is truly done.
  const [percentage, setPercentage] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  useEffect(() => {
    const startTime = Date.now();
    const MAX_FAKE_PCT = 95; // never exceeds this until real done
    const DURATION_TO_CEILING_MS = MAX_PRELOAD_WAIT_MS * 0.92;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      // Ease-out curve that slowly fills to MAX_FAKE_PCT over DURATION_TO_CEILING_MS
      const fakeTarget = realPercentage >= 100
        ? 100
        : Math.min(
            MAX_FAKE_PCT,
            Math.round(MAX_FAKE_PCT * (1 - Math.exp(-3.5 * elapsed / DURATION_TO_CEILING_MS))),
          );
      const target = Math.max(fakeTarget, realPercentage);
      setPercentage((prev) => {
        if (prev >= target) return prev;
        // Advance by at most 1% per tick for smooth feel
        return Math.min(target, prev + 1);
      });
      if (target < 100) {
        animFrameRef.current = window.setTimeout(tick, 120);
      } else {
        setPercentage(100);
      }
    };

    animFrameRef.current = window.setTimeout(tick, 120);
    return () => {
      if (animFrameRef.current !== null) window.clearTimeout(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realPercentage >= 100]);

  useEffect(() => {
    if (readyRef.current || realPercentage < 100 || !offlinePrimeReady) {
      return;
    }

    finalizeBoot();
  }, [finalizeBoot, offlinePrimeReady, realPercentage]);

  useEffect(() => {
    if (readyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setForceComplete(true);
    }, MAX_PRELOAD_WAIT_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let activePrime = true;

    if (typeof window === 'undefined' || navigator.onLine === false) {
      setOfflinePrimeReady(true);
      return () => {
        activePrime = false;
      };
    }

    const timeout = window.setTimeout(() => {
      if (!activePrime) {
        return;
      }
      setOfflinePrimeReady(true);
    }, MAX_OFFLINE_PRIME_WAIT_MS);

    const primeUrls = [
      ...manifest.modelUrls,
      ...manifest.textureUrls,
      ...manifest.animationUrls,
      ...manifest.audioUrls,
    ];

    void primeOfflineBootCache(primeUrls)
      .catch(() => undefined)
      .finally(() => {
        if (!activePrime) {
          return;
        }
        window.clearTimeout(timeout);
        setOfflinePrimeReady(true);
      });

    return () => {
      activePrime = false;
      window.clearTimeout(timeout);
    };
  }, [manifest.animationUrls, manifest.audioUrls, manifest.modelUrls, manifest.textureUrls]);

  useEffect(() => () => {
    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
    }
  }, []);

  return (
    <div className="absolute inset-0 z-[100] overflow-hidden pointer-events-auto hero-brand-root">
      <img
        src={MENU_BACKGROUND_IMAGE_URL}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-top select-none pointer-events-none"
        draggable={false}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,11,10,0.10)_0%,rgba(22,11,10,0.26)_100%)]" />
      <div className="absolute inset-0 opacity-[0.09] bg-[radial-gradient(rgba(255,232,201,0.34)_0.5px,transparent_0.5px)] [background-size:3px_3px] pointer-events-none" />

      <Canvas
        frameloop="never"
        dpr={1}
        gl={{ antialias: false, powerPreference: (window as Window & { electronBridge?: { isElectron: boolean } }).electronBridge?.isElectron ? 'high-performance' : 'low-power' }}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <BootAssetPreloader manifest={manifest} />
        </Suspense>
      </Canvas>

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <div className="w-full max-w-2xl animate-fade-in-down">
          <img
            src={MENU_LOGO_IMAGE_URL}
            alt="Hero Tower"
            className="mx-auto w-full max-w-[340px] sm:max-w-[430px] hero-brand-logo-shadow hero-brand-logo-intro"
            draggable={false}
          />

          <div className="mt-10 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              width="110"
              height="110"
              overflow="visible"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="gemGrad" cx="40%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#fff8e0" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#f8d08c" />
                  <stop offset="100%" stopColor="#c06010" />
                </radialGradient>
                <radialGradient id="gemInner" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fff4cc" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#f0b040" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f8d08c" />
                  <stop offset="100%" stopColor="#e18f51" />
                </linearGradient>
              </defs>

              {/* Expanding pulse rings */}
              <circle cx="50" cy="50" r="22" fill="none" stroke="url(#ringGrad)" style={{ animation: 'splash-ring 2s ease-out infinite' }} />
              <circle cx="50" cy="50" r="22" fill="none" stroke="url(#ringGrad)" style={{ animation: 'splash-ring 2s ease-out 0.9s infinite' }} />
              <circle cx="50" cy="50" r="22" fill="none" stroke="#f8d08c" opacity="0.25" style={{ animation: 'splash-ring2 2.6s ease-out 0.45s infinite' }} />

              {/* Orbiting diamonds */}
              <g style={{ transformOrigin: '50px 50px', animation: 'spin 4s linear infinite' }}>
                <polygon points="50,14 53,18 50,22 47,18" fill="#f8d08c" opacity="0.9" />
                <polygon points="50,78 53,82 50,86 47,82" fill="#f8d08c" opacity="0.9" />
              </g>
              <g style={{ transformOrigin: '50px 50px', animation: 'spin 4s linear infinite reverse' }}>
                <polygon points="14,50 18,47 22,50 18,53" fill="#e18f51" opacity="0.8" />
                <polygon points="78,50 82,47 86,50 82,53" fill="#e18f51" opacity="0.8" />
              </g>

              {/* Center gem — diamond shape */}
              <polygon
                points="50,28 64,50 50,72 36,50"
                fill="url(#gemGrad)"
                style={{ transformOrigin: '50px 50px', animation: 'splash-pulse 1.8s ease-in-out infinite' }}
              />
              {/* Inner highlight */}
              <polygon
                points="50,34 58,50 50,58 42,50"
                fill="url(#gemInner)"
                style={{ transformOrigin: '50px 50px', animation: 'splash-gem-inner 1.8s ease-in-out infinite' }}
              />
              {/* Top facet glint */}
              <polygon points="50,28 56,40 50,44 44,40" fill="#fffbe8" opacity="0.45" />

              {/* Loading percentage centered on gem */}
              <text
                x="50"
                y="54"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                fill="#1a0a00"
                opacity="0.82"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >{percentage}%</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
