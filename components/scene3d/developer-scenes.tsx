import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera, TransformControls, useFBX, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
} from './animation';
import {
  DeveloperClassBuilderProbe,
  DeveloperKitbashProbe,
  upsertRuntimeDiagnostic,
} from './developer';
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
  const gltf = useLoader(GLTFLoader, modelUrl) as { scene: THREE.Group };

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
  const source = useFBX(modelUrl);

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
  const sourcePortal = useFBX(modelUrl);
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
          {mistSeeds.map((seed) => (
            <mesh key={`mist-${seed.id}`} position={seed.position}>
              <sphereGeometry args={[seed.scale, 12, 12]} />
              <meshBasicMaterial color="#dbeafe" transparent opacity={opacity * 0.18} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ) : null}

      {particles.dustEnabled ? (
        <group ref={dustRef}>
          {dustSeeds.map((seed) => (
            <mesh key={`dust-${seed.id}`} position={seed.position}>
              <sphereGeometry args={[seed.radius, 8, 8]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={opacity * 0.58} depthWrite={false} />
            </mesh>
          ))}
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
          onDraggingChanged={(event) => {
            const dragging = Boolean(event.value);
            setIsDraggingTransform(dragging);
            if (!dragging) {
              onObjectChange();
            }
          }}
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
        onDraggingChanged={(event) => {
          const dragging = Boolean(event.value);
          setIsDraggingTransform(dragging);
          if (!dragging) {
            onObjectChange();
          }
        }}
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
            onDraggingChanged={(event) => {
              const dragging = Boolean(event.value);
              setIsDraggingTransform(dragging);
              if (!dragging && selectedSceneObjectId) {
                handleSceneObjectObjectChange(selectedSceneObjectId);
              }
            }}
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
            onDraggingChanged={(event) => {
              const dragging = Boolean(event.value);
              setIsDraggingTransform(dragging);
              if (!dragging && selectedHeroSlotClassId) {
                handleHeroSelectionSlotObjectChange(selectedHeroSlotClassId);
              }
            }}
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
