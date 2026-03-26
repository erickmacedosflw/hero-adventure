import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera, TransformControls, useAnimations, useFBX, useTexture } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FloatingText, Particle, PlayerAnimationAction, PlayerClassAnimationMap, PlayerClassAssets, PlayerClassId, TurnState } from '../types';
import {
  RIGHT_HAND_BONE_CANDIDATES,
  RuntimeHeroAssets,
  buildRuntimeMaterial,
  collectBoneNames,
  createNormalizedBoneLookup,
  createNormalizedBoneObjectLookup,
  createRigComparisonReport,
  findAttachmentBone,
  findBestClipName,
  getDominantBoundsAxis,
  getTrackBindingTargetName,
  hasRuntimeFbxAssets,
  normalizeMeshName,
  normalizeRigName,
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
  DungeonBattlePlatform,
  FogController,
  NightEnemyGlow,
  SkyboxController,
  createModularBuilderQualityProfile,
  getRenderQualityProfile,
} from './scene3d/environment';
import { MeshParticle, WorldFloatingTexts } from './scene3d/effects';
import { BattleScenario } from './scene3d/scenarios';
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
import { getEquippedWeaponGrip, getRegisteredWeapon3DByItemId, RegisteredWeapon3DDefinition, RegisteredWeaponGrip, RegisteredWeaponGripPoint } from '../game/data/weaponCatalog';
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

interface DeveloperHeroSceneProps {
  classId?: PlayerClassId;
  animationAction?: PlayerAnimationAction;
  animationClipName?: string;
  preferredAnimationBundle?: string;
  loadAllAnimationBundles?: boolean;
  loadSecondaryAnimationBundles?: boolean;
  onAvailableAnimationClipsChange?: (clipNames: string[]) => void;
  equippedWeaponId?: string;
  equippedArmorId?: string;
  equippedHelmetId?: string;
  equippedLegsId?: string;
  equippedShieldId?: string;
  isHit?: boolean;
  transparent?: boolean;
  autoRotate?: boolean;
  enableManualRotate?: boolean;
  transparentCameraZoom?: number;
  transparentModelScale?: number;
  transparentModelOffsetY?: number;
}

interface DeveloperMonsterSceneProps {
  enemyName: string;
  enemyAssets?: PlayerClassAssets;
  enemyColor?: string;
  enemyScale?: number;
  enemyAttackStyle?: 'armed' | 'unarmed';
  animationAction?: PlayerAnimationAction;
  isHit?: boolean;
}

interface DeveloperKitbashSceneProps {
  baseClassId: PlayerClassId;
  donorLabel: string;
  donorAssets: PlayerClassAssets;
  donorColor?: string;
  donorScale?: number;
  donorAttackStyle?: 'armed' | 'unarmed';
  donorType?: 'class' | 'enemy';
  animationAction?: PlayerAnimationAction;
  slotAssignments?: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>>;
  analysis?: DeveloperKitbashAnalysis | null;
  onAnalysisChange?: (analysis: DeveloperKitbashAnalysis | null) => void;
  onRuntimeDiagnosticsChange?: (diagnostics: Record<string, DeveloperAnimationRuntimeDiagnostic>) => void;
}

interface DeveloperClassBuilderSceneProps {
  baseClassId: PlayerClassId;
  animationAction?: PlayerAnimationAction;
  animationClipName?: string;
  preferredAnimationBundle?: string;
  loadAllAnimationBundles?: boolean;
  loadSecondaryAnimationBundles?: boolean;
  onAvailableAnimationClipsChange?: (clipNames: string[]) => void;
  onRuntimeDiagnosticsChange?: (diagnostics: Record<string, DeveloperAnimationRuntimeDiagnostic>) => void;
  equippedWeaponId?: string;
  weaponTransformOverride?: DeveloperWeaponTransformOverride;
  showWeaponAnchorHelper?: boolean;
  showWeaponTransformControls?: boolean;
  weaponTransformControlMode?: DeveloperWeaponTransformControlMode;
  onWeaponTransformOverrideChange?: (transform: DeveloperWeaponTransformOverride) => void;
  isHit?: boolean;
  partSelections: Record<DeveloperKitbashMainSlot, PlayerClassId>;
}

const KITBASH_MAIN_SLOTS: DeveloperKitbashMainSlot[] = ['head', 'torso', 'arms', 'legs'];

const getKitbashRootSlot = (slot: DeveloperKitbashSlot): DeveloperKitbashMainSlot => {
  if (slot === 'head' || slot === 'hat' || slot === 'helmet' || slot === 'visor' || slot === 'mask' || slot === 'hood' || slot === 'beard') {
    return 'head';
  }

  if (slot === 'cape' || slot === 'quiver' || slot === 'torso' || slot === 'shoulders' || slot === 'accessory') {
    return 'torso';
  }

  if (slot === 'arms') {
    return 'arms';
  }

  return 'legs';
};

const getKitbashAnchorSlots = (slot: DeveloperKitbashSlot): DeveloperKitbashSlot[] => {
  const rootSlot = getKitbashRootSlot(slot);
  return slot === rootSlot ? [slot] : [slot, rootSlot];
};

const getKitbashSlotWeight = (slot: DeveloperKitbashSlot) => {
  switch (getKitbashRootSlot(slot)) {
    case 'head':
      return 1.15;
    case 'torso':
      return 1.35;
    case 'arms':
      return 1.0;
    case 'legs':
      return 0.95;
    default:
      return 1;
  }
};

const detectKitbashSlotsFromMeshName = (meshName: string): DeveloperKitbashSlot[] => {
  const normalized = normalizeMeshName(meshName);
  const slots = new Set<DeveloperKitbashSlot>();

  if (/(head|hair|face|hat|helm|hood|mask|visor|beard)/.test(normalized)) {
    slots.add('head');
  }
  if (/(hat)/.test(normalized)) slots.add('hat');
  if (/(helm|helmet)/.test(normalized)) slots.add('helmet');
  if (/(visor)/.test(normalized)) slots.add('visor');
  if (/(mask)/.test(normalized)) slots.add('mask');
  if (/(hood)/.test(normalized)) slots.add('hood');
  if (/(beard)/.test(normalized)) slots.add('beard');
  if (/(torso|body|chest|spine|hip|pelvis)/.test(normalized)) slots.add('torso');
  if (/(cape|cloak)/.test(normalized)) slots.add('cape');
  if (/(quiver)/.test(normalized)) slots.add('quiver');
  if (/(shoulder|pauldron)/.test(normalized)) slots.add('shoulders');
  if (/(accessory|belt|strap|skirt)/.test(normalized)) slots.add('accessory');
  if (/(arm|hand|wrist|elbow)/.test(normalized)) slots.add('arms');
  if (/(leg|foot|knee|thigh|calf|boot)/.test(normalized)) slots.add('legs');

  if (slots.size === 0) {
    slots.add('torso');
  }

  return [...slots];
};

const annotateKitbashMeshParts = (root: THREE.Object3D) => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.userData.kitbashSlots = detectKitbashSlotsFromMeshName(mesh.name);
  });
};

