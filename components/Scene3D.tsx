import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sword, Shield, Zap, Sparkles, FlaskConical, Crosshair, Shirt, Footprints, Layers, RefreshCw, Swords, Wind, Clover, Heart, Info, X, LogOut, User } from 'lucide-react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, useAnimations, useTexture } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COMBAT_SPRITE_ANIMATION_DEFAULTS, SPRITE_ANIMATION_IDS, SPRITE_ANIMATION_REGISTRY } from '../game/data/sprite-animations/registry';
import { resolveTrackPlaybackSnapshot } from '../game/mechanics/spriteOverlayPlayback';
import { BattleActorChargeState, BattleActorGaugeMap, BattleTimelineState, CardCategory, Enemy, EnemyIntentPreview, FloatingText, GltfMonsterBodyType, Particle, Player, PlayerAnimationAction, PlayerClassAnimationMap, PlayerClassAssets, PlayerClassId, SpriteOverlayAnimationDefinition, SpriteTrackDefinition, StatusEffect, TipoDefesa, TurnState } from '../types';
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
  SkyboxController,
  getDefaultRenderQualityPreset,
  getRenderPlatform,
  getRenderPowerPreference,
  getRenderQualityProfile,
  type RenderQualityPreset,
} from './scene3d/environment';
import { configureGltfLoader, configureFBXLoader } from './scene3d/gltfLoader';
import { ScenarioParticleField } from './scene3d/developer-scenes';
import {
  AnimatedClassHero,
  EnemyCharacter,
  GltfEnemyCharacter,
  applyHitFlashToMaterial,
} from './scene3d/characters';
import { MeshParticle, WorldFloatingTexts, WorldLootDisplay, InstancedParticles, type LootResultData } from './scene3d/effects';
import {
  getKitbashRootSlot,
  KITBASH_MAIN_SLOTS,
  prepareRuntimeHeroModel,
  rebindPreparedModelToSkeleton,
} from './scene3d/kitbash';
import { EquippedWeaponAttachment } from './scene3d/weapons';
import { getRuntimeScenarioPreset } from '../game/data/runtimeScenarios';
import {
  getRuntimeMenuPortalPreset,
  MENU_NAVIGATION_PORTAL_ALBEDO_URL,
  MENU_NAVIGATION_PORTAL_EMISSIVE_URL,
  MENU_NAVIGATION_PORTAL_METALLIC_URL,
  MENU_NAVIGATION_PORTAL_MODEL_URL,
  type RuntimeMenuPortalTransform,
} from '../game/data/runtimeMenuPortal';
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
import { shouldUseMagicBasicAttack, shouldUseBowBasicAttack } from '../game/mechanics/weaponProficiency';
import { getEquippedWeaponGrip, getRegisteredWeapon3DByItemId } from '../game/data/weaponCatalog';
import { GamepadActionLegend } from './ui/GamepadActionLegend';
import { HeroItemDetailOverlay } from './scene3d/ItemDetailOverlays';
import { HeroInspectCanvas } from './scene3d/HeroInspectCanvas';
import { BattleActionsHtml, type BattleActionsConfig } from './scene3d/BattleActionsHtml';
import { PortalInspectCanvas } from './scene3d/PortalInspectCanvas';
import { useBattleVfxStore } from '../game/stores/battleVfxStore';
import { useBattleGaugeStore } from '../game/stores/battleGaugeStore';
import { useBattleStatsStore } from '../game/stores/battleStatsStore';
import { useGameTimeStore } from '../game/stores/gameTimeStore';
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
  equippedWeaponId?: string;
  equippedArmorId?: string;
  equippedHelmetId?: string;
  equippedLegsId?: string;
  equippedShieldId?: string;
  enemyType?: 'beast' | 'humanoid' | 'undead';
  isEnemyBoss?: boolean;
  isPlayerDefending?: boolean;
  playerDefenseType?: TipoDefesa | null;
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
  showMenuNavigationPortal?: boolean;
  menuPortalRegion?: 'forest' | 'dungeon' | 'tower';
  menuPortalTravelCinematicToken?: number;
  bossEntryCinematicToken?: number;
  isDungeonScene?: boolean;
  stage?: number;
  isDungeonRun?: boolean;
  menuGamepadFocus?: 'hero' | 'portal' | null;
  onGameTimeUpdate?: (time: string) => void;
  onMenuHeroClick?: () => void;
  onMenuPortalClick?: () => void;
  playerState?: Player;
  enemyState?: Enemy | null;
  enemyIntentPreview?: EnemyIntentPreview | null;
  battleTimelineState?: BattleTimelineState;
  activeBattleActorId?: string | null;
  battleActorGauges?: BattleActorGaugeMap; // DEPRECATED: gauges now flow through useBattleGaugeStore. Kept for type compat.
  renderQualityPreset?: RenderQualityPreset;
  showDesktopStatsMonitor?: boolean;
  heroInspectMode?: boolean;
  onHeroInspectClose?: () => void;
  onHeroEquipSlotClick?: (slot: 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs') => void;
  onHeroUnequipSlotClick?: (item: any) => void;
  onHeroShowItemDetail?: (item: any) => void;
  onHeroSkillSlotClick?: (slotIndex: number) => void;
  onHeroItemSlotClick?: (slotIndex: number) => void;
  onHeroUnequipItemSlot?: (slotIndex: number) => void;
  onHeroUnequipSkillSlot?: (slotIndex: number) => void;
  portalInspectMode?: boolean;
  currentSceneRegion?: 'forest' | 'dungeon' | 'tower';
  dungeonUnlocked?: boolean;
  towerUnlocked?: boolean;
  onPortalInspectClose?: () => void;
  onPortalTravelTo?: (region: 'forest' | 'dungeon' | 'tower') => void;
  /** When set, the battle renders a GLTF monster model instead of the FBX skeleton. */
  enemyGltfModelUrl?: string;
  enemyGltfBodyType?: GltfMonsterBodyType;
  /** Mobile-only battle action panel rendered via <Html> in 3D space next to the hero. */
  battleActionsConfig?: BattleActionsConfig;
  /** Kill-loot rewards to display in 3D world space at enemy position. */
  lootResult?: LootResultData | null;
  /** Icon rendered next to the XP value in the world loot display (e.g. player class icon). */
  xpIconComponent?: React.ReactNode;
  /** Extra enemies in the group (multi-enemy combat). */
  additionalEnemies?: Enemy[];
  /** Pending target action awaiting target selection. */
  pendingTargetAction?: import('../types').PendingTargetAction;
  /** Callback when a target enemy is clicked. */
  onSelectTarget?: (id: string) => void;
  /** Callback to cancel pending target selection. */
  onCancelTargetSelection?: () => void;
  /** Slot index (0/1/2) that the main enemy currently occupies visually. Prevents teleport on target swap. */
  mainEnemySlotIndex?: number;
  /** Tamanho inicial do grupo (1, 2 ou 3). Layout ÃƒÂ© escolhido por este valor e nunca muda quando inimigos morrem. */
  initialGroupSize?: number;
  /** Called when the player clicks the hero nameplate card above the 3D model in battle. */
  onHeroNameplateClick?: () => void;
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

const SPRITE_FETCH_TIMEOUT_MS = 2600;
const SPRITE_TEXTURE_LOAD_TIMEOUT_MS = 3200;

const GENERATED_ANIMATION_JSON_MODULES = import.meta.glob('../game/data/sprite-animations/generated/*.json', { eager: true });
const GENERATED_SPRITE_SHEET_URL_MODULES = import.meta.glob('../game/sprites/*', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const isOfflineRuntime = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);

const isCrossOriginHttpUrl = (value: string) => {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const parsed = new URL(value, window.location.href);
    return parsed.origin !== window.location.origin;
  } catch {
    return true;
  }
};

const loadTextureWithTimeout = (
  textureLoader: THREE.TextureLoader,
  candidate: string,
  timeoutMs: number,
) => (
  new Promise<THREE.Texture>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`Texture load timeout: ${candidate}`));
    }, timeoutMs);

    textureLoader.load(
      candidate,
      (texture) => {
        window.clearTimeout(timeoutId);
        resolve(texture);
      },
      undefined,
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  })
);

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
        if (isOfflineRuntime() && isCrossOriginHttpUrl(candidate)) {
          continue;
        }

        try {
          const loaded = await loadTextureWithTimeout(textureLoader, candidate, SPRITE_TEXTURE_LOAD_TIMEOUT_MS);
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
// Cached singleton — reused every frame to avoid per-frame allocations inside updateBowProjectile.
const _BOW_UP_AXIS = new THREE.Vector3(0, -1, 0);

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
  activeImpulseLevel,
  enemyImpulseLevel,
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
  activeImpulseLevel?: number;
  enemyImpulseLevel?: number;
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
  const [spriteFallbackDebug, setSpriteFallbackDebug] = useState({ missingDefinitions: 0, missingTextures: 0 });
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
  // Pre-allocated Vector3 temps — avoids per-frame heap allocations inside updateBowProjectile.
  const _bowTmpPosition = useRef(new THREE.Vector3());
  const _bowTmpDirection = useRef(new THREE.Vector3());
  const _bowTmpOrientation = useRef(new THREE.Vector3());
  const _bowTmpFadeOffset = useRef(new THREE.Vector3());
  // Track previous opacity per projectile so needsUpdate is only set when it actually changes.
  const playerBowPrevOpacityRef = useRef(1);
  const enemyBowPrevOpacityRef = useRef(1);
  const bowProjectileModelSource = useLoader(FBXLoader, BOW_PROJECTILE_MODEL_URL, configureFBXLoader) as THREE.Group;
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
        if (isOfflineRuntime() && isCrossOriginHttpUrl(candidate)) {
          continue;
        }

        try {
          const loaded = await loadTextureWithTimeout(textureLoader, candidate, SPRITE_TEXTURE_LOAD_TIMEOUT_MS);
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

      if (isOfflineRuntime() && isCrossOriginHttpUrl(url)) {
        return null;
      }

      let timeoutId: number | null = null;
      try {
        const controller = new AbortController();
        timeoutId = window.setTimeout(() => controller.abort(), SPRITE_FETCH_TIMEOUT_MS);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        return await response.json() as SpriteOverlayAnimationDefinition;
      } catch {
        return null;
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
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
      const missingDefinitionIds: string[] = [];
      const missingTextureIds: string[] = [];
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
        if (!definition) {
          missingDefinitionIds.push(entry.id);
          continue;
        }
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
        if (!baseTextureSet) {
          missingTextureIds.push(entry.id);
          continue;
        }

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
      setSpriteFallbackDebug({
        missingDefinitions: missingDefinitionIds.length,
        missingTextures: missingTextureIds.length,
      });
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
    const storeParticles = useBattleVfxStore.getState().particles;
    const pCount = storeParticles.length;
    const loadScale = pCount > 84 ? 0.65 : pCount > 64 ? 0.82 : 1;
    // Derive impact color from latest enemy-side particle
    let latestEnemyImpactColor: string | undefined;
    for (let _i = storeParticles.length - 1; _i >= 0; _i--) {
      if (storeParticles[_i].position[0] > 0.8) { latestEnemyImpactColor = storeParticles[_i].color; break; }
    }
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
      projectileRef: React.RefObject<THREE.Group | null>,
      projectileStateRef: React.MutableRefObject<BowProjectileState | null>,
      prevOpacityRef: React.MutableRefObject<number>,
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
      const nextPosition = _bowTmpPosition.current;
      const nextDirection = _bowTmpDirection.current.set(shot.direction, -0.02, 0);
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
            .add(_bowTmpFadeOffset.current.set(shot.direction * 0.06 * fadeProgress, -0.03 * fadeProgress, 0));
          nextDirection.copy(shot.hitDirection);
        } else {
          nextPosition.lerpVectors(shot.missPoint, shot.missFadePoint, fadeProgress);
          nextDirection.copy(shot.missFadePoint).sub(shot.missPoint);
        }
      }

      projectile.position.copy(nextPosition);
      const orientationDirection = _bowTmpOrientation.current.copy(nextDirection);
      orientationDirection.y += 0.18;
      if (orientationDirection.lengthSq() < 0.00001) {
        orientationDirection.set(shot.direction, 0, 0);
      }
      orientationDirection.normalize();
      // The FBX arrow's tip axis points down (-Y), so align that axis to the flight direction.
      projectile.quaternion.setFromUnitVectors(_BOW_UP_AXIS, orientationDirection);
      const scale = BOW_PROJECTILE_BASE_SCALE * (0.86 + (opacity * 0.14));
      projectile.scale.setScalar(scale);

      const opacityChanged = opacity !== prevOpacityRef.current;
      prevOpacityRef.current = opacity;
      if (opacityChanged) {
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
      }
    };

    updateBowProjectile(playerBowProjectileRef, playerBowProjectileStateRef, playerBowPrevOpacityRef);
    updateBowProjectile(enemyBowProjectileRef, enemyBowProjectileStateRef, enemyBowPrevOpacityRef);

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
      {(spriteFallbackDebug.missingDefinitions > 0 || spriteFallbackDebug.missingTextures > 0) ? (
        <Html center sprite distanceFactor={9.2} position={[0, 3.1, 0]} zIndexRange={[170, 0]}>
          <div className="rounded-lg border border-amber-200/70 bg-[#111827]/80 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.13em] text-amber-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
            FX fallback ativo
            <div className="mt-1 text-[9px] font-bold tracking-[0.08em] text-amber-50/95">
              json {spriteFallbackDebug.missingDefinitions} | textura {spriteFallbackDebug.missingTextures}
            </div>
          </div>
        </Html>
      ) : null}
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

const HERO_CLASS_NAME_PT: Record<PlayerClassId, string> = {
  knight: 'Cavaleiro',
  barbarian: 'Barbaro',
  mage: 'Mago',
  ranger: 'Arqueiro',
  rogue: 'Ladino',
};

const INSPECT_CLASS_ICON: Record<PlayerClassId, React.ComponentType<{ size?: number }>> = {
  knight: Shield,
  barbarian: Sword,
  mage: Sparkles,
  ranger: Crosshair,
  rogue: Zap,
};

