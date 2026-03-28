import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, PerspectiveCamera, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, ArrowRight, Heart, Shield, Star, Swords, WandSparkles, X, Zap } from 'lucide-react';
import { getConstellationByClassId } from '../game/data/classTalents';
import { getScenario } from '../game/data/scenarios';
import { PlayerAnimationAction, PlayerClassDefinition, PlayerClassId } from '../types';
import { hasRuntimeFbxAssets } from './scene3d/animation';
import { AnimatedClassHero } from './scene3d/characters';
import { BattleScenario } from './scene3d/scenarios';
import { DayNightCycle, SkyboxController, getRenderQualityProfile } from './scene3d/environment';

interface ClassSelectionScreenProps {
  classes: PlayerClassDefinition[];
  selectedClassId: PlayerClassId;
  onSelect: (classId: PlayerClassId) => void;
  onConfirm: (classId: PlayerClassId) => void;
  onReady?: () => void;
}

interface SelectionTransitionState {
  classId: PlayerClassId;
  startedAt: number;
}

const SELECTION_CONFIRM_DURATION_MS = 3600;
const SELECTION_INTRO_OVERLAY_MS = 5000;
const DETAILS_PANEL_ANIMATION_MS = 340;

const utf8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

const repairGameText = (value: string) => {
  if (!value || !utf8Decoder || !/[ÃƒÃ¢Ã°]/.test(value)) {
    return value;
  }

  try {
    return utf8Decoder.decode(Uint8Array.from(value, (char) => char.charCodeAt(0)));
  } catch {
    return value;
  }
};

const CLASS_COPY: Record<PlayerClassId, { role: string; summary: string; highlights: string[] }> = {
  knight: {
    role: 'Linha de frente',
    summary: 'Defesa, seguranca e controle do ritmo.',
    highlights: ['Resistente', 'Seguro', 'Bom contra chefes'],
  },
  barbarian: {
    role: 'Dano bruto',
    summary: 'Golpes pesados e burst agressivo.',
    highlights: ['Muito HP', 'Ataque alto', 'Explosivo'],
  },
  mage: {
    role: 'Caster arcano',
    summary: 'Mana alta e magia forte a distancia.',
    highlights: ['Muito MP', 'Magia', 'Escala forte'],
  },
  ranger: {
    role: 'Precisao tatica',
    summary: 'Mobilidade, constancia e foco em alvo.',
    highlights: ['Rapido', 'Equilibrado', 'Foco'],
  },
  rogue: {
    role: 'Burst veloz',
    summary: 'Criticos, velocidade e pressao curta.',
    highlights: ['Muito veloz', 'Critico', 'Burst'],
  },
};

const STAT_ITEMS = [
  { key: 'maxHp', label: 'HP', icon: Heart, color: '#b83a4b', bg: 'rgba(184,58,75,0.14)' },
  { key: 'maxMp', label: 'MP', icon: WandSparkles, color: '#346c7f', bg: 'rgba(52,108,127,0.14)' },
  { key: 'atk', label: 'ATK', icon: Swords, color: '#a35324', bg: 'rgba(163,83,36,0.14)' },
  { key: 'def', label: 'DEF', icon: Shield, color: '#4d6780', bg: 'rgba(77,103,128,0.14)' },
  { key: 'speed', label: 'VEL', icon: Zap, color: '#7c4c76', bg: 'rgba(124,76,118,0.14)' },
  { key: 'luck', label: 'SRT', icon: Star, color: '#b26a2e', bg: 'rgba(178,106,46,0.14)' },
] as const;

const CLASS_ROLE_ICONS: Record<PlayerClassId, React.ComponentType<{ size?: number; className?: string }>> = {
  knight: Shield,
  barbarian: Swords,
  mage: WandSparkles,
  ranger: Star,
  rogue: Zap,
};

const HERO_CLICK_ACTIONS: Record<PlayerClassId, PlayerAnimationAction> = {
  knight: 'item',
  barbarian: 'skill',
  mage: 'skill',
  ranger: 'skill',
  rogue: 'skill',
};

const HERO_STAGE_LAYOUT: Record<PlayerClassId, { position: [number, number, number]; rotationY: number }> = {
  knight: { position: [-7.2, -1.02, -0.7], rotationY: 0.34 },
  barbarian: { position: [-3.6, -1.02, -0.12], rotationY: 0.2 },
  mage: { position: [0, -1.02, 0.14], rotationY: 0.06 },
  ranger: { position: [3.6, -1.02, -0.12], rotationY: -0.2 },
  rogue: { position: [7.2, -1.02, -0.7], rotationY: -0.34 },
};