const applyHitFlashToMaterial = (
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

const prepareKitbashAlignmentModel = (
  sourceModel: THREE.Object3D,
  calibration?: PlayerClassAssets['calibration'],
) => {
  const modelClone = cloneSkeleton(sourceModel) as THREE.Group;
  const resolvedCalibration = calibration ?? {
    scale: 1,
    rotationOffset: [0, 0, 0] as [number, number, number],
    positionOffset: [0, 0, 0] as [number, number, number],
  };

  annotateKitbashMeshParts(modelClone);
  modelClone.rotation.set(...resolvedCalibration.rotationOffset);

  const rawBounds = new THREE.Box3().setFromObject(modelClone);
  const rawSize = new THREE.Vector3();
  rawBounds.getSize(rawSize);
  const scaleFactor = rawSize.y > 0 ? resolvedCalibration.scale / rawSize.y : 1;
  modelClone.scale.setScalar(scaleFactor);

  const groundedBounds = new THREE.Box3().setFromObject(modelClone);
  modelClone.position.set(
    resolvedCalibration.positionOffset[0],
    resolvedCalibration.positionOffset[1] - groundedBounds.min.y,
    resolvedCalibration.positionOffset[2],
  );

  modelClone.updateMatrixWorld(true);
  return modelClone;
};

const collectKitbashPartDescriptors = (root: THREE.Object3D): DeveloperMeshPartDescriptor[] => {
  const descriptors: DeveloperMeshPartDescriptor[] = [];

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    const tags = (mesh.userData.kitbashSlots as DeveloperKitbashSlot[] | undefined) ?? detectKitbashSlotsFromMeshName(mesh.name);
    descriptors.push({
      meshName: mesh.name || 'unnamed-mesh',
      tags,
      skinned: Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh),
    });
  });

  return descriptors;
};

const analyzeKitbashCompatibility = ({
  baseModel,
  donorModel,
  referenceModel,
  calibration,
  slotAssignments,
}: {
  baseModel: THREE.Object3D;
  donorModel: THREE.Object3D;
  referenceModel?: THREE.Object3D;
  calibration?: PlayerClassAssets['calibration'];
  slotAssignments?: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>>;
}): DeveloperKitbashAnalysis => {
  const preparedBaseModel = prepareKitbashAlignmentModel(baseModel, calibration);
  const preparedDonorModel = prepareKitbashAlignmentModel(donorModel, calibration);
  const baseBones = collectBoneNames(preparedBaseModel);
  const donorBones = collectBoneNames(preparedDonorModel);
  const baseMeshes: string[] = [];
  const donorMeshes: string[] = [];
  let baseSkinnedMeshCount = 0;
  let donorSkinnedMeshCount = 0;

  preparedBaseModel.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    baseMeshes.push(mesh.name || 'unnamed-mesh');
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) baseSkinnedMeshCount += 1;
  });

  preparedDonorModel.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    donorMeshes.push(mesh.name || 'unnamed-mesh');
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) donorSkinnedMeshCount += 1;
  });

  const missingInDonor = baseBones.filter((bone) => !donorBones.includes(bone));
  const extraInDonor = donorBones.filter((bone) => !baseBones.includes(bone));
  const sharedBoneCount = donorBones.filter((bone) => baseBones.includes(bone)).length;
  const compatibilityRatio = baseBones.length > 0 ? sharedBoneCount / baseBones.length : 1;
  const compatibilityLabel: DeveloperKitbashAnalysis['compatibilityLabel'] = compatibilityRatio > 0.82 ? 'alta' : compatibilityRatio > 0.58 ? 'media' : 'baixa';
  const donorPartDescriptors = collectKitbashPartDescriptors(preparedDonorModel);
  const availableSlots = [...new Set(donorPartDescriptors.flatMap((descriptor) => descriptor.tags))] as DeveloperKitbashSlot[];
  const regionCoverage = {
    head: availableSlots.some((slot) => getKitbashRootSlot(slot) === 'head'),
    torso: availableSlots.some((slot) => getKitbashRootSlot(slot) === 'torso'),
    arms: availableSlots.some((slot) => getKitbashRootSlot(slot) === 'arms'),
    legs: availableSlots.some((slot) => getKitbashRootSlot(slot) === 'legs'),
  };
  const alignment = createKitbashAlignmentDiagnostics({
    baseModel,
    donorModel,
    referenceModel,
    calibration,
    slotAssignments,
  });

  return {
    baseBoneCount: baseBones.length,
    donorBoneCount: donorBones.length,
    sharedBoneCount,
    missingInDonor,
    extraInDonor,
    baseMeshNames: baseMeshes,
    donorMeshNames: donorMeshes,
    skinnedMeshCount: baseSkinnedMeshCount,
    donorSkinnedMeshCount,
    compatibilityScore: Math.round(compatibilityRatio * 100),
    compatibilityLabel,
    regionCoverage,
    donorPartDescriptors,
    availableSlots,
    donorAlignmentOffset: alignment.donorAlignmentOffset,
    donorSlotTransforms: alignment.donorSlotTransforms,
    selectedSlotFitDiagnostics: alignment.selectedSlotFitDiagnostics,
    hasFloatingRisk: alignment.hasFloatingRisk,
  };
};

const collectKitbashSlotBounds = (root: THREE.Object3D): Partial<Record<DeveloperKitbashSlot, THREE.Box3>> => {
  const slotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>> = {};

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    const tags = mesh.userData.kitbashSlots as DeveloperKitbashSlot[] | undefined;

    if (!tags || tags.length === 0) {
      return;
    }

    const meshBounds = new THREE.Box3().setFromObject(mesh);

    tags.forEach((slot) => {
      if (!slotBounds[slot]) {
        slotBounds[slot] = meshBounds.clone();
      } else {
        slotBounds[slot]?.union(meshBounds);
      }
    });
  });

  return slotBounds;
};

const getBoundsCenter = (bounds: THREE.Box3) => bounds.getCenter(new THREE.Vector3());

const getBoundsSizeAverage = (bounds: THREE.Box3) => {
  const size = bounds.getSize(new THREE.Vector3());
  return (size.x + size.y + size.z) / 3;
};

const getKitbashAlignmentAnchor = ({
  slot,
  bounds,
  role,
  baseHeadBounds,
}: {
  slot: DeveloperKitbashSlot;
  bounds: THREE.Box3;
  role: 'base' | 'donor';
  baseHeadBounds?: THREE.Box3;
}) => {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const headCenter = baseHeadBounds ? baseHeadBounds.getCenter(new THREE.Vector3()) : center;
  const headSize = baseHeadBounds ? baseHeadBounds.getSize(new THREE.Vector3()) : size;

  switch (slot) {
    case 'hat':
    case 'helmet':
    case 'hood':
      return role === 'donor'
        ? new THREE.Vector3(center.x, bounds.min.y, center.z)
        : new THREE.Vector3(headCenter.x, headCenter.y + headSize.y * 0.48, headCenter.z);
    case 'beard':
      return role === 'donor'
        ? new THREE.Vector3(center.x, bounds.max.y, center.z)
        : new THREE.Vector3(headCenter.x, headCenter.y - headSize.y * 0.2, headCenter.z + headSize.z * 0.06);
    case 'visor':
    case 'mask':
      return role === 'donor'
        ? new THREE.Vector3(center.x, center.y, bounds.min.z)
        : new THREE.Vector3(headCenter.x, headCenter.y, headCenter.z + headSize.z * 0.18);
    default:
      return center;
  }
};

const getKitbashMainSlotAnchor = (rootSlot: DeveloperKitbashMainSlot, bounds: THREE.Box3) => {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  switch (rootSlot) {
    case 'torso':
      return new THREE.Vector3(center.x, bounds.max.y - size.y * 0.18, center.z);
    case 'arms':
      return new THREE.Vector3(center.x, bounds.max.y - size.y * 0.12, center.z);
    case 'legs':
      return new THREE.Vector3(center.x, bounds.max.y - size.y * 0.06, center.z);
    case 'head':
    default:
      return center;
  }
};

