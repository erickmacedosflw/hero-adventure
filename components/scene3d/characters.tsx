import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { ContactShadows, Html, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GltfMonsterBodyType, PlayerAnimationAction, PlayerClassAssets } from '../../types';
import { GLTF_BODY_ANIMATION_MAP } from '../../game/data/gltfMonsters';
import { getPlayerClassById } from '../../game/data/classes';
import { getEquippedWeaponGrip, getRegisteredWeapon3DByItemId } from '../../game/data/weaponCatalog';
import { configureGltfLoader } from './gltfLoader';
import {
  RuntimeHeroAssets,
  createRigComparisonReport,
  findBestClipName,
  hasRuntimeFbxAssets,
  remapClipBindingsToSkeleton,
  resolveAutomaticClipName,
  selectPrimaryAnimationBundle,
  selectSecondaryAnimationBundles,
} from './animation';
import { prepareRuntimeHeroModel } from './kitbash';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashSlot,
} from './types';
import { EquippedWeaponAttachment } from './weapons';

export const applyHitFlashToMaterial = (
  material: THREE.Material,
  active: boolean,
  intensity: number,
  color = '#ffffff',
) => {
  const standardMaterial = material as THREE.MeshStandardMaterial;

  if (!('emissive' in standardMaterial)) {
    return;
  }

  if (!active) {
    standardMaterial.emissiveIntensity = THREE.MathUtils.lerp(standardMaterial.emissiveIntensity, 0, 0.32);
    return;
  }

  standardMaterial.emissive.set(color);
  standardMaterial.emissiveIntensity = Math.min(0.38, 0.08 + intensity * 0.55);
};

interface AnimatedClassHeroProps {
  assets: RuntimeHeroAssets;
  animationAssetsOverride?: RuntimeHeroAssets;
  equippedWeaponId?: string;
  animationAction: PlayerAnimationAction;
  animationClipName?: string;
  preferredAnimationBundle?: string;
  hasWeapon?: boolean;
  loadAllAnimationBundles?: boolean;
  loadSecondaryAnimationBundles?: boolean;
  previewLoopAllActions?: boolean;
  onAvailableAnimationClipsChange?: (clipNames: string[]) => void;
  debugTargetId?: string;
  debugRuntimeId?: string;
  debugRuntimeLabel?: string;
  onRuntimeDiagnosticChange?: (diagnostic: DeveloperAnimationRuntimeDiagnostic) => void;
  visiblePartSlots?: DeveloperKitbashSlot[];
  hiddenPartSlots?: DeveloperKitbashSlot[];
  calibrationOverride?: PlayerClassAssets['calibration'];
}