// Ã¢â€â‚¬Ã¢â€â‚¬ Potion slot stat badges Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const HeroVoxel = ({ classId = 'knight', playerAnimationAction = 'idle', animationClipName, preferredAnimationBundle, onAvailableAnimationClipsChange, loadAllAnimationBundles = false, loadSecondaryAnimationBundles = true, previewLoopAllActions = false, isAttacking, isDefending, defenseType = 'MAGICA', weaponId, armorId, helmetId, legsId, shieldId, isLevelingUp, levelUpCardCategory = 'especial', isMenuView = false, isHit, isPlayerCritHit, hasPerfectEvadeAura, hasDoubleAttackAura, impulseLevel = 0, activeImpulseLevel = 0, contactShadowResolution = 256, idlePositionX = -2, attackPositionX = 0.5, defendPositionX = -1.5, idlePositionY = -1, attackPositionY = -1, defendPositionY = -1, originPosition = [-2, -1, 0], baseRotationY = 0.5, hiddenPartSlots, visiblePartSlots, runtimeAssetsOverride, calibrationOverride, debugRuntimeId, debugRuntimeLabel, onRuntimeDiagnosticChange, statusOverlay, onHeroClick, playerState, isPlayerTurn = false, forceHighlight = false }: any) => {
  const playerClass = getPlayerClassById(classId);
  const runtimeHeroAssets = runtimeAssetsOverride ?? (hasRuntimeFbxAssets(playerClass.assets) ? playerClass.assets : null);
  const group = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);
  const defendImpulseAuraRef = useRef<THREE.Group>(null);
  const phantomAuraRef = useRef<THREE.Group>(null);
  const twinAuraRef = useRef<THREE.Group>(null);
  const heroHighlightRingRef = useRef<THREE.Mesh>(null);
  const turnRingRef = useRef<THREE.Mesh>(null);
  const heroHighlightTimeoutRef = useRef<number | null>(null);
  const flashRef = useRef<number>(0);
  const wasHitRef = useRef(false);
  const flashMaterialsRef = useRef<THREE.Material[]>([]);
  const damageLightRef = useRef<THREE.PointLight>(null);
  const healLightRef = useRef<THREE.PointLight>(null);
  const [isHeroHighlighted, setIsHeroHighlighted] = useState(false);
  const heroClassColor = playerClass.visualProfile.secondaryColor ?? '#60a5fa';
  const heroClassLabel = HERO_CLASS_NAME_PT[playerClass.id] ?? playerClass.name;
  const defendImpulseLevel = useMemo(() => {
    if (!playerState?.buffs) return 0;
    if ((playerState.buffs.guaranteedCounterTurns ?? 0) > 0) return 3;
    if ((playerState.buffs.perfectGuardTurns ?? 0) > 0) return 3;
    if ((playerState.buffs.impulseDefenseLevel ?? 0) > 0) return playerState.buffs.impulseDefenseLevel;
    if ((playerState.buffs.impulseDefenseBoostTurns ?? 0) > 0) return 1;
    return 0;
  }, [playerState?.buffs]);
  const defendImpulseColor = defendImpulseLevel >= 3 ? '#7dd3fc' : defendImpulseLevel === 2 ? '#a855f7' : '#ef4444';
  const showMagicDefenseOrb = Boolean(isDefending);

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

  useEffect(() => () => {
    if (typeof document !== 'undefined' && document.body.style.cursor === 'pointer') {
      document.body.style.cursor = '';
    }
    if (heroHighlightTimeoutRef.current !== null) {
      window.clearTimeout(heroHighlightTimeoutRef.current);
      heroHighlightTimeoutRef.current = null;
    }
  }, []);

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
      // Idle/Action movement Ã¢â‚¬â€ stay at attack position while animation is still playing
      const isInAttackAnimation = isAttacking;
      if (isInAttackAnimation) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, attackPositionX, 0.2);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, attackPositionY, 0.2);
      } else if (isDefending) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, defendPositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, defendPositionY, 0.12);
        group.current.rotation.x = 0.2;
      } else {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, idlePositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, idlePositionY, 0.12);
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
      shieldRef.current.visible = showMagicDefenseOrb;
      if (showMagicDefenseOrb) {
        shieldRef.current.rotation.y += 0.05;
        shieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
      }
    }

    if (defendImpulseAuraRef.current) {
      const auraVisible = Boolean(isDefending) && defendImpulseLevel > 0;
      defendImpulseAuraRef.current.visible = auraVisible;
      if (auraVisible) {
        defendImpulseAuraRef.current.rotation.y += 0.07 + (defendImpulseLevel * 0.01);
        defendImpulseAuraRef.current.position.y = -0.18 + Math.sin(state.clock.elapsedTime * 5.5) * 0.04;
        defendImpulseAuraRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.set(defendImpulseColor);
            child.material.emissive.set(defendImpulseColor);
          }
        });
      }
    }

    if (phantomAuraRef.current) {
      phantomAuraRef.current.visible = Boolean(hasPerfectEvadeAura);
      if (hasPerfectEvadeAura) {
        phantomAuraRef.current.rotation.y += 0.025;
        phantomAuraRef.current.position.y = 0.15 + Math.sin(state.clock.elapsedTime * 2.5) * 0.04;
        phantomAuraRef.current.children.forEach((child, index) => {
          child.position.y = Math.sin(state.clock.elapsedTime * 2 + index) * 0.08;
        });
      }
    }

    if (twinAuraRef.current) {
      twinAuraRef.current.visible = Boolean(hasDoubleAttackAura);
      if (hasDoubleAttackAura) {
        twinAuraRef.current.rotation.y -= 0.08;
        twinAuraRef.current.position.y = 0.45 + Math.sin(state.clock.elapsedTime * 6) * 0.03;
        twinAuraRef.current.children.forEach((child, index) => {
          child.rotation.z += 0.03 + index * 0.005;
        });
      }
    }

    if (heroHighlightRingRef.current) {
      const ringMaterial = heroHighlightRingRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 1 + (Math.sin(state.clock.elapsedTime * 5.1) * 0.08);
      heroHighlightRingRef.current.scale.set(pulse, pulse, 1);
      ringMaterial.opacity = isHeroHighlighted || forceHighlight
        ? 0.72 + ((Math.sin(state.clock.elapsedTime * 6.2) + 1) * 0.08)
        : 0;
    }

    if (turnRingRef.current) {
      const mat = turnRingRef.current.material as THREE.MeshBasicMaterial;
      const showTurn = Boolean(isPlayerTurn) && !isMenuView && !isAttacking;
      const targetOpacity = showTurn ? 0.55 + Math.sin(state.clock.elapsedTime * 2.6) * 0.20 : 0;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.07);
      mat.color.set(heroClassColor);
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2.1) * 0.035;
      turnRingRef.current.scale.set(scale, scale, 1);
    }

  });

  const handleHeroPointerDown = useCallback((event: any) => {
    if (!onHeroClick) {
      return;
    }

    event.stopPropagation();
    if (heroHighlightTimeoutRef.current !== null) {
      window.clearTimeout(heroHighlightTimeoutRef.current);
      heroHighlightTimeoutRef.current = null;
    }
    setIsHeroHighlighted(true);
    heroHighlightTimeoutRef.current = window.setTimeout(() => {
      heroHighlightTimeoutRef.current = null;
      setIsHeroHighlighted(false);
    }, 1200);
  }, [onHeroClick]);

  const handleHeroPointerOver = useCallback((event: any) => {
    if (!onHeroClick) {
      return;
    }

    event.stopPropagation();
    if (heroHighlightTimeoutRef.current !== null) {
      window.clearTimeout(heroHighlightTimeoutRef.current);
      heroHighlightTimeoutRef.current = null;
    }
    setIsHeroHighlighted(true);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'pointer';
    }
  }, [onHeroClick]);

  const handleHeroPointerOut = useCallback((event: any) => {
    if (!onHeroClick) {
      return;
    }

    event.stopPropagation();
    if (heroHighlightTimeoutRef.current !== null) {
      window.clearTimeout(heroHighlightTimeoutRef.current);
      heroHighlightTimeoutRef.current = null;
    }
    setIsHeroHighlighted(false);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = '';
    }
  }, [onHeroClick]);

  const handleHeroClick = useCallback((event: any) => {
    if (!onHeroClick) {
      return;
    }

    event.stopPropagation();
    onHeroClick();
  }, [onHeroClick]);

  return (
    <group>
      <group
        ref={group}
        position={originPosition}
        rotation={[0, baseRotationY, 0]}
      >
        <group
          onPointerDown={handleHeroPointerDown}
          onPointerOver={handleHeroPointerOver}
          onPointerOut={handleHeroPointerOut}
          onClick={handleHeroClick}
        >
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
          ) : (
            <group>
              <mesh position={[0, 0.9, 0]}>
                <boxGeometry args={[0.7, 1.3, 0.52]} />
                <meshStandardMaterial color="#60a5fa" wireframe transparent opacity={0.88} />
              </mesh>
              <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.7, 0.05, 10, 24]} />
                <meshStandardMaterial color="#93c5fd" emissive="#93c5fd" emissiveIntensity={0.85} transparent opacity={0.6} />
              </mesh>
              <pointLight color="#93c5fd" intensity={1.1} distance={4.8} decay={2} position={[0, 1.35, 0.3]} />
              <Html center sprite distanceFactor={8} position={[0, 2.25, 0]} zIndexRange={[170, 0]}>
                <div className="rounded-lg border border-sky-200/70 bg-[#111827]/78 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-sky-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                  Modelo de heroi indisponivel
                </div>
              </Html>
            </group>
          )}
        </group>
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
        <pointLight ref={damageLightRef} color="#ef4444" intensity={0} distance={8} decay={2.5} position={[0, 0.8, 0.3]} />
        <pointLight ref={healLightRef} color="#86efac" intensity={0} distance={9} decay={2.5} position={[0, 0.8, 0.3]} />
        {/* Rim light Ã¢â‚¬â€ behind the hero (Z positive = closer to camera side, hero faces away) */}
        <pointLight color="#bfdbfe" intensity={0.9} distance={5} decay={2} position={[0, 1.1, 1.6]} />
        {/* Fill light Ã¢â‚¬â€ subtle warm from below for volume */}
        <pointLight color="#fde68a" intensity={0.32} distance={3.5} decay={2.5} position={[0, -0.6, -0.4]} />
        {/* Turn indicator ring Ã¢â‚¬â€ visible during player turn in battle */}
        <mesh ref={turnRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.78, 0.98, 56]} />
          <meshBasicMaterial color={heroClassColor} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {onHeroClick ? (
          <>
            <mesh ref={heroHighlightRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={isHeroHighlighted || !!forceHighlight}>
              <ringGeometry args={[0.82, 1.04, 56]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.86} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <Html center position={[0, 2.45, 0]} distanceFactor={8.4} zIndexRange={[170, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  opacity: isHeroHighlighted || !!forceHighlight ? 1 : 0,
                  transform: `translateY(${isHeroHighlighted || !!forceHighlight ? '0px' : '4px'}) scale(${isHeroHighlighted || !!forceHighlight ? 1 : 0.96})`,
                  transition: 'opacity 140ms ease, transform 140ms ease',
                  fontSize: 'clamp(0.72rem, 1.7vw, 0.9rem)',
                  fontWeight: 900,
                  letterSpacing: '0.26em',
                  textTransform: 'uppercase',
                  color: heroClassColor,
                  textShadow: '0 0 1px #ffffff, 0 0 2px #ffffff, 0 0 3px #ffffff, 2px 0 #ffffff, -2px 0 #ffffff, 0 2px #ffffff, 0 -2px #ffffff, 1.5px 1.5px #ffffff, -1.5px 1.5px #ffffff, 1.5px -1.5px #ffffff, -1.5px -1.5px #ffffff',
                  whiteSpace: 'nowrap',
                }}
              >
                {heroClassLabel}
              </div>
            </Html>
          </>
        ) : null}
        <ContactShadows frames={1} opacity={0.34} scale={3.2} blur={4.5} far={2.5} resolution={contactShadowResolution} />
      </group>
      
      {/* Energy Shield Effect */}
      <group ref={shieldRef} position={[idlePositionX + 0.5, -0.2, 0]} visible={showMagicDefenseOrb}>
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

export const CombinedHeroVoxel = ({
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
    </group>
  );
};

interface BackfaceHullOverlayProps {
  targets: Array<{ current: THREE.Object3D | null }>;
  thickness: number;
  color?: string;
  /** Throttle the hull sync to this FPS (default: unlimited). Reduces CPU cost on mobile. */
  throttleFps?: number;
}

const BackfaceHullOverlay = ({
  targets,
  thickness,
  color = '#000000',
  throttleFps,
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

    return () => {
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      cleanupHulls();
      scene.remove(hullRootRef.current);
      material.dispose();
      materialRef.current = null;
    };
  }, [cleanupHulls, color, rebuildHulls, scene]);

  const tmpPosition = useMemo(() => new THREE.Vector3(), []);
  const tmpQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const hullThrottleRef = useRef(0);
  const minHullInterval = throttleFps ? (1 / throttleFps) : 0;

  useFrame((_, delta) => {
    if (minHullInterval > 0) {
      hullThrottleRef.current += delta;
      if (hullThrottleRef.current < minHullInterval) return;
      hullThrottleRef.current = 0;
    }
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

const RuntimeScenarioGlb = ({
  modelUrl,
  transform,
  editorParity = false,
}: {
  modelUrl: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
  editorParity?: boolean;
}) => {
  const gltf = useLoader(GLTFLoader, modelUrl, configureGltfLoader) as { scene: THREE.Group };

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((node: any) => {
      if (!node.isMesh) {
        return;
      }

      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material: any) => {
        if (!material || !("fog" in material)) {
          return;
        }
        material.fog = true;
        material.needsUpdate = true;
      });

      if (editorParity) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
        return;
      }

      // Imported runtime scenarios can be very dense; keep these meshes lightweight in battle.
      node.castShadow = false;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });
    return clone;
  }, [editorParity, gltf.scene]);

  const clampedScale = Math.max(0.001, transform.scale);

  return (
    <group
      position={transform.position}
      rotation={transform.rotation}
      scale={[clampedScale, clampedScale, clampedScale]}
    >
      <primitive object={model} />
    </group>
  );
};

