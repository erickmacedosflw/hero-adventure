import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { FloatingText, Item, Particle } from '../../types';

const _COIN_URL = new URL('../../game/assets/Icons/Misc/Golden Coin.png', import.meta.url).href;
const _DIAMOND_URL = new URL('../../game/assets/Icons/Ore & Gem/Diamond.png', import.meta.url).href;
const _XP_URL = new URL('../../game/assets/Icons/Misc/Rune Stone.png', import.meta.url).href;

export interface LootResultData {
  gold: number;
  xp: number;
  diamonds?: number;
  drops: Item[];
  isBoss: boolean;
}

export const WorldLootDisplay = ({ loot, xpIcon, enemyAnchor }: { loot: LootResultData | null; xpIcon?: React.ReactNode; enemyAnchor?: [number, number, number] }) => {
  const groupRef = useRef<THREE.Group>(null);
  // Three's <Html> renders children via ReactDOM.createRoot().render() — async (concurrent mode).
  // So htmlRef is null when useGSAP first fires (useLayoutEffect). We use a callback ref +
  // htmlReady state so useGSAP re-runs once the portal div actually commits to the DOM.
  const htmlRef = useRef<HTMLDivElement | null>(null);
  const [htmlReady, setHtmlReady] = useState(false);
  const htmlCallbackRef = useCallback((el: HTMLDivElement | null) => {
    htmlRef.current = el;
    // Always update htmlReady so it toggles false→true on each new mount.
    // If we only call setHtmlReady(true) and never reset, the second kill finds
    // htmlReady already true → setHtmlReady(true) is a no-op → useGSAP never
    // re-fires with htmlRef.current set → loot animation never plays again.
    setHtmlReady(el !== null);
  }, []);

  useGSAP(() => {
    if (!loot || !groupRef.current || !htmlRef.current) return;

    const ax = enemyAnchor?.[0] ?? 2;
    const ay = enemyAnchor?.[1] ?? 0.5;
    const az = enemyAnchor?.[2] ?? 0.15;

    groupRef.current.position.set(ax, ay, az);
    gsap.set(htmlRef.current, { opacity: 0 });

    const tl = gsap.timeline();
    // Lift the 3D group over 3 s
    tl.to(groupRef.current.position, { y: ay + 0.66, duration: 3, ease: 'none' }, 0);
    // Fade in over first 12 % (0.36 s)
    tl.to(htmlRef.current, { opacity: 1, duration: 0.36, ease: 'power1.out' }, 0);
    // Fade out from 65 % (1.95 s) to end
    tl.to(htmlRef.current, { opacity: 0, duration: 1.05, ease: 'power2.in' }, 1.95);
  }, { dependencies: [loot, htmlReady] });

  if (!loot) return null;

  const borderColor = loot.isBoss ? 'rgba(251,191,36,0.7)' : 'rgba(180,140,100,0.5)';

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(0,0,0,0.72)',
    borderRadius: '22px',
    padding: '5px 12px 5px 6px',
    border: `1px solid ${borderColor}`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
    whiteSpace: 'nowrap' as const,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  };
  const imgStyle: React.CSSProperties = { width: 26, height: 26, objectFit: 'contain', flexShrink: 0 };
  const valStyle = (color: string): React.CSSProperties => ({
    color, fontWeight: 900, fontSize: '15px', letterSpacing: '0.02em',
  });

  const itemBorderColor = (rarity: Item['rarity']) =>
    rarity === 'gold' ? 'rgba(251,191,36,0.65)'
    : rarity === 'silver' ? 'rgba(148,163,184,0.65)'
    : 'rgba(180,140,100,0.5)';
  const itemColor = (rarity: Item['rarity']) =>
    rarity === 'gold' ? '#fcd34d' : rarity === 'silver' ? '#cbd5e1' : '#d4a07a';

  return (
    <group ref={groupRef} position={enemyAnchor ?? [2, 0.5, 0.15]}>
      <Html center sprite distanceFactor={10} zIndexRange={[120, 0]}>
        <div ref={htmlCallbackRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', opacity: 0, pointerEvents: 'none' }}>
          {/* Gold */}
          <div style={rowStyle}>
            <img src={_COIN_URL} style={imgStyle} draggable={false} alt="Ouro" />
            <span style={valStyle('#fbbf24')}>+{loot.gold}</span>
          </div>
          {/* XP */}
          <div style={rowStyle}>
            {xpIcon
              ? <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{xpIcon}</span>
              : <img src={_XP_URL} style={imgStyle} draggable={false} alt="XP" />}
            <span style={valStyle('#d97706')}>+{loot.xp} XP</span>
          </div>
          {/* Diamonds */}
          {loot.diamonds && loot.diamonds > 0 && (
            <div style={rowStyle}>
              <img src={_DIAMOND_URL} style={imgStyle} draggable={false} alt="Gema" />
              <span style={valStyle('#38bdf8')}>+{loot.diamonds}</span>
            </div>
          )}
          {/* Item drops */}
          {loot.drops.map((drop) => (
            <div key={drop.id} style={{ ...rowStyle, border: `1px solid ${itemBorderColor(drop.rarity)}` }}>
              {drop.iconImage
                ? <img src={drop.iconImage} style={imgStyle} draggable={false} alt={drop.name} />
                : <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{drop.icon}</span>}
              <span style={{ ...valStyle(itemColor(drop.rarity)), fontSize: '12px' }}>{drop.name}</span>
            </div>
          ))}
        </div>
      </Html>
    </group>
  );
};

