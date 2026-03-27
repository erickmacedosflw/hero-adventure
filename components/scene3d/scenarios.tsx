import React, { useMemo, Suspense } from 'react';
import { useFBX, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { ScenarioDefinition } from '../../game/data/scenarios';

const disableRaycast = () => null;

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
    child.raycast = disableRaycast;
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

const getPropStabilityHash = (entry: PropEntry) => {
  const [x, y, z] = entry.position;
  const raw = Math.round((x + 40) * 13 + (y + 10) * 7 + (z + 60) * 17);
  return Math.abs(raw % 97);
};

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
        <mesh key={i} position={t.pos} receiveShadow raycast={disableRaycast}>
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
      const hash = getPropStabilityHash(e);

      // Keep trees and rocks always; trim only part of small foliage on low quality.
      if (e.key.startsWith('grass')) return hash % 3 !== 0;
      if (e.key.startsWith('bush')) return hash % 4 !== 0;
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

/* ══════════════════════════════════════════════════════════════════
   DUNGEON SCENARIO — FBX modular kit with dungeon_texture.png
   ══════════════════════════════════════════════════════════════════ */

const DUNGEON_TEXTURE = new URL('../../game/assets/Scenario/Dungeon/dungeon_texture.png', import.meta.url).href;

const DUNGEON_URLS = {
  // ── Structure ──────────────────────────────────────
  floor:        new URL('../../game/assets/Scenario/Dungeon/floor_tile_large.fbx',      import.meta.url).href,
  wall:         new URL('../../game/assets/Scenario/Dungeon/wall.fbx',                  import.meta.url).href,
  wallCorner:   new URL('../../game/assets/Scenario/Dungeon/wall_corner.fbx',           import.meta.url).href,
  ceiling:      new URL('../../game/assets/Scenario/Dungeon/ceiling_tile.fbx',          import.meta.url).href,
  column:       new URL('../../game/assets/Scenario/Dungeon/column.fbx',                import.meta.url).href,
  // ── Point-light props ──────────────────────────────
  torchWall:    new URL('../../game/assets/Scenario/Dungeon/torch_mounted.fbx',         import.meta.url).href,
  // ── Rear-wall dressing ─────────────────────────────
  banner:       new URL('../../game/assets/Scenario/Dungeon/banner_patternA_red.fbx',   import.meta.url).href,
  wallBroken:   new URL('../../game/assets/Scenario/Dungeon/wall_broken.fbx',           import.meta.url).href,
  wallCracked:  new URL('../../game/assets/Scenario/Dungeon/wall_cracked.fbx',          import.meta.url).href,
  // ── Clutter ────────────────────────────────────────
  barrel:       new URL('../../game/assets/Scenario/Dungeon/barrel_large.fbx',          import.meta.url).href,
  barrelStack:  new URL('../../game/assets/Scenario/Dungeon/barrel_small_stack.fbx',    import.meta.url).href,
  chest:        new URL('../../game/assets/Scenario/Dungeon/chest_gold.fbx',            import.meta.url).href,
  boxStacked:   new URL('../../game/assets/Scenario/Dungeon/box_stacked.fbx',           import.meta.url).href,
  candle:       new URL('../../game/assets/Scenario/Dungeon/candle_triple.fbx',         import.meta.url).href,
  rubble:       new URL('../../game/assets/Scenario/Dungeon/rubble_large.fbx',          import.meta.url).href,
  rubbleHalf:   new URL('../../game/assets/Scenario/Dungeon/rubble_half.fbx',           import.meta.url).href,
  // ── Depth hint ─────────────────────────────────────
  stairs:       new URL('../../game/assets/Scenario/Dungeon/stairs_wide.fbx',           import.meta.url).href,
};

interface DungeonPropEntry {
  key: keyof typeof DUNGEON_URLS;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

function buildDungeonLayout(): DungeonPropEntry[] {
  // ── Scale constants (tune in-game if needed) ──
  const S  = 0.018; // modular structure (floor/wall/ceiling/column)
  const P  = 0.016; // props (barrels, banners, boxes…)
  const Y0 = -1.15; // ground Y — matches character baseline
  // ── Room dimensions ────────────────────────────
  const WX   = 9;   // wall X position (half-width)
  const WBAK = -17; // back wall Z
  const entries: DungeonPropEntry[] = [];

  // ── Floor (9 cols × 10 rows, step 2) ─────────────────────────
  // X: -8..+8 step 2 | Z: +2..-16 step -2
  for (let xi = -4; xi <= 4; xi++) {
    for (let zi = 0; zi <= 9; zi++) {
      entries.push({ key: 'floor', position: [xi * 2, Y0, 2 - zi * 2], rotationY: 0, scale: S });
    }
  }

  // ── Back wall (9 segments at Z=WBAK) ─────────────────────────
  // centre 3 segments: broken/cracked → suggests cave continues deeper
  for (let xi = -4; xi <= 4; xi++) {
    let wallKey: keyof typeof DUNGEON_URLS = 'wall';
    if (xi === 0)                  wallKey = 'wallBroken';   // centre: open gap
    else if (xi === -1 || xi === 1) wallKey = 'wallCracked';  // flanking: crumbling
    else if (xi === -3 || xi === 3) wallKey = 'wallCracked';  // outer flanks
    entries.push({ key: wallKey, position: [xi * 2, Y0, WBAK], rotationY: 0, scale: S });
  }

  // ── Left wall  (10 segs, X=-WX) ───────────────────────────────
  for (let zi = 0; zi <= 9; zi++) {
    entries.push({ key: 'wall', position: [-WX, Y0, 2 - zi * 2], rotationY:  Math.PI / 2, scale: S });
  }

  // ── Right wall (10 segs, X=+WX) ───────────────────────────────
  for (let zi = 0; zi <= 9; zi++) {
    entries.push({ key: 'wall', position: [WX,  Y0, 2 - zi * 2], rotationY: -Math.PI / 2, scale: S });
  }

  // ── Back corners ──────────────────────────────────────────────
  entries.push({ key: 'wallCorner', position: [-WX, Y0, WBAK], rotationY:  Math.PI / 2, scale: S });
  entries.push({ key: 'wallCorner', position: [ WX, Y0, WBAK], rotationY:  0,           scale: S });

  // ── Ceiling (5 cols × 9 rows) ─────────────────────────────────
  for (let xi = -2; xi <= 2; xi++) {
    for (let zi = 1; zi <= 9; zi++) {
      entries.push({ key: 'ceiling', position: [xi * 2, Y0 + 5.0, -(zi * 2)], rotationY: 0, scale: S });
    }
  }

  // ── Columns — 3 pairs along the room ──────────────────────────
  const colZ   = [-3.0, -8.5, -14.0];
  const colXOff = 7.0;
  for (const cz of colZ) {
    entries.push({ key: 'column', position: [-colXOff, Y0, cz], rotationY: 0, scale: S });
    entries.push({ key: 'column', position: [ colXOff, Y0, cz], rotationY: 0, scale: S });
  }

  // ── Wall torches — left wall (face +X) ───────────────────────
  const torchZ = [-4.0, -9.0, -14.5];
  for (const tz of torchZ) {
    entries.push({ key: 'torchWall', position: [-(WX - 0.2), Y0 + 1.5, tz], rotationY: -Math.PI / 2, scale: P });
    entries.push({ key: 'torchWall', position: [  WX - 0.2,  Y0 + 1.5, tz], rotationY:  Math.PI / 2, scale: P });
  }
  // Back wall torches (flanking banners, face +Z toward player)
  entries.push({ key: 'torchWall', position: [-6.0, Y0 + 1.5, WBAK + 0.2], rotationY: Math.PI, scale: P });
  entries.push({ key: 'torchWall', position: [ 6.0, Y0 + 1.5, WBAK + 0.2], rotationY: Math.PI, scale: P });

  // ── Banners on back wall ───────────────────────────────────────
  // Three banners: flanking center + center top
  entries.push({ key: 'banner', position: [-4.0, Y0 + 0.6, WBAK + 0.1], rotationY: Math.PI, scale: P });
  entries.push({ key: 'banner', position: [ 0.0, Y0 + 0.6, WBAK + 0.1], rotationY: Math.PI, scale: P });
  entries.push({ key: 'banner', position: [ 4.0, Y0 + 0.6, WBAK + 0.1], rotationY: Math.PI, scale: P });

  // ── Gold chest — centre-rear focal point ─────────────────────
  entries.push({ key: 'chest', position: [0, Y0, WBAK + 1.5], rotationY: 0, scale: P });

  // ── Candles flanking the chest ────────────────────────────────
  entries.push({ key: 'candle', position: [-1.4, Y0, WBAK + 1.3], rotationY: 0.3,  scale: P });
  entries.push({ key: 'candle', position: [ 1.4, Y0, WBAK + 1.3], rotationY: -0.3, scale: P });

  // ── Barrels — rear-left cluster ───────────────────────────────
  entries.push({ key: 'barrel',      position: [-7.5, Y0, WBAK + 1.2], rotationY: Math.PI * 0.2,  scale: P });
  entries.push({ key: 'barrel',      position: [-6.2, Y0, WBAK + 1.6], rotationY: Math.PI * 0.7,  scale: P });
  entries.push({ key: 'barrelStack', position: [-7.2, Y0, WBAK + 2.8], rotationY: 0,              scale: P });

  // ── Barrels — rear-right cluster ──────────────────────────────
  entries.push({ key: 'barrel',      position: [ 7.5, Y0, WBAK + 1.2], rotationY: Math.PI * 0.8,  scale: P });
  entries.push({ key: 'barrel',      position: [ 6.2, Y0, WBAK + 1.6], rotationY: Math.PI * 0.3,  scale: P });
  entries.push({ key: 'barrelStack', position: [ 7.2, Y0, WBAK + 2.8], rotationY: Math.PI,        scale: P });

  // ── Stacked boxes — mid-side alcoves ──────────────────────────
  entries.push({ key: 'boxStacked', position: [-8.2, Y0, -6.5],  rotationY: 0.1,  scale: P });
  entries.push({ key: 'boxStacked', position: [ 8.2, Y0, -6.5],  rotationY: -0.1, scale: P });
  entries.push({ key: 'boxStacked', position: [-8.2, Y0, -11.8], rotationY: 0.2,  scale: P });
  entries.push({ key: 'boxStacked', position: [ 8.2, Y0, -11.8], rotationY: -0.15, scale: P });

  // ── Rubble — mid-room near second column pair (Z≈-8.5) ────────
  entries.push({ key: 'rubble',     position: [-6.0, Y0, -7.2],      rotationY:  0.6,  scale: P });
  entries.push({ key: 'rubble',     position: [ 6.2, Y0, -7.8],      rotationY: -0.4,  scale: P });
  // Small rubble half near back broken wall — debris spilling through
  entries.push({ key: 'rubbleHalf', position: [-1.8, Y0, WBAK + 0.8], rotationY:  0.8,  scale: P });
  entries.push({ key: 'rubbleHalf', position: [ 1.6, Y0, WBAK + 0.8], rotationY: -0.5,  scale: P });
  entries.push({ key: 'rubbleHalf', position: [ 0.0, Y0, WBAK + 1.2], rotationY:  1.2,  scale: P });

  // ── Stairs — visible THROUGH the broken centre gap ───────────
  // Placed just behind the back wall to imply descent into deeper cave
  entries.push({ key: 'stairs', position: [0, Y0, WBAK - 1.2], rotationY: Math.PI, scale: S });

  return entries;
}

const DUNGEON_LAYOUT = buildDungeonLayout();

/* ─── DungeonProps — 16 fixed useFBX hooks (hooks-rule: unconditional) ─── */

const DungeonProps = () => {
  const texture = useTexture(DUNGEON_TEXTURE);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  // All 16 hooks called unconditionally and in fixed order
  const srcFloor       = useFBX(DUNGEON_URLS.floor);
  const srcWall        = useFBX(DUNGEON_URLS.wall);
  const srcWallCorner  = useFBX(DUNGEON_URLS.wallCorner);
  const srcWallBroken  = useFBX(DUNGEON_URLS.wallBroken);
  const srcWallCracked = useFBX(DUNGEON_URLS.wallCracked);
  const srcCeiling     = useFBX(DUNGEON_URLS.ceiling);
  const srcColumn      = useFBX(DUNGEON_URLS.column);
  const srcTorchWall   = useFBX(DUNGEON_URLS.torchWall);
  const srcBanner      = useFBX(DUNGEON_URLS.banner);
  const srcBarrel      = useFBX(DUNGEON_URLS.barrel);
  const srcBarrelStack = useFBX(DUNGEON_URLS.barrelStack);
  const srcChest       = useFBX(DUNGEON_URLS.chest);
  const srcBoxStacked  = useFBX(DUNGEON_URLS.boxStacked);
  const srcCandle      = useFBX(DUNGEON_URLS.candle);
  const srcRubble      = useFBX(DUNGEON_URLS.rubble);
  const srcRubbleHalf  = useFBX(DUNGEON_URLS.rubbleHalf);
  const srcStairs      = useFBX(DUNGEON_URLS.stairs);

  const sourceMap = useMemo<Record<keyof typeof DUNGEON_URLS, THREE.Group>>(() => ({
    floor:       srcFloor,
    wall:        srcWall,
    wallCorner:  srcWallCorner,
    wallBroken:  srcWallBroken,
    wallCracked: srcWallCracked,
    ceiling:     srcCeiling,
    column:      srcColumn,
    torchWall:   srcTorchWall,
    banner:      srcBanner,
    barrel:      srcBarrel,
    barrelStack: srcBarrelStack,
    chest:       srcChest,
    boxStacked:  srcBoxStacked,
    candle:      srcCandle,
    rubble:      srcRubble,
    rubbleHalf:  srcRubbleHalf,
    stairs:      srcStairs,
  }), [srcFloor, srcWall, srcWallCorner, srcWallBroken, srcWallCracked, srcCeiling,
       srcColumn, srcTorchWall, srcBanner, srcBarrel, srcBarrelStack, srcChest,
       srcBoxStacked, srcCandle, srcRubble, srcRubbleHalf, srcStairs]);

  const clones = useMemo(
    () => DUNGEON_LAYOUT.map((entry) => ({ ...entry, model: cloneWithTexture(sourceMap[entry.key], texture) })),
    [sourceMap, texture],
  );

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

/* ─── Dungeon Battle Scenario (exported, used by Scene3D) ─── */

export const DungeonScenario = () => (
  <Suspense fallback={null}>
    <DungeonProps />
  </Suspense>
);
