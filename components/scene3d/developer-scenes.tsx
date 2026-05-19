import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera, TransformControls, useAnimations, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PlayerAnimationAction, PlayerClassAssets, PlayerClassId } from '../../types';
import { getPlayerClassById } from '../../game/data/classes';
import {
  MENU_NAVIGATION_PORTAL_ALBEDO_URL,
  MENU_NAVIGATION_PORTAL_EMISSIVE_URL,
  MENU_NAVIGATION_PORTAL_METALLIC_URL,
} from '../../game/data/runtimeMenuPortal';
import { EquippedWeaponAttachment } from './weapons';
import {
  CameraController,
  createModularBuilderQualityProfile,
  getRenderPowerPreference,
  getRenderQualityProfile,
} from './environment';
import {
  RuntimeHeroAssets,
  RIGHT_HAND_BONE_CANDIDATES,
  hasRuntimeFbxAssets,
  collectBoneNames,
  createNormalizedBoneLookup,
  normalizeRigName,
  remapClipBindingsToSkeleton,
} from './animation';
import {
  DeveloperClassBuilderProbe,
  DeveloperKitbashProbe,
} from './developer';
import { upsertRuntimeDiagnostic } from './developerUtils';
import { configureGltfLoader, configureFBXLoader, configureFBXLoaderDisplay } from './gltfLoader';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperScenarioComposerAtmosphere,
  DeveloperScenarioComposerCameraState,
  DeveloperScenarioComposerCameraMode,
  DeveloperScenarioComposerHeroSlot,
  DeveloperScenarioComposerLighting,
  DeveloperScenarioComposerParticles,
  DeveloperScenarioComposerSceneObject,
  DeveloperScenarioComposerSelectionTarget,
  DeveloperScenarioComposerTransformMode,
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './types';

export interface DeveloperHeroSceneProps {
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

export interface DeveloperMonsterSceneProps {
  enemyName: string;
  enemyAssets?: PlayerClassAssets;
  enemyColor?: string;
  enemyScale?: number;
  enemyAttackStyle?: 'armed' | 'unarmed';
  animationAction?: PlayerAnimationAction;
  isHit?: boolean;
}

export interface DeveloperKitbashSceneProps {
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

export interface DeveloperClassBuilderSceneProps {
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

export interface DeveloperWeaponCalibrationSceneProps {
  weaponId: string;
  weaponTransformOverride?: DeveloperWeaponTransformOverride;
  transformControlMode?: DeveloperWeaponTransformControlMode;
  onWeaponTransformOverrideChange?: (transform: DeveloperWeaponTransformOverride) => void;
}

export interface DeveloperScenarioComposerSceneProps {
  scenarioModelUrl: string;
  scenarioTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
  menuPortalModelUrl?: string;
  menuPortalTransform?: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
  sceneObjects?: DeveloperScenarioComposerSceneObject[];
  heroClassId?: PlayerClassId;
  heroSelectionSlots?: DeveloperScenarioComposerHeroSlot[];
  heroPosition: [number, number, number];
  enemyPosition: [number, number, number];
  enemyName: string;
  enemyAssets?: PlayerClassAssets;
  enemyType?: 'beast' | 'humanoid' | 'undead';
  enemyColor?: string;
  enemyScale?: number;
  enemyAttackStyle?: 'armed' | 'unarmed';
  lighting: DeveloperScenarioComposerLighting;
  atmosphere: DeveloperScenarioComposerAtmosphere;
  particles: DeveloperScenarioComposerParticles;
  cameraMode: DeveloperScenarioComposerCameraMode;
  cameraState: DeveloperScenarioComposerCameraState;
  selectionTarget: DeveloperScenarioComposerSelectionTarget;
  transformMode: DeveloperScenarioComposerTransformMode;
  transformControlsEnabled?: boolean;
  onSelectionTargetChange?: (target: DeveloperScenarioComposerSelectionTarget) => void;
  onScenarioTransformChange?: (transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  }) => void;
  onSceneObjectTransformChange?: (objectId: string, transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  }) => void;
  onMenuPortalTransformChange?: (transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  }) => void;
  onCameraStateChange?: (cameraState: DeveloperScenarioComposerCameraState) => void;
  onHeroPositionChange?: (position: [number, number, number]) => void;
  onEnemyPositionChange?: (position: [number, number, number]) => void;
  onHeroSelectionSlotChange?: (classId: PlayerClassId, position: [number, number, number], rotationY: number) => void;
}

type HeroVoxelComponentType = React.ComponentType<any>;
type EnemyCharacterComponentType = React.ComponentType<any>;
type AnimatedClassHeroComponentType = React.ComponentType<any>;
type CombinedHeroVoxelComponentType = React.ComponentType<any>;
type ModularClassHeroVoxelComponentType = React.ComponentType<any>;

export const DeveloperHeroSceneRenderer: React.FC<
  DeveloperHeroSceneProps & { HeroVoxelComponent: HeroVoxelComponentType }
