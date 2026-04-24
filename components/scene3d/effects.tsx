import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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

export const WorldLootDisplay = ({ loot }: { loot: LootResultData | null }) => {
  const groupRef = useRef<THREE.Group>(null);
  const htmlRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const DURATION = 3.0;

  // Reset animation whenever a new loot result appears
  useEffect(() => {
    if (loot) {
      startTimeRef.current = null;
    }
  }, [loot]);

  useFrame((state) => {
    if (!groupRef.current || !loot) return;
    if (startTimeRef.current === null) startTimeRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const progress = Math.min(1, elapsed / DURATION);
    const lift = elapsed * 0.22;
    groupRef.current.position.set(2, 0.5 + lift, 0.15);
    let opacity = 1;
    if (progress < 0.12) {
      opacity = progress / 0.12;
    } else if (progress > 0.65) {
      const t = (progress - 0.65) / 0.35;
      const s = t * t * (3 - 2 * t);
      opacity = 1 - s;
    }
    if (htmlRef.current) htmlRef.current.style.opacity = String(Math.max(0, opacity));
  });

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
    <group ref={groupRef} position={[2, 0.5, 0.15]}>
      <Html center sprite distanceFactor={10} zIndexRange={[120, 0]}>
        <div ref={htmlRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', opacity: 0, pointerEvents: 'none' }}>
          {/* Gold */}
          <div style={rowStyle}>
            <img src={_COIN_URL} style={imgStyle} draggable={false} alt="Ouro" />
            <span style={valStyle('#fbbf24')}>+{loot.gold}</span>
          </div>
          {/* XP */}
          <div style={rowStyle}>
            <img src={_XP_URL} style={imgStyle} draggable={false} alt="XP" />
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
  const [alive, setAlive] = useState(true);
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
    if (ref.current && alive) {
      lifeRef.current -= delta / ttlSeconds;
      ref.current.position.x += velocity[0] * delta;
      ref.current.position.y += velocity[1] * delta;
      ref.current.position.z += velocity[2] * delta;

      const life = Math.max(lifeRef.current, 0);
      const fade = Math.min(Math.max(life / maxLife, 0), 1);
      const baseScale = Math.max(0.06, scale);
      ref.current.scale.setScalar(Math.max(0.02, baseScale * fade));

      if (mode === 'sprite2d') {
        ref.current.quaternion.copy(state.camera.quaternion);
      } else {
        ref.current.rotation.x += spinSeed[0] * delta * 0.2;
        ref.current.rotation.y += spinSeed[1] * delta * 0.2;
        ref.current.rotation.z += spinSeed[2] * delta * 0.2;
      }

      if (materialRef.current instanceof THREE.MeshBasicMaterial || materialRef.current instanceof THREE.MeshStandardMaterial) {
        materialRef.current.opacity = mode === 'shard3d' ? Math.max(0.16, fade) : Math.max(0.08, fade * 0.92);
      }

      if (life <= 0) {
        setAlive(false);
      }
    }
  });

  if (!alive) {
    return null;
  }

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

const WorldFloatingText = ({
  text,
  type,
  target,
  stackIndex,
}: {
  text: FloatingText;
  type: FloatingText['type'];
  target: FloatingText['target'];
  stackIndex: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const basePosition = useMemo<[number, number, number]>(() => (
    target === 'player'
      ? [-2, 1.48 - stackIndex * 0.24, 0.15]
      : [2, 1.62 - stackIndex * 0.24, 0.15]
  ), [stackIndex, target]);
  const durationSeconds = Math.max(0.2, (text.durationMs ?? 1100) / 1000);

  useFrame((state) => {
    if (!groupRef.current) {
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
            WebkitTextStroke: (type === 'item' && text.iconImage) ? undefined : '4px rgba(255,255,255,1)',
            paintOrder: 'stroke fill',
            opacity: 0.94,
            transition: 'opacity 80ms linear, transform 80ms linear',
            ...customToneStyle,
            ...(type === 'item' && text.iconImage ? undefined : itemOutlineStyle),
          }}
        >
          {type === 'item' && text.iconImage
            ? (
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', lineHeight: 1 }}>
                  <span style={{ opacity: 0 }}>{text.text}</span>
                  <img src={text.iconImage} draggable={false} alt={text.text} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                </span>
              )
            : text.text}
        </div>
      </Html>
    </group>
  );
};

export const WorldFloatingTexts = ({ texts = [] }: { texts?: FloatingText[] }) => {
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
        />
      ))}
    </group>
  );
};
