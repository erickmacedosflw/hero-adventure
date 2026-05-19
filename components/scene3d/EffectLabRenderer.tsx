/**
 * EffectLabRenderer — 3D scene for the Effect Lab developer tool.
 * Contains:
 *  • HeroVoxel mannequin (idle, receiving effects)
 *  • ProceduralEffectEngine — Three.js instanced particle system driven by EffectPreset
 *  • EffekseerPlayback  — optional Effekseer runtime when efkUrl is provided
 *  • Spawn-point TransformControls gizmo
 */
import React, { Suspense, useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
} from '@react-three/drei';
import * as THREE from 'three';
import { getRenderPowerPreference, getRenderQualityProfile } from './environment';
import type { EffectPreset, EffectLabParams } from './effectPresets';
import { useEffekseer } from '../../game/hooks/useEffekseer';

// ─── Types ────────────────────────────────────────────────────────────────────

type HeroVoxelComponentType = React.ComponentType<any>;

export interface EffectLabSceneProps {
  preset: EffectPreset;
  params: EffectLabParams;
  isPlaying: boolean;
  loop: boolean;
  efkUrl: string;
  spawnOffset: [number, number, number];
  onSpawnOffsetChange?: (offset: [number, number, number]) => void;
  HeroVoxelComponent: HeroVoxelComponentType;
}

// ─── Procedural Particle Runtime ──────────────────────────────────────────────

const MAX_PARTICLES = 200;

interface ParticleState {
  active: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
  angle: number;   // orbit angle
  orbitR: number;  // orbit radius
  spinX: number; spinY: number; spinZ: number;
  rx: number; ry: number; rz: number;
}

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(`#${hex}`);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Procedural Effect Engine ─────────────────────────────────────────────────