export const AnimatedClassHero = ({
  assets,
  animationAssetsOverride,
  equippedWeaponId,
  animationAction,
  animationClipName,
  preferredAnimationBundle,
  hasWeapon = false,
  loadAllAnimationBundles = false,
  loadSecondaryAnimationBundles = true,
  previewLoopAllActions = false,
  onAvailableAnimationClipsChange,
  debugTargetId,
  debugRuntimeId,
  debugRuntimeLabel,
  onRuntimeDiagnosticChange,
  visiblePartSlots,
  hiddenPartSlots,
  calibrationOverride,
}: AnimatedClassHeroProps) => {
  const sourceModel = useFBX(assets.modelUrl);
  const texture = useTexture(assets.textureUrl);
  const knightReferenceAssets = getPlayerClassById('knight').assets;
  const shouldLoadKnightReference = debugTargetId === 'barbarian';
  const knightReferenceModel = useFBX(
    shouldLoadKnightReference && hasRuntimeFbxAssets(knightReferenceAssets)
      ? knightReferenceAssets.modelUrl
      : assets.modelUrl,
  );
  const animationAssets = animationAssetsOverride ?? assets;
  const animationMap = animationAssets.animationMap;
  // Use a fixed action for primary bundle selection so it never changes mid-battle.
  // Changing animationAction here would cause primaryAnimationBundle URL to change, which
  // forces mergedClips + boundClips + useAnimations to recompute — causing a visible freeze
  // on every animation transition. All clips remain available via secondaryBundles.
  const primaryAnimationBundle = useMemo(
    () => selectPrimaryAnimationBundle(animationAssets, 'battle-idle', preferredAnimationBundle),
    [animationAssets, preferredAnimationBundle],
  );
  const animationSource = useLoader(FBXLoader, primaryAnimationBundle.url) as THREE.Group;
  const secondaryBundles = useMemo(
    () => selectSecondaryAnimationBundles(animationAssets, primaryAnimationBundle.fileName, loadAllAnimationBundles, loadSecondaryAnimationBundles),
    [animationAssets, loadAllAnimationBundles, loadSecondaryAnimationBundles, primaryAnimationBundle.fileName],
  );
  const secondaryAnimationSources = useLoader(FBXLoader, secondaryBundles.map((bundle) => bundle.url)) as THREE.Group[];
  const evadeDirectionRef = useRef<'left' | 'right'>('left');
  const previousAnimationActionRef = useRef<PlayerAnimationAction>(animationAction);
  const lastDebugKeyRef = useRef('');

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

  useEffect(() => {
    if (animationAction === 'evade' && previousAnimationActionRef.current !== 'evade') {
      evadeDirectionRef.current = Math.random() < 0.5 ? 'left' : 'right';
    }

    previousAnimationActionRef.current = animationAction;
  }, [animationAction]);

  const preparedModel = useMemo(() => {
    const calibration = calibrationOverride ?? assets.calibration ?? {
      scale: 2.1,
      positionOffset: [0, 0, 0] as [number, number, number],
      rotationOffset: [0, Math.PI, 0] as [number, number, number],
    };

    return prepareRuntimeHeroModel({
      sourceModel,
      texture,
      calibration,
      visiblePartSlots,
      hiddenPartSlots,
    });
  }, [assets.calibration, calibrationOverride, hiddenPartSlots, sourceModel, texture, visiblePartSlots]);

  const boundClips = useMemo(
    () => remapClipBindingsToSkeleton({ clips: mergedClips, targetModel: preparedModel }),
    [mergedClips, preparedModel],
  );

  useEffect(() => {
    if (!onAvailableAnimationClipsChange) {
      return;
    }

    onAvailableAnimationClipsChange(
      boundClips.map((clip) => clip.name).sort((left, right) => left.localeCompare(right)),
    );
  }, [boundClips, onAvailableAnimationClipsChange]);

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

  useEffect(() => {
    if (debugTargetId !== 'barbarian' || typeof window === 'undefined') {
      return;
    }

    const report = createRigComparisonReport({
      targetModel: preparedModel,
      referenceModel: knightReferenceModel,
      clips: boundClips,
    });
    const debugKey = JSON.stringify({
      clipCount: report.clipCount,
      targetBoneCount: report.targetBoneCount,
      normalizedTrackMatchCount: report.normalizedTrackMatchCount,
      missingTrackTargetCount: report.missingTrackTargets.length,
      sharedBoneCountWithKnight: report.sharedBoneCountWithKnight,
    });

    if (lastDebugKeyRef.current === debugKey) {
      return;
    }

    lastDebugKeyRef.current = debugKey;
    (window as Window & { __heroAnimationDiagnostics?: Record<string, unknown> }).__heroAnimationDiagnostics = {
      ...((window as Window & { __heroAnimationDiagnostics?: Record<string, unknown> }).__heroAnimationDiagnostics ?? {}),
      barbarian: report,
    };

    console.groupCollapsed('[AnimDebug][barbarian] clips e bind');
    console.info('Clips encontrados:', report.clipNames);
    console.info('Resumo do bind:', {
      targetBoneCount: report.targetBoneCount,
      knightBoneCount: report.knightBoneCount,
      trackTargetCount: report.trackTargetCount,
      exactTrackMatchCount: report.exactTrackMatchCount,
      normalizedTrackMatchCount: report.normalizedTrackMatchCount,
      sharedBoneCountWithKnight: report.sharedBoneCountWithKnight,
    });
    console.info('Targets sem bind no Barbarian:', report.missingTrackTargets);
    console.info('Ossos ausentes vs Knight:', report.missingBonesVsKnight);
    console.info('Ossos extras vs Knight:', report.extraBonesVsKnight);
    console.groupEnd();
  }, [boundClips, debugTargetId, knightReferenceModel, preparedModel]);

  const { actions, mixer } = useAnimations(boundClips, preparedModel);
  const activePlaybackKeyRef = useRef<string | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const equippedWeaponGrip = getEquippedWeaponGrip(equippedWeaponId);

  // Throttle the hero mixer to 30fps: intercept mixer.update so drei's internal
  // useFrame still calls it every frame, but we only advance the skeleton when
  // 1/30s of delta has accumulated. Preserves crossfades and weight blending.
  useEffect(() => {
    if (!mixer) return undefined;
    type MixerWithPatch = THREE.AnimationMixer & { __origUpdate?: (delta: number) => void };
    const m = mixer as MixerWithPatch;
    const orig = m.update.bind(m);
    let acc = 0;
    m.__origUpdate = orig;
    m.update = (delta: number) => {
      acc += delta;
      if (acc >= 1 / 30) {
        orig(acc);
        acc = 0;
      }
    };
    return () => {
      if (m.__origUpdate) {
        m.update = m.__origUpdate;
        delete m.__origUpdate;
      }
    };
  }, [mixer]);

  useEffect(() => {
    const fallbackClip = clipMap['battle-idle'] ?? clipMap.idle ?? boundClips[0]?.name;
    const automaticClipName = resolveAutomaticClipName({
      clips: boundClips,
      animationMap,
      action: animationAction,
      hasWeapon,
      equippedWeaponGrip,
      evadeDirection: evadeDirectionRef.current,
    });
    const targetClipName = animationClipName && actions[animationClipName]
      ? animationClipName
      : automaticClipName ?? clipMap[animationAction] ?? fallbackClip;
    const isManualPreview = Boolean(animationClipName && actions[animationClipName]);

    const emitRuntimeDiagnostic = (
      status: DeveloperAnimationRuntimeDiagnostic['status'],
      actionStarted: boolean,
    ) => {
      if (!debugRuntimeId || !onRuntimeDiagnosticChange) {
        return;
      }

      onRuntimeDiagnosticChange({
        previewId: debugRuntimeId,
        label: debugRuntimeLabel ?? debugRuntimeId,
        animationAction,
        targetClipName,
        automaticClipName,
        boundClipCount: boundClips.length,
        actionStarted,
        status,
      });
    };

    if (!targetClipName) {
      emitRuntimeDiagnostic('missing-target-clip', false);
      return;
    }

    const nextAction = actions[targetClipName];

    if (!nextAction) {
      emitRuntimeDiagnostic('missing-action', false);
      return;
    }

    const playbackKey = `${animationAction}:${targetClipName}:${isManualPreview ? 'manual' : 'auto'}:${previewLoopAllActions ? 'preview-loop' : 'default-loop'}`;
    const shouldRestartAction = activeActionRef.current !== nextAction
      || activePlaybackKeyRef.current !== playbackKey
      || !nextAction.isRunning();

    if (!shouldRestartAction) {
      emitRuntimeDiagnostic('playing', true);
      return;
    }

    const previousAction = activeActionRef.current;
    const isSameAction = previousAction === nextAction;
    const transitionDuration = isManualPreview
      ? 0.24
      : animationAction === 'attack'
        ? 0.18
        : animationAction === 'hit' || animationAction === 'critical-hit'
          ? 0.2
          : animationAction === 'item' || animationAction === 'skill' || animationAction === 'heal'
            ? 0.3
            : 0.26;

    Object.entries(actions).forEach(([name, action]) => {
      if (!action || action === nextAction || action === previousAction || name === targetClipName) {
        return;
      }

      action.fadeOut(Math.max(0.16, transitionDuration * 0.8));
    });

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(isManualPreview ? 1 : animationAction === 'defend' ? 0.85 : animationAction === 'heal' ? 0.92 : animationAction === 'death' ? 0.82 : 1);
    nextAction.zeroSlopeAtStart = true;
    nextAction.zeroSlopeAtEnd = true;

    if (isManualPreview || previewLoopAllActions) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    } else if (animationAction === 'attack' || animationAction === 'item' || animationAction === 'heal' || animationAction === 'skill' || animationAction === 'defend-hit' || animationAction === 'hit' || animationAction === 'critical-hit' || animationAction === 'evade' || animationAction === 'death') {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    }

    if (previousAction && !isSameAction) {
      previousAction.enabled = true;
      nextAction.play();

      try {
        if (previousAction.getMixer() === nextAction.getMixer()) {
          previousAction.crossFadeTo(nextAction, transitionDuration, true);
        } else {
          previousAction.fadeOut(Math.max(0.16, transitionDuration * 0.8));
          nextAction.fadeIn(transitionDuration);
        }
      } catch {
        previousAction.fadeOut(Math.max(0.16, transitionDuration * 0.8));
        nextAction.fadeIn(transitionDuration);
      }
    } else {
      nextAction.fadeIn(transitionDuration).play();
    }

    activeActionRef.current = nextAction;
    activePlaybackKeyRef.current = playbackKey;
    emitRuntimeDiagnostic('playing', true);
  }, [actions, animationAction, animationClipName, animationMap, boundClips, clipMap, debugRuntimeId, debugRuntimeLabel, debugTargetId, equippedWeaponGrip, hasWeapon, onRuntimeDiagnosticChange, previewLoopAllActions]);

  useEffect(() => () => {
    activeActionRef.current?.fadeOut(0.12);
    activeActionRef.current = null;
    activePlaybackKeyRef.current = null;
  }, []);

  return (
    <group>
      <primitive object={preparedModel} />
      {getRegisteredWeapon3DByItemId(equippedWeaponId) ? (
        <EquippedWeaponAttachment characterModel={preparedModel} weaponId={equippedWeaponId} />
      ) : null}
    </group>
  );
};

