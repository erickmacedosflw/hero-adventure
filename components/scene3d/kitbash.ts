import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PlayerClassAssets } from '../../types';
import {
  buildRuntimeMaterial,
  collectBoneNames,
  createNormalizedBoneObjectLookup,
  normalizeMeshName,
  normalizeRigName,
} from './animation';
import type {
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperKitbashSlotFitDiagnostic,
  DeveloperKitbashTransform,
  DeveloperMeshPartDescriptor,
} from './types';

export const KITBASH_MAIN_SLOTS: DeveloperKitbashMainSlot[] = ['head', 'torso', 'arms', 'legs'];

export const getKitbashRootSlot = (slot: DeveloperKitbashSlot): DeveloperKitbashMainSlot => {
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

export const analyzeKitbashCompatibility = ({
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

const getBoundsSizeAverage = (bounds: THREE.Box3) => {
  const size = bounds.getSize(new THREE.Vector3());
  return (size.x + size.y + size.z) / 3;
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

export const createKitbashAlignmentDiagnostics = ({
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

export const prepareRuntimeHeroModel = ({
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

export const rebindPreparedModelToSkeleton = ({
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