> = ({
  HeroVoxelComponent,
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
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);
  const transparentCameraDistance = 7.1 / Math.max(0.65, transparentCameraZoom);
  const heroScale = transparent ? 1.12 * transparentModelScale : 1;
  const heroGroupY = transparent ? -1.12 + transparentModelOffsetY : -1.12;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[inherit] ${transparent ? 'bg-transparent' : 'bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]'}`}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference, alpha: transparent }}
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
          <HeroVoxelComponent
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

export const DeveloperMonsterSceneRenderer: React.FC<
  DeveloperMonsterSceneProps & { EnemyCharacterComponent: EnemyCharacterComponentType }
> = ({
  EnemyCharacterComponent,
  enemyName,
  enemyAssets,
  enemyColor = '#e2e8f0',
  enemyScale = 1.06,
  enemyAttackStyle = 'armed',
  animationAction = 'battle-idle',
  isHit = false,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.14),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
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

        <EnemyCharacterComponent
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

export const DeveloperClassBuilderSceneRenderer: React.FC<
  DeveloperClassBuilderSceneProps & {
    ModularClassHeroVoxelComponent: ModularClassHeroVoxelComponentType;
  }
> = ({
  ModularClassHeroVoxelComponent,
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
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);
  const baseClass = getPlayerClassById(baseClassId);
  const runtimeBaseAssets = hasRuntimeFbxAssets(baseClass.assets) ? baseClass.assets : null;
  const [partTransforms, setPartTransforms] = useState<Partial<Record<DeveloperKitbashMainSlot, any>>>({});
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<Record<string, DeveloperAnimationRuntimeDiagnostic>>({});
  const handleRuntimeDiagnosticChange = useCallback((diagnostic: DeveloperAnimationRuntimeDiagnostic) => {
    setRuntimeDiagnostics((current) => upsertRuntimeDiagnostic(current, diagnostic));
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
        gl={{ antialias: quality.antialias, powerPreference }}
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
              baseAssets={runtimeBaseAssets as RuntimeHeroAssets}
              partSelections={partSelections}
              onTransformsChange={setPartTransforms}
            />
          </Suspense>
        ) : null}

        <ModularClassHeroVoxelComponent
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

export const DeveloperWeaponCalibrationSceneRenderer: React.FC<DeveloperWeaponCalibrationSceneProps> = ({
  weaponId,
  weaponTransformOverride,
  transformControlMode = 'translate',
  onWeaponTransformOverrideChange,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);
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
        gl={{ antialias: quality.antialias, powerPreference }}
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

const ScenarioGlbModel = ({ modelUrl }: { modelUrl: string }) => {
  const gltf = useLoader(GLTFLoader, modelUrl, configureGltfLoader) as { scene: THREE.Group };

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((node: any) => {
      if (!node.isMesh) {
        return;
      }

      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material: any) => {
        if (!material || !("fog" in material)) {
          return;
        }
        material.fog = true;
        material.needsUpdate = true;
      });

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
    });
    return clone;
  }, [gltf.scene]);

  return <primitive object={model} />;
};

const ScenarioFbxModel = ({ modelUrl }: { modelUrl: string }) => {
  const source = useLoader(FBXLoader, modelUrl, configureFBXLoader) as THREE.Group;

  const model = useMemo(() => {
    const clone = source.clone(true);
    clone.traverse((child: any) => {
      if (!child.isMesh) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const nextMaterials = materials.map((material: any) => {
        if (!material || !(material as any).isMaterial) {
          return material;
        }

        const nextMaterial = material.clone();
        if ('fog' in nextMaterial) {
          (nextMaterial as any).fog = true;
        }
        nextMaterial.needsUpdate = true;
        return nextMaterial;
      });

      child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
    });
    return clone;
  }, [source]);

  return <primitive object={model} />;
};

const ScenarioPortalPreviewModel = ({ modelUrl }: { modelUrl: string }) => {
  const sourcePortal = useLoader(FBXLoader, modelUrl, configureFBXLoader) as THREE.Group;
  const [albedoTexture, emissiveTexture, metallicTexture] = useTexture([
    MENU_NAVIGATION_PORTAL_ALBEDO_URL,
    MENU_NAVIGATION_PORTAL_EMISSIVE_URL,
    MENU_NAVIGATION_PORTAL_METALLIC_URL,
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture];

  const model = useMemo(() => {
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    emissiveTexture.colorSpace = THREE.SRGBColorSpace;
    metallicTexture.colorSpace = THREE.NoColorSpace;
    [albedoTexture, emissiveTexture, metallicTexture].forEach((texture) => {
      texture.flipY = true;
      texture.needsUpdate = true;
    });

    const clone = sourcePortal.clone(true);
    clone.traverse((child: any) => {
      if (!child.isMesh) {
        return;
      }

      const mesh = child as THREE.Mesh;
      const applyPortalMaterial = (material: THREE.Material) => {
        const standard = material instanceof THREE.MeshStandardMaterial
          ? material.clone()
          : new THREE.MeshStandardMaterial({
            color: (material as any).color?.clone?.() ?? new THREE.Color('#ffffff'),
          });

        standard.map = albedoTexture;
        standard.emissiveMap = emissiveTexture;
        standard.metalnessMap = metallicTexture;
        standard.color = new THREE.Color('#ffffff');
        standard.emissive = new THREE.Color('#67d3ff');
        standard.emissiveIntensity = 1.25;
        standard.metalness = 0.48;
        standard.roughness = 0.38;
        standard.vertexColors = false;
        standard.fog = true;
        standard.needsUpdate = true;
        return standard;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => applyPortalMaterial(material));
      } else if (mesh.material) {
        mesh.material = applyPortalMaterial(mesh.material as THREE.Material);
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    });

    return clone;
  }, [albedoTexture, emissiveTexture, metallicTexture, sourcePortal]);

  return <primitive object={model} />;
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const MENU_PORTAL_EDITOR_VISIBILITY_SCALE_BOOST = 1;

export const ScenarioParticleField = ({
  particles,
}: {
  particles: DeveloperScenarioComposerParticles;
}) => {
  const mistRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  const mistMeshRef = useRef<THREE.InstancedMesh>(null);
  const dustMeshRef = useRef<THREE.InstancedMesh>(null);
  const instanceDummy = useMemo(() => new THREE.Object3D(), []);
  const density = clampNumber(Number.isFinite(particles.density) ? particles.density : 0.5, 0, 1);
  const speed = clampNumber(Number.isFinite(particles.speed) ? particles.speed : 0.45, 0, 2);
  const opacity = clampNumber(Number.isFinite(particles.opacity) ? particles.opacity : 0.22, 0, 1);

  const mistSeeds = useMemo(
    () => Array.from({ length: Math.max(3, Math.round(10 + (density * 14))) }, (_, index) => ({
      id: index,
      position: [
        (Math.random() - 0.5) * 28,
        -0.7 + Math.random() * 2.6,
        -18 + Math.random() * 34,
      ] as [number, number, number],
      scale: 1.6 + Math.random() * 3.2,
    })),
    [density],
  );

  const dustSeeds = useMemo(
    () => Array.from({ length: Math.max(16, Math.round(36 + (density * 80))) }, (_, index) => ({
      id: index,
      position: [
        (Math.random() - 0.5) * 24,
        -0.95 + Math.random() * 3,
        -16 + Math.random() * 30,
      ] as [number, number, number],
      radius: 0.014 + Math.random() * 0.028,
    })),
    [density],
  );

  useLayoutEffect(() => {
    const mesh = mistMeshRef.current;
    if (!mesh) return;
    mesh.count = particles.mistEnabled ? mistSeeds.length : 0;
    for (let index = 0; index < mistSeeds.length; index += 1) {
      const seed = mistSeeds[index];
      instanceDummy.position.set(seed.position[0], seed.position[1], seed.position[2]);
      instanceDummy.rotation.set(0, 0, 0);
      instanceDummy.scale.setScalar(seed.scale);
      instanceDummy.updateMatrix();
      mesh.setMatrixAt(index, instanceDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instanceDummy, mistSeeds, particles.mistEnabled]);

  useLayoutEffect(() => {
    const mesh = dustMeshRef.current;
    if (!mesh) return;
    mesh.count = particles.dustEnabled ? dustSeeds.length : 0;
    for (let index = 0; index < dustSeeds.length; index += 1) {
      const seed = dustSeeds[index];
      instanceDummy.position.set(seed.position[0], seed.position[1], seed.position[2]);
      instanceDummy.rotation.set(0, 0, 0);
      instanceDummy.scale.setScalar(seed.radius);
      instanceDummy.updateMatrix();
      mesh.setMatrixAt(index, instanceDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dustSeeds, instanceDummy, particles.dustEnabled]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (mistRef.current) {
      mistRef.current.rotation.y = Math.sin(t * (0.04 + (speed * 0.03))) * 0.2;
      mistRef.current.position.y = -0.08 + Math.sin(t * (0.15 + (speed * 0.1))) * 0.08;
    }

    if (dustRef.current) {
      dustRef.current.rotation.y = t * (0.02 + (speed * 0.08));
      dustRef.current.position.y = Math.sin(t * (0.22 + (speed * 0.14))) * 0.06;
    }
  });

  return (
    <>
      {particles.mistEnabled ? (
        <group ref={mistRef}>
          <instancedMesh ref={mistMeshRef} args={[undefined, undefined, mistSeeds.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial color="#dbeafe" transparent opacity={opacity * 0.18} depthWrite={false} />
          </instancedMesh>
        </group>
      ) : null}

      {particles.dustEnabled ? (
        <group ref={dustRef}>
          <instancedMesh ref={dustMeshRef} args={[undefined, undefined, dustSeeds.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={opacity * 0.58} depthWrite={false} />
          </instancedMesh>
        </group>
      ) : null}
    </>
  );
};

const ScenarioCameraRelativeNudgeControls = ({
  enabled,
  selectionTarget,
  scenarioRef,
  menuPortalRef,
  heroRef,
  enemyRef,
  heroSlotRefs,
  sceneObjectRefs,
  onScenarioCommit,
  onMenuPortalCommit,
  onHeroCommit,
  onEnemyCommit,
  onHeroSlotCommit,
  onSceneObjectCommit,
}: {
  enabled: boolean;
  selectionTarget: DeveloperScenarioComposerSelectionTarget;
  scenarioRef: React.RefObject<THREE.Group | null>;
  menuPortalRef: React.RefObject<THREE.Group | null>;
  heroRef: React.RefObject<THREE.Group | null>;
  enemyRef: React.RefObject<THREE.Group | null>;
  heroSlotRefs: React.RefObject<Partial<Record<PlayerClassId, THREE.Group | null>>>;
  sceneObjectRefs: React.RefObject<Record<string, THREE.Group | null>>;
  onScenarioCommit: () => void;
  onMenuPortalCommit: () => void;
  onHeroCommit: () => void;
  onEnemyCommit: () => void;
  onHeroSlotCommit: (classId: PlayerClassId) => void;
  onSceneObjectCommit: (objectId: string) => void;
}) => {
  const { camera } = useThree();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const delta = new THREE.Vector3();

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT' || activeElement.isContentEditable)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isMovementKey = key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'q' || key === 'e' || key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright';
      if (!isMovementKey) {
        return;
      }

      const selectedSceneObjectId = selectionTarget.startsWith('scene-object:')
        ? selectionTarget.slice('scene-object:'.length)
        : null;
      const selectedHeroSlotClassId = selectionTarget.startsWith('hero-slot:')
        ? selectionTarget.slice('hero-slot:'.length) as PlayerClassId
        : null;

      const targetObject = selectionTarget === 'scenario'
        ? scenarioRef.current
        : selectionTarget === 'menu-portal'
          ? menuPortalRef.current
        : selectionTarget === 'hero'
          ? heroRef.current
          : selectionTarget === 'enemy'
            ? enemyRef.current
            : selectedHeroSlotClassId
              ? heroSlotRefs.current[selectedHeroSlotClassId] ?? null
            : selectedSceneObjectId
              ? sceneObjectRefs.current[selectedSceneObjectId] ?? null
              : null;

      if (!targetObject) {
        return;
      }

      event.preventDefault();
      const step = event.shiftKey ? 0.6 : 0.2;

      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-5) {
        forward.set(0, 0, -1);
      }
      forward.normalize();
      right.crossVectors(forward, up).normalize();
      delta.set(0, 0, 0);

      if (key === 'w' || key === 'arrowup') {
        delta.addScaledVector(forward, step);
      } else if (key === 's' || key === 'arrowdown') {
        delta.addScaledVector(forward, -step);
      } else if (key === 'd' || key === 'arrowright') {
        delta.addScaledVector(right, step);
      } else if (key === 'a' || key === 'arrowleft') {
        delta.addScaledVector(right, -step);
      } else if (key === 'e') {
        delta.y += step;
      } else if (key === 'q') {
        delta.y -= step;
      }

      targetObject.position.add(delta);

      if (selectionTarget === 'scenario') {
        onScenarioCommit();
      } else if (selectionTarget === 'menu-portal') {
        onMenuPortalCommit();
      } else if (selectionTarget === 'hero') {
        onHeroCommit();
      } else if (selectionTarget === 'enemy') {
        onEnemyCommit();
      } else if (selectedHeroSlotClassId) {
        onHeroSlotCommit(selectedHeroSlotClassId);
      } else if (selectedSceneObjectId) {
        onSceneObjectCommit(selectedSceneObjectId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [camera, enabled, enemyRef, heroRef, heroSlotRefs, menuPortalRef, onEnemyCommit, onHeroCommit, onHeroSlotCommit, onMenuPortalCommit, onScenarioCommit, onSceneObjectCommit, scenarioRef, sceneObjectRefs, selectionTarget]);

  return null;
};

export const DeveloperScenarioComposerSceneRenderer: React.FC<
  DeveloperScenarioComposerSceneProps & {
    HeroVoxelComponent: HeroVoxelComponentType;
    EnemyCharacterComponent: EnemyCharacterComponentType;
  }
> = ({
  HeroVoxelComponent,
  EnemyCharacterComponent,
  scenarioModelUrl,
  scenarioTransform,
  menuPortalModelUrl,
  menuPortalTransform = {
    position: [-4.5, -1.02, -0.35],
    rotation: [0, Math.PI * 0.92, 0],
    scale: 0.0125,
  },
  sceneObjects = [],
  heroClassId = 'knight',
  heroSelectionSlots = [],
  heroPosition,
  enemyPosition,
  enemyName,
  enemyAssets,
  enemyType = 'undead',
  enemyColor = '#e2e8f0',
  enemyScale = 1.06,
  enemyAttackStyle = 'armed',
  lighting,
  atmosphere,
  particles,
  cameraMode,
  cameraState,
  selectionTarget,
  transformMode,
  transformControlsEnabled = true,
  onSelectionTargetChange,
  onScenarioTransformChange,
  onSceneObjectTransformChange,
  onMenuPortalTransformChange,
  onCameraStateChange,
  onHeroPositionChange,
  onEnemyPositionChange,
  onHeroSelectionSlotChange,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);
  const ambientIntensity = Math.max(0, lighting.ambientIntensity);
  const directionalIntensity = Math.max(0, lighting.directionalIntensity);
  const fogNear = Math.max(1, atmosphere.fogNear);
  const fogFar = Math.max(fogNear + 1, atmosphere.fogFar);
  const scenarioScale = Math.max(0.001, scenarioTransform.scale);
  const sceneBg = atmosphere.fogEnabled ? atmosphere.fogColor : '#0f172a';
  const [isDraggingTransform, setIsDraggingTransform] = useState(false);
  const scenarioModelRef = useRef<THREE.Group>(null);
  const menuPortalRef = useRef<THREE.Group>(null);
  const sceneObjectRefs = useRef<Record<string, THREE.Group | null>>({});
  const heroSelectionSlotRefs = useRef<Partial<Record<PlayerClassId, THREE.Group | null>>>({});
  const scenarioHandleRef = useRef<THREE.Group>(null);
  const menuPortalHandleRef = useRef<THREE.Group>(null);
  const heroHandleRef = useRef<THREE.Group>(null);
  const enemyHandleRef = useRef<THREE.Group>(null);
  const freeCameraOrbitRef = useRef<any>(null);

  const isMenuPortalSelection = selectionTarget === 'menu-portal';
  const isSceneObjectSelection = selectionTarget.startsWith('scene-object:');
  const isHeroSlotSelection = selectionTarget.startsWith('hero-slot:');
  const selectedSceneObjectId = isSceneObjectSelection
    ? selectionTarget.slice('scene-object:'.length)
    : null;
  const selectedHeroSlotClassId = isHeroSlotSelection
    ? selectionTarget.slice('hero-slot:'.length) as PlayerClassId
    : null;
  const isSceneObjectTargetLocked = isSceneObjectSelection && Boolean(selectedSceneObjectId);
  const isHeroSlotTargetLocked = isHeroSlotSelection && Boolean(selectedHeroSlotClassId);
  const isTargetLocked = isSceneObjectTargetLocked || isHeroSlotTargetLocked;
  const isHeroSelectionPreview = heroSelectionSlots.length > 0;
  const groundGuideY = -1.14;
  const menuPortalScale = Math.max(0.0001, menuPortalTransform.scale);

  const selectedTargetY = useMemo(() => {
    if (selectionTarget === 'scenario') {
      return scenarioTransform.position[1];
    }
    if (selectionTarget === 'menu-portal') {
      return menuPortalTransform.position[1];
    }
    if (selectionTarget === 'hero') {
      return heroPosition[1];
    }
    if (selectionTarget === 'enemy') {
      return enemyPosition[1];
    }

    if (selectedHeroSlotClassId) {
      const selectedSlot = heroSelectionSlots.find((entry) => entry.classId === selectedHeroSlotClassId);
      return selectedSlot?.position[1] ?? null;
    }

    if (selectedSceneObjectId) {
      const selectedSceneObject = sceneObjects.find((entry) => entry.id === selectedSceneObjectId);
      return selectedSceneObject?.transform.position[1] ?? null;
    }

    return null;
  }, [enemyPosition, heroPosition, heroSelectionSlots, menuPortalTransform.position, scenarioTransform.position, sceneObjects, selectedHeroSlotClassId, selectedSceneObjectId, selectionTarget]);

  const shouldHideGroundGuideLine = selectedTargetY !== null && selectedTargetY < groundGuideY;

  const activeTransformMode: DeveloperScenarioComposerTransformMode = (selectionTarget === 'scenario' || isMenuPortalSelection || isSceneObjectSelection || isHeroSlotSelection)
    ? transformMode
    : 'translate';

  const heroSelectionPreviewSlots = useMemo(() => {
    const defaultOrder: PlayerClassId[] = ['knight', 'barbarian', 'mage', 'ranger', 'rogue'];
    const defaultSlotByClassId: Record<PlayerClassId, { position: [number, number, number]; rotationY: number }> = {
      knight: { position: [-7.2, -1.02, -0.7], rotationY: 0.34 },
      barbarian: { position: [-3.6, -1.02, -0.12], rotationY: 0.2 },
      mage: { position: [0, -1.02, 0.14], rotationY: 0.06 },
      ranger: { position: [3.6, -1.02, -0.12], rotationY: -0.2 },
      rogue: { position: [7.2, -1.02, -0.7], rotationY: -0.34 },
    };

    return defaultOrder.map((classId) => {
      const custom = heroSelectionSlots.find((entry) => entry.classId === classId);
      const fallback = defaultSlotByClassId[classId];
      return {
        classId,
        position: custom?.position ?? fallback.position,
        rotationY: custom?.rotationY ?? fallback.rotationY,
      };
    });
  }, [heroSelectionSlots]);

  const commitFreeCameraState = useCallback((controlsLike?: any) => {
    if (cameraMode !== 'free' || !onCameraStateChange) {
      return;
    }

    const controls = controlsLike ?? freeCameraOrbitRef.current;
    const camera = controls?.object as THREE.PerspectiveCamera | undefined;
    if (!camera) {
      return;
    }

    const target = controls?.target as THREE.Vector3 | undefined;
    onCameraStateChange({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: target
        ? [target.x, target.y, target.z]
        : [...cameraState.target] as [number, number, number],
      fov: Number.isFinite(camera.fov) ? camera.fov : cameraState.fov,
    });
  }, [cameraMode, cameraState.fov, cameraState.target, onCameraStateChange]);

  const handleScenarioObjectChange = useCallback(() => {
    const controlledObject = scenarioModelRef.current ?? scenarioHandleRef.current;
    if (!controlledObject || !onScenarioTransformChange) {
      return;
    }

    onScenarioTransformChange({
      position: [
        controlledObject.position.x,
        controlledObject.position.y,
        controlledObject.position.z,
      ],
      rotation: [
        controlledObject.rotation.x,
        controlledObject.rotation.y,
        controlledObject.rotation.z,
      ],
      scale: controlledObject.scale.x,
    });
  }, [onScenarioTransformChange]);

  const handleHeroObjectChange = useCallback(() => {
    if (!heroHandleRef.current || !onHeroPositionChange) {
      return;
    }

    onHeroPositionChange([
      heroHandleRef.current.position.x,
      heroHandleRef.current.position.y,
      heroHandleRef.current.position.z,
    ]);
  }, [onHeroPositionChange]);

  const handleMenuPortalObjectChange = useCallback(() => {
    if (!menuPortalRef.current || !onMenuPortalTransformChange) {
      return;
    }

    onMenuPortalTransformChange({
      position: [
        menuPortalRef.current.position.x,
        menuPortalRef.current.position.y,
        menuPortalRef.current.position.z,
      ],
      rotation: [
        menuPortalRef.current.rotation.x,
        menuPortalRef.current.rotation.y,
        menuPortalRef.current.rotation.z,
      ],
      scale: menuPortalRef.current.scale.x,
    });
  }, [onMenuPortalTransformChange]);

  const handleEnemyObjectChange = useCallback(() => {
    if (!enemyHandleRef.current || !onEnemyPositionChange) {
      return;
    }

    onEnemyPositionChange([
      enemyHandleRef.current.position.x,
      enemyHandleRef.current.position.y,
      enemyHandleRef.current.position.z,
    ]);
  }, [onEnemyPositionChange]);

  const handleHeroSelectionSlotObjectChange = useCallback((classId: PlayerClassId) => {
    if (!onHeroSelectionSlotChange) {
      return;
    }

    const controlledObject = heroSelectionSlotRefs.current[classId];
    if (!controlledObject) {
      return;
    }

    onHeroSelectionSlotChange(
      classId,
      [controlledObject.position.x, controlledObject.position.y, controlledObject.position.z],
      controlledObject.rotation.y,
    );
  }, [onHeroSelectionSlotChange]);

  const handleSceneObjectObjectChange = useCallback((objectId: string) => {
    if (!onSceneObjectTransformChange) {
      return;
    }

    const controlledObject = sceneObjectRefs.current[objectId];
    if (!controlledObject) {
      return;
    }

    onSceneObjectTransformChange(objectId, {
      position: [
        controlledObject.position.x,
        controlledObject.position.y,
        controlledObject.position.z,
      ],
      rotation: [
        controlledObject.rotation.x,
        controlledObject.rotation.y,
        controlledObject.rotation.z,
      ],
      scale: controlledObject.scale.x,
    });
  }, [onSceneObjectTransformChange]);

  useEffect(() => {
    const validIds = new Set(sceneObjects.map((entry) => entry.id));
    Object.keys(sceneObjectRefs.current).forEach((id) => {
      if (!validIds.has(id)) {
        delete sceneObjectRefs.current[id];
      }
    });
  }, [sceneObjects]);

  const renderTransformHandle = (
    target: DeveloperScenarioComposerSelectionTarget,
    ref: React.RefObject<THREE.Group | null>,
    controlObjectRef: React.RefObject<THREE.Object3D | null> | undefined,
    onObjectChange: () => void,
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    liveObjectCommit = true,
  ) => {
    const handleContent = (
      <group ref={ref} position={position} rotation={rotation} scale={scale}>
        <mesh
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelectionTargetChange?.(target);
          }}
        >
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selectionTarget === target ? 1.1 : 0.5}
            transparent
            opacity={selectionTarget === target ? 0.78 : 0.45}
            depthWrite={false}
          />
        </mesh>
      </group>
    );

    if (!transformControlsEnabled || selectionTarget !== target) {
      return handleContent;
    }

    const controlObject = controlObjectRef?.current;

    if (controlObject) {
      return (
        <TransformControls
          mode={activeTransformMode}
          object={controlObject}
          onMouseDown={() => setIsDraggingTransform(true)}
          onMouseUp={() => {
            setIsDraggingTransform(false);
            onObjectChange();
          }}
          onObjectChange={liveObjectCommit ? onObjectChange : undefined}
        />
      );
    }

    return (
      <TransformControls
        mode={activeTransformMode}
        object={ref.current ?? undefined}
        onMouseDown={() => setIsDraggingTransform(true)}
        onMouseUp={() => {
          setIsDraggingTransform(false);
          onObjectChange();
        }}
        onObjectChange={liveObjectCommit ? onObjectChange : undefined}
      >
        {handleContent}
      </TransformControls>
    );
  };

  const orbitControlsEnabled = cameraMode === 'free' && !isDraggingTransform;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
        performance={{ min: 0.5 }}
      >
        {cameraMode === 'battle-sim' ? (
          <CameraController menuFocus={false} />
        ) : (
          <>
            <PerspectiveCamera
              makeDefault
              position={cameraState.position}
              fov={cameraState.fov}
              onUpdate={(camera) => camera.lookAt(...cameraState.target)}
            />
            <OrbitControls
              ref={freeCameraOrbitRef}
              enablePan
              enableZoom
              enableDamping
              dampingFactor={0.08}
              target={cameraState.target}
              minDistance={4.5}
              maxDistance={26}
              enabled={orbitControlsEnabled}
              onEnd={(event) => commitFreeCameraState((event as any)?.target)}
            />
          </>
        )}

        <color attach="background" args={[sceneBg]} />
        {atmosphere.fogEnabled ? <fog attach="fog" args={[atmosphere.fogColor, fogNear, fogFar]} /> : null}

        <ScenarioCameraRelativeNudgeControls
          enabled={cameraMode === 'free'}
          selectionTarget={selectionTarget}
          scenarioRef={scenarioModelRef}
          menuPortalRef={menuPortalRef}
          heroRef={heroHandleRef}
          enemyRef={enemyHandleRef}
          heroSlotRefs={heroSelectionSlotRefs}
          sceneObjectRefs={sceneObjectRefs}
          onScenarioCommit={handleScenarioObjectChange}
          onMenuPortalCommit={handleMenuPortalObjectChange}
          onHeroCommit={handleHeroObjectChange}
          onEnemyCommit={handleEnemyObjectChange}
          onHeroSlotCommit={handleHeroSelectionSlotObjectChange}
          onSceneObjectCommit={handleSceneObjectObjectChange}
        />

        <ambientLight intensity={ambientIntensity} color={lighting.ambientColor} />
        <hemisphereLight intensity={Math.max(0.2, ambientIntensity * 0.65)} color="#dbeafe" groundColor="#1f2937" />
        <directionalLight
          position={lighting.directionalPosition}
          intensity={directionalIntensity}
          color={lighting.directionalColor}
          castShadow
          shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.16, 0]} receiveShadow renderOrder={-100}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.95}
            metalness={0.02}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {!shouldHideGroundGuideLine ? (
          <gridHelper
            args={[40, 40, '#334155', '#1e293b']}
            position={[0, -1.14, 0]}
            renderOrder={-99}
            material-depthTest={false}
            material-depthWrite={false}
          />
        ) : null}

        <ScenarioParticleField particles={particles} />

        <group
          ref={scenarioModelRef}
          position={scenarioTransform.position}
          rotation={scenarioTransform.rotation}
          scale={[scenarioScale, scenarioScale, scenarioScale]}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (isTargetLocked) {
              return;
            }
            onSelectionTargetChange?.('scenario');
          }}
        >
          <Suspense
            fallback={(
              <Html center>
                <div className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100">
                  carregando cenario...
                </div>
              </Html>
            )}
          >
            <ScenarioGlbModel modelUrl={scenarioModelUrl} />
          </Suspense>
        </group>

        {menuPortalModelUrl ? (
          <group
            ref={menuPortalRef}
            position={menuPortalTransform.position}
            rotation={menuPortalTransform.rotation}
            scale={[menuPortalScale, menuPortalScale, menuPortalScale]}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (isSceneObjectTargetLocked || isHeroSlotTargetLocked) {
                return;
              }
              onSelectionTargetChange?.('menu-portal');
            }}
          >
            <Suspense fallback={null}>
              <group
                scale={[
                  MENU_PORTAL_EDITOR_VISIBILITY_SCALE_BOOST,
                  MENU_PORTAL_EDITOR_VISIBILITY_SCALE_BOOST,
                  MENU_PORTAL_EDITOR_VISIBILITY_SCALE_BOOST,
                ]}
              >
                <ScenarioPortalPreviewModel modelUrl={menuPortalModelUrl} />
              </group>
            </Suspense>
          </group>
        ) : null}

        {sceneObjects.map((sceneObject) => {
          const objectScale = Math.max(0.001, sceneObject.transform.scale);
          return (
            <group
              key={sceneObject.id}
              ref={(node) => {
                sceneObjectRefs.current[sceneObject.id] = node;
              }}
              position={sceneObject.transform.position}
              rotation={sceneObject.transform.rotation}
              scale={[objectScale, objectScale, objectScale]}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (isHeroSlotTargetLocked) {
                  return;
                }
                if (isSceneObjectTargetLocked && selectedSceneObjectId !== sceneObject.id) {
                  return;
                }
                onSelectionTargetChange?.(`scene-object:${sceneObject.id}` as DeveloperScenarioComposerSelectionTarget);
              }}
            >
              <Suspense fallback={null}>
                <ScenarioGlbModel modelUrl={sceneObject.modelUrl} />
              </Suspense>
            </group>
          );
        })}

        {transformControlsEnabled && selectedSceneObjectId && sceneObjectRefs.current[selectedSceneObjectId] ? (
          <TransformControls
            mode={activeTransformMode}
            object={sceneObjectRefs.current[selectedSceneObjectId] ?? undefined}
            onMouseDown={() => setIsDraggingTransform(true)}
            onMouseUp={() => {
              setIsDraggingTransform(false);
              handleSceneObjectObjectChange(selectedSceneObjectId);
            }}
            onObjectChange={() => handleSceneObjectObjectChange(selectedSceneObjectId)}
          />
        ) : null}

        {isHeroSelectionPreview ? (
          <>
            {heroSelectionPreviewSlots.map((slot) => {
              const slotTarget = `hero-slot:${slot.classId}` as DeveloperScenarioComposerSelectionTarget;
              const isSelected = selectionTarget === slotTarget;

              return (
                <group
                  key={slot.classId}
                  ref={(node) => {
                    heroSelectionSlotRefs.current[slot.classId] = node;
                  }}
                  position={slot.position}
                  rotation={[0, slot.rotationY, 0]}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (isSceneObjectTargetLocked) {
                      return;
                    }
                    if (isHeroSlotTargetLocked && selectedHeroSlotClassId !== slot.classId) {
                      return;
                    }
                    onSelectionTargetChange?.(slotTarget);
                  }}
                >
                  <HeroVoxelComponent
                    classId={slot.classId}
                    playerAnimationAction="battle-idle"
                    isAttacking={false}
                    isDefending={false}
                    loadSecondaryAnimationBundles
                    previewLoopAllActions
                    idlePositionX={0}
                    attackPositionX={0}
                    defendPositionX={0}
                    idlePositionY={0}
                    attackPositionY={0}
                    defendPositionY={0}
                    originPosition={[0, 0, 0]}
                    baseRotationY={0}
                    contactShadowResolution={quality.contactShadowResolution}
                  />
                  <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.72, 0.96, 28]} />
                    <meshStandardMaterial
                      color={isSelected ? '#22d3ee' : '#64748b'}
                      emissive={isSelected ? '#22d3ee' : '#334155'}
                      emissiveIntensity={isSelected ? 1.2 : 0.35}
                      transparent
                      opacity={isSelected ? 0.72 : 0.45}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                  <Html position={[0, 2.9, 0]} center distanceFactor={9}>
                    <div className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isSelected ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-50' : 'border-slate-500/40 bg-slate-900/70 text-slate-200'}`}>
                      {slot.classId}
                    </div>
                  </Html>
                </group>
              );
            })}
          </>
        ) : (
          <>
            <group
              onPointerDown={(event) => {
                event.stopPropagation();
                if (isTargetLocked) {
                  return;
                }
                onSelectionTargetChange?.('hero');
              }}
            >
              <HeroVoxelComponent
                classId={heroClassId}
                playerAnimationAction="battle-idle"
                isAttacking={false}
                isDefending={false}
                loadSecondaryAnimationBundles
                previewLoopAllActions
                idlePositionX={heroPosition[0]}
                attackPositionX={heroPosition[0]}
                defendPositionX={heroPosition[0]}
                idlePositionY={heroPosition[1]}
                attackPositionY={heroPosition[1]}
                defendPositionY={heroPosition[1]}
                originPosition={heroPosition}
                baseRotationY={0.45}
                contactShadowResolution={quality.contactShadowResolution}
              />
            </group>

            <group
              onPointerDown={(event) => {
                event.stopPropagation();
                if (isTargetLocked) {
                  return;
                }
                onSelectionTargetChange?.('enemy');
              }}
            >
              <EnemyCharacterComponent
                assets={enemyAssets}
                color={enemyColor}
                scale={enemyScale}
                isAttacking={false}
                isDefending={false}
                animationActionOverride="battle-idle"
                type={enemyType}
                enemyName={enemyName}
                isBoss={false}
                isHit={false}
                attackStyle={enemyAttackStyle}
                idlePositionX={enemyPosition[0]}
                attackPositionX={enemyPosition[0]}
                defendPositionX={enemyPosition[0]}
                idlePositionY={enemyPosition[1]}
                attackPositionY={enemyPosition[1]}
                defendPositionY={enemyPosition[1]}
                originPosition={enemyPosition}
                baseRotationY={-Math.PI - 0.35}
                disableAmbientMotion
                contactShadowResolution={quality.contactShadowResolution}
              />
            </group>
          </>
        )}

        {!isTargetLocked ? renderTransformHandle(
          'scenario',
          scenarioHandleRef,
          scenarioModelRef,
          handleScenarioObjectChange,
          '#22d3ee',
          scenarioTransform.position,
          scenarioTransform.rotation,
          [scenarioScale, scenarioScale, scenarioScale],
        ) : null}

        {menuPortalModelUrl && !isSceneObjectTargetLocked && !isHeroSlotTargetLocked ? renderTransformHandle(
          'menu-portal',
          menuPortalHandleRef,
          menuPortalRef,
          handleMenuPortalObjectChange,
          '#38bdf8',
          menuPortalTransform.position,
          menuPortalTransform.rotation,
          [1, 1, 1],
          false,
        ) : null}

        {!isSceneObjectTargetLocked && !isHeroSelectionPreview ? renderTransformHandle(
          'hero',
          heroHandleRef,
          undefined,
          handleHeroObjectChange,
          '#22c55e',
          heroPosition,
        ) : null}

        {!isSceneObjectTargetLocked && !isHeroSelectionPreview ? renderTransformHandle(
          'enemy',
          enemyHandleRef,
          undefined,
          handleEnemyObjectChange,
          '#f97316',
          enemyPosition,
        ) : null}

        {transformControlsEnabled && selectedHeroSlotClassId && heroSelectionSlotRefs.current[selectedHeroSlotClassId] ? (
          <TransformControls
            mode={activeTransformMode}
            object={heroSelectionSlotRefs.current[selectedHeroSlotClassId] ?? undefined}
            onMouseDown={() => setIsDraggingTransform(true)}
            onMouseUp={() => {
              setIsDraggingTransform(false);
              handleHeroSelectionSlotObjectChange(selectedHeroSlotClassId);
            }}
            onObjectChange={() => handleHeroSelectionSlotObjectChange(selectedHeroSlotClassId)}
          />
        ) : null}

        <ContactShadows position={[0, -1.05, -0.2]} opacity={0.38} scale={24} blur={2.2} far={11} resolution={quality.contactShadowResolution} />
      </Canvas>
    </div>
  );
};