export const AnimatedEnemyCharacter = ({
  assets,
  animationAction,
  attackStyle = 'armed',
}: {
  assets: RuntimeHeroAssets;
  animationAction: PlayerAnimationAction;
  attackStyle?: 'armed' | 'unarmed';
}) => (
  <AnimatedClassHero
    assets={assets}
    animationAction={animationAction}
    hasWeapon={attackStyle === 'armed'}
    loadAllAnimationBundles={false}
  />
);

interface EnemyCharacterProps {
  assets?: PlayerClassAssets;
  color?: string;
  scale: number;
  isAttacking?: boolean;
  isDefending?: boolean;
  defendImpulseLevel?: number;
  type?: 'beast' | 'humanoid' | 'undead';
  enemyName?: string;
  isBoss?: boolean;
  isHit?: boolean;
  contactShadowResolution?: number;
  attackStyle?: 'armed' | 'unarmed';
  animationActionOverride?: PlayerAnimationAction;
  idlePositionX?: number;
  attackPositionX?: number;
  defendPositionX?: number;
  idlePositionY?: number;
  attackPositionY?: number;
  defendPositionY?: number;
  originPosition?: [number, number, number];
  baseRotationY?: number;
  disableAmbientMotion?: boolean;
  statusOverlay?: React.ReactNode;
}