const SOFT_PARTICLE_TEXTURE = (() => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let offset = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const dist = Math.sqrt((nx * nx) + (ny * ny));
      const alpha = Math.max(0, 1 - dist);
      const intensity = Math.floor(255 * Math.pow(alpha, 1.9));
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = intensity;
      offset += 4;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
})();

export const MeshParticle: React.FC<Particle> = ({ position, color, velocity, scale = 0.22, life = 1, ttl = 0.9, renderMode }) => {
  const ref = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.Material>(null);
  const lifeRef = useRef(Math.max(0.05, life));
  const rotationSeed = useMemo<[number, number, number]>(() => (
    [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]
  ), []);
  const spinSeed = useMemo<[number, number, number]>(() => (
    [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8]
  ), []);
  const mode = renderMode ?? 'sprite2d';
  const maxLife = Math.max(0.05, life);
  const ttlSeconds = Math.max(0.2, ttl);

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group) return;

    lifeRef.current -= delta / ttlSeconds;
    const currentLife = Math.max(lifeRef.current, 0);

    if (currentLife <= 0) {
      // Hide via Three.js — zero React state updates, no re-render burst.
      // The store's expiresAt + pruneExpired cycle will unmount this cleanly.
      group.visible = false;
      return;
    }

    group.visible = true;
    group.position.x += velocity[0] * delta;
    group.position.y += velocity[1] * delta;
    group.position.z += velocity[2] * delta;

    const fade = Math.min(Math.max(currentLife / maxLife, 0), 1);
    const baseScale = Math.max(0.06, scale);
    group.scale.setScalar(Math.max(0.02, baseScale * fade));

    if (mode === 'sprite2d') {
      group.quaternion.copy(state.camera.quaternion);
    } else {
      group.rotation.x += spinSeed[0] * delta * 0.2;
      group.rotation.y += spinSeed[1] * delta * 0.2;
      group.rotation.z += spinSeed[2] * delta * 0.2;
    }

    if (materialRef.current instanceof THREE.MeshBasicMaterial || materialRef.current instanceof THREE.MeshStandardMaterial) {
      materialRef.current.opacity = mode === 'shard3d' ? Math.max(0.16, fade) : Math.max(0.08, fade * 0.92);
    }
  });

  if (mode === 'shard3d') {
    return (
      <group ref={ref} position={position} rotation={rotationSeed}>
        <mesh castShadow={false} receiveShadow={false}>
          <tetrahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            ref={materialRef as React.MutableRefObject<THREE.MeshStandardMaterial | null>}
            color={color}
            emissive={color}
            emissiveIntensity={0.42}
            roughness={0.44}
            metalness={0.05}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={ref} position={position}>
      <mesh castShadow={false} receiveShadow={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={materialRef as React.MutableRefObject<THREE.MeshBasicMaterial | null>}
          map={SOFT_PARTICLE_TEXTURE}
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

// ─── InstancedParticles ───────────────────────────────────────────────────────
// Replaces individual <MeshParticle> JSX: both render modes share at most
// 2 InstancedMesh draw calls regardless of active particle count (up to 80).

const MAX_PARTICLE_INSTANCES = 80;

interface ParticleRuntimeState {
  id: string;
  x: number; y: number; z: number;
  life: number;   // remaining (decrements toward 0)
  maxLife: number;
  ttl: number;
  vx: number; vy: number; vz: number;
  scale: number;
  color: THREE.Color;
  mode: 'sprite2d' | 'shard3d';
  rx: number; ry: number; rz: number;
  spinX: number; spinY: number; spinZ: number;
}

export const InstancedParticles: React.FC<{ particles: Particle[] }> = ({ particles }) => {
  const sprite2dRef = useRef<THREE.InstancedMesh>(null);
  const shard3dRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorBuf = useMemo(() => new THREE.Color(), []);
  const runtimeStates = useRef(new Map<string, ParticleRuntimeState>());

  useFrame((state, delta) => {
    const mesh2d = sprite2dRef.current;
    const mesh3d = shard3dRef.current;
    if (!mesh2d || !mesh3d) return;

    // Add new particles; remove ones no longer in the store
    const activeIds = new Set(particles.map((p) => p.id));
    for (const id of runtimeStates.current.keys()) {
      if (!activeIds.has(id)) runtimeStates.current.delete(id);
    }
    for (const p of particles) {
      if (!runtimeStates.current.has(p.id)) {
        const maxLife = Math.max(0.05, p.life ?? 1);
        runtimeStates.current.set(p.id, {
          id: p.id,
          x: p.position[0], y: p.position[1], z: p.position[2],
          life: maxLife,
          maxLife,
          ttl: Math.max(0.2, p.ttl ?? 0.9),
          vx: p.velocity[0], vy: p.velocity[1], vz: p.velocity[2],
          scale: p.scale ?? 0.22,
          color: new THREE.Color(p.color),
          mode: p.renderMode ?? 'sprite2d',
          rx: Math.random() * Math.PI,
          ry: Math.random() * Math.PI,
          rz: Math.random() * Math.PI,
          spinX: (Math.random() - 0.5) * 1.6,
          spinY: (Math.random() - 0.5) * 1.6,
          spinZ: (Math.random() - 0.5) * 1.6,
        });
      }
    }

    let i2 = 0;
    let i3 = 0;

    for (const s of runtimeStates.current.values()) {
      s.x += s.vx * delta;
      s.y += s.vy * delta;
      s.z += s.vz * delta;
      s.life -= delta / s.ttl;

      const fade = Math.max(0, Math.min(s.life / s.maxLife, 1));
      if (fade <= 0) continue;

      const sc = Math.max(0.02, Math.max(0.06, s.scale) * fade);

      if (s.mode === 'shard3d') {
        if (i3 >= MAX_PARTICLE_INSTANCES) continue;
        s.rx += s.spinX * delta;
        s.ry += s.spinY * delta;
        s.rz += s.spinZ * delta;
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(s.rx, s.ry, s.rz);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        mesh3d.setMatrixAt(i3, dummy.matrix);
        // Encode fade into color: AdditiveBlending treats near-black as transparent
        colorBuf.copy(s.color).multiplyScalar(Math.max(0.16, fade));
        mesh3d.setColorAt(i3, colorBuf);
        i3++;
      } else {
        if (i2 >= MAX_PARTICLE_INSTANCES) continue;
        dummy.position.set(s.x, s.y, s.z);
        dummy.quaternion.copy(state.camera.quaternion);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        mesh2d.setMatrixAt(i2, dummy.matrix);
        colorBuf.copy(s.color).multiplyScalar(Math.max(0.08, fade * 0.92));
        mesh2d.setColorAt(i2, colorBuf);
        i2++;
      }
    }

    // Only push buffers to the GPU when something actually changed.
    const prev2d = mesh2d.count;
    const prev3d = mesh3d.count;
    mesh2d.count = i2;
    mesh3d.count = i3;
    if (i2 > 0 || prev2d > 0) {
      mesh2d.instanceMatrix.needsUpdate = true;
      if (mesh2d.instanceColor) mesh2d.instanceColor.needsUpdate = true;
    }
    if (i3 > 0 || prev3d > 0) {
      mesh3d.instanceMatrix.needsUpdate = true;
      if (mesh3d.instanceColor) mesh3d.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={sprite2dRef} args={[undefined, undefined, MAX_PARTICLE_INSTANCES]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={SOFT_PARTICLE_TEXTURE}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={shard3dRef} args={[undefined, undefined, MAX_PARTICLE_INSTANCES]} frustumCulled={false}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
};

const WorldFloatingText = ({
  text,
  type,
  target,
  stackIndex,
  enemyAnchor,
}: {
  text: FloatingText;
  type: FloatingText['type'];
  target: FloatingText['target'];
  stackIndex: number;
  enemyAnchor?: [number, number, number];
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const basePosition = useMemo<[number, number, number]>(() => {
    if (target === 'player') return [-2, 1.48 - stackIndex * 0.24, 0.15];
    const ax = enemyAnchor?.[0] ?? 2;
    const ay = (enemyAnchor?.[1] ?? 0.5) + 1.12;
    const az = enemyAnchor?.[2] ?? 0.15;
    return [ax, ay - stackIndex * 0.24, az];
  }, [stackIndex, target, enemyAnchor]);
  const durationSeconds = Math.max(0.2, (text.durationMs ?? 1100) / 1000);

  useFrame((state) => {
    if (!groupRef.current || doneRef.current) {
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const progress = Math.max(0, Math.min(1, elapsed / durationSeconds));
    const lift = Math.min(elapsed * 0.34, 0.28);
    const fadeStart = 0.42;
    const linearFade = progress <= fadeStart ? 0 : (progress - fadeStart) / (1 - fadeStart);
    const fadeProgress = Math.max(0, Math.min(1, linearFade));
    const smoothFade = fadeProgress * fadeProgress * (3 - (2 * fadeProgress));
    const opacity = 1 - smoothFade;
    if (textRef.current) {
      textRef.current.style.opacity = opacity.toString();
      textRef.current.style.transform = `translateY(${-8 * smoothFade}px) scale(${1 - (smoothFade * 0.07)})`;
    }
    groupRef.current.position.set(basePosition[0], basePosition[1] + lift, basePosition[2]);
    if (progress >= 1) {
      doneRef.current = true;
    }
  });

  const tone = type === 'damage'
    ? 'text-red-500'
    : type === 'heal'
      ? 'text-emerald-400'
      : type === 'crit'
        ? 'text-amber-400'
        : type === 'skill'
          ? 'text-fuchsia-400'
          : type === 'item'
            ? 'text-yellow-300'
            : 'text-sky-400';
  const customToneStyle = text.color ? { color: text.color } : undefined;
  const itemOutlineStyle = type === 'item'
    ? {
      filter: [
        'drop-shadow(0 0 2px rgba(255,255,255,1))',
        'drop-shadow(0 0 6px rgba(255,255,255,0.95))',
        'drop-shadow(0 0 10px rgba(255,255,255,0.9))',
      ].join(' '),
      textShadow: [
        '0 0 2px rgba(255,255,255,1)',
        '0 0 6px rgba(255,255,255,0.9)',
      ].join(', '),
    }
    : undefined;

  const textSize = type === 'crit'
    ? 'text-3xl'
    : type === 'buff'
      ? 'text-lg'
      : type === 'item'
        ? 'text-5xl'
        : type === 'skill'
        ? 'text-xl'
        : 'text-2xl';

  return (
    <group ref={groupRef} position={basePosition}>
      <Html center sprite distanceFactor={10} zIndexRange={[120, 0]}>
        <div
          ref={textRef}
          className={`px-1 text-center font-black whitespace-nowrap leading-none ${tone} ${textSize} select-none flex items-center justify-center`}
          style={{
            WebkitTextStroke: ((type === 'item' || type === 'skill') && text.iconImage) ? undefined : '4px rgba(255,255,255,1)',
            paintOrder: 'stroke fill',
            opacity: 0.94,
            transition: 'opacity 80ms linear, transform 80ms linear',
            ...customToneStyle,
            ...((type === 'item' || type === 'skill') && text.iconImage ? undefined : itemOutlineStyle),
          }}
        >
          {type === 'item' && text.iconImage
            ? (
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', lineHeight: 1 }}>
                  <span style={{ opacity: 0 }}>{text.text}</span>
                  <img src={text.iconImage} draggable={false} alt={text.text} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                </span>
              )
            : type === 'skill' && text.iconImage
              ? (
                  <>
                    <style>{`@keyframes _skillIconPop { from { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } to { transform: scale(1); opacity: 1; } }`}</style>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 72,
                      height: 72,
                      borderRadius: 14,
                      border: '3px solid rgba(255,255,255,0.95)',
                      overflow: 'hidden',
                      boxShadow: '0 0 18px rgba(200,160,255,0.55), 0 3px 10px rgba(0,0,0,0.5)',
                      animation: '_skillIconPop 0.30s cubic-bezier(0.34,1.56,0.64,1) both',
                    }}>
                      <img src={text.iconImage} draggable={false} alt={text.text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </span>
                  </>
                )
              : text.text}
        </div>
      </Html>
    </group>
  );
};

export const WorldFloatingTexts = ({ texts = [], enemyAnchor }: { texts?: FloatingText[]; enemyAnchor?: [number, number, number] }) => {
  const stackIndexes = (() => {
    const nextIndexes = { player: 0, enemy: 0 };
    const result: Record<string, number> = {};

    texts.forEach((text) => {
      result[text.id] = nextIndexes[text.target];
      nextIndexes[text.target] += 1;
    });

    return result;
  })();

  return (
    <group>
      {texts.map((text) => (
        <WorldFloatingText
          key={text.id}
          text={text}
          type={text.type}
          target={text.target}
          stackIndex={stackIndexes[text.id] ?? 0}
          enemyAnchor={enemyAnchor}
        />
      ))}
    </group>
  );
};
