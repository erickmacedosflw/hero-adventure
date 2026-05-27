import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, Html, PerspectiveCamera } from '@react-three/drei';
import { DepthOfField, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ArrowLeft, ArrowRight, Crosshair, Heart, Shield, Star, Swords, WandSparkles, X, Zap } from 'lucide-react';
import { getConstellationByClassId } from '../game/data/classTalents';
import { getRuntimeScenarioPreset } from '../game/data/runtimeScenarios';
import { PlayerAnimationAction, PlayerClassDefinition, PlayerClassId, WeaponGripType } from '../types';
import { BattleHero2D } from './scene3d/BattleHero2D';
import { SkyboxController, getDefaultRenderQualityPreset, getRenderPlatform, getRenderPowerPreference, getRenderQualityProfile } from './scene3d/environment';
import { configureGltfLoader } from './scene3d/gltfLoader';
import { onAction } from '../game/mechanics/inputManager';
import { useInputMode } from '../game/hooks/useInputMode';
import { GamepadActionLegend } from './ui/GamepadActionLegend';

interface ClassSelectionScreenProps {
  classes: PlayerClassDefinition[];
  selectedClassId: PlayerClassId;
  onSelect: (classId: PlayerClassId) => void;
  onConfirm: (classId: PlayerClassId) => void;
  onBack?: () => void;
  onReady?: () => void;
}

interface SelectionTransitionState {
  classId: PlayerClassId;
  startedAt: number;
}

const SELECTION_CONFIRM_DURATION_MS = 3600;
const SELECTION_INTRO_OVERLAY_MS = 5000;
const DETAILS_PANEL_ANIMATION_MS = 340;
const CLASS_SELECTION_LOGO_URL = new URL('../game/assets/Imagens/Logo_Hero_Tower.png', import.meta.url).href;

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

const CLASS_NAME_PT: Record<PlayerClassId, string> = {
  knight: 'Cavaleiro',
  barbarian: 'Barbaro',
  mage: 'Mago',
  ranger: 'Arqueiro',
  rogue: 'Ladino',
};

const WEAPON_PROFICIENCY_META: Record<WeaponGripType, { label: string; icon: string }> = {
  dagger: { label: 'Punhal', icon: '🗡️' },
  sword: { label: 'Espada', icon: '⚔️' },
  axe: { label: 'Machado', icon: '🪓' },
  hammer: { label: 'Martelo', icon: '🔨' },
  wand: { label: 'Varinha', icon: '🪄' },
  staff: { label: 'Cajado', icon: '🔮' },
  spear: { label: 'Lanca', icon: '🔱' },
  halberd: { label: 'Alabarda', icon: '🛡️' },
  bow: { label: 'Arco', icon: '🏹' },
  fist: { label: 'Manopla', icon: '🥊' },
};

const STAT_ITEMS = [
  { key: 'maxHp', label: 'HP', icon: Heart, color: '#22c55e', bg: 'rgba(34,197,94,0.16)' },
  { key: 'maxMp', label: 'MP', icon: WandSparkles, color: '#38bdf8', bg: 'rgba(56,189,248,0.16)' },
  { key: 'atk', label: 'ATK', icon: Swords, color: '#ef4444', bg: 'rgba(239,68,68,0.16)' },
  { key: 'magic', label: 'MAG', icon: WandSparkles, color: '#a855f7', bg: 'rgba(168,85,247,0.16)' },
  { key: 'def', label: 'DEF', icon: Shield, color: '#f97316', bg: 'rgba(249,115,22,0.16)' },
  { key: 'magicDef', label: 'D.MAG', icon: Shield, color: '#3b82f6', bg: 'rgba(59,130,246,0.16)' },
  { key: 'speed', label: 'VEL', icon: Zap, color: '#22c55e', bg: 'rgba(34,197,94,0.16)' },
  { key: 'luck', label: 'SRT', icon: Star, color: '#fbbf24', bg: 'rgba(251,191,36,0.16)' },
] as const;

const CLASS_ROLE_ICONS: Record<PlayerClassId, React.ComponentType<{ size?: number; className?: string }>> = {
  knight: Shield,
  barbarian: Swords,
  mage: WandSparkles,
  ranger: Crosshair,
  rogue: Zap,
};

const HERO_CLICK_ACTIONS: Record<PlayerClassId, PlayerAnimationAction> = {
  knight: 'item',
  barbarian: 'skill',
  mage: 'skill',
  ranger: 'skill',
  rogue: 'skill',
};

type HeroStageLayout = Record<PlayerClassId, { position: [number, number, number]; rotationY: number }>;

const DEFAULT_HERO_STAGE_LAYOUT: HeroStageLayout = {
  knight: { position: [-7.2, -1.02, -0.7], rotationY: 0.34 },
  barbarian: { position: [-3.6, -1.02, -0.12], rotationY: 0.2 },
  mage: { position: [0, -1.02, 0.14], rotationY: 0.06 },
  ranger: { position: [3.6, -1.02, -0.12], rotationY: -0.2 },
  rogue: { position: [7.2, -1.02, -0.7], rotationY: -0.34 },
};