const MissingEnemyAssetPlaceholder = (_props: { scale?: number }) => null;

export const EnemyCharacter = ({
  assets,
  color,
  scale,
  isAttacking,
  isDefending,
  defendImpulseLevel = 0,
  type = 'undead',
  enemyName,
  isBoss,
  isHit,
  contactShadowResolution = 256,
  attackStyle = 'armed',
  animationActionOverride,
  idlePositionX = 2,
  attackPositionX = -0.35,
  defendPositionX = 1.5,
  idlePositionY = -1,
  attackPositionY = -1,
  defendPositionY = -1,
  originPosition = [2, -1, 0],
  baseRotationY = -Math.PI - 0.35,
  disableAmbientMotion = true,
  statusOverlay,
}: EnemyCharacterProps) => {
  void color;
  void type;
  void enemyName;
  void isBoss;

  const group = useRef<THREE.Group>(null);
  const enemyShieldRef = useRef<THREE.Group>(null);
  const enemyDefendImpulseAuraRef = useRef<THREE.Group>(null);
  const enemyDamageLightRef = useRef<THREE.PointLight>(null);
  const flashRef = useRef<number>(0);
  const wasHitRef = useRef(false);
  const flashMaterialsRef = useRef<THREE.Material[]>([]);
  const runtimeEnemyAssets = hasRuntimeFbxAssets(assets) ? assets : null;
  const holdGroundForAction = animationActionOverride === 'item';
  const shouldLungeAttack = isAttacking && !holdGroundForAction;
  // Track last applied impulse level to avoid re-parsing the hex color string every frame.
  const lastAppliedImpulseLevelRef = useRef<number>(-1);

  const refreshFlashMaterials = React.useCallback(() => {
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
  }, [refreshFlashMaterials, runtimeEnemyAssets]);

  useFrame((state) => {
    if (enemyDamageLightRef.current) {
      enemyDamageLightRef.current.intensity = THREE.MathUtils.lerp(enemyDamageLightRef.current.intensity, 0, 0.14);
    }
    if (enemyShieldRef.current) {
      enemyShieldRef.current.visible = Boolean(isDefending);
      enemyShieldRef.current.rotation.y -= 0.05;
      enemyShieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
    }

    if (enemyDefendImpulseAuraRef.current) {
      const auraVisible = Boolean(isDefending) && defendImpulseLevel > 0;
      enemyDefendImpulseAuraRef.current.visible = auraVisible;
      enemyDefendImpulseAuraRef.current.rotation.y -= 0.07 + (defendImpulseLevel * 0.01);
      enemyDefendImpulseAuraRef.current.position.y = 0.9 + Math.sin(state.clock.elapsedTime * 5.5) * 0.04;
      // Only re-parse and apply the hex color string when the level actually changes.
      if (lastAppliedImpulseLevelRef.current !== defendImpulseLevel) {
        lastAppliedImpulseLevelRef.current = defendImpulseLevel;
        const defendImpulseColor = defendImpulseLevel >= 3 ? '#7dd3fc' : defendImpulseLevel === 2 ? '#a855f7' : '#ef4444';
        enemyDefendImpulseAuraRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.set(defendImpulseColor);
            child.material.emissive.set(defendImpulseColor);
          }
        });
      }
    }

    if (group.current) {
      const t = state.clock.elapsedTime;

      if (shouldLungeAttack) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, attackPositionX, 0.2);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, attackPositionY, 0.16);
        group.current.rotation.z = Math.sin(t * 20) * 0.05;
      } else if (isDefending) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, defendPositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, defendPositionY, 0.16);
        group.current.rotation.x = 0.18;
      } else {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, idlePositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, idlePositionY, 0.16);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
        group.current.rotation.x = 0;
      }

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
          applyHitFlashToMaterial(material, flashRef.current > 0.03, flashRef.current * 0.65, '#ffffff');
        });
      }

      const breathe = disableAmbientMotion ? 1 : 1 + Math.sin(t * 2.8) * 0.02;
      group.current.scale.setScalar(scale * breathe);
    }
  });

  const enemyAnimationAction: PlayerAnimationAction = animationActionOverride ?? (isAttacking
    ? 'attack'
    : isDefending
      ? 'defend'
      : 'battle-idle');

  if (!runtimeEnemyAssets) {
    return (
      <group ref={group} position={originPosition} rotation={[0, baseRotationY, 0]}>
        <MissingEnemyAssetPlaceholder scale={Math.max(0.92, scale * 0.85)} />
        {statusOverlay}
        <ContactShadows frames={1} opacity={0.24} scale={2.6} blur={4} far={1.8} resolution={contactShadowResolution} />
      </group>
    );
  }

  return (
    <group ref={group} position={originPosition} rotation={[0, baseRotationY, 0]}>
      <Suspense fallback={null}>
        <AnimatedEnemyCharacter assets={runtimeEnemyAssets} animationAction={enemyAnimationAction} attackStyle={attackStyle} />
      </Suspense>
      {statusOverlay}
      <ContactShadows frames={1} opacity={0.32} scale={2.6} blur={4} far={1.8} resolution={contactShadowResolution} />
      {/* Damage flash light */}
      <pointLight ref={enemyDamageLightRef} color="#ef4444" intensity={0} distance={8} decay={2.5} position={[0, 0.8, -0.3]} />
      {/* Rim light — behind the model (Z negative = away from camera), separates silhouette */}
      <pointLight color="#c4b5fd" intensity={1.1} distance={5} decay={2} position={[0, 1.1, -1.8]} />
      {/* Fill light — subtle warm light from below for volume */}
      <pointLight color="#fde68a" intensity={0.38} distance={3.5} decay={2.5} position={[0, -0.6, 0.6]} />
      <group ref={enemyShieldRef} position={[0, 0.9, 0]} visible={false}>
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
      <group ref={enemyDefendImpulseAuraRef} position={[0, 0.9, 0]} visible={Boolean(isDefending) && defendImpulseLevel > 0}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.52, 0.045, 10, 42]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.35} transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[1.34, 0.03, 10, 36]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.15} transparent opacity={0.36} />
        </mesh>
        <pointLight
          color={defendImpulseLevel >= 3 ? '#7dd3fc' : defendImpulseLevel === 2 ? '#a855f7' : '#ef4444'}
          intensity={1.45 + (defendImpulseLevel * 0.32)}
          distance={5.8}
          decay={2}
          position={[0, 0.42, -0.28]}
        />
      </group>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GLTF Enemy Character — used in the battle scene for GLTF-based monsters