const ProceduralEffectEngine: React.FC<{
  preset: EffectPreset;
  params: EffectLabParams;
  isPlaying: boolean;
  loop: boolean;
  spawnOffset: [number, number, number];
}> = ({ preset, params, isPlaying, loop, spawnOffset }) => {

  // ── GPU buffers (pre-allocated, updated every frame) ──────────────────
  const posArr = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colArr = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const geoRef = useRef<THREE.BufferGeometry>(null);

  // Soft circular glow texture (created once)
  const pointTexture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0,   'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);

  // ── Particle state ────────────────────────────────────────────────────
  const states = useRef<ParticleState[]>(
    Array.from({ length: MAX_PARTICLES }, () => ({ active: false } as ParticleState))
  );
  const emitAccumRef  = useRef(0);
  const elapsedRef    = useRef(0);
  const burstFiredRef = useRef(false);
  const orbitTimeRef  = useRef(0);
  const prevPlayRef   = useRef(false);

  const resetAll = useCallback(() => {
    states.current.forEach((s) => { s.active = false; });
    burstFiredRef.current = false;
    elapsedRef.current    = 0;
    emitAccumRef.current  = 0;
    orbitTimeRef.current  = 0;
  }, []);

  useEffect(() => { resetAll(); }, [preset.id, params, resetAll]);

  useEffect(() => {
    if (isPlaying && !prevPlayRef.current) resetAll();
    prevPlayRef.current = isPlaying;
  }, [isPlaying, resetAll]);

  // ── Spawn helper ──────────────────────────────────────────────────────
  const spawnParticle = useCallback((origin: THREE.Vector3, index: number) => {
    const s = states.current[index];
    const col1 = hexToColor(params.color);
    const col2 = hexToColor(params.colorSecondary);
    s.active  = true;
    s.color   = col1.clone().lerp(col2, Math.random());
    s.maxLife = (0.5 + Math.random() * 0.5) * params.duration;
    s.life    = s.maxLife;
    s.scale   = (0.5 + Math.random() * 0.5) * params.scale;
    s.rx = s.ry = s.rz = 0;
    s.spinX = s.spinY = s.spinZ = 0;

    if (preset.emitterMode === 'orbit') {
      s.angle  = Math.random() * Math.PI * 2;
      s.orbitR = (preset.orbitRadius ?? 0.6) * params.scale;
      s.x = origin.x + Math.cos(s.angle) * s.orbitR;
      s.y = origin.y + (Math.random() - 0.5) * 0.3 * params.scale;
      s.z = origin.z + Math.sin(s.angle) * s.orbitR;
      s.vx = 0; s.vy = params.speed * preset.liftBias * 0.3; s.vz = 0;
    } else if (preset.emitterMode === 'trail') {
      const a = (Math.random() - 0.5) * preset.spread;
      const r = (0.3 + Math.random() * 0.4) * params.scale;
      s.x = origin.x + Math.sin(a) * r;
      s.y = origin.y + Math.cos(a) * r * 0.5;
      s.z = origin.z + (Math.random() - 0.5) * 0.3 * params.scale;
      const spd = params.speed * (0.5 + Math.random() * 0.5);
      s.vx = (Math.random() - 0.5) * spd * 0.5;
      s.vy = lerp(0, -spd * 0.3, Math.random());
      s.vz = -(spd * (0.6 + Math.random() * 0.4));
      s.maxLife *= 0.4;
      s.life = s.maxLife;
    } else {
      const theta = (Math.random() - 0.5) * preset.spread;
      const phi   = Math.random() * Math.PI * 2;
      const spd   = params.speed * (0.5 + Math.random() * 0.5);
      s.x = origin.x + (Math.random() - 0.5) * 0.1 * params.scale;
      s.y = origin.y + (Math.random() - 0.5) * 0.1 * params.scale;
      s.z = origin.z + (Math.random() - 0.5) * 0.1 * params.scale;
      s.vx = Math.cos(phi) * Math.sin(theta) * spd;
      s.vy = lerp(spd * -0.2, spd, preset.liftBias) + (Math.random() - 0.5) * spd * 0.3;
      s.vz = Math.sin(phi) * Math.sin(theta) * spd;
    }
  }, [preset, params]);

  // ── Per-frame update ──────────────────────────────────────────────────
  useFrame((_, delta) => {
    const ox = spawnOffset[0], oy = spawnOffset[1], oz = spawnOffset[2];
    const origin = new THREE.Vector3(ox, oy, oz);

    // ── Emission ────────────────────────────────────────────────────────
    if (isPlaying) {
      elapsedRef.current     += delta;
      orbitTimeRef.current   += delta;
      const elapsed          = elapsedRef.current;
      const totalDuration    = Math.max(0.1, params.duration);

      if (preset.emitterMode === 'burst' || preset.emitterMode === 'trail') {
        if (!burstFiredRef.current) {
          burstFiredRef.current = true;
          const n = Math.min(Math.round(params.count), MAX_PARTICLES);
          for (let i = 0; i < n; i++) spawnParticle(origin, i);
        }
        if (loop && elapsed >= totalDuration) {
          states.current.forEach((s) => { s.active = false; });
          burstFiredRef.current = false;
          elapsedRef.current    = 0;
        }
      } else {
        if (loop && elapsed >= totalDuration) {
          elapsedRef.current   = 0;
          emitAccumRef.current = 0;
        }
        if (loop || elapsed < totalDuration) {
          const rate = params.count / Math.max(0.1, Math.min(totalDuration, 5));
          emitAccumRef.current += rate * delta;
          while (emitAccumRef.current >= 1) {
            emitAccumRef.current -= 1;
            const slot = states.current.findIndex((s) => !s.active);
            if (slot === -1) break;
            if (preset.emitterMode === 'orbit') {
              const angle = orbitTimeRef.current * params.speed * 0.8 + slot * (Math.PI * 2 / 40);
              const r     = (preset.orbitRadius ?? 0.6) * params.scale;
              const so    = states.current[slot];
              so.active  = true;
              so.angle   = angle;
              so.orbitR  = r;
              so.x       = ox + Math.cos(angle) * r;
              so.y       = oy + (Math.random() - 0.5) * 0.4 * params.scale;
              so.z       = oz + Math.sin(angle) * r;
              so.vx      = 0;
              so.vy      = params.speed * preset.liftBias * 0.25;
              so.vz      = 0;
              so.maxLife = 1.2 + Math.random() * 0.8;
              so.life    = so.maxLife;
              so.scale   = (0.5 + Math.random() * 0.5) * params.scale;
              so.color   = hexToColor(params.color).lerp(hexToColor(params.colorSecondary), Math.random());
              so.rx = so.ry = so.rz = so.spinX = so.spinY = so.spinZ = 0;
            } else {
              spawnParticle(origin, slot);
            }
          }
        }
      }
    }

    // ── Physics + write to GPU buffers ──────────────────────────────────
    let drawCount = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const s = states.current[i];
      if (!s.active) continue;
      s.life -= delta;
      if (s.life <= 0) { s.active = false; continue; }

      if (preset.emitterMode === 'orbit' && s.orbitR) {
        s.angle += params.speed * 0.6 * delta;
        s.x = ox + Math.cos(s.angle) * s.orbitR;
        s.z = oz + Math.sin(s.angle) * s.orbitR;
      }
      s.x += s.vx * delta;
      s.y += s.vy * delta;
      s.z += s.vz * delta;

      const fade      = Math.max(0, s.life / s.maxLife);
      const intensity = lerp(0.3, params.intensity * 1.4, fade);
      const base      = drawCount * 3;

      posArr[base]     = s.x;
      posArr[base + 1] = s.y;
      posArr[base + 2] = s.z;
      colArr[base]     = Math.min(1, s.color.r * intensity);
      colArr[base + 1] = Math.min(1, s.color.g * intensity);
      colArr[base + 2] = Math.min(1, s.color.b * intensity);
      drawCount++;
    }

    const geo = geoRef.current;
    if (geo) {
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color')    as THREE.BufferAttribute).needsUpdate = true;
      geo.setDrawRange(0, drawCount);
    }
  });

  const blending = preset.additiveBlend ? THREE.AdditiveBlending : THREE.NormalBlending;

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colArr, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={Math.max(0.12, params.scale * 0.22)}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={blending}
        toneMapped={false}
        map={pointTexture}
        alphaTest={0.01}
      />
    </points>
  );
};