const buildHeroStageLayout = (
  heroSelectionSlots?: Array<{ classId: PlayerClassId; position: [number, number, number]; rotationY: number }>,
): HeroStageLayout => {
  const layout: HeroStageLayout = {
    knight: { ...DEFAULT_HERO_STAGE_LAYOUT.knight, position: [...DEFAULT_HERO_STAGE_LAYOUT.knight.position] as [number, number, number] },
    barbarian: { ...DEFAULT_HERO_STAGE_LAYOUT.barbarian, position: [...DEFAULT_HERO_STAGE_LAYOUT.barbarian.position] as [number, number, number] },
    mage: { ...DEFAULT_HERO_STAGE_LAYOUT.mage, position: [...DEFAULT_HERO_STAGE_LAYOUT.mage.position] as [number, number, number] },
    ranger: { ...DEFAULT_HERO_STAGE_LAYOUT.ranger, position: [...DEFAULT_HERO_STAGE_LAYOUT.ranger.position] as [number, number, number] },
    rogue: { ...DEFAULT_HERO_STAGE_LAYOUT.rogue, position: [...DEFAULT_HERO_STAGE_LAYOUT.rogue.position] as [number, number, number] },
  };

  if (!heroSelectionSlots || heroSelectionSlots.length === 0) {
    return layout;
  }

  heroSelectionSlots.forEach((slot) => {
    layout[slot.classId] = {
      position: [...slot.position] as [number, number, number],
      rotationY: slot.rotationY,
    };
  });

  return layout;
};

const RuntimeSelectionScenarioGlb = ({
  modelUrl,
  transform,
}: {
  modelUrl: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}) => {
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

      // Selection scene models are decorative only; keep raycasting for heroes.
      node.raycast = () => null;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return clone;
  }, [gltf.scene]);

  const clampedScale = Math.max(0.001, transform.scale);

  return (
    <group
      position={transform.position}
      rotation={transform.rotation}
      scale={[clampedScale, clampedScale, clampedScale]}
    >
      <primitive object={model} />
    </group>
  );
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
  stageLayout,
}: {
  focusedClassId: PlayerClassId;
  detailsClassId: PlayerClassId | null;
  transitionState: SelectionTransitionState | null;
  stageLayout: HeroStageLayout;
}) => {
  const { camera, size } = useThree();
  const activeClassId = transitionState?.classId ?? detailsClassId ?? focusedClassId;
  const initialSlot = stageLayout[activeClassId];
  const lookTargetRef = useRef(new THREE.Vector3(initialSlot.position[0], 0.9, initialSlot.position[2] + 0.18));
  const currentLookTargetRef = useRef(new THREE.Vector3(initialSlot.position[0], 0.9, initialSlot.position[2] + 0.18));
  const detailViewProgressRef = useRef(0);
  const defaultPositionRef = useRef(new THREE.Vector3());
  const confirmPositionRef = useRef(new THREE.Vector3());
  const detailPositionRef = useRef(new THREE.Vector3());
  const targetPositionRef = useRef(new THREE.Vector3());
  const defaultLookRef = useRef(new THREE.Vector3());
  const confirmLookRef = useRef(new THREE.Vector3());
  const detailLookRef = useRef(new THREE.Vector3());
  const targetLookRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const isElectron = typeof window !== 'undefined' && (window as Window & { electronBridge?: { isElectron: boolean } }).electronBridge?.isElectron === true;
    const isMobile = isElectron ? false : size.width < 768;
    const layout = stageLayout[activeClassId];
    const [heroX, , heroZ] = layout.position;
    const heroDepth = THREE.MathUtils.clamp(heroZ, -4, 6);
    const targetDetailProgress = detailsClassId ? 1 : 0;
    detailViewProgressRef.current = THREE.MathUtils.lerp(detailViewProgressRef.current, targetDetailProgress, 0.08);
    const detailProgress = detailViewProgressRef.current;
    const transitionProgress = transitionState
      ? THREE.MathUtils.smootherstep(getTransitionProgress(transitionState), 0, 1)
      : 0;
    const defaultCameraDistance = (isMobile ? 11.9 : 10.9) + Math.abs(heroX) * 0.05;
    const confirmCameraDistance = isMobile ? 7.9 : 7.1;
    const detailCameraDistance = isMobile ? 7.55 : 6.55;
    const defaultPosition = defaultPositionRef.current.set(
      heroX * (isMobile ? 0.5 : 0.4),
      isMobile ? 2.5 : 2.42,
      heroDepth + defaultCameraDistance,
    );
    const confirmPosition = confirmPositionRef.current.set(
      heroX * (isMobile ? 0.42 : 0.34),
      isMobile ? 2.34 : 2.28,
      heroDepth + confirmCameraDistance,
    );
    const detailPosition = detailPositionRef.current.set(
      heroX * (isMobile ? 0.34 : 0.3),
      isMobile ? 1.84 : 2.62,
      heroDepth + detailCameraDistance,
    );
    const targetPosition = targetPositionRef.current.copy(defaultPosition)
      .lerp(confirmPosition, transitionProgress)
      .lerp(detailPosition, detailProgress * (1 - transitionProgress));

    const defaultLook = defaultLookRef.current.set(
      heroX,
      isMobile ? 0.98 : 0.92,
      heroZ + 0.18,
    );
    const confirmLook = confirmLookRef.current.set(heroX, isMobile ? 1.35 : 1.28, heroZ + 0.28);
    const detailLook = detailLookRef.current.set(heroX + (isMobile ? 0 : 0.52), isMobile ? 0.82 : 1.08, heroZ + 0.14);
    const targetLook = targetLookRef.current.copy(defaultLook)
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
  stageLayout,
  focused,
  selected,
  detailsClassId,
  transitionState,
  onFocus,
  onActivate,
}: {
  playerClass: PlayerClassDefinition;
  stageLayout: HeroStageLayout;
  focused: boolean;
  selected: boolean;
  detailsClassId: PlayerClassId | null;
  transitionState: SelectionTransitionState | null;
  onFocus: () => void;
  onActivate: () => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const heroRef = useRef<THREE.Group>(null);
  const targetScaleRef = useRef(new THREE.Vector3());
  const classNamePt = CLASS_NAME_PT[playerClass.id] ?? playerClass.name;
  const stageSlot = stageLayout[playerClass.id];
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
    heroRef.current.scale.lerp(targetScaleRef.current.set(targetScale, targetScale, targetScale), transitionState ? 0.05 : 0.08);
    applyMeshOpacity(groupRef.current, targetOpacity);
  });

  if (!playerClass.id) {
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

      <group ref={heroRef}>
        <BattleHero2D classId={playerClass.id} animationAction={ambientAction} interactive />
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
                <div className="font-gamer text-[17px] font-black leading-none">{classNamePt}</div>
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

const SelectionHeroAccentLights = ({
  focusedClassId,
  detailsClassId,
  stageLayout,
}: {
  focusedClassId: PlayerClassId;
  detailsClassId: PlayerClassId | null;
  stageLayout: HeroStageLayout;
}) => {
  const warmKeyRef = useRef<THREE.PointLight>(null);
  const coolFillRef = useRef<THREE.PointLight>(null);
  const purpleRimRef = useRef<THREE.PointLight>(null);
  const warmTargetRef = useRef(new THREE.Vector3());
  const coolTargetRef = useRef(new THREE.Vector3());
  const rimTargetRef = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const activeClassId = detailsClassId ?? focusedClassId;
    const slot = stageLayout[activeClassId];
    const targetX = slot.position[0];
    const targetY = 0.78;
    const targetZ = slot.position[2] + 0.22;
    const pulse = 0.5 + ((Math.sin(clock.elapsedTime * 2.2) + 1) / 2);

    if (warmKeyRef.current) {
      warmKeyRef.current.intensity = 1.25 + (pulse * 0.42);
      warmKeyRef.current.position.lerp(warmTargetRef.current.set(targetX + 1.35, targetY + 1.32, targetZ + 1.65), 0.09);
    }

    if (coolFillRef.current) {
      coolFillRef.current.intensity = 0.8 + (pulse * 0.25);
      coolFillRef.current.position.lerp(coolTargetRef.current.set(targetX - 1.18, targetY + 0.9, targetZ + 1.2), 0.09);
    }

    if (purpleRimRef.current) {
      purpleRimRef.current.intensity = 0.56 + (pulse * 0.22);
      purpleRimRef.current.position.lerp(rimTargetRef.current.set(targetX, targetY + 1.16, targetZ - 1.82), 0.09);
    }
  });

  return (
    <>
      <pointLight ref={warmKeyRef} color="#ffd7b0" intensity={1.4} distance={11} decay={1.75} />
      <pointLight ref={coolFillRef} color="#8ed8ff" intensity={0.86} distance={9} decay={1.75} />
      <pointLight ref={purpleRimRef} color="#c8a9ff" intensity={0.62} distance={8.5} decay={1.9} />
    </>
  );
};

