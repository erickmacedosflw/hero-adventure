import React, { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PlayerClassId } from '../../types';
import { getPlayerClassById } from '../../game/data/classes';
import {
  RuntimeHeroAssets,
  hasRuntimeFbxAssets,
} from './animation';
import { configureFBXLoader } from './gltfLoader';
import { resolveRuntimeClassAssets } from './developerUtils';
import {
  analyzeKitbashCompatibility,
  createKitbashAlignmentDiagnostics,
  KITBASH_MAIN_SLOTS,
} from './kitbash';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperKitbashTransform,
} from './types';

export const DeveloperKitbashProbe = ({
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
  const baseModel = useLoader(FBXLoader, baseAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const donorModel = useLoader(FBXLoader, donorAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const knightReferenceAssets = getPlayerClassById('knight').assets;
  const referenceModel = useLoader(FBXLoader, hasRuntimeFbxAssets(knightReferenceAssets) ? knightReferenceAssets.modelUrl : baseAssets.modelUrl, configureFBXLoader) as THREE.Group;

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

export const DeveloperClassBuilderProbe = ({
  baseAssets,
  partSelections,
  onTransformsChange,
}: {
  baseAssets: RuntimeHeroAssets;
  partSelections: Record<DeveloperKitbashMainSlot, PlayerClassId>;
  onTransformsChange?: (transforms: Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>) => void;
}) => {
  const baseModel = useLoader(FBXLoader, baseAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const knightReferenceAssets = getPlayerClassById('knight').assets;
  const referenceModel = useLoader(FBXLoader, hasRuntimeFbxAssets(knightReferenceAssets) ? knightReferenceAssets.modelUrl : baseAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const headAssets = resolveRuntimeClassAssets(partSelections.head) ?? baseAssets;
  const torsoAssets = resolveRuntimeClassAssets(partSelections.torso) ?? baseAssets;
  const armsAssets = resolveRuntimeClassAssets(partSelections.arms) ?? baseAssets;
  const legsAssets = resolveRuntimeClassAssets(partSelections.legs) ?? baseAssets;
  const headModel = useLoader(FBXLoader, headAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const torsoModel = useLoader(FBXLoader, torsoAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const armsModel = useLoader(FBXLoader, armsAssets.modelUrl, configureFBXLoader) as THREE.Group;
  const legsModel = useLoader(FBXLoader, legsAssets.modelUrl, configureFBXLoader) as THREE.Group;

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