export const DeveloperKitbashSceneRenderer: React.FC<
  DeveloperKitbashSceneProps & {
    HeroVoxelComponent: HeroVoxelComponentType;
    CombinedHeroVoxelComponent: CombinedHeroVoxelComponentType;
    AnimatedClassHeroComponent: AnimatedClassHeroComponentType;
    EnemyCharacterComponent: EnemyCharacterComponentType;
  }
> = ({
  HeroVoxelComponent,
  CombinedHeroVoxelComponent,
  AnimatedClassHeroComponent,
  EnemyCharacterComponent,
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
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);
  const baseClass = getPlayerClassById(baseClassId);
  const runtimeBaseAssets = hasRuntimeFbxAssets(baseClass.assets) ? baseClass.assets : null;
  const runtimeDonorAssets = hasRuntimeFbxAssets(donorAssets) ? donorAssets : null;
  const shouldNormalizeClassKitbash = donorType === 'class';
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<Record<string, DeveloperAnimationRuntimeDiagnostic>>({});
  const handleRuntimeDiagnosticChange = useCallback((diagnostic: DeveloperAnimationRuntimeDiagnostic) => {
    setRuntimeDiagnostics((current) => upsertRuntimeDiagnostic(current, diagnostic));
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
        gl={{ antialias: quality.antialias, powerPreference }}
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
              baseAssets={runtimeBaseAssets as RuntimeHeroAssets}
              donorAssets={runtimeDonorAssets as RuntimeHeroAssets}
              slotAssignments={slotAssignments}
              onAnalysisChange={onAnalysisChange}
            />
          </Suspense>
        ) : null}

        <group position={[-3.1, 0, 0]}>
          <Html position={[0, 2.6, 0]} center>
            <div className="rounded-full border border-cyan-400/30 bg-cyan-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">base {baseClass.name}</div>
          </Html>
          <HeroVoxelComponent
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
          <CombinedHeroVoxelComponent
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
                <AnimatedClassHeroComponent
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
            <EnemyCharacterComponent
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

// ─── GLTF Monster Viewer ─────────────────────────────────────────────────────

export interface DeveloperGltfMonsterSceneProps {
  modelUrl: string;
  animationIndex?: number;
  /** Clip name from the GLTF — takes priority over animationIndex when provided. */
  clipName?: string;
  heroClassId?: PlayerClassId;
  onAnimationsLoaded?: (names: string[]) => void;
}

// Inner component — must be inside Canvas so hooks work
const GltfMonsterModel: React.FC<{
  modelUrl: string;
  animationIndex: number;
  clipName?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}> = ({ modelUrl, animationIndex, clipName, onAnimationsLoaded }) => {
  const gltf = useLoader(GLTFLoader, modelUrl, configureGltfLoader) as any;
  const groupRef = useRef<THREE.Group>(null!);

  // SkeletonUtils.clone (imported module) keeps SkinnedMesh bone references intact
  // so the AnimationMixer can resolve every track against the cloned skeleton.
  // Also compute a Y offset so the bottom of the model sits exactly on the floor.
  const { clonedScene, floorOffsetY } = useMemo(() => {
    const scene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
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

  const { names, actions } = useAnimations(gltf.animations ?? [], groupRef);

  // Report animation names upward once (deduplicated)
  const reportedRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedRef.current) {
      reportedRef.current = joined;
      onAnimationsLoaded?.(names);
    }
  }, [names, onAnimationsLoaded]);

  // Play selected animation — clipName takes priority over animationIndex
  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    // Stop all first (avoid blending artefacts)
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[Math.min(animationIndex, names.length - 1)];
    if (name && actions[name]) {
      actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [actions, animationIndex, clipName, names]);

  return <primitive ref={groupRef} object={clonedScene} position={[0, floorOffsetY, 0]} />;
};