const getTransitionProgress = (transitionState: SelectionTransitionState | null) => {
  if (!transitionState) {
    return 0;
  }

  return Math.min(1, Math.max(0, (performance.now() - transitionState.startedAt) / SELECTION_CONFIRM_DURATION_MS));
};

const AnimatedSelectionCamera = ({
  focusedClassId,
  detailsClassId,
  transitionState,
}: {
  focusedClassId: PlayerClassId;
  detailsClassId: PlayerClassId | null;
  transitionState: SelectionTransitionState | null;
}) => {
  const { camera, size } = useThree();
  const activeClassId = transitionState?.classId ?? detailsClassId ?? focusedClassId;
  const initialSlot = HERO_STAGE_LAYOUT[activeClassId];
  const lookTargetRef = useRef(new THREE.Vector3(initialSlot.position[0], 0.9, initialSlot.position[2] + 0.18));
  const currentLookTargetRef = useRef(new THREE.Vector3(initialSlot.position[0], 0.9, initialSlot.position[2] + 0.18));
  const detailViewProgressRef = useRef(0);

  useFrame(() => {
    const isMobile = size.width < 768;
    const layout = HERO_STAGE_LAYOUT[activeClassId];
    const [heroX, , heroZ] = layout.position;
    const targetDetailProgress = detailsClassId ? 1 : 0;
    detailViewProgressRef.current = THREE.MathUtils.lerp(detailViewProgressRef.current, targetDetailProgress, 0.08);
    const detailProgress = detailViewProgressRef.current;
    const transitionProgress = transitionState
      ? THREE.MathUtils.smootherstep(getTransitionProgress(transitionState), 0, 1)
      : 0;
    const defaultPosition = new THREE.Vector3(
      heroX * (isMobile ? 0.5 : 0.4),
      isMobile ? 2.5 : 2.42,
      (isMobile ? 11.9 : 10.9) + Math.abs(heroX) * 0.05 + Math.max(0, -heroZ) * 0.2,
    );
    const confirmPosition = new THREE.Vector3(
      heroX * (isMobile ? 0.42 : 0.34),
      isMobile ? 2.34 : 2.28,
      isMobile ? 7.9 : 7.1,
    );
    const detailPosition = new THREE.Vector3(
      heroX * (isMobile ? 0.34 : 0.3),
      isMobile ? 1.84 : 2.62,
      isMobile ? 7.55 : 6.55,
    );
    const targetPosition = defaultPosition
      .lerp(confirmPosition, transitionProgress)
      .lerp(detailPosition, detailProgress * (1 - transitionProgress));

    const defaultLook = new THREE.Vector3(
      heroX,
      isMobile ? 0.98 : 0.92,
      heroZ + 0.18,
    );
    const confirmLook = new THREE.Vector3(heroX, isMobile ? 1.35 : 1.28, heroZ + 0.28);
    const detailLook = new THREE.Vector3(heroX + (isMobile ? 0 : 0.52), isMobile ? 0.82 : 1.08, heroZ + 0.14);
    const targetLook = defaultLook
      .lerp(confirmLook, transitionProgress)
      .lerp(detailLook, detailProgress * (1 - transitionProgress));

    lookTargetRef.current.copy(targetLook);
    camera.position.lerp(targetPosition, transitionState ? 0.03 : isMobile ? 0.08 : 0.055);
    currentLookTargetRef.current.lerp(lookTargetRef.current, transitionState ? 0.03 : isMobile ? 0.08 : 0.055);
    camera.lookAt(currentLookTargetRef.current);
  });

  return null;
};

const applyMeshOpacity = (group: THREE.Object3D, opacity: number) => {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material) {
        return;
      }

      const typedMaterial = material as THREE.Material & { opacity: number; transparent: boolean; userData: Record<string, unknown> };
      const baseOpacity = typeof typedMaterial.userData.baseOpacity === 'number' ? typedMaterial.userData.baseOpacity as number : typedMaterial.opacity;
      typedMaterial.userData.baseOpacity = baseOpacity;
      typedMaterial.transparent = opacity < 0.999 || baseOpacity < 0.999;
      typedMaterial.opacity = baseOpacity * opacity;
      typedMaterial.needsUpdate = true;
    });
  });
};

