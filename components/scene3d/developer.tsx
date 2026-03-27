import React, { useEffect, useMemo } from 'react';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerClassId } from '../../types';
import { getPlayerClassById } from '../../game/data/classes';
import {
  RuntimeHeroAssets,
  hasRuntimeFbxAssets,
} from './animation';
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

export const resolveRuntimeClassAssets = (classId: PlayerClassId): RuntimeHeroAssets | null => {
  const assets = getPlayerClassById(classId).assets;
  return hasRuntimeFbxAssets(assets) ? assets : null;
};

export const upsertRuntimeDiagnostic = (
  current: Record<string, DeveloperAnimationRuntimeDiagnostic>,
  diagnostic: DeveloperAnimationRuntimeDiagnostic,
) => {
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
};

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

export const DeveloperClassBuilderProbe = ({
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