const MENU_PORTAL_FBX_URL = MENU_NAVIGATION_PORTAL_MODEL_URL;
const MENU_PORTAL_ALBEDO_URL = MENU_NAVIGATION_PORTAL_ALBEDO_URL;
const MENU_PORTAL_EMISSIVE_URL = MENU_NAVIGATION_PORTAL_EMISSIVE_URL;
const MENU_PORTAL_METALLIC_URL = MENU_NAVIGATION_PORTAL_METALLIC_URL;

const MenuNavigationPortal = ({
  region,
  transform,
  onActivate,
  reducedMotion = false,
  forceHighlight = false,
}: {
  region: 'forest' | 'dungeon' | 'tower';
  transform: RuntimeMenuPortalTransform;
  onActivate?: () => void;
  reducedMotion?: boolean;
  forceHighlight?: boolean;
}) => {
  const sourcePortal = useLoader(FBXLoader, MENU_PORTAL_FBX_URL, configureFBXLoader) as THREE.Group;
  const [albedoTexture, emissiveTexture, metallicTexture] = useTexture([
    MENU_PORTAL_ALBEDO_URL,
    MENU_PORTAL_EMISSIVE_URL,
    MENU_PORTAL_METALLIC_URL,
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture];
  const swayRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const highlightRingRef = useRef<THREE.Mesh>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [isPortalHighlighted, setIsPortalHighlighted] = useState(false);

  const model = useMemo(() => {
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    emissiveTexture.colorSpace = THREE.SRGBColorSpace;
    metallicTexture.colorSpace = THREE.NoColorSpace;
    [albedoTexture, emissiveTexture, metallicTexture].forEach((texture) => {
      texture.flipY = true;
      texture.needsUpdate = true;
    });

    const clone = sourcePortal.clone(true);
    clone.traverse((child: any) => {
      if (!child.isMesh) {
        return;
      }

      const mesh = child as THREE.Mesh;
      const applyPortalMaterial = (material: THREE.Material) => {
        const standard = material instanceof THREE.MeshStandardMaterial
          ? material.clone()
          : new THREE.MeshStandardMaterial({
            color: (material as any).color?.clone?.() ?? new THREE.Color('#ffffff'),
          });

        standard.map = albedoTexture;
        standard.emissiveMap = emissiveTexture;
        standard.metalnessMap = metallicTexture;
        standard.color = new THREE.Color('#ffffff');
        standard.emissive = new THREE.Color(region === 'tower' ? '#a78bfa' : '#67d3ff');
        standard.emissiveIntensity = 1.35;
        standard.metalness = 0.48;
        standard.roughness = 0.38;
        standard.vertexColors = false;
        standard.fog = true;
        standard.needsUpdate = true;
        return standard;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => applyPortalMaterial(material));
      } else if (mesh.material) {
        mesh.material = applyPortalMaterial(mesh.material as THREE.Material);
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    return clone;
  }, [albedoTexture, emissiveTexture, metallicTexture, sourcePortal, region]);

  useEffect(() => () => {
    if (typeof document !== 'undefined' && document.body.style.cursor === 'pointer') {
      document.body.style.cursor = '';
    }
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (swayRef.current) {
      swayRef.current.position.y = Math.sin(t * 0.55) * 0.035;
    }

    if (glowRef.current) {
      glowRef.current.intensity = 1.9 + (Math.sin(t * 3.15) * 0.55);
      // On mobile non-quality, skip animating the distance property each frame
      // to save one uniform upload per frame on the shadow-casting pointLight.
      if (!reducedMotion) {
        glowRef.current.distance = 5.4 + (Math.sin(t * 2.7) * 0.35);
      }
    }

    if (haloRef.current) {
      const pulse = 1.15 + (Math.sin(t * 2.8) * 0.11);
      haloRef.current.scale.set(pulse, pulse, 1);
      const haloMaterial = haloRef.current.material as THREE.MeshBasicMaterial;
      haloMaterial.opacity = 0.18 + ((Math.sin(t * 3.15) + 1) * 0.08);
    }

    if (highlightRingRef.current) {
      const ringMaterial = highlightRingRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 1 + (Math.sin(t * 5.2) * 0.08);
      highlightRingRef.current.scale.set(pulse, pulse, 1);
      ringMaterial.opacity = isPortalHighlighted || forceHighlight
        ? 0.72 + ((Math.sin(t * 6.1) + 1) * 0.08)
        : 0;
    }
  });

  const portalScale = Math.max(0.0001, transform.scale);
  const regionZOffset = region === 'dungeon' ? 0 : 0;

  return (
    <group
      position={[transform.position[0], transform.position[1], transform.position[2] + regionZOffset]}
      rotation={transform.rotation}
      scale={[portalScale, portalScale, portalScale]}
      onPointerDown={(event) => {
        if (!onActivate) {
          return;
        }
        event.stopPropagation();
        if (highlightTimeoutRef.current !== null) {
          window.clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = null;
        }
        setIsPortalHighlighted(true);
        highlightTimeoutRef.current = window.setTimeout(() => {
          highlightTimeoutRef.current = null;
          setIsPortalHighlighted(false);
        }, 1200);
        onActivate?.();
      }}
      onPointerOver={(event) => {
        if (!onActivate) {
          return;
        }
        event.stopPropagation();
        if (highlightTimeoutRef.current !== null) {
          window.clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = null;
        }
        setIsPortalHighlighted(true);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={(event) => {
        if (!onActivate) {
          return;
        }
        event.stopPropagation();
        if (highlightTimeoutRef.current !== null) {
          window.clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = null;
        }
        setIsPortalHighlighted(false);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = '';
        }
      }}
    >
      <group ref={swayRef}>
        <primitive object={model} />
      </group>
      <pointLight ref={glowRef} position={[0, 1.55, 0.18]} color={region === 'tower' ? '#a78bfa' : '#38bdf8'} intensity={2.1} distance={5.7} decay={1.75} />
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[1.05, 48]} />
        <meshBasicMaterial color={region === 'tower' ? '#c4b5fd' : '#7dd3fc'} transparent opacity={0.24} depthWrite={false} />
      </mesh>
      <mesh ref={highlightRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={isPortalHighlighted || forceHighlight}>
        <ringGeometry args={[1.08, 1.3, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.86} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 2.6, 0]} distanceFactor={8.8} zIndexRange={[170, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            opacity: isPortalHighlighted || forceHighlight ? 1 : 0,
            transform: `translateY(${isPortalHighlighted || forceHighlight ? '0px' : '4px'}) scale(${isPortalHighlighted || forceHighlight ? 1 : 0.96})`,
            transition: 'opacity 140ms ease, transform 140ms ease',
            fontSize: 'clamp(0.74rem, 1.8vw, 0.9rem)',
            fontWeight: 900,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#38bdf8',
            textShadow: '0 0 1px #ffffff, 0 0 2px #ffffff, 0 0 3px #ffffff, 2px 0 #ffffff, -2px 0 #ffffff, 0 2px #ffffff, 0 -2px #ffffff, 1.5px 1.5px #ffffff, -1.5px 1.5px #ffffff, 1.5px -1.5px #ffffff, -1.5px -1.5px #ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          Portal
        </div>
      </Html>
    </group>
  );
};

// Dev-only stats panel using stats.js (FPS / MS / MB). Renders inside the R3F Canvas.
// Only mounted when import.meta.env.DEV is true — tree-shaken away in production.
const StatsMonitor = () => {
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();
    let frames = 0;
    const history: { fps: number; ms: string; mb: string; t: string }[] = [];
    const MAX_HISTORY = 30;

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'left:14px', 'bottom:14px', 'z-index:9999',
      'display:flex', 'flex-direction:column', 'gap:6px',
      'min-width:136px', 'max-width:148px',
      'padding:8px 9px 7px', 'border-radius:14px',
      'border:1px solid rgba(231,186,119,0.28)',
      'background:linear-gradient(180deg, rgba(43,22,30,0.94) 0%, rgba(24,11,19,0.92) 100%)',
      'box-shadow:0 10px 24px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,234,198,0.06)',
      'backdrop-filter:blur(10px)', '-webkit-backdrop-filter:blur(10px)',
      'color:#f8e7cb', 'font:600 10px "Trebuchet MS", Verdana, sans-serif',
      'line-height:1.25', 'letter-spacing:0.02em', 'user-select:none', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(panel);

    const title = document.createElement('div');
    title.textContent = 'STATUS';
    title.style.cssText = [
      'font-size:9px', 'font-weight:900', 'letter-spacing:0.24em', 'text-transform:uppercase',
      'color:rgba(245,210,160,0.74)', 'padding-left:1px', 'pointer-events:none',
    ].join(';');
    panel.appendChild(title);

    const display = document.createElement('div');
    display.style.cssText = [
      'display:grid', 'grid-template-columns:repeat(3, minmax(0, 1fr))', 'gap:4px',
      'pointer-events:none',
    ].join(';');
    panel.appendChild(display);

    const btn = document.createElement('button');
    btn.textContent = 'Copiar';
    btn.style.cssText = [
      'flex:1 1 0', 'min-width:0', 'height:24px', 'border-radius:9px',
      'border:1px solid rgba(120,205,210,0.30)',
      'background:linear-gradient(180deg, rgba(33,94,101,0.28) 0%, rgba(18,48,54,0.24) 100%)',
      'color:#9de7eb', 'font:800 9px "Trebuchet MS", Verdana, sans-serif', 'letter-spacing:0.08em',
      'text-transform:uppercase', 'cursor:pointer', 'padding:0 6px', 'pointer-events:auto',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)',
    ].join(';');
    btn.title = 'Copia as últimas 30 amostras de FPS/MS para o clipboard e loga no console';

    // Profile button — triggers Chrome DevTools CPU profile for 5 seconds
    const profileBtn = document.createElement('button');
    profileBtn.textContent = 'Spikes';
    profileBtn.style.cssText = btn.style.cssText;
    profileBtn.style.border = '1px solid rgba(231,186,119,0.26)';
    profileBtn.style.background = 'linear-gradient(180deg, rgba(112,76,43,0.26) 0%, rgba(57,34,20,0.22) 100%)';
    profileBtn.style.color = '#f4d19c';
    profileBtn.title = 'Observa tarefas longas (>50ms) por 10s e loga no console';

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:5px;pointer-events:none';
    controls.appendChild(btn);
    controls.appendChild(profileBtn);
    panel.appendChild(controls);

    // Histogram: <16ms / 16-33ms / 33-50ms / >50ms
    const histDiv = document.createElement('div');
    histDiv.style.cssText = [
      'font-size:8px', 'line-height:1.35', 'letter-spacing:0.04em',
      'color:rgba(228,202,178,0.58)', 'pointer-events:none',
    ].join(';');
    panel.appendChild(histDiv);

    let hist = { fast: 0, ok: 0, slow: 0, bad: 0 };

    profileBtn.addEventListener('click', () => {
      if (profileBtn.textContent?.startsWith('⏳')) return;
      profileBtn.textContent = '⏳ Observando...';

      const tasks: string[] = [];

      // PerformanceLongTasks API — detecta qualquer task JS >50ms automaticamente
      let observer: PerformanceObserver | null = null;
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const dur = entry.duration.toFixed(1);
            const attr = (entry as any).attribution?.[0];
            const src = attr?.name ?? attr?.containerName ?? 'unknown';
            const msg = `⚠ LongTask ${dur}ms — source: ${src}`;
            tasks.push(msg);
            console.warn('%c' + msg, 'color:#f90;font-family:monospace');
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        console.warn('[StatsMonitor] PerformanceLongTasks não suportado neste browser.');
      }

      // Também mede frame-a-frame com performance.mark para ver spikes
      let markRaf = 0;
      let prevT = performance.now();
      const markLoop = () => {
        const now = performance.now();
        const ft = now - prevT;
        if (ft > 50) tasks.push(`🔴 Frame spike ${ft.toFixed(1)}ms @ ${new Date().toTimeString().slice(0,8)}`);
        prevT = now;
        markRaf = requestAnimationFrame(markLoop);
      };
      markRaf = requestAnimationFrame(markLoop);

      setTimeout(() => {
        observer?.disconnect();
        cancelAnimationFrame(markRaf);
        profileBtn.textContent = tasks.length > 0 ? `${tasks.length} tasks` : 'Limpo';
        setTimeout(() => { profileBtn.textContent = 'Spikes'; }, 4000);

        const header = `=== LongTask Report (10s) — ${tasks.length} evento(s) ===`;
        const body = tasks.length > 0 ? tasks.join('\n') : 'Nenhuma task longa detectada.';
        const full = header + '\n' + body;
        console.log('%c' + full, 'color:#0ff;font-family:monospace');

        // Copia para clipboard
        const ta = document.createElement('textarea');
        ta.value = full;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }, 10000);
    });

    btn.addEventListener('click', () => {
      if (history.length === 0) { btn.textContent = 'Sem'; return; }
      const rows = history.slice(-MAX_HISTORY);
      const avgFps = Math.round(rows.reduce((s, r) => s + r.fps, 0) / rows.length);
      const avgMs  = (rows.reduce((s, r) => s + parseFloat(r.ms), 0) / rows.length).toFixed(1);
      const minFps = Math.min(...rows.map(r => r.fps));
      const maxMs  = Math.max(...rows.map(r => parseFloat(r.ms))).toFixed(1);
      const header = `=== StatsMonitor — últimas ${rows.length} amostras ===\nMédia FPS: ${avgFps} | Mínimo FPS: ${minFps} | Média MS: ${avgMs} | Pico MS: ${maxMs}\n`;
      const lines  = rows.map((r, i) => `#${String(i + 1).padStart(2, '0')}  FPS:${String(r.fps).padStart(4)}  MS:${r.ms.padStart(6)}  MB:${r.mb.padStart(6)}  @${r.t}`);
      const text   = header + lines.join('\n');
      console.log('%c' + text, 'color:#0ff;font-family:monospace;font-size:11px');
      // Fallback para HTTP (navigator.clipboard só funciona em HTTPS)
      const tryExecCopy = (str: string) => {
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      };

      const done = (ok: boolean) => {
        btn.textContent = ok ? 'OK' : 'Log';
        setTimeout(() => { btn.textContent = 'Copiar'; }, 2500);
      };

      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => done(true)).catch(() => done(tryExecCopy(text)));
      } else {
        done(tryExecCopy(text));
      }
    });

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      frames++;
      const now = performance.now();
      const elapsed = now - lastTime;

      // Per-frame histogram bucket (elapsed since last RAF = approx frame time)
      const frameMs = elapsed / Math.max(1, frames); // not exact per-frame but good enough between updates
      if (elapsed < 500) { // only count mid-interval
        const ft = elapsed / frames;
        if (ft < 16) hist.fast++; else if (ft < 33) hist.ok++; else if (ft < 50) hist.slow++; else hist.bad++;
      }

      if (elapsed >= 500) {
        const fps = Math.round((frames * 1000) / elapsed);
        const ms = (elapsed / frames).toFixed(1);
        const mb = (performance as any).memory
          ? ((performance as any).memory.usedJSHeapSize / 1048576).toFixed(1)
          : '—';
        const t = new Date().toTimeString().slice(0, 8);
        history.push({ fps, ms, mb, t });
        if (history.length > MAX_HISTORY * 2) history.splice(0, MAX_HISTORY);
        const total = hist.fast + hist.ok + hist.slow + hist.bad;
        const fpsColor = fps >= 50 ? '#8ff3b0' : fps >= 30 ? '#f5d27d' : '#ff9588';
        const msColor = parseFloat(ms) <= 20 ? '#8fe9f0' : parseFloat(ms) <= 33 ? '#f5d27d' : '#ff9588';
        const mbColor = '#d7c4ff';
        const cellStyle = 'display:flex;flex-direction:column;gap:2px;padding:5px 6px 4px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);box-shadow:inset 0 1px 0 rgba(255,255,255,0.04)';
        const labelStyle = 'font-size:7px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,225,196,0.52)';
        const valueStyle = 'font-size:13px;font-weight:900;line-height:1';
        display.innerHTML =
          `<div style="${cellStyle}"><span style="${labelStyle}">FPS</span><span style="${valueStyle};color:${fpsColor}">${fps}</span></div>` +
          `<div style="${cellStyle}"><span style="${labelStyle}">MS</span><span style="${valueStyle};color:${msColor}">${ms}</span></div>` +
          `<div style="${cellStyle}"><span style="${labelStyle}">MB</span><span style="${valueStyle};color:${mbColor}">${mb}</span></div>`;
        if (total > 0) {
          const pct = (n: number) => Math.round((n / total) * 100);
          histDiv.innerHTML =
            `<span style="color:#8ff3b0">${pct(hist.fast)}%</span> ` +
            `<span style="color:#f5d27d">${pct(hist.ok)}%</span> ` +
            `<span style="color:#f0a35d">${pct(hist.slow)}%</span> ` +
            `<span style="color:#ff9588">${pct(hist.bad)}%</span>` +
            `<span style="color:rgba(228,202,178,0.42)">  |  <16 <33 <50 50+</span>`;
        }
        hist = { fast: 0, ok: 0, slow: 0, bad: 0 };
        frames = 0;
        lastTime = now;
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    };
  }, []);
  return null;
};

