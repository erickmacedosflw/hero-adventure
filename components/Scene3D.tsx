import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sword, Shield, Zap, Sparkles, FlaskConical } from 'lucide-react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, PerspectiveCamera, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { COMBAT_SPRITE_ANIMATION_DEFAULTS, SPRITE_ANIMATION_IDS, SPRITE_ANIMATION_REGISTRY } from '../game/data/sprite-animations/registry';
import { resolveTrackPlaybackSnapshot } from '../game/mechanics/spriteOverlayPlayback';
import { CardCategory, Enemy, EnemyIntentPreview, FloatingText, Particle, Player, PlayerAnimationAction, PlayerClassAnimationMap, PlayerClassAssets, PlayerClassId, SpriteOverlayAnimationDefinition, SpriteTrackDefinition, StatusEffect, TurnState } from '../types';
import {
  RIGHT_HAND_BONE_CANDIDATES,
  RuntimeHeroAssets,
  createNormalizedBoneLookup,
  createRigComparisonReport,
  findBestClipName,
  getTrackBindingTargetName,
  hasRuntimeFbxAssets,
  prepareExternalTexture,
  remapClipBindingsToSkeleton,
  resolveAutomaticClipName,
  selectPrimaryAnimationBundle,
  selectSecondaryAnimationBundles,
} from './scene3d/animation';
import {
  CameraController,
  DayNightCycle,
  DungeonAtmosphere,
  SkyboxController,
  getRenderPlatform,
  getRenderPowerPreference,
  getRenderQualityProfile,
} from './scene3d/environment';
import {
  DeveloperClassBuilderSceneRenderer,
  DeveloperHeroSceneRenderer,
  DeveloperKitbashSceneRenderer,
  DeveloperMonsterSceneRenderer,
  DeveloperWeaponCalibrationSceneRenderer,
} from './scene3d/developer-scenes';
import {
  AnimatedClassHero,
  EnemyCharacter,
  applyHitFlashToMaterial,
} from './scene3d/characters';
import type {
  DeveloperClassBuilderSceneProps,
  DeveloperHeroSceneProps,
  DeveloperKitbashSceneProps,
  DeveloperMonsterSceneProps,
} from './scene3d/developer-scenes';
import { MeshParticle, WorldFloatingTexts } from './scene3d/effects';
import {
  getKitbashRootSlot,
  KITBASH_MAIN_SLOTS,
  prepareRuntimeHeroModel,
  rebindPreparedModelToSkeleton,
} from './scene3d/kitbash';
import {
  resolveRuntimeClassAssets,
} from './scene3d/developer';
import { EquippedWeaponAttachment } from './scene3d/weapons';
import { BattleScenario, DungeonScenario } from './scene3d/scenarios';
import { getScenario } from '../game/data/scenarios';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperKitbashSlotFitDiagnostic,
  DeveloperKitbashTransform,
  DeveloperMeshPartDescriptor,
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './scene3d/types';
import { VoxelPart } from './items/VoxelPart';
import { getPlayerClassById } from '../game/data/classes';
import { getEquippedWeaponGrip, getRegisteredWeapon3DByItemId } from '../game/data/weaponCatalog';
export { ItemPreviewCanvas } from './items/ItemPreviewCanvas';
export type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperKitbashTransform,
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './scene3d/types';

interface SceneProps {
  enemyColor: string;
  enemyScale: number;
  enemyName?: string;
  enemyAssets?: PlayerClassAssets;
  enemyAttackStyle?: 'armed' | 'unarmed';
  enemyAnimationAction?: PlayerAnimationAction;
  floatingTexts?: FloatingText[];
  playerClassId?: PlayerClassId;
  playerAnimationAction?: PlayerAnimationAction;
  playerExecutionAnimationId?: string | null;
  enemyExecutionAnimationId?: string | null;
  playerExecutionAnimationTintColor?: string | null;
  enemyExecutionAnimationTintColor?: string | null;
  playerImpactAnimationId?: string | null;
  enemyImpactAnimationId?: string | null;
  playerImpactAnimationTintColor?: string | null;
  enemyImpactAnimationTintColor?: string | null;
  playerImpactAnimationTarget?: 'self' | 'target';
  enemyImpactAnimationTarget?: 'self' | 'target';
  playerImpactAnimationTrigger?: number;
  enemyImpactAnimationTrigger?: number;
  playerBowShotTrigger?: number;
  enemyBowShotTrigger?: number;
  playerBowShotDidHit?: boolean;
  enemyBowShotDidHit?: boolean;
  turnState: TurnState;
  isPlayerAttacking: boolean;
  isEnemyAttacking: boolean;
  particles: Particle[];
  equippedWeaponId?: string;
  equippedArmorId?: string;
  equippedHelmetId?: string;
  equippedLegsId?: string;
  equippedShieldId?: string;
  enemyType?: 'beast' | 'humanoid' | 'undead';
  isEnemyBoss?: boolean;
  isPlayerDefending?: boolean;
  isEnemyDefending?: boolean;
  isPlayerHit?: boolean;
  isPlayerCritHit?: boolean;
  isEnemyHit?: boolean;
  hasPerfectEvadeAura?: boolean;
  hasDoubleAttackAura?: boolean;
  impulseLevel?: number;
  activeImpulseLevel?: number;
  screenShake?: number;
  isLevelingUp?: boolean;
  levelUpCardCategory?: CardCategory;
  isMenuView?: boolean;
  menuCameraFocus?: boolean;
  isDungeonScene?: boolean;
  stage?: number;
  isDungeonRun?: boolean;
  onGameTimeUpdate?: (time: string) => void;
  onMenuHeroClick?: () => void;
  playerState?: Player;
  enemyState?: Enemy | null;
  enemyIntentPreview?: EnemyIntentPreview | null;
}

// --- MAIN COMPONENTS ---