export const DeveloperGltfMonsterSceneRenderer: React.FC<
  DeveloperGltfMonsterSceneProps & { HeroVoxelComponent: HeroVoxelComponentType }
> = ({
  HeroVoxelComponent,
  modelUrl,
  animationIndex = 0,
  clipName,
  heroClassId = 'knight',
  onAnimationsLoaded,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 14, 32]} />
        <PerspectiveCamera makeDefault position={[0, 1.8, 10]} fov={42} onUpdate={(c) => c.lookAt(0, 0.3, 0)} />
        <ambientLight intensity={1.1} color="#f8fafc" />
        <hemisphereLight intensity={0.72} color="#e2e8f0" groundColor="#0f172a" />
        <directionalLight position={[-3, 6, 5]} intensity={1.0} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[3, 2.4, 2.2]} intensity={1.0} color="#34d399" distance={14} />
        <pointLight position={[-2.4, 2.1, 1.4]} intensity={0.85} color="#fb923c" distance={12} />

        {/* Floor */}
        <group position={[0, -1.1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[5.5, 64]} />
            <meshStandardMaterial color="#0f172a" roughness={0.84} metalness={0.06} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4.0, 4.8, 64]} />
            <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.28} transparent opacity={0.14} side={THREE.DoubleSide} />
          </mesh>
          {/* dividing line between hero and monster */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, 6]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.35} />
          </mesh>
        </group>

        {/* Hero — left side */}
        <group position={[-2.4, 0, 0]}>
          <Html position={[0, 2.0, 0]} center>
            <div className="whitespace-nowrap rounded-full border border-cyan-400/30 bg-slate-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-sm">
              Herói · {heroClassId}
            </div>
          </Html>
          <Suspense fallback={null}>
            <HeroVoxelComponent
              classId={heroClassId}
              playerAnimationAction="battle-idle"
              loadSecondaryAnimationBundles
              previewLoopAllActions
              isAttacking={false}
              isDefending={false}
              idlePositionX={0}
              attackPositionX={0}
              defendPositionX={0}
              originPosition={[0, -1.1, 0]}
              baseRotationY={0.4}
              contactShadowResolution={quality.contactShadowResolution}
            />
          </Suspense>
        </group>

        {/* Monster — right side */}
        <group position={[2.0, 0, 0]}>
          <Html position={[0, 2.0, 0]} center>
            <div className="whitespace-nowrap rounded-full border border-emerald-400/30 bg-slate-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100 backdrop-blur-sm">
              Monstro GLTF
            </div>
          </Html>
          {/* Y is managed by GltfMonsterModel's bounding-box floor snap */}
          <group position={[0, -1.1, 0]} rotation={[0, -0.4, 0]} scale={0.6}>
            <Suspense fallback={null}>
              <GltfMonsterModel
                key={modelUrl}
                modelUrl={modelUrl}
                animationIndex={animationIndex}
                clipName={clipName}
                onAnimationsLoaded={onAnimationsLoaded}
              />
            </Suspense>
          </group>
        </group>

        <ContactShadows position={[0, -1.09, 0]} opacity={0.45} scale={7} blur={1.8} far={0.5} resolution={quality.contactShadowResolution} />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={16} target={[0, 0.3, 0]} />
      </Canvas>
    </div>
  );
};

// ─── Biped Character Viewer ───────────────────────────────────────────────────

export interface DeveloperBipedCharacterSceneProps {
  /** URL to the character mesh file (GLB or FBX). Use meshIsFbx=true when it is an FBX */
  characterUrl: string;
  /** When true the characterUrl points to an FBX file instead of a GLB */
  meshIsFbx?: boolean;
  /** URL to the animations file (GLB or FBX). Use animationIsFbx=true when it is an FBX file */
  animationUrl: string;
  /** When true the animationUrl points to an FBX file instead of a GLB */
  animationIsFbx?: boolean;
  /** Optional second animation FBX — its clips are merged with animationUrl clips */
  secondaryAnimationUrl?: string;
  /** Optional FBX loaded only to extract its embedded texture and apply it to the characterUrl mesh */
  textureSourceUrl?: string;
  /** Selected clip name to play (undefined = auto-play first) */
  clipName?: string;
  /** Called once animation clip names are resolved after remapping */
  onAnimationsLoaded?: (names: string[]) => void;
}