/** Throttles the global shadow map so the expensive PCFSoft shadow pass does
 *  not run on every render frame. At quality mode (1024×1024 PCFSoft) the
 *  shadow pass costs ~40-60 ms/frame — roughly half the frame budget. Since
 *  this is a turn-based game, 2 fps shadows are visually indistinguishable.
 *  Per-character blob shadows from ContactShadows are NOT affected (they use
 *  their own WebGLRenderTarget and update independently).
 */
const ShadowAutoUpdateThrottle: React.FC<{ fps?: number }> = ({ fps = 2 }) => {
  const { gl } = useThree();
  const accRef = useRef(0);
  const minInterval = fps > 0 ? 1 / fps : Infinity;

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    // Force one immediate shadow render so the scene doesn't start shadowed wrong.
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
      gl.shadowMap.needsUpdate = true;
    };
  }, [gl]);

  useFrame((_, delta) => {
    accRef.current += delta;
    if (accRef.current >= minInterval) {
      accRef.current = 0;
      gl.shadowMap.needsUpdate = true;
    }
  });

  return null;
};

const FpsCap = ({ fps }: { fps: number }) => {
  // Use invalidate() instead of advance(timestamp).
  // advance(timestamp) passes raw rAF ms values into R3F's clock, breaking
  // THREE.Clock and causing the day cycle to run 1000Ãƒâ€” too fast.
  // invalidate() simply tells R3F "render next frame" without touching the clock.
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (fps <= 0) return undefined;

    const frameIntervalMs = 1000 / fps;
    let rafId = 0;
    let lastFrameTime = 0;

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (lastFrameTime === 0) {
        // First frame Ã¢â‚¬â€ initialize baseline
        lastFrameTime = now;
        invalidate();
        return;
      }
      const elapsed = now - lastFrameTime;
      if (elapsed < frameIntervalMs) return;
      // Advance the baseline by whole intervals to avoid drift accumulation.
      // e.g. at 30fps if a frame fires at 34ms instead of 33.3ms, the next
      // target becomes 34 - (34 % 33.3) = 33.3ms, keeping cadence steady.
      lastFrameTime = now - (elapsed % frameIntervalMs);
      invalidate();
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [invalidate, fps]);

  return null;
};

/** Isolated component — subscribes to particles from the VFX store so GameScene never re-renders for particles.
 *  Also owns the pruneExpired tick so no setInterval lives outside the R3F loop. */
const WorldParticlesConnected: React.FC<{ renderCap: number }> = ({ renderCap }) => {
  const particles = useBattleVfxStore((s) => s.particles) ?? [];
  const pruneFrameRef = useRef(0);

  // Prune expired VFX every ~6 R3F frames (≈20ms × 6 ≈ 120ms) — synchronized with
  // the render loop so zustand set() never fires from an external setInterval.
  useFrame(() => {
    pruneFrameRef.current += 1;
    if (pruneFrameRef.current >= 6) {
      pruneFrameRef.current = 0;
      useBattleVfxStore.getState().pruneExpired();
    }
  });

  const visible = particles.length > renderCap ? particles.slice(-renderCap) : particles;
  return <InstancedParticles particles={visible} />;
};

/** Isolated component — subscribes to floatingTexts from the VFX store so GameScene never re-renders for texts. */
const WorldFloatingTextsConnected: React.FC<{ enemyAnchor?: [number, number, number] }> = ({ enemyAnchor }) => {
  const floatingTexts = useBattleVfxStore((s) => s.floatingTexts) ?? [];
  return <WorldFloatingTexts texts={floatingTexts} enemyAnchor={enemyAnchor} />;
};

const SPEED_ATTRIBUTE_COLOR = '#10b981';
const SPEED_ATTRIBUTE_TRACK = 'rgba(16,185,129,0.14)';

const SpeedAttributeBar: React.FC<{
  /** When provided, the bar subscribes to that actor's gauge slice from
   *  battleGaugeStore directly and re-renders ONLY when that slice changes.
   *  Avoids passing the whole gauge map down through the React tree. */
  actorId?: string;
  /** Legacy override: explicit pct (used while transitioning consumers). */
  pct?: number;
  state?: BattleActorChargeState;
  active?: boolean;
  isMobileDevice: boolean;
  barH: string;
}> = ({ actorId, pct: pctOverride, state: stateOverride, active = false, isMobileDevice, barH }) => {
  // Subscribe to the actor's gauge slice if actorId provided. Selector returns
  // a primitive-friendly tuple to maximize React re-render skipping.
  const subscribed = useBattleGaugeStore((s) => (actorId ? s.gauges[actorId] : undefined));
  const pct = pctOverride ?? subscribed?.tempoDeAtaque ?? 0;
  const state: BattleActorChargeState = stateOverride ?? subscribed?.state ?? 'carregando';
  const fillRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const prevPctRef = useRef(-1);

  const isReady = active || state === 'pronto' || state === 'executando';
  const iconSize = isMobileDevice ? 16 : 11;
  const iconBox = isMobileDevice ? 20 : 14;
  const minVisible = isMobileDevice ? 3.2 : 2.4;

  // CSS-transition approach: set transform/opacity directly on the DOM element.
  // pct is already throttled to 30fps by useBattleTimeline — no rAF loop needed.
  // transform/opacity changes are applied synchronously here; the browser renders
  // them at the next paint (~33ms at 30fps), matching the ATB update rate exactly.
  useEffect(() => {
    const fill = fillRef.current;
    const shimmer = shimmerRef.current;
    if (!fill) return;

    const clampedPct = Math.max(0, Math.min(100, pct));
    const minVisiblePct = clampedPct > 0 ? Math.max(clampedPct, minVisible) : 0;
    const targetScale = minVisiblePct / 100;
    const isReset = pct < prevPctRef.current - 4;
    prevPctRef.current = pct;

    // No CSS transition — snap directly at 30fps (pct changes at 30fps from ATB hook)
    fill.style.transition = isReset ? 'none' : 'opacity 0.18s ease, box-shadow 0.22s ease';
    fill.style.transform = `scaleX(${targetScale})`;
    fill.style.opacity = clampedPct > 0 ? '1' : '0';

    if (shimmer) {
      shimmer.style.opacity = clampedPct > 0 ? String(Math.min(1, 0.45 + (clampedPct / 100) * 0.4)) : '0';
      shimmer.style.background = `linear-gradient(90deg, transparent 0%, transparent ${Math.max(0, minVisiblePct - 8)}%, rgba(255,255,255,0.18) ${Math.max(0, minVisiblePct - 1.5)}%, transparent ${Math.min(100, minVisiblePct + 8)}%)`;
    }
  }, [pct, minVisible]);

  // Box-shadow glow on ready-state change (infrequent — does not need 60fps)
  useEffect(() => {
    const fill = fillRef.current;
    const track = trackRef.current;
    if (!fill || !track) return;
    fill.style.boxShadow = isReady
      ? `0 0 10px ${SPEED_ATTRIBUTE_COLOR}cc, 0 0 18px ${SPEED_ATTRIBUTE_COLOR}66`
      : `0 0 7px ${SPEED_ATTRIBUTE_COLOR}55`;
    track.style.boxShadow = isReady ? `0 0 0 1px ${SPEED_ATTRIBUTE_COLOR}22` : 'none';
  }, [isReady]);

  return (
    <div
      title="Velocidade"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobileDevice ? '7px' : '5px',
        height: isMobileDevice ? '16px' : '11px',
        opacity: active ? 1 : 0.94,
      }}
    >
      <span
        style={{
          width: iconBox,
          height: iconBox,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: SPEED_ATTRIBUTE_COLOR,
          flexShrink: 0,
          filter: `drop-shadow(0 0 5px ${SPEED_ATTRIBUTE_COLOR}99)`,
        }}
      >
        <Wind size={iconSize} strokeWidth={3} />
      </span>
      <div
        ref={trackRef}
        style={{
          flex: 1,
          height: `max(${isMobileDevice ? '7px' : '5px'}, calc(${barH} * 0.58))`,
          borderRadius: '99px',
          background: SPEED_ATTRIBUTE_TRACK,
          overflow: 'hidden',
          isolation: 'isolate',
          border: `1px solid ${SPEED_ATTRIBUTE_COLOR}33`,
          position: 'relative',
        }}
      >
        <div
          ref={fillRef}
          style={{
            height: '100%',
            width: '100%',
            background: `linear-gradient(90deg, ${SPEED_ATTRIBUTE_COLOR}99, ${SPEED_ATTRIBUTE_COLOR})`,
            transformOrigin: 'left center',
            willChange: 'transform, opacity',
            transform: 'scaleX(0)',
            opacity: 0,
          }}
        />
        <div
          ref={shimmerRef}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />
      </div>
    </div>
  );
};

/**
 * Subscribed HP bar — reads from useBattleStatsStore directly so it can update
 * without re-rendering the entire 3D scene tree (GameScene React.memo skips
 * stat-only changes via custom areEqual). Provide either `playerId` or `enemyId`.
 * `fallbackHp/fallbackMaxHp` are used until the store is populated.
 */
const SubscribedHpBar: React.FC<{
  source: 'player' | { enemyId: string };
  barH: string;
  fallbackHp: number;
  fallbackMaxHp: number;
  /** Compact variant: solid color, no gradient or border. */
  compact?: boolean;
}> = ({ source, barH, fallbackHp, fallbackMaxHp, compact = false }) => {
  const hp = useBattleStatsStore((s) =>
    source === 'player' ? s.playerHp : s.enemyHp[source.enemyId],
  );
  const maxHp = useBattleStatsStore((s) =>
    source === 'player' ? s.playerMaxHp : s.enemyMaxHp[source.enemyId],
  );
  const safeHp = hp ?? fallbackHp;
  const safeMaxHp = (maxHp && maxHp > 0) ? maxHp : Math.max(1, fallbackMaxHp);
  const hpPct = Math.max(0, Math.min(100, (safeHp / safeMaxHp) * 100));
  const hpColor = hpPct > 55 ? '#4ade80' : hpPct > 25 ? '#facc15' : '#f87171';
  if (compact) {
    return (
      <div style={{ height: barH, borderRadius: '99px', background: 'rgba(0,0,0,0.5)', overflow: 'hidden', isolation: 'isolate' }}>
        <div style={{ height: '100%', width: '100%', background: hpColor, transform: `scaleX(${hpPct / 100})`, transformOrigin: 'left center', transition: 'transform 0.35s ease' }} />
      </div>
    );
  }
  return (
    <div style={{ height: barH, borderRadius: '99px', background: 'rgba(0,0,0,0.55)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', isolation: 'isolate' }}>
      <div style={{ height: '100%', width: '100%', background: `linear-gradient(90deg, ${hpColor}99, ${hpColor})`, transform: `scaleX(${hpPct / 100})`, transformOrigin: 'left center', transition: 'transform 0.35s ease, background 0.5s ease' }} />
    </div>
  );
};