const createParticleTexture = (size: number, exponent: number) => {
  const data = new Uint8Array(size * size * 4);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const dist = Math.sqrt((nx * nx) + (ny * ny));
      const alpha = Math.max(0, 1 - dist);
      const intensity = Math.floor(255 * Math.pow(alpha, exponent));
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = intensity;
      offset += 4;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

const ORB_TEXTURE = createParticleTexture(64, 1.55);
const CORE_TEXTURE = createParticleTexture(64, 2.8);

const LEVEL_UP_PARTICLE_COUNT = 44;
const LEVEL_UP_PARTICLE_SEEDS = Array.from({ length: LEVEL_UP_PARTICLE_COUNT }, (_, i) => ({
  phase: (i / LEVEL_UP_PARTICLE_COUNT) * Math.PI * 2,
  speed: 0.9 + (i % 7) * 0.16,
  radius: 0.45 + Math.random() * 0.62,
  yBase: -0.35 + Math.random() * 2.2,
  ySwing: 0.16 + Math.random() * 0.2,
  zDepth: (Math.random() - 0.5) * 0.4,
  size: 0.06 + Math.random() * 0.08,
  alpha: 0.16 + Math.random() * 0.25,
}));

const getCardCategoryVfxColor = (category: CardCategory) => {
  if (category === 'batalha') return '#ef4444';
  if (category === 'atributo') return '#22c55e';
  if (category === 'especial') return '#38bdf8';
  return '#f59e0b';
};

const LevelUpEffect = ({ category = 'especial' }: { category?: CardCategory }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Sprite>(null);
  const auraRef = useRef<THREE.Sprite>(null);
  const sparklesRef = useRef<(THREE.Sprite | null)[]>([]);
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const localTime = useRef(0);
  const color = useMemo(() => new THREE.Color(getCardCategoryVfxColor(category)), [category]);
  const brightColor = useMemo(() => color.clone().lerp(new THREE.Color('#ffffff'), 0.55), [color]);

  useFrame((_, delta) => {
    localTime.current += delta;
    const t = localTime.current;

    // Intro scale: quick grow from 0 to 1 in ~0.4s
    if (groupRef.current) {
      const intro = Math.min(t / 0.4, 1);
      const s = intro * intro * (3 - 2 * intro); // smoothstep
      groupRef.current.scale.setScalar(s);
    }

    if (coreRef.current) {
      const pulse = 0.62 + Math.sin(t * 10.5) * 0.15;
      coreRef.current.position.set(0, 0.65, 0.08);
      coreRef.current.scale.setScalar(0.72 + pulse * 0.3);
      const mat = coreRef.current.material as THREE.SpriteMaterial;
      mat.color.copy(brightColor);
      mat.opacity = 0.48 + pulse * 0.34;
    }

    if (auraRef.current) {
      const pulse = 0.65 + Math.sin(t * 6.8 + 0.6) * 0.2;
      auraRef.current.position.set(0, 0.65, 0.06);
      auraRef.current.scale.set(2.25 + pulse * 0.95, 1.48 + pulse * 0.58, 1);
      const mat = auraRef.current.material as THREE.SpriteMaterial;
      mat.color.copy(color);
      mat.opacity = 0.14 + pulse * 0.2;
    }

    sparklesRef.current.forEach((sprite, i) => {
      if (!sprite) return;
      const seed = LEVEL_UP_PARTICLE_SEEDS[i];
      const angle = seed.phase + t * seed.speed;
      const radius = seed.radius + Math.sin(t * 2.6 + i * 0.37) * 0.12;
      sprite.position.set(
        Math.cos(angle) * radius,
        seed.yBase + Math.sin((t * seed.speed * 0.9) + seed.phase) * seed.ySwing,
        Math.sin(angle) * 0.18 + seed.zDepth,
      );
      const scale = seed.size * (1 + Math.sin(t * 7.2 + i) * 0.34);
      sprite.scale.set(scale * 1.85, scale, 1);
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.color.copy(i % 3 === 0 ? brightColor : color);
      mat.opacity = Math.max(0.05, seed.alpha + Math.sin(t * 5.2 + i * 0.8) * 0.2);
    });

    if (light1Ref.current) {
      light1Ref.current.color.copy(color);
      light1Ref.current.intensity = 1.4 + Math.sin(t * 5.2) * 0.8;
    }
    if (light2Ref.current) {
      light2Ref.current.color.copy(brightColor);
      light2Ref.current.intensity = 0.9 + Math.sin(t * 4 + 1) * 0.55;
      light2Ref.current.position.y = 1.45 + Math.sin(t * 2.4) * 0.24;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.8, 0]} scale={0}>
      <sprite ref={auraRef} renderOrder={5}>
        <spriteMaterial
          map={ORB_TEXTURE}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={coreRef} renderOrder={6}>
        <spriteMaterial
          map={CORE_TEXTURE}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {LEVEL_UP_PARTICLE_SEEDS.map((seed, i) => (
        <sprite key={`lvlup_particle_${i}`} ref={(el) => { sparklesRef.current[i] = el; }} position={[0, seed.yBase, seed.zDepth]} renderOrder={5}>
          <spriteMaterial
            map={ORB_TEXTURE}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
      <pointLight ref={light1Ref} position={[0, 0.7, 0.4]} intensity={1.5} distance={4.8} decay={2} />
      <pointLight ref={light2Ref} position={[0, 1.45, 0.1]} intensity={1.0} distance={4.2} decay={2} />
    </group>
  );
};

const clampPercent = (value: number, max: number) => {
  if (max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (value / max) * 100));
};

const CHARACTER_FOCUS_TARGET: [number, number, number] = [0, 0.9, 0];
const DUNGEON_FOCUS_RANGE = 3.9;
const FOREST_FOCUS_RANGE = 3.4;

const COMBAT_TRAIL_COUNT = 18;
const COMBAT_TRAIL_SEEDS = Array.from({ length: COMBAT_TRAIL_COUNT }, (_, i) => ({
  phase: i / COMBAT_TRAIL_COUNT,
  speed: 0.75 + (i % 5) * 0.18,
  yOffset: (Math.random() - 0.5) * 0.42,
  zOffset: (Math.random() - 0.5) * 0.34,
  size: 0.08 + (i % 4) * 0.026,
}));

const GENERATED_ANIMATION_JSON_MODULES = import.meta.glob('../game/data/sprite-animations/generated/*.json', { eager: true });
const GENERATED_SPRITE_SHEET_URL_MODULES = import.meta.glob('../game/sprites/*', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const getPathBasename = (input?: string | null) => {
  if (!input) return null;
  const normalized = input.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || null;
};

const LevelUpSpriteExecution = ({ isLevelingUp }: { isLevelingUp?: boolean }) => {
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([]);
  const wasLevelingUpRef = useRef(false);
  const startMsRef = useRef<number | null>(null);
  const [definition, setDefinition] = useState<SpriteOverlayAnimationDefinition | null>(null);
  const [trackTextures, setTrackTextures] = useState<THREE.Texture[]>([]);
  const [trackLuminanceTextures, setTrackLuminanceTextures] = useState<THREE.Texture[]>([]);

  const enabledTracks = useMemo(
    () => (definition?.spriteTracks ?? []).filter((track) => track.enabled !== false),
    [definition],
  );

  useEffect(() => {
    let active = true;
    const createdTextures: THREE.Texture[] = [];
    const textureLoader = new THREE.TextureLoader();

    const configureTexture = (nextTexture: THREE.Texture) => {
      nextTexture.flipY = false;
      nextTexture.wrapS = THREE.ClampToEdgeWrapping;
      nextTexture.wrapT = THREE.ClampToEdgeWrapping;
      nextTexture.minFilter = THREE.LinearMipmapLinearFilter;
      nextTexture.magFilter = THREE.LinearFilter;
      nextTexture.generateMipmaps = true;
      nextTexture.needsUpdate = true;
    };

    const loadTextureByCandidates = async (candidates: string[]): Promise<THREE.Texture | null> => {
      for (const candidate of candidates) {
        try {
          const loaded = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(candidate, resolve, undefined, reject);
          });
          return loaded;
        } catch {
          // try next candidate
        }
      }
      return null;
    };

    const loadExecutionAnimation = async () => {
      const entry = SPRITE_ANIMATION_REGISTRY.find((item) => item.id === SPRITE_ANIMATION_IDS.execAuraUp1);
      if (!entry) {
        return;
      }

      const loadedDefinition = resolveBundledAnimationDefinitionByPath(entry.arquivo);
      if (!loadedDefinition) {
        return;
      }

      const firstTrack = loadedDefinition.spriteTracks?.find((track) => track.enabled !== false)
        ?? loadedDefinition.spriteTracks?.[0];
      const spriteSheetRef = firstTrack?.spriteSheetPath
        ?? firstTrack?.spriteSheetUrl
        ?? loadedDefinition.spriteSheetUrl
        ?? loadedDefinition.spriteSheetName;

      const textureCandidates = [
        resolveSpriteAssetUrl(spriteSheetRef),
        resolveBundledSpriteSheetUrl(spriteSheetRef),
        resolveBundledSpriteSheetUrl(loadedDefinition.spriteSheetName),
      ].filter((candidate, index, self): candidate is string => Boolean(candidate) && self.indexOf(candidate) === index);

      const loadedTexture = await loadTextureByCandidates(textureCandidates);
      if (!loadedTexture || !active) {
        loadedTexture?.dispose();
        return;
      }

      const keyed = buildChromaKeyTexture(loadedTexture);
      const luminance = buildLuminanceTexture(keyed);
      const trackCount = Math.max(1, (loadedDefinition.spriteTracks ?? []).length);
      const perTrackTextures: THREE.Texture[] = [];
      const perTrackLuminanceTextures: THREE.Texture[] = [];
      for (let i = 0; i < trackCount; i += 1) {
        const texture = keyed.clone();
        const luminanceTexture = luminance.clone();
        configureTexture(texture);
        configureTexture(luminanceTexture);
        perTrackTextures.push(texture);
        perTrackLuminanceTextures.push(luminanceTexture);
      }

      createdTextures.push(...perTrackTextures, ...perTrackLuminanceTextures);
      keyed.dispose();
      luminance.dispose();
      loadedTexture.dispose();

      if (!active) {
        return;
      }

      setDefinition(loadedDefinition);
      setTrackTextures(perTrackTextures);
      setTrackLuminanceTextures(perTrackLuminanceTextures);
    };

    void loadExecutionAnimation();

    return () => {
      active = false;
      createdTextures.forEach((texture) => texture.dispose());
    };
  }, []);

  useFrame((state) => {
    const risingEdge = Boolean(isLevelingUp) && !wasLevelingUpRef.current;
    if (risingEdge) {
      startMsRef.current = state.clock.elapsedTime * 1000;
    }
    wasLevelingUpRef.current = Boolean(isLevelingUp);

    const startMs = startMsRef.current;
    if (!definition || enabledTracks.length === 0 || startMs == null) {
      spriteRefs.current.forEach((sprite) => {
        if (!sprite) return;
        (sprite.material as THREE.SpriteMaterial).opacity = 0;
      });
      return;
    }

    const elapsedMs = Math.max(0, (state.clock.elapsedTime * 1000) - startMs);
    let hasActiveTrack = false;
    const fallbackSheet = definition.sheetSize ?? { width: 1, height: 1 };

    enabledTracks.forEach((track, trackIndex) => {
      const sprite = spriteRefs.current[trackIndex];
      const texture = trackTextures[trackIndex];
      const luminanceTexture = trackLuminanceTextures[trackIndex];
      if (!sprite) return;
      const material = sprite.material as THREE.SpriteMaterial;

      if (!texture) {
        material.opacity = 0;
        return;
      }

      const snapshot = resolveTrackPlaybackSnapshot({
        track,
        elapsedMs,
        isPlaying: true,
      });

      if (snapshot.status !== 'finished') {
        hasActiveTrack = true;
      }

      if (snapshot.frameIndex < 0) {
        material.opacity = 0;
        return;
      }

      const rect = getTrackFrameRect(track, snapshot.frameIndex, fallbackSheet);
      if (!rect) {
        material.opacity = 0;
        return;
      }

      const aspect = rect.height > 0 ? rect.width / rect.height : 1;
      const baseSize: [number, number] = track.useOriginalFrameSize
        ? [
          Math.max(0.1, rect.width * (track.originalSizeScale ?? 0.01)),
          Math.max(0.1, rect.height * (track.originalSizeScale ?? 0.01)),
        ]
        : [
          track.size?.[0] ?? 1.2,
          track.size?.[1] ?? 1.2,
        ];
      const finalSize: [number, number] = (track.preserveFrameAspect ?? true)
        ? [baseSize[1] * aspect, baseSize[1]]
        : baseSize;

      const anchorBase: [number, number, number] = [0, 1.1 + getAnchorY(track.anchorPoint), 0];
      const offset = track.offset3d ?? [0, 0, 0];
      sprite.position.set(anchorBase[0] + offset[0], anchorBase[1] + offset[1], anchorBase[2] + offset[2]);
      sprite.scale.set(finalSize[0], finalSize[1], 1);
      sprite.renderOrder = (track.renderPriority ?? 0) + 12;

      const tintColor = track.tintColor ?? '#ffffff';
      const selectedTexture = shouldUseLuminanceTint(tintColor) ? (luminanceTexture ?? texture) : texture;
      selectedTexture.repeat.set(rect.width / rect.sheet.width, rect.height / rect.sheet.height);
      selectedTexture.offset.set(rect.x / rect.sheet.width, 1 - ((rect.y + rect.height) / rect.sheet.height));
      selectedTexture.needsUpdate = true;
      material.map = selectedTexture;
      material.rotation = THREE.MathUtils.degToRad(track.rotationDeg ?? 0);
      material.color.set(tintColor);
      material.opacity = Math.max(0, Math.min(1, track.opacity ?? 1));
      material.alphaTest = 0.02;
      material.depthTest = track.depthTest ?? true;
      material.depthWrite = track.depthWrite ?? false;
      material.blending = track.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
    });

    for (let index = enabledTracks.length; index < spriteRefs.current.length; index += 1) {
      const sprite = spriteRefs.current[index];
      if (!sprite) continue;
      (sprite.material as THREE.SpriteMaterial).opacity = 0;
    }

    if (!hasActiveTrack && !isLevelingUp) {
      startMsRef.current = null;
    }
  });

  if (enabledTracks.length === 0) {
    return null;
  }

  return (
    <group>
      {enabledTracks.map((track, trackIndex) => (
        <sprite key={track.id ?? `level_up_track_${trackIndex}`} ref={(element) => { spriteRefs.current[trackIndex] = element; }} renderOrder={12}>
          <spriteMaterial
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={track.depthTest ?? true}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
};

const resolveSpriteAssetUrl = (input?: string): string | null => {
  if (!input) return null;
  if (/^(https?:|data:|blob:|\/)/i.test(input)) return input;
  return new URL(`../${input.replace(/^\.?\//, '')}`, import.meta.url).href;
};

const resolveBundledSpriteSheetUrl = (input?: string | null) => {
  const base = getPathBasename(input)?.toLowerCase();
  if (!base) return null;
  const match = Object.entries(GENERATED_SPRITE_SHEET_URL_MODULES)
    .find(([modulePath]) => modulePath.toLowerCase().endsWith(`/${base}`));
  return match?.[1] ?? null;
};

const resolveBundledAnimationDefinitionByPath = (input?: string | null): SpriteOverlayAnimationDefinition | null => {
  const base = getPathBasename(input)?.toLowerCase();
  if (!base) return null;
  const match = Object.entries(GENERATED_ANIMATION_JSON_MODULES)
    .find(([modulePath]) => modulePath.toLowerCase().endsWith(`/${base}`));
  if (!match) return null;
  const loaded = match[1] as { default?: unknown } | SpriteOverlayAnimationDefinition;
  const json = (typeof loaded === 'object' && loaded && 'default' in loaded)
    ? (loaded as { default: SpriteOverlayAnimationDefinition }).default
    : loaded as SpriteOverlayAnimationDefinition;
  return json ?? null;
};

const buildChromaKeyTexture = (sourceTexture: THREE.Texture): THREE.Texture => {
  const sourceImage = sourceTexture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | null
    | undefined;
  if (!sourceImage || typeof document === 'undefined') {
    return sourceTexture.clone();
  }

  const width = (sourceImage as HTMLImageElement).naturalWidth
    || (sourceImage as HTMLCanvasElement).width
    || (sourceImage as ImageBitmap).width
    || 0;
  const height = (sourceImage as HTMLImageElement).naturalHeight
    || (sourceImage as HTMLCanvasElement).height
    || (sourceImage as ImageBitmap).height
    || 0;
  if (width <= 0 || height <= 0) {
    return sourceTexture.clone();
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceTexture.clone();
  }

  context.drawImage(sourceImage as CanvasImageSource, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const samplePixel = (x: number, y: number) => {
    const ix = Math.max(0, Math.min(width - 1, x));
    const iy = Math.max(0, Math.min(height - 1, y));
    const index = ((iy * width) + ix) * 4;
    return {
      r: pixels[index],
      g: pixels[index + 1],
      b: pixels[index + 2],
    };
  };

  const topLeft = samplePixel(0, 0);
  const topRight = samplePixel(width - 1, 0);
  const bottomLeft = samplePixel(0, height - 1);
  const bg = {
    r: Math.round((topLeft.r + topRight.r + bottomLeft.r) / 3),
    g: Math.round((topLeft.g + topRight.g + bottomLeft.g) / 3),
    b: Math.round((topLeft.b + topRight.b + bottomLeft.b) / 3),
  };

  const hardThreshold = 26;
  const softThreshold = 62;
  for (let index = 0; index < pixels.length; index += 4) {
    const dr = pixels[index] - bg.r;
    const dg = pixels[index + 1] - bg.g;
    const db = pixels[index + 2] - bg.b;
    const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
    if (distance <= hardThreshold) {
      pixels[index + 3] = 0;
    } else if (distance < softThreshold) {
      const alphaFactor = (distance - hardThreshold) / (softThreshold - hardThreshold);
      pixels[index + 3] = Math.min(pixels[index + 3], Math.round(255 * alphaFactor));
    }
  }

  context.putImageData(imageData, 0, 0);
  const keyedTexture = new THREE.CanvasTexture(canvas);
  keyedTexture.colorSpace = sourceTexture.colorSpace;
  keyedTexture.needsUpdate = true;
  return keyedTexture;
};

const buildLuminanceTexture = (sourceTexture: THREE.Texture): THREE.Texture => {
  const sourceImage = sourceTexture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | null
    | undefined;
  if (!sourceImage || typeof document === 'undefined') {
    return sourceTexture.clone();
  }

  const width = (sourceImage as HTMLImageElement).naturalWidth
    || (sourceImage as HTMLCanvasElement).width
    || (sourceImage as ImageBitmap).width
    || 0;
  const height = (sourceImage as HTMLImageElement).naturalHeight
    || (sourceImage as HTMLCanvasElement).height
    || (sourceImage as ImageBitmap).height
    || 0;
  if (width <= 0 || height <= 0) {
    return sourceTexture.clone();
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceTexture.clone();
  }

  context.drawImage(sourceImage as CanvasImageSource, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const luminance = Math.round((0.2126 * r) + (0.7152 * g) + (0.0722 * b));
    pixels[index] = luminance;
    pixels[index + 1] = luminance;
    pixels[index + 2] = luminance;
  }
  context.putImageData(imageData, 0, 0);

  const grayscaleTexture = new THREE.CanvasTexture(canvas);
  grayscaleTexture.colorSpace = sourceTexture.colorSpace;
  grayscaleTexture.needsUpdate = true;
  return grayscaleTexture;
};

const shouldUseLuminanceTint = (tintColor?: string) => (
  (tintColor ?? '#ffffff').toLowerCase() !== '#ffffff'
);

const isUnarmedAttackStyle = (attackStyle?: 'armed' | 'unarmed') => attackStyle !== 'armed';
const MAX_SPRITE_ANIMATION_TRACKS = 8;
const getImpulseAuraColor = (level: number) => (
  level >= 3 ? '#3b82f6' : level === 2 ? '#a855f7' : '#ef4444'
);
const BOW_PROJECTILE_MODEL_URL = new URL('../game/assets/Characters/Weapons/another/arrow_A.fbx', import.meta.url).href;
const BOW_PROJECTILE_TEXTURE_URL = new URL('../game/assets/Characters/Weapons/another/weapons_bits_texture.png', import.meta.url).href;
const BOW_PROJECTILE_FLIGHT_MS = 220;
const BOW_PROJECTILE_STICK_MS = 1000;
const BOW_PROJECTILE_FADE_MS = 280;
const BOW_PROJECTILE_BASE_SCALE = 2.5;

const resolveImpactAnimationForWeapon = (weaponId?: string): { animationId: string; tintColor: string | null } => {
  if (!weaponId) {
    return {
      animationId: COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId,
      tintColor: null,
    };
  }

  const weapon3d = getRegisteredWeapon3DByItemId(weaponId);
  return {
    animationId: weapon3d?.item.animacaoImpacto ?? COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId,
    tintColor: weapon3d?.item.animacaoImpactoCor ?? null,
  };
};

const getTrackFrameRect = (track: SpriteTrackDefinition, frameIndex: number, fallbackSheet: { width: number; height: number }) => {
  const rows = Math.max(1, track.spriteRows ?? 1);
  const cols = Math.max(1, track.spriteCols ?? 1);
  const sheet = track.spriteSheetSize ?? fallbackSheet;
  if (frameIndex < 0 || frameIndex >= rows * cols || sheet.width <= 0 || sheet.height <= 0) return null;
  const frameWidth = sheet.width / cols;
  const frameHeight = sheet.height / rows;
  const row = Math.floor(frameIndex / cols);
  const col = frameIndex % cols;
  const sourceRow = (track.invertRows ?? false) ? (rows - 1 - row) : row;
  return {
    sheet,
    width: frameWidth,
    height: frameHeight,
    x: col * frameWidth,
    y: sourceRow * frameHeight,
  };
};

const getAnchorY = (point?: SpriteTrackDefinition['anchorPoint']) => (
  point === 'head' ? 0.95 : point === 'chest' ? 0.45 : point === 'feet' ? -0.8 : 0
);

interface BowProjectileState {
  startedAtMs: number;
  didHit: boolean;
  direction: 1 | -1;
  start: THREE.Vector3;
  hitPoint: THREE.Vector3;
  hitOffsetFromTarget: THREE.Vector3;
  hitTargetSide: 'player' | 'enemy';
  hitDirection: THREE.Vector3;
  missPoint: THREE.Vector3;
  missFadePoint: THREE.Vector3;
}

const CombatCinematicFX = ({
  playerAnimationAction,
  enemyAnimationAction,
  playerExecutionAnimationId,
  enemyExecutionAnimationId,
  playerExecutionAnimationTintColor,
  enemyExecutionAnimationTintColor,
  playerImpactAnimationId,
  enemyImpactAnimationId,
  playerImpactAnimationTintColor,
  enemyImpactAnimationTintColor,
  playerImpactAnimationTarget,
  enemyImpactAnimationTarget,
  playerImpactAnimationTrigger,
  enemyImpactAnimationTrigger,
  playerBowShotTrigger,
  enemyBowShotTrigger,
  playerBowShotDidHit,
  enemyBowShotDidHit,
  isPlayerAttacking,
  isEnemyAttacking,
  isEnemyHit,
  isPlayerHit,
  equippedWeaponId,
  enemyAttackStyle,
  latestEnemyImpactColor,
  activeImpulseLevel,
  enemyImpulseLevel,
  particleLoad,
}: {
  playerAnimationAction?: PlayerAnimationAction;
  enemyAnimationAction?: PlayerAnimationAction;
  playerExecutionAnimationId?: string | null;
  enemyExecutionAnimationId?: string | null;
  playerExecutionAnimationTintColor?: string | null;
  enemyExecutionAnimationTintColor?: string | null;
  playerImpactAnimationId?: string | null;
  enemyImpactAnimationId?: string | null;
  playerImpactAnimationTintColor?: string | null;
  enemyImpactAnimationTintColor?: string | null;
  playerImpactAnimationTarget?: 'self' | 'target';
  enemyImpactAnimationTarget?: 'self' | 'target';
  playerImpactAnimationTrigger?: number;
  enemyImpactAnimationTrigger?: number;
  playerBowShotTrigger?: number;
  enemyBowShotTrigger?: number;
  playerBowShotDidHit?: boolean;
  enemyBowShotDidHit?: boolean;
  isPlayerAttacking?: boolean;
  isEnemyAttacking?: boolean;
  isEnemyHit?: boolean;
  isPlayerHit?: boolean;
  equippedWeaponId?: string;
  enemyAttackStyle?: 'armed' | 'unarmed';
  latestEnemyImpactColor?: string;
  activeImpulseLevel?: number;
  enemyImpulseLevel?: number;
  particleLoad: number;
}) => {
  const playerRefs = useRef<(THREE.Sprite | null)[]>([]);
  const enemyRefs = useRef<(THREE.Sprite | null)[]>([]);
  const playerCastAuraRef = useRef<THREE.Sprite>(null);
  const playerCastCoreRef = useRef<THREE.Sprite>(null);
  const enemyCastAuraRef = useRef<THREE.Sprite>(null);
  const enemyCastCoreRef = useRef<THREE.Sprite>(null);
  const hitBurstEnemyRef = useRef<THREE.Sprite>(null);
  const hitBurstPlayerRef = useRef<THREE.Sprite>(null);
  const unarmedHitEnemyRefs = useRef<(THREE.Sprite | null)[]>([]);
  const unarmedHitPlayerRefs = useRef<(THREE.Sprite | null)[]>([]);
  const executionEnemyRefs = useRef<(THREE.Sprite | null)[]>([]);
  const executionPlayerRefs = useRef<(THREE.Sprite | null)[]>([]);
  const impulseAuraEnemyRefs = useRef<(THREE.Sprite | null)[]>([]);
  const impulseAuraPlayerRefs = useRef<(THREE.Sprite | null)[]>([]);
  const unarmedHitEnemyStartMsRef = useRef<number | null>(null);
  const unarmedHitPlayerStartMsRef = useRef<number | null>(null);
  const enemyExecutionStartMsRef = useRef<number | null>(null);
  const playerExecutionStartMsRef = useRef<number | null>(null);
  const enemyImpulseAuraStartMsRef = useRef<number | null>(null);
  const playerImpulseAuraStartMsRef = useRef<number | null>(null);
  const enemyHitAnimationIdRef = useRef<string | null>(null);
  const playerHitAnimationIdRef = useRef<string | null>(null);
  const enemyExecutionAnimationIdRef = useRef<string | null>(null);
  const playerExecutionAnimationIdRef = useRef<string | null>(null);
  const enemyHitTintColorRef = useRef<string | null>(null);
  const playerHitTintColorRef = useRef<string | null>(null);
  const enemyExecutionTintColorRef = useRef<string | null>(null);
  const playerExecutionTintColorRef = useRef<string | null>(null);
  const enemyImpulseAuraTintColorRef = useRef<string | null>(null);
  const playerImpulseAuraTintColorRef = useRef<string | null>(null);
  const processedPlayerImpactTriggerRef = useRef<number>(-1);
  const processedEnemyImpactTriggerRef = useRef<number>(-1);
  const playerAnchorXRef = useRef(-2);
  const enemyAnchorXRef = useRef(2);
  const playerAnchorYRef = useRef(-1);
  const enemyAnchorYRef = useRef(-1);
  const hitEnemyLightRef = useRef<THREE.PointLight>(null);
  const impulseEnemyLightRef = useRef<THREE.PointLight>(null);
  const impulsePlayerLightRef = useRef<THREE.PointLight>(null);
  const impulseChargePlayerLightRef = useRef<THREE.PointLight>(null);
  const lastSeenPlayerAbsorbedImpulseLevelRef = useRef(0);
  const lastSeenEnemyAbsorbedImpulseLevelRef = useRef(0);
  const lastSeenPlayerAbsorbedImpulseMsRef = useRef(0);
  const lastSeenEnemyAbsorbedImpulseMsRef = useRef(0);
  const playerActionImpulseHoldLevelRef = useRef(0);
  const enemyActionImpulseHoldLevelRef = useRef(0);
  const wasPlayerImpulseActionActiveRef = useRef(false);
  const wasEnemyImpulseActionActiveRef = useRef(false);
  const hitEnemyPulseRef = useRef(0);
  const hitPlayerPulseRef = useRef(0);
  const wasEnemyHitRef = useRef(false);
  const wasPlayerHitRef = useRef(false);
  const hadSkillFxRef = useRef(false);
  const wasPlayerExecutionActionRef = useRef(false);
  const wasEnemyExecutionActionRef = useRef(false);
  const [hitDefinitionsById, setHitDefinitionsById] = useState<Record<string, SpriteOverlayAnimationDefinition>>({});
  const [hitEnemyTexturesById, setHitEnemyTexturesById] = useState<Record<string, THREE.Texture>>({});
  const [hitPlayerTexturesById, setHitPlayerTexturesById] = useState<Record<string, THREE.Texture>>({});
  const [hitEnemyLuminanceTexturesById, setHitEnemyLuminanceTexturesById] = useState<Record<string, THREE.Texture>>({});
  const [hitPlayerLuminanceTexturesById, setHitPlayerLuminanceTexturesById] = useState<Record<string, THREE.Texture>>({});
  const [hitEnemyTrackTexturesById, setHitEnemyTrackTexturesById] = useState<Record<string, Array<THREE.Texture | null>>>({});
  const [hitPlayerTrackTexturesById, setHitPlayerTrackTexturesById] = useState<Record<string, Array<THREE.Texture | null>>>({});
  const [hitEnemyTrackLuminanceTexturesById, setHitEnemyTrackLuminanceTexturesById] = useState<Record<string, Array<THREE.Texture | null>>>({});
  const [hitPlayerTrackLuminanceTexturesById, setHitPlayerTrackLuminanceTexturesById] = useState<Record<string, Array<THREE.Texture | null>>>({});
  const defaultUnarmedHitEnemyTexture = hitEnemyTexturesById[COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId] ?? null;
  const defaultUnarmedHitPlayerTexture = hitPlayerTexturesById[COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId] ?? null;
  const defaultExecutionEnemyTexture = hitEnemyTexturesById[COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId] ?? null;
  const defaultExecutionPlayerTexture = hitPlayerTexturesById[COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId] ?? null;
  const playerBowProjectileRef = useRef<THREE.Group>(null);
  const enemyBowProjectileRef = useRef<THREE.Group>(null);
  const playerBowProjectileStateRef = useRef<BowProjectileState | null>(null);
  const enemyBowProjectileStateRef = useRef<BowProjectileState | null>(null);
  const processedPlayerBowShotTriggerRef = useRef<number>(-1);
  const processedEnemyBowShotTriggerRef = useRef<number>(-1);
  const bowProjectileModelSource = useFBX(BOW_PROJECTILE_MODEL_URL);
  const bowProjectileTexture = useTexture(BOW_PROJECTILE_TEXTURE_URL);
  const createBowProjectileMesh = useCallback(() => {
    const projectileClone = bowProjectileModelSource.clone(true);
    bowProjectileTexture.colorSpace = THREE.SRGBColorSpace;
    bowProjectileTexture.needsUpdate = true;

    projectileClone.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      const remapMaterial = (material: THREE.Material) => {
        const standardMaterial = material as THREE.MeshStandardMaterial;
        const nextMaterial = standardMaterial.clone();
        nextMaterial.map = bowProjectileTexture;
        nextMaterial.transparent = true;
        nextMaterial.opacity = 1;
        nextMaterial.needsUpdate = true;
        return nextMaterial;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((entry) => remapMaterial(entry as THREE.Material));
      } else if (mesh.material) {
        mesh.material = remapMaterial(mesh.material as THREE.Material);
      }
    });

    const bounds = new THREE.Box3().setFromObject(projectileClone);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 0) {
      projectileClone.scale.setScalar(1 / maxDimension);
    }

    return projectileClone;
  }, [bowProjectileModelSource, bowProjectileTexture]);
  const playerBowProjectileModel = useMemo(() => createBowProjectileMesh(), [createBowProjectileMesh]);
  const enemyBowProjectileModel = useMemo(() => createBowProjectileMesh(), [createBowProjectileMesh]);

  useEffect(() => {
    let active = true;
    const createdTextures: THREE.Texture[] = [];
    const textureLoader = new THREE.TextureLoader();

    const configureTexture = (nextTexture: THREE.Texture) => {
      nextTexture.flipY = false;
      nextTexture.wrapS = THREE.ClampToEdgeWrapping;
      nextTexture.wrapT = THREE.ClampToEdgeWrapping;
      nextTexture.minFilter = THREE.LinearMipmapLinearFilter;
      nextTexture.magFilter = THREE.LinearFilter;
      nextTexture.generateMipmaps = true;
      nextTexture.needsUpdate = true;
    };

    const loadTextureByCandidates = async (candidates: string[]): Promise<THREE.Texture | null> => {
      for (const candidate of candidates) {
        try {
          const loaded = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(candidate, resolve, undefined, reject);
          });
          return loaded;
        } catch {
          // try next candidate
        }
      }
      return null;
    };

    const loadDefinitionByRegistryPath = async (path: string): Promise<SpriteOverlayAnimationDefinition | null> => {
      const bundled = resolveBundledAnimationDefinitionByPath(path);
      if (bundled) {
        return bundled;
      }

      const url = resolveSpriteAssetUrl(path);
      if (!url) {
        return null;
      }

      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json() as SpriteOverlayAnimationDefinition;
      } catch {
        return null;
      }
    };

    const loadAllHitAnimations = async () => {
      const nextDefinitions: Record<string, SpriteOverlayAnimationDefinition> = {};
      const nextEnemyTextures: Record<string, THREE.Texture> = {};
      const nextPlayerTextures: Record<string, THREE.Texture> = {};
      const nextEnemyLuminanceTextures: Record<string, THREE.Texture> = {};
      const nextPlayerLuminanceTextures: Record<string, THREE.Texture> = {};
      const nextEnemyTrackTextures: Record<string, Array<THREE.Texture | null>> = {};
      const nextPlayerTrackTextures: Record<string, Array<THREE.Texture | null>> = {};
      const nextEnemyTrackLuminanceTextures: Record<string, Array<THREE.Texture | null>> = {};
      const nextPlayerTrackLuminanceTextures: Record<string, Array<THREE.Texture | null>> = {};
      const textureSetByRef = new Map<string, {
        enemyTex: THREE.Texture;
        playerTex: THREE.Texture;
        enemyLuminanceTex: THREE.Texture;
        playerLuminanceTex: THREE.Texture;
      }>();

      const loadTextureSetForRef = async (spriteSheetRef?: string | null, fallbackSheetName?: string | null) => {
        const refKey = spriteSheetRef ?? fallbackSheetName ?? '';
        if (textureSetByRef.has(refKey)) {
          return textureSetByRef.get(refKey) ?? null;
        }

        const textureCandidates = [
          resolveSpriteAssetUrl(spriteSheetRef),
          resolveBundledSpriteSheetUrl(spriteSheetRef),
          resolveBundledSpriteSheetUrl(fallbackSheetName),
        ].filter((candidate, index, self): candidate is string => Boolean(candidate) && self.indexOf(candidate) === index);

        const loadedTexture = await loadTextureByCandidates(textureCandidates);
        if (!loadedTexture) {
          return null;
        }
        if (!active) {
          loadedTexture.dispose();
          return null;
        }

        const keyed = buildChromaKeyTexture(loadedTexture);
        const luminance = buildLuminanceTexture(keyed);
        const enemyTex = keyed.clone();
        const playerTex = keyed.clone();
        const enemyLuminanceTex = luminance.clone();
        const playerLuminanceTex = luminance.clone();
        configureTexture(enemyTex);
        configureTexture(playerTex);
        configureTexture(enemyLuminanceTex);
        configureTexture(playerLuminanceTex);
        createdTextures.push(enemyTex, playerTex, enemyLuminanceTex, playerLuminanceTex);
        keyed.dispose();
        luminance.dispose();
        loadedTexture.dispose();

        const textureSet = { enemyTex, playerTex, enemyLuminanceTex, playerLuminanceTex };
        textureSetByRef.set(refKey, textureSet);
        return textureSet;
      };

      for (const entry of SPRITE_ANIMATION_REGISTRY) {
        const definition = await loadDefinitionByRegistryPath(entry.arquivo);
        if (!definition) continue;
        nextDefinitions[entry.id] = definition;

        const enabledTracks = definition.spriteTracks?.filter((track) => track.enabled !== false)
          ?? [];
        const firstTrack = enabledTracks[0] ?? definition.spriteTracks?.[0];
        const firstTrackRef = firstTrack?.spriteSheetPath
          ?? firstTrack?.spriteSheetUrl
          ?? firstTrack?.spriteSheetName
          ?? definition.spriteSheetUrl
          ?? definition.spriteSheetName;
        const baseTextureSet = await loadTextureSetForRef(firstTrackRef, definition.spriteSheetName);
        if (!baseTextureSet) continue;

        nextEnemyTextures[entry.id] = baseTextureSet.enemyTex;
        nextPlayerTextures[entry.id] = baseTextureSet.playerTex;
        nextEnemyLuminanceTextures[entry.id] = baseTextureSet.enemyLuminanceTex;
        nextPlayerLuminanceTextures[entry.id] = baseTextureSet.playerLuminanceTex;

        const perTrackEnemyTextures: Array<THREE.Texture | null> = [];
        const perTrackPlayerTextures: Array<THREE.Texture | null> = [];
        const perTrackEnemyLuminanceTextures: Array<THREE.Texture | null> = [];
        const perTrackPlayerLuminanceTextures: Array<THREE.Texture | null> = [];

        for (const track of enabledTracks) {
          const trackRef = track.spriteSheetPath
            ?? track.spriteSheetUrl
            ?? track.spriteSheetName
            ?? definition.spriteSheetUrl
            ?? definition.spriteSheetName;
          const trackTextureSet = await loadTextureSetForRef(trackRef, definition.spriteSheetName);
          const resolvedTrackTextureSet = trackTextureSet ?? baseTextureSet;
          perTrackEnemyTextures.push(resolvedTrackTextureSet.enemyTex);
          perTrackPlayerTextures.push(resolvedTrackTextureSet.playerTex);
          perTrackEnemyLuminanceTextures.push(resolvedTrackTextureSet.enemyLuminanceTex);
          perTrackPlayerLuminanceTextures.push(resolvedTrackTextureSet.playerLuminanceTex);
        }

        nextEnemyTrackTextures[entry.id] = perTrackEnemyTextures;
        nextPlayerTrackTextures[entry.id] = perTrackPlayerTextures;
        nextEnemyTrackLuminanceTextures[entry.id] = perTrackEnemyLuminanceTextures;
        nextPlayerTrackLuminanceTextures[entry.id] = perTrackPlayerLuminanceTextures;
      }

      if (!active) return;
      setHitDefinitionsById(nextDefinitions);
      setHitEnemyTexturesById(nextEnemyTextures);
      setHitPlayerTexturesById(nextPlayerTextures);
      setHitEnemyLuminanceTexturesById(nextEnemyLuminanceTextures);
      setHitPlayerLuminanceTexturesById(nextPlayerLuminanceTextures);
      setHitEnemyTrackTexturesById(nextEnemyTrackTextures);
      setHitPlayerTrackTexturesById(nextPlayerTrackTextures);
      setHitEnemyTrackLuminanceTexturesById(nextEnemyTrackLuminanceTextures);
      setHitPlayerTrackLuminanceTexturesById(nextPlayerTrackLuminanceTextures);
    };

    void loadAllHitAnimations();

    return () => {
      active = false;
      const disposeSpriteMaps = (sprites: (THREE.Sprite | null)[]) => {
        sprites.forEach((sprite) => {
          const material = sprite?.material as THREE.SpriteMaterial | undefined;
          if (!material?.map) return;
          material.map.dispose();
          material.map = null;
        });
      };
      disposeSpriteMaps(unarmedHitEnemyRefs.current);
      disposeSpriteMaps(unarmedHitPlayerRefs.current);
      disposeSpriteMaps(executionEnemyRefs.current);
      disposeSpriteMaps(executionPlayerRefs.current);
      disposeSpriteMaps(impulseAuraEnemyRefs.current);
      disposeSpriteMaps(impulseAuraPlayerRefs.current);
      createdTextures.forEach((texture) => texture.dispose());
    };
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const playerSkillActive = false;
    const enemySkillActive = false;
    const hasSkillFx = false;
    const loadScale = particleLoad > 84 ? 0.65 : particleLoad > 64 ? 0.82 : 1;
    const activeTrailCount = Math.max(8, Math.floor(COMBAT_TRAIL_SEEDS.length * loadScale));

    if (hasSkillFx) {
      COMBAT_TRAIL_SEEDS.forEach((seed, i) => {
        const playerSprite = playerRefs.current[i];
        if (playerSprite) {
          if (i >= activeTrailCount) {
            (playerSprite.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((playerSprite.material as THREE.SpriteMaterial).opacity, 0, 0.3);
          } else if (playerSkillActive) {
            const travel = (seed.phase + t * (0.65 + seed.speed * 0.2)) % 1;
            const x = THREE.MathUtils.lerp(-1.82, 1.9, travel);
            const arc = Math.sin(travel * Math.PI) * 0.38;
            playerSprite.position.set(
              x,
              0.64 + arc + seed.yOffset,
              seed.zOffset,
            );
            playerSprite.scale.set(seed.size * 2.3, seed.size, 1);
            (playerSprite.material as THREE.SpriteMaterial).opacity = 0.2 + (Math.sin((travel * Math.PI * 2) + t * 2.4) * 0.16 + 0.18);
          } else {
            (playerSprite.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((playerSprite.material as THREE.SpriteMaterial).opacity, 0, 0.16);
          }
        }

        const enemySprite = enemyRefs.current[i];
        if (enemySprite) {
          if (i >= activeTrailCount) {
            (enemySprite.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((enemySprite.material as THREE.SpriteMaterial).opacity, 0, 0.3);
          } else if (enemySkillActive) {
            const travel = (seed.phase + t * (0.62 + seed.speed * 0.18)) % 1;
            const x = THREE.MathUtils.lerp(1.82, -1.9, travel);
            const arc = Math.sin(travel * Math.PI) * 0.28;
            enemySprite.position.set(
              x,
              0.55 + arc + seed.yOffset * 0.75,
              seed.zOffset,
            );
            enemySprite.scale.set(seed.size * 2.1, seed.size * 0.9, 1);
            (enemySprite.material as THREE.SpriteMaterial).opacity = 0.14 + (Math.sin((travel * Math.PI * 2) + t * 2.1) * 0.12 + 0.14);
          } else {
            (enemySprite.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((enemySprite.material as THREE.SpriteMaterial).opacity, 0, 0.16);
          }
        }
      });
      hadSkillFxRef.current = true;
    } else if (hadSkillFxRef.current) {
      for (let i = 0; i < COMBAT_TRAIL_SEEDS.length; i += 1) {
        const playerSprite = playerRefs.current[i];
        if (playerSprite) {
          (playerSprite.material as THREE.SpriteMaterial).opacity = 0;
        }
        const enemySprite = enemyRefs.current[i];
        if (enemySprite) {
          (enemySprite.material as THREE.SpriteMaterial).opacity = 0;
        }
      }
      hadSkillFxRef.current = false;
    }

    if (playerCastAuraRef.current && playerCastCoreRef.current) {
      if (playerSkillActive) {
        const pulse = 0.55 + Math.sin(t * 11.5) * 0.12;
        playerCastAuraRef.current.position.set(-1.8, 0.58, 0.06);
        playerCastAuraRef.current.scale.set(1.5 + pulse * 0.55, 0.82 + pulse * 0.2, 1);
        (playerCastAuraRef.current.material as THREE.SpriteMaterial).opacity = 0.18 + pulse * 0.13;
        playerCastCoreRef.current.position.set(-1.8, 0.58, 0.07);
        playerCastCoreRef.current.scale.setScalar(0.42 + pulse * 0.22);
        (playerCastCoreRef.current.material as THREE.SpriteMaterial).opacity = 0.2 + pulse * 0.2;
      } else {
        (playerCastAuraRef.current.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((playerCastAuraRef.current.material as THREE.SpriteMaterial).opacity, 0, 0.2);
        (playerCastCoreRef.current.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((playerCastCoreRef.current.material as THREE.SpriteMaterial).opacity, 0, 0.2);
      }
    }

    if (enemyCastAuraRef.current && enemyCastCoreRef.current) {
      if (enemySkillActive) {
        const pulse = 0.52 + Math.sin((t * 10.2) + 0.8) * 0.1;
        enemyCastAuraRef.current.position.set(1.8, 0.58, 0.06);
        enemyCastAuraRef.current.scale.set(1.45 + pulse * 0.5, 0.78 + pulse * 0.18, 1);
        (enemyCastAuraRef.current.material as THREE.SpriteMaterial).opacity = 0.16 + pulse * 0.12;
        enemyCastCoreRef.current.position.set(1.8, 0.58, 0.07);
        enemyCastCoreRef.current.scale.setScalar(0.38 + pulse * 0.2);
        (enemyCastCoreRef.current.material as THREE.SpriteMaterial).opacity = 0.18 + pulse * 0.18;
      } else {
        (enemyCastAuraRef.current.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((enemyCastAuraRef.current.material as THREE.SpriteMaterial).opacity, 0, 0.2);
        (enemyCastCoreRef.current.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((enemyCastCoreRef.current.material as THREE.SpriteMaterial).opacity, 0, 0.2);
      }
    }

    if (isEnemyHit && !wasEnemyHitRef.current) {
      hitEnemyPulseRef.current = 1;
      const impactFromWeapon = resolveImpactAnimationForWeapon(equippedWeaponId);
      enemyHitAnimationIdRef.current = playerImpactAnimationId ?? impactFromWeapon.animationId;
      enemyHitTintColorRef.current = playerImpactAnimationTintColor ?? impactFromWeapon.tintColor;
      unarmedHitEnemyStartMsRef.current = state.clock.elapsedTime * 1000;
    }
    if (isPlayerHit && !wasPlayerHitRef.current) {
      hitPlayerPulseRef.current = 1;
      playerHitAnimationIdRef.current = enemyImpactAnimationId ?? (
        isUnarmedAttackStyle(enemyAttackStyle)
          ? COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId
          : COMBAT_SPRITE_ANIMATION_DEFAULTS.armedImpactAnimationId
      );
      playerHitTintColorRef.current = enemyImpactAnimationTintColor ?? null;
      unarmedHitPlayerStartMsRef.current = state.clock.elapsedTime * 1000;
    }
    wasEnemyHitRef.current = Boolean(isEnemyHit);
    wasPlayerHitRef.current = Boolean(isPlayerHit);

    const normalizedPlayerImpulseLevel = Math.max(0, Math.min(3, Math.floor(activeImpulseLevel ?? 0)));
    const normalizedEnemyImpulseLevel = Math.max(0, Math.min(3, Math.floor(enemyImpulseLevel ?? 0)));
    const nowMs = state.clock.elapsedTime * 1000;
    if (normalizedPlayerImpulseLevel > 0) {
      lastSeenPlayerAbsorbedImpulseLevelRef.current = normalizedPlayerImpulseLevel;
      lastSeenPlayerAbsorbedImpulseMsRef.current = nowMs;
    }
    if (normalizedEnemyImpulseLevel > 0) {
      lastSeenEnemyAbsorbedImpulseLevelRef.current = normalizedEnemyImpulseLevel;
      lastSeenEnemyAbsorbedImpulseMsRef.current = nowMs;
    }

    const playerImpulseActionActive = (
      playerAnimationAction === 'attack'
      || playerAnimationAction === 'defend'
      || playerAnimationAction === 'skill'
      || playerAnimationAction === 'heal'
    );
    const enemyImpulseActionActive = (
      enemyAnimationAction === 'attack'
      || enemyAnimationAction === 'defend'
      || enemyAnimationAction === 'skill'
      || enemyAnimationAction === 'heal'
    );

    if (playerImpulseActionActive && !wasPlayerImpulseActionActiveRef.current) {
      let holdLevel = normalizedPlayerImpulseLevel;
      if (holdLevel <= 0 && (nowMs - lastSeenPlayerAbsorbedImpulseMsRef.current) <= 1800) {
        holdLevel = lastSeenPlayerAbsorbedImpulseLevelRef.current;
      }
      playerActionImpulseHoldLevelRef.current = holdLevel;
    }
    if (!playerImpulseActionActive && wasPlayerImpulseActionActiveRef.current) {
      playerActionImpulseHoldLevelRef.current = 0;
    }
    wasPlayerImpulseActionActiveRef.current = playerImpulseActionActive;

    if (enemyImpulseActionActive && !wasEnemyImpulseActionActiveRef.current) {
      let holdLevel = normalizedEnemyImpulseLevel;
      if (holdLevel <= 0 && (nowMs - lastSeenEnemyAbsorbedImpulseMsRef.current) <= 1800) {
        holdLevel = lastSeenEnemyAbsorbedImpulseLevelRef.current;
      }
      enemyActionImpulseHoldLevelRef.current = holdLevel;
    }
    if (!enemyImpulseActionActive && wasEnemyImpulseActionActiveRef.current) {
      enemyActionImpulseHoldLevelRef.current = 0;
    }
    wasEnemyImpulseActionActiveRef.current = enemyImpulseActionActive;

    const effectivePlayerImpulseLightLevel = playerImpulseActionActive
      ? Math.max(normalizedPlayerImpulseLevel, playerActionImpulseHoldLevelRef.current)
      : normalizedPlayerImpulseLevel;
    const effectiveEnemyImpulseLightLevel = enemyImpulseActionActive
      ? Math.max(normalizedEnemyImpulseLevel, enemyActionImpulseHoldLevelRef.current)
      : normalizedEnemyImpulseLevel;
    const playerImpulseColor = getImpulseAuraColor(effectivePlayerImpulseLightLevel);
    const enemyImpulseColor = getImpulseAuraColor(effectiveEnemyImpulseLightLevel);

    if (normalizedPlayerImpulseLevel > 0) {
      if (playerImpulseAuraStartMsRef.current == null) {
        playerImpulseAuraStartMsRef.current = state.clock.elapsedTime * 1000;
      }
      playerImpulseAuraTintColorRef.current = playerImpulseColor;
    } else {
      playerImpulseAuraStartMsRef.current = null;
      playerImpulseAuraTintColorRef.current = null;
    }

    if (normalizedEnemyImpulseLevel > 0) {
      if (enemyImpulseAuraStartMsRef.current == null) {
        enemyImpulseAuraStartMsRef.current = state.clock.elapsedTime * 1000;
      }
      enemyImpulseAuraTintColorRef.current = enemyImpulseColor;
    } else {
      enemyImpulseAuraStartMsRef.current = null;
      enemyImpulseAuraTintColorRef.current = null;
    }

    if (
      typeof playerImpactAnimationTrigger === 'number'
      && playerImpactAnimationTrigger !== processedPlayerImpactTriggerRef.current
      && playerImpactAnimationId
      && !isEnemyHit
    ) {
      processedPlayerImpactTriggerRef.current = playerImpactAnimationTrigger;
      if (playerImpactAnimationTarget === 'self') {
        playerHitAnimationIdRef.current = playerImpactAnimationId;
        playerHitTintColorRef.current = playerImpactAnimationTintColor ?? null;
        unarmedHitPlayerStartMsRef.current = state.clock.elapsedTime * 1000;
      } else {
        enemyHitAnimationIdRef.current = playerImpactAnimationId;
        enemyHitTintColorRef.current = playerImpactAnimationTintColor ?? null;
        unarmedHitEnemyStartMsRef.current = state.clock.elapsedTime * 1000;
      }
    }

    if (
      typeof enemyImpactAnimationTrigger === 'number'
      && enemyImpactAnimationTrigger !== processedEnemyImpactTriggerRef.current
      && enemyImpactAnimationId
      && !isPlayerHit
    ) {
      processedEnemyImpactTriggerRef.current = enemyImpactAnimationTrigger;
      if (enemyImpactAnimationTarget === 'self') {
        enemyHitAnimationIdRef.current = enemyImpactAnimationId;
        enemyHitTintColorRef.current = enemyImpactAnimationTintColor ?? null;
        unarmedHitEnemyStartMsRef.current = state.clock.elapsedTime * 1000;
      } else {
        playerHitAnimationIdRef.current = enemyImpactAnimationId;
        playerHitTintColorRef.current = enemyImpactAnimationTintColor ?? null;
        unarmedHitPlayerStartMsRef.current = state.clock.elapsedTime * 1000;
      }
    }

    const playerExecutionActionActive = (
      playerAnimationAction === 'item'
      || playerAnimationAction === 'skill'
      || playerAnimationAction === 'heal'
    ) && Boolean(playerExecutionAnimationId);
    if (playerExecutionActionActive && !wasPlayerExecutionActionRef.current) {
      playerExecutionAnimationIdRef.current = playerExecutionAnimationId ?? null;
      playerExecutionTintColorRef.current = playerExecutionAnimationTintColor ?? null;
      playerExecutionStartMsRef.current = state.clock.elapsedTime * 1000;
    }
    wasPlayerExecutionActionRef.current = playerExecutionActionActive;

    const enemyExecutionActionActive = (
      enemyAnimationAction === 'item'
      || enemyAnimationAction === 'skill'
      || enemyAnimationAction === 'heal'
    ) && Boolean(enemyExecutionAnimationId);
    if (enemyExecutionActionActive && !wasEnemyExecutionActionRef.current) {
      enemyExecutionAnimationIdRef.current = enemyExecutionAnimationId ?? null;
      enemyExecutionTintColorRef.current = enemyExecutionAnimationTintColor ?? null;
      enemyExecutionStartMsRef.current = state.clock.elapsedTime * 1000;
    }
    wasEnemyExecutionActionRef.current = enemyExecutionActionActive;

    hitEnemyPulseRef.current = THREE.MathUtils.lerp(hitEnemyPulseRef.current, 0, 0.2 + delta * 2.2);
    hitPlayerPulseRef.current = THREE.MathUtils.lerp(hitPlayerPulseRef.current, 0, 0.2 + delta * 2.2);

    if (hitBurstEnemyRef.current) {
      const pulse = hitEnemyPulseRef.current;
      hitBurstEnemyRef.current.position.set(2.0, 0.62, 0.05);
      hitBurstEnemyRef.current.scale.setScalar(0.24 + pulse * 1.6);
      const hitEnemyMaterial = hitBurstEnemyRef.current.material as THREE.SpriteMaterial;
      hitEnemyMaterial.color.set(latestEnemyImpactColor ?? '#fef08a');
      hitEnemyMaterial.opacity = pulse * 0.68;
    }

    if (hitEnemyLightRef.current) {
      const pulse = hitEnemyPulseRef.current;
      hitEnemyLightRef.current.color.set(latestEnemyImpactColor ?? '#fef08a');
      hitEnemyLightRef.current.intensity = pulse * 1.2;
      hitEnemyLightRef.current.position.set(2.0, 0.7, 0.16);
    }

    if (hitBurstPlayerRef.current) {
      const pulse = hitPlayerPulseRef.current;
      hitBurstPlayerRef.current.position.set(-2.0, 0.62, 0.05);
      hitBurstPlayerRef.current.scale.setScalar(0.24 + pulse * 1.6);
      (hitBurstPlayerRef.current.material as THREE.SpriteMaterial).opacity = pulse * 0.62;
    }

    if (impulsePlayerLightRef.current) {
      const intensityPulse = effectivePlayerImpulseLightLevel > 0
        ? (0.62 + Math.sin((t * 5.4) + 0.2) * 0.2)
        : 0;
      impulsePlayerLightRef.current.color.set(playerImpulseColor);
      impulsePlayerLightRef.current.intensity = effectivePlayerImpulseLightLevel > 0
        ? (intensityPulse * (0.75 + effectivePlayerImpulseLightLevel * 0.28))
        : 0;
      impulsePlayerLightRef.current.position.set(playerAnchorXRef.current, playerAnchorYRef.current + 0.75, 0.24);
    }

    if (impulseEnemyLightRef.current) {
      const intensityPulse = effectiveEnemyImpulseLightLevel > 0
        ? (0.62 + Math.sin((t * 5.1) + 0.8) * 0.2)
        : 0;
      impulseEnemyLightRef.current.color.set(enemyImpulseColor);
      impulseEnemyLightRef.current.intensity = effectiveEnemyImpulseLightLevel > 0
        ? (intensityPulse * (0.75 + effectiveEnemyImpulseLightLevel * 0.28))
        : 0;
      impulseEnemyLightRef.current.position.set(enemyAnchorXRef.current, enemyAnchorYRef.current + 0.75, 0.24);
    }

    if (impulseChargePlayerLightRef.current) {
      const isChargingImpulse = (
        playerAnimationAction === 'item'
        && playerImpactAnimationId === SPRITE_ANIMATION_IDS.execImpulse
      );
      const chargeColor = playerImpactAnimationTintColor ?? '#22d3ee';
      const chargePulse = 0.75 + Math.sin((t * 6.8) + 0.4) * 0.22;
      impulseChargePlayerLightRef.current.color.set(chargeColor);
      impulseChargePlayerLightRef.current.intensity = isChargingImpulse ? (chargePulse * 1.45) : 0;
      impulseChargePlayerLightRef.current.position.set(playerAnchorXRef.current, playerAnchorYRef.current + 0.8, 0.28);
    }

    const heroTargetX = isPlayerAttacking
      ? 0.5
      : (playerAnimationAction === 'defend' || playerAnimationAction === 'defend-hit')
        ? -1.5
        : -2;
    const heroTargetY = -1;
    const enemyShouldLunge = Boolean(isEnemyAttacking) && enemyAnimationAction !== 'item';
    const enemyTargetX = enemyShouldLunge
      ? -0.35
      : enemyAnimationAction === 'defend'
        ? 1.5
        : 2;
    const enemyTargetY = -1;
    playerAnchorXRef.current = THREE.MathUtils.lerp(playerAnchorXRef.current, heroTargetX, 0.2);
    playerAnchorYRef.current = THREE.MathUtils.lerp(playerAnchorYRef.current, heroTargetY, 0.18);
    enemyAnchorXRef.current = THREE.MathUtils.lerp(enemyAnchorXRef.current, enemyTargetX, 0.2);
    enemyAnchorYRef.current = THREE.MathUtils.lerp(enemyAnchorYRef.current, enemyTargetY, 0.18);

    const createBowProjectileState = (side: 'player' | 'enemy', didHit: boolean): BowProjectileState => {
      const direction: 1 | -1 = side === 'player' ? 1 : -1;
      const sourceX = side === 'player'
        ? playerAnchorXRef.current + 0.45
        : enemyAnchorXRef.current - 0.45;
      const sourceY = side === 'player'
        ? playerAnchorYRef.current + 1.2
        : enemyAnchorYRef.current + 1.2;
      const targetX = side === 'player'
        ? enemyAnchorXRef.current - 0.2
        : playerAnchorXRef.current + 0.2;
      const targetY = side === 'player'
        ? enemyAnchorYRef.current + 1.06
        : playerAnchorYRef.current + 1.06;
      const hitTargetSide: 'player' | 'enemy' = side === 'player' ? 'enemy' : 'player';

      const start = new THREE.Vector3(sourceX, sourceY, 0.04);
      const target = new THREE.Vector3(targetX, targetY, 0.04);
      const hitOffsetFromTarget = new THREE.Vector3(direction * 0.14, 1.06, 0.04);
      const hitPoint = target.clone().add(new THREE.Vector3(direction * 0.14, 0, 0));
      const hitDirection = new THREE.Vector3(direction, 0.05, 0).normalize();
      const missPoint = target.clone().add(new THREE.Vector3(direction * 1.08, -0.08, 0));
      const missFadePoint = missPoint.clone().add(new THREE.Vector3(direction * 0.48, -0.16, 0));

      return {
        startedAtMs: nowMs,
        didHit,
        direction,
        start,
        hitPoint,
        hitOffsetFromTarget,
        hitTargetSide,
        hitDirection,
        missPoint,
        missFadePoint,
      };
    };

    if (typeof playerBowShotTrigger === 'number') {
      if (processedPlayerBowShotTriggerRef.current < 0) {
        processedPlayerBowShotTriggerRef.current = playerBowShotTrigger;
      } else if (playerBowShotTrigger !== processedPlayerBowShotTriggerRef.current) {
        processedPlayerBowShotTriggerRef.current = playerBowShotTrigger;
        playerBowProjectileStateRef.current = createBowProjectileState('player', playerBowShotDidHit !== false);
      }
    }

    if (typeof enemyBowShotTrigger === 'number') {
      if (processedEnemyBowShotTriggerRef.current < 0) {
        processedEnemyBowShotTriggerRef.current = enemyBowShotTrigger;
      } else if (enemyBowShotTrigger !== processedEnemyBowShotTriggerRef.current) {
        processedEnemyBowShotTriggerRef.current = enemyBowShotTrigger;
        enemyBowProjectileStateRef.current = createBowProjectileState('enemy', enemyBowShotDidHit !== false);
      }
    }

    const updateBowProjectile = (
      projectileRef: React.RefObject<THREE.Group>,
      projectileStateRef: React.MutableRefObject<BowProjectileState | null>,
    ) => {
      const projectile = projectileRef.current;
      const shot = projectileStateRef.current;
      if (!projectile || !shot) {
        if (projectile) {
          projectile.visible = false;
        }
        return;
      }

      const elapsedMs = Math.max(0, nowMs - shot.startedAtMs);
      const stickDuration = shot.didHit ? BOW_PROJECTILE_STICK_MS : 0;
      const fadeStartMs = BOW_PROJECTILE_FLIGHT_MS + stickDuration;
      const totalDurationMs = fadeStartMs + BOW_PROJECTILE_FADE_MS;

      if (elapsedMs > totalDurationMs) {
        projectile.visible = false;
        projectileStateRef.current = null;
        return;
      }

      projectile.visible = true;
      const nextPosition = new THREE.Vector3();
      const nextDirection = new THREE.Vector3(shot.direction, -0.02, 0);
      let opacity = 1;

      if (elapsedMs <= BOW_PROJECTILE_FLIGHT_MS) {
        const progress = elapsedMs / BOW_PROJECTILE_FLIGHT_MS;
        const flightTarget = shot.didHit ? shot.hitPoint : shot.missPoint;
        nextPosition.lerpVectors(shot.start, flightTarget, progress);
        nextPosition.y += Math.sin(progress * Math.PI) * 0.34;
        nextDirection.copy(flightTarget).sub(nextPosition);
      } else if (shot.didHit && elapsedMs <= fadeStartMs) {
        const hitAnchorX = shot.hitTargetSide === 'enemy' ? enemyAnchorXRef.current : playerAnchorXRef.current;
        const hitAnchorY = shot.hitTargetSide === 'enemy' ? enemyAnchorYRef.current : playerAnchorYRef.current;
        nextPosition.set(hitAnchorX, hitAnchorY, 0.04).add(shot.hitOffsetFromTarget);
        nextDirection.copy(shot.hitDirection);
      } else {
        const fadeProgress = Math.min(1, (elapsedMs - fadeStartMs) / BOW_PROJECTILE_FADE_MS);
        opacity = 1 - fadeProgress;
        if (shot.didHit) {
          const hitAnchorX = shot.hitTargetSide === 'enemy' ? enemyAnchorXRef.current : playerAnchorXRef.current;
          const hitAnchorY = shot.hitTargetSide === 'enemy' ? enemyAnchorYRef.current : playerAnchorYRef.current;
          nextPosition
            .set(hitAnchorX, hitAnchorY, 0.04)
            .add(shot.hitOffsetFromTarget)
            .add(new THREE.Vector3(shot.direction * 0.06 * fadeProgress, -0.03 * fadeProgress, 0));
          nextDirection.copy(shot.hitDirection);
        } else {
          nextPosition.lerpVectors(shot.missPoint, shot.missFadePoint, fadeProgress);
          nextDirection.copy(shot.missFadePoint).sub(shot.missPoint);
        }
      }

      projectile.position.copy(nextPosition);
      const orientationDirection = nextDirection.clone();
      orientationDirection.y += 0.18;
      if (orientationDirection.lengthSq() < 0.00001) {
        orientationDirection.set(shot.direction, 0, 0);
      }
      orientationDirection.normalize();
      // The FBX arrow's tip axis points down (-Y), so align that axis to the flight direction.
      projectile.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), orientationDirection);
      const scale = BOW_PROJECTILE_BASE_SCALE * (0.86 + (opacity * 0.14));
      projectile.scale.setScalar(scale);

      projectile.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) {
          return;
        }
        const applyOpacity = (material: THREE.Material) => {
          const standard = material as THREE.MeshStandardMaterial;
          standard.transparent = true;
          standard.opacity = opacity;
          standard.needsUpdate = true;
        };
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((entry) => applyOpacity(entry as THREE.Material));
        } else if (mesh.material) {
          applyOpacity(mesh.material as THREE.Material);
        }
      });
    };

    updateBowProjectile(playerBowProjectileRef, playerBowProjectileStateRef);
    updateBowProjectile(enemyBowProjectileRef, enemyBowProjectileStateRef);

    const resolveResources = ({
      side,
      requestedAnimationId,
      fallbackAnimationId,
    }: {
      side: 'enemy' | 'player';
      requestedAnimationId: string | null;
      fallbackAnimationId: string;
    }) => {
      const effectiveAnimationId = (requestedAnimationId && hitDefinitionsById[requestedAnimationId])
        ? requestedAnimationId
        : fallbackAnimationId;
      const definition = hitDefinitionsById[effectiveAnimationId] ?? null;
      const texture = side === 'enemy'
        ? hitEnemyTexturesById[effectiveAnimationId] ?? null
        : hitPlayerTexturesById[effectiveAnimationId] ?? null;
      const luminanceTexture = side === 'enemy'
        ? hitEnemyLuminanceTexturesById[effectiveAnimationId] ?? null
        : hitPlayerLuminanceTexturesById[effectiveAnimationId] ?? null;
      const trackTextures = side === 'enemy'
        ? hitEnemyTrackTexturesById[effectiveAnimationId] ?? []
        : hitPlayerTrackTexturesById[effectiveAnimationId] ?? [];
      const trackLuminanceTextures = side === 'enemy'
        ? hitEnemyTrackLuminanceTexturesById[effectiveAnimationId] ?? []
        : hitPlayerTrackLuminanceTexturesById[effectiveAnimationId] ?? [];
      const useBlade = effectiveAnimationId === SPRITE_ANIMATION_IDS.hitBladeSlash;
      return { definition, texture, luminanceTexture, trackTextures, trackLuminanceTextures, useBlade };
    };

    const setSpriteHidden = (sprite: THREE.Sprite | null) => {
      if (!sprite) return;
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = 0;
    };

    const ensureMaterialTexture = (material: THREE.SpriteMaterial, sourceTexture: THREE.Texture) => {
      const materialData = material.userData as { sourceTextureUuid?: string };
      if (!material.map || materialData.sourceTextureUuid !== sourceTexture.uuid) {
        if (material.map) {
          material.map.dispose();
        }
        const clonedTexture = sourceTexture.clone();
        clonedTexture.needsUpdate = true;
        material.map = clonedTexture;
        materialData.sourceTextureUuid = sourceTexture.uuid;
        material.userData = materialData;
      }
      return material.map as THREE.Texture;
    };

    const renderTrackAnimationSet = ({
      sprites,
      startMs,
      side,
      requestedAnimationId,
      fallbackAnimationId,
      onFinished,
      tintColorOverride,
      forceLoop = false,
    }: {
      sprites: (THREE.Sprite | null)[];
      startMs: number | null;
      side: 'enemy' | 'player';
      requestedAnimationId: string | null;
      fallbackAnimationId: string;
      onFinished: () => void;
      tintColorOverride?: string | null;
      forceLoop?: boolean;
    }) => {
      const { definition, texture, luminanceTexture, trackTextures, trackLuminanceTextures, useBlade } = resolveResources({
        side,
        requestedAnimationId,
        fallbackAnimationId,
      });
      const tracks = definition?.spriteTracks?.filter((candidate) => candidate.enabled !== false)
        ?? [];
      const availableTracks = tracks.slice(0, MAX_SPRITE_ANIMATION_TRACKS);
      const hideRemaining = (fromIndex: number) => {
        for (let index = fromIndex; index < MAX_SPRITE_ANIMATION_TRACKS; index += 1) {
          setSpriteHidden(sprites[index] ?? null);
        }
      };

      if (availableTracks.length === 0 || !texture || startMs == null) {
        hideRemaining(0);
        return;
      }
      const sheetSize = definition?.sheetSize ?? { width: 1, height: 1 };
      const elapsedRaw = Math.max(0, (state.clock.elapsedTime * 1000) - startMs);
      let finishedCount = 0;

      for (let index = 0; index < availableTracks.length; index += 1) {
        const sprite = sprites[index] ?? null;
        if (!sprite) continue;
        const material = sprite.material as THREE.SpriteMaterial;
        const track = availableTracks[index];
        const snapshot = resolveTrackPlaybackSnapshot({
          track,
          elapsedMs: elapsedRaw,
          isPlaying: true,
          forcePreviewLoop: forceLoop,
        });

        if (snapshot.status === 'finished') {
          finishedCount += 1;
          setSpriteHidden(sprite);
          continue;
        }

        const frameIndex = snapshot.frameIndex;
        if (frameIndex < 0) {
          setSpriteHidden(sprite);
          continue;
        }

        const rect = getTrackFrameRect(track, frameIndex, sheetSize);
        if (!rect) {
          setSpriteHidden(sprite);
          continue;
        }

        const aspect = rect.height > 0 ? rect.width / rect.height : 1;
        const baseSize: [number, number] = track.useOriginalFrameSize
          ? [
            Math.max(0.1, rect.width * (track.originalSizeScale ?? 0.01)),
            Math.max(0.1, rect.height * (track.originalSizeScale ?? 0.01)),
          ]
          : [
            track.size?.[0] ?? 1.2,
            track.size?.[1] ?? 1.2,
          ];
        const finalSize: [number, number] = (track.preserveFrameAspect ?? true)
          ? [baseSize[1] * aspect, baseSize[1]]
          : baseSize;
        const anchorBaseX = side === 'enemy' ? enemyAnchorXRef.current : playerAnchorXRef.current;
        const anchorBaseY = side === 'enemy' ? enemyAnchorYRef.current : playerAnchorYRef.current;
        const anchorBase: [number, number, number] = [anchorBaseX, anchorBaseY + 1.1 + getAnchorY(track.anchorPoint), 0];
        const offset = track.offset3d ?? [0, 0, 0];
        const mirroredOffsetX = side === 'enemy' ? -offset[0] : offset[0];
        sprite.position.set(anchorBase[0] + mirroredOffsetX, anchorBase[1] + offset[1], anchorBase[2] + offset[2]);
        sprite.scale.set(side === 'enemy' ? -finalSize[0] : finalSize[0], finalSize[1], 1);
        sprite.renderOrder = (track.renderPriority ?? 0) + 10 + index;

        const tintColor = tintColorOverride ?? track.tintColor ?? '#ffffff';
        const baseTrackTexture = trackTextures[index] ?? texture;
        const baseTrackLuminanceTexture = trackLuminanceTextures[index] ?? luminanceTexture ?? baseTrackTexture;
        const selectedTexture = shouldUseLuminanceTint(tintColor) ? baseTrackLuminanceTexture : baseTrackTexture;
        const materialTexture = ensureMaterialTexture(material, selectedTexture);
        materialTexture.repeat.set(rect.width / rect.sheet.width, rect.height / rect.sheet.height);
        materialTexture.offset.set(rect.x / rect.sheet.width, 1 - ((rect.y + rect.height) / rect.sheet.height));
        materialTexture.needsUpdate = true;
        material.rotation = THREE.MathUtils.degToRad(track.rotationDeg ?? 0);
        material.color.set(tintColor);
        material.opacity = Math.max(0, Math.min(1, track.opacity ?? 1));
        material.alphaTest = 0.02;
        material.depthTest = track.depthTest ?? true;
        material.depthWrite = track.depthWrite ?? false;
        material.blending = track.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
        if (useBlade && track.blendMode !== 'additive') {
          material.blending = THREE.AdditiveBlending;
        }
      }

      hideRemaining(availableTracks.length);
      if (finishedCount === availableTracks.length) {
        onFinished();
      }
    };

    renderTrackAnimationSet({
      sprites: unarmedHitEnemyRefs.current,
      startMs: unarmedHitEnemyStartMsRef.current,
      side: 'enemy',
      requestedAnimationId: enemyHitAnimationIdRef.current,
      fallbackAnimationId: COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId,
      tintColorOverride: enemyHitTintColorRef.current,
      onFinished: () => {
        unarmedHitEnemyStartMsRef.current = null;
        enemyHitAnimationIdRef.current = null;
        enemyHitTintColorRef.current = null;
      },
    });
    renderTrackAnimationSet({
      sprites: unarmedHitPlayerRefs.current,
      startMs: unarmedHitPlayerStartMsRef.current,
      side: 'player',
      requestedAnimationId: playerHitAnimationIdRef.current,
      fallbackAnimationId: COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedImpactAnimationId,
      tintColorOverride: playerHitTintColorRef.current,
      onFinished: () => {
        unarmedHitPlayerStartMsRef.current = null;
        playerHitAnimationIdRef.current = null;
        playerHitTintColorRef.current = null;
      },
    });
    renderTrackAnimationSet({
      sprites: executionEnemyRefs.current,
      startMs: enemyExecutionStartMsRef.current,
      side: 'enemy',
      requestedAnimationId: enemyExecutionAnimationIdRef.current,
      fallbackAnimationId: COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId,
      tintColorOverride: enemyExecutionTintColorRef.current,
      onFinished: () => {
        enemyExecutionStartMsRef.current = null;
        enemyExecutionAnimationIdRef.current = null;
        enemyExecutionTintColorRef.current = null;
      },
    });
    renderTrackAnimationSet({
      sprites: executionPlayerRefs.current,
      startMs: playerExecutionStartMsRef.current,
      side: 'player',
      requestedAnimationId: playerExecutionAnimationIdRef.current,
      fallbackAnimationId: COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId,
      tintColorOverride: playerExecutionTintColorRef.current,
      onFinished: () => {
        playerExecutionStartMsRef.current = null;
        playerExecutionAnimationIdRef.current = null;
        playerExecutionTintColorRef.current = null;
      },
    });
    renderTrackAnimationSet({
      sprites: impulseAuraPlayerRefs.current,
      startMs: playerImpulseAuraStartMsRef.current,
      side: 'player',
      requestedAnimationId: SPRITE_ANIMATION_IDS.execImpulsePulse,
      fallbackAnimationId: SPRITE_ANIMATION_IDS.execImpulsePulse,
      tintColorOverride: playerImpulseAuraTintColorRef.current,
      forceLoop: true,
      onFinished: () => {},
    });
    renderTrackAnimationSet({
      sprites: impulseAuraEnemyRefs.current,
      startMs: enemyImpulseAuraStartMsRef.current,
      side: 'enemy',
      requestedAnimationId: SPRITE_ANIMATION_IDS.execImpulsePulse,
      fallbackAnimationId: SPRITE_ANIMATION_IDS.execImpulsePulse,
      tintColorOverride: enemyImpulseAuraTintColorRef.current,
      forceLoop: true,
      onFinished: () => {},
    });
  });

  return (
    <group>
      <sprite ref={playerCastAuraRef}>
        <spriteMaterial
          map={ORB_TEXTURE}
          color="#67e8f9"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={playerCastCoreRef}>
        <spriteMaterial
          map={CORE_TEXTURE}
          color="#ecfeff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={enemyCastAuraRef}>
        <spriteMaterial
          map={ORB_TEXTURE}
          color="#fca5a5"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={enemyCastCoreRef}>
        <spriteMaterial
          map={CORE_TEXTURE}
          color="#fff1f2"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {COMBAT_TRAIL_SEEDS.map((seed, i) => (
        <sprite key={`trail_player_${i}`} ref={(el) => { playerRefs.current[i] = el; }} position={[-1.8, 0.6, 0]}>
          <spriteMaterial
            map={ORB_TEXTURE}
            color="#8be9ff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
      {COMBAT_TRAIL_SEEDS.map((seed, i) => (
        <sprite key={`trail_enemy_${i}`} ref={(el) => { enemyRefs.current[i] = el; }} position={[1.8, 0.6, 0]}>
          <spriteMaterial
            map={ORB_TEXTURE}
            color="#fca5a5"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
      <sprite ref={hitBurstEnemyRef}>
        <spriteMaterial
          map={CORE_TEXTURE}
          color="#fef08a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={hitBurstPlayerRef}>
        <spriteMaterial
          map={CORE_TEXTURE}
          color="#fef08a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {Array.from({ length: MAX_SPRITE_ANIMATION_TRACKS }).map((_, index) => (
        <sprite key={`impact_enemy_track_${index}`} ref={(el) => { unarmedHitEnemyRefs.current[index] = el; }}>
          <spriteMaterial
            map={defaultUnarmedHitEnemyTexture ?? undefined}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
      {Array.from({ length: MAX_SPRITE_ANIMATION_TRACKS }).map((_, index) => (
        <sprite key={`impact_player_track_${index}`} ref={(el) => { unarmedHitPlayerRefs.current[index] = el; }}>
          <spriteMaterial
            map={defaultUnarmedHitPlayerTexture ?? undefined}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
      {Array.from({ length: MAX_SPRITE_ANIMATION_TRACKS }).map((_, index) => (
        <sprite key={`execution_enemy_track_${index}`} ref={(el) => { executionEnemyRefs.current[index] = el; }}>
          <spriteMaterial
            map={defaultExecutionEnemyTexture ?? undefined}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
      {Array.from({ length: MAX_SPRITE_ANIMATION_TRACKS }).map((_, index) => (
        <sprite key={`execution_player_track_${index}`} ref={(el) => { executionPlayerRefs.current[index] = el; }}>
          <spriteMaterial
            map={defaultExecutionPlayerTexture ?? undefined}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
      {Array.from({ length: MAX_SPRITE_ANIMATION_TRACKS }).map((_, index) => (
        <sprite key={`impulse_player_track_${index}`} ref={(el) => { impulseAuraPlayerRefs.current[index] = el; }}>
          <spriteMaterial
            map={defaultExecutionPlayerTexture ?? undefined}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
      {Array.from({ length: MAX_SPRITE_ANIMATION_TRACKS }).map((_, index) => (
        <sprite key={`impulse_enemy_track_${index}`} ref={(el) => { impulseAuraEnemyRefs.current[index] = el; }}>
          <spriteMaterial
            map={defaultExecutionEnemyTexture ?? undefined}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
      <group ref={playerBowProjectileRef} visible={false}>
        <primitive object={playerBowProjectileModel} />
      </group>
      <group ref={enemyBowProjectileRef} visible={false}>
        <primitive object={enemyBowProjectileModel} />
      </group>
      <pointLight ref={hitEnemyLightRef} color="#fef08a" intensity={0} distance={3.2} decay={2} />
      <pointLight ref={impulsePlayerLightRef} color="#ef4444" intensity={0} distance={4.8} decay={2} />
      <pointLight ref={impulseEnemyLightRef} color="#ef4444" intensity={0} distance={4.8} decay={2} />
      <pointLight ref={impulseChargePlayerLightRef} color="#22d3ee" intensity={0} distance={5.4} decay={2} />
    </group>
  );
};

const DRIFT_PARTICLE_COUNT = 18;
const DRIFT_PARTICLE_SEEDS = Array.from({ length: DRIFT_PARTICLE_COUNT }, (_, i) => {
  const isPlayerSide = i % 2 === 0;
  return {
    baseX: (isPlayerSide ? -2.15 : 2.15) + (Math.random() - 0.5) * 1.9,
    baseY: -0.35 + Math.random() * 2.7,
    baseZ: (Math.random() - 0.5) * 2.2,
    swayX: 0.04 + Math.random() * 0.12,
    swayY: 0.06 + Math.random() * 0.1,
    swayZ: 0.06 + Math.random() * 0.14,
    speed: 0.45 + Math.random() * 0.85,
    phase: Math.random() * Math.PI * 2,
    size: 0.055 + Math.random() * 0.09,
    alpha: 0.12 + Math.random() * 0.14,
  };
});

const AmbientDriftParticles = ({ isLowQuality, isDungeonRun }: { isLowQuality: boolean; isDungeonRun: boolean }) => {
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([]);
  const activeCount = isLowQuality ? 10 : DRIFT_PARTICLE_COUNT;
  const colors = isDungeonRun ? ['#8b5cf6', '#60a5fa', '#a78bfa'] : ['#86efac', '#7dd3fc', '#fde68a'];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < activeCount; i += 1) {
      const sprite = spriteRefs.current[i];
      if (!sprite) continue;
      const seed = DRIFT_PARTICLE_SEEDS[i];
      sprite.position.set(
        seed.baseX + Math.sin(t * seed.speed + seed.phase) * seed.swayX,
        seed.baseY + Math.sin(t * (seed.speed * 0.7) + seed.phase * 1.3) * seed.swayY,
        seed.baseZ + Math.cos(t * (seed.speed * 0.85) + seed.phase) * seed.swayZ,
      );
      const pulse = 0.88 + Math.sin(t * (seed.speed * 1.8) + seed.phase) * 0.22;
      sprite.scale.setScalar(seed.size * pulse);
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = Math.max(0.05, seed.alpha * (0.7 + Math.sin(t * (seed.speed * 1.3) + seed.phase) * 0.3));
    }
  });

  return (
    <group>
      {DRIFT_PARTICLE_SEEDS.slice(0, activeCount).map((seed, i) => (
        <sprite
          key={i}
          ref={(el) => { spriteRefs.current[i] = el; }}
          position={[seed.baseX, seed.baseY, seed.baseZ]}
          scale={[seed.size, seed.size, seed.size]}
        >
          <spriteMaterial
            color={colors[i % colors.length]}
            transparent
            opacity={seed.alpha}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
};

const BattleStatusBar = ({
  label,
  value,
  max,
  fillClassName,
}: {
  label: string;
  value: number;
  max: number;
  fillClassName: string;
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/72">{label}</span>
      <span className="text-[10px] font-black text-white">{value}/{max}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
      <div
        className={`h-full rounded-full transition-all duration-300 ${fillClassName}`}
        style={{ width: `${clampPercent(value, max)}%` }}
      />
    </div>
  </div>
);

const BattleActorStatusHud = ({
  name,
  subtitle,
  accentColor,
  badge,
  hp,
  statusEffects,
}: {
  name: string;
  subtitle?: string;
  accentColor: string;
  badge?: string;
  hp: { value: number; max: number };
  statusEffects?: StatusEffect[];
}) => (
  <Html center sprite distanceFactor={7.2} zIndexRange={[110, 0]} position={[0, 2.7, 0]}>
    <div className="pointer-events-none w-[210px] select-none sm:w-[260px]">
      <div className="overflow-hidden rounded-[22px] border border-[#cfab91] bg-[#f7ecdd]/95 px-4 py-3 shadow-[0_18px_40px_rgba(107,49,65,0.18)]">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-black uppercase tracking-[0.18em] text-[#6b3141]">{name}</div>
            {subtitle ? <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f6c67]">{subtitle}</div> : null}
          </div>
          {badge ? (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ borderColor: `${accentColor}66`, backgroundColor: `${accentColor}1c`, color: accentColor }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <BattleStatusBar label="HP" value={hp.value} max={hp.max} fillClassName="bg-[linear-gradient(90deg,#c85466,#e78f9d)]" />

        {(statusEffects?.length ?? 0) > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {statusEffects?.slice(0, 3).map((status) => (
              <span
                key={status.id}
                className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                style={{ borderColor: `${status.color}55`, backgroundColor: `${status.color}18`, color: status.color }}
              >
                {status.name} {status.duration}t
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  </Html>
);

const EnemyIntentOverlay = ({
  intent,
  isBoss,
  show = true,
}: {
  intent?: EnemyIntentPreview | null;
  isBoss?: boolean;
  show?: boolean;
}) => {
  if (!intent || !show) return null;

  const config = intent.type === 'attack'
    ? { color: '#ef4444', Icon: Sword }
    : intent.type === 'defend'
      ? { color: '#60a5fa', Icon: Shield }
      : intent.type === 'impulse'
        ? { color: '#f59e0b', Icon: Zap }
        : intent.type === 'skill'
          ? { color: '#a855f7', Icon: Sparkles }
          : { color: '#22c55e', Icon: FlaskConical };

  return (
    <Html center sprite distanceFactor={8.8} zIndexRange={[150, 0]} position={[2, isBoss ? 2.04 : 1.82, 0.1]}>
      <div className="pointer-events-none flex items-center gap-1.5 select-none">
        <span
          className="inline-flex items-center justify-center rounded-full border-2 p-1.5"
          style={{
            backgroundColor: config.color,
            borderColor: '#ffffff',
            color: '#ffffff',
            boxShadow: `0 0 16px ${config.color}cc`,
          }}
        >
          <config.Icon size={15} strokeWidth={2.8} />
        </span>
        <span
          className="text-sm font-black tracking-[0.14em]"
          style={{
            color: config.color,
            WebkitTextStroke: '2.5px rgba(255,255,255,1)',
            paintOrder: 'stroke fill',
          }}
        >
          {intent.probability}%
        </span>
      </div>
    </Html>
  );
};

const HeroVoxel = ({ classId = 'knight', playerAnimationAction = 'idle', animationClipName, preferredAnimationBundle, onAvailableAnimationClipsChange, loadAllAnimationBundles = false, loadSecondaryAnimationBundles = true, previewLoopAllActions = false, isAttacking, isDefending, weaponId, armorId, helmetId, legsId, shieldId, isLevelingUp, levelUpCardCategory = 'especial', isMenuView = false, isHit, isPlayerCritHit, hasPerfectEvadeAura, hasDoubleAttackAura, impulseLevel = 0, activeImpulseLevel = 0, contactShadowResolution = 256, idlePositionX = -2, attackPositionX = 0.5, defendPositionX = -1.5, originPosition = [-2, -1, 0], baseRotationY = 0.5, hiddenPartSlots, visiblePartSlots, runtimeAssetsOverride, calibrationOverride, debugRuntimeId, debugRuntimeLabel, onRuntimeDiagnosticChange, statusOverlay, onHeroClick, playerState }: any) => {
  const playerClass = getPlayerClassById(classId);
  const runtimeHeroAssets = runtimeAssetsOverride ?? (hasRuntimeFbxAssets(playerClass.assets) ? playerClass.assets : null);
  const group = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);
  const defendImpulseAuraRef = useRef<THREE.Group>(null);
  const phantomAuraRef = useRef<THREE.Group>(null);
  const twinAuraRef = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);
  const wasHitRef = useRef(false);
  const flashMaterialsRef = useRef<THREE.Material[]>([]);
  const damageLightRef = useRef<THREE.PointLight>(null);
  const healLightRef = useRef<THREE.PointLight>(null);
  const defendImpulseLevel = useMemo(() => {
    if (!playerState?.buffs) return 0;
    if ((playerState.buffs.guaranteedCounterTurns ?? 0) > 0) return 3;
    if ((playerState.buffs.perfectGuardTurns ?? 0) > 0) return 2;
    if ((playerState.buffs.impulseDefenseBoostTurns ?? 0) > 0) return 1;
    return 0;
  }, [playerState?.buffs]);
  const defendImpulseColor = defendImpulseLevel >= 3 ? '#7dd3fc' : defendImpulseLevel === 2 ? '#a855f7' : '#ef4444';

  const refreshFlashMaterials = useCallback(() => {
    if (!group.current) {
      flashMaterialsRef.current = [];
      return;
    }

    const materials: THREE.Material[] = [];
    group.current.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) {
        return;
      }

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => {
          materials.push(material);
        });
      } else {
        materials.push(mesh.material);
      }
    });

    flashMaterialsRef.current = materials;
  }, []);

  useEffect(() => {
    flashMaterialsRef.current = [];
    refreshFlashMaterials();
  }, [refreshFlashMaterials, runtimeHeroAssets]);

  useFrame((state) => {
    if (damageLightRef.current) {
      damageLightRef.current.intensity = THREE.MathUtils.lerp(damageLightRef.current.intensity, 0, 0.14);
      damageLightRef.current.color.set(isPlayerCritHit ? '#facc15' : '#ef4444');
    }
    if (healLightRef.current) {
      const shouldShowHealLight = !isMenuView && playerAnimationAction === 'heal';
      if (shouldShowHealLight) {
        healLightRef.current.intensity = THREE.MathUtils.lerp(healLightRef.current.intensity, 2.5, 0.07);
      } else {
        healLightRef.current.intensity = THREE.MathUtils.lerp(healLightRef.current.intensity, 0, 0.09);
      }
    }
    if (group.current) {
      // Idle/Action movement — stay at attack position while animation is still playing
      const isInAttackAnimation = isAttacking;
      if (isInAttackAnimation) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, attackPositionX, 0.2);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.2);
      } else if (isDefending) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, defendPositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.12);
        group.current.rotation.x = 0.2;
      } else {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, idlePositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.12);
        group.current.rotation.x = 0;
      }

      // Level Up Effect
      if (isLevelingUp) {
        group.current.position.y += Math.sin(state.clock.elapsedTime * 10) * 0.015;
      }

      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, baseRotationY, 0.16);

      if (isHit && !wasHitRef.current) {
        flashRef.current = 1;
      }
      flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.32);
      wasHitRef.current = Boolean(isHit);
      if (flashRef.current > 0.003) {
        if (flashMaterialsRef.current.length === 0) {
          refreshFlashMaterials();
        }

        flashMaterialsRef.current.forEach((material) => {
          applyHitFlashToMaterial(material, flashRef.current > 0.03, flashRef.current * 0.65, '#ef4444');
        });
      }
    }

    if (shieldRef.current) {
      shieldRef.current.visible = isDefending;
      shieldRef.current.rotation.y += 0.05;
      shieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
    }

    if (defendImpulseAuraRef.current) {
      const auraVisible = Boolean(isDefending) && defendImpulseLevel > 0;
      defendImpulseAuraRef.current.visible = auraVisible;
      defendImpulseAuraRef.current.rotation.y += 0.07 + (defendImpulseLevel * 0.01);
      defendImpulseAuraRef.current.position.y = -0.18 + Math.sin(state.clock.elapsedTime * 5.5) * 0.04;
      defendImpulseAuraRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.color.set(defendImpulseColor);
          child.material.emissive.set(defendImpulseColor);
        }
      });
    }

    if (phantomAuraRef.current) {
      phantomAuraRef.current.visible = Boolean(hasPerfectEvadeAura);
      phantomAuraRef.current.rotation.y += 0.025;
      phantomAuraRef.current.position.y = 0.15 + Math.sin(state.clock.elapsedTime * 2.5) * 0.04;
      phantomAuraRef.current.children.forEach((child, index) => {
        child.position.y = Math.sin(state.clock.elapsedTime * 2 + index) * 0.08;
      });
    }

    if (twinAuraRef.current) {
      twinAuraRef.current.visible = Boolean(hasDoubleAttackAura);
      twinAuraRef.current.rotation.y -= 0.08;
      twinAuraRef.current.position.y = 0.45 + Math.sin(state.clock.elapsedTime * 6) * 0.03;
      twinAuraRef.current.children.forEach((child, index) => {
        child.rotation.z += 0.03 + index * 0.005;
      });
    }

  });

  const handleHeroClick = useCallback((event: any) => {
    if (!isMenuView || !onHeroClick) {
      return;
    }

    event.stopPropagation();
    onHeroClick();
  }, [isMenuView, onHeroClick]);

  return (
    <group>
      <group ref={group} position={originPosition} rotation={[0, baseRotationY, 0]} onClick={handleHeroClick}>
        {runtimeHeroAssets ? (
          <Suspense fallback={null}>
            <AnimatedClassHero
              assets={runtimeHeroAssets}
              equippedWeaponId={weaponId}
              animationAction={playerAnimationAction}
              animationClipName={animationClipName}
              preferredAnimationBundle={preferredAnimationBundle}
              hasWeapon={Boolean(weaponId)}
              loadAllAnimationBundles={loadAllAnimationBundles}
              loadSecondaryAnimationBundles={loadSecondaryAnimationBundles}
              previewLoopAllActions={previewLoopAllActions}
              onAvailableAnimationClipsChange={onAvailableAnimationClipsChange}
              debugTargetId={classId}
              debugRuntimeId={debugRuntimeId}
              debugRuntimeLabel={debugRuntimeLabel}
              onRuntimeDiagnosticChange={onRuntimeDiagnosticChange}
              hiddenPartSlots={hiddenPartSlots}
              visiblePartSlots={visiblePartSlots}
              calibrationOverride={calibrationOverride}
            />
          </Suspense>
        ) : null}
        {isLevelingUp && <LevelUpEffect category={levelUpCardCategory} />}
        <LevelUpSpriteExecution isLevelingUp={isLevelingUp} />
        {statusOverlay}
        <group ref={phantomAuraRef} position={[0, 0.2, 0]} visible={Boolean(hasPerfectEvadeAura)}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.72, 0.05, 6, 20]} />
            <meshStandardMaterial color="#7dd3fc" emissive="#67e8f9" emissiveIntensity={1.2} transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.54, 0.03, 6, 16]} />
            <meshStandardMaterial color="#c4b5fd" emissive="#c084fc" emissiveIntensity={1.1} transparent opacity={0.35} />
          </mesh>
          <pointLight position={[0, 0.7, 0.45]} color="#8be9fd" intensity={1.2} distance={4.5} decay={2} />
          <mesh position={[0.45, 0.9, 0.15]}>
            <sphereGeometry args={[0.07, 6, 6]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#bae6fd" emissiveIntensity={1.6} transparent opacity={0.8} />
          </mesh>
          <mesh position={[-0.48, 0.62, -0.18]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#d8b4fe" emissive="#c084fc" emissiveIntensity={1.5} transparent opacity={0.72} />
          </mesh>
        </group>
        <group ref={twinAuraRef} position={[0, 0.45, 0]} visible={Boolean(hasDoubleAttackAura)}>
          <mesh position={[0.58, 0.15, 0.18]} rotation={[0.2, 0.3, 0.9]}>
            <boxGeometry args={[0.1, 0.62, 0.08]} />
            <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={1.5} transparent opacity={0.86} />
          </mesh>
          <mesh position={[-0.58, -0.05, -0.16]} rotation={[-0.2, -0.2, -0.9]}>
            <boxGeometry args={[0.1, 0.62, 0.08]} />
            <meshStandardMaterial color="#fdba74" emissive="#fb923c" emissiveIntensity={1.4} transparent opacity={0.78} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.78, 0.9, 20]} />
            <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.1} transparent opacity={0.28} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 0.8, 0.25]} color="#fb923c" intensity={1.35} distance={4.2} decay={2} />
        </group>
        <ContactShadows opacity={0.35} scale={3} blur={1.8} far={2} resolution={contactShadowResolution} />
        <pointLight ref={damageLightRef} color="#ef4444" intensity={0} distance={8} decay={2.5} position={[0, 0.8, 0.3]} />
        <pointLight ref={healLightRef} color="#86efac" intensity={0} distance={9} decay={2.5} position={[0, 0.8, 0.3]} />
      </group>
      
      {/* Energy Shield Effect */}
      <group ref={shieldRef} position={[idlePositionX + 0.5, -0.2, 0]}>
        <mesh>
          <sphereGeometry args={[1.4, 12, 12]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.18} wireframe />
        </mesh>
        <mesh scale={0.92}>
          <sphereGeometry args={[1.4, 12, 12]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.12} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.3, 0.04, 6, 24]} />
          <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={1.2} transparent opacity={0.55} />
        </mesh>
        <mesh rotation={[0.9, 0, 0]}>
          <torusGeometry args={[1.2, 0.03, 6, 20]} />
          <meshStandardMaterial color="#bfdbfe" emissive="#93c5fd" emissiveIntensity={1.0} transparent opacity={0.38} />
        </mesh>
        <pointLight color="#60a5fa" intensity={1.6} distance={5} decay={2} />
      </group>
      <group ref={defendImpulseAuraRef} position={[idlePositionX + 0.5, -0.18, 0]} visible={Boolean(isDefending) && defendImpulseLevel > 0}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.52, 0.045, 10, 42]} />
          <meshStandardMaterial color={defendImpulseColor} emissive={defendImpulseColor} emissiveIntensity={1.35} transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[1.34, 0.03, 10, 36]} />
          <meshStandardMaterial color={defendImpulseColor} emissive={defendImpulseColor} emissiveIntensity={1.15} transparent opacity={0.36} />
        </mesh>
        <pointLight color={defendImpulseColor} intensity={1.45 + (defendImpulseLevel * 0.32)} distance={5.8} decay={2} position={[0, 0.42, 0.28]} />
      </group>
    </group>
  );
};

const CombinedHeroVoxel = ({
  baseClassId,
  donorAssets,
  animationAction = 'idle',
  isAttacking,
  isDefending,
  contactShadowResolution = 256,
  hiddenBaseSlots,
  donorVisibleSlots,
  donorAlignmentOffset,
  donorSlotTransforms,
  onRuntimeDiagnosticChange,
}: {
  baseClassId: PlayerClassId;
  donorAssets?: RuntimeHeroAssets | null;
  animationAction?: PlayerAnimationAction;
  isAttacking?: boolean;
  isDefending?: boolean;
  contactShadowResolution?: number;
  hiddenBaseSlots?: DeveloperKitbashSlot[];
  donorVisibleSlots?: DeveloperKitbashSlot[];
  donorAlignmentOffset?: [number, number, number];
  donorSlotTransforms?: Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>;
  onRuntimeDiagnosticChange?: (diagnostic: DeveloperAnimationRuntimeDiagnostic) => void;
}) => {
  const baseClass = getPlayerClassById(baseClassId);
  const group = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);
  const donorLayers = useMemo(
    () => KITBASH_MAIN_SLOTS.map((rootSlot) => ({
      rootSlot,
      slots: (donorVisibleSlots ?? []).filter((slot) => getKitbashRootSlot(slot) === rootSlot),
    })).filter((layer) => layer.slots.length > 0),
    [donorVisibleSlots],
  );

  useFrame((state) => {
    if (!group.current) {
      return;
    }

    if (isAttacking) {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0, 0.2);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.2);
    } else if (isDefending) {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.12);
      group.current.rotation.x = 0.2;
    } else {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.12);
      group.current.rotation.x = 0;
    }

    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0.35, 0.16);
    flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.1);

    if (flashRef.current > 0.01) {
      group.current.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;

        if (!mesh.isMesh || !mesh.material) {
          return;
        }

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material: THREE.Material) => applyHitFlashToMaterial(material, false, flashRef.current * 2));
        } else {
          applyHitFlashToMaterial(mesh.material, false, flashRef.current * 2);
        }
      });
    }

    const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.005;
    group.current.scale.setScalar(breathe);
  });

  return (
    <group>
      <group ref={group} position={[0, -1, 0]} rotation={[0, 0.35, 0]}>
        <Suspense fallback={null}>
          <AnimatedClassHero
            key={`combined-base-${baseClassId}-${animationAction}-${(hiddenBaseSlots ?? []).join('-')}`}
            assets={baseClass.assets as RuntimeHeroAssets}
            animationAction={animationAction}
            hasWeapon={false}
            loadSecondaryAnimationBundles
            previewLoopAllActions
            debugRuntimeId="combined-base"
            debugRuntimeLabel="Combinado Base"
            onRuntimeDiagnosticChange={onRuntimeDiagnosticChange}
            hiddenPartSlots={hiddenBaseSlots}
          />
          {donorAssets ? donorLayers.map(({ rootSlot, slots }) => {
            const transform = donorSlotTransforms?.[rootSlot];
            const layerPosition = transform?.positionOffset ?? donorAlignmentOffset ?? [0, 0, 0];
            const layerPivot = transform?.pivot ?? [0, 0, 0];
            const layerScale = transform ? [transform.scale, transform.scale, transform.scale] as [number, number, number] : [1, 1, 1] as [number, number, number];
            const inversePivot = transform ? [-transform.pivot[0], -transform.pivot[1], -transform.pivot[2]] as [number, number, number] : [0, 0, 0] as [number, number, number];
            const label = rootSlot === 'head'
              ? 'Combinado Cabeca'
              : rootSlot === 'torso'
                ? 'Combinado Torso'
                : rootSlot === 'arms'
                  ? 'Combinado Bracos'
                  : 'Combinado Pernas';

            return (
              <group key={`combined-donor-layer-${rootSlot}`} position={layerPosition}>
                <group position={layerPivot}>
                  <group scale={layerScale}>
                    <group position={inversePivot}>
                      <AnimatedClassHero
                        key={`combined-donor-${rootSlot}-${donorAssets.modelUrl}-${animationAction}-${slots.join('-')}`}
                        assets={donorAssets}
                        animationAction={animationAction}
                        hasWeapon={false}
                        loadSecondaryAnimationBundles
                        previewLoopAllActions
                        debugRuntimeId={`combined-donor-${rootSlot}`}
                        debugRuntimeLabel={label}
                        onRuntimeDiagnosticChange={onRuntimeDiagnosticChange}
                        visiblePartSlots={slots}
                        calibrationOverride={baseClass.assets.calibration}
                      />
                    </group>
                  </group>
                </group>
              </group>
            );
          }) : null}
        </Suspense>
      </group>
      <ContactShadows opacity={0.35} scale={2.8} blur={1.8} far={2} resolution={contactShadowResolution} />
    </group>
  );
};