const SelectionFpsCap = ({ fps }: { fps: number }) => {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (fps <= 0) return undefined;

    const frameIntervalMs = 1000 / fps;
    let rafId = 0;
    let lastFrameTime = 0;

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (lastFrameTime === 0) {
        lastFrameTime = now;
        invalidate();
        return;
      }

      const elapsed = now - lastFrameTime;
      if (elapsed < frameIntervalMs) return;
      lastFrameTime = now - (elapsed % frameIntervalMs);
      invalidate();
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [invalidate, fps]);

  return null;
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
  const renderQualityPreset = useMemo(() => getDefaultRenderQualityPreset(), []);
  const quality = useMemo(() => getRenderQualityProfile(renderQualityPreset), [renderQualityPreset]);
  const powerPreference = useMemo(() => getRenderPowerPreference(renderQualityPreset), [renderQualityPreset]);
  const isMobileDevice = useMemo(() => getRenderPlatform() === 'mobile', []);
  const isQualityMode = renderQualityPreset === 'quality';
  const selectionShadowsEnabled = isQualityMode || (!isMobileDevice && renderQualityPreset === 'balanced');
  const selectionDofEnabled = renderQualityPreset !== 'performance';
  const selectionUseAlwaysFrameloop = !isMobileDevice;
  const selectionFpsCap = isQualityMode ? 30 : 45;
  const selectionRuntimeScenarioPreset = useMemo(
    () => getRuntimeScenarioPreset('hero-selection') ?? getRuntimeScenarioPreset('tower'),
    [],
  );
  const selectionRuntimeConfig = selectionRuntimeScenarioPreset?.config ?? null;
  const selectionLighting = selectionRuntimeConfig?.lighting;
  const selectionAtmosphere = selectionRuntimeConfig?.atmosphere;
  const selectionFogEnabled = selectionAtmosphere?.fogEnabled ?? false;
  const selectionFogColor = selectionAtmosphere?.fogColor ?? '#d7e6c2';
  const selectionFogNear = Math.max(1, selectionAtmosphere?.fogNear ?? 16);
  const selectionFogFar = Math.max(selectionFogNear + 1, selectionAtmosphere?.fogFar ?? 46);
  const heroStageLayout = useMemo(
    () => buildHeroStageLayout(selectionRuntimeConfig?.heroSelectionSlots),
    [selectionRuntimeConfig?.heroSelectionSlots],
  );
  const selectionDofTarget = useMemo<[number, number, number]>(() => {
    const pos = heroStageLayout[focusedClassId].position;
    return [pos[0], 0.9, pos[2]];
  }, [focusedClassId, heroStageLayout]);


  const SceneReadyProbe = ({ onReady }: { onReady?: () => void }) => {
    const framesRef = useRef(0);
    const readySentRef = useRef(false);
    const cancelledRef = useRef(false);
    const raf1Ref = useRef<number | null>(null);
    const raf2Ref = useRef<number | null>(null);

    const scheduleReady = useCallback(() => {
      if (!onReady || cancelledRef.current) {
        return;
      }

      const enqueue = typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => {
            Promise.resolve().then(callback);
          };

      enqueue(() => {
        if (!onReady || cancelledRef.current) {
          return;
        }

        raf1Ref.current = window.requestAnimationFrame(() => {
          raf1Ref.current = null;
          if (!onReady || cancelledRef.current) {
            return;
          }

          raf2Ref.current = window.requestAnimationFrame(() => {
            raf2Ref.current = null;
            if (!onReady || cancelledRef.current) {
              return;
            }

            onReady();
          });
        });
      });
    }, [onReady]);

    useFrame(() => {
      if (!onReady || readySentRef.current) {
        return;
      }

      framesRef.current += 1;
      if (framesRef.current < 3) {
        return;
      }

      readySentRef.current = true;
      scheduleReady();
    });

    useEffect(() => {
      return () => {
        cancelledRef.current = true;

        if (raf1Ref.current !== null) {
          window.cancelAnimationFrame(raf1Ref.current);
          raf1Ref.current = null;
        }

        if (raf2Ref.current !== null) {
          window.cancelAnimationFrame(raf2Ref.current);
          raf2Ref.current = null;
        }
      };
    }, []);

    return null;
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Canvas
        shadows={selectionShadowsEnabled ? { type: isQualityMode ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap } : false}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
        performance={{ min: 0.5 }}
        frameloop={selectionUseAlwaysFrameloop ? 'always' : 'demand'}
        style={{ touchAction: 'none' }}
      >
        {!selectionUseAlwaysFrameloop && <SelectionFpsCap fps={selectionFpsCap} />}
        <PerspectiveCamera makeDefault position={[0, 2.62, 17.2]} fov={33} rotation={[-0.075, 0, 0]} />
        <AnimatedSelectionCamera
          focusedClassId={focusedClassId}
          detailsClassId={detailsClassId}
          transitionState={transitionState}
          stageLayout={heroStageLayout}
        />
        <SceneReadyProbe onReady={onSceneReady} />
        <SkyboxController />
        {selectionFogEnabled && <fog attach="fog" args={[selectionFogColor, selectionFogNear, selectionFogFar]} />}

        {selectionRuntimeScenarioPreset && (
          <Suspense fallback={null}>
            <RuntimeSelectionScenarioGlb
              modelUrl={selectionRuntimeScenarioPreset.scenarioModelUrl}
              transform={selectionRuntimeConfig?.scenarioTransform ?? {
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: 1,
              }}
            />
            {selectionRuntimeConfig?.sceneObjects.map((sceneObject) => (
              <RuntimeSelectionScenarioGlb
                key={sceneObject.id}
                modelUrl={sceneObject.modelUrl}
                transform={sceneObject.transform}
              />
            ))}
          </Suspense>
        )}

        <ambientLight intensity={selectionLighting?.ambientIntensity ?? 0.85} color={selectionLighting?.ambientColor ?? '#ffffff'} />
        <directionalLight intensity={0.32} color="#8fcff7" position={[-4.2, 3.2, -4.8]} />
        <hemisphereLight intensity={0.55} groundColor="#243a20" color="#f4ffe6" />
        <SelectionHeroAccentLights
          focusedClassId={focusedClassId}
          detailsClassId={detailsClassId}
          stageLayout={heroStageLayout}
        />
        <ContactShadows position={[0, -1.04, -0.2]} opacity={0.76} scale={30} blur={2.0} far={12} resolution={quality.contactShadowResolution} />

        {classes.map((playerClass) => (
          <StageHero
            key={playerClass.id}
            playerClass={playerClass}
            stageLayout={heroStageLayout}
            focused={focusedClassId === playerClass.id}
            selected={selectedClassId === playerClass.id}
            detailsClassId={detailsClassId}
            transitionState={transitionState}
            onFocus={() => onFocusClass(playerClass.id)}
            onActivate={() => onSelectClass(playerClass.id)}
          />
        ))}
        {selectionDofEnabled && (
          <EffectComposer>
            <DepthOfField
              target={selectionDofTarget}
              worldFocusRange={5.0}
              bokehScale={isMobileDevice ? 3.5 : 6.5}
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};

const QuickHeroCard = ({
  playerClass,
  allClasses,
  isVisible,
  onClose,
  onConfirm,
  onCanScroll,
}: {
  playerClass: PlayerClassDefinition;
  allClasses: PlayerClassDefinition[];
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (classId: PlayerClassId) => void;
  onCanScroll?: (value: boolean) => void;
}) => {
  const classCopy = CLASS_COPY[playerClass.id];
  const constellation = getConstellationByClassId(playerClass.id);
  const RoleIcon = CLASS_ROLE_ICONS[playerClass.id];
  const actionColor = playerClass.visualProfile.auraColor;
  const actionBorderColor = playerClass.visualProfile.primaryColor;
  const classNamePt = CLASS_NAME_PT[playerClass.id] ?? playerClass.name;
  const proficiencyBadges = playerClass.weaponProficiencies.map((grip) => WEAPON_PROFICIENCY_META[grip]);
  const { uiProfile, gamepadBrand } = useInputMode();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdProgressRef = useRef(0);
  const mobileScrollRef  = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  // Detecta se algum dos containers tem conteúdo que ultrapassa a altura visível
  useEffect(() => {
    if (!isVisible) { setCanScroll(false); onCanScroll?.(false); return; }
    // Checa imediatamente e sempre que o tamanho mudar
    const initialResult =
      (mobileScrollRef.current  !== null && mobileScrollRef.current.scrollHeight  > mobileScrollRef.current.clientHeight)  ||
      (desktopScrollRef.current !== null && desktopScrollRef.current.scrollHeight > desktopScrollRef.current.clientHeight);
    setCanScroll(initialResult);
    onCanScroll?.(initialResult);
    const targets = [mobileScrollRef.current, desktopScrollRef.current].filter(Boolean) as HTMLDivElement[];
    const ro = new ResizeObserver(() => {
      const mobile  = mobileScrollRef.current;
      const desktop = desktopScrollRef.current;
      const result =
        (mobile  !== null && mobile.scrollHeight  > mobile.clientHeight)  ||
        (desktop !== null && desktop.scrollHeight > desktop.clientHeight);
      setCanScroll(result);
      onCanScroll?.(result);
    });
    targets.forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [isVisible, playerClass.id, onCanScroll]);

  useEffect(() => {
    if (!isVisible || uiProfile !== 'gamepad') {
      holdProgressRef.current = 0;
      setHoldProgress(0);
      return;
    }
    let rafId: number;
    let lastTime: number | null = null;
    const HOLD_MS = 1500;
    function frame(now: number) {
      const gpads = Array.from(navigator.getGamepads());
      const btnDown = gpads.some(g => g && (g.buttons[0]?.pressed || (g.buttons[0]?.value ?? 0) > 0.5));
      if (lastTime === null) lastTime = now;
      const dt = Math.min(now - lastTime, 100);
      lastTime = now;
      if (btnDown) {
        const next = Math.min(100, holdProgressRef.current + (dt / HOLD_MS) * 100);
        holdProgressRef.current = next;
        setHoldProgress(next);
        if (next >= 100) {
          holdProgressRef.current = 0;
          setHoldProgress(0);
          onConfirm(playerClass.id);
          return;
        }
      } else {
        if (holdProgressRef.current > 0) {
          holdProgressRef.current = 0;
          setHoldProgress(0);
          lastTime = null;
        }
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, uiProfile, playerClass.id, onConfirm]);

  // Scroll analógico: RAF lê axes[1] e rola os containers quando painel está aberto
  useEffect(() => {
    if (!isVisible || uiProfile !== 'gamepad') return;
    let rafId: number;
    const DEADZONE = 0.18;
    const SPEED    = 10; // px por frame
    function frame() {
      const gpads = Array.from(navigator.getGamepads());
      const gp = gpads.find(g => g !== null);
      if (gp) {
        const axisY = gp.axes[1] ?? 0;
        if (Math.abs(axisY) > DEADZONE) {
          const delta = axisY * SPEED;
          mobileScrollRef.current?.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
          desktopScrollRef.current?.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
        }
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, uiProfile]);

  // D-pad: NAV_UP / NAV_DOWN rola o painel em passos quando está aberto
  useEffect(() => {
    if (!isVisible || uiProfile !== 'gamepad') return;
    return onAction((action) => {
      if (action === 'NAV_UP') {
        mobileScrollRef.current?.scrollBy({ top: -90 });
        desktopScrollRef.current?.scrollBy({ top: -90 });
      }
      if (action === 'NAV_DOWN') {
        mobileScrollRef.current?.scrollBy({ top: 90 });
        desktopScrollRef.current?.scrollBy({ top: 90 });
      }
    });
  }, [isVisible, uiProfile]);

  const HoldArc = () => {
    const isSony = gamepadBrand === 'sony';
    const label = isSony ? '✕' : 'A';
    const btnColor = isSony ? '#0070D1' : '#107C10';
    const arcColor = isSony ? '#00d4ff' : '#39ff6e';
    const R = 13; const circ = 2 * Math.PI * R;
    const offset = circ * (1 - holdProgress / 100);
    return (
      <span style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', filter: holdProgress > 0 ? `drop-shadow(0 0 4px ${arcColor})` : 'none' }}>
          <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <circle cx="16" cy="16" r={R} fill="none" stroke={arcColor} strokeWidth="3"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: holdProgress === 0 ? 'none' : 'stroke-dashoffset 80ms linear' }}
          />
        </svg>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: btnColor, fontWeight: 900, fontSize: 11, fontFamily: 'system-ui,sans-serif', lineHeight: 1, zIndex: 1 }}>{label}</span>
      </span>
    );
  };

  const panelSurfaceStyle = {
    borderColor: `${playerClass.visualProfile.auraColor}44`,
    background: 'linear-gradient(180deg, rgba(14,16,24,0.7) 0%, rgba(10,12,18,0.82) 40%, rgba(7,9,14,0.9) 100%)',
    boxShadow: '0 32px 72px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.03)',
    backdropFilter: 'blur(18px) saturate(1.22)',
    WebkitBackdropFilter: 'blur(18px) saturate(1.22)',
  };

  const panelOverlayStyle = {
    background: `radial-gradient(circle at top right, ${playerClass.visualProfile.auraColor}30 0%, transparent 34%), radial-gradient(circle at bottom left, ${playerClass.visualProfile.primaryColor}22 0%, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 24%, rgba(255,255,255,0.02) 100%)`,
  };

  const sectionSurfaceStyle = {
    borderColor: 'rgba(255,255,255,0.1)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 34px rgba(0,0,0,0.16)',
  };

  const chipSurfaceStyle = {
    borderColor: 'rgba(255,255,255,0.12)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 24px rgba(0,0,0,0.12)',
  };

  const statSurfaceStyle = {
    borderColor: 'rgba(255,255,255,0.1)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 26px rgba(0,0,0,0.14)',
  };

  const descriptionSurfaceStyle = {
    borderColor: 'rgba(255,255,255,0.1)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 32px rgba(0,0,0,0.14)',
  };

  const resourceStatItems = useMemo(
    () => STAT_ITEMS.filter((item) => item.key === 'maxHp' || item.key === 'maxMp'),
    [],
  );

  const secondaryStatItems = useMemo(
    () => STAT_ITEMS.filter((item) => item.key !== 'maxHp' && item.key !== 'maxMp'),
    [],
  );

  const statScaleMax = useMemo(() => ({
    maxHp: Math.max(...allClasses.map((entry) => entry.baseStats.maxHp)),
    maxMp: Math.max(...allClasses.map((entry) => entry.baseStats.maxMp)),
  }), [allClasses]);

  const renderDetailSections = () => (
    <div className="mt-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/48">Atributos base</div>
      <p className="mt-2 text-sm leading-relaxed text-white/72">{classCopy.summary}</p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {resourceStatItems.map(({ key, label, icon: Icon, color, bg }) => {
          const value = playerClass.baseStats[key];
          const maxValue = statScaleMax[key];
          const percent = maxValue > 0 ? Math.max(10, (value / maxValue) * 100) : 0;
          return (
            <div key={`${playerClass.id}-${key}`} className="rounded-[18px] border px-3 py-3 backdrop-blur-md" style={statSurfaceStyle}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/48">{label}</div>
                  <div className="mt-1 text-lg font-black text-white">{value}</div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]" style={{ color, backgroundColor: bg }}>
                  <Icon size={14} />
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                    boxShadow: `0 0 14px ${color}44`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-2.5 grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(82px, 1fr))' }}
      >
        {secondaryStatItems.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={`${playerClass.id}-${key}`} className="min-h-[72px] rounded-[16px] border px-2.5 py-2.5 backdrop-blur-md" style={statSurfaceStyle}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[0.16em] text-white/48">{label}</div>
                <div className="mt-1.5 text-[1.1rem] font-black leading-none text-white">{playerClass.baseStats[key]}</div>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ color, backgroundColor: bg }}>
                <Icon size={13} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-[22px] border px-4 py-3 text-sm text-white/72 backdrop-blur-md" style={descriptionSurfaceStyle}>
        {repairGameText(playerClass.description)}
      </div>

      <div className="mt-3 rounded-[22px] border px-4 py-3 backdrop-blur-md" style={sectionSurfaceStyle}>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/48">Proficiencias de arma</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {proficiencyBadges.map((badge) => (
            <span key={`${playerClass.id}-${badge.label}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white/78 backdrop-blur-md" style={chipSurfaceStyle}>
              <span className="text-sm leading-none">{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="mt-3 rounded-[24px] border px-4 py-4"
        style={{
          ...sectionSurfaceStyle,
          borderColor: `${constellation.resource.color}44`,
          background: `linear-gradient(135deg, ${constellation.resource.color}16 0%, rgba(255,255,255,0.05) 100%)`,
        }}
      >
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/48">Trilhas da classe</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {constellation.trails.map((trail) => (
            <div
              key={trail.id}
              className="rounded-[18px] border px-3 py-3 backdrop-blur-md"
              style={{
                borderColor: `${trail.color}44`,
                background: `linear-gradient(180deg, ${trail.color}18 0%, rgba(255,255,255,0.04) 100%)`,
                boxShadow: `inset 0 0 0 1px ${trail.color}18`,
              }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-[0.18em]"
                style={{ color: trail.color }}
              >
                Trilha
              </div>
              <div className="mt-1 font-gamer text-lg font-black text-white">
                {repairGameText(trail.name)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={mobileScrollRef}
        className={`absolute inset-0 z-[130] overflow-y-auto md:hidden transition-all duration-300 ease-out ${isVisible ? 'bg-black/20 opacity-100' : 'bg-black/0 opacity-0 pointer-events-none'}`}
      >
        <div className="min-h-[62dvh]" />
        <div className={`origin-bottom relative overflow-hidden rounded-t-[26px] border border-b-0 shadow-[0_-22px_56px_rgba(0,0,0,0.32)] transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-14 scale-[0.98] opacity-0'}`} style={panelSurfaceStyle}>
          <div className="pointer-events-none absolute inset-0" style={panelOverlayStyle} />
          <div className="relative px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#b78f78]/45" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/52">Heroi escolhido</div>
              <div className="mt-1 flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-[14px] border text-white shadow-[0_16px_28px_rgba(0,0,0,0.18)]"
                  style={{
                    borderColor: `${playerClass.visualProfile.auraColor}55`,
                    background: `linear-gradient(180deg, ${playerClass.visualProfile.auraColor} 0%, ${playerClass.visualProfile.primaryColor} 100%)`,
                  }}
                >
                  <RoleIcon size={20} />
                </span>
                <div className="font-gamer text-2xl font-black text-white">{classNamePt}</div>
              </div>
              <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-white/62">{repairGameText(playerClass.title)}</div>
            </div>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/14 bg-white/6 text-white/74 shadow-[0_16px_28px_rgba(0,0,0,0.18)] backdrop-blur-md transition-colors hover:bg-white/12"
            >
              <X size={18} />
            </button>
          </div>

          {renderDetailSections()}
            <button
              onClick={uiProfile !== 'gamepad' ? () => onConfirm(playerClass.id) : undefined}
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] border-b-4 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-105 active:translate-y-0.5 active:border-b-0"
              style={{
                  background: `linear-gradient(180deg, ${actionColor} 0%, ${playerClass.visualProfile.primaryColor} 100%)`,
                  borderColor: actionBorderColor,
                  boxShadow: `0 18px 30px ${actionColor}30, inset 0 1px 0 rgba(255,255,255,0.12)`,
                cursor: uiProfile === 'gamepad' ? 'default' : undefined,
              }}
            >
              {uiProfile === 'gamepad' && <HoldArc />}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Confirmar heroi <ArrowRight size={18} /></span>
                {uiProfile === 'gamepad' && <span style={{ fontSize: '0.62rem', opacity: 0.75, fontWeight: 700 }}>segurar</span>}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={`absolute bottom-6 right-4 top-8 z-[130] hidden w-[min(560px,42vw)] origin-right overflow-hidden rounded-[32px] border p-6 shadow-[0_30px_64px_rgba(0,0,0,0.34)] transition-all duration-300 ease-out md:flex md:flex-col ${isVisible ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-12 scale-[0.97] opacity-0 pointer-events-none'}`} style={panelSurfaceStyle}>
        <div className="pointer-events-none absolute inset-0" style={panelOverlayStyle} />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/52">Heroi escolhido</div>
            <div className="mt-1 flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[14px] border text-white shadow-[0_16px_28px_rgba(0,0,0,0.18)]"
                style={{
                  borderColor: `${playerClass.visualProfile.auraColor}55`,
                  background: `linear-gradient(180deg, ${playerClass.visualProfile.auraColor} 0%, ${playerClass.visualProfile.primaryColor} 100%)`,
                }}
              >
                <RoleIcon size={20} />
              </span>
              <div className="font-gamer text-2xl font-black text-white">{classNamePt}</div>
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-white/62">{repairGameText(playerClass.title)}</div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/14 bg-white/6 text-white/74 shadow-[0_16px_28px_rgba(0,0,0,0.18)] backdrop-blur-md transition-colors hover:bg-white/12"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={desktopScrollRef} className="relative mt-4 flex-1 overflow-y-auto pr-1">
          {renderDetailSections()}
        </div>

        <button
          onClick={uiProfile !== 'gamepad' ? () => onConfirm(playerClass.id) : undefined}
          className="mt-4 inline-flex min-h-14 items-center justify-center gap-2 rounded-[16px] border-b-4 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-105 active:translate-y-0.5 active:border-b-0"
          style={{
            background: `linear-gradient(180deg, ${actionColor} 0%, ${playerClass.visualProfile.primaryColor} 100%)`,
            borderColor: actionBorderColor,
            boxShadow: `0 18px 30px ${actionColor}30, inset 0 1px 0 rgba(255,255,255,0.12)`,
            cursor: uiProfile === 'gamepad' ? 'default' : undefined,
          }}
        >
          {uiProfile === 'gamepad' && <HoldArc />}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Confirmar heroi <ArrowRight size={18} /></span>
            {uiProfile === 'gamepad' && <span style={{ fontSize: '0.62rem', opacity: 0.75, fontWeight: 700 }}>segurar</span>}
          </span>
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
  onBack,
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
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [backConfirmVisible, setBackConfirmVisible] = useState(false);
  const [panelCanScroll, setPanelCanScroll] = useState(false);
  const { uiProfile, gamepadBrand } = useInputMode();

  const openBackConfirm = useCallback(() => {
    setShowBackConfirm(true);
    requestAnimationFrame(() => setBackConfirmVisible(true));
  }, []);

  const closeBackConfirm = useCallback(() => {
    setBackConfirmVisible(false);
    setTimeout(() => setShowBackConfirm(false), 260);
  }, []);
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

  // ── Gamepad navigation ──────────────────────────────────────────────────────
  const moveFocusRef          = useRef(moveFocus);
  const beginConfirmRef       = useRef(beginConfirmTransition);
  const focusedClassIdRef     = useRef(focusedClassId);
  const openClassIdRef        = useRef(openClassId);
  const setOpenClassIdRef     = useRef(setOpenClassId);
  const onBackRef             = useRef(onBack);
  const showBackConfirmRef    = useRef(showBackConfirm);
  const openBackConfirmRef    = useRef(openBackConfirm);
  const closeBackConfirmRef   = useRef(closeBackConfirm);
  const uiProfileRef          = useRef(uiProfile);
  moveFocusRef.current        = moveFocus;
  beginConfirmRef.current     = beginConfirmTransition;
  focusedClassIdRef.current   = focusedClassId;
  openClassIdRef.current      = openClassId;
  setOpenClassIdRef.current   = setOpenClassId;
  onBackRef.current           = onBack;
  showBackConfirmRef.current  = showBackConfirm;
  openBackConfirmRef.current  = openBackConfirm;
  closeBackConfirmRef.current = closeBackConfirm;
  uiProfileRef.current        = uiProfile;

  useEffect(() => {
    return onAction((action) => {
      // Modal de confirmação de saída tem prioridade
      if (showBackConfirmRef.current) {
        if (action === 'CONFIRM') { closeBackConfirmRef.current(); setTimeout(() => onBackRef.current?.(), 260); }
        if (action === 'BACK')   { closeBackConfirmRef.current(); }
        return;
      }
      if (action === 'SKILL_2') { openBackConfirmRef.current(); return; }
      if (action === 'NAV_LEFT')  { moveFocusRef.current(-1); return; }
      if (action === 'NAV_RIGHT') { moveFocusRef.current(1);  return; }
      if (action === 'CONFIRM') {
        if (openClassIdRef.current) {
          // Panel já aberto — no gamepad o hold no QuickHeroCard é quem confirma
          if (uiProfileRef.current !== 'gamepad') {
            beginConfirmRef.current(openClassIdRef.current);
          }
        } else {
          // Abre painel de detalhes da classe focada
          setOpenClassIdRef.current(focusedClassIdRef.current);
        }
        return;
      }
      if (action === 'BACK') {
        if (openClassIdRef.current) {
          // Fecha painel se estiver aberto
          setOpenClassIdRef.current(null);
        }
        // B nunca abre modal de saída — use Y/△ para isso (SKILL_2)
        return;
      }
    });
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
          allClasses={classes}
          isVisible={isDetailsPanelVisible}
          onClose={() => setOpenClassId(null)}
          onConfirm={(classId) => {
            beginConfirmTransition(classId);
          }}
          onCanScroll={setPanelCanScroll}
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
            <img
              src={CLASS_SELECTION_LOGO_URL}
              alt="Hero Tower"
              className="mx-auto w-full max-w-[280px] sm:max-w-[420px] select-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
              draggable={false}
            />
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

      {/* Modal de confirmação de saída */}
      {showBackConfirm && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center px-4"
          style={{
            background: backConfirmVisible ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
            backdropFilter: backConfirmVisible ? 'blur(10px)' : 'blur(0px)',
            WebkitBackdropFilter: backConfirmVisible ? 'blur(10px)' : 'blur(0px)',
            transition: 'background 260ms ease, backdrop-filter 260ms ease',
          }}
          onClick={closeBackConfirm}
        >
          <div
            className="w-full max-w-sm rounded-[24px] border border-[#f7d2a5]/40 bg-[#1a1208]/97 shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
            style={{
              transform: backConfirmVisible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.95)',
              opacity: backConfirmVisible ? 1 : 0,
              transition: 'transform 280ms cubic-bezier(0.34,1.4,0.64,1), opacity 220ms ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f8d3a8]">Confirmação</div>
              <h3 className="mt-2 font-gamer text-xl font-black text-[#fff3df]">Voltar ao menu?</h3>
              <p className="mt-2 text-sm text-[#f8dcc0]/80">Sua seleção de herói será descartada.</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={closeBackConfirm}
                  className="hero-menu-action hero-menu-action-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {uiProfile === 'gamepad' && (() => {
                    const isSony = gamepadBrand === 'sony';
                    const color = isSony ? '#E80000' : '#E52420';
                    const label = isSony ? '○' : 'B';
                    return (
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color, fontWeight: 900, fontSize: 12, fontFamily: 'system-ui,sans-serif', lineHeight: 1 }}>{label}</span>
                    );
                  })()}
                  <span>Cancelar</span>
                </button>
                <button
                  onClick={() => { closeBackConfirm(); setTimeout(() => onBack?.(), 260); }}
                  className="hero-menu-action hero-menu-action-primary"
                  style={{ fontSize: '0.8rem', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {uiProfile === 'gamepad' && (() => {
                    const isSony = gamepadBrand === 'sony';
                    const color = isSony ? '#0070D1' : '#107C10';
                    const label = isSony ? '✕' : 'A';
                    return (
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color, fontWeight: 900, fontSize: 12, fontFamily: 'system-ui,sans-serif', lineHeight: 1 }}>{label}</span>
                    );
                  })()}
                  <span>Menu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legenda contextual de gamepad — s\u00f3 mostra a\u00e7\u00f5es poss\u00edveis */}
      {!transitionState && (() => {
        if (showBackConfirm) {
          // Modal de saída: A=Voltar ao menu, B=Cancelar
          return <GamepadActionLegend confirmText="Voltar ao menu" showCancel />;
        }
        if (openClassId) {
          // Painel de detalhes: A=Confirmar (hold), B=Fechar, analógico=Rolar se houver scroll
          return <GamepadActionLegend confirmText="Confirmar herói" showCancel showScroll={panelCanScroll} />;
        }
        // Navegação normal: A=Selecionar, sem B (não faz nada), Y=Menu
        return <GamepadActionLegend confirmText="Selecionar" showCancel={false} extras={[{ button: 'skill2', text: 'Menu' }]} />;
      })()}
    </div>
  );
};
