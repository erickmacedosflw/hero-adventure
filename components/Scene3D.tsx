import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, PerspectiveCamera, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { FloatingText, Particle, PlayerAnimationAction, PlayerClassAnimationMap, PlayerClassAssets, PlayerClassId, TurnState } from '../types';
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
  FogController,
  NightEnemyGlow,
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
  stage?: number;
  isDungeonRun?: boolean;
  onGameTimeUpdate?: (time: string) => void;
}

// --- MAIN COMPONENTS ---

const SPARKLE_COUNT = 12;
const SPARKLE_SEEDS = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  orbitSpeed: 1.2 + (i % 4) * 0.35,
  orbitRadius: 0.45 + (i % 3) * 0.22,
  baseY: -0.4 + (i / SPARKLE_COUNT) * 2.2,
  riseSpeed: 0.6 + (i % 5) * 0.2,
  phase: (i / SPARKLE_COUNT) * Math.PI * 2,
  size: 0.035 + (i % 2) * 0.02,
}));

const LevelUpEffect = () => {
  const groupRef = useRef<THREE.Group>(null);
  const pillarRef = useRef<THREE.Mesh>(null);
  const ring0Ref = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const sparklesRef = useRef<(THREE.Mesh | null)[]>([]);
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const localTime = useRef(0);

  useFrame((_, delta) => {
    localTime.current += delta;
    const t = localTime.current;

    // Intro scale: quick grow from 0 to 1 in ~0.4s
    if (groupRef.current) {
      const intro = Math.min(t / 0.4, 1);
      const s = intro * intro * (3 - 2 * intro); // smoothstep
      groupRef.current.scale.setScalar(s);
    }

    // Pillar: pulse opacity + slight scale breathing
    if (pillarRef.current) {
      const mat = pillarRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.25 + Math.sin(t * 4) * 0.15;
      mat.emissiveIntensity = 2.5 + Math.sin(t * 3.5) * 1.5;
      pillarRef.current.scale.x = 1 + Math.sin(t * 5) * 0.15;
      pillarRef.current.scale.z = 1 + Math.sin(t * 5) * 0.15;
    }

    // Rings: rotate + expand & pulse scale
    if (ring0Ref.current) {
      ring0Ref.current.rotation.z = t * 1.2;
      const pulse0 = 1 + Math.sin(t * 3) * 0.12;
      ring0Ref.current.scale.set(pulse0, pulse0, 1);
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = -t * 0.9;
      const pulse1 = 1 + Math.sin(t * 3.5 + 1) * 0.1;
      ring1Ref.current.scale.set(pulse1, pulse1, 1);
      ring1Ref.current.position.y = 0.3 + Math.sin(t * 2) * 0.1;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = t * 1.5;
      const pulse2 = 1 + Math.sin(t * 4 + 2) * 0.08;
      ring2Ref.current.scale.set(pulse2, pulse2, 1);
      ring2Ref.current.position.y = 1.2 + Math.sin(t * 2.5 + 0.5) * 0.12;
    }

    // Sparkles: orbit + rise + fade
    sparklesRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const seed = SPARKLE_SEEDS[i];
      const angle = seed.phase + t * seed.orbitSpeed;
      const r = seed.orbitRadius + Math.sin(t * 2 + i) * 0.08;
      mesh.position.x = Math.cos(angle) * r;
      mesh.position.z = Math.sin(angle) * r;
      mesh.position.y = seed.baseY + Math.sin(t * seed.riseSpeed + seed.phase) * 0.35;
      const sparkScale = 0.8 + Math.sin(t * 6 + i * 1.3) * 0.4;
      mesh.scale.setScalar(sparkScale);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.5 + Math.sin(t * 5 + i * 0.8) * 0.4;
    });

    // Lights: pulse intensity
    if (light1Ref.current) {
      light1Ref.current.intensity = 3 + Math.sin(t * 4) * 2;
    }
    if (light2Ref.current) {
      light2Ref.current.intensity = 1.5 + Math.sin(t * 3 + 1) * 1;
      light2Ref.current.position.y = 1.5 + Math.sin(t * 2) * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.8, 0]} scale={0}>
      {/* Central golden pillar of light */}
      <mesh ref={pillarRef} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.5, 3.5, 12, 1, true]} />
        <meshStandardMaterial color="#facc15" emissive="#fbbf24" emissiveIntensity={3} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Rings */}
      <mesh ref={ring0Ref} position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.06, 8, 24]} />
        <meshStandardMaterial color="#fbbf24" emissive="#facc15" emissiveIntensity={2.5} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring1Ref} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.04, 8, 20]} />
        <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={2} transparent opacity={0.45} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.03, 8, 16]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fcd34d" emissiveIntensity={2} transparent opacity={0.35} />
      </mesh>
      {/* Orbiting sparkle particles */}
      {SPARKLE_SEEDS.map((seed, i) => (
        <mesh key={i} ref={el => { sparklesRef.current[i] = el; }} position={[0, seed.baseY, 0]}>
          <sphereGeometry args={[seed.size, 6, 6]} />
          <meshStandardMaterial color="#fef9c3" emissive="#fbbf24" emissiveIntensity={3} transparent opacity={0.8} />
        </mesh>
      ))}
      {/* Pulsing lights */}
      <pointLight ref={light1Ref} position={[0, 0.6, 0]} color="#fbbf24" intensity={4} distance={6} decay={2} />
      <pointLight ref={light2Ref} position={[0, 1.5, 0.5]} color="#fde68a" intensity={2} distance={4} decay={2} />
      {/* Base platforms */}
      <VoxelPart position={[0, -0.8, 0]} size={[1.8, 0.08, 1.8]} color="#facc15" material="gem" opacity={0.5} />
      <VoxelPart position={[0, -0.3, 0]} size={[1.2, 0.06, 1.2]} color="#fbbf24" material="gem" opacity={0.35} />
    </group>
  );
};