// Inner component — must be inside Canvas/Suspense so hooks work
const BipedCharacterModel: React.FC<{
  characterUrl: string;
  animationUrl: string;
  clipName?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}> = ({ characterUrl, animationUrl, clipName, onAnimationsLoaded }) => {
  const characterGltf = useLoader(GLTFLoader, characterUrl, configureGltfLoader) as any;
  const animGltf = useLoader(GLTFLoader, animationUrl, configureGltfLoader) as any;
  const groupRef = useRef<THREE.Group>(null!);

  // Clone the character scene — each clone has its own bone instances.
  // SkeletonUtils.clone preserves bone names, so Three.js AnimationMixer
  // can resolve track bindings by name against this character's own skeleton.
  const { clonedScene, floorOffsetY } = useMemo(() => {
    const scene = SkeletonUtils.clone(characterGltf.scene) as THREE.Group;
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
  }, [characterGltf.scene]);

  // Root the mixer directly on this character's cloned scene.
  // Three.js resolves each track binding by searching for a node with
  // matching name starting from groupRef.current — this drives the
  // character's OWN bones, no remapping needed when all models share
  // the same Meshy AI biped skeleton template.
  const { names, actions } = useAnimations(animGltf.animations ?? [], groupRef);

  const reportedRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedRef.current) {
      reportedRef.current = joined;
      onAnimationsLoaded?.(names);
    }
  }, [names, onAnimationsLoaded]);

  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[0];
    if (name && actions[name]) {
      actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [actions, clipName, names]);

  return <primitive ref={groupRef} object={clonedScene} position={[0, floorOffsetY, 0]} />;
};

// Helper: derives a human-readable label from an FBX URL (filename without extension).
const fbxUrlToLabel = (url: string): string =>
  decodeURIComponent(url.split('/').pop() ?? url).replace(/\.fbx$/i, '');

// Helper: renames clips so "mixamo.com" (the generic Mixamo export name) becomes the
// filename label.  Other clip names get the label prepended so they stay unique.
const renameFbxClips = (clips: THREE.AnimationClip[], label: string): THREE.AnimationClip[] =>
  clips.map((c) => {
    const r = c.clone();
    r.name = c.name === 'mixamo.com' ? label : `${label} · ${c.name}`;
    return r;
  });

// Inner component — FBX mesh + FBX animation(s).
// Uses configureFBXLoaderDisplay so embedded textures are visible.
// Auto-scales the model to BIPED_FBX_TARGET_HEIGHT to match GLB characters.
// Converts FBX Phong/Lambert materials to MeshStandardMaterial so they always
// respond correctly to the PBR scene lighting (fixes all-black appearance).
// Supports an optional secondaryAnimationUrl: both FBX clips are merged and
// renamed after their source filename, giving multiple selectable clips.
const BIPED_FBX_TARGET_HEIGHT = 1.75; // metres — matches typical Meshy AI GLB orc height
const BipedCharacterFbxMeshFbxAnimModel: React.FC<{
  characterUrl: string;
  animationUrl: string;
  /** Optional second animation FBX — clips are merged with the primary ones. */
  secondaryAnimationUrl?: string;
  /** Optional FBX loaded only to extract its embedded texture and apply it to the characterUrl mesh. */
  textureSourceUrl?: string;
  clipName?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}> = ({ characterUrl, animationUrl, secondaryAnimationUrl, textureSourceUrl, clipName, onAnimationsLoaded }) => {
  // Load mesh FBX with display loader so embedded PNG/TGA textures are decoded.
  // When textureSourceUrl is a separate file its map overrides; when it falls back
  // to characterUrl both hooks return the same cached object (same URL + config).
  const meshFbx    = useLoader(FBXLoader, characterUrl,                           configureFBXLoaderDisplay) as THREE.Group;
  // Texture-source FBX — falls back to characterUrl when no separate source given.
  const textureFbx = useLoader(FBXLoader, textureSourceUrl ?? characterUrl,       configureFBXLoaderDisplay) as THREE.Group;
  const animFbx    = useLoader(FBXLoader, animationUrl,                           configureFBXLoaderDisplay) as THREE.Group;
  // Always call useLoader for the secondary URL — when undefined fall back to
  // animationUrl so the hook count stays constant (React rules of hooks).
  const animFbx2   = useLoader(FBXLoader, secondaryAnimationUrl ?? animationUrl,  configureFBXLoader) as THREE.Group;
  const groupRef   = useRef<THREE.Group>(null!);

  const { clonedScene, floorOffsetY, normalizedScale } = useMemo(() => {
    // Helper: returns the texture only when its image is fully decoded.
    // A THREE.Texture whose image hasn't loaded yet renders as solid black;
    // discarding it lets the white base-color show instead of a black mesh.
    const readyMap = (tex: THREE.Texture | null | undefined): THREE.Texture | null => {
      if (!tex) return null;
      const img = tex.image as (HTMLImageElement | ImageBitmap | null | undefined);
      if (!img) return null;
      if (img instanceof HTMLImageElement && !img.complete) return null;
      // Fix common FBX texture issues before using.
      tex.flipY      = false;                       // FBX Y-axis is inverted vs WebGL
      tex.colorSpace = THREE.SRGBColorSpace;        // Ensure correct colour space
      tex.needsUpdate = true;
      return tex;
    };

    // Extract the first usable diffuse texture from the texture-source FBX.
    let extractedMap: THREE.Texture | null = null;
    (textureFbx as THREE.Group).traverse((node: any) => {
      if (extractedMap || !node.isMesh) return;
      const mats: THREE.Material[] = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of mats) {
        // Check diffuse, emissive, and other common slots in priority order.
        const tex = readyMap((mat as any).map)
          ?? readyMap((mat as any).emissiveMap)
          ?? readyMap((mat as any).diffuseMap);
        if (tex) { extractedMap = tex; break; }
      }
    });

    const scene = SkeletonUtils.clone(meshFbx) as THREE.Group;
    const meshBox = new THREE.Box3();
    scene.traverse((node: any) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;

      const oldMats: THREE.Material[] = Array.isArray(node.material) ? node.material : [node.material];
      const wasArray = Array.isArray(node.material);
      const newMats = oldMats.map((oldMat) => {
        const map = extractedMap ?? readyMap((oldMat as any).map) ?? null;
        return new THREE.MeshStandardMaterial({
          map,
          normalMap:   (oldMat as any).normalMap ?? null,
          alphaMap:    (oldMat as any).alphaMap  ?? null,
          transparent: oldMat.transparent,
          opacity:     oldMat.opacity,
          side:        THREE.DoubleSide,   // render both faces — avoids black on inverted normals
          color:       new THREE.Color(1, 1, 1),
          roughness:   0.75,
          metalness:   0.05,
        });
      });
      node.material = wasArray ? newMats : newMats[0];

      const nodeBox = new THREE.Box3().setFromObject(node);
      if (!nodeBox.isEmpty()) meshBox.union(nodeBox);
    });

    const rawHeight = meshBox.isEmpty() ? 0 : meshBox.max.y - meshBox.min.y;
    const scale    = rawHeight > 0.01 ? BIPED_FBX_TARGET_HEIGHT / rawHeight : 0.01;
    const offsetY  = meshBox.isEmpty() || !isFinite(meshBox.min.y) ? 0 : -meshBox.min.y * scale;
    return { clonedScene: scene, floorOffsetY: offsetY, normalizedScale: scale };
  }, [meshFbx, textureFbx]);

  // Build merged + renamed clip list from primary (and optional secondary) animation FBX.
  const remappedClips = useMemo(() => {
    const label1 = fbxUrlToLabel(animationUrl);
    const raw1: THREE.AnimationClip[] = (animFbx as any).animations ?? [];
    const clips1 = remapClipBindingsToSkeleton({
      clips: renameFbxClips(raw1, label1),
      targetModel: clonedScene,
    });

    if (secondaryAnimationUrl && secondaryAnimationUrl !== animationUrl) {
      const label2 = fbxUrlToLabel(secondaryAnimationUrl);
      const raw2: THREE.AnimationClip[] = (animFbx2 as any).animations ?? [];
      const clips2 = remapClipBindingsToSkeleton({
        clips: renameFbxClips(raw2, label2),
        targetModel: clonedScene,
      });
      return [...clips1, ...clips2];
    }

    return clips1;
  }, [(animFbx as any).animations, (animFbx2 as any).animations, animationUrl, secondaryAnimationUrl, clonedScene]);

  // Expose clip names upward.
  const reportedRef = useRef('');
  useEffect(() => {
    const names = remappedClips.map((c) => c.name);
    const joined = names.join('|');
    if (joined !== reportedRef.current) {
      reportedRef.current = joined;
      onAnimationsLoaded?.(names);
    }
  }, [remappedClips, onAnimationsLoaded]);

  // Drive animation via a manual AnimationMixer rooted directly on clonedScene.
  useEffect(() => {
    if (!remappedClips.length || !clonedScene) return;
    const mixer = new THREE.AnimationMixer(clonedScene);
    const name  = clipName ?? remappedClips[0]?.name;
    const clip  = remappedClips.find((c) => c.name === name) ?? remappedClips[0];
    if (clip) mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat, Infinity).play();
    (clonedScene as any).__mixer = mixer;
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clonedScene); };
  }, [remappedClips, clipName, clonedScene]);

  // Tick the mixer every frame.
  useFrame((_, delta) => {
    const mixer: THREE.AnimationMixer | undefined = (clonedScene as any).__mixer;
    if (mixer) mixer.update(delta);
  });

  return <primitive ref={groupRef} object={clonedScene} scale={normalizedScale} position={[0, floorOffsetY, 0]} />;
};

// Inner component — FBX animation(s) applied to a GLB character mesh.
// Loads the character GLB and the animation FBX(s) separately, then uses
// remapClipBindingsToSkeleton so even if bone naming differs the clips bind correctly.
const BipedCharacterFbxAnimModel: React.FC<{
  characterUrl: string;
  animationUrl: string;
  secondaryAnimationUrl?: string;
  clipName?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}> = ({ characterUrl, animationUrl, secondaryAnimationUrl, clipName, onAnimationsLoaded }) => {
  const characterGltf = useLoader(GLTFLoader, characterUrl, configureGltfLoader) as any;
  const animFbx  = useLoader(FBXLoader, animationUrl,                          configureFBXLoader) as THREE.Group;
  // Always call for secondary — falls back to animationUrl when undefined (rules of hooks).
  const animFbx2 = useLoader(FBXLoader, secondaryAnimationUrl ?? animationUrl, configureFBXLoader) as THREE.Group;
  const groupRef = useRef<THREE.Group>(null!);

  const { clonedScene, floorOffsetY } = useMemo(() => {
    const scene = SkeletonUtils.clone(characterGltf.scene) as THREE.Group;
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
  }, [characterGltf.scene]);

  // Remap FBX animation tracks to match the GLB skeleton bone names.
  // Merge and rename clips from primary and optional secondary animation FBX.
  const remappedClips = useMemo(() => {
    // Check if the target GLB skeleton uses the mixamorig prefix on its bones.
    // When it does NOT (short bone names like "Hips"), the Mixamo FBX tracks
    // ("mixamorigHips.position") fail to match. Strip the prefix in that case.
    let glbHasMixamorigBones = false;
    clonedScene.traverse((n: any) => {
      if (n.isBone && /^mixamorig/i.test(n.name)) glbHasMixamorigBones = true;
    });

    const prepareClips = (raw: THREE.AnimationClip[], label: string): THREE.AnimationClip[] => {
      const renamed = renameFbxClips(raw, label);
      const stripped = glbHasMixamorigBones
        ? renamed
        : renamed.map((c) => {
            const cloned = c.clone();
            cloned.tracks = cloned.tracks.map((t) => {
              const tr = t.clone();
              // "mixamorigHips.position" → "Hips.position"
              tr.name = tr.name.replace(/^mixamorig([A-Z])/g, '$1');
              return tr;
            });
            return cloned;
          });
      return remapClipBindingsToSkeleton({ clips: stripped, targetModel: clonedScene });
    };

    const raw1: THREE.AnimationClip[] = (animFbx as any).animations ?? [];
    const clips1 = prepareClips(raw1, fbxUrlToLabel(animationUrl));

    if (secondaryAnimationUrl && secondaryAnimationUrl !== animationUrl) {
      const raw2: THREE.AnimationClip[] = (animFbx2 as any).animations ?? [];
      const clips2 = prepareClips(raw2, fbxUrlToLabel(secondaryAnimationUrl));
      return [...clips1, ...clips2];
    }
    return clips1;
  }, [(animFbx as any).animations, (animFbx2 as any).animations, animationUrl, secondaryAnimationUrl, clonedScene]);

  const { names, actions } = useAnimations(remappedClips, groupRef);

  const reportedRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedRef.current) {
      reportedRef.current = joined;
      onAnimationsLoaded?.(names);
    }
  }, [names, onAnimationsLoaded]);

  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[0];
    if (name && actions[name]) {
      actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [actions, clipName, names]);

  return <primitive ref={groupRef} object={clonedScene} position={[0, floorOffsetY, 0]} />;
};