const getKitbashMainSlotScaleMeasure = (rootSlot: DeveloperKitbashMainSlot, bounds: THREE.Box3) => {
  const size = bounds.getSize(new THREE.Vector3());

  switch (rootSlot) {
    case 'torso':
    case 'arms':
    case 'legs':
      return Math.max(size.y, 0.001);
    case 'head':
    default:
      return Math.max(getBoundsSizeAverage(bounds), 0.001);
  }
};

const createKitbashTransformForRootSlot = ({
  rootSlot,
  baseSlotBounds,
  donorSlotBounds,
  referenceSlotBounds,
}: {
  rootSlot: DeveloperKitbashMainSlot;
  baseSlotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>>;
  donorSlotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>>;
  referenceSlotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>>;
}): DeveloperKitbashTransform | undefined => {
  const baseBounds = baseSlotBounds[rootSlot];
  const donorBounds = donorSlotBounds[rootSlot];
  const referenceBounds = referenceSlotBounds[rootSlot] ?? baseBounds;

  if (!baseBounds || !donorBounds || !referenceBounds) {
    return undefined;
  }

  const donorAnchor = getKitbashMainSlotAnchor(rootSlot, donorBounds);
  const targetAnchor = getKitbashMainSlotAnchor(rootSlot, baseBounds);
  const positionOffset = targetAnchor.sub(donorAnchor);
  const pivot = donorAnchor;
  const scale = THREE.MathUtils.clamp(
    getKitbashMainSlotScaleMeasure(rootSlot, referenceBounds) / getKitbashMainSlotScaleMeasure(rootSlot, donorBounds),
    0.82,
    1.24,
  );

  return {
    positionOffset: [
      THREE.MathUtils.clamp(positionOffset.x, -0.4, 0.4),
      THREE.MathUtils.clamp(positionOffset.y, -0.4, 0.4),
      THREE.MathUtils.clamp(positionOffset.z, -0.32, 0.32),
    ],
    pivot: [pivot.x, pivot.y, pivot.z],
    scale,
  };
};

const createKitbashSlotTransforms = ({
  donorSlots,
  baseSlotBounds,
  donorSlotBounds,
  referenceSlotBounds,
}: {
  donorSlots: DeveloperKitbashSlot[];
  baseSlotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>>;
  donorSlotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>>;
  referenceSlotBounds: Partial<Record<DeveloperKitbashSlot, THREE.Box3>>;
}): Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>> => {
  const rootSlots = [...new Set(donorSlots.map((slot) => getKitbashRootSlot(slot)))];

  return rootSlots.reduce<Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>>((transforms, rootSlot) => {
    const transform = createKitbashTransformForRootSlot({
      rootSlot,
      baseSlotBounds,
      donorSlotBounds,
      referenceSlotBounds,
    });

    if (transform) {
      transforms[rootSlot] = transform;
    }

    return transforms;
  }, {});
};

const createKitbashAlignmentDiagnostics = ({
  baseModel,
  donorModel,
  referenceModel,
  calibration,
  slotAssignments,
}: {
  baseModel: THREE.Object3D;
  donorModel: THREE.Object3D;
  referenceModel?: THREE.Object3D;
  calibration?: PlayerClassAssets['calibration'];
  slotAssignments?: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>>;
}) => {
  const donorSlots = Object.entries(slotAssignments ?? {})
    .filter((entry): entry is [DeveloperKitbashSlot, DeveloperKitbashPartSource] => entry[1] === 'donor')
    .map(([slot]) => slot);

  if (donorSlots.length === 0) {
    return {
      donorAlignmentOffset: [0, 0, 0] as [number, number, number],
      donorSlotTransforms: {},
      selectedSlotFitDiagnostics: [] as DeveloperKitbashSlotFitDiagnostic[],
      hasFloatingRisk: false,
    };
  }

  const preparedBaseModel = prepareKitbashAlignmentModel(baseModel, calibration);
  const preparedDonorModel = prepareKitbashAlignmentModel(donorModel, calibration);
  const preparedReferenceModel = referenceModel ? prepareKitbashAlignmentModel(referenceModel, calibration) : preparedBaseModel;
  const baseSlotBounds = collectKitbashSlotBounds(preparedBaseModel);
  const donorSlotBounds = collectKitbashSlotBounds(preparedDonorModel);
  const referenceSlotBounds = collectKitbashSlotBounds(preparedReferenceModel);
  const accumulatedOffset = new THREE.Vector3();
  let totalWeight = 0;

  const selectedSlotFitDiagnostics = donorSlots.flatMap((slot) => {
    const candidateSlots = getKitbashAnchorSlots(slot);
    const baseBounds = candidateSlots.map((candidate) => baseSlotBounds[candidate]).find(Boolean);
    const donorBounds = candidateSlots.map((candidate) => donorSlotBounds[candidate]).find(Boolean);

    if (!baseBounds || !donorBounds) {
      return [];
    }

    const baseCenter = baseBounds.getCenter(new THREE.Vector3());
    const donorCenter = donorBounds.getCenter(new THREE.Vector3());
    const offset = baseCenter.sub(donorCenter);
    const baseSize = baseBounds.getSize(new THREE.Vector3());
    const donorSize = donorBounds.getSize(new THREE.Vector3());
    const sizeMismatch = Math.max(
      Math.abs(baseSize.x - donorSize.x) / Math.max(baseSize.x, donorSize.x, 0.001),
      Math.abs(baseSize.y - donorSize.y) / Math.max(baseSize.y, donorSize.y, 0.001),
      Math.abs(baseSize.z - donorSize.z) / Math.max(baseSize.z, donorSize.z, 0.001),
    );
    const offsetDistance = offset.length();
    const risk: DeveloperKitbashSlotFitDiagnostic['risk'] = offsetDistance > 0.28 || sizeMismatch > 0.42
      ? 'high'
      : offsetDistance > 0.12 || sizeMismatch > 0.22
        ? 'warning'
        : 'ok';
    const weight = getKitbashSlotWeight(slot);

    accumulatedOffset.addScaledVector(offset, weight);
    totalWeight += weight;

    return [{ slot, offsetDistance, sizeMismatch, risk }];
  });

  const averageOffset = totalWeight > 0 ? accumulatedOffset.divideScalar(totalWeight) : new THREE.Vector3();
  const donorSlotTransforms = createKitbashSlotTransforms({
    donorSlots,
    baseSlotBounds,
    donorSlotBounds,
    referenceSlotBounds,
  });

  return {
    donorAlignmentOffset: [
      THREE.MathUtils.clamp(averageOffset.x, -0.35, 0.35),
      THREE.MathUtils.clamp(averageOffset.y, -0.35, 0.35),
      THREE.MathUtils.clamp(averageOffset.z, -0.28, 0.28),
    ] as [number, number, number],
    donorSlotTransforms,
    selectedSlotFitDiagnostics,
    hasFloatingRisk: selectedSlotFitDiagnostics.some((diagnostic) => diagnostic.risk !== 'ok'),
  };
};