interface BackfaceHullOverlayProps {
  targets: Array<{ current: THREE.Object3D | null }>;
  thickness: number;
  color?: string;
}

const BackfaceHullOverlay = ({
  targets,
  thickness,
  color = '#000000',
}: BackfaceHullOverlayProps) => {
  const { scene } = useThree();
  const hullRootRef = useRef(new THREE.Group());
  const signatureRef = useRef('');
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const pairsRef = useRef<Array<{
    source: THREE.Mesh | THREE.SkinnedMesh;
    hull: THREE.Mesh | THREE.SkinnedMesh;
  }>>([]);

  const cleanupHulls = useCallback(() => {
    for (const pair of pairsRef.current) {
      hullRootRef.current.remove(pair.hull);
    }
    pairsRef.current = [];
  }, []);

  const rebuildHulls = useCallback(() => {
    const sources: Array<THREE.Mesh | THREE.SkinnedMesh> = [];

    for (const target of targets) {
      const root = target.current;
      if (!root) {
        continue;
      }

      root.traverse((node) => {
        if ((node as THREE.SkinnedMesh).isSkinnedMesh || (node as THREE.Mesh).isMesh) {
          sources.push(node as THREE.Mesh | THREE.SkinnedMesh);
        }
      });
    }

    const signature = sources.map((source) => source.uuid).join('|');
    if (signature === signatureRef.current) {
      return;
    }

    signatureRef.current = signature;
    cleanupHulls();

    for (const source of sources) {
      if (!source.geometry) {
        continue;
      }

      let hull: THREE.Mesh | THREE.SkinnedMesh;
      if ((source as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinnedSource = source as THREE.SkinnedMesh;
        const skinnedHull = new THREE.SkinnedMesh(skinnedSource.geometry, materialRef.current!);
        skinnedHull.bindMode = skinnedSource.bindMode;
        skinnedHull.bind(skinnedSource.skeleton, skinnedSource.bindMatrix);
        hull = skinnedHull;
      } else {
        hull = new THREE.Mesh(source.geometry, materialRef.current!);
      }

      hull.frustumCulled = false;
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.matrixAutoUpdate = false;
      hull.renderOrder = source.renderOrder - 1;
      hull.layers.mask = source.layers.mask;

      hullRootRef.current.add(hull);
      pairsRef.current.push({ source, hull });
    }
  }, [cleanupHulls, targets]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.BackSide,
      toneMapped: false,
      transparent: false,
      depthWrite: false,
      depthTest: false,
    });
    materialRef.current = material;
    hullRootRef.current.renderOrder = -10;
    scene.add(hullRootRef.current);

    rebuildHulls();
    const refreshDelays = [0, 160, 500, 1100, 2000];
    const timerIds = refreshDelays.map((delay) => window.setTimeout(rebuildHulls, delay));
    const intervalId = window.setInterval(rebuildHulls, 900);

    return () => {
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      window.clearInterval(intervalId);
      cleanupHulls();
      scene.remove(hullRootRef.current);
      material.dispose();
      materialRef.current = null;
    };
  }, [cleanupHulls, color, rebuildHulls, scene]);

  const tmpPosition = useMemo(() => new THREE.Vector3(), []);
  const tmpQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    for (const { source, hull } of pairsRef.current) {
      let visible = true;
      let current: THREE.Object3D | null = source;
      while (current) {
        if (!current.visible) {
          visible = false;
          break;
        }
        current = current.parent;
      }

      hull.visible = visible;
      if (!visible) {
        continue;
      }

      source.matrixWorld.decompose(tmpPosition, tmpQuaternion, tmpScale);
      tmpScale.multiplyScalar(1 + thickness);
      hull.matrix.compose(tmpPosition, tmpQuaternion, tmpScale);

      if ((source as THREE.SkinnedMesh).isSkinnedMesh && (hull as THREE.SkinnedMesh).isSkinnedMesh) {
        const sourceSkinned = source as THREE.SkinnedMesh;
        const hullSkinned = hull as THREE.SkinnedMesh;
        if (hullSkinned.skeleton !== sourceSkinned.skeleton) {
          hullSkinned.bind(sourceSkinned.skeleton, sourceSkinned.bindMatrix);
        }
      }
    }
  });

  return null;
};

