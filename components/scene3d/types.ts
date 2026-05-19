import type { PlayerAnimationAction, PlayerClassId } from '../../types';

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

export type DeveloperScenarioComposerId = 'tower' | 'forest' | 'dungeon' | 'moutain' | 'hero-selection';
export type DeveloperScenarioComposerCameraMode = 'battle-sim' | 'free';
export type DeveloperScenarioComposerSelectionTarget = 'scenario' | 'hero' | 'enemy' | 'menu-portal' | `scene-object:${string}` | `hero-slot:${PlayerClassId}`;
export type DeveloperScenarioComposerTransformMode = 'translate' | 'rotate' | 'scale';

export interface DeveloperScenarioComposerTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface DeveloperScenarioComposerLighting {
  ambientColor: string;
  ambientIntensity: number;
  directionalColor: string;
  directionalIntensity: number;
  directionalPosition: [number, number, number];
}

export interface DeveloperScenarioComposerAtmosphere {
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
}

export interface DeveloperScenarioComposerParticles {
  dustEnabled: boolean;
  mistEnabled: boolean;
  density: number;
  speed: number;
  opacity: number;
}

export interface DeveloperScenarioComposerCameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface DeveloperScenarioComposerHeroSlot {
  classId: PlayerClassId;
  position: [number, number, number];
  rotationY: number;
}

// ─── Effect Lab ───────────────────────────────────────────────────────────────

export type { EffectCategory, EffectLabParams, EffectPreset } from './effectPresets';

export interface DeveloperEffectLabSceneProps {
  /** Preset id to preview */
  presetId: string;
  /** Live param overrides */
  params: import('./effectPresets').EffectLabParams;
  isPlaying: boolean;
  loop: boolean;
  /** Optional .efk URL for Effekseer playback */
  efkUrl: string;
  spawnOffset: [number, number, number];
  onSpawnOffsetChange?: (offset: [number, number, number]) => void;
  onEfkError?: (err: string) => void;
}

export interface DeveloperScenarioComposerConfig {
  scenarioId: DeveloperScenarioComposerId;
  scenarioTransform: DeveloperScenarioComposerTransform;
  sceneObjects: DeveloperScenarioComposerSceneObject[];
  heroSelectionSlots?: DeveloperScenarioComposerHeroSlot[];
  heroBasePosition: [number, number, number];
  enemyBasePosition: [number, number, number];
  menuPortalTransform?: DeveloperScenarioComposerTransform;
  lighting: DeveloperScenarioComposerLighting;
  atmosphere: DeveloperScenarioComposerAtmosphere;
  particles: DeveloperScenarioComposerParticles;
  cameraMode: DeveloperScenarioComposerCameraMode;
  cameraState: DeveloperScenarioComposerCameraState;
}

export interface DeveloperScenarioComposerSceneObject {
  id: string;
  label: string;
  modelUrl: string;
  transform: DeveloperScenarioComposerTransform;
}

export interface DeveloperScenarioComposerExportPayload {
  version: number;
  exportedAt: string;
  scenarioId: DeveloperScenarioComposerId;
  scenarioName: string;
  scenarioModelUrl: string;
  config: DeveloperScenarioComposerConfig;
}