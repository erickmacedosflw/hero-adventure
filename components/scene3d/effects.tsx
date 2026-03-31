import React, { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FloatingText, Particle } from '../../types';

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
  const startTimeRef = useRef<number | null>(null);
  const basePosition = useMemo<[number, number, number]>(() => (
    target === 'player'
      ? [-2, 1.48 - stackIndex * 0.24, 0.15]
      : [2, 1.62 - stackIndex * 0.24, 0.15]
  ), [stackIndex, target]);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const lift = Math.min(elapsed * 0.34, 0.28);
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

  const textSize = type === 'crit'
    ? 'text-3xl'
    : type === 'buff'
      ? 'text-lg'
      : type === 'skill' || type === 'item'
        ? 'text-xl'
        : 'text-2xl';

  return (
    <group ref={groupRef} position={basePosition}>
      <Html center sprite distanceFactor={10} zIndexRange={[120, 0]}>
        <div
          className={`px-1 text-center font-black whitespace-nowrap leading-none ${tone} ${textSize} select-none`}
          style={{
            WebkitTextStroke: '4px rgba(255,255,255,1)',
            paintOrder: 'stroke fill',
            opacity: 0.94,
          }}
        >
          {text.text}
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