// ─────────────────────────────────────────────────────────────────────────────

interface GltfEnemyCharacterProps {
  modelUrl: string;
  bodyType: GltfMonsterBodyType;
  animationAction?: PlayerAnimationAction;
  scale?: number;
  isAttacking?: boolean;
  isDefending?: boolean;
  defendImpulseLevel?: number;
  isHit?: boolean;
  contactShadowResolution?: number;
  idlePositionX?: number;
  attackPositionX?: number;
  defendPositionX?: number;
  idlePositionY?: number;
  attackPositionY?: number;
  defendPositionY?: number;
  originPosition?: [number, number, number];
  statusOverlay?: React.ReactNode;
}

const GltfEnemyModel: React.FC<{
  modelUrl: string;
  bodyType: GltfMonsterBodyType;
  animationAction: PlayerAnimationAction;
}> = ({ modelUrl, bodyType, animationAction }) => {
  const gltf = useLoader(GLTFLoader, modelUrl, configureGltfLoader) as any;

  const { clonedScene, floorOffsetY } = useMemo(() => {
    const scene = (SkeletonUtils.clone as (src: THREE.Object3D) => THREE.Group)(gltf.scene);
    scene.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const offsetY = !box.isEmpty() && isFinite(box.min.y) ? -box.min.y : 0;
    return { clonedScene: scene, floorOffsetY: offsetY };
  }, [gltf.scene]);

  // Mixer criado diretamente no clonedScene — evita o problema de timing
  // da hook useAnimations do drei (mixer nasce antes do ref ser populado).
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
    };
  }, [clonedScene]);

  // Troca de animação quando a ação muda
  useEffect(() => {
    const mixer = mixerRef.current;
    const clips: THREE.AnimationClip[] = gltf.animations ?? [];
    if (!mixer || !clips.length) return;

    const map = GLTF_BODY_ANIMATION_MAP[bodyType] ?? {};
    const clipName = map[animationAction] ?? null;
    const clip = clipName
      ? THREE.AnimationClip.findByName(clips, clipName)
      : clips[0];
    if (!clip) return;

    mixer.stopAllAction();
    mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [animationAction, bodyType, clonedScene, gltf.animations]);

  // Avança o mixer a 30 fps para reduzir CPU sem afetar a renderização.
  const animAccRef = useRef(0);
  useFrame((_, delta) => {
    animAccRef.current += delta;
    if (animAccRef.current >= 1 / 30) {
      mixerRef.current?.update(animAccRef.current);
      animAccRef.current = 0;
    }
  });

  return <primitive object={clonedScene} position={[0, floorOffsetY, 0]} />;
};

