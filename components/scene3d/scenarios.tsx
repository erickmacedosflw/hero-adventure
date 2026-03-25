import React, { useMemo, Suspense } from 'react';
import { useFBX, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { ScenarioDefinition } from '../../game/data/scenarios';

/* ─── static asset URLs (Vite can resolve these at build time) ─── */

const FOREST_TEXTURE = new URL('../../game/assets/Scenario/Florest/forest_texture.png', import.meta.url).href;

// We use a curated subset of models to keep loads reasonable
const FOREST_URLS = {
  tree1: new URL('../../game/assets/Scenario/Florest/Tree_1_A_Color1.fbx', import.meta.url).href,
  tree2: new URL('../../game/assets/Scenario/Florest/Tree_2_A_Color1.fbx', import.meta.url).href,
  tree3: new URL('../../game/assets/Scenario/Florest/Tree_3_A_Color1.fbx', import.meta.url).href,
  tree4: new URL('../../game/assets/Scenario/Florest/Tree_4_A_Color1.fbx', import.meta.url).href,
  bush1: new URL('../../game/assets/Scenario/Florest/Bush_1_A_Color1.fbx', import.meta.url).href,
  bush2: new URL('../../game/assets/Scenario/Florest/Bush_2_A_Color1.fbx', import.meta.url).href,
  bush3: new URL('../../game/assets/Scenario/Florest/Bush_3_A_Color1.fbx', import.meta.url).href,
  rock1: new URL('../../game/assets/Scenario/Florest/Rock_1_A_Color1.fbx', import.meta.url).href,
  rock2: new URL('../../game/assets/Scenario/Florest/Rock_2_A_Color1.fbx', import.meta.url).href,
  rock3: new URL('../../game/assets/Scenario/Florest/Rock_3_A_Color1.fbx', import.meta.url).href,
  grass1: new URL('../../game/assets/Scenario/Florest/Grass_1_A_Color1.fbx', import.meta.url).href,
  grass2: new URL('../../game/assets/Scenario/Florest/Grass_2_A_Color1.fbx', import.meta.url).href,
};

/* ─── Apply texture to existing FBX materials (preserves UVs and material setup) ─── */

function cloneWithTexture(source: THREE.Group, texture: THREE.Texture): THREE.Group {
  const clone = source.clone(true);
  clone.traverse((child: any) => {
    if (!child.isMesh) return;

    const applyTexture = (mat: any) => {
      if (mat.isMeshPhongMaterial || mat.isMeshLambertMaterial || mat.isMeshStandardMaterial) {
        mat.map = texture;
        mat.needsUpdate = true;
      } else {
        // Convert unknown material types to MeshStandardMaterial preserving color
        const replacement = new THREE.MeshStandardMaterial({
          map: texture,
          color: mat.color?.clone() ?? new THREE.Color(0xffffff),
          side: mat.side ?? THREE.FrontSide,
          transparent: Boolean(mat.transparent),
          opacity: mat.opacity ?? 1,
          roughness: 0.85,
          metalness: 0.05,
        });
        return replacement;
      }
      return mat;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map((m: THREE.Material) => applyTexture(m));
    } else if (child.material) {
      child.material = applyTexture(child.material);
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return clone;
}

/* ─── prop placement data (seeded once) ─── */

interface PropEntry {
  key: keyof typeof FOREST_URLS;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

const rng = (min: number, max: number) => min + Math.random() * (max - min);
const pickKey = <T extends string>(keys: T[]): T => keys[Math.floor(Math.random() * keys.length)];

const TREE_KEYS: (keyof typeof FOREST_URLS)[] = ['tree1', 'tree2', 'tree3', 'tree4'];
const BUSH_KEYS: (keyof typeof FOREST_URLS)[] = ['bush1', 'bush2', 'bush3'];
const ROCK_KEYS: (keyof typeof FOREST_URLS)[] = ['rock1', 'rock2', 'rock3'];
const GRASS_KEYS: (keyof typeof FOREST_URLS)[] = ['grass1', 'grass2'];

function buildForestLayout(): PropEntry[] {
  const entries: PropEntry[] = [];

  // Background trees (behind characters)
  const bgTrees: [number, number, number][] = [
    [-10, -1.05, -6], [-6, -1.05, -8], [-2, -1.05, -9], [2, -1.05, -8],
    [6, -1.05, -7],  [10, -1.05, -6], [-14, -1.05, -7], [14, -1.05, -7],
    [-8, -1.05, -12], [0, -1.05, -13], [8, -1.05, -12], [-4, -1.05, -16],
    [4, -1.05, -15], [-12, -1.05, -14], [12, -1.05, -14],
    [-16, -1.05, -10], [16, -1.05, -10],
  ];
  for (const p of bgTrees) {
    entries.push({ key: pickKey(TREE_KEYS), position: p, rotationY: rng(0, Math.PI * 2), scale: rng(0.018, 0.026) });
  }

  // Side trees (flanks)
  const sideTrees: [number, number, number][] = [
    [-10, -1.05, 0], [-12, -1.05, 3], [-14, -1.05, -1], [-11, -1.05, 5],
    [10, -1.05, 0],  [12, -1.05, 3],  [14, -1.05, -1],  [11, -1.05, 5],
    [-16, -1.05, 2], [16, -1.05, 2],
  ];
  for (const p of sideTrees) {
    entries.push({ key: pickKey(TREE_KEYS), position: p, rotationY: rng(0, Math.PI * 2), scale: rng(0.02, 0.028) });
  }

  // Bushes (edges, not center)
  const bushes: [number, number, number][] = [
    [-8, -1.1, -3], [-6, -1.1, 2], [7, -1.1, -3], [8, -1.1, 2],
    [-5, -1.1, -6], [5, -1.1, -5], [-9, -1.1, 4],  [9, -1.1, 4],
    [-3, -1.1, 5],  [3, -1.1, 5],  [-12, -1.1, -3], [12, -1.1, -3],
    [-7, -1.1, -8], [7, -1.1, -8],
  ];
  for (const p of bushes) {
    entries.push({ key: pickKey(BUSH_KEYS), position: p, rotationY: rng(0, Math.PI * 2), scale: rng(0.016, 0.024) });
  }

  // Rocks
  const rocks: [number, number, number][] = [
    [-7, -1.12, -1], [8, -1.12, -1], [-4, -1.12, 4],
    [5, -1.12, 4],   [-10, -1.12, -5], [11, -1.12, -5],
  ];
  for (const p of rocks) {
    entries.push({ key: pickKey(ROCK_KEYS), position: p, rotationY: rng(0, Math.PI * 2), scale: rng(0.014, 0.022) });
  }

  // Grass
  const grass: [number, number, number][] = [
    [-3, -1.1, 2], [3, -1.1, 2], [-6, -1.1, -1], [6, -1.1, -1],
    [0, -1.1, 4],  [-8, -1.1, 1], [8, -1.1, 1],  [0, -1.1, -5],
    [-5, -1.1, 3], [5, -1.1, 3],  [-2, -1.1, -3], [2, -1.1, -3],
  ];
  for (const p of grass) {
    entries.push({ key: pickKey(GRASS_KEYS), position: p, rotationY: rng(0, Math.PI * 2), scale: rng(0.016, 0.024) });
  }

  return entries;
}

// Build layout once at module load
const FOREST_LAYOUT = buildForestLayout();

/* ─── Ground ─── */

const ScenarioGround = ({ color, colorAlt }: { color: string; colorAlt: string }) => {
  const tiles = useMemo(() => {
    const arr: { pos: [number, number, number]; color: string; h: number }[] = [];
    for (let x = -40; x <= 40; x += 8) {
      for (let z = -50; z <= 20; z += 8) {
        arr.push({
          pos: [x, -1.15, z],
          color: Math.random() > 0.5 ? color : colorAlt,
          h: 0.08 + Math.random() * 0.1,
        });
      }
    }
    return arr;
  }, [color, colorAlt]);

  return (
    <group>
      {tiles.map((t, i) => (
        <mesh key={i} position={t.pos} receiveShadow>
          <boxGeometry args={[8, t.h, 8]} />
          <meshStandardMaterial color={t.color} />
        </mesh>
      ))}
    </group>
  );
};

/* ─── Forest Props (loads all 12 models once, then clones per placement) ─── */

const ForestProps = ({ entries, lowQuality }: { entries: PropEntry[]; lowQuality: boolean }) => {
  const texture = useTexture(FOREST_TEXTURE);

  useMemo(() => {
    // Nature pack FBX models use standard UV convention (flipY = true, the default)
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  // Load all 12 distinct FBX sources (hooks called unconditionally with fixed count)
  const srcTree1 = useFBX(FOREST_URLS.tree1);
  const srcTree2 = useFBX(FOREST_URLS.tree2);
  const srcTree3 = useFBX(FOREST_URLS.tree3);
  const srcTree4 = useFBX(FOREST_URLS.tree4);
  const srcBush1 = useFBX(FOREST_URLS.bush1);
  const srcBush2 = useFBX(FOREST_URLS.bush2);
  const srcBush3 = useFBX(FOREST_URLS.bush3);
  const srcRock1 = useFBX(FOREST_URLS.rock1);
  const srcRock2 = useFBX(FOREST_URLS.rock2);
  const srcRock3 = useFBX(FOREST_URLS.rock3);
  const srcGrass1 = useFBX(FOREST_URLS.grass1);
  const srcGrass2 = useFBX(FOREST_URLS.grass2);

  const sourceMap: Record<string, THREE.Group> = useMemo(() => ({
    tree1: srcTree1, tree2: srcTree2, tree3: srcTree3, tree4: srcTree4,
    bush1: srcBush1, bush2: srcBush2, bush3: srcBush3,
    rock1: srcRock1, rock2: srcRock2, rock3: srcRock3,
    grass1: srcGrass1, grass2: srcGrass2,
  }), [srcTree1, srcTree2, srcTree3, srcTree4, srcBush1, srcBush2, srcBush3, srcRock1, srcRock2, srcRock3, srcGrass1, srcGrass2]);

  const filtered = useMemo(() => {
    if (!lowQuality) return entries;
    return entries.filter((e) => {
      if (e.key.startsWith('grass')) return false;
      if (e.key.startsWith('bush') && Math.random() > 0.5) return false;
      return true;
    });
  }, [entries, lowQuality]);

  const clones = useMemo(() =>
    filtered.map((entry) => ({
      ...entry,
      model: cloneWithTexture(sourceMap[entry.key], texture),
    })),
  [filtered, sourceMap, texture]);

  return (
    <group>
      {clones.map((c, i) => (
        <primitive
          key={i}
          object={c.model}
          position={c.position}
          rotation={[0, c.rotationY, 0]}
          scale={c.scale}
        />
      ))}
    </group>
  );
};

/* ─── Full Battle Scenario ─── */

export const BattleScenario = ({ scenario, lowQuality = false }: { scenario: ScenarioDefinition; lowQuality?: boolean }) => (
  <group>
    <ScenarioGround color={scenario.groundColor} colorAlt={scenario.groundColorAlt} />
    <Suspense fallback={null}>
      <ForestProps entries={FOREST_LAYOUT} lowQuality={lowQuality} />
    </Suspense>
  </group>
);
