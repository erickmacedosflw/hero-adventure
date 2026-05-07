/**
 * Optimize scenario GLBs using a two-step pipeline:
 *   Step 1 (gltf-transform JS API): dedup → prune → weld → textureCompress(WebP via sharp)
 *   Step 2 (gltf-transform CLI):    draco geometry compression
 *
 * Benefits over plain CLI:
 *   - Removes duplicate accessors/meshes (dedup)
 *   - Strips orphaned nodes/materials (prune)
 *   - Merges vertices within tolerance (weld) → better DRACO ratios
 *   - Converts embedded PNG/JPEG textures to WebP (3-5× smaller)
 */
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, weld, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binName = process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform';
const gltfTransformBin = join(rootDir, 'node_modules', '.bin', binName);
const outputRoot = join(rootDir, 'game', 'assets', 'ScenarioOptimized');

if (!existsSync(gltfTransformBin)) {
  throw new Error('Missing gltf-transform CLI. Run `npm install` before optimizing scenario GLBs.');
}

const scenarioGlbs = [
  {
    label: 'Tower',
    input: join(rootDir, 'game', 'assets', 'Scenario', 'Tower', 'cenario_3d_torre.glb'),
    output: join(outputRoot, 'Tower', 'cenario_3d_torre.draco.glb'),
  },
  {
    label: 'Tower Object',
    input: join(rootDir, 'game', 'assets', 'Scenario', 'Tower', 'cenario_3d_torre_objeto.glb'),
    output: join(outputRoot, 'Tower', 'cenario_3d_torre_objeto.draco.glb'),
  },
  {
    label: 'Forest',
    input: join(rootDir, 'game', 'assets', 'Scenario', 'Florest', 'cenario_3d_floresta.glb'),
    output: join(outputRoot, 'Florest', 'cenario_3d_floresta.draco.glb'),
  },
  {
    label: 'Dungeon',
    input: join(rootDir, 'game', 'assets', 'Scenario', 'Dungeon', 'cenario_3d_dungeon.glb'),
    output: join(outputRoot, 'Dungeon', 'cenario_3d_dungeon.draco.glb'),
  },
  {
    label: 'Mountain',
    input: join(rootDir, 'game', 'assets', 'Scenario', 'Moutain', 'cenario_3d_montanha.glb'),
    output: join(outputRoot, 'Moutain', 'cenario_3d_montanha.draco.glb'),
  },
];

const io = new NodeIO();

for (const { label, input, output } of scenarioGlbs) {
  if (!existsSync(input)) {
    throw new Error(`Missing ${label} source GLB: ${input}`);
  }

  mkdirSync(dirname(output), { recursive: true });

  const tempPath = output.replace(/\.draco\.glb$/, '.predraco.glb');

  // ── Step 1: mesh cleanup + WebP texture compression ──────────────────────
  console.log(`[${label}] Step 1/2: dedup + prune + weld + textureCompress(webp)...`);
  const doc = await io.read(input);
  await doc.transform(
    dedup(),
    prune(),
    weld({ tolerance: 1e-4 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90 }),
  );
  await io.write(tempPath, doc);

  // ── Step 2: DRACO geometry compression ───────────────────────────────────
  console.log(`[${label}] Step 2/2: DRACO compression...`);
  const result = spawnSync(gltfTransformBin, [
    'draco',
    tempPath,
    output,
    '--decode-speed', '7',
    '--encode-speed', '5',
    '--quantize-position', '16',
    '--quantize-normal', '12',
    '--quantize-texcoord', '14',
    '--quantize-generic', '14',
  ], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // ── Cleanup temp ─────────────────────────────────────────────────────────
  if (existsSync(tempPath)) rmSync(tempPath);

  if (result.status !== 0) {
    throw new Error(`Failed to optimize ${label} (exit code ${result.status ?? 'unknown'}).`);
  }

  console.log(`[${label}] ✓ → ${output}\n`);
}

console.log(`Optimized ${scenarioGlbs.length} scenario GLBs into ${outputRoot}`);
