import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(rootDir, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf');
const targetDir = join(rootDir, 'public', 'draco', 'gltf');
const decoderFiles = ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'];

if (!existsSync(sourceDir)) {
  throw new Error(`Three.js Draco decoder folder not found: ${sourceDir}`);
}

mkdirSync(targetDir, { recursive: true });

decoderFiles.forEach((fileName) => {
  const sourcePath = join(sourceDir, fileName);
  const targetPath = join(targetDir, fileName);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing Draco decoder file: ${sourcePath}`);
  }

  copyFileSync(sourcePath, targetPath);
});

console.log(`Copied ${decoderFiles.length} Draco decoder files to ${targetDir}`);