export const DeveloperBipedCharacterSceneRenderer: React.FC<DeveloperBipedCharacterSceneProps> = ({
  characterUrl,
  meshIsFbx = false,
  animationUrl,
  animationIsFbx = false,
  secondaryAnimationUrl,
  textureSourceUrl,
  clipName,
  onAnimationsLoaded,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 14, 32]} />
        <PerspectiveCamera makeDefault position={[0, 1.45, 6.5]} fov={42} onUpdate={(c) => c.lookAt(0, 0.5, 0)} />
        <ambientLight intensity={1.1} color="#f8fafc" />
        <hemisphereLight intensity={0.72} color="#e2e8f0" groundColor="#0f172a" />
        <directionalLight position={[-3, 6, 5]} intensity={1.0} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[3, 2.4, 2.2]} intensity={1.0} color="#818cf8" distance={14} />
        <pointLight position={[-2.4, 2.1, 1.4]} intensity={0.85} color="#c084fc" distance={12} />

        {/* Floor */}
        <group position={[0, -1.1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[4.5, 64]} />
            <meshStandardMaterial color="#0f172a" roughness={0.84} metalness={0.06} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.2, 3.9, 64]} />
            <meshStandardMaterial color="#818cf8" emissive="#6366f1" emissiveIntensity={0.28} transparent opacity={0.14} side={THREE.DoubleSide} />
          </mesh>
        </group>

        <group position={[0, -1.1, 0]}>
          <Suspense fallback={null}>
            {meshIsFbx && animationIsFbx ? (
              <BipedCharacterFbxMeshFbxAnimModel
                key={characterUrl + '|' + animationUrl + '|' + (secondaryAnimationUrl ?? '') + '|' + (textureSourceUrl ?? '')}
                characterUrl={characterUrl}
                animationUrl={animationUrl}
                secondaryAnimationUrl={secondaryAnimationUrl}
                textureSourceUrl={textureSourceUrl}
                clipName={clipName}
                onAnimationsLoaded={onAnimationsLoaded}
              />
            ) : animationIsFbx ? (
              <BipedCharacterFbxAnimModel
                key={characterUrl + '|' + animationUrl + '|' + (secondaryAnimationUrl ?? '')}
                characterUrl={characterUrl}
                animationUrl={animationUrl}
                secondaryAnimationUrl={secondaryAnimationUrl}
                clipName={clipName}
                onAnimationsLoaded={onAnimationsLoaded}
              />
            ) : (
              <BipedCharacterModel
                key={characterUrl + '|' + animationUrl}
                characterUrl={characterUrl}
                animationUrl={animationUrl}
                clipName={clipName}
                onAnimationsLoaded={onAnimationsLoaded}
              />
            )}
          </Suspense>
        </group>

        <ContactShadows position={[0, -1.09, 0]} opacity={0.45} scale={6} blur={1.8} far={0.5} resolution={quality.contactShadowResolution} />
        <OrbitControls enablePan={false} minDistance={2} maxDistance={14} target={[0, 0.5, 0]} />
      </Canvas>
    </div>
  );
};

// ─── Rig Retarget Lab ─────────────────────────────────────────────────────────

export interface RetargetReport {
  sourceBoneCount: number;
  targetBoneCount: number;
  matchedBones: number;
  matchPercent: number;
  unmatchedSourceBones: string[];
  unmatchedTargetBones: string[];
  sourceClipCount: number;
  animationSource: 'source' | 'target' | 'none';
  /** All original bone names in the source model */
  allSourceBones: string[];
  /** All original bone names in the target model */
  allTargetBones: string[];
}

export interface DeveloperRigRetargetSceneProps {
  /** URL to the source GLB (hero class or animation bundle — provides skeleton + optional animations) */
  sourceUrl: string;
  /** URL to the target GLB (monster / biped — receives retargeted animations) */
  targetUrl: string;
  /** Clip name to play on the target. undefined = auto-play first available */
  clipName?: string;
  /** Show THREE.SkeletonHelper wireframe on both models */
  showSkeleton?: boolean;
  /** Show the source model as a ghost on the left */
  showSourceModel?: boolean;
  /** Called once clip names are resolved for the target */
  onClipsLoaded?: (names: string[]) => void;
  /** Called once the rig comparison report is ready */
  onReportReady?: (report: RetargetReport) => void;
  /** Manual bone name overrides: original source bone name → original target bone name */
  customBoneMap?: Record<string, string>;
  /** True when sourceUrl points to a FBX animation bundle instead of a GLB */
  sourceIsFbx?: boolean;
  /** True when targetUrl points to a FBX character model (hero class) instead of a GLB/GLTF */
  targetIsFbx?: boolean;
  /** Enable click-to-select bone + TransformControls gizmo in viewport */
  poseEditMode?: boolean;
}

// ── Shared inner-props type for both GLB and FBX core renderers ──────────────
type RigRetargetCoreProps = {
  sourceUrl: string;
  targetUrl: string;
  clipName?: string;
  showSkeleton: boolean;
  showSourceModel: boolean;
  customBoneMap: Record<string, string>;
  onClipsLoaded?: (names: string[]) => void;
  onReportReady?: (report: RetargetReport) => void;
  /** Injected by router so cores can read it if needed */
  targetIsFbx?: boolean;
  /** Enable click-to-select bone + TransformControls gizmo */
  poseEditMode?: boolean;
};

// ── Bone pose editor helpers ──────────────────────────────────────────────────

/** Small sphere that follows a bone's world position every frame. Clickable to select. */
const BoneMarker: React.FC<{
  bone: THREE.Bone;
  selected: boolean;
  onSelect: () => void;
}> = ({ bone, selected, onSelect }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const pos = useRef(new THREE.Vector3());
  useFrame(() => {
    if (ref.current) {
      bone.getWorldPosition(pos.current);
      ref.current.position.copy(pos.current);
    }
  });
  return (
    <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onSelect(); }} renderOrder={999}>
      <sphereGeometry args={[0.032, 8, 8]} />
      <meshBasicMaterial
        color={selected ? '#facc15' : '#22d3ee'}
        transparent
        opacity={selected ? 1.0 : 0.72}
        depthTest={false}
      />
    </mesh>
  );
};

/**
 * Renders clickable bone markers over the target model and attaches TransformControls
 * to the selected bone. Requires OrbitControls to have makeDefault={true} so it can be
 * disabled while dragging a gizmo.
 */
const BonePoseEditor: React.FC<{
  targetClone: THREE.Group;
  targetOffsetY: number;
}> = ({ targetClone, targetOffsetY }) => {
  const { controls } = useThree() as any;
  const [selectedBone, setSelectedBone] = useState<THREE.Bone | null>(null);
  const [mode, setMode] = useState<'rotate' | 'translate'>('rotate');

  const bones = useMemo(() => {
    const result: THREE.Bone[] = [];
    targetClone.traverse((node) => {
      if ((node as THREE.Bone).isBone) result.push(node as THREE.Bone);
    });
    return result;
  }, [targetClone]);

  // Bone name label next to selected bone
  const selectedPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (selectedBone) selectedBone.getWorldPosition(selectedPos);
  });

  const handleTransformMouseDown = () => { if (controls) controls.enabled = false; };
  const handleTransformMouseUp   = () => { if (controls) controls.enabled = true; };

  return (
    <>
      {/* Mode toggle chip — rendered via Html so it stays in 3D space */}
      <Html position={[2.0, 2.6, 0]} center>
        <div className="flex gap-1 rounded-full border border-yellow-400/40 bg-slate-950/90 px-2 py-1">
          {(['rotate', 'translate'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${mode === m ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {m === 'rotate' ? 'Rot' : 'Pos'}
            </button>
          ))}
          {selectedBone && (
            <span className="ml-1 rounded-full bg-yellow-400/15 px-2 py-0.5 text-[9px] font-black text-yellow-300 max-w-[120px] truncate">
              {selectedBone.name}
            </span>
          )}
          {selectedBone && (
            <button
              onClick={() => setSelectedBone(null)}
              className="ml-1 text-[9px] text-slate-500 hover:text-red-400"
            >×</button>
          )}
        </div>
      </Html>

      {/* Bone markers — only over the target (right side, offset matches group position) */}
      {bones.map((bone) => (
        <BoneMarker
          key={bone.uuid}
          bone={bone}
          selected={selectedBone === bone}
          onSelect={() => setSelectedBone((prev) => prev === bone ? null : bone)}
        />
      ))}

      {/* Gizmo on selected bone */}
      {selectedBone && (
        <TransformControls
          object={selectedBone}
          mode={mode}
          size={0.55}
          onMouseDown={handleTransformMouseDown}
          onMouseUp={handleTransformMouseUp}
        />
      )}
    </>
  );
};

