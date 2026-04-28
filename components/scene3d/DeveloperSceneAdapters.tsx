import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { ContactShadows, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HeroVoxel, CombinedHeroVoxel } from '../Scene3D';
import { RuntimeHeroAssets, findBestClipName, remapClipBindingsToSkeleton, resolveAutomaticClipName, selectPrimaryAnimationBundle, selectSecondaryAnimationBundles } from './animation';
import { AnimatedClassHero, EnemyCharacter, applyHitFlashToMaterial } from './characters';
import {
  DeveloperClassBuilderSceneRenderer,
  DeveloperGltfMonsterSceneRenderer,
  DeveloperHeroSceneRenderer,
  DeveloperKitbashSceneRenderer,
  DeveloperMonsterSceneRenderer,
  DeveloperScenarioComposerSceneRenderer,
  DeveloperWeaponCalibrationSceneRenderer,
} from './developer-scenes';
import type {
  DeveloperClassBuilderSceneProps,
  DeveloperGltfMonsterSceneProps,
  DeveloperHeroSceneProps,
  DeveloperKitbashSceneProps,
  DeveloperMonsterSceneProps,
  DeveloperScenarioComposerSceneProps,
} from './developer-scenes';
import { resolveRuntimeClassAssets } from './developer';
import { KITBASH_MAIN_SLOTS, prepareRuntimeHeroModel, rebindPreparedModelToSkeleton } from './kitbash';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashMainSlot,
  DeveloperKitbashTransform,
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './types';
import { EquippedWeaponAttachment } from './weapons';
import { getPlayerClassById } from '../../game/data/classes';
import { getEquippedWeaponGrip, getRegisteredWeapon3DByItemId } from '../../game/data/weaponCatalog';
import type { PlayerAnimationAction, PlayerClassId } from '../../types';

export const DeveloperHeroScene: React.FC<DeveloperHeroSceneProps> = (props) => (
  <DeveloperHeroSceneRenderer {...props} HeroVoxelComponent={HeroVoxel} />
);

export const DeveloperMonsterScene: React.FC<DeveloperMonsterSceneProps> = (props) => (
  <DeveloperMonsterSceneRenderer {...props} EnemyCharacterComponent={EnemyCharacter} />
);

export const DeveloperGltfMonsterScene: React.FC<DeveloperGltfMonsterSceneProps> = (props) => (
  <DeveloperGltfMonsterSceneRenderer {...props} HeroVoxelComponent={HeroVoxel} />
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
        <ContactShadows opacity={0.32} scale={2.6} blur={4} far={1.8} resolution={contactShadowResolution} />
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

export const DeveloperScenarioComposerScene: React.FC<DeveloperScenarioComposerSceneProps> = (props) => (
  <DeveloperScenarioComposerSceneRenderer
    {...props}
    HeroVoxelComponent={HeroVoxel}
    EnemyCharacterComponent={EnemyCharacter}
  />
);

export const DeveloperKitbashScene: React.FC<DeveloperKitbashSceneProps> = (props) => (
  <DeveloperKitbashSceneRenderer
    {...props}
    HeroVoxelComponent={HeroVoxel}
    CombinedHeroVoxelComponent={CombinedHeroVoxel}
    AnimatedClassHeroComponent={AnimatedClassHero}
    EnemyCharacterComponent={EnemyCharacter}
  />
);
