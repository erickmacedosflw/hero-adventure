import React, { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FloatingText, Particle } from '../../types';

export const MeshParticle: React.FC<Particle> = ({ position, color, velocity }) => {
  const ref = useRef<THREE.Mesh>(null);
  const [alive, setAlive] = useState(true);

  useFrame((_, delta) => {
    if (ref.current && alive) {
      ref.current.position.x += velocity[0] * delta;
      ref.current.position.y += velocity[1] * delta;
      ref.current.position.z += velocity[2] * delta;
      ref.current.scale.multiplyScalar(0.95);
      if (ref.current.scale.x < 0.01) {
        setAlive(false);
      }
    }
  });

  if (!alive) {
    return null;
  }

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
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
    ? 'text-red-400'
    : type === 'heal'
      ? 'text-emerald-300'
      : type === 'crit'
        ? 'text-amber-300'
        : 'text-sky-300';

  const textSize = type === 'crit' ? 'text-3xl' : type === 'buff' ? 'text-lg' : 'text-2xl';

  return (
    <group ref={groupRef} position={basePosition}>
      <Html center sprite distanceFactor={10} zIndexRange={[120, 0]}>
        <div className={`min-w-[5.5rem] rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 text-center font-black ${tone} ${textSize} shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-[2px] select-none`}>
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