const StageHero = ({
  playerClass,
  focused,
  selected,
  detailsClassId,
  transitionState,
  onFocus,
  onActivate,
}: {
  playerClass: PlayerClassDefinition;
  focused: boolean;
  selected: boolean;
  detailsClassId: PlayerClassId | null;
  transitionState: SelectionTransitionState | null;
  onFocus: () => void;
  onActivate: () => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const heroRef = useRef<THREE.Group>(null);
  const runtimeAssets = hasRuntimeFbxAssets(playerClass.assets) ? playerClass.assets : null;
  const stageSlot = HERO_STAGE_LAYOUT[playerClass.id];
  const auraColor = playerClass.visualProfile.auraColor;
  const RoleIcon = CLASS_ROLE_ICONS[playerClass.id];
  const [ambientAction, setAmbientAction] = useState<PlayerAnimationAction>('idle');
  const [isHovered, setIsHovered] = useState(false);
  const interactionLockRef = useRef(false);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);

  const clearInteractionTimers = useCallback(() => {
    if (cooldownTimeoutRef.current !== null) {
      window.clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const triggerInteractionAction = useCallback(() => {
    if (interactionLockRef.current) {
      return;
    }

    interactionLockRef.current = true;
    const nextAction = HERO_CLICK_ACTIONS[playerClass.id] ?? 'item';
    const holdDuration = nextAction === 'item' ? 1050 : 1320;

    setAmbientAction(nextAction);

    resetTimeoutRef.current = window.setTimeout(() => {
      setAmbientAction('idle');
    }, holdDuration);

    cooldownTimeoutRef.current = window.setTimeout(() => {
      interactionLockRef.current = false;
    }, holdDuration + 320);
  }, [playerClass.id]);

  useEffect(() => {
    return () => {
      clearInteractionTimers();
      interactionLockRef.current = false;
      setAmbientAction('idle');
    };
  }, [clearInteractionTimers]);

  useFrame((state) => {
    if (!groupRef.current || !heroRef.current) {
      return;
    }

    const isDetailsOpen = detailsClassId !== null;
    const isDetailsTarget = detailsClassId === playerClass.id;
    const transitionProgress = transitionState
      ? THREE.MathUtils.smootherstep(getTransitionProgress(transitionState), 0, 1)
      : 0;
    const isConfirmingHero = transitionState?.classId === playerClass.id;
    const bob = Math.sin(state.clock.elapsedTime * 1.6 + stageSlot.position[0] * 0.2) * 0.045;
    const highlightLift = focused || selected ? 0.18 : 0;
    const defaultScale = selected ? 1.12 : focused ? 1.06 : 0.98;
    const detailsScale = isDetailsTarget ? 1.2 : 0.92;
    const targetX = stageSlot.position[0];
    const targetY = stageSlot.position[1] + highlightLift + bob + (isConfirmingHero ? transitionProgress * 0.12 : 0);
    const targetZ = stageSlot.position[2];
    const targetScaleWithoutTransition = isDetailsOpen ? detailsScale : defaultScale;
    const targetScale = isConfirmingHero
      ? THREE.MathUtils.lerp(defaultScale, 1.12, transitionProgress)
      : transitionState
        ? THREE.MathUtils.lerp(defaultScale, 0.92, transitionProgress)
        : targetScaleWithoutTransition;
    const targetOpacityWithoutTransition = isDetailsOpen
      ? isDetailsTarget
        ? 1
        : 0
      : 1;
    const targetOpacity = transitionState
      ? isConfirmingHero
        ? 1 - Math.max(0, (transitionProgress - 0.72) / 0.28)
        : Math.max(0, 1 - transitionProgress * 1.6)
      : targetOpacityWithoutTransition;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, transitionState ? 0.05 : 0.08);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, transitionState ? 0.05 : 0.08);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, transitionState ? 0.05 : 0.08);
    groupRef.current.visible = targetOpacity > 0.01;
    heroRef.current.rotation.y = THREE.MathUtils.lerp(
      heroRef.current.rotation.y,
      stageSlot.rotationY + (focused || selected ? 0.05 : 0),
      transitionState ? 0.05 : 0.08,
    );
    heroRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), transitionState ? 0.05 : 0.08);
    applyMeshOpacity(groupRef.current, targetOpacity);
  });

  if (!runtimeAssets) {
    return null;
  }

  return (
    <group
      ref={groupRef}
      position={stageSlot.position}
      onPointerEnter={(event) => {
        event.stopPropagation();
        if (detailsClassId && detailsClassId !== playerClass.id) {
          return;
        }
        setIsHovered(true);
        onFocus();
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        setIsHovered(false);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (detailsClassId && detailsClassId !== playerClass.id) {
          return;
        }
        onFocus();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (detailsClassId && detailsClassId !== playerClass.id) {
          return;
        }
        onFocus();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (detailsClassId && detailsClassId !== playerClass.id) {
          return;
        }
        triggerInteractionAction();
        onActivate();
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.05, 1.42, 40]} />
        <meshStandardMaterial
          color={auraColor}
          emissive={auraColor}
          emissiveIntensity={selected ? 1.35 : focused ? 0.95 : 0.45}
          transparent
          opacity={selected ? 0.72 : focused ? 0.54 : 0.26}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.08, 40]} />
        <meshStandardMaterial color="#d8c7a7" transparent opacity={0.78} />
      </mesh>

      <mesh
        position={[0, 1.92, 0.7]}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (detailsClassId && detailsClassId !== playerClass.id) {
            return;
          }
          onFocus();
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          if (detailsClassId && detailsClassId !== playerClass.id) {
            return;
          }
          onFocus();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (detailsClassId && detailsClassId !== playerClass.id) {
            return;
          }
          onFocus();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (detailsClassId && detailsClassId !== playerClass.id) {
            return;
          }
          triggerInteractionAction();
          onActivate();
        }}
      >
        <planeGeometry args={[4.4, 6.2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group ref={heroRef} rotation={[0, stageSlot.rotationY, 0]}>
        <Suspense fallback={null}>
          <AnimatedClassHero assets={runtimeAssets} animationAction={ambientAction} />
        </Suspense>
      </group>

      {(focused || selected) && !selected && !detailsClassId && (
        <Html position={[0, 3.02, 0.22]} center distanceFactor={10.6}>
          <div
            className="min-w-[10.5rem] rounded-[20px] border px-3 py-2 text-white shadow-[0_14px_32px_rgba(0,0,0,0.28)] backdrop-blur-md"
            style={{
              borderColor: selected ? `${auraColor}88` : `${auraColor}55`,
              background: selected
                ? `linear-gradient(135deg, rgba(10,26,14,0.94), ${auraColor}40, rgba(10,26,14,0.92))`
                : `linear-gradient(135deg, rgba(10,26,14,0.88), ${auraColor}2a, rgba(10,26,14,0.86))`,
              boxShadow: `0 14px 32px rgba(0,0,0,0.28), 0 0 0 1px ${auraColor}22`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-[12px] border text-white"
                style={{
                  borderColor: `${auraColor}88`,
                  background: `linear-gradient(180deg, ${auraColor}66 0%, rgba(255,255,255,0.08) 100%)`,
                }}
              >
                <RoleIcon size={15} />
              </span>
              <div className="min-w-0">
                <div className="font-gamer text-[17px] font-black leading-none">{playerClass.name}</div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/72">
                  {CLASS_COPY[playerClass.id].role}
                </div>
              </div>
            </div>
            <div className="mt-2 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, ${auraColor} 0%, rgba(255,255,255,0.2) 100%)` }} />
          </div>
        </Html>
      )}
    </group>
  );
};

const ForestSelectionScene = ({
  classes,
  focusedClassId,
  selectedClassId,
  detailsClassId,
  transitionState,
  onFocusClass,
  onSelectClass,
  onSceneReady,
}: {
  classes: PlayerClassDefinition[];
  focusedClassId: PlayerClassId;
  selectedClassId: PlayerClassId | null;
  detailsClassId: PlayerClassId | null;
  transitionState: SelectionTransitionState | null;
  onFocusClass: (classId: PlayerClassId) => void;
  onSelectClass: (classId: PlayerClassId) => void;
  onSceneReady?: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const scenario = useMemo(() => getScenario('forest'), []);
  const handleTimeUpdate = useCallback(() => {}, []);

  const SceneReadyProbe = ({ onReady }: { onReady?: () => void }) => {
    const { active } = useProgress();
    const readySentRef = useRef(false);

    useEffect(() => {
      if (!onReady || readySentRef.current || active) {
        return;
      }

      readySentRef.current = true;
      const timer = window.setTimeout(() => onReady(), 120);
      return () => window.clearTimeout(timer);
    }, [active, onReady]);

    return null;
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        <PerspectiveCamera makeDefault position={[0, 2.62, 17.2]} fov={33} rotation={[-0.075, 0, 0]} />
        <AnimatedSelectionCamera focusedClassId={focusedClassId} detailsClassId={detailsClassId} transitionState={transitionState} />
        <SceneReadyProbe onReady={onSceneReady} />
        <SkyboxController />
        <fog attach="fog" args={['#d7e6c2', 16, 46]} />
        <DayNightCycle containerRef={containerRef} onTimeUpdate={handleTimeUpdate} quality={quality} />

        <Suspense fallback={null}>
          <BattleScenario scenario={scenario} lowQuality={quality.isLowQuality} />
        </Suspense>

        <ambientLight intensity={0.6} />
        <hemisphereLight intensity={0.5} groundColor="#243a20" color="#f4ffe6" />
        <ContactShadows position={[0, -1.04, -0.2]} opacity={0.42} scale={30} blur={2.8} far={12} resolution={quality.contactShadowResolution} />

        {classes.map((playerClass) => (
          <StageHero
            key={playerClass.id}
            playerClass={playerClass}
            focused={focusedClassId === playerClass.id}
            selected={selectedClassId === playerClass.id}
            detailsClassId={detailsClassId}
            transitionState={transitionState}
            onFocus={() => onFocusClass(playerClass.id)}
            onActivate={() => onSelectClass(playerClass.id)}
          />
        ))}
      </Canvas>
    </div>
  );
};

const QuickHeroCard = ({
  playerClass,
  isVisible,
  onClose,
  onConfirm,
}: {
  playerClass: PlayerClassDefinition;
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (classId: PlayerClassId) => void;
}) => {
  const classCopy = CLASS_COPY[playerClass.id];
  const constellation = getConstellationByClassId(playerClass.id);
  const RoleIcon = CLASS_ROLE_ICONS[playerClass.id];
  const actionColor = playerClass.visualProfile.auraColor;
  const actionBorderColor = playerClass.visualProfile.secondaryColor;

  return (
    <>
      <div
        className={`absolute inset-0 z-[130] overflow-y-auto md:hidden transition-all duration-300 ease-out ${isVisible ? 'bg-black/20 opacity-100' : 'bg-black/0 opacity-0 pointer-events-none'}`}
      >
        <div className="min-h-[62dvh]" />
        <div className={`origin-bottom rounded-t-[26px] border border-b-0 border-[#cfab91]/90 bg-[linear-gradient(180deg,rgba(255,249,242,0.98)_0%,rgba(247,236,221,0.98)_38%,rgba(242,223,203,0.98)_100%)] shadow-[0_-22px_56px_rgba(54,26,33,0.22)] backdrop-blur-sm transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-14 scale-[0.98] opacity-0'}`}>
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#b78f78]/45" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Heroi escolhido</div>
              <div className="mt-1 flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-[14px] border text-white shadow-[0_10px_20px_rgba(107,49,65,0.12)]"
                  style={{
                    borderColor: `${playerClass.visualProfile.auraColor}55`,
                    background: `linear-gradient(180deg, ${playerClass.visualProfile.auraColor} 0%, ${playerClass.visualProfile.secondaryColor} 100%)`,
                  }}
                >
                  <RoleIcon size={20} />
                </span>
                <div className="font-gamer text-2xl font-black text-[#6b3141]">{playerClass.name}</div>
              </div>
              <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-[#8a5a57]">{repairGameText(playerClass.title)}</div>
            </div>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#fff8f1] text-[#6b3141] transition-colors hover:bg-[#f7ecdd]"
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="mt-4 rounded-[24px] border px-4 py-3"
            style={{
              borderColor: `${playerClass.visualProfile.auraColor}33`,
              background: `linear-gradient(135deg, ${playerClass.visualProfile.auraColor}12 0%, rgba(255,248,241,0.92) 58%, rgba(255,255,255,0.8) 100%)`,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#d6b9a3] bg-[#fff8f1] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
                {classCopy.role}
              </span>
              <span
                className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{
                  borderColor: `${constellation.resource.color}44`,
                  color: constellation.resource.color,
                  backgroundColor: `${constellation.resource.color}14`,
                }}
              >
                {repairGameText(constellation.resource.name)}
              </span>
              {classCopy.highlights.map((highlight) => (
                <span key={`${playerClass.id}-${highlight}`} className="rounded-full border border-[#d6b9a3] bg-[#f7ecdd] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
                  {highlight}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm leading-relaxed text-[#7f5b56]">{classCopy.summary}</p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {STAT_ITEMS.map(({ key, label, icon: Icon, color, bg }) => (
                <div key={`${playerClass.id}-${key}`} className="rounded-[18px] border border-[#dcc0aa] bg-[#fffdf9] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ color, backgroundColor: bg }}>
                      <Icon size={14} />
                    </span>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a7068]">{label}</div>
                      <div className="text-sm font-black text-[#6b3141]">{playerClass.baseStats[key]}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[22px] border border-[#dcc0aa] bg-[#fff8f1] px-4 py-3 text-sm text-[#7f5b56]">
              {repairGameText(playerClass.description)}
            </div>

            <div
              className="mt-3 rounded-[24px] border px-4 py-4"
              style={{
                borderColor: `${constellation.resource.color}44`,
                background: `linear-gradient(135deg, ${constellation.resource.color}14 0%, rgba(255,250,244,0.98) 100%)`,
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Trilhas da classe</div>
              <div className="mt-3 grid gap-2">
                {constellation.trails.map((trail) => (
                  <div
                    key={trail.id}
                    className="rounded-[18px] border px-3 py-3"
                    style={{
                      borderColor: `${trail.color}44`,
                      background: `linear-gradient(180deg, ${trail.color}18 0%, rgba(255,255,255,0.88) 100%)`,
                      boxShadow: `inset 0 0 0 1px ${trail.color}18`,
                    }}
                  >
                    <div
                      className="text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{ color: trail.color }}
                    >
                      Trilha
                    </div>
                    <div className="mt-1 font-gamer text-lg font-black text-[#6b3141]">
                      {repairGameText(trail.name)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onConfirm(playerClass.id)}
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] border-b-4 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-105 active:translate-y-0.5 active:border-b-0"
              style={{
                backgroundColor: actionColor,
                borderColor: actionBorderColor,
                boxShadow: `0 10px 22px ${actionColor}30`,
              }}
            >
              Confirmar heroi
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      </div>

      <div className={`absolute bottom-6 right-4 top-8 z-[130] hidden w-[min(560px,42vw)] origin-right overflow-hidden rounded-[32px] border border-[#cfab91] bg-[linear-gradient(180deg,rgba(255,249,242,0.98)_0%,rgba(247,236,221,0.98)_38%,rgba(242,223,203,0.98)_100%)] p-6 shadow-[0_30px_64px_rgba(54,26,33,0.22)] backdrop-blur-sm transition-all duration-300 ease-out md:flex md:flex-col ${isVisible ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-12 scale-[0.97] opacity-0 pointer-events-none'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Heroi escolhido</div>
            <div className="mt-1 flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[14px] border text-white shadow-[0_10px_20px_rgba(107,49,65,0.12)]"
                style={{
                  borderColor: `${playerClass.visualProfile.auraColor}55`,
                  background: `linear-gradient(180deg, ${playerClass.visualProfile.auraColor} 0%, ${playerClass.visualProfile.secondaryColor} 100%)`,
                }}
              >
                <RoleIcon size={20} />
              </span>
              <div className="font-gamer text-2xl font-black text-[#6b3141]">{playerClass.name}</div>
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-[#8a5a57]">{repairGameText(playerClass.title)}</div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6b9a3] bg-[#fff8f1] text-[#6b3141] transition-colors hover:bg-[#f7ecdd]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <div
            className="rounded-[24px] border px-4 py-3"
            style={{
              borderColor: `${playerClass.visualProfile.auraColor}33`,
              background: `linear-gradient(135deg, ${playerClass.visualProfile.auraColor}12 0%, rgba(255,248,241,0.92) 58%, rgba(255,255,255,0.8) 100%)`,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#d6b9a3] bg-[#fff8f1] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
                {classCopy.role}
              </span>
              <span
                className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{
                  borderColor: `${constellation.resource.color}44`,
                  color: constellation.resource.color,
                  backgroundColor: `${constellation.resource.color}14`,
                }}
              >
                {repairGameText(constellation.resource.name)}
              </span>
              {classCopy.highlights.map((highlight) => (
                <span key={`${playerClass.id}-${highlight}`} className="rounded-full border border-[#d6b9a3] bg-[#f7ecdd] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b3141]">
                  {highlight}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm leading-relaxed text-[#7f5b56]">{classCopy.summary}</p>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {STAT_ITEMS.map(({ key, label, icon: Icon, color, bg }) => (
                <div key={`${playerClass.id}-${key}`} className="rounded-[18px] border border-[#dcc0aa] bg-[#fffdf9] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ color, backgroundColor: bg }}>
                      <Icon size={14} />
                    </span>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a7068]">{label}</div>
                      <div className="text-sm font-black text-[#6b3141]">{playerClass.baseStats[key]}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[22px] border border-[#dcc0aa] bg-[#fff8f1] px-4 py-3 text-sm text-[#7f5b56]">
              {repairGameText(playerClass.description)}
            </div>

            <div
              className="mt-3 rounded-[24px] border px-4 py-4"
              style={{
                borderColor: `${constellation.resource.color}44`,
                background: `linear-gradient(135deg, ${constellation.resource.color}14 0%, rgba(255,250,244,0.98) 100%)`,
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7068]">Trilhas da classe</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {constellation.trails.map((trail) => (
                  <div
                    key={trail.id}
                    className="rounded-[18px] border px-3 py-3"
                    style={{
                      borderColor: `${trail.color}44`,
                      background: `linear-gradient(180deg, ${trail.color}18 0%, rgba(255,255,255,0.88) 100%)`,
                      boxShadow: `inset 0 0 0 1px ${trail.color}18`,
                    }}
                  >
                    <div
                      className="text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{ color: trail.color }}
                    >
                      Trilha
                    </div>
                    <div className="mt-1 font-gamer text-lg font-black text-[#6b3141]">
                      {repairGameText(trail.name)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onConfirm(playerClass.id)}
          className="mt-4 inline-flex min-h-14 items-center justify-center gap-2 rounded-[16px] border-b-4 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-105 active:translate-y-0.5 active:border-b-0"
          style={{
            backgroundColor: actionColor,
            borderColor: actionBorderColor,
            boxShadow: `0 10px 22px ${actionColor}30`,
          }}
        >
          Confirmar heroi
          <ArrowRight size={18} />
        </button>
      </div>
    </>
  );
};

export const ClassSelectionScreen: React.FC<ClassSelectionScreenProps> = ({
  classes,
  selectedClassId,
  onSelect,
  onConfirm,
  onReady,
}) => {
  const classOrder = useMemo(() => classes.map((playerClass) => playerClass.id), [classes]);
  const initialClassId = classOrder[Math.floor(classOrder.length / 2)] ?? selectedClassId ?? classes[0]?.id;
  const [focusedClassId, setFocusedClassId] = useState<PlayerClassId>(initialClassId);
  const [openClassId, setOpenClassId] = useState<PlayerClassId | null>(null);
  const [detailsPanelClassId, setDetailsPanelClassId] = useState<PlayerClassId | null>(null);
  const [isDetailsPanelVisible, setIsDetailsPanelVisible] = useState(false);
  const [transitionState, setTransitionState] = useState<SelectionTransitionState | null>(null);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const dragStateRef = useRef<{ pointerType: string | null; startX: number; lastTouchX: number; active: boolean }>({
    pointerType: null,
    startX: 0,
    lastTouchX: 0,
    active: false,
  });
  const confirmTimeoutRef = useRef<number | null>(null);
  const detailsPanelTimeoutRef = useRef<number | null>(null);

  const selectedClass = useMemo(
    () => classes.find((playerClass) => playerClass.id === detailsPanelClassId) ?? null,
    [classes, detailsPanelClassId],
  );

  const focusClassByIndex = useCallback((index: number) => {
    if (classOrder.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(classOrder.length - 1, index));
    setFocusedClassId(classOrder[safeIndex]);
  }, [classOrder]);

  const focusAdjacentClass = useCallback((direction: -1 | 1) => {
    const currentIndex = Math.max(0, classOrder.indexOf(focusedClassId));
    focusClassByIndex(currentIndex + direction);
  }, [classOrder, focusClassByIndex, focusedClassId]);

  const moveFocus = useCallback((direction: -1 | 1) => {
    if (transitionState) {
      return;
    }

    if (classOrder.length === 0) {
      return;
    }

    const currentIndex = Math.max(0, classOrder.indexOf(focusedClassId));
    const nextIndex = Math.max(0, Math.min(classOrder.length - 1, currentIndex + direction));
    const nextClassId = classOrder[nextIndex];

    setFocusedClassId(nextClassId);
    onSelect(nextClassId);
  }, [classOrder, focusedClassId, onSelect, transitionState]);

  const beginConfirmTransition = useCallback((classId: PlayerClassId) => {
    if (transitionState) {
      return;
    }

    const startedAt = performance.now();
    setFocusedClassId(classId);
    setOpenClassId(null);
    setTransitionState({ classId, startedAt });
    onSelect(classId);

    confirmTimeoutRef.current = window.setTimeout(() => {
      onConfirm(classId);
    }, SELECTION_CONFIRM_DURATION_MS);
  }, [onConfirm, onSelect, transitionState]);

  useEffect(() => () => {
    if (confirmTimeoutRef.current !== null) {
      window.clearTimeout(confirmTimeoutRef.current);
    }
    if (detailsPanelTimeoutRef.current !== null) {
      window.clearTimeout(detailsPanelTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (detailsPanelTimeoutRef.current !== null) {
      window.clearTimeout(detailsPanelTimeoutRef.current);
      detailsPanelTimeoutRef.current = null;
    }

    if (openClassId) {
      setDetailsPanelClassId(openClassId);
      const timer = window.setTimeout(() => {
        setIsDetailsPanelVisible(true);
      }, 28);

      return () => {
        window.clearTimeout(timer);
      };
    }

    setIsDetailsPanelVisible(false);
    detailsPanelTimeoutRef.current = window.setTimeout(() => {
      setDetailsPanelClassId(null);
    }, DETAILS_PANEL_ANIMATION_MS);

    return () => {
      if (detailsPanelTimeoutRef.current !== null) {
        window.clearTimeout(detailsPanelTimeoutRef.current);
        detailsPanelTimeoutRef.current = null;
      }
    };
  }, [openClassId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowIntroOverlay(false);
    }, SELECTION_INTRO_OVERLAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className="absolute inset-0 z-[120] overflow-hidden bg-black text-white pointer-events-auto"
      onPointerDown={(event) => {
        if (transitionState) {
          return;
        }
        dragStateRef.current = {
          pointerType: event.pointerType,
          startX: event.clientX,
          lastTouchX: event.clientX,
          active: event.pointerType !== 'mouse',
        };
      }}
      onPointerMove={(event) => {
        if (transitionState) {
          return;
        }

        if (!dragStateRef.current.active || event.pointerType !== 'touch') {
          return;
        }

        const delta = event.clientX - dragStateRef.current.lastTouchX;
        if (Math.abs(delta) < 44) {
          return;
        }

        focusAdjacentClass(delta > 0 ? -1 : 1);
        dragStateRef.current.lastTouchX = event.clientX;
      }}
      onPointerUp={() => {
        dragStateRef.current.active = false;
      }}
      onPointerCancel={() => {
        dragStateRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragStateRef.current.active = false;
      }}
    >
      <style>{`
        @keyframes selection-fade-out {
          0% { opacity: 0; }
          58% { opacity: 0.02; }
          100% { opacity: 1; }
        }
      `}</style>
      <ForestSelectionScene
        classes={classes}
        focusedClassId={focusedClassId}
        selectedClassId={openClassId}
        detailsClassId={detailsPanelClassId}
        transitionState={transitionState}
        onSceneReady={onReady}
        onFocusClass={setFocusedClassId}
        onSelectClass={(classId) => {
          if (transitionState) {
            return;
          }

          setFocusedClassId(classId);
          setOpenClassId(classId);
          onSelect(classId);
        }}
      />

      {!transitionState && !selectedClass && (
        <div className="absolute inset-x-0 bottom-22 z-[130] flex items-center justify-between px-4 md:hidden">
        <button
          onClick={() => moveFocus(-1)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/16 bg-[#112214]/62 text-white shadow-[0_16px_32px_rgba(0,0,0,0.24)] backdrop-blur-md transition-colors hover:bg-[#183019]/76 disabled:opacity-40"
          disabled={classOrder.indexOf(focusedClassId) <= 0}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="pointer-events-none rounded-full border border-white/14 bg-[#112214]/58 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/74 shadow-[0_14px_30px_rgba(0,0,0,0.2)] backdrop-blur-md">
          Navegar herois
        </div>

        <button
          onClick={() => moveFocus(1)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/16 bg-[#112214]/62 text-white shadow-[0_16px_32px_rgba(0,0,0,0.24)] backdrop-blur-md transition-colors hover:bg-[#183019]/76 disabled:opacity-40"
          disabled={classOrder.indexOf(focusedClassId) >= classOrder.length - 1}
        >
          <ArrowRight size={20} />
        </button>
        </div>
      )}

      {!transitionState && !selectedClass && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-[130] -translate-x-1/2 rounded-full border border-white/14 bg-[#112214]/56 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/72 shadow-[0_16px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
          Arraste para os lados ou clique em um aventureiro
        </div>
      )}

      {!transitionState && selectedClass && (
        <QuickHeroCard
          playerClass={selectedClass}
          isVisible={isDetailsPanelVisible}
          onClose={() => setOpenClassId(null)}
          onConfirm={(classId) => {
            beginConfirmTransition(classId);
          }}
        />
      )}

      {transitionState && (
        <div
          className="pointer-events-none absolute inset-0 z-[150]"
          style={{
            animation: `selection-fade-out ${SELECTION_CONFIRM_DURATION_MS}ms ease-in forwards`,
            background: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, rgba(8,12,10,0.22) 38%, rgba(4,6,5,0.92) 100%)',
          }}
        />
      )}

      {showIntroOverlay && (
        <div className="absolute inset-0 z-[170] pointer-events-auto flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(6,10,8,0.42)_0%,rgba(4,7,6,0.72)_42%,rgba(3,5,4,0.9)_100%)] backdrop-blur-[2px]">
          <div className="px-6 text-center animate-fade-in-down">
            <h1 className="font-gamer text-5xl sm:text-7xl font-black tracking-tight text-white drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]">HERO ADVENTURE</h1>
            <p className="mt-4 text-[11px] sm:text-sm font-black uppercase tracking-[0.28em] text-emerald-100/85">Preparando arena e aventureiros</p>
            <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-full bg-[linear-gradient(90deg,#22d3ee_0%,#60a5fa_55%,#a78bfa_100%)] animate-[loadingPulse_1.4s_ease-in-out_infinite]" />
            </div>
          </div>
          <style>{`
            @keyframes loadingPulse {
              0%, 100% { transform: scaleX(0.7); opacity: 0.68; }
              50% { transform: scaleX(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};