const SubscribedMpBar: React.FC<{
  source: 'player' | { enemyId: string };
  barH: string;
  fallbackMp: number;
  fallbackMaxMp: number;
}> = ({ source, barH, fallbackMp, fallbackMaxMp }) => {
  const mp = useBattleStatsStore((s) =>
    source === 'player' ? s.playerMp : s.enemyMp[source.enemyId],
  );
  const maxMp = useBattleStatsStore((s) =>
    source === 'player' ? s.playerMaxMp : s.enemyMaxMp[source.enemyId],
  );
  const safeMp = mp ?? fallbackMp;
  const safeMaxMp = (maxMp && maxMp > 0) ? maxMp : Math.max(1, fallbackMaxMp);
  if (safeMaxMp <= 0 || safeMp <= 0) return null;
  const mpPct = Math.max(0, Math.min(100, (safeMp / safeMaxMp) * 100));
  return (
    <div style={{ height: barH, borderRadius: '99px', background: 'rgba(0,0,0,0.55)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', isolation: 'isolate' }}>
      <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #2b687899, #66b8d2)', transform: `scaleX(${mpPct / 100})`, transformOrigin: 'left center', transition: 'transform 0.35s ease' }} />
    </div>
  );
};

const HeroNameplateCard: React.FC<{
  accentColor: string;
  cardW: string;
  isMobileDevice: boolean;
  hpPct: number;
  hpColor: string;
  hasMana: boolean;
  mpPct: number;
  xpPct: number;
  classId: PlayerClassId;
  level: number;
  barH: string;
  nameFz: string;
  lvlFz: string;
  iconSz: number;
  F: React.CSSProperties;
  speedGaugeActorId?: string;
  speedGaugeActive?: boolean;
  onClick?: () => void;
}> = ({ accentColor, cardW, isMobileDevice, hpPct, hpColor, hasMana, mpPct, xpPct, classId, level, barH, nameFz, lvlFz, iconSz, F, speedGaugeActorId, speedGaugeActive = false, onClick }) => {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const interactive = !!onClick;
  const ClassIcon = INSPECT_CLASS_ICON[classId] ?? Shield;
  const scale = pressed ? 0.968 : hovered ? 1.028 : 1;
  const glow = hovered
    ? `0 0 0 1.5px ${accentColor}88, 0 8px 32px rgba(0,0,0,0.6), 0 0 22px ${accentColor}44`
    : `0 0 0 1px ${accentColor}22, 0 6px 24px rgba(0,0,0,0.45)`;
  const border = hovered ? `1.5px solid ${accentColor}cc` : `1px solid ${accentColor}44`;
  return (
    <div
      onClick={onClick}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => { setHovered(false); setPressed(false); } : undefined}
      onMouseDown={interactive ? () => setPressed(true) : undefined}
      onMouseUp={interactive ? () => setPressed(false) : undefined}
      onTouchStart={interactive ? () => setHovered(true) : undefined}
      onTouchEnd={interactive ? () => { setHovered(false); setPressed(false); } : undefined}
      style={{
        width: cardW,
        background: hovered ? 'rgba(14,8,38,0.93)' : 'rgba(10,6,28,0.86)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border,
        borderRadius: '12px',
        padding: isMobileDevice ? '12px 16px' : '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobileDevice ? '10px' : '6px',
        boxShadow: glow,
        boxSizing: 'border-box',
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        transform: `scale(${scale})`,
        transition: 'transform 0.14s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease, border 0.18s ease, background 0.18s ease',
        userSelect: 'none',
        ...F,
      }}
    >
      {/* Name + level */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accentColor, filter: `drop-shadow(0 0 5px ${accentColor}) drop-shadow(0 0 10px ${accentColor}88)` }}>
          <ClassIcon size={iconSz} />
        </span>
        <span style={{ fontSize: nameFz, fontWeight: 900, color: '#fff', letterSpacing: '0.03em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{HERO_CLASS_NAME_PT[classId] ?? classId}</span>
        <span style={{ fontSize: lvlFz, fontWeight: 800, color: accentColor, letterSpacing: '0.10em', whiteSpace: 'nowrap', flexShrink: 0 }}>Nv {level}</span>
      </div>
      {/* HP bar — subscribes to battleStatsStore so it updates without re-rendering GameScene */}
      <SubscribedHpBar
        source="player"
        barH={barH}
        fallbackHp={Math.max(0, hpPct)}
        fallbackMaxHp={100}
      />
      {/* Mana bar — also subscribed */}
      {hasMana && (
        <SubscribedMpBar
          source="player"
          barH={barH}
          fallbackMp={Math.max(0, mpPct)}
          fallbackMaxMp={100}
        />
      )}
      {/* XP bar */}
      <div style={{ height: isMobileDevice ? '6px' : '4px', borderRadius: '99px', background: 'rgba(0,0,0,0.40)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', isolation: 'isolate' }}>
        <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #7d3d4d99, #c89a66)', transform: `scaleX(${xpPct / 100})`, transformOrigin: 'left center', transition: 'transform 0.5s ease' }} />
      </div>
      <SpeedAttributeBar
        actorId={speedGaugeActorId}
        active={speedGaugeActive}
        isMobileDevice={isMobileDevice}
        barH={barH}
      />
      {/* Hover hint */}
      {interactive && (
        <div style={{
          textAlign: 'center',
          fontSize: isMobileDevice ? '9px' : '7px',
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accentColor,
          opacity: hovered ? 0.85 : 0,
          transform: hovered ? 'translateY(0px)' : 'translateY(3px)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
          pointerEvents: 'none',
          marginTop: isMobileDevice ? 2 : 1,
        }}>
          Ver perfil
        </div>
      )}
    </div>
  );
};