const prepareRuntimeHeroModel = ({
  sourceModel,
  texture,
  calibration,
  visiblePartSlots,
  hiddenPartSlots,
}: {
  sourceModel: THREE.Group;
  texture: THREE.Texture;
  calibration: PlayerClassAssets['calibration'];
  visiblePartSlots?: DeveloperKitbashSlot[];
  hiddenPartSlots?: DeveloperKitbashSlot[];
}) => {
  const modelClone = cloneSkeleton(sourceModel) as THREE.Group;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  annotateKitbashMeshParts(modelClone);

  modelClone.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    const meshSlots = mesh.userData.kitbashSlots as DeveloperKitbashSlot[] | undefined;
    if (visiblePartSlots && visiblePartSlots.length > 0) {
      mesh.visible = (meshSlots ?? []).some((slot) => visiblePartSlots.includes(slot));
    } else if (hiddenPartSlots && hiddenPartSlots.length > 0) {
      mesh.visible = !(meshSlots ?? []).some((slot) => hiddenPartSlots.includes(slot));
    } else {
      mesh.visible = true;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => buildRuntimeMaterial(material, texture));
    } else if (mesh.material) {
      mesh.material = buildRuntimeMaterial(mesh.material, texture);
    }
  });

  modelClone.rotation.set(...calibration.rotationOffset);

  const rawBounds = new THREE.Box3().setFromObject(modelClone);
  const rawSize = new THREE.Vector3();
  rawBounds.getSize(rawSize);

  const scaleFactor = rawSize.y > 0 ? calibration.scale / rawSize.y : 1;
  modelClone.scale.setScalar(scaleFactor);

  const groundedBounds = new THREE.Box3().setFromObject(modelClone);
  modelClone.position.set(
    calibration.positionOffset[0],
    calibration.positionOffset[1] - groundedBounds.min.y,
    calibration.positionOffset[2],
  );

  modelClone.updateMatrixWorld(true);
  return modelClone;
};

const rebindPreparedModelToSkeleton = ({
  sourceModel,
  targetModel,
}: {
  sourceModel: THREE.Object3D;
  targetModel: THREE.Object3D;
}) => {
  const targetBoneLookup = createNormalizedBoneObjectLookup(targetModel);

  sourceModel.traverse((node) => {
    const skinnedMesh = node as THREE.SkinnedMesh;

    if (!skinnedMesh.isSkinnedMesh || !skinnedMesh.skeleton) {
      return;
    }

    const reboundBones = skinnedMesh.skeleton.bones.map((bone) => targetBoneLookup.get(normalizeRigName(bone.name)) ?? bone);
    skinnedMesh.bind(
      new THREE.Skeleton(reboundBones, skinnedMesh.skeleton.boneInverses.map((inverse) => inverse.clone())),
      skinnedMesh.bindMatrix.clone(),
    );
    skinnedMesh.bindMatrixInverse.copy(skinnedMesh.bindMatrix).invert();
    skinnedMesh.frustumCulled = false;
  });
};

const DEFAULT_WEAPON_GRIP_POINTS: Record<RegisteredWeaponGrip, RegisteredWeaponGripPoint> = {
  dagger: { ratio: 0.04 },
  sword: { ratio: 0.045 },
  axe: { ratio: 0.07 },
  hammer: { ratio: 0.075 },
  wand: { ratio: 0.12 },
  staff: { ratio: 0.05 },
  spear: { ratio: 0.045 },
  halberd: { ratio: 0.05 },
  bow: { ratio: 0.48 },
  fist: { ratio: 0.34 },
};

const createBoundsPivotOnAxis = ({
  bounds,
  size,
  axis,
  ratio,
  cross,
}: {
  bounds: THREE.Box3;
  size: THREE.Vector3;
  axis: 'x' | 'y' | 'z';
  ratio: number;
  cross?: Partial<Record<'x' | 'y' | 'z', number>>;
}) => {
  const ratios = {
    x: cross?.x ?? 0.5,
    y: cross?.y ?? 0.5,
    z: cross?.z ?? 0.5,
  };

  if (axis === 'x') {
    return new THREE.Vector3(bounds.min.x + size.x * ratio, bounds.min.y + size.y * ratios.y, bounds.min.z + size.z * ratios.z);
  }

  if (axis === 'y') {
    return new THREE.Vector3(bounds.min.x + size.x * ratios.x, bounds.min.y + size.y * ratio, bounds.min.z + size.z * ratios.z);
  }

  return new THREE.Vector3(bounds.min.x + size.x * ratios.x, bounds.min.y + size.y * ratios.y, bounds.min.z + size.z * ratio);
};

const getWeaponGripPivot = (bounds: THREE.Box3, definition: RegisteredWeapon3DDefinition) => {
  const size = bounds.getSize(new THREE.Vector3());
  const profile = definition.gripPoint ?? DEFAULT_WEAPON_GRIP_POINTS[definition.grip];
  const axis = profile.axis ?? getDominantBoundsAxis(size);

  return createBoundsPivotOnAxis({
    bounds,
    size,
    axis,
    ratio: profile.ratio,
    cross: profile.cross,
  });
};

const getWeaponReferenceSize = (size: THREE.Vector3, grip: string) => {
  switch (grip) {
    case 'bow':
      return Math.max(size.x, size.y, 0.001);
    case 'fist':
      return Math.max(size.x, size.y, size.z, 0.001);
    default:
      return Math.max(size.y, size.x * 0.75, size.z * 0.75, 0.001);
  }
};

const AnimatedClassHero = ({
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
}: {
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
}) => {
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

    Object.entries(actions).forEach(([name, action]) => {
      if (!action || name === targetClipName) {
        return;
      }

      action.fadeOut(0.18);
    });

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(isManualPreview ? 1 : animationAction === 'defend' ? 0.85 : animationAction === 'heal' ? 0.92 : animationAction === 'death' ? 0.82 : 1);

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

    nextAction.fadeIn(isManualPreview ? 0.18 : animationAction === 'attack' ? 0.14 : animationAction === 'hit' || animationAction === 'critical-hit' ? 0.16 : 0.22).play();
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

const WeaponAttachmentPreview = ({
  definition,
  transform,
}: {
  definition: RegisteredWeapon3DDefinition;
  transform: DeveloperWeaponTransformOverride;
}) => {
  const model = useFBX(definition.modelUrl);
  const texture = useTexture(definition.textureUrl);

  const preparedWeapon = useMemo(() => {
    const weaponClone = cloneSkeleton(model) as THREE.Group;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    weaponClone.traverse((node) => {
      const mesh = node as THREE.Mesh;

      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => buildRuntimeMaterial(material, texture));
      } else if (mesh.material) {
        mesh.material = buildRuntimeMaterial(mesh.material, texture);
      }
    });

    // Normalize weapon model so its largest bounding-box dimension becomes 1.0 unit.
    // Without this the raw FBX size (often 50-170+ units) makes the weapon gigantic
    // compared to the hero which is normalized via prepareRuntimeHeroModel.
    const bounds = new THREE.Box3().setFromObject(weaponClone);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      weaponClone.scale.setScalar(1 / maxDim);
    }

    return weaponClone;
  }, [model, texture]);

  return (
    <group
      position={transform.position}
      rotation={transform.rotation}
      scale={[transform.scale, transform.scale, transform.scale]}
    >
      <primitive object={preparedWeapon} />
    </group>
  );
};

