import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binName = process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform';
const gltfTransformBin = join(rootDir, 'node_modules', '.bin', binName);
const outputRoot = join(rootDir, 'game', 'assets', 'ScenarioOptimized');

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

if (!existsSync(gltfTransformBin)) {
  throw new Error('Missing gltf-transform CLI. Run `npm install` before optimizing scenario GLBs.');
}

scenarioGlbs.forEach(({ label, input, output }) => {
  if (!existsSync(input)) {
    throw new Error(`Missing ${label} source GLB: ${input}`);
  }

  mkdirSync(dirname(output), { recursive: true });
  console.log(`Optimizing ${label}: ${input}`);

  const result = spawnSync(gltfTransformBin, [
    'draco',
    input,
    output,
    '--decode-speed',
    '7',
    '--encode-speed',
    '5',
    '--quantize-position',
    '16',
    '--quantize-normal',
    '12',
    '--quantize-texcoord',
    '14',
    '--quantize-generic',
    '14',
  ], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Failed to optimize ${label} (${result.status ?? 'unknown exit code'}).`);
  }
});

console.log(`Optimized ${scenarioGlbs.length} scenario GLBs into ${outputRoot}`);