export const GameScene: React.FC<SceneProps> = React.memo((props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const outlineHeroRef = useRef<THREE.Group>(null);
  const outlineEnemyRef = useRef<THREE.Group>(null);

  // gameTime lives in gameTimeStore — no local state to avoid GameScene re-renders 2×/sec
  const gameTime = useGameTimeStore((s) => s.gameTime);
  const setGameTimeInStore = useGameTimeStore((s) => s.setGameTime);
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [heroItemDetail, setHeroItemDetail] = useState<any | null>(null);
  // Defer secondary FBX bundle loading so the primary idle animation starts immediately.
  // 700 ms is enough time for the hero to appear before any player action is possible.
  const [secondaryBundlesReady, setSecondaryBundlesReady] = useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setSecondaryBundlesReady(true), 700);
    return () => window.clearTimeout(t);
  }, []);
  // Reset cursor and hover state when selection mode ends
  React.useEffect(() => {
    if (!props.pendingTargetAction) {
      setHoveredEnemyId(null);
      if (typeof document !== 'undefined') document.body.style.cursor = '';
    }
  }, [props.pendingTargetAction]);
  const handleTimeUpdate = useCallback((time: string) => {
    setGameTimeInStore(time);
    // onGameTimeUpdate prop kept for external consumers but no longer drives App state
    props.onGameTimeUpdate?.(time);
  }, [setGameTimeInStore, props.onGameTimeUpdate]);
  const renderQualityPreset = props.renderQualityPreset ?? getDefaultRenderQualityPreset();
  const quality = useMemo(() => getRenderQualityProfile(renderQualityPreset), [renderQualityPreset]);
  const isMobileDevice = useMemo(() => getRenderPlatform() === 'mobile', []);
  const shouldShowDesktopStatsMonitor = import.meta.env.DEV
    && !isMobileDevice
    && Boolean(props.showDesktopStatsMonitor);
  const isPerformanceMode = renderQualityPreset === 'performance';
  const isBalancedMode = renderQualityPreset === 'balanced';
  const isQualityMode = renderQualityPreset === 'quality';
  const shouldUseForestDepthOfField = false;
  const shouldUseDungeonDepthOfField = false;
  const forestBloomIntensity = isQualityMode ? 0.5 : (isMobileDevice ? 0.34 : 0.44);
  const dungeonBloomIntensity = isQualityMode ? 0.34 : (isMobileDevice ? 0.22 : 0.28);
  const forestDepthOfFieldHeight = 360;
  const dungeonDepthOfFieldHeight = 440;
  const isDungeonRun = Boolean(props.isDungeonScene ?? props.isDungeonRun);
  const runtimeCameraMenuFocus = props.menuCameraFocus ?? Boolean(props.isMenuView);
  // Keep Bloom/Vignette exclusive to quality mode. Desktop web balanced is the default
  // browser preset and should stay cool during long sessions.
  const shouldUsePostProcessing = isQualityMode;
  const shouldUseBloomAndVignette = isQualityMode;
  const shouldUseVignette = shouldUseBloomAndVignette && !runtimeCameraMenuFocus;
  // MSAA inside EffectComposer doubles GPU cost for all post-processing passes.
  // Desktop quality: capped at 2x MSAA (was 4x) - halves overdraw on Bloom, Vignette and outline passes.
  // Mobile and lower tiers use 0 (no MSAA).
  const postProcessingMultisampling = isQualityMode ? (isMobileDevice ? 0 : 2) : 0;
  const backfaceOutlineThickness = isPerformanceMode
    ? (isMobileDevice ? 0.045 : 0.06)
    : (isMobileDevice ? 0.055 : 0.07);
  const outlineTargets = useMemo(() => [outlineHeroRef, outlineEnemyRef], []);
  const glPowerPreference = useMemo(() => getRenderPowerPreference(renderQualityPreset), [renderQualityPreset]);
  const shouldRenderAmbientDrift = isQualityMode;
  const particleRenderCap = isPerformanceMode
    ? (isMobileDevice ? 24 : 48)
    : isQualityMode
      ? (isMobileDevice ? 120 : 150)
      : (isMobileDevice ? 60 : 90);
  const shouldUseDepthOfField = isDungeonRun ? shouldUseDungeonDepthOfField : shouldUseForestDepthOfField;
  const activeDepthOfFieldRange = isDungeonRun ? DUNGEON_FOCUS_RANGE : FOREST_FOCUS_RANGE;
  const activeDepthOfFieldBokeh = isDungeonRun ? 1.7 : 0.5;
  const activeDepthOfFieldHeight = isDungeonRun ? dungeonDepthOfFieldHeight : forestDepthOfFieldHeight;
  const activeBloomIntensity = isDungeonRun ? dungeonBloomIntensity : forestBloomIntensity;
  const activeBloomThreshold = isDungeonRun ? 0.5 : (shouldUseDepthOfField ? 0.42 : 0.48);
  const activeBloomSmoothing = isDungeonRun ? 0.85 : (shouldUseDepthOfField ? 0.8 : 0.82);
  const activeVignetteOffset = isDungeonRun ? 0.1 : (shouldUseDepthOfField ? 0.06 : 0.08);
  const activeVignetteDarkness = runtimeCameraMenuFocus
    ? 0
    : (isDungeonRun ? 0.42 : (shouldUseDepthOfField ? 0.1 : 0.13));
  // Mountain fog: starts close (6u) so objects at mid-distance get misty;
  // tower in the background (15-30u) gets heavy fog for depth illusion.
  const forestFogNear = quality.isLowQuality ? 6 : 5;
  const forestFogFar = quality.isLowQuality ? 22 : 28;
  // Mobile balanced uses PCFShadowMap (faster) instead of PCFSoftShadowMap to cut shadow pass cost.
  // Desktop balanced also uses PCFShadowMap Ã¢â‚¬â€ PCFSoftShadowMap custo extra sem ganho visual perceptÃƒÂ­vel.
  const isMobileBalanced = isMobileDevice && isBalancedMode;
  const shadowMapType = isQualityMode ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  // Skip the main directional shadow map (saves a full scene re-render pass per frame) unless
  // quality mode is selected. ContactShadows provides ground shadows for all other modes.
  const noMainShadow = !isQualityMode;
  // Only enable the canvas shadow renderer for quality mode. For balanced/performance,
  // noMainShadow=true means no light uses castShadow, so the renderer overhead is wasted.
  // ContactShadows uses its own WebGLRenderTarget and does NOT depend on this flag.
  const shadowsEnabled = isQualityMode;
  // Electron desktop: capped below 60 to avoid sustained heat/stutter on long sessions.
  // Mobile/Electron: use demand+invalidate with FpsCap to save battery/thermals.
  // Desktop web: use frameloop='always' so the browser vsync handles cadence natively.
  // demand+invalidate on 120/144Hz monitors creates micro-stutter because
  // e.g. 45fps / 144Hz = 3.2 frames per render (non-integer) → alternating 3/4 refresh intervals.
  const isElectron = typeof window !== 'undefined' && (window as Window & { electronBridge?: { isElectron: boolean } }).electronBridge?.isElectron === true;
  // Desktop web: 'always' durante gameplay ativo, 'demand' no menu/loading.
  // Durante o menu, FBX parsing + remapClipBindings bloqueiam centenas de ms — forçar
  // render em cada frame nesse período causa spikes de 700ms+. Em demand, o renderer
  // só roda quando há uma invalidação explícita, libertando a main thread para o loading.
  const useAlwaysFrameloop = !isMobileDevice && !isElectron && !props.isMenuView;
  const mobileFpsCap = isElectron ? (isQualityMode ? 30 : 45) : (isMobileDevice ? (isQualityMode ? 30 : 45) : 45);
  const battleContactShadowResolution = useMemo(
    // Mobile non-quality stays capped to avoid texture memory pressure on Safari/iOS.
    () => (isMobileDevice && !isQualityMode) ? Math.min(quality.contactShadowResolution, 48) : (isPerformanceMode ? 48 : quality.contactShadowResolution),
    [isMobileDevice, isPerformanceMode, isQualityMode, quality.contactShadowResolution],
  );

  const bgColor = useMemo(() => {
    if (isDungeonRun) {
      return '#111827';
    }
    return '#d7e6c2';
  }, [isDungeonRun, props.stage]);

  const huntRuntimeScenarioPreset = useMemo(() => getRuntimeScenarioPreset('moutain'), []);
  const huntRuntimeConfig = huntRuntimeScenarioPreset?.config ?? null;
  const huntRuntimeSceneObjects = huntRuntimeConfig?.sceneObjects ?? [];
  const dungeonRuntimeScenarioPreset = useMemo(() => getRuntimeScenarioPreset('dungeon'), []);
  const dungeonRuntimeConfig = dungeonRuntimeScenarioPreset?.config ?? null;
  const dungeonRuntimeSceneObjects = dungeonRuntimeConfig?.sceneObjects ?? [];
  const towerRuntimeScenarioPreset = useMemo(() => getRuntimeScenarioPreset('tower'), []);
  const towerRuntimeConfig = towerRuntimeScenarioPreset?.config ?? null;
  const isTowerScene = props.menuPortalRegion === 'tower';
  const activeScenarioConfig = isTowerScene ? towerRuntimeConfig : dungeonRuntimeConfig;
  const activeScenarioPreset = isTowerScene ? towerRuntimeScenarioPreset : dungeonRuntimeScenarioPreset;
  const activeSceneObjects = activeScenarioConfig?.sceneObjects ?? [];
  const globalMenuPortalTransform = getRuntimeMenuPortalPreset().transform;
  const menuPortalTransform = activeScenarioConfig?.menuPortalTransform ?? globalMenuPortalTransform;
  const menuPortalFocusPoint: [number, number, number] = [
    menuPortalTransform.position[0],
    menuPortalTransform.position[1] + 1.05,
    menuPortalTransform.position[2],
  ];
  const shouldUseRuntimeScenarioEditorParity = Boolean(isDungeonRun && activeScenarioConfig);
  const dungeonHeroBasePosition: [number, number, number] = activeScenarioConfig?.heroBasePosition ?? [-2, -1, 0];
  const dungeonEnemyBasePosition: [number, number, number] = activeScenarioConfig?.enemyBasePosition ?? [2, -1, 0];
  const dungeonHeroAttackX = dungeonHeroBasePosition[0] + 2.5;
  const dungeonHeroDefendX = dungeonHeroBasePosition[0] + 0.5;
  const dungeonEnemyAttackX = dungeonEnemyBasePosition[0] - 2.35;
  const dungeonEnemyDefendX = dungeonEnemyBasePosition[0] - 0.5;
  const dungeonFogColor = activeScenarioConfig?.atmosphere.fogColor ?? '#1f2937';
  const dungeonFogNearBase = Math.max(1, activeScenarioConfig?.atmosphere.fogNear ?? 14);
  const dungeonFogFarBase = Math.max(dungeonFogNearBase + 1, activeScenarioConfig?.atmosphere.fogFar ?? 32);
  const dungeonFogNear = dungeonFogNearBase;
  const dungeonFogFar = dungeonFogFarBase;
  const dungeonAmbientColor = activeScenarioConfig?.lighting.ambientColor ?? '#f8fafc';
  const dungeonAmbientIntensity = activeScenarioConfig?.lighting.ambientIntensity ?? 1.08;
  const dungeonDirectionalColor = activeScenarioConfig?.lighting.directionalColor ?? '#f8fafc';
  const dungeonDirectionalIntensity = activeScenarioConfig?.lighting.directionalIntensity ?? 0.78;
  const dungeonDirectionalPosition = activeScenarioConfig?.lighting.directionalPosition ?? [0, 6, 6] as [number, number, number];
  const dungeonSceneBgColor = activeScenarioConfig?.atmosphere.fogColor ?? bgColor;
  const dungeonFogEnabled = activeScenarioConfig?.atmosphere.fogEnabled ?? true;
  const huntSceneBgColor = huntRuntimeConfig?.atmosphere.fogColor ?? bgColor;
  const huntFogEnabled = huntRuntimeConfig?.atmosphere.fogEnabled ?? true;
  const huntFogColor = huntRuntimeConfig?.atmosphere.fogColor ?? '#c8d8e8';
  const huntFogNear = Math.max(1, huntRuntimeConfig?.atmosphere.fogNear ?? forestFogNear);
  const huntFogFar = Math.max(huntFogNear + 1, huntRuntimeConfig?.atmosphere.fogFar ?? forestFogFar);
  const sceneBackgroundColor = isDungeonRun && activeScenarioConfig ? dungeonSceneBgColor : huntSceneBgColor;
  const runtimeCameraScreenShake = shouldUseRuntimeScenarioEditorParity
    ? undefined
    : props.screenShake;
  const runtimeBattleCamera = useMemo(() => {
    const cs = activeScenarioConfig?.cameraState;
    if (!cs || !isDungeonRun) return undefined;
    const dist = Math.sqrt(cs.position[0] ** 2 + cs.position[2] ** 2);
    return {
      fov: cs.fov,
      distance: dist > 0.01 ? dist : Math.abs(cs.position[2]),
      height: cs.position[1],
    };
  }, [activeScenarioConfig, isDungeonRun]);
  const shouldShowDungeonReferenceGround = false;
  const enemyOverlay = null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 transition-colors duration-1000"
      style={{ backgroundColor: sceneBackgroundColor, touchAction: 'none' }}
      onClick={() => { if (props.heroInspectMode) props.onHeroInspectClose?.(); }}
    >
      {/* Hero equip item detail overlay Ã¢â‚¬â€ fora do Canvas para evitar erro R3F */}
      {heroItemDetail && (
        <HeroItemDetailOverlay
          item={heroItemDetail}
          onClose={() => setHeroItemDetail(null)}
        />
      )}
      {!isDungeonRun && (
        <div className="absolute top-6 left-6 z-10 bg-black/40 border border-white/10 px-4 py-1 rounded-full hidden sm:flex items-center gap-3 pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="font-mono text-white text-sm tracking-widest">{gameTime}</span>
        </div>
      )}

      {/* Dev-only FPS monitor — rendered outside Canvas to avoid R3F context issues */}
      {shouldShowDesktopStatsMonitor && <StatsMonitor />}

      <Canvas
        shadows={shadowsEnabled ? { type: shadowMapType } : false}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: glPowerPreference }}
        performance={{ min: 0.5 }}
        frameloop={useAlwaysFrameloop ? 'always' : 'demand'}
        style={{ touchAction: 'none' }}
        onCreated={({ gl, invalidate }) => {
          // Mobile WebGL context loss guard.
          // On iOS/Android, opening a modal that creates a second WebGLRenderer
          // (ItemPreviewThree) can cause the browser to evict this context.
          // e.preventDefault() on 'webglcontextlost' tells the browser to attempt
          // automatic restoration instead of permanently destroying the context.
          // On 'webglcontextrestored' we reset Three.js cached GL state and kick
          // a re-render so the scene reappears without a full page reload.
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e: Event) => {
            e.preventDefault();
          }, false);
          canvas.addEventListener('webglcontextrestored', () => {
            gl.resetState();
            invalidate();
          }, false);
        }}
      >
        {!useAlwaysFrameloop && <FpsCap fps={mobileFpsCap} />}
        {/* Throttle shadow map to 2 fps — saves ~40-60 ms/frame in quality mode.
            ContactShadows (per-character) are unaffected and still update normally. */}
        {shadowsEnabled && <ShadowAutoUpdateThrottle fps={24} />}
        <CameraController
          screenShake={runtimeCameraScreenShake}
          menuFocus={runtimeCameraMenuFocus}
          menuPortalTravelCinematicToken={props.menuPortalTravelCinematicToken ?? 0}
          menuPortalFocusPoint={menuPortalFocusPoint}
          runtimeBattleCamera={runtimeBattleCamera}
          heroInspectMode={props.heroInspectMode}
          portalInspectMode={props.portalInspectMode}
          bossEntryCinematicToken={props.bossEntryCinematicToken ?? 0}
        />
        {/* fog/background must be at Canvas root (scene level) Ã¢â‚¬â€ THREE.js only reads scene.fog and scene.background */}
        {isDungeonRun ? (
          <>
            <color attach="background" args={[dungeonSceneBgColor]} />
            {dungeonFogEnabled ? <fog attach="fog" args={[dungeonFogColor, dungeonFogNear, dungeonFogFar]} /> : null}
          </>
        ) : (
          <>
            {huntFogEnabled ? <fog attach="fog" args={[huntFogColor, huntFogNear, huntFogFar]} /> : null}
          </>
        )}
        <group>
          {isDungeonRun ? (
            <>
              {shouldShowDungeonReferenceGround ? (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.16, 0]} receiveShadow>
                  <planeGeometry args={[60, 60]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0.02} />
                </mesh>
              ) : null}
              {dungeonRuntimeConfig || towerRuntimeConfig ? (
                <>
                  <ambientLight intensity={Math.max(0, dungeonAmbientIntensity)} color={dungeonAmbientColor} />
                  <hemisphereLight intensity={Math.max(0.2, dungeonAmbientIntensity * 0.65)} color="#dbeafe" groundColor="#1f2937" />
                  <directionalLight
                    position={dungeonDirectionalPosition}
                    intensity={Math.max(0, dungeonDirectionalIntensity)}
                    color={dungeonDirectionalColor}
                    castShadow
                    shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
                  />
                  <ScenarioParticleField particles={activeScenarioConfig!.particles} />
                  <Suspense fallback={null}>
                    <RuntimeScenarioGlb
                      modelUrl={activeScenarioPreset!.scenarioModelUrl}
                      transform={activeScenarioConfig!.scenarioTransform}
                      editorParity={shouldUseRuntimeScenarioEditorParity}
                    />
                  </Suspense>
                  {activeSceneObjects.map((sceneObject) => (
                    <Suspense key={sceneObject.id} fallback={null}>
                      <RuntimeScenarioGlb
                        modelUrl={sceneObject.modelUrl}
                        transform={sceneObject.transform}
                        editorParity={shouldUseRuntimeScenarioEditorParity}
                      />
                    </Suspense>
                  ))}
                </>
              ) : null}
              {/* Scene-level ContactShadows removed Ã¢â‚¬â€ per-character ones on hero/enemy avoid the square artifact */}
            </>
          ) : (
            <>
              <SkyboxController />
              <DayNightCycle containerRef={containerRef} onTimeUpdate={handleTimeUpdate} quality={quality} noMainShadow={noMainShadow} />
              {huntRuntimeConfig ? (
                <>
                  <ScenarioParticleField particles={huntRuntimeConfig.particles} />
                  <Suspense fallback={null}>
                    <RuntimeScenarioGlb
                      modelUrl={huntRuntimeScenarioPreset!.scenarioModelUrl}
                      transform={huntRuntimeConfig.scenarioTransform}
                      editorParity
                    />
                  </Suspense>
                  {huntRuntimeSceneObjects.map((sceneObject) => (
                    <Suspense key={sceneObject.id} fallback={null}>
                      <RuntimeScenarioGlb
                        modelUrl={sceneObject.modelUrl}
                        transform={sceneObject.transform}
                        editorParity
                      />
                    </Suspense>
                  ))}
                </>
              ) : null}
              {/* Scene-level ContactShadows removed Ã¢â‚¬â€ per-character ContactShadows on
                  HeroVoxel and EnemyCharacter provide ground shadows without the large
                  square boundary artifact that a scale=22 plane with low blur produces. */}
            </>
          )}
        </group>

        {/* Hero attack position: moves toward selected target in group combat */}
        {(() => {
          // Slot idleX table (mirrors GRP in the enemy IIFE below, kept in sync)
          const HERO_GRP_IDLE_X = [
            [2.0],
            [1.5, 3.8],
            [0.9, 3.0, 4.6],
          ];
          const heroExtras = props.additionalEnemies ?? [];
          const heroGrpSize = Math.min(3, Math.max(1, props.initialGroupSize ?? (1 + heroExtras.length)));
          const heroSlot   = props.mainEnemySlotIndex ?? 0;
          const targetIdleX = HERO_GRP_IDLE_X[heroGrpSize - 1]?.[heroSlot] ?? 2.0;
          // Hero stops ~1.5 units left of the target enemy
          const huntHeroAttackX = !isDungeonRun ? targetIdleX - 1.5 : undefined;
          return (
            <group ref={outlineHeroRef}>
              <HeroVoxel
                classId={props.playerClassId}
                playerAnimationAction={props.playerAnimationAction}
                isAttacking={props.isPlayerAttacking}
                isDefending={props.isPlayerDefending}
                defenseType={props.playerDefenseType}
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
                isPlayerTurn={props.battleActionsConfig?.isPlayerTurn ?? false}
                contactShadowResolution={quality.contactShadowResolution}
                loadSecondaryAnimationBundles={secondaryBundlesReady}
                onHeroClick={props.onMenuHeroClick}
                forceHighlight={props.menuGamepadFocus === 'hero'}
                idlePositionX={isDungeonRun && activeScenarioConfig ? dungeonHeroBasePosition[0] : undefined}
                attackPositionX={isDungeonRun && activeScenarioConfig ? dungeonHeroAttackX : huntHeroAttackX}
                defendPositionX={isDungeonRun && activeScenarioConfig ? dungeonHeroDefendX : undefined}
                idlePositionY={isDungeonRun && activeScenarioConfig ? dungeonHeroBasePosition[1] : undefined}
                attackPositionY={isDungeonRun && activeScenarioConfig ? dungeonHeroBasePosition[1] : undefined}
                defendPositionY={isDungeonRun && activeScenarioConfig ? dungeonHeroBasePosition[1] : undefined}
                originPosition={isDungeonRun && activeScenarioConfig ? dungeonHeroBasePosition : undefined}
              />
            </group>
          );
        })()}

        {props.isMenuView && props.showMenuNavigationPortal ? (
          <Suspense fallback={null}>
            <MenuNavigationPortal
              region={props.menuPortalRegion ?? 'forest'}
              transform={menuPortalTransform}
              onActivate={props.onMenuPortalClick}
              reducedMotion={isMobileDevice && !isQualityMode}
              forceHighlight={props.menuGamepadFocus === 'portal'}
            />
          </Suspense>
        ) : null}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Battle actions: Html3D panel next to hero (non-menu, all devices) Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {!props.isMenuView && props.battleActionsConfig && props.playerState && (
          <Html
            position={isDungeonRun && activeScenarioConfig
              ? [dungeonHeroBasePosition[0] + 0.5, dungeonHeroBasePosition[1] + 2.0, 0.5]
              : isMobileDevice ? [-1.2, 2.6, 0.5] : [-1.2, 1.4, 0.5]}
            distanceFactor={isMobileDevice ? 7 : 10}
            zIndexRange={[150, 0]}
          >
            <BattleActionsHtml config={props.battleActionsConfig} player={props.playerState} isMobile={isMobileDevice} isSelecting={!!props.pendingTargetAction} />
          </Html>
        )}



        {props.heroInspectMode && props.isMenuView && props.playerState && (
          <HeroInspectCanvas
            player={props.playerState}
            onClose={() => props.onHeroInspectClose?.()}
            onEquipSlot={(slot) => props.onHeroEquipSlotClick?.(slot)}
            onUnequipSlot={(item) => props.onHeroUnequipSlotClick?.(item)}
            onSkillSlotClick={props.onHeroSkillSlotClick}
            onItemSlotClick={props.onHeroItemSlotClick}
            onUnequipItemSlot={props.onHeroUnequipItemSlot}
            onUnequipSkillSlot={props.onHeroUnequipSkillSlot}
            onShowItemDetail={(item) => setHeroItemDetail(item)}
          />
        )}

        {props.portalInspectMode && props.isMenuView && (
          <>
            {/* Transparent backdrop: click OUTSIDE cards closes portal.
                Uses onClick (not onPointerDown) so it only fires when the canvas
                itself is the click target Ã¢â‚¬â€ HTML card clicks go to the DOM element
                and never reach the canvas, avoiding a race condition where the
                backdrop unmounts the Html before the card onClick fires. */}
            <mesh
              position={[0, 0, -1]}
              onClick={(e) => { e.stopPropagation(); props.onPortalInspectClose?.(); }}
            >
              <planeGeometry args={[200, 200]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
            <PortalInspectCanvas
              currentRegion={props.currentSceneRegion ?? 'forest'}
              dungeonUnlocked={props.dungeonUnlocked ?? false}
              towerUnlocked={props.towerUnlocked ?? true}
              onClose={() => props.onPortalInspectClose?.()}
              onTravelTo={(region) => { props.onPortalTravelTo?.(region); props.onPortalInspectClose?.(); }}
            />
          </>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Group combat: main + extra enemies with world-space position props Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {(() => {
          // Each enemy has ONE fixed anchor point Ã¢â‚¬â€ they never move when attacking or defending.
          // The attack animation plays in place (model lean/swing) Ã¢â‚¬â€ no X-translation.
          const GRP = [
            // solo
            [{ idleX: 2.0, idleZ: 0.0 }],
            // 2 enemies
            [{ idleX: 1.5, idleZ: -0.3 }, { idleX: 3.8, idleZ: 0.6 }],
            // 3 enemies
            [{ idleX: 0.9, idleZ: -0.6 }, { idleX: 3.0, idleZ: 0.2 }, { idleX: 4.6, idleZ: -0.3 }],
          ];
          const extras = props.additionalEnemies ?? [];
          // Use INITIAL group size (at spawn) so positions don't shift when enemies die
          const grpSize = Math.min(3, Math.max(1, props.initialGroupSize ?? (1 + extras.length)));
          // Only apply group layout in hunt mode Ã¢â‚¬â€ dungeon uses scenario-defined positions
          const layout = !isDungeonRun ? (GRP[grpSize - 1] ?? GRP[0]) : null;
          // mainEnemySlotIndex keeps the enemy at its visual slot after target swap (no teleport)
          const mainSlot = props.mainEnemySlotIndex ?? 0;
          const mainPos = layout?.[mainSlot];
          // Extra slots = all layout slots except mainSlot, in ascending order
          const extraSlots = layout
            ? layout.map((_, i) => i).filter(i => i !== mainSlot)
            : [];
          const isSelecting = props.pendingTargetAction !== null;
          // Hero class ring color: use the actual auraColor from class data (vivid color matching the hero ring)
          const heroRingColor = getPlayerClassById((props.playerClassId ?? 'knight') as import('../types').PlayerClassId).visualProfile.auraColor ?? '#f59e0b';

          return (
            <>
              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main enemy Ã¢â€â‚¬Ã¢â€â‚¬ */}
              <group ref={outlineEnemyRef}>
                {!props.isMenuView && props.enemyGltfModelUrl ? (
                  <GltfEnemyCharacter
                    modelUrl={props.enemyGltfModelUrl}
                    bodyType={props.enemyGltfBodyType ?? 'Big'}
                    animationAction={props.enemyAnimationAction}
                    scale={props.enemyScale}
                    isAttacking={props.isEnemyAttacking}
                    isDefending={props.isEnemyDefending}
                    defendImpulseLevel={props.enemyState?.impulseGuardLevel ?? 0}
                    isHit={props.isEnemyHit}
                    contactShadowResolution={quality.contactShadowResolution}
                    statusOverlay={enemyOverlay}
                    idlePositionX={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[0] : mainPos?.idleX}
                    attackPositionX={isDungeonRun && activeScenarioConfig ? dungeonEnemyAttackX : mainPos?.idleX}
                    defendPositionX={isDungeonRun && activeScenarioConfig ? dungeonEnemyDefendX : mainPos?.idleX}
                    idlePositionY={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[1] : undefined}
                    attackPositionY={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[1] : undefined}
                    defendPositionY={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[1] : undefined}
                    originPosition={isDungeonRun && activeScenarioConfig
                      ? dungeonEnemyBasePosition
                      : mainPos ? [mainPos.idleX, -1, mainPos.idleZ] : undefined}
                  />
                ) : !props.isMenuView ? (
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
                    idlePositionX={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[0] : mainPos?.idleX}
                    attackPositionX={isDungeonRun && activeScenarioConfig ? dungeonEnemyAttackX : mainPos?.idleX}
                    defendPositionX={isDungeonRun && activeScenarioConfig ? dungeonEnemyDefendX : mainPos?.idleX}
                    idlePositionY={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[1] : undefined}
                    attackPositionY={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[1] : undefined}
                    defendPositionY={isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[1] : undefined}
                    originPosition={isDungeonRun && activeScenarioConfig
                      ? dungeonEnemyBasePosition
                      : mainPos ? [mainPos.idleX, -1, mainPos.idleZ] : undefined}
                  />
                ) : null}
              </group>

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Extra enemies Ã¢â‚¬â€ rendered at their fixed visual slot, using own model/color Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {!props.isMenuView && extras.map((extraEnemy, idx) => {
                const slotIdx = extraSlots[idx] ?? idx + 1;
                const pos = layout?.[slotIdx];
                const idleX  = pos?.idleX  ?? (3.8 + idx * 1.4);
                const idleZ  = pos?.idleZ  ?? (0.6 + idx * 0.4);
                // Fixed anchor Ã¢â‚¬â€ extras never move when attacking or defending
                const nameplateY = -1 + extraEnemy.scale * 2 + 0.2;
                return (
                  <React.Fragment key={extraEnemy.id}>
                    {/* Use correct renderer: GltfEnemyCharacter for GLTF monsters, EnemyCharacter for voxel */}
                    {extraEnemy.gltfModelUrl ? (
                      <GltfEnemyCharacter
                        modelUrl={extraEnemy.gltfModelUrl}
                        bodyType={extraEnemy.gltfBodyType ?? 'Big'}
                        animationAction="battle-idle"
                        scale={extraEnemy.scale}
                        isAttacking={false}
                        isDefending={false}
                        defendImpulseLevel={0}
                        isHit={false}
                        contactShadowResolution={quality.contactShadowResolution}
                        idlePositionX={idleX}
                        attackPositionX={idleX}
                        defendPositionX={idleX}
                        idlePositionY={-1}
                        originPosition={[idleX, -1, idleZ]}
                      />
                    ) : (
                      <EnemyCharacter
                        assets={extraEnemy.assets}
                        color={extraEnemy.color}
                        scale={extraEnemy.scale}
                        isAttacking={false}
                        isDefending={false}
                        defendImpulseLevel={0}
                        animationActionOverride="battle-idle"
                        type={extraEnemy.type}
                        enemyName={extraEnemy.name}
                        isBoss={false}
                        isHit={false}
                        attackStyle={extraEnemy.attackStyle}
                        contactShadowResolution={quality.contactShadowResolution}
                        idlePositionX={idleX}
                        attackPositionX={idleX}
                        defendPositionX={idleX}
                        idlePositionY={-1}
                        originPosition={[idleX, -1, idleZ]}
                      />
                    )}
                    {/* Selection hitbox + ring at enemy position Ã¢â‚¬â€ big clickable target over the 3D model */}
                    {isSelecting && (() => {
                      const hitboxH = Math.max(2.2, extraEnemy.scale * 2.6);
                      const isHov = hoveredEnemyId === extraEnemy.id;
                      const ringColor = isHov ? '#ffffff' : heroRingColor;
                      const ringIntensity = isHov ? 3.2 : 1.6;
                      const ringOpacity = isHov ? 1 : 0.95;
                      return (
                        <group position={[idleX, -0.97, idleZ]}>
                          {/* Tall invisible cylinder over model Ã¢â‚¬â€ easy click target */}
                          <mesh
                            position={[0, hitboxH / 2, 0]}
                            onClick={(e) => { e.stopPropagation(); props.onSelectTarget?.(extraEnemy.id); }}
                            onPointerDown={(e) => { e.stopPropagation(); props.onSelectTarget?.(extraEnemy.id); }}
                            onPointerEnter={(e) => { e.stopPropagation(); setHoveredEnemyId(extraEnemy.id); if (typeof document !== 'undefined') document.body.style.cursor = 'pointer'; }}
                            onPointerLeave={(e) => { e.stopPropagation(); setHoveredEnemyId(null); if (typeof document !== 'undefined') document.body.style.cursor = ''; }}
                          >
                            <cylinderGeometry args={[0.9, 0.9, hitboxH, 16]} />
                            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                          </mesh>
                          {/* Visible ring on ground Ã¢â‚¬â€ glows white on hover */}
                          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}
                            scale={isHov ? [1.18, 1.18, 1] : [1, 1, 1]}
                          >
                            <ringGeometry args={[0.7, 0.95, 40]} />
                            <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={ringIntensity} transparent opacity={ringOpacity} />
                          </mesh>
                        </group>
                      );
                    })()}
                    {/* HP nameplate at actual world position */}
                    <Html
                      center
                      distanceFactor={isMobileDevice ? 7 : 11}
                      zIndexRange={[90, 0]}
                      position={[idleX, nameplateY, idleZ + 0.4]}
                    >
                      {(() => {
                        const hpPct = Math.max(0, (extraEnemy.stats.hp / extraEnemy.stats.maxHp) * 100);
                        const hpColor = hpPct > 55 ? '#4ade80' : hpPct > 25 ? '#facc15' : '#f87171';
                        const cardW = isMobileDevice ? '230px' : '150px';
                        return (
                          <div
                            style={{
                              width: cardW, background: 'rgba(10,6,28,0.88)', backdropFilter: 'blur(18px)',
                              border: `1px solid ${isSelecting ? '#38bdf8' : 'rgba(148,163,184,0.3)'}`,
                              borderRadius: '10px', padding: isMobileDevice ? '10px 14px' : '6px 10px',
                              display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box',
                              cursor: isSelecting ? 'pointer' : 'default',
                              boxShadow: isSelecting ? '0 0 12px #38bdf866' : 'none',
                            }}
                            onClick={() => isSelecting && props.onSelectTarget?.(extraEnemy.id)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: isMobileDevice ? '15px' : '11px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extraEnemy.name}</span>
                              <span style={{ fontSize: isMobileDevice ? '12px' : '9px', color: '#94a3b8', marginLeft: 4 }}>Nv{extraEnemy.level}</span>
                            </div>
                            <SubscribedHpBar
                              source={{ enemyId: extraEnemy.id }}
                              barH={isMobileDevice ? '10px' : '6px'}
                              fallbackHp={extraEnemy.stats.hp}
                              fallbackMaxHp={extraEnemy.stats.maxHp}
                              compact
                            />
                            <SpeedAttributeBar
                              actorId={extraEnemy.id}
                              active={props.activeBattleActorId === extraEnemy.id}
                              isMobileDevice={isMobileDevice}
                              barH={isMobileDevice ? '10px' : '6px'}
                            />
                          </div>
                        );
                      })()}
                    </Html>
                  </React.Fragment>
                );
              })}

              {/* Selection ring on main enemy Ã¢â‚¬â€ in hero class color */}
              {!props.isMenuView && isSelecting && props.enemyState && (() => {
                const mX = !isDungeonRun ? (mainPos?.idleX ?? 2.0) : dungeonEnemyBasePosition[0];
                const mZ = !isDungeonRun ? (mainPos?.idleZ ?? 0.0) : dungeonEnemyBasePosition[2];
                const hitboxH = Math.max(2.2, (props.enemyScale ?? 1) * 2.6);
                const mainEnemyId = props.enemyState!.id;
                const isHov = hoveredEnemyId === mainEnemyId;
                const ringColor = isHov ? '#ffffff' : heroRingColor;
                const ringIntensity = isHov ? 3.2 : 1.6;
                return (
                  <group position={[mX, -0.97, mZ]}>
                    {/* Big tall invisible hitbox covering the whole enemy model Ã¢â‚¬â€ easy click target */}
                    <mesh
                      position={[0, hitboxH / 2, 0]}
                      onClick={(e) => { e.stopPropagation(); props.onSelectTarget?.(mainEnemyId); }}
                      onPointerDown={(e) => { e.stopPropagation(); props.onSelectTarget?.(mainEnemyId); }}
                      onPointerEnter={(e) => { e.stopPropagation(); setHoveredEnemyId(mainEnemyId); if (typeof document !== 'undefined') document.body.style.cursor = 'pointer'; }}
                      onPointerLeave={(e) => { e.stopPropagation(); setHoveredEnemyId(null); if (typeof document !== 'undefined') document.body.style.cursor = ''; }}
                    >
                      <cylinderGeometry args={[0.9, 0.9, hitboxH, 16]} />
                      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                    </mesh>
                    {/* Visible class-colored ring on the ground Ã¢â‚¬â€ glows white on hover */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}
                      scale={isHov ? [1.18, 1.18, 1] : [1, 1, 1]}
                    >
                      <ringGeometry args={[0.7, 0.95, 40]} />
                      <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={ringIntensity} transparent opacity={0.95} />
                    </mesh>
                  </group>
                );
              })()}
            </>
          );
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Enemy nameplate Ã¢â‚¬â€ floats above the 3D model at its actual slot position Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {!props.isMenuView && props.enemyState && (() => {
          // Slot idle positions (mirrors GRP table above, kept in sync)
          const npGRP = [
            [{ idleX: 2.0, idleZ: 0.0 }],
            [{ idleX: 1.5, idleZ: -0.3 }, { idleX: 3.8, idleZ: 0.6 }],
            [{ idleX: 0.9, idleZ: -0.6 }, { idleX: 3.0, idleZ: 0.2 }, { idleX: 4.6, idleZ: -0.3 }],
          ];
          const npExtras = props.additionalEnemies ?? [];
          const npGrpSize = Math.min(3, Math.max(1, props.initialGroupSize ?? (1 + npExtras.length)));
          const npLayout = !isDungeonRun ? (npGRP[npGrpSize - 1] ?? npGRP[0]) : null;
          const npSlot = props.mainEnemySlotIndex ?? 0;
          const npPos = npLayout?.[npSlot];
          const npX = isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[0] : (npPos?.idleX ?? 2.0);
          const npZ = isDungeonRun && activeScenarioConfig ? dungeonEnemyBasePosition[2] : (npPos?.idleZ ?? 0.0);
          const npY = isDungeonRun && activeScenarioConfig
            ? dungeonEnemyBasePosition[1] + props.enemyScale * 2 + 0.9
            : props.enemyScale * 2 - 0.1;
          return (
          <Html
            key={props.enemyState.id}
            position={[npX, npY, npZ + 0.5]}
            center
            distanceFactor={isMobileDevice ? 7 : 11}
            zIndexRange={[100, 0]}
          >
            {(() => {
              const en = props.enemyState!;
              const hpPct = Math.max(0, (en.stats.hp / en.stats.maxHp) * 100);
              const hpColor = hpPct > 55 ? '#4ade80' : hpPct > 25 ? '#facc15' : '#f87171';
              const hasMana = en.stats.maxMp > 0 && en.stats.mp > 0;
              const mpPct = hasMana ? Math.max(0, (en.stats.mp / en.stats.maxMp) * 100) : 0;
              const isDying = hpPct <= 0;
              const isBoss = props.isEnemyBoss;
              const isSubBoss = en.isSubBoss;
              const enemyClassId = (en.enemyClassId ?? 'knight') as PlayerClassId;
              const EnemyClassIcon = INSPECT_CLASS_ICON[enemyClassId] ?? Shield;
              const accentColor = isBoss ? '#ef4444' : isSubBoss ? '#f59e0b' : (props.enemyColor ?? '#94a3b8');
              const badgeLabel = isBoss ? 'CHEFÃƒÆ’O' : isSubBoss ? 'SUBCHEFE' : null;
              const speedGaugeActorId = en.id;
              const F: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };
              const cardW = isMobileDevice ? '280px' : '190px';
              const nameFz = isMobileDevice ? '18px' : '13px';
              const lvlFz  = isMobileDevice ? '20px' : '10px';
              const badgeFz = isMobileDevice ? '11px' : '8px';
              const barH = isMobileDevice ? '12px' : '8px';
              const iconBoxSz = isMobileDevice ? 22 : 16;
              const iconSz = isMobileDevice ? 14 : 10;
              return (
                <>
                  <style>{`
                    @keyframes np-enter {
                      from { opacity: 0; transform: translateY(8px) scale(0.93); }
                      to   { opacity: 1; transform: translateY(0)   scale(1);    }
                    }
                  `}</style>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    pointerEvents: 'none', ...F,
                    opacity: isDying ? 0 : 1,
                    transform: isDying ? 'translateY(-10px) scale(0.9)' : 'translateY(0) scale(1)',
                    transition: isDying ? 'opacity 0.5s ease, transform 0.5s ease' : 'opacity 0.3s ease',
                    animation: isDying ? 'none' : 'np-enter 0.35s ease-out forwards',
                  }}>
                    {/* Boss/sub-boss badge */}
                    {badgeLabel && (
                      <div style={{ fontSize: badgeFz, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.18em', background: accentColor, color: '#fff', borderRadius: '99px', padding: '2px 10px', border: `1px solid ${accentColor}cc`, boxShadow: `0 2px 12px ${accentColor}99`, whiteSpace: 'nowrap' as const }}>
                        {badgeLabel}
                      </div>
                    )}
                    {/* Main card */}
                    <div style={{ width: cardW, background: 'rgba(10,6,28,0.88)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: `1px solid ${accentColor}44`, borderRadius: '12px', padding: isMobileDevice ? '12px 16px' : '8px 12px', display: 'flex', flexDirection: 'column', gap: isMobileDevice ? '10px' : '6px', boxShadow: `0 0 0 1px ${accentColor}22, 0 6px 24px rgba(0,0,0,0.45)`, boxSizing: 'border-box' as const }}>
                      {/* Name + level */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: iconBoxSz, height: iconBoxSz, borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: `${accentColor}cc`, border: `1px solid ${accentColor}`, flexShrink: 0, boxShadow: `0 0 8px ${accentColor}` }}>
                          <EnemyClassIcon size={iconSz} />
                        </span>
                        <span style={{ fontSize: nameFz, fontWeight: 900, color: '#fff', letterSpacing: '0.03em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{en.name}</span>
                        <span style={{ fontSize: lvlFz, fontWeight: 800, color: accentColor, letterSpacing: '0.10em', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>Nv {en.level}</span>
                      </div>
                      {/* HP bar — subscribes to battleStatsStore so updates skip GameScene re-render */}
                      <SubscribedHpBar
                        source={{ enemyId: en.id }}
                        barH={barH}
                        fallbackHp={en.stats.hp}
                        fallbackMaxHp={en.stats.maxHp}
                      />
                      {/* Mana bar — also subscribed */}
                      <SubscribedMpBar
                        source={{ enemyId: en.id }}
                        barH={barH}
                        fallbackMp={en.stats.mp}
                        fallbackMaxMp={en.stats.maxMp}
                      />
                      <SpeedAttributeBar
                        actorId={speedGaugeActorId}
                        active={props.activeBattleActorId === en.id}
                        isMobileDevice={isMobileDevice}
                        barH={barH}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </Html>
          );
        })()}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Hero nameplate Ã¢â‚¬â€ floats above the hero 3D model Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {!props.isMenuView && !!props.battleActionsConfig && props.playerState && (
          <Html
            position={isDungeonRun && activeScenarioConfig
              ? [dungeonHeroBasePosition[0], dungeonHeroBasePosition[1] + 3.2, dungeonHeroBasePosition[2] + 0.5]
              : [-2.0, 2.3, 0.5]}
            center
            distanceFactor={isMobileDevice ? 7 : 11}
            zIndexRange={[100, 0]}
            pointerEvents={props.onHeroNameplateClick ? 'auto' : 'none'}
          >
            {(() => {
              const pl = props.playerState!;
              const hpPct = Math.max(0, (pl.stats.hp / pl.stats.maxHp) * 100);
              const hpColor = hpPct > 55 ? '#4ade80' : hpPct > 25 ? '#facc15' : '#f87171';
              const hasMana = pl.stats.maxMp > 0 && pl.stats.mp > 0;
              const mpPct = hasMana ? Math.max(0, (pl.stats.mp / pl.stats.maxMp) * 100) : 0;
              const isDying = hpPct <= 0;
              const classId = (props.playerClassId ?? pl.classId) as PlayerClassId;
              const pClass = getPlayerClassById(classId);
              const accentColor = pClass?.visualProfile?.secondaryColor ?? '#60a5fa';
              const ClassIcon = INSPECT_CLASS_ICON[classId] ?? Shield;
              const classNamePtHero = HERO_CLASS_NAME_PT[classId] ?? classId;
              const F: React.CSSProperties = { fontFamily: "'Segoe UI',system-ui,sans-serif" };
              const cardW = isMobileDevice ? '280px' : '190px';
              const nameFz = isMobileDevice ? '18px' : '13px';
              const lvlFz  = isMobileDevice ? '20px' : '10px';
              const clsFz  = isMobileDevice ? '11px' : '8px';
              const barH   = isMobileDevice ? '12px' : '8px';
              const iconSz = isMobileDevice ? 18 : 13;
              return (
                <>
                  <style>{`
                    @keyframes np-hero-enter {
                      from { opacity: 0; transform: translateY(8px) scale(0.93); }
                      to   { opacity: 1; transform: translateY(0)   scale(1);    }
                    }
                  `}</style>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    pointerEvents: props.onHeroNameplateClick ? 'auto' : 'none', ...F,
                    opacity: isDying ? 0 : 1,
                    transform: isDying ? 'translateY(-10px) scale(0.9)' : 'translateY(0) scale(1)',
                    transition: isDying ? 'opacity 0.5s ease, transform 0.5s ease' : 'opacity 0.3s ease',
                    animation: isDying ? 'none' : 'np-hero-enter 0.35s ease-out forwards',
                  }}>
                    {/* Main card — delegates hover/press state to HeroNameplateCard */}
                    <HeroNameplateCard
                      accentColor={accentColor}
                      cardW={cardW}
                      isMobileDevice={isMobileDevice}
                      hpPct={hpPct}
                      hpColor={hpColor}
                      hasMana={hasMana}
                      mpPct={mpPct}
                      xpPct={Math.max(0, (pl.xp / pl.xpToNext) * 100)}
                      classId={classId}
                      level={pl.level}
                      barH={barH}
                      nameFz={nameFz}
                      lvlFz={lvlFz}
                      iconSz={iconSz}
                      F={F}
                      speedGaugeActorId="player"
                      speedGaugeActive={props.activeBattleActorId === 'player'}
                      onClick={props.onHeroNameplateClick}
                    />
                  </div>
                </>
              );
            })()}
          </Html>
        )}

        {!shouldUseRuntimeScenarioEditorParity && !props.isMenuView ? (
          <BackfaceHullOverlay
            targets={outlineTargets}
            thickness={backfaceOutlineThickness}
            color="#000000"
            throttleFps={isQualityMode ? 30 : 20}
          />
        ) : null}

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
              activeImpulseLevel={props.activeImpulseLevel}
              enemyImpulseLevel={props.enemyState?.impulso ?? 0}
            />
          </Suspense>
        )}
        {shouldRenderAmbientDrift && !shouldUseRuntimeScenarioEditorParity ? (
          <AmbientDriftParticles isLowQuality={quality.isLowQuality} isDungeonRun={isDungeonRun} />
        ) : null}

        <WorldParticlesConnected renderCap={particleRenderCap} />
        {(() => {
          // Compute main enemy world anchor so floating text + loot appear over the actual model
          const ANCHOR_GRP = [
            [{ x: 2.0, z: 0.0 }],
            [{ x: 1.5, z: -0.3 }, { x: 3.8, z: 0.6 }],
            [{ x: 0.9, z: -0.6 }, { x: 3.0, z: 0.2 }, { x: 4.6, z: -0.3 }],
          ];
          const anchorExtras = props.additionalEnemies ?? [];
          const anchorSize = Math.min(3, Math.max(1, props.initialGroupSize ?? (1 + anchorExtras.length)));
          const anchorSlot = props.mainEnemySlotIndex ?? 0;
          const a = ANCHOR_GRP[anchorSize - 1]?.[anchorSlot] ?? ANCHOR_GRP[0][0];
          const enemyAnchor: [number, number, number] = isDungeonRun && activeScenarioConfig
            ? [dungeonEnemyBasePosition[0], dungeonEnemyBasePosition[1] + 1.5, dungeonEnemyBasePosition[2]]
            : [a.x, 0.5, a.z];
          return (
            <>
              <WorldFloatingTextsConnected enemyAnchor={enemyAnchor} />
              <WorldLootDisplay loot={props.lootResult ?? null} xpIcon={props.xpIconComponent} enemyAnchor={enemyAnchor} />
            </>
          );
        })()}

        {shouldUsePostProcessing && !shouldUseRuntimeScenarioEditorParity ? (
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
                {shouldUseVignette ? (
                  <Vignette eskil={false} offset={activeVignetteOffset} darkness={activeVignetteDarkness} />
                ) : null}
              </>
            ) : null}
          </EffectComposer>
        ) : null}
      </Canvas>
    </div>
  );
}, gameSceneAreEqual);

/**
 * Custom areEqual for the GameScene React.memo.
 *
 * The Three.js scene tree is the most expensive thing in the app to reconcile.
 * On every hit the player/enemy state references change because their `stats`
 * sub-object is replaced with a new object containing the new HP/MP. Without
 * this comparator the entire 3D scene would reconcile on each tick.
 *
 * The HP/MP bars inside 3D nameplates subscribe directly to `useBattleStatsStore`
 * (see `SubscribedHpBar` / `SubscribedMpBar`), so we can safely skip GameScene
 * re-renders when the only change is HP/MP. We still re-render on death
 * transitions (hp crossing 0) and on any non-stat change.
 */
function gameSceneAreEqual(prev: SceneProps, next: SceneProps): boolean {
  const prevKeys = Object.keys(prev) as (keyof SceneProps)[];
  const nextKeys = Object.keys(next) as (keyof SceneProps)[];
  if (prevKeys.length !== nextKeys.length) return false;
  for (const k of prevKeys) {
    if (k === 'playerState' || k === 'enemyState' || k === 'additionalEnemies') continue;
    if (prev[k] !== next[k]) return false;
  }
  if (!playerStateEqualExceptStats(prev.playerState, next.playerState)) return false;
  if (!enemyStateEqualExceptStats(prev.enemyState ?? null, next.enemyState ?? null)) return false;
  if (!additionalEnemiesEqualExceptStats(prev.additionalEnemies, next.additionalEnemies)) return false;
  return true;
}

function statsEqualExceptHpMp(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // Death transition forces re-render so isDying animations / death cleanup run.
  if ((a.hp <= 0) !== (b.hp <= 0)) return false;
  // Detect new mana availability so the mana bar can mount (compact bars
  // conditionally render on hasMana).
  if ((a.maxMp > 0 && a.mp > 0) !== (b.maxMp > 0 && b.mp > 0)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const k of keysA) {
    if (k === 'hp' || k === 'mp') continue;
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return true;
}

function playerStateEqualExceptStats(a: SceneProps['playerState'], b: SceneProps['playerState']): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const k of keysA) {
    if (k === 'stats') continue;
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return statsEqualExceptHpMp((a as any).stats, (b as any).stats);
}

function enemyStateEqualExceptStats(a: SceneProps['enemyState'] | null, b: SceneProps['enemyState'] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const k of keysA) {
    if (k === 'stats') continue;
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return statsEqualExceptHpMp((a as any).stats, (b as any).stats);
}

function additionalEnemiesEqualExceptStats(a: SceneProps['additionalEnemies'], b: SceneProps['additionalEnemies']): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!enemyStateEqualExceptStats(a[i] ?? null, b[i] ?? null)) return false;
  }
  return true;
}