export const GameScene: React.FC<SceneProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const outlineHeroRef = useRef<THREE.Group>(null);
  const outlineEnemyRef = useRef<THREE.Group>(null);
  const [gameTime, setGameTime] = useState("12:00");
  const handleTimeUpdate = useCallback((time: string) => {
    setGameTime(time);
    props.onGameTimeUpdate?.(time);
  }, [props.onGameTimeUpdate]);
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const isMobileDevice = useMemo(() => getRenderPlatform() === 'mobile', []);
  const shouldUseForestDepthOfField = !isMobileDevice && !quality.isLowQuality;
  const shouldUseDungeonDepthOfField = false;
  const forestBloomIntensity = isMobileDevice ? 0.32 : 0.44;
  const dungeonBloomIntensity = isMobileDevice ? 0.22 : 0.28;
  const forestDepthOfFieldHeight = 440;
  const dungeonDepthOfFieldHeight = 440;
  const isDungeonRun = Boolean(props.isDungeonScene ?? props.isDungeonRun);
  const shouldUsePostProcessing = true;
  const shouldUseBloomAndVignette = !isMobileDevice;
  const postProcessingMultisampling = isMobileDevice ? 0 : 4;
  const backfaceOutlineThickness = isMobileDevice ? 0.055 : 0.07;
  const outlineTargets = useMemo(() => [outlineHeroRef, outlineEnemyRef], []);
  const glPowerPreference = useMemo(() => getRenderPowerPreference(), []);
  const shouldRenderAmbientDrift = !isMobileDevice;
  const particleRenderCap = isMobileDevice ? 72 : 120;
  const visibleParticles = useMemo(
    () => props.particles.slice(-particleRenderCap),
    [particleRenderCap, props.particles],
  );
  const shouldUseDepthOfField = isDungeonRun ? shouldUseDungeonDepthOfField : shouldUseForestDepthOfField;
  const activeDepthOfFieldRange = isDungeonRun ? DUNGEON_FOCUS_RANGE : FOREST_FOCUS_RANGE;
  const activeDepthOfFieldBokeh = isDungeonRun ? 1.7 : 1.95;
  const activeDepthOfFieldHeight = isDungeonRun ? dungeonDepthOfFieldHeight : forestDepthOfFieldHeight;
  const activeBloomIntensity = isDungeonRun ? dungeonBloomIntensity : forestBloomIntensity;
  const activeBloomThreshold = isDungeonRun ? 0.5 : (shouldUseDepthOfField ? 0.42 : 0.48);
  const activeBloomSmoothing = isDungeonRun ? 0.85 : (shouldUseDepthOfField ? 0.8 : 0.82);
  const activeVignetteOffset = isDungeonRun ? 0.1 : (shouldUseDepthOfField ? 0.06 : 0.08);
  const activeVignetteDarkness = isDungeonRun ? 0.42 : (shouldUseDepthOfField ? 0.1 : 0.13);
  const battleContactShadowResolution = useMemo(
    () => quality.isLowQuality ? 48 : Math.min(quality.contactShadowResolution, 96),
    [quality.contactShadowResolution, quality.isLowQuality],
  );

  const bgColor = useMemo(() => {
    if (isDungeonRun) {
      return '#111827';
    }
    return '#d7e6c2';
  }, [isDungeonRun, props.stage]);

  const activeScenario = useMemo(() => getScenario('forest'), []);
  const enemyOverlay = null;
  const latestEnemyImpactColor = useMemo(() => {
    for (let i = props.particles.length - 1; i >= 0; i -= 1) {
      const particle = props.particles[i];
      if (particle.position[0] > 0.8) {
        return particle.color;
      }
    }
    return '#fef08a';
  }, [props.particles]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 transition-colors duration-1000" style={{ backgroundColor: bgColor }}>
      {/* Time Display Overlay - Desktop only */}
      {!isDungeonRun && (
        <div className="absolute top-6 left-6 z-10 bg-black/40 border border-white/10 px-4 py-1 rounded-full hidden sm:flex items-center gap-3 pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="font-mono text-white text-sm tracking-widest">{gameTime}</span>
        </div>
      )}

      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: glPowerPreference }}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <CameraController screenShake={props.screenShake} menuFocus={props.menuCameraFocus ?? Boolean(props.isMenuView)} />
        <group>
          {isDungeonRun ? (
            <>
              <color attach="background" args={[bgColor]} />
              <fog attach="fog" args={['#1f2937', 14, 32]} />
              <DungeonAtmosphere quality={quality} />
              <DungeonScenario />
            </>
          ) : (
            <>
              <SkyboxController />
              <fog attach="fog" args={['#d7e6c2', 16, 46]} />
              <DayNightCycle containerRef={containerRef} onTimeUpdate={handleTimeUpdate} quality={quality} />
              <ambientLight intensity={0.6} />
              <hemisphereLight intensity={0.5} groundColor="#243a20" color="#f4ffe6" />
              <Suspense fallback={null}>
                <BattleScenario scenario={activeScenario} lowQuality={quality.isLowQuality} />
              </Suspense>
              <ContactShadows
                position={[0, -1.04, -0.2]}
                opacity={0.34}
                scale={22}
                blur={2.2}
                far={10}
                resolution={battleContactShadowResolution}
              />
            </>
          )}
        </group>

        <group ref={outlineHeroRef}>
          <HeroVoxel
            classId={props.playerClassId}
            playerAnimationAction={props.playerAnimationAction}
            isAttacking={props.isPlayerAttacking}
            isDefending={props.isPlayerDefending}
            weaponId={props.equippedWeaponId}
            armorId={props.equippedArmorId}
            helmetId={props.equippedHelmetId}
            legsId={props.equippedLegsId}
            shieldId={props.equippedShieldId}
            isLevelingUp={props.isLevelingUp}
            levelUpCardCategory={props.levelUpCardCategory}
            isMenuView={props.isMenuView}
            isHit={props.isPlayerHit}
            isPlayerCritHit={props.isPlayerCritHit}
            hasPerfectEvadeAura={props.hasPerfectEvadeAura}
            hasDoubleAttackAura={props.hasDoubleAttackAura}
            impulseLevel={props.impulseLevel}
            activeImpulseLevel={props.activeImpulseLevel}
            playerState={props.playerState}
            contactShadowResolution={quality.contactShadowResolution}
            loadSecondaryAnimationBundles
            onHeroClick={props.isMenuView ? props.onMenuHeroClick : undefined}
          />
        </group>

        <group ref={outlineEnemyRef}>
          {!props.isMenuView && (
            <EnemyCharacter
              assets={props.enemyAssets}
              color={props.enemyColor}
              scale={props.enemyScale}
              isAttacking={props.isEnemyAttacking}
              isDefending={props.isEnemyDefending}
              defendImpulseLevel={props.enemyState?.impulseGuardLevel ?? 0}
              animationActionOverride={props.enemyAnimationAction}
              type={props.enemyType}
              enemyName={props.enemyName}
              isBoss={props.isEnemyBoss}
              isHit={props.isEnemyHit}
              attackStyle={props.enemyAttackStyle}
              contactShadowResolution={quality.contactShadowResolution}
              statusOverlay={enemyOverlay}
            />
          )}
        </group>

        <BackfaceHullOverlay
          targets={outlineTargets}
          thickness={backfaceOutlineThickness}
          color="#000000"
        />

        {!props.isMenuView && (
          <EnemyIntentOverlay
            intent={props.enemyIntentPreview}
            isBoss={props.isEnemyBoss}
            show={props.turnState === TurnState.PLAYER_INPUT}
          />
        )}
        {!props.isMenuView && (
          <Suspense fallback={null}>
            <CombatCinematicFX
              playerAnimationAction={props.playerAnimationAction}
              enemyAnimationAction={props.enemyAnimationAction}
              playerExecutionAnimationId={props.playerExecutionAnimationId}
              enemyExecutionAnimationId={props.enemyExecutionAnimationId}
              playerExecutionAnimationTintColor={props.playerExecutionAnimationTintColor}
              enemyExecutionAnimationTintColor={props.enemyExecutionAnimationTintColor}
              playerImpactAnimationId={props.playerImpactAnimationId}
              enemyImpactAnimationId={props.enemyImpactAnimationId}
              playerImpactAnimationTintColor={props.playerImpactAnimationTintColor}
              enemyImpactAnimationTintColor={props.enemyImpactAnimationTintColor}
              playerImpactAnimationTarget={props.playerImpactAnimationTarget}
              enemyImpactAnimationTarget={props.enemyImpactAnimationTarget}
              playerImpactAnimationTrigger={props.playerImpactAnimationTrigger}
              enemyImpactAnimationTrigger={props.enemyImpactAnimationTrigger}
              playerBowShotTrigger={props.playerBowShotTrigger}
              enemyBowShotTrigger={props.enemyBowShotTrigger}
              playerBowShotDidHit={props.playerBowShotDidHit}
              enemyBowShotDidHit={props.enemyBowShotDidHit}
              isPlayerAttacking={props.isPlayerAttacking}
              isEnemyAttacking={props.isEnemyAttacking}
              isEnemyHit={props.isEnemyHit}
              isPlayerHit={props.isPlayerHit}
              equippedWeaponId={props.equippedWeaponId}
              enemyAttackStyle={props.enemyAttackStyle}
              latestEnemyImpactColor={latestEnemyImpactColor}
              activeImpulseLevel={props.activeImpulseLevel}
              enemyImpulseLevel={props.enemyState?.impulso ?? 0}
              particleLoad={props.particles.length}
            />
          </Suspense>
        )}
        {shouldRenderAmbientDrift ? (
          <AmbientDriftParticles isLowQuality={quality.isLowQuality} isDungeonRun={isDungeonRun} />
        ) : null}

        {visibleParticles.map((particle) => <MeshParticle key={particle.id} {...particle} />)}
        <WorldFloatingTexts texts={props.floatingTexts} />

        {shouldUsePostProcessing ? (
          <EffectComposer multisampling={postProcessingMultisampling}>
            {shouldUseDepthOfField ? (
              <DepthOfField
                target={CHARACTER_FOCUS_TARGET}
                worldFocusRange={activeDepthOfFieldRange}
                bokehScale={activeDepthOfFieldBokeh}
                height={activeDepthOfFieldHeight}
              />
            ) : null}
            {shouldUseBloomAndVignette ? (
              <>
                <Bloom intensity={activeBloomIntensity} luminanceThreshold={activeBloomThreshold} luminanceSmoothing={activeBloomSmoothing} mipmapBlur />
                <Vignette eskil={false} offset={activeVignetteOffset} darkness={activeVignetteDarkness} />
              </>
            ) : null}
          </EffectComposer>
        ) : null}
      </Canvas>
    </div>
  );
};

