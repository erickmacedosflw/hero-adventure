import type { PlayerAnimationAction } from '../../types';

export interface RenderQualityProfile {
  isLowQuality: boolean;
  dpr: [number, number];
  shadowMapSize: number;
  starsCount: number;
  contactShadowResolution: number;
  antialias: boolean;
}

export interface DeveloperWeaponTransformOverride {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export type DeveloperWeaponTransformControlMode = 'translate' | 'rotate' | 'scale';

export type DeveloperKitbashSlot = 'head' | 'torso' | 'arms' | 'legs' | 'hat' | 'helmet' | 'visor' | 'cape' | 'quiver' | 'mask' | 'hood' | 'beard' | 'shoulders' | 'accessory';
export type DeveloperKitbashPartSource = 'base' | 'donor' | 'none';

export interface DeveloperMeshPartDescriptor {
  meshName: string;
  tags: DeveloperKitbashSlot[];
  skinned: boolean;
}

export interface DeveloperKitbashSlotFitDiagnostic {
  slot: DeveloperKitbashSlot;
  offsetDistance: number;
  sizeMismatch: number;
  risk: 'ok' | 'warning' | 'high';
}

export interface DeveloperKitbashTransform {
  positionOffset: [number, number, number];
  pivot: [number, number, number];
  scale: number;
}

export type DeveloperKitbashMainSlot = 'head' | 'torso' | 'arms' | 'legs';

export interface DeveloperKitbashAnalysis {
  baseBoneCount: number;
  donorBoneCount: number;
  sharedBoneCount: number;
  missingInDonor: string[];
  extraInDonor: string[];
  baseMeshNames: string[];
  donorMeshNames: string[];
  skinnedMeshCount: number;
  donorSkinnedMeshCount: number;
  compatibilityScore: number;
  compatibilityLabel: 'alta' | 'media' | 'baixa';
  regionCoverage: Record<'head' | 'torso' | 'arms' | 'legs', boolean>;
  donorPartDescriptors: DeveloperMeshPartDescriptor[];
  availableSlots: DeveloperKitbashSlot[];
  donorAlignmentOffset: [number, number, number];
  donorSlotTransforms?: Partial<Record<DeveloperKitbashMainSlot, DeveloperKitbashTransform>>;
  selectedSlotFitDiagnostics: DeveloperKitbashSlotFitDiagnostic[];
  hasFloatingRisk: boolean;
}

export interface DeveloperAnimationRuntimeDiagnostic {
  previewId: string;
  label: string;
  animationAction: PlayerAnimationAction;
  targetClipName?: string;
  automaticClipName?: string;
  boundClipCount: number;
  actionStarted: boolean;
  status: 'playing' | 'missing-target-clip' | 'missing-action';
}