const EquippedWeaponAttachment = ({
  characterModel,
  weaponId,
  weaponTransformOverride,
  showAnchorHelper = false,
  showTransformControls = false,
  transformControlMode = 'translate',
  onWeaponTransformChange,
}: {
  characterModel: THREE.Object3D;
  weaponId?: string;
  weaponTransformOverride?: DeveloperWeaponTransformOverride;
  showAnchorHelper?: boolean;
  showTransformControls?: boolean;
  transformControlMode?: DeveloperWeaponTransformControlMode;
  onWeaponTransformChange?: (transform: DeveloperWeaponTransformOverride) => void;
}) => {
  const definition = weaponId ? getRegisteredWeapon3DByItemId(weaponId) : null;
  const attachmentGroupRef = useRef<THREE.Group>(null);

  const transform = weaponTransformOverride ?? definition?.handTransform ?? {
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: 1,
  };

  const attachmentBone = useMemo(() => findAttachmentBone(characterModel, RIGHT_HAND_BONE_CANDIDATES), [characterModel]);

  const handleTransformObjectChange = useCallback(() => {
    if (!attachmentGroupRef.current || !onWeaponTransformChange) {
      return;
    }

    onWeaponTransformChange({
      position: [attachmentGroupRef.current.position.x, attachmentGroupRef.current.position.y, attachmentGroupRef.current.position.z],
      rotation: [attachmentGroupRef.current.rotation.x, attachmentGroupRef.current.rotation.y, attachmentGroupRef.current.rotation.z],
      scale: attachmentGroupRef.current.scale.x,
    });
  }, [onWeaponTransformChange]);

  // Instead of reparenting under the bone (which causes the weapon to inherit
  // the Mixamo skeleton's huge internal scale), we keep the weapon in the R3F
  // tree and manually sync position/rotation from the bone every frame. This
  // way the weapon NEVER inherits the bone's scale — only handTransform.scale
  // is applied.
  const _boneWorldPos = useRef(new THREE.Vector3());
  const _boneWorldQuat = useRef(new THREE.Quaternion());
  const _offset = useRef(new THREE.Vector3());
  const _parentInverse = useRef(new THREE.Matrix4());
  const _parentQuat = useRef(new THREE.Quaternion());
  const _handRotQuat = useRef(new THREE.Quaternion());
  const _euler = useRef(new THREE.Euler());

  useFrame(() => {
    if (!attachmentGroupRef.current || !attachmentBone) {
      return;
    }

    const parent = attachmentGroupRef.current.parent;
    if (!parent) {
      return;
    }

    attachmentBone.updateWorldMatrix(true, false);
    parent.updateWorldMatrix(true, false);

    // Get bone world position & rotation (ignoring scale entirely)
    attachmentBone.getWorldPosition(_boneWorldPos.current);
    attachmentBone.getWorldQuaternion(_boneWorldQuat.current);

    // Apply handTransform position offset in bone-oriented space, then add to world pos
    _offset.current.set(transform.position[0], transform.position[1], transform.position[2]);
    _offset.current.applyQuaternion(_boneWorldQuat.current);
    _boneWorldPos.current.add(_offset.current);

    // Convert final world position → parent-local position
    _parentInverse.current.copy(parent.matrixWorld).invert();
    _boneWorldPos.current.applyMatrix4(_parentInverse.current);
    attachmentGroupRef.current.position.copy(_boneWorldPos.current);

    // Combine bone world rotation with handTransform rotation, then convert to parent-local
    _euler.current.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
    _handRotQuat.current.setFromEuler(_euler.current);
    const combinedQuat = _boneWorldQuat.current.multiply(_handRotQuat.current);

    parent.getWorldQuaternion(_parentQuat.current);
    _parentQuat.current.invert();
    _parentQuat.current.multiply(combinedQuat);
    attachmentGroupRef.current.quaternion.copy(_parentQuat.current);

    // Scale: ONLY the handTransform scale — no bone scale inheritance at all
    attachmentGroupRef.current.scale.setScalar(transform.scale);
  });

  if (!definition || !attachmentBone) {
    return null;
  }

  const content = (
    <group 
      ref={attachmentGroupRef} 
      position={transform.position} 
      rotation={transform.rotation} 
      scale={[transform.scale, transform.scale, transform.scale]}
    >
      {showAnchorHelper ? (
        <mesh>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={1.2} />
        </mesh>
      ) : null}
      <WeaponAttachmentPreview definition={definition} transform={{ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }} />
    </group>
  );

  if (!showTransformControls) {
    return content;
  }

  return (
    <TransformControls mode={transformControlMode} object={attachmentGroupRef.current ?? undefined} onObjectChange={handleTransformObjectChange}>
      {content}
    </TransformControls>
  );
};

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