export const DeveloperHeroScene: React.FC<DeveloperHeroSceneProps> = (props) => (
  <DeveloperHeroSceneRenderer {...props} HeroVoxelComponent={HeroVoxel} />
);

export const DeveloperMonsterScene: React.FC<DeveloperMonsterSceneProps> = (props) => (
  <DeveloperMonsterSceneRenderer {...props} EnemyCharacterComponent={EnemyCharacter} />
);

const ModularClassHeroVoxel = ({
  baseClassId,
  partSelections,
  partTransforms,
  equippedWeaponId,
  weaponTransformOverride,
  showWeaponAnchorHelper = false,
  showWeaponTransformControls = false,
  weaponTransformControlMode = 'translate',
  onWeaponTransformOverrideChange,
  animationAction = 'idle',
  animationClipName,
  preferredAnimationBundle,
  loadAllAnimationBundles = false,
  loadSecondaryAnimationBundles = true,
  onAvailableAnimationClipsChange,
  onRuntimeDiagnosticChange,
  isAttacking,
  isDefending,
  isHit,
  contactShadowResolution = 256,
}: {
  baseClassId: PlayerClassId;
  partSelections: Record<DeveloperKitbashMainSlot, PlayerClassId>;
  partTransforms?: Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>;
  equippedWeaponId?: string;
  weaponTransformOverride?: DeveloperWeaponTransformOverride;
  showWeaponAnchorHelper?: boolean;
  showWeaponTransformControls?: boolean;
  weaponTransformControlMode?: DeveloperWeaponTransformControlMode;
  onWeaponTransformOverrideChange?: (transform: DeveloperWeaponTransformOverride) => void;
  animationAction?: PlayerAnimationAction;
  animationClipName?: string;
  preferredAnimationBundle?: string;
  loadAllAnimationBundles?: boolean;
  loadSecondaryAnimationBundles?: boolean;
  onAvailableAnimationClipsChange?: (clipNames: string[]) => void;
  onRuntimeDiagnosticChange?: (diagnostic: DeveloperAnimationRuntimeDiagnostic) => void;
  isAttacking?: boolean;
  isDefending?: boolean;
  isHit?: boolean;
  contactShadowResolution?: number;
}) => {
  const baseClass = getPlayerClassById(baseClassId);
  const group = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);
  const flashMaterialsRef = useRef<THREE.Material[]>([]);
  const baseRuntimeAssets = baseClass.assets as RuntimeHeroAssets;
  const headAssets = resolveRuntimeClassAssets(partSelections.head) ?? baseRuntimeAssets;
  const torsoAssets = resolveRuntimeClassAssets(partSelections.torso) ?? baseRuntimeAssets;
  const armsAssets = resolveRuntimeClassAssets(partSelections.arms) ?? baseRuntimeAssets;
  const legsAssets = resolveRuntimeClassAssets(partSelections.legs) ?? baseRuntimeAssets;
  const baseModelSource = useFBX(baseRuntimeAssets.modelUrl);
  const baseTexture = useTexture(baseRuntimeAssets.textureUrl);
  const headModelSource = useFBX(headAssets.modelUrl);
  const torsoModelSource = useFBX(torsoAssets.modelUrl);
  const armsModelSource = useFBX(armsAssets.modelUrl);
  const legsModelSource = useFBX(legsAssets.modelUrl);
  const headTexture = useTexture(headAssets.textureUrl);
  const torsoTexture = useTexture(torsoAssets.textureUrl);
  const armsTexture = useTexture(armsAssets.textureUrl);
  const legsTexture = useTexture(legsAssets.textureUrl);
  const animationMap = baseRuntimeAssets.animationMap;
  const primaryAnimationBundle = useMemo(
    () => selectPrimaryAnimationBundle(baseRuntimeAssets, animationAction, preferredAnimationBundle),
    [animationAction, baseRuntimeAssets, preferredAnimationBundle],
  );
  const animationSource = useLoader(FBXLoader, primaryAnimationBundle.url) as THREE.Group;
  const secondaryBundles = useMemo(
    () => selectSecondaryAnimationBundles(baseRuntimeAssets, primaryAnimationBundle.fileName, loadAllAnimationBundles, loadSecondaryAnimationBundles),
    [baseRuntimeAssets, loadAllAnimationBundles, loadSecondaryAnimationBundles, primaryAnimationBundle.fileName],
  );
  const secondaryAnimationSources = useLoader(FBXLoader, secondaryBundles.map((bundle) => bundle.url)) as THREE.Group[];
  const evadeDirectionRef = useRef<'left' | 'right'>('left');
  const previousAnimationActionRef = useRef<PlayerAnimationAction>(animationAction);
  const activePlaybackKeyRef = useRef<string | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const layers = useMemo(() => KITBASH_MAIN_SLOTS.map((slot) => ({
    slot,
    classId: partSelections[slot],
    assets: resolveRuntimeClassAssets(partSelections[slot]),
  })).filter((layer): layer is { slot: DeveloperKitbashMainSlot; classId: PlayerClassId; assets: RuntimeHeroAssets } => Boolean(layer.assets)), [partSelections]);

  const hiddenBaseSlots = useMemo(
    () => KITBASH_MAIN_SLOTS.filter((slot) => partSelections[slot] !== baseClassId),
    [baseClassId, partSelections],
  );

  const basePreparedModel = useMemo(() => prepareRuntimeHeroModel({
    sourceModel: baseModelSource,
    texture: baseTexture,
    calibration: baseClass.assets.calibration,
    hiddenPartSlots: hiddenBaseSlots,
  }), [baseClass.assets.calibration, baseModelSource, baseTexture, hiddenBaseSlots]);

  const backgroundClips = useMemo(() => (
    secondaryBundles.flatMap((bundle, index) => {
      const source = secondaryAnimationSources[index];

      if (!source) {
        return [];
      }

      return source.animations.map((clip) => {
        const renamedClip = clip.clone();
        renamedClip.name = `${bundle.fileName.replace(/\.fbx$/i, '')}:${clip.name}`;
        return renamedClip;
      });
    })
  ), [secondaryAnimationSources, secondaryBundles]);

  const mergedClips = useMemo(() => {
    const primaryClips = animationSource.animations.map((clip) => {
      const renamedClip = clip.clone();
      renamedClip.name = `${primaryAnimationBundle.fileName.replace(/\.fbx$/i, '')}:${clip.name}`;
      return renamedClip;
    });

    return [...primaryClips, ...backgroundClips];
  }, [animationSource.animations, backgroundClips, primaryAnimationBundle.fileName]);

  const boundClips = useMemo(
    () => remapClipBindingsToSkeleton({ clips: mergedClips, targetModel: basePreparedModel }),
    [basePreparedModel, mergedClips],
  );

  const clipMap = useMemo(() => ({
    'battle-idle': findBestClipName(boundClips, 'battle-idle'),
    idle: findBestClipName(boundClips, 'idle'),
    attack: findBestClipName(boundClips, 'attack'),
    defend: findBestClipName(boundClips, 'defend'),
    'defend-hit': findBestClipName(boundClips, 'defend-hit'),
    hit: findBestClipName(boundClips, 'hit'),
    'critical-hit': findBestClipName(boundClips, 'critical-hit'),
    item: findBestClipName(boundClips, 'item'),
    heal: findBestClipName(boundClips, 'heal'),
    skill: findBestClipName(boundClips, 'skill'),
    evade: findBestClipName(boundClips, 'evade'),
    death: findBestClipName(boundClips, 'death'),
  }), [boundClips]);

  const overlayModels = useMemo(() => {
    const preparedBySlot: Record<DeveloperKitbashMainSlot, THREE.Group> = {
      head: prepareRuntimeHeroModel({
        sourceModel: headModelSource,
        texture: headTexture,
        calibration: baseClass.assets.calibration,
        visiblePartSlots: ['head'],
      }),
      torso: prepareRuntimeHeroModel({
        sourceModel: torsoModelSource,
        texture: torsoTexture,
        calibration: baseClass.assets.calibration,
        visiblePartSlots: ['torso'],
      }),
      arms: prepareRuntimeHeroModel({
        sourceModel: armsModelSource,
        texture: armsTexture,
        calibration: baseClass.assets.calibration,
        visiblePartSlots: ['arms'],
      }),
      legs: prepareRuntimeHeroModel({
        sourceModel: legsModelSource,
        texture: legsTexture,
        calibration: baseClass.assets.calibration,
        visiblePartSlots: ['legs'],
      }),
    };

    return layers.map((layer) => {
      const preparedOverlay = preparedBySlot[layer.slot];
      rebindPreparedModelToSkeleton({ sourceModel: preparedOverlay, targetModel: basePreparedModel });
      return {
        ...layer,
        preparedModel: preparedOverlay,
      };
    });
  }, [armsModelSource, armsTexture, baseClass.assets.calibration, basePreparedModel, headModelSource, headTexture, layers, legsModelSource, legsTexture, torsoModelSource, torsoTexture]);

  const { actions } = useAnimations(boundClips, basePreparedModel);

  useEffect(() => {
    if (!onAvailableAnimationClipsChange) {
      return;
    }

    onAvailableAnimationClipsChange(boundClips.map((clip) => clip.name).sort((left, right) => left.localeCompare(right)));
  }, [boundClips, onAvailableAnimationClipsChange]);

  useEffect(() => {
    if (animationAction === 'evade' && previousAnimationActionRef.current !== 'evade') {
      evadeDirectionRef.current = Math.random() < 0.5 ? 'left' : 'right';
    }

    previousAnimationActionRef.current = animationAction;
  }, [animationAction]);

  const equippedWeaponGrip = getEquippedWeaponGrip(equippedWeaponId);

  useEffect(() => {
    const fallbackClip = clipMap['battle-idle'] ?? clipMap.idle ?? boundClips[0]?.name;
    const automaticClipName = resolveAutomaticClipName({
      clips: boundClips,
      animationMap,
      action: animationAction,
      hasWeapon: Boolean(equippedWeaponId),
      equippedWeaponGrip,
      evadeDirection: evadeDirectionRef.current,
    });
    const targetClipName = animationClipName && actions[animationClipName]
      ? animationClipName
      : automaticClipName ?? clipMap[animationAction] ?? fallbackClip;
    const isManualPreview = Boolean(animationClipName && actions[animationClipName]);

    const emitStatus = (status: DeveloperAnimationRuntimeDiagnostic['status'], actionStarted: boolean) => {
      layers.forEach((layer) => {
        onRuntimeDiagnosticChange?.({
          previewId: `modular-${layer.slot}`,
          label: `Modular ${layer.slot}`,
          animationAction,
          targetClipName,
          automaticClipName,
          boundClipCount: boundClips.length,
          actionStarted,
          status,
        });
      });
    };

    if (!targetClipName) {
      emitStatus('missing-target-clip', false);
      return;
    }

    const nextAction = actions[targetClipName];
    if (!nextAction) {
      emitStatus('missing-action', false);
      return;
    }

    const playbackKey = `${animationAction}:${targetClipName}:${isManualPreview ? 'manual' : 'auto'}:${loadAllAnimationBundles ? 'all' : 'partial'}`;
    const shouldRestartAction = activeActionRef.current !== nextAction
      || activePlaybackKeyRef.current !== playbackKey
      || !nextAction.isRunning();

    if (!shouldRestartAction) {
      emitStatus('playing', true);
      return;
    }

    Object.entries(actions).forEach(([name, action]) => {
      if (!action || name === targetClipName) {
        return;
      }

      action.fadeOut(0.14);
    });

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(isManualPreview ? 1 : animationAction === 'defend' ? 0.85 : animationAction === 'heal' ? 0.92 : animationAction === 'death' ? 0.82 : 1);

    if (isManualPreview || animationAction === 'idle' || animationAction === 'battle-idle' || animationAction === 'defend') {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    } else {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    }

    nextAction.fadeIn(0.14).play();
    activeActionRef.current = nextAction;
    activePlaybackKeyRef.current = playbackKey;
    emitStatus('playing', true);
  }, [actions, animationAction, animationClipName, animationMap, boundClips, clipMap, equippedWeaponGrip, equippedWeaponId, layers, loadAllAnimationBundles, onRuntimeDiagnosticChange]);

  useEffect(() => () => {
    activeActionRef.current?.fadeOut(0.12);
    activeActionRef.current = null;
    activePlaybackKeyRef.current = null;
  }, []);

  useEffect(() => {
    if (!group.current) {
      return;
    }

    const collectedMaterials: THREE.Material[] = [];
    group.current.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;

      if (!mesh.isMesh || !mesh.material) {
        return;
      }

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => collectedMaterials.push(material));
      } else {
        collectedMaterials.push(mesh.material);
      }
    });

    flashMaterialsRef.current = collectedMaterials;
  }, [overlayModels, partTransforms]);

  useFrame(() => {
    if (!group.current) {
      return;
    }

    if (isAttacking) {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0.18, 0.2);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.2);
    } else if (isDefending) {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -0.12, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.12);
      group.current.rotation.x = 0.2;
    } else {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, 0, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.12);
      group.current.rotation.x = 0;
    }

    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0.35, 0.16);

    if (isHit) {
      flashRef.current = 1;
    } else {
      flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.1);
    }

    if (!isHit && flashRef.current < 0.01) {
      return;
    }

    flashMaterialsRef.current.forEach((material) => applyHitFlashToMaterial(material, Boolean(isHit), flashRef.current * 2));
  });

  return (
    <group>
      <group ref={group} position={[0, -1, 0]} rotation={[0, 0.35, 0]}>
        <Suspense fallback={null}>
          <group>
            <primitive object={basePreparedModel} />
            {getRegisteredWeapon3DByItemId(equippedWeaponId) ? (
              <EquippedWeaponAttachment
                characterModel={basePreparedModel}
                weaponId={equippedWeaponId}
                weaponTransformOverride={weaponTransformOverride}
                showAnchorHelper={showWeaponAnchorHelper}
                showTransformControls={showWeaponTransformControls}
                transformControlMode={weaponTransformControlMode}
                onWeaponTransformChange={onWeaponTransformOverrideChange}
              />
            ) : null}
          </group>
          {overlayModels.map((layer) => {
            const transform = partTransforms?.[layer.slot];
            const layerPosition = transform?.positionOffset ?? [0, 0, 0];
            const layerPivot = transform?.pivot ?? [0, 0, 0];
            const layerScale = transform ? [transform.scale, transform.scale, transform.scale] as [number, number, number] : [1, 1, 1] as [number, number, number];
            const inversePivot = transform ? [-transform.pivot[0], -transform.pivot[1], -transform.pivot[2]] as [number, number, number] : [0, 0, 0] as [number, number, number];

            return (
              <group key={`modular-${layer.slot}-${layer.classId}`} position={layerPosition}>
                <group position={layerPivot}>
                  <group scale={layerScale}>
                    <group position={inversePivot}>
                      <primitive object={layer.preparedModel} />
                    </group>
                  </group>
                </group>
              </group>
            );
          })}
        </Suspense>
        <ContactShadows opacity={0.35} scale={3} blur={1.8} far={2} resolution={contactShadowResolution} />
      </group>
    </group>
  );
};

export const DeveloperClassBuilderScene: React.FC<DeveloperClassBuilderSceneProps> = (props) => (
  <DeveloperClassBuilderSceneRenderer
    {...props}
    ModularClassHeroVoxelComponent={ModularClassHeroVoxel}
  />
);

export const DeveloperWeaponCalibrationScene = DeveloperWeaponCalibrationSceneRenderer;

export const DeveloperKitbashScene: React.FC<DeveloperKitbashSceneProps> = (props) => (
  <DeveloperKitbashSceneRenderer
    {...props}
    HeroVoxelComponent={HeroVoxel}
    CombinedHeroVoxelComponent={CombinedHeroVoxel}
    AnimatedClassHeroComponent={AnimatedClassHero}
    EnemyCharacterComponent={EnemyCharacter}
  />
);

