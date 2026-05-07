/**
 * Converts PNG textures to WebP for faster loading and smaller file sizes.
 *
 * Targets:
 *   - public/skybox/**\/*.png   → .webp  (30 files × 5 themes — biggest win)
 *   - game/assets/Characters/**\/*_texture.png → .webp  (character 3D model textures)
 *   - game/assets/Characters/Monsters/**\/*.png → .webp  (monster atlas textures)
 *   - game/assets/Characters/Weapons/**\/*_texture.png → .webp  (weapon textures)
 *
 * Incremental: skips if .webp is already newer than its .png source.
 * Original PNGs are preserved — the data files are updated to reference .webp.
 *
 * Run: npm run assets:compress-textures
 */
import sharp from 'sharp';
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Recursively collect all files matching a predicate under a directory. */
function collectFiles(dir, predicate, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, results);
    } else if (predicate(entry.name, fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Returns true if dest doesn't exist or src is newer. */
function needsConversion(srcPath, destPath) {
  if (!existsSync(destPath)) return true;
  return statSync(srcPath).mtimeMs > statSync(destPath).mtimeMs;
}

async function convertToWebP(srcPath, quality = 90) {
  const destPath = srcPath.replace(/\.png$/i, '.webp');
  if (!needsConversion(srcPath, destPath)) {
    return { path: destPath, skipped: true };
  }
  mkdirSync(dirname(destPath), { recursive: true });
  await sharp(srcPath)
    .webp({ quality, effort: 4 })
    .toFile(destPath);
  return { path: destPath, skipped: false };
}

// ── Collect files ─────────────────────────────────────────────────────────

const skyboxPngs = collectFiles(
  join(rootDir, 'public', 'skybox'),
  (name) => /\.png$/i.test(name) && name !== 'cubemap_layout.png',
);

const characterTexturePngs = collectFiles(
  join(rootDir, 'game', 'assets', 'Characters'),
  (name) => /^.*_texture\.png$/i.test(name),
);

const monsterAtlasPngs = collectFiles(
  join(rootDir, 'game', 'assets', 'Characters', 'Monsters'),
  (name) => /^Atlas_Monsters\.png$/i.test(name),
);

const allFiles = [...new Set([...skyboxPngs, ...characterTexturePngs, ...monsterAtlasPngs])];

if (allFiles.length === 0) {
  console.log('No PNG files found to convert.');
  process.exit(0);
}

// ── Convert ───────────────────────────────────────────────────────────────

let converted = 0;
let skipped = 0;

console.log(`Converting ${allFiles.length} PNG file(s) to WebP...\n`);

for (const srcPath of allFiles) {
  const rel = srcPath.replace(rootDir + '\\', '').replace(rootDir + '/', '');
  const result = await convertToWebP(srcPath);
  if (result.skipped) {
    skipped++;
    console.log(`  SKIP  ${rel} (up to date)`);
  } else {
    converted++;
    const srcSize = statSync(srcPath).size;
    const destSize = statSync(result.path).size;
    const savings = (((srcSize - destSize) / srcSize) * 100).toFixed(1);
    console.log(`  OK    ${rel}  (${(srcSize / 1024).toFixed(0)} KB → ${(destSize / 1024).toFixed(0)} KB, -${savings}%)`);
  }
}

console.log(`\nDone. Converted: ${converted}  Skipped (up to date): ${skipped}`);
if (converted > 0) {
  console.log('\nNext steps:');
  console.log('  - Skybox WebP is ready (SKYBOX_FACES already updated to .webp)');
  console.log('  - Character textures: update textureUrl fields in data files to .webp if desired');
}
