import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, PerspectiveCamera, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { CardCategory, Enemy, FloatingText, Particle, Player, PlayerAnimationAction, PlayerClassAnimationMap, PlayerClassAssets, PlayerClassId, StatusEffect, TurnState } from '../types';
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
  screenShake?: number;
  isLevelingUp?: boolean;
  levelUpCardCategory?: CardCategory;
  isMenuView?: boolean;
  menuCameraFocus?: boolean;
  isDungeonScene?: boolean;
  isArCameraMode?: boolean;
  stage?: number;
  isDungeonRun?: boolean;
  onGameTimeUpdate?: (time: string) => void;
  playerState?: Player;
  enemyState?: Enemy | null;
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

const CombatCinematicFX = ({
  playerAnimationAction,
  enemyAnimationAction,
  isPlayerAttacking,
  isEnemyAttacking,
  isEnemyHit,
  isPlayerHit,
  latestEnemyImpactColor,
}: {
  playerAnimationAction?: PlayerAnimationAction;
  enemyAnimationAction?: PlayerAnimationAction;
  isPlayerAttacking?: boolean;
  isEnemyAttacking?: boolean;
  isEnemyHit?: boolean;
  isPlayerHit?: boolean;
  latestEnemyImpactColor?: string;
}) => {
  const playerRefs = useRef<(THREE.Sprite | null)[]>([]);
  const enemyRefs = useRef<(THREE.Sprite | null)[]>([]);
  const playerCastAuraRef = useRef<THREE.Sprite>(null);
  const playerCastCoreRef = useRef<THREE.Sprite>(null);
  const enemyCastAuraRef = useRef<THREE.Sprite>(null);
  const enemyCastCoreRef = useRef<THREE.Sprite>(null);
  const hitBurstEnemyRef = useRef<THREE.Sprite>(null);
  const hitBurstPlayerRef = useRef<THREE.Sprite>(null);
  const hitEnemyLightRef = useRef<THREE.PointLight>(null);
  const hitEnemyPulseRef = useRef(0);
  const hitPlayerPulseRef = useRef(0);
  const wasEnemyHitRef = useRef(false);
  const wasPlayerHitRef = useRef(false);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const playerSkillActive = playerAnimationAction === 'skill';
    const enemySkillActive = enemyAnimationAction === 'skill';

    COMBAT_TRAIL_SEEDS.forEach((seed, i) => {
      const playerSprite = playerRefs.current[i];
      if (playerSprite) {
        if (playerSkillActive) {
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
        if (enemySkillActive) {
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
    }
    if (isPlayerHit && !wasPlayerHitRef.current) {
      hitPlayerPulseRef.current = 1;
    }
    wasEnemyHitRef.current = Boolean(isEnemyHit);
    wasPlayerHitRef.current = Boolean(isPlayerHit);

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
      <pointLight ref={hitEnemyLightRef} color="#fef08a" intensity={0} distance={3.2} decay={2} />
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
      <div className="overflow-hidden rounded-[22px] border border-[#cfab91] bg-[#f7ecdd]/95 px-4 py-3 shadow-[0_18px_40px_rgba(107,49,65,0.18)] backdrop-blur-md">
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

const HeroVoxel = ({ classId = 'knight', playerAnimationAction = 'idle', animationClipName, preferredAnimationBundle, onAvailableAnimationClipsChange, loadAllAnimationBundles = false, loadSecondaryAnimationBundles = true, previewLoopAllActions = false, isAttacking, isDefending, weaponId, armorId, helmetId, legsId, shieldId, isLevelingUp, levelUpCardCategory = 'especial', isMenuView = false, isHit, isPlayerCritHit, hasPerfectEvadeAura, hasDoubleAttackAura, contactShadowResolution = 256, idlePositionX = -2, attackPositionX = 0.5, defendPositionX = -1.5, originPosition = [-2, -1, 0], baseRotationY = 0.5, hiddenPartSlots, visiblePartSlots, runtimeAssetsOverride, calibrationOverride, debugRuntimeId, debugRuntimeLabel, onRuntimeDiagnosticChange, statusOverlay }: any) => {
  const playerClass = getPlayerClassById(classId);
  const runtimeHeroAssets = runtimeAssetsOverride ?? (hasRuntimeFbxAssets(playerClass.assets) ? playerClass.assets : null);
  const group = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);
  const phantomAuraRef = useRef<THREE.Group>(null);
  const twinAuraRef = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);
  const wasHitRef = useRef(false);
  const damageLightRef = useRef<THREE.PointLight>(null);
  const healLightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (damageLightRef.current) {
      damageLightRef.current.intensity = THREE.MathUtils.lerp(damageLightRef.current.intensity, 0, 0.14);
      damageLightRef.current.color.set(isPlayerCritHit ? '#facc15' : '#ef4444');
    }
    if (healLightRef.current) {
      const shouldShowHealLight = !isMenuView && (playerAnimationAction === 'heal' || playerAnimationAction === 'item');
      if (shouldShowHealLight) {
        healLightRef.current.intensity = THREE.MathUtils.lerp(healLightRef.current.intensity, 2.5, 0.07);
      } else {
        healLightRef.current.intensity = THREE.MathUtils.lerp(healLightRef.current.intensity, 0, 0.09);
      }
    }
    if (group.current) {
      // Idle/Action movement — stay at attack position while animation is still playing
      const isInAttackAnimation = isAttacking || playerAnimationAction === 'attack';
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
      group.current.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material: THREE.Material) => applyHitFlashToMaterial(material, flashRef.current > 0.03, flashRef.current * 0.65, '#ffffff'));
          } else {
            applyHitFlashToMaterial(child.material, flashRef.current > 0.03, flashRef.current * 0.65, '#ffffff');
          }
        }
      });
    }

    if (shieldRef.current) {
      shieldRef.current.visible = isDefending;
      shieldRef.current.rotation.y += 0.05;
      shieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
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

  return (
    <group>
      <group ref={group} position={originPosition} rotation={[0, baseRotationY, 0]}>
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

export const GameScene: React.FC<SceneProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameTime, setGameTime] = useState("12:00");
  const handleTimeUpdate = useCallback((time: string) => {
    setGameTime(time);
    props.onGameTimeUpdate?.(time);
  }, [props.onGameTimeUpdate]);
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const isDungeonRun = Boolean(props.isDungeonScene ?? props.isDungeonRun);
  const isArCameraMode = Boolean(props.isArCameraMode);
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
    <div ref={containerRef} className="absolute inset-0 z-0 transition-colors duration-1000" style={{ backgroundColor: isArCameraMode ? 'transparent' : bgColor }}>
      {/* Time Display Overlay - Desktop only */}
      {!isDungeonRun && !isArCameraMode && (
        <div className="absolute top-6 left-6 z-10 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1 rounded-full hidden sm:flex items-center gap-3 pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="font-mono text-white text-sm tracking-widest">{gameTime}</span>
        </div>
      )}

      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance', alpha: isArCameraMode }}
        onCreated={({ gl }) => {
          if (isArCameraMode) {
            gl.setClearAlpha(0);
          }
        }}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <CameraController screenShake={props.screenShake} menuFocus={props.menuCameraFocus ?? Boolean(props.isMenuView)} />
        {isArCameraMode ? (
          <>
            <ambientLight intensity={0.65} />
            <hemisphereLight intensity={0.55} groundColor="#243a20" color="#f4ffe6" />
            <Suspense fallback={null}>
              <BattleScenario scenario={activeScenario} lowQuality={quality.isLowQuality} />
            </Suspense>
            <ContactShadows
              position={[0, -1.04, -0.2]}
              opacity={0.28}
              scale={20}
              blur={2}
              far={9}
              resolution={battleContactShadowResolution}
            />
          </>
        ) : isDungeonRun ? (
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
          contactShadowResolution={quality.contactShadowResolution}
        />
        
        {!props.isMenuView && (
        <EnemyCharacter 
          assets={props.enemyAssets}
          color={props.enemyColor}
          scale={props.enemyScale}
          isAttacking={props.isEnemyAttacking}
          isDefending={props.isEnemyDefending}
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
        {!props.isMenuView && (
        <CombatCinematicFX
          playerAnimationAction={props.playerAnimationAction}
          enemyAnimationAction={props.enemyAnimationAction}
          isPlayerAttacking={props.isPlayerAttacking}
          isEnemyAttacking={props.isEnemyAttacking}
          isEnemyHit={props.isEnemyHit}
          isPlayerHit={props.isPlayerHit}
          latestEnemyImpactColor={latestEnemyImpactColor}
        />
        )}
        <AmbientDriftParticles isLowQuality={quality.isLowQuality} isDungeonRun={isDungeonRun} />

        {props.particles.map(p => <MeshParticle key={p.id} {...p} />)}
        <WorldFloatingTexts texts={props.floatingTexts} />

        {isArCameraMode ? null : isDungeonRun ? (
          <EffectComposer>
            {!quality.isLowQuality ? (
              <DepthOfField
                target={CHARACTER_FOCUS_TARGET}
                worldFocusRange={DUNGEON_FOCUS_RANGE}
                bokehScale={2.15}
                height={560}
              />
            ) : null}
            <Bloom intensity={0.32} luminanceThreshold={0.5} luminanceSmoothing={0.85} mipmapBlur />
            <Vignette eskil={false} offset={0.1} darkness={0.42} />
          </EffectComposer>
        ) : !quality.isLowQuality ? (
          <EffectComposer>
            <DepthOfField
              target={CHARACTER_FOCUS_TARGET}
              worldFocusRange={FOREST_FOCUS_RANGE}
              bokehScale={2.35}
              height={560}
            />
            <Bloom intensity={0.55} luminanceThreshold={0.42} luminanceSmoothing={0.8} mipmapBlur />
            <Vignette eskil={false} offset={0.06} darkness={0.1} />
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