// ─── Effekseer Playback Controller ────────────────────────────────────────────

const EffekseerPlayback: React.FC<{
  efkUrl: string;
  isPlaying: boolean;
  spawnOffset: [number, number, number];
  onError: (err: string) => void;
}> = ({ efkUrl, isPlaying, spawnOffset, onError }) => {
  const { ready, error, play, stop } = useEffekseer(efkUrl, isPlaying);

  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);

  useEffect(() => {
    if (ready && isPlaying) {
      play(efkUrl, spawnOffset);
    } else if (!isPlaying) {
      stop();
    }
  }, [ready, isPlaying, efkUrl, spawnOffset, play, stop]);

  return null;
};

// ─── Spawn Point Gizmo ────────────────────────────────────────────────────────

const SpawnGizmo: React.FC<{
  position: [number, number, number];
  onChange: (pos: [number, number, number]) => void;
}> = ({ position, onChange }) => {
  const markerRef = useRef<THREE.Mesh>(null);
  const handleChange = useCallback(() => {
    if (!markerRef.current) return;
    const p = markerRef.current.position;
    onChange([
      parseFloat(p.x.toFixed(3)),
      parseFloat(p.y.toFixed(3)),
      parseFloat(p.z.toFixed(3)),
    ]);
  }, [onChange]);

  return (
    <TransformControls mode="translate" onObjectChange={handleChange}>
      <mesh ref={markerRef} position={position}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshBasicMaterial color="#fbbf24" wireframe />
      </mesh>
    </TransformControls>
  );
};

// ─── Scene Interior (R3F children) ───────────────────────────────────────────

const EffectLabSceneContent: React.FC<EffectLabSceneProps & {
  onEfkError: (err: string) => void;
}> = ({
  preset,
  params,
  isPlaying,
  loop,
  efkUrl,
  spawnOffset,
  onSpawnOffsetChange,
  HeroVoxelComponent,
  onEfkError,
}) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={1.1} color="#f8fafc" />
      <hemisphereLight intensity={0.7} color="#dbeafe" groundColor="#0f172a" />
      <directionalLight
        position={[3, 6, 5]}
        intensity={1.15}
        color="#f8fafc"
        castShadow
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
      />
      <pointLight position={[-3, 2.6, 2]} intensity={1.2} color="#38bdf8" distance={12} />
      <pointLight position={[2.2, 2.2, 1.5]} intensity={0.9} color="#f97316" distance={10} />

      {/* Environment */}
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 10, 26]} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 1.45, 8.2]} fov={36} onUpdate={(c) => c.lookAt(0, 0.15, 0)} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={3}
        maxDistance={14}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.75}
        target={[0, 0.8, 0]}
      />

      {/* Ground */}
      <group position={[0, -1.12, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[3.8, 48]} />
          <meshStandardMaterial color="#0f172a" roughness={0.82} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.5, 3.2, 48]} />
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#0284c7"
            emissiveIntensity={0.4}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <ContactShadows position={[0, -1.11, 0]} scale={5.4} blur={2.6} opacity={0.42} far={2.2} color="#4b2e2a" />

      {/* Mannequin */}
      <Suspense fallback={null}>
        <HeroVoxelComponent
          classId="knight"
          playerAnimationAction="battle-idle"
          previewLoopAllActions
          isAttacking={false}
          isDefending={false}
          idlePositionX={0}
          attackPositionX={0.35}
          defendPositionX={-0.15}
          originPosition={[0, -1, 0]}
          baseRotationY={0.35}
          contactShadowResolution={quality.contactShadowResolution}
        />
      </Suspense>

      {/* Procedural effects (always rendered as fallback) */}
      <ProceduralEffectEngine
        preset={preset}
        params={params}
        isPlaying={isPlaying && !efkUrl}
        loop={loop}
        spawnOffset={spawnOffset}
      />

      {/* Effekseer (only when efkUrl provided) */}
      {efkUrl && (
        <EffekseerPlayback
          efkUrl={efkUrl}
          isPlaying={isPlaying}
          spawnOffset={spawnOffset}
          onError={onEfkError}
        />
      )}

      {/* Spawn point gizmo */}
      {onSpawnOffsetChange && (
        <SpawnGizmo position={spawnOffset} onChange={onSpawnOffsetChange} />
      )}
    </>
  );
};

// ─── Public Component ─────────────────────────────────────────────────────────

export const EffectLabRenderer: React.FC<EffectLabSceneProps & {
  onEfkError?: (err: string) => void;
}> = (props) => {
  const quality = useMemo(() => getRenderQualityProfile(), []);
  const powerPreference = useMemo(() => getRenderPowerPreference(), []);
  const handleEfkError = props.onEfkError ?? (() => {});

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.14),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.99))]">
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference }}
        performance={{ min: 0.5 }}
      >
        <EffectLabSceneContent {...props} onEfkError={handleEfkError} />
      </Canvas>
    </div>
  );
};
