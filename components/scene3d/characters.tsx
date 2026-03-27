import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { ContactShadows, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PlayerAnimationAction, PlayerClassAssets } from '../../types';
import { getPlayerClassById } from '../../game/data/classes';
import { getEquippedWeaponGrip, getRegisteredWeapon3DByItemId } from '../../game/data/weaponCatalog';
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

  standardMaterial.emissive.set(color);
  standardMaterial.emissiveIntensity = active ? intensity : intensity * 0.35;
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
  const knightReferenceModel = useFBX(hasRuntimeFbxAssets(knightReferenceAssets) ? knightReferenceAssets.modelUrl : assets.modelUrl);
  const animationAssets = animationAssetsOverride ?? assets;
  const animationMap = animationAssets.animationMap;
  const primaryAnimationBundle = useMemo(
    () => selectPrimaryAnimationBundle(animationAssets, animationAction, preferredAnimationBundle),
    [animationAction, animationAssets, preferredAnimationBundle],
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

  const { actions } = useAnimations(boundClips, preparedModel);
  const activePlaybackKeyRef = useRef<string | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const equippedWeaponGrip = getEquippedWeaponGrip(equippedWeaponId);

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

    if (debugTargetId === 'barbarian') {
      console.info('[AnimDebug][barbarian] acao selecionada', {
        animationAction,
        targetClipName,
        automaticClipName,
      });
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
      previousAction.crossFadeTo(nextAction, transitionDuration, true);
      nextAction.play();
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
  originPosition?: [number, number, number];
  baseRotationY?: number;
  disableAmbientMotion?: boolean;
  statusOverlay?: React.ReactNode;
}

export const EnemyCharacter = ({
  assets,
  color,
  scale,
  isAttacking,
  isDefending,
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
  const enemyDamageLightRef = useRef<THREE.PointLight>(null);
  const flashRef = useRef<number>(0);
  const runtimeEnemyAssets = hasRuntimeFbxAssets(assets) ? assets : null;

  useFrame((state) => {
    if (enemyDamageLightRef.current) {
      if (isHit) enemyDamageLightRef.current.intensity = 3.5;
      else enemyDamageLightRef.current.intensity = THREE.MathUtils.lerp(enemyDamageLightRef.current.intensity, 0, 0.09);
    }
    if (enemyShieldRef.current) {
      enemyShieldRef.current.visible = Boolean(isDefending);
      enemyShieldRef.current.rotation.y -= 0.05;
      enemyShieldRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
    }

    if (group.current) {
      const t = state.clock.elapsedTime;

      if (isAttacking) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, attackPositionX, 0.2);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.16);
        group.current.rotation.z = Math.sin(t * 20) * 0.05;
      } else if (isDefending) {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, defendPositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.16);
        group.current.rotation.x = 0.18;
      } else {
        group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, idlePositionX, 0.1);
        group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -1, 0.16);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
        group.current.rotation.x = 0;
      }

      if (isHit) {
        flashRef.current = 1;
      } else {
        flashRef.current = THREE.MathUtils.lerp(flashRef.current, 0, 0.1);
      }

      const enemyFlashColor = isDefending ? '#60a5fa' : '#ffffff';
      group.current.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material: THREE.Material) => applyHitFlashToMaterial(material, Boolean(isHit), flashRef.current * 2, enemyFlashColor));
          } else {
            applyHitFlashToMaterial(mesh.material, Boolean(isHit), flashRef.current * 2, enemyFlashColor);
          }
        }
      });

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
    return null;
  }

  return (
    <group ref={group} position={originPosition} rotation={[0, baseRotationY, 0]}>
      <Suspense fallback={null}>
        <AnimatedEnemyCharacter assets={runtimeEnemyAssets} animationAction={enemyAnimationAction} attackStyle={attackStyle} />
      </Suspense>
      {statusOverlay}
      <ContactShadows opacity={0.35} scale={3} blur={1.8} far={2} resolution={contactShadowResolution} />
      <pointLight ref={enemyDamageLightRef} color="#ef4444" intensity={0} distance={8} decay={2.5} position={[0, 0.8, -0.3]} />
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
    </group>
  );
};