const HeroVoxel = ({ classId = 'knight', playerAnimationAction = 'idle', animationClipName, preferredAnimationBundle, onAvailableAnimationClipsChange, loadAllAnimationBundles = false, loadSecondaryAnimationBundles = true, previewLoopAllActions = false, isAttacking, isDefending, weaponId, armorId, helmetId, legsId, shieldId, isLevelingUp, isHit, isPlayerCritHit, hasPerfectEvadeAura, hasDoubleAttackAura, contactShadowResolution = 256, idlePositionX = -2, attackPositionX = 0.5, defendPositionX = -1.5, originPosition = [-2, -1, 0], baseRotationY = 0.5, hiddenPartSlots, visiblePartSlots, runtimeAssetsOverride, calibrationOverride, debugRuntimeId, debugRuntimeLabel, onRuntimeDiagnosticChange }: any) => {
  const playerClass = getPlayerClassById(classId);
  const runtimeHeroAssets = runtimeAssetsOverride ?? (hasRuntimeFbxAssets(playerClass.assets) ? playerClass.assets : null);
  const group = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);
  const phantomAuraRef = useRef<THREE.Group>(null);
  const twinAuraRef = useRef<THREE.Group>(null);
  const flashRef = useRef<number>(0);
  const damageLightRef = useRef<THREE.PointLight>(null);
  const healLightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (damageLightRef.current) {
      if (isHit) damageLightRef.current.intensity = 3.5;
      else damageLightRef.current.intensity = THREE.MathUtils.lerp(damageLightRef.current.intensity, 0, 0.09);
      damageLightRef.current.color.set(isPlayerCritHit ? '#facc15' : '#ef4444');
    }
    if (healLightRef.current) {
      if (playerAnimationAction === 'heal' || playerAnimationAction === 'item') {
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

      // Hit Flash
      if (isHit) {
        flashRef.current = 1;
      } else {
        flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.1);
      }
      const heroFlashColor = isDefending ? '#60a5fa' : '#ffffff';
      group.current.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material: THREE.Material) => applyHitFlashToMaterial(material, Boolean(isHit), flashRef.current * 2, heroFlashColor));
          } else {
            applyHitFlashToMaterial(child.material, Boolean(isHit), flashRef.current * 2, heroFlashColor);
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
        {isLevelingUp && <LevelUpEffect />}
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

const FramePacingController = ({ targetFps }: { targetFps: number }) => {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let rafId = 0;
    let lastFrameTime = 0;
    const frameInterval = 1000 / Math.max(1, targetFps);

    const tick = (now: number) => {
      if (now - lastFrameTime >= frameInterval) {
        lastFrameTime = now;
        invalidate();
      }
      rafId = window.requestAnimationFrame(tick);
    };

    invalidate();
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [invalidate, targetFps]);

  return null;
};

export const GameScene: React.FC<SceneProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameTime, setGameTime] = useState("12:00");
  const handleTimeUpdate = useCallback((time: string) => {
    setGameTime(time);
    props.onGameTimeUpdate?.(time);
  }, [props.onGameTimeUpdate]);
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const isDungeonRun = Boolean(props.isDungeonRun);
  const enableFramePacing = quality.isLowQuality;
  const targetFps = enableFramePacing ? 30 : 60;

  const bgColor = useMemo(() => {
    if (isDungeonRun) {
      return '#111827';
    }
    const stage = props.stage || 1;
    const colors = ['#020617', '#0c0a09', '#050505', '#1e1b4b', '#450a0a'];
    return colors[(stage - 1) % colors.length];
  }, [isDungeonRun, props.stage]);

  const activeScenario = useMemo(() => getScenario('forest'), []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 transition-colors duration-1000" style={{ backgroundColor: bgColor }}>
      {/* Time Display Overlay - Desktop only */}
      {!isDungeonRun && (
        <div className="absolute top-6 left-6 z-10 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1 rounded-full hidden sm:flex items-center gap-3 pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="font-mono text-white text-sm tracking-widest">{gameTime}</span>
        </div>
      )}

      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
        frameloop={enableFramePacing ? 'demand' : 'always'}
      >
        {enableFramePacing && <FramePacingController targetFps={targetFps} />}
        <CameraController screenShake={props.screenShake} />
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
            <FogController />
            <DayNightCycle containerRef={containerRef} onTimeUpdate={handleTimeUpdate} quality={quality} />
            <pointLight position={[-5, 2, -2]} intensity={0.5} color="#3b82f6" />
            <NightEnemyGlow gameTime={gameTime} />
            <Suspense fallback={null}>
              <BattleScenario scenario={activeScenario} lowQuality={quality.isLowQuality} />
            </Suspense>
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
          isHit={props.isPlayerHit}
          isPlayerCritHit={props.isPlayerCritHit}
          hasPerfectEvadeAura={props.hasPerfectEvadeAura}
          hasDoubleAttackAura={props.hasDoubleAttackAura}
          contactShadowResolution={quality.contactShadowResolution}
        />
        
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
        />

        {props.particles.map(p => <MeshParticle key={p.id} {...p} />)}
        <WorldFloatingTexts texts={props.floatingTexts} />

        <EffectComposer>
          <Vignette eskil={false} offset={0.1} darkness={0.42} />
        </EffectComposer>
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