// ── GLB source core ───────────────────────────────────────────────────────────
const RigRetargetModelGLBCore: React.FC<RigRetargetCoreProps> = ({ sourceUrl, targetUrl, clipName, showSkeleton, showSourceModel, customBoneMap, poseEditMode, onClipsLoaded, onReportReady }) => {
  const sourceGltf = useLoader(GLTFLoader, sourceUrl, configureGltfLoader) as any;
  const targetGltf = useLoader(GLTFLoader, targetUrl, configureGltfLoader) as any;

  const targetGroupRef = useRef<THREE.Group>(null!);
  const sourceGroupRef = useRef<THREE.Group>(null!);

  // Clone both scenes for independent bone instances
  const { sourceClone, targetClone, sourceOffsetY, targetOffsetY } = useMemo(() => {
    const src = SkeletonUtils.clone(sourceGltf.scene) as THREE.Group;
    src.traverse((node: any) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        // Ghost material — semi-transparent blue tint
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        node.material = mats.map((mat: THREE.Material) => {
          const m = (mat as THREE.MeshStandardMaterial).clone();
          m.transparent = true;
          m.opacity = 0.38;
          m.color = new THREE.Color(0x93c5fd);
          return m;
        });
        if (!Array.isArray(node.material)) node.material = (node.material as THREE.Material[])[0];
      }
    });

    const tgt = SkeletonUtils.clone(targetGltf.scene) as THREE.Group;
    tgt.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });

    const srcBox = new THREE.Box3().setFromObject(src);
    const tgtBox = new THREE.Box3().setFromObject(tgt);
    return {
      sourceClone: src,
      targetClone: tgt,
      sourceOffsetY: !srcBox.isEmpty() && isFinite(srcBox.min.y) ? -srcBox.min.y : 0,
      targetOffsetY: !tgtBox.isEmpty() && isFinite(tgtBox.min.y) ? -tgtBox.min.y : 0,
    };
  }, [sourceGltf.scene, targetGltf.scene]);

  // Remap source animations to target skeleton bones; fall back to target's own clips.
  // customBoneMap identity is stable (useState from parent) — only changes when user edits mapping.
  const allClips = useMemo(() => {
    const srcClips: THREE.AnimationClip[] = sourceGltf.animations ?? [];
    const tgtClips: THREE.AnimationClip[] = targetGltf.animations ?? [];
    if (srcClips.length > 0) {
      return remapClipBindingsToSkeleton({ clips: srcClips, targetModel: targetClone, customBoneMap });
    }
    return tgtClips;
  }, [sourceGltf.animations, targetGltf.animations, targetClone, customBoneMap]);

  // Target mixer — plays retargeted (or own) clips
  const { names, actions } = useAnimations(allClips, targetGroupRef);

  // Source mixer — plays source's own clips as a visual reference on the ghost
  const { names: srcNames, actions: srcActions } = useAnimations(sourceGltf.animations ?? [], sourceGroupRef);

  // SkeletonHelpers
  const sourceHelper = useMemo(() => new THREE.SkeletonHelper(sourceClone), [sourceClone]);
  const targetHelper = useMemo(() => new THREE.SkeletonHelper(targetClone), [targetClone]);

  // Report available clip names
  const reportedNamesRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedNamesRef.current) {
      reportedNamesRef.current = joined;
      onClipsLoaded?.(names);
    }
  }, [names, onClipsLoaded]);

  // Compute rig comparison report (factors in customBoneMap)
  const reportKeyRef = useRef('');
  useEffect(() => {
    const key = `${sourceUrl}|${targetUrl}|${JSON.stringify(customBoneMap)}`;
    if (key === reportKeyRef.current) return;
    reportKeyRef.current = key;

    const srcBones = collectBoneNames(sourceClone);
    const tgtBones = collectBoneNames(targetClone);
    const tgtLookup = createNormalizedBoneLookup(tgtBones);
    const srcLookup = createNormalizedBoneLookup(srcBones);

    // Build normalized lookup from custom overrides
    const customNorm = new Map<string, string>();
    Object.entries(customBoneMap).forEach(([s, t]) => customNorm.set(normalizeRigName(s), t));

    const matched = srcBones.filter((b) => {
      const n = normalizeRigName(b);
      return customNorm.has(n) || tgtLookup.has(n);
    });
    const unmatchedSrc = srcBones.filter((b) => {
      const n = normalizeRigName(b);
      return !customNorm.has(n) && !tgtLookup.has(n);
    });
    const mappedTgtNames = new Set([
      ...tgtBones.filter((b) => srcLookup.has(normalizeRigName(b))),
      ...Object.values(customBoneMap),
    ]);
    const unmatchedTgt = tgtBones.filter((b) => !mappedTgtNames.has(b));
    const matchPct = srcBones.length > 0 ? Math.round((matched.length / srcBones.length) * 100) : 0;
    const srcClipCount = (sourceGltf.animations ?? []).length;

    onReportReady?.({
      sourceBoneCount: srcBones.length,
      targetBoneCount: tgtBones.length,
      matchedBones: matched.length,
      matchPercent: matchPct,
      unmatchedSourceBones: unmatchedSrc,
      unmatchedTargetBones: unmatchedTgt,
      sourceClipCount: srcClipCount,
      animationSource: srcClipCount > 0 ? 'source' : tgtBones.length > 0 ? 'target' : 'none',
      allSourceBones: srcBones,
      allTargetBones: tgtBones,
    });
  }, [sourceUrl, targetUrl, sourceClone, targetClone, sourceGltf.animations, customBoneMap, onReportReady]);

  // Play selected clip on target
  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[0];
    if (name && actions[name]) {
      actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [actions, clipName, names]);

  // Play first clip on source ghost for visual reference
  useEffect(() => {
    if (!srcNames.length || !Object.keys(srcActions).length) return;
    Object.values(srcActions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const first = srcNames[0];
    if (first && srcActions[first]) {
      srcActions[first]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }, [srcActions, srcNames]);

  return (
    <>
      {/* Source ghost — left */}
      <group position={[-2.0, -1.1 + sourceOffsetY, 0]} visible={showSourceModel}>
        <primitive ref={sourceGroupRef} object={sourceClone} />
        {showSkeleton && <primitive object={sourceHelper} />}
      </group>

      {/* Target — right */}
      <group position={[2.0, -1.1 + targetOffsetY, 0]}>
        <primitive ref={targetGroupRef} object={targetClone} />
        {showSkeleton && <primitive object={targetHelper} />}
      </group>
      {poseEditMode && <BonePoseEditor targetClone={targetClone} targetOffsetY={targetOffsetY} />}
    </>
  );
};

// ── FBX source core ───────────────────────────────────────────────────────────
// Identical logic to GLBCore but source is loaded via FBXLoader.
// FBX returns a THREE.Group directly (not {scene, animations}).
const RigRetargetModelFBXCore: React.FC<RigRetargetCoreProps> = ({ sourceUrl, targetUrl, clipName, showSkeleton, showSourceModel, customBoneMap, poseEditMode, onClipsLoaded, onReportReady }) => {
  // FBX: the loaded object IS the root group; .animations lives on it directly
  const sourceFbx = useLoader(FBXLoader, sourceUrl, configureFBXLoader) as THREE.Group;
  const targetGltf = useLoader(GLTFLoader, targetUrl, configureGltfLoader) as any;

  const targetGroupRef = useRef<THREE.Group>(null!);
  const sourceGroupRef = useRef<THREE.Group>(null!);

  const { sourceClone, targetClone, sourceOffsetY, targetOffsetY } = useMemo(() => {
    const src = SkeletonUtils.clone(sourceFbx) as THREE.Group;
    src.traverse((node: any) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        node.material = mats.map((mat: THREE.Material) => {
          const m = (mat as THREE.MeshStandardMaterial).clone();
          m.transparent = true;
          m.opacity = 0.38;
          m.color = new THREE.Color(0x93c5fd);
          return m;
        });
        if (!Array.isArray(node.material)) node.material = (node.material as THREE.Material[])[0];
      }
    });
    const tgt = SkeletonUtils.clone(targetGltf.scene) as THREE.Group;
    tgt.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });
    const srcBox = new THREE.Box3().setFromObject(src);
    const tgtBox = new THREE.Box3().setFromObject(tgt);
    return {
      sourceClone: src,
      targetClone: tgt,
      sourceOffsetY: !srcBox.isEmpty() && isFinite(srcBox.min.y) ? -srcBox.min.y : 0,
      targetOffsetY: !tgtBox.isEmpty() && isFinite(tgtBox.min.y) ? -tgtBox.min.y : 0,
    };
  }, [sourceFbx, targetGltf.scene]);

  const allClips = useMemo(() => {
    const srcClips: THREE.AnimationClip[] = (sourceFbx as any).animations ?? [];
    const tgtClips: THREE.AnimationClip[] = targetGltf.animations ?? [];
    if (srcClips.length > 0) {
      return remapClipBindingsToSkeleton({ clips: srcClips, targetModel: targetClone, customBoneMap });
    }
    return tgtClips;
  }, [(sourceFbx as any).animations, targetGltf.animations, targetClone, customBoneMap]);

  const { names, actions } = useAnimations(allClips, targetGroupRef);
  const { names: srcNames, actions: srcActions } = useAnimations((sourceFbx as any).animations ?? [], sourceGroupRef);

  const sourceHelper = useMemo(() => new THREE.SkeletonHelper(sourceClone), [sourceClone]);
  const targetHelper = useMemo(() => new THREE.SkeletonHelper(targetClone), [targetClone]);

  const reportedNamesRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedNamesRef.current) {
      reportedNamesRef.current = joined;
      onClipsLoaded?.(names);
    }
  }, [names, onClipsLoaded]);

  const reportKeyRef = useRef('');
  useEffect(() => {
    const key = `${sourceUrl}|${targetUrl}|${JSON.stringify(customBoneMap)}`;
    if (key === reportKeyRef.current) return;
    reportKeyRef.current = key;
    const srcBones = collectBoneNames(sourceClone);
    const tgtBones = collectBoneNames(targetClone);
    const tgtLookup = createNormalizedBoneLookup(tgtBones);
    const srcLookup = createNormalizedBoneLookup(srcBones);
    const customNorm = new Map<string, string>();
    Object.entries(customBoneMap).forEach(([s, t]) => customNorm.set(normalizeRigName(s), t));
    const matched = srcBones.filter((b) => { const n = normalizeRigName(b); return customNorm.has(n) || tgtLookup.has(n); });
    const unmatchedSrc = srcBones.filter((b) => { const n = normalizeRigName(b); return !customNorm.has(n) && !tgtLookup.has(n); });
    const mappedTgtNames = new Set([
      ...tgtBones.filter((b) => srcLookup.has(normalizeRigName(b))),
      ...Object.values(customBoneMap),
    ]);
    const unmatchedTgt = tgtBones.filter((b) => !mappedTgtNames.has(b));
    const matchPct = srcBones.length > 0 ? Math.round((matched.length / srcBones.length) * 100) : 0;
    const srcClipCount = ((sourceFbx as any).animations ?? []).length;
    onReportReady?.({
      sourceBoneCount: srcBones.length,
      targetBoneCount: tgtBones.length,
      matchedBones: matched.length,
      matchPercent: matchPct,
      unmatchedSourceBones: unmatchedSrc,
      unmatchedTargetBones: unmatchedTgt,
      sourceClipCount: srcClipCount,
      animationSource: srcClipCount > 0 ? 'source' : tgtBones.length > 0 ? 'target' : 'none',
      allSourceBones: srcBones,
      allTargetBones: tgtBones,
    });
  }, [sourceUrl, targetUrl, sourceClone, targetClone, (sourceFbx as any).animations, customBoneMap, onReportReady]);

  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[0];
    if (name && actions[name]) actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions, clipName, names]);

  useEffect(() => {
    if (!srcNames.length || !Object.keys(srcActions).length) return;
    Object.values(srcActions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const first = srcNames[0];
    if (first && srcActions[first]) srcActions[first]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [srcActions, srcNames]);

  return (
    <>
      <group position={[-2.0, -1.1 + sourceOffsetY, 0]} visible={showSourceModel}>
        <primitive ref={sourceGroupRef} object={sourceClone} />
        {showSkeleton && <primitive object={sourceHelper} />}
      </group>
      <group position={[2.0, -1.1 + targetOffsetY, 0]}>
        <primitive ref={targetGroupRef} object={targetClone} />
        {showSkeleton && <primitive object={targetHelper} />}
      </group>
      {poseEditMode && <BonePoseEditor targetClone={targetClone} targetOffsetY={targetOffsetY} />}
    </>
  );
};

// ── FBX source + FBX target core ──────────────────────────────────────────────
// Used when SOURCE = Rig_Medium FBX bundle and TARGET = hero class FBX model.
// Both share the same UE4-mannequin bone naming → auto-normalization gives ~100% match.
const RigRetargetModelFBXtoFBXCore: React.FC<RigRetargetCoreProps> = ({ sourceUrl, targetUrl, clipName, showSkeleton, showSourceModel, customBoneMap, poseEditMode, onClipsLoaded, onReportReady }) => {
  const sourceFbx = useLoader(FBXLoader, sourceUrl, configureFBXLoader) as THREE.Group;
  const targetFbx = useLoader(FBXLoader, targetUrl, configureFBXLoader) as THREE.Group;

  const targetGroupRef = useRef<THREE.Group>(null!);
  const sourceGroupRef = useRef<THREE.Group>(null!);

  const { sourceClone, targetClone, sourceOffsetY, targetOffsetY } = useMemo(() => {
    const src = SkeletonUtils.clone(sourceFbx) as THREE.Group;
    src.traverse((node: any) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        node.material = mats.map((mat: THREE.Material) => {
          const m = (mat as THREE.MeshStandardMaterial).clone();
          m.transparent = true; m.opacity = 0.38;
          m.color = new THREE.Color(0x93c5fd);
          return m;
        });
        if (!Array.isArray(node.material)) node.material = (node.material as THREE.Material[])[0];
      }
    });
    const tgt = SkeletonUtils.clone(targetFbx) as THREE.Group;
    tgt.traverse((node: any) => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    });
    const srcBox = new THREE.Box3().setFromObject(src);
    const tgtBox = new THREE.Box3().setFromObject(tgt);
    return {
      sourceClone: src,
      targetClone: tgt,
      sourceOffsetY: !srcBox.isEmpty() && isFinite(srcBox.min.y) ? -srcBox.min.y : 0,
      targetOffsetY: !tgtBox.isEmpty() && isFinite(tgtBox.min.y) ? -tgtBox.min.y : 0,
    };
  }, [sourceFbx, targetFbx]);

  const allClips = useMemo(() => {
    const srcClips: THREE.AnimationClip[] = (sourceFbx as any).animations ?? [];
    const tgtClips: THREE.AnimationClip[] = (targetFbx as any).animations ?? [];
    if (srcClips.length > 0) return remapClipBindingsToSkeleton({ clips: srcClips, targetModel: targetClone, customBoneMap });
    return tgtClips;
  }, [(sourceFbx as any).animations, (targetFbx as any).animations, targetClone, customBoneMap]);

  const { names, actions } = useAnimations(allClips, targetGroupRef);
  const { names: srcNames, actions: srcActions } = useAnimations((sourceFbx as any).animations ?? [], sourceGroupRef);

  const sourceHelper = useMemo(() => new THREE.SkeletonHelper(sourceClone), [sourceClone]);
  const targetHelper = useMemo(() => new THREE.SkeletonHelper(targetClone), [targetClone]);

  const reportedNamesRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedNamesRef.current) { reportedNamesRef.current = joined; onClipsLoaded?.(names); }
  }, [names, onClipsLoaded]);

  const reportKeyRef = useRef('');
  useEffect(() => {
    const key = `${sourceUrl}|${targetUrl}|${JSON.stringify(customBoneMap)}`;
    if (key === reportKeyRef.current) return;
    reportKeyRef.current = key;
    const srcBones = collectBoneNames(sourceClone);
    const tgtBones = collectBoneNames(targetClone);
    const tgtLookup = createNormalizedBoneLookup(tgtBones);
    const srcLookup = createNormalizedBoneLookup(srcBones);
    const customNorm = new Map<string, string>();
    Object.entries(customBoneMap).forEach(([s, t]) => customNorm.set(normalizeRigName(s), t));
    const matched = srcBones.filter((b) => { const n = normalizeRigName(b); return customNorm.has(n) || tgtLookup.has(n); });
    const unmatchedSrc = srcBones.filter((b) => { const n = normalizeRigName(b); return !customNorm.has(n) && !tgtLookup.has(n); });
    const mappedTgtNames = new Set([...tgtBones.filter((b) => srcLookup.has(normalizeRigName(b))), ...Object.values(customBoneMap)]);
    const unmatchedTgt = tgtBones.filter((b) => !mappedTgtNames.has(b));
    const matchPct = srcBones.length > 0 ? Math.round((matched.length / srcBones.length) * 100) : 0;
    const srcClipCount = ((sourceFbx as any).animations ?? []).length;
    onReportReady?.({
      sourceBoneCount: srcBones.length, targetBoneCount: tgtBones.length,
      matchedBones: matched.length, matchPercent: matchPct,
      unmatchedSourceBones: unmatchedSrc, unmatchedTargetBones: unmatchedTgt,
      sourceClipCount: srcClipCount,
      animationSource: srcClipCount > 0 ? 'source' : tgtBones.length > 0 ? 'target' : 'none',
      allSourceBones: srcBones, allTargetBones: tgtBones,
    });
  }, [sourceUrl, targetUrl, sourceClone, targetClone, (sourceFbx as any).animations, customBoneMap, onReportReady]);

  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[0];
    if (name && actions[name]) actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions, clipName, names]);

  useEffect(() => {
    if (!srcNames.length || !Object.keys(srcActions).length) return;
    Object.values(srcActions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const first = srcNames[0];
    if (first && srcActions[first]) srcActions[first]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [srcActions, srcNames]);

  return (
    <>
      <group position={[-2.0, -1.1 + sourceOffsetY, 0]} visible={showSourceModel}>
        <primitive ref={sourceGroupRef} object={sourceClone} />
        {showSkeleton && <primitive object={sourceHelper} />}
      </group>
      <group position={[2.0, -1.1 + targetOffsetY, 0]}>
        <primitive ref={targetGroupRef} object={targetClone} />
        {showSkeleton && <primitive object={targetHelper} />}
      </group>
      {poseEditMode && <BonePoseEditor targetClone={targetClone} targetOffsetY={targetOffsetY} />}
    </>
  );
};

// ── GLB source + FBX target core ──────────────────────────────────────────────
// Used when SOURCE = hero GLB (gltf/ folder) and TARGET = hero class FBX.
const RigRetargetModelGLBtoFBXCore: React.FC<RigRetargetCoreProps> = ({ sourceUrl, targetUrl, clipName, showSkeleton, showSourceModel, customBoneMap, poseEditMode, onClipsLoaded, onReportReady }) => {
  const sourceGltf = useLoader(GLTFLoader, sourceUrl, configureGltfLoader) as any;
  const targetFbx  = useLoader(FBXLoader,  targetUrl, configureFBXLoader) as THREE.Group;

  const targetGroupRef = useRef<THREE.Group>(null!);
  const sourceGroupRef = useRef<THREE.Group>(null!);

  const { sourceClone, targetClone, sourceOffsetY, targetOffsetY } = useMemo(() => {
    const src = SkeletonUtils.clone(sourceGltf.scene) as THREE.Group;
    src.traverse((node: any) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        node.material = mats.map((mat: THREE.Material) => {
          const m = (mat as THREE.MeshStandardMaterial).clone();
          m.transparent = true; m.opacity = 0.38;
          m.color = new THREE.Color(0x93c5fd);
          return m;
        });
        if (!Array.isArray(node.material)) node.material = (node.material as THREE.Material[])[0];
      }
    });
    const tgt = SkeletonUtils.clone(targetFbx) as THREE.Group;
    tgt.traverse((node: any) => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    });
    const srcBox = new THREE.Box3().setFromObject(src);
    const tgtBox = new THREE.Box3().setFromObject(tgt);
    return {
      sourceClone: src, targetClone: tgt,
      sourceOffsetY: !srcBox.isEmpty() && isFinite(srcBox.min.y) ? -srcBox.min.y : 0,
      targetOffsetY: !tgtBox.isEmpty() && isFinite(tgtBox.min.y) ? -tgtBox.min.y : 0,
    };
  }, [sourceGltf.scene, targetFbx]);

  const allClips = useMemo(() => {
    const srcClips: THREE.AnimationClip[] = sourceGltf.animations ?? [];
    const tgtClips: THREE.AnimationClip[] = (targetFbx as any).animations ?? [];
    if (srcClips.length > 0) return remapClipBindingsToSkeleton({ clips: srcClips, targetModel: targetClone, customBoneMap });
    return tgtClips;
  }, [sourceGltf.animations, (targetFbx as any).animations, targetClone, customBoneMap]);

  const { names, actions } = useAnimations(allClips, targetGroupRef);
  const { names: srcNames, actions: srcActions } = useAnimations(sourceGltf.animations ?? [], sourceGroupRef);
  const sourceHelper = useMemo(() => new THREE.SkeletonHelper(sourceClone), [sourceClone]);
  const targetHelper = useMemo(() => new THREE.SkeletonHelper(targetClone), [targetClone]);

  const reportedNamesRef = useRef('');
  useEffect(() => {
    const joined = names.join('|');
    if (joined !== reportedNamesRef.current) { reportedNamesRef.current = joined; onClipsLoaded?.(names); }
  }, [names, onClipsLoaded]);

  const reportKeyRef = useRef('');
  useEffect(() => {
    const key = `${sourceUrl}|${targetUrl}|${JSON.stringify(customBoneMap)}`;
    if (key === reportKeyRef.current) return;
    reportKeyRef.current = key;
    const srcBones = collectBoneNames(sourceClone);
    const tgtBones = collectBoneNames(targetClone);
    const tgtLookup = createNormalizedBoneLookup(tgtBones);
    const srcLookup = createNormalizedBoneLookup(srcBones);
    const customNorm = new Map<string, string>();
    Object.entries(customBoneMap).forEach(([s, t]) => customNorm.set(normalizeRigName(s), t));
    const matched = srcBones.filter((b) => { const n = normalizeRigName(b); return customNorm.has(n) || tgtLookup.has(n); });
    const unmatchedSrc = srcBones.filter((b) => { const n = normalizeRigName(b); return !customNorm.has(n) && !tgtLookup.has(n); });
    const mappedTgtNames = new Set([...tgtBones.filter((b) => srcLookup.has(normalizeRigName(b))), ...Object.values(customBoneMap)]);
    const unmatchedTgt = tgtBones.filter((b) => !mappedTgtNames.has(b));
    const matchPct = srcBones.length > 0 ? Math.round((matched.length / srcBones.length) * 100) : 0;
    const srcClipCount = (sourceGltf.animations ?? []).length;
    onReportReady?.({
      sourceBoneCount: srcBones.length, targetBoneCount: tgtBones.length,
      matchedBones: matched.length, matchPercent: matchPct,
      unmatchedSourceBones: unmatchedSrc, unmatchedTargetBones: unmatchedTgt,
      sourceClipCount: srcClipCount,
      animationSource: srcClipCount > 0 ? 'source' : tgtBones.length > 0 ? 'target' : 'none',
      allSourceBones: srcBones, allTargetBones: tgtBones,
    });
  }, [sourceUrl, targetUrl, sourceClone, targetClone, sourceGltf.animations, customBoneMap, onReportReady]);

  useEffect(() => {
    if (!names.length || !Object.keys(actions).length) return;
    Object.values(actions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const name = clipName ?? names[0];
    if (name && actions[name]) actions[name]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions, clipName, names]);

  useEffect(() => {
    if (!srcNames.length || !Object.keys(srcActions).length) return;
    Object.values(srcActions).forEach((a) => { try { a?.stop(); } catch (_) {} });
    const first = srcNames[0];
    if (first && srcActions[first]) srcActions[first]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [srcActions, srcNames]);

  return (
    <>
      <group position={[-2.0, -1.1 + sourceOffsetY, 0]} visible={showSourceModel}>
        <primitive ref={sourceGroupRef} object={sourceClone} />
        {showSkeleton && <primitive object={sourceHelper} />}
      </group>
      <group position={[2.0, -1.1 + targetOffsetY, 0]}>
        <primitive ref={targetGroupRef} object={targetClone} />
        {showSkeleton && <primitive object={targetHelper} />}
      </group>
      {poseEditMode && <BonePoseEditor targetClone={targetClone} targetOffsetY={targetOffsetY} />}
    </>
  );
};

// ── Router: chooses core based on sourceIsFbx + targetIsFbx ─────────────────────
const RigRetargetModel: React.FC<RigRetargetCoreProps & { sourceIsFbx?: boolean; targetIsFbx?: boolean }> = ({ sourceIsFbx, targetIsFbx, ...props }) => {
  if (sourceIsFbx && targetIsFbx) return <RigRetargetModelFBXtoFBXCore {...props} />;
  if (sourceIsFbx) return <RigRetargetModelFBXCore {...props} />;
  if (targetIsFbx) return <RigRetargetModelGLBtoFBXCore {...props} />;
  return <RigRetargetModelGLBCore {...props} />;
};

export const DeveloperRigRetargetSceneRenderer: React.FC<DeveloperRigRetargetSceneProps> = ({
  sourceUrl,
  targetUrl,
  clipName,
  showSkeleton = true,
  showSourceModel = true,
  customBoneMap = {},
  sourceIsFbx = false,
  targetIsFbx = false,
  poseEditMode = false,
  onClipsLoaded,
  onReportReady,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 18, 38]} />
        <PerspectiveCamera makeDefault position={[0, 1.8, 10]} fov={44} onUpdate={(c) => c.lookAt(0, 0.4, 0)} />
        <ambientLight intensity={1.1} color="#f8fafc" />
        <hemisphereLight intensity={0.72} color="#e2e8f0" groundColor="#0f172a" />
        <directionalLight position={[-3, 6, 5]} intensity={1.0} color="#f8fafc" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} />
        <pointLight position={[3, 2.8, 2.2]} intensity={0.9} color="#86efac" distance={18} />
        <pointLight position={[-2.8, 2.4, 1.4]} intensity={0.8} color="#a78bfa" distance={16} />

        {/* Floor */}
        <group position={[0, -1.1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[7, 64]} />
            <meshStandardMaterial color="#0f172a" roughness={0.84} metalness={0.06} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[5.2, 6.0, 64]} />
            <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.22} transparent opacity={0.12} side={THREE.DoubleSide} />
          </mesh>
          {/* Divider */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, 9]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.35} />
          </mesh>
        </group>

        {/* Labels */}
        <Html position={[-2.0, 2.1, 0]} center>
          <div className="whitespace-nowrap rounded-full border border-slate-400/30 bg-slate-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300 backdrop-blur-sm">
            Fonte · esqueleto
          </div>
        </Html>
        <Html position={[2.0, 2.1, 0]} center>
          <div className="whitespace-nowrap rounded-full border border-green-400/30 bg-slate-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-green-100 backdrop-blur-sm">
            Alvo · retarget
          </div>
        </Html>

        <Suspense fallback={null}>
          <RigRetargetModel
            key={sourceUrl + '|' + targetUrl}
            sourceUrl={sourceUrl}
            targetUrl={targetUrl}
            clipName={clipName}
            showSkeleton={showSkeleton}
            showSourceModel={showSourceModel}
            customBoneMap={customBoneMap}
            sourceIsFbx={sourceIsFbx}
            targetIsFbx={targetIsFbx}
            poseEditMode={poseEditMode}
            onClipsLoaded={onClipsLoaded}
            onReportReady={onReportReady}
          />
        </Suspense>

        <ContactShadows position={[0, -1.09, 0]} opacity={0.4} scale={10} blur={2.0} far={0.5} resolution={quality.contactShadowResolution} />
        <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={18} target={[0, 0.4, 0]} />
      </Canvas>
    </div>
  );
};
