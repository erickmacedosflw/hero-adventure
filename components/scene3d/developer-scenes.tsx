import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerAnimationAction, PlayerClassAssets, PlayerClassId } from '../../types';
import { getPlayerClassById } from '../../game/data/classes';
import { EquippedWeaponAttachment } from './weapons';
import {
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