const AnimatedEnemyCharacter = ({
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

const EnemyCharacter = ({
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
}: any) => {
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
      group.current.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material: THREE.Material) => applyHitFlashToMaterial(material, Boolean(isHit), flashRef.current * 2, enemyFlashColor));
          } else {
            applyHitFlashToMaterial(child.material, Boolean(isHit), flashRef.current * 2, enemyFlashColor);
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
      <ContactShadows opacity={0.35} scale={3} blur={1.8} far={2} resolution={contactShadowResolution} />
      <pointLight ref={enemyDamageLightRef} color="#ef4444" intensity={0} distance={8} decay={2.5} position={[0, 0.8, -0.3]} />
      {/* Enemy Defense Shield Effect */}
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

export const GameScene: React.FC<SceneProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameTime, setGameTime] = useState("12:00");
  const handleTimeUpdate = useCallback((time: string) => {
    setGameTime(time);
    props.onGameTimeUpdate?.(time);
  }, [props.onGameTimeUpdate]);
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const isDungeonRun = Boolean(props.isDungeonRun);

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
      >
        <CameraController screenShake={props.screenShake} />
        {isDungeonRun ? (
          <>
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={['#1f2937', 14, 32]} />
            <DungeonAtmosphere quality={quality} />
            <DungeonBattlePlatform />
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
          <Vignette eskil={false} offset={0.1} darkness={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export const DeveloperHeroScene: React.FC<DeveloperHeroSceneProps> = ({
  classId = 'knight',
  animationAction = 'idle',
  animationClipName,
  preferredAnimationBundle,
  loadAllAnimationBundles = false,
  loadSecondaryAnimationBundles = true,
  onAvailableAnimationClipsChange,
  equippedWeaponId,
  equippedArmorId,
  equippedHelmetId,
  equippedLegsId,
  equippedShieldId,
  isHit = false,
  transparent = false,
  autoRotate = false,
  enableManualRotate = false,
  transparentCameraZoom = 1,
  transparentModelScale = 1,
  transparentModelOffsetY = 0,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const transparentCameraDistance = 7.1 / Math.max(0.65, transparentCameraZoom);
  const heroScale = transparent ? 1.12 * transparentModelScale : 1;
  const heroGroupY = transparent ? -1.12 + transparentModelOffsetY : -1.12;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[inherit] ${transparent ? 'bg-transparent' : 'bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]'}`}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance', alpha: transparent }}
        performance={{ min: 0.5 }}
        onCreated={({ gl, scene }) => {
          if (transparent) {
            gl.setClearAlpha(0);
            scene.background = null;
          }
        }}
      >
        {!transparent && <color attach="background" args={['#020617']} />}
        {!transparent && <fog attach="fog" args={['#020617', 10, 26]} />}
        <PerspectiveCamera
          makeDefault
          position={transparent ? [0, 1.5, transparentCameraDistance] : [0, 1.45, 8.2]}
          fov={transparent ? 32 : 36}
          onUpdate={(camera) => camera.lookAt(0, 0.15, 0)}
        />
        {(enableManualRotate || autoRotate) && (
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.75}
            minPolarAngle={Math.PI * 0.36}
            maxPolarAngle={Math.PI * 0.64}
            target={[0, 0.15, 0]}
            autoRotate={autoRotate}
            autoRotateSpeed={1.8}
          />
        )}
        <ambientLight intensity={transparent ? 1.35 : 1.1} color="#f8fafc" />
        <hemisphereLight intensity={transparent ? 1.05 : 0.7} color="#dbeafe" groundColor={transparent ? '#7c5a47' : '#0f172a'} />
        <directionalLight position={[3, 6, 5]} intensity={transparent ? 1.35 : 1.15} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[-3, 2.6, 2]} intensity={transparent ? 1.45 : 1.2} color="#38bdf8" distance={12} />
        <pointLight position={[2.2, 2.2, 1.5]} intensity={transparent ? 1.1 : 0.9} color="#f97316" distance={10} />

        <group position={[0, heroGroupY, 0]}>
          {!transparent && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[3.8, 48]} />
              <meshStandardMaterial color="#0f172a" roughness={0.82} metalness={0.08} />
            </mesh>
          )}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={transparent ? [1.75, 2.45, 48] : [2.5, 3.2, 48]} />
            <meshStandardMaterial color={transparent ? '#8d5e29' : '#0ea5e9'} emissive={transparent ? '#b45309' : '#0284c7'} emissiveIntensity={transparent ? 0.22 : 0.4} transparent opacity={transparent ? 0.16 : 0.22} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {transparent && <ContactShadows position={[0, -1.04, 0]} scale={5.4} blur={2.6} opacity={0.42} far={2.2} color="#4b2e2a" />}

        <group scale={heroScale}>
          <HeroVoxel
            classId={classId}
            playerAnimationAction={animationAction}
            animationClipName={animationClipName}
            preferredAnimationBundle={preferredAnimationBundle}
            onAvailableAnimationClipsChange={onAvailableAnimationClipsChange}
            loadAllAnimationBundles={loadAllAnimationBundles}
            loadSecondaryAnimationBundles={loadSecondaryAnimationBundles}
            previewLoopAllActions
            isAttacking={animationAction === 'attack'}
            isDefending={animationAction === 'defend'}
            weaponId={equippedWeaponId}
            armorId={equippedArmorId}
            helmetId={equippedHelmetId}
            legsId={equippedLegsId}
            shieldId={equippedShieldId}
            isHit={isHit}
            idlePositionX={0}
            attackPositionX={0.35}
            defendPositionX={-0.15}
            originPosition={[0, -1, 0]}
            baseRotationY={0.35}
            contactShadowResolution={quality.contactShadowResolution}
          />
        </group>
      </Canvas>
    </div>
  );
};

export const DeveloperMonsterScene: React.FC<DeveloperMonsterSceneProps> = ({
  enemyName,
  enemyAssets,
  enemyColor = '#e2e8f0',
  enemyScale = 1.06,
  enemyAttackStyle = 'armed',
  animationAction = 'battle-idle',
  isHit = false,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.14),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 10, 26]} />
        <PerspectiveCamera
          makeDefault
          position={[0, 1.55, 8.4]}
          fov={36}
          onUpdate={(camera) => camera.lookAt(0, 0.2, 0)}
        />
        <ambientLight intensity={1.08} color="#f8fafc" />
        <hemisphereLight intensity={0.74} color="#e2e8f0" groundColor="#0f172a" />
        <directionalLight position={[-3, 6, 5]} intensity={1.0} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[3, 2.4, 2.2]} intensity={1.05} color="#67e8f9" distance={12} />
        <pointLight position={[-2.4, 2.1, 1.4]} intensity={0.9} color="#fb923c" distance={10} />

        <group position={[0, -1.12, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[3.8, 48]} />
            <meshStandardMaterial color="#111827" roughness={0.82} metalness={0.08} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 3.2, 48]} />
            <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.36} transparent opacity={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>

        <EnemyCharacter
          assets={enemyAssets}
          color={enemyColor}
          scale={enemyScale}
          isAttacking={animationAction === 'attack'}
          isDefending={animationAction === 'defend'}
          type="undead"
          enemyName={enemyName}
          isBoss={false}
          isHit={isHit}
          attackStyle={enemyAttackStyle}
          animationActionOverride={animationAction}
          idlePositionX={0}
          attackPositionX={-0.25}
          defendPositionX={0.18}
          originPosition={[0, -1, 0]}
          baseRotationY={-Math.PI - 0.35}
          disableAmbientMotion
          contactShadowResolution={quality.contactShadowResolution}
        />
      </Canvas>
    </div>
  );
};

const DeveloperKitbashProbe = ({
  baseAssets,
  donorAssets,
  slotAssignments,
  onAnalysisChange,
}: {
  baseAssets: RuntimeHeroAssets;
  donorAssets: RuntimeHeroAssets;
  slotAssignments?: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>>;
  onAnalysisChange?: (analysis: DeveloperKitbashAnalysis | null) => void;
}) => {
  const baseModel = useFBX(baseAssets.modelUrl);
  const donorModel = useFBX(donorAssets.modelUrl);
  const knightReferenceAssets = getPlayerClassById('knight').assets;
  const referenceModel = useFBX(hasRuntimeFbxAssets(knightReferenceAssets) ? knightReferenceAssets.modelUrl : baseAssets.modelUrl);

  const analysis = useMemo(
    () => analyzeKitbashCompatibility({
      baseModel,
      donorModel,
      referenceModel,
      calibration: baseAssets.calibration,
      slotAssignments,
    }),
    [baseAssets.calibration, baseModel, donorModel, referenceModel, slotAssignments],
  );

  useEffect(() => {
    onAnalysisChange?.(analysis);
  }, [analysis, onAnalysisChange]);

  return null;
};

const resolveRuntimeClassAssets = (classId: PlayerClassId): RuntimeHeroAssets | null => {
  const assets = getPlayerClassById(classId).assets;
  return hasRuntimeFbxAssets(assets) ? assets : null;
};

const DeveloperClassBuilderProbe = ({
  baseAssets,
  partSelections,
  onTransformsChange,
}: {
  baseAssets: RuntimeHeroAssets;
  partSelections: Record<DeveloperKitbashMainSlot, PlayerClassId>;
  onTransformsChange?: (transforms: Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>) => void;
}) => {
  const baseModel = useFBX(baseAssets.modelUrl);
  const knightReferenceAssets = getPlayerClassById('knight').assets;
  const referenceModel = useFBX(hasRuntimeFbxAssets(knightReferenceAssets) ? knightReferenceAssets.modelUrl : baseAssets.modelUrl);
  const headAssets = resolveRuntimeClassAssets(partSelections.head) ?? baseAssets;
  const torsoAssets = resolveRuntimeClassAssets(partSelections.torso) ?? baseAssets;
  const armsAssets = resolveRuntimeClassAssets(partSelections.arms) ?? baseAssets;
  const legsAssets = resolveRuntimeClassAssets(partSelections.legs) ?? baseAssets;
  const headModel = useFBX(headAssets.modelUrl);
  const torsoModel = useFBX(torsoAssets.modelUrl);
  const armsModel = useFBX(armsAssets.modelUrl);
  const legsModel = useFBX(legsAssets.modelUrl);

  const transforms = useMemo(() => {
    const donorModels: Record<DeveloperKitbashMainSlot, THREE.Object3D> = {
      head: headModel,
      torso: torsoModel,
      arms: armsModel,
      legs: legsModel,
    };

    const donorAssetsBySlot: Record<DeveloperKitbashMainSlot, RuntimeHeroAssets> = {
      head: headAssets,
      torso: torsoAssets,
      arms: armsAssets,
      legs: legsAssets,
    };

    return KITBASH_MAIN_SLOTS.reduce<Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>>((current, slot) => {
      const donorAssets = donorAssetsBySlot[slot];

      if (donorAssets.modelUrl === baseAssets.modelUrl) {
        return current;
      }

      const diagnostics = createKitbashAlignmentDiagnostics({
        baseModel,
        donorModel: donorModels[slot],
        referenceModel,
        calibration: baseAssets.calibration,
        slotAssignments: { [slot]: 'donor' },
      });

      const transform = diagnostics.donorSlotTransforms?.[slot];
      if (transform) {
        current[slot] = transform;
      }

      return current;
    }, {});
  }, [armsAssets, armsModel, baseAssets.calibration, baseAssets.modelUrl, baseModel, headAssets, headModel, legsAssets, legsModel, referenceModel, torsoAssets, torsoModel]);

  useEffect(() => {
    onTransformsChange?.(transforms);
  }, [onTransformsChange, transforms]);

  return null;
};

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

export const DeveloperClassBuilderScene: React.FC<DeveloperClassBuilderSceneProps> = ({
  baseClassId,
  animationAction = 'idle',
  animationClipName,
  preferredAnimationBundle,
  loadAllAnimationBundles = false,
  loadSecondaryAnimationBundles = true,
  onAvailableAnimationClipsChange,
  onRuntimeDiagnosticsChange,
  equippedWeaponId,
  weaponTransformOverride,
  showWeaponAnchorHelper = false,
  showWeaponTransformControls = false,
  weaponTransformControlMode = 'translate',
  onWeaponTransformOverrideChange,
  isHit = false,
  partSelections,
}) => {
  const quality = useMemo(() => createModularBuilderQualityProfile(getRenderQualityProfile()), []);
  const baseClass = getPlayerClassById(baseClassId);
  const runtimeBaseAssets = hasRuntimeFbxAssets(baseClass.assets) ? baseClass.assets : null;
  const [partTransforms, setPartTransforms] = useState<Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>>({});
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<Record<string, DeveloperAnimationRuntimeDiagnostic>>({});
  const handleRuntimeDiagnosticChange = useCallback((diagnostic: DeveloperAnimationRuntimeDiagnostic) => {
    setRuntimeDiagnostics((current) => {
      const previous = current[diagnostic.previewId];

      if (
        previous
        && previous.previewId === diagnostic.previewId
        && previous.label === diagnostic.label
        && previous.animationAction === diagnostic.animationAction
        && previous.targetClipName === diagnostic.targetClipName
        && previous.automaticClipName === diagnostic.automaticClipName
        && previous.boundClipCount === diagnostic.boundClipCount
        && previous.actionStarted === diagnostic.actionStarted
        && previous.status === diagnostic.status
      ) {
        return current;
      }

      return {
        ...current,
        [diagnostic.previewId]: diagnostic,
      };
    });
  }, []);

  useEffect(() => {
    setPartTransforms({});
  }, [baseClassId, partSelections.arms, partSelections.head, partSelections.legs, partSelections.torso]);

  useEffect(() => {
    setRuntimeDiagnostics({});
  }, [animationAction, animationClipName, baseClassId, partSelections.arms, partSelections.head, partSelections.legs, partSelections.torso, preferredAnimationBundle]);

  useEffect(() => {
    onRuntimeDiagnosticsChange?.(runtimeDiagnostics);
  }, [onRuntimeDiagnosticsChange, runtimeDiagnostics]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 10, 26]} />
        <PerspectiveCamera
          makeDefault
          position={[0, 1.45, 8.2]}
          fov={36}
          onUpdate={(camera) => camera.lookAt(0, 0.15, 0)}
        />
        <ambientLight intensity={1.1} color="#f8fafc" />
        <hemisphereLight intensity={0.7} color="#dbeafe" groundColor="#0f172a" />
        <directionalLight position={[3, 6, 5]} intensity={1.15} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[-3, 2.6, 2]} intensity={1.2} color="#38bdf8" distance={12} />
        <pointLight position={[2.2, 2.2, 1.5]} intensity={0.9} color="#f97316" distance={10} />

        <group position={[0, -1.12, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[3.8, 48]} />
            <meshStandardMaterial color="#0f172a" roughness={0.82} metalness={0.08} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 3.2, 48]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.4} transparent opacity={0.22} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {runtimeBaseAssets ? (
          <Suspense fallback={null}>
            <DeveloperClassBuilderProbe
              baseAssets={runtimeBaseAssets}
              partSelections={partSelections}
              onTransformsChange={setPartTransforms}
            />
          </Suspense>
        ) : null}

        <ModularClassHeroVoxel
          baseClassId={baseClassId}
          partSelections={partSelections}
          partTransforms={partTransforms}
          equippedWeaponId={equippedWeaponId}
          weaponTransformOverride={weaponTransformOverride}
          showWeaponAnchorHelper={showWeaponAnchorHelper}
          showWeaponTransformControls={showWeaponTransformControls}
          weaponTransformControlMode={weaponTransformControlMode}
          onWeaponTransformOverrideChange={onWeaponTransformOverrideChange}
          animationAction={animationAction}
          animationClipName={animationClipName}
          preferredAnimationBundle={preferredAnimationBundle}
          loadAllAnimationBundles={loadAllAnimationBundles}
          loadSecondaryAnimationBundles={loadSecondaryAnimationBundles}
          onAvailableAnimationClipsChange={onAvailableAnimationClipsChange}
          onRuntimeDiagnosticChange={handleRuntimeDiagnosticChange}
          isAttacking={animationAction === 'attack'}
          isDefending={animationAction === 'defend'}
          isHit={isHit}
          contactShadowResolution={quality.contactShadowResolution}
        />
      </Canvas>
    </div>
  );
};

export const DeveloperWeaponCalibrationScene: React.FC<{
  weaponId: string;
  weaponTransformOverride?: DeveloperWeaponTransformOverride;
  transformControlMode?: DeveloperWeaponTransformControlMode;
  onWeaponTransformOverrideChange?: (transform: DeveloperWeaponTransformOverride) => void;
}> = ({
  weaponId,
  weaponTransformOverride,
  transformControlMode = 'translate',
  onWeaponTransformOverrideChange,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const dummyCharacter = useMemo(() => {
    const root = new THREE.Group();
    const hand = new THREE.Bone();
    hand.name = RIGHT_HAND_BONE_CANDIDATES[0];
    root.add(hand);
    root.updateMatrixWorld(true);
    return root;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 6, 20]} />
        <PerspectiveCamera makeDefault position={[0, 1.2, 5.8]} fov={34} onUpdate={(camera) => camera.lookAt(0, 0.5, 0)} />
        <ambientLight intensity={1.05} color="#f8fafc" />
        <hemisphereLight intensity={0.7} color="#e2e8f0" groundColor="#0f172a" />
        <directionalLight position={[3, 5, 4]} intensity={1.0} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <group position={[0, 0.1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.9, 48]} />
            <meshStandardMaterial color="#111827" roughness={0.85} metalness={0.08} />
          </mesh>
          <EquippedWeaponAttachment
            characterModel={dummyCharacter}
            weaponId={weaponId}
            weaponTransformOverride={weaponTransformOverride}
            showAnchorHelper
            showTransformControls
            transformControlMode={transformControlMode}
            onWeaponTransformChange={onWeaponTransformOverrideChange}
          />
        </group>
        <OrbitControls enablePan={false} minDistance={3.2} maxDistance={8.5} target={[0, 0.5, 0]} />
      </Canvas>
    </div>
  );
};

export const DeveloperKitbashScene: React.FC<DeveloperKitbashSceneProps> = ({
  baseClassId,
  donorLabel,
  animationAction = 'battle-idle',
  donorAssets,
  donorColor = '#e2e8f0',
  donorScale = 1.06,
  donorAttackStyle = 'armed',
  donorType = 'class',
  slotAssignments,
  analysis,
  onAnalysisChange,
  onRuntimeDiagnosticsChange,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const baseClass = getPlayerClassById(baseClassId);
  const runtimeBaseAssets = hasRuntimeFbxAssets(baseClass.assets) ? baseClass.assets : null;
  const runtimeDonorAssets = hasRuntimeFbxAssets(donorAssets) ? donorAssets : null;
  const shouldNormalizeClassKitbash = donorType === 'class';
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<Record<string, DeveloperAnimationRuntimeDiagnostic>>({});
  const handleRuntimeDiagnosticChange = useCallback((diagnostic: DeveloperAnimationRuntimeDiagnostic) => {
    setRuntimeDiagnostics((current) => {
      const previous = current[diagnostic.previewId];

      if (
        previous
        && previous.previewId === diagnostic.previewId
        && previous.label === diagnostic.label
        && previous.animationAction === diagnostic.animationAction
        && previous.targetClipName === diagnostic.targetClipName
        && previous.automaticClipName === diagnostic.automaticClipName
        && previous.boundClipCount === diagnostic.boundClipCount
        && previous.actionStarted === diagnostic.actionStarted
        && previous.status === diagnostic.status
      ) {
        return current;
      }

      return {
        ...current,
        [diagnostic.previewId]: diagnostic,
      };
    });
  }, []);
  const isAttacking = animationAction === 'attack';
  const isDefending = animationAction === 'defend';
  const donorVisibleSlots = useMemo(
    () => Object.entries(slotAssignments ?? {})
      .filter((entry): entry is [DeveloperKitbashSlot, DeveloperKitbashPartSource] => entry[1] === 'donor')
      .map(([slot]) => slot),
    [slotAssignments],
  );
  const hiddenBaseSlots = useMemo(
    () => Object.entries(slotAssignments ?? {})
      .filter((entry): entry is [DeveloperKitbashSlot, DeveloperKitbashPartSource] => entry[1] !== 'base')
      .map(([slot]) => slot),
    [slotAssignments],
  );
  const combinedPreviewKey = useMemo(() => JSON.stringify({
    baseClassId,
    donorModelUrl: runtimeDonorAssets?.modelUrl ?? 'none',
    donorVisibleSlots: [...donorVisibleSlots].sort(),
    hiddenBaseSlots: [...hiddenBaseSlots].sort(),
  }), [baseClassId, donorVisibleSlots, hiddenBaseSlots, runtimeDonorAssets?.modelUrl]);

  useEffect(() => {
    if (!runtimeBaseAssets || !runtimeDonorAssets) {
      onAnalysisChange?.(null);
    }
  }, [onAnalysisChange, runtimeBaseAssets, runtimeDonorAssets]);

  useEffect(() => {
    setRuntimeDiagnostics({});
  }, [animationAction, baseClassId, donorType, hiddenBaseSlots, runtimeDonorAssets?.modelUrl, donorVisibleSlots]);

  useEffect(() => {
    onRuntimeDiagnosticsChange?.(runtimeDiagnostics);
  }, [onRuntimeDiagnosticsChange, runtimeDiagnostics]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 10, 28]} />
        <PerspectiveCamera
          makeDefault
          position={[0, 1.55, 10.4]}
          fov={34}
          onUpdate={(camera) => camera.lookAt(0, 0.15, 0)}
        />
        <ambientLight intensity={1.08} color="#f8fafc" />
        <hemisphereLight intensity={0.72} color="#dbeafe" groundColor="#0f172a" />
        <directionalLight position={[3, 6, 5]} intensity={1.0} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[-3, 2.4, 2]} intensity={1.15} color="#38bdf8" distance={12} />
        <pointLight position={[3, 2.2, 1.8]} intensity={0.95} color="#fb923c" distance={10} />

        <group position={[0, -1.12, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[4.5, 48]} />
            <meshStandardMaterial color="#0f172a" roughness={0.84} metalness={0.08} />
          </mesh>
        </group>

        {runtimeBaseAssets && runtimeDonorAssets && shouldNormalizeClassKitbash ? (
          <Suspense fallback={null}>
            <DeveloperKitbashProbe
              baseAssets={runtimeBaseAssets}
              donorAssets={runtimeDonorAssets}
              slotAssignments={slotAssignments}
              onAnalysisChange={onAnalysisChange}
            />
          </Suspense>
        ) : null}

        <group position={[-3.1, 0, 0]}>
          <Html position={[0, 2.6, 0]} center>
            <div className="rounded-full border border-cyan-400/30 bg-cyan-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">base {baseClass.name}</div>
          </Html>
          <HeroVoxel
            classId={baseClassId}
            playerAnimationAction={animationAction}
            isAttacking={isAttacking}
            isDefending={isDefending}
            loadSecondaryAnimationBundles
            previewLoopAllActions
            debugRuntimeId="base-preview"
            debugRuntimeLabel="Preview Base"
            onRuntimeDiagnosticChange={handleRuntimeDiagnosticChange}
            idlePositionX={0}
            attackPositionX={0}
            defendPositionX={0}
            originPosition={[0, -1, 0]}
            baseRotationY={0.35}
            contactShadowResolution={quality.contactShadowResolution}
          />
        </group>

        <group position={[0, 0, 0]}>
          <Html position={[0, 2.82, 0]} center>
            <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-100">combinado</div>
          </Html>
          <CombinedHeroVoxel
            key={combinedPreviewKey}
            baseClassId={baseClassId}
            donorAssets={runtimeDonorAssets}
            animationAction={animationAction}
            isAttacking={isAttacking}
            isDefending={isDefending}
            contactShadowResolution={quality.contactShadowResolution}
            hiddenBaseSlots={hiddenBaseSlots}
            donorVisibleSlots={donorVisibleSlots}
            donorAlignmentOffset={analysis?.donorAlignmentOffset}
            donorSlotTransforms={shouldNormalizeClassKitbash ? analysis?.donorSlotTransforms : undefined}
            onRuntimeDiagnosticChange={handleRuntimeDiagnosticChange}
          />
        </group>

        <group position={[3.1, 0, 0]}>
          <Html position={[0, 2.6, 0]} center>
            <div className="rounded-full border border-amber-400/30 bg-amber-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">doador {donorLabel}</div>
          </Html>
          {donorType === 'class' && runtimeDonorAssets ? (
            <group position={[0, -1, 0]} rotation={[0, 0.35, 0]}>
              <Suspense fallback={null}>
                <AnimatedClassHero
                  assets={runtimeDonorAssets}
                  animationAction={animationAction}
                  hasWeapon={false}
                  loadSecondaryAnimationBundles
                  previewLoopAllActions
                  debugRuntimeId="donor-preview"
                  debugRuntimeLabel="Preview Doador"
                  onRuntimeDiagnosticChange={handleRuntimeDiagnosticChange}
                />
              </Suspense>
              <ContactShadows opacity={0.35} scale={2.8} blur={1.8} far={2} resolution={quality.contactShadowResolution} />
            </group>
          ) : (
            <EnemyCharacter
              assets={donorAssets}
              color={donorColor}
              scale={donorScale}
              isAttacking={isAttacking}
              isDefending={isDefending}
              type="undead"
              enemyName={donorLabel}
              isBoss={false}
              isHit={false}
              attackStyle={donorAttackStyle}
              animationActionOverride={animationAction}
              idlePositionX={0}
              attackPositionX={0}
              defendPositionX={0}
              originPosition={[0, -1, 0]}
              baseRotationY={-Math.PI - 0.35}
              contactShadowResolution={quality.contactShadowResolution}
            />
          )}
        </group>
      </Canvas>
    </div>
  );
};