export const GltfEnemyCharacter = ({
  modelUrl,
  bodyType,
  animationAction = 'battle-idle',
  scale = 1,
  isAttacking = false,
  isDefending = false,
  defendImpulseLevel = 0,
  isHit = false,
  contactShadowResolution = 256,
  idlePositionX = 2,
  attackPositionX = -0.35,
  defendPositionX = 1.5,
  idlePositionY = -1,
  attackPositionY = -1,
  defendPositionY = -1,
  originPosition = [2, -1, 0],
  statusOverlay,
}: GltfEnemyCharacterProps) => {
  const group = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Group>(null);
  const impulseAuraRef = useRef<THREE.Group>(null);
  const flashRef = useRef(0);
  const wasHitRef = useRef(false);
  const flashMaterialsRef = useRef<THREE.Material[]>([]);
  // Track last applied impulse level to avoid re-parsing the hex color string every frame.
  const lastAppliedImpulseLevelRef = useRef<number>(-1);

  const refreshFlashMaterials = React.useCallback(() => {
    if (!group.current) { flashMaterialsRef.current = []; return; }
    const mats: THREE.Material[] = [];
    group.current.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (Array.isArray(mesh.material)) mats.push(...mesh.material);
      else mats.push(mesh.material);
    });
    flashMaterialsRef.current = mats;
  }, []);

  const isFlying = bodyType === 'Flying';
  // Flying monsters hover 0.55 units above the baseline
  const flyingBaseYOffset = isFlying ? 0.55 : 0;
  const shouldLunge = isAttacking;

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    // Flying hover: slow sinusoidal Y oscillation + gentle roll
    const floatY = isFlying ? flyingBaseYOffset + Math.sin(t * 1.8) * 0.14 : 0;
    const floatRoll = isFlying ? Math.sin(t * 1.3) * 0.04 : 0;

    if (shouldLunge) {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, attackPositionX, 0.2);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, attackPositionY + floatY, 0.16);
      group.current.rotation.z = Math.sin(t * 20) * 0.05;
    } else if (isDefending) {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, defendPositionX, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, defendPositionY + floatY, 0.16);
      group.current.rotation.x = 0.12;
      group.current.rotation.z = floatRoll;
    } else {
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, idlePositionX, 0.1);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, idlePositionY + floatY, 0.16);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, floatRoll, 0.08);
      group.current.rotation.x = 0;
    }

    // Shield aura
    if (shieldRef.current) {
      shieldRef.current.visible = Boolean(isDefending);
      shieldRef.current.rotation.y -= 0.05;
      shieldRef.current.scale.setScalar(1 + Math.sin(t * 8) * 0.05);
    }

    // Impulse aura
    if (impulseAuraRef.current) {
      const auraVisible = Boolean(isDefending) && defendImpulseLevel > 0;
      impulseAuraRef.current.visible = auraVisible;
      impulseAuraRef.current.rotation.y -= 0.07 + (defendImpulseLevel * 0.01);
      impulseAuraRef.current.position.y = 0.9 + Math.sin(t * 5.5) * 0.04;
      // Only re-parse and apply the hex color string when the level actually changes.
      if (lastAppliedImpulseLevelRef.current !== defendImpulseLevel) {
        lastAppliedImpulseLevelRef.current = defendImpulseLevel;
        const impulseColor = defendImpulseLevel >= 3 ? '#7dd3fc' : defendImpulseLevel === 2 ? '#a855f7' : '#ef4444';
        impulseAuraRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.set(impulseColor);
            child.material.emissive.set(impulseColor);
          }
        });
      }
    }

    if (isHit && !wasHitRef.current) flashRef.current = 1;
    flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.32);
    wasHitRef.current = isHit;

    if (flashRef.current > 0.003) {
      if (flashMaterialsRef.current.length === 0) refreshFlashMaterials();
      flashMaterialsRef.current.forEach((m) =>
        applyHitFlashToMaterial(m, flashRef.current > 0.03, flashRef.current * 0.65),
      );
    }

    group.current.scale.setScalar(0.6 * (1 + Math.sin(t * 2.4) * 0.012));
  });

  return (
    <group ref={group} position={originPosition} rotation={[0, -0.35, 0]}>
      {statusOverlay}
      <Suspense fallback={null}>
        <GltfEnemyModel modelUrl={modelUrl} bodyType={bodyType} animationAction={animationAction} />
      </Suspense>
      {/* Flying monsters cast a faded shadow far below them */}
      <ContactShadows
        frames={1}
        opacity={isFlying ? 0.14 : 0.32}
        scale={3}
        blur={isFlying ? 3.5 : 2}
        far={isFlying ? 3 : 2}
        resolution={contactShadowResolution}
      />

      {/* Blue shield bubble */}
      <group ref={shieldRef} position={[0, 0.9, 0]} visible={false}>
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

      {/* Impulse aura rings */}
      <group ref={impulseAuraRef} position={[0, 0.9, 0]} visible={Boolean(isDefending) && defendImpulseLevel > 0}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.52, 0.045, 10, 42]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.35} transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[1.34, 0.03, 10, 36]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.15} transparent opacity={0.36} />
        </mesh>
        <pointLight
          color={defendImpulseLevel >= 3 ? '#7dd3fc' : defendImpulseLevel === 2 ? '#a855f7' : '#ef4444'}
          intensity={1.45 + (defendImpulseLevel * 0.32)}
          distance={5.8}
          decay={2}
          position={[0, 0.42, -0.28]}
        />
      </group>
    </group>
  );
};
