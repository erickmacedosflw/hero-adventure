/**
 * Copies Basis Universal transcoder files from the installed three.js package
 * into public/basis/ so KTX2Loader can fetch them at runtime.
 *
 * Files copied:
 *   node_modules/three/examples/jsm/libs/basis/basis_transcoder.js
 *   node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(rootDir, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const destDir = join(rootDir, 'public', 'basis');

const files = ['basis_transcoder.js', 'basis_transcoder.wasm'];

if (!existsSync(srcDir)) {
  throw new Error(`Basis source directory not found: ${srcDir}\nEnsure three@>=0.148.0 is installed.`);
}

mkdirSync(destDir, { recursive: true });

for (const file of files) {
  const src = join(srcDir, file);
  const dest = join(destDir, file);
  if (!existsSync(src)) {
    throw new Error(`Missing Basis transcoder file: ${src}`);
  }
  copyFileSync(src, dest);
  console.log(`Copied ${file} → public/basis/`);
}

console.log('Basis Universal transcoder files ready.');
