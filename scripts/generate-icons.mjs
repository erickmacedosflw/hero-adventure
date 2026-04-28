/**
 * generate-icons.mjs
 * Generates all game icon variants from the official Icone_Game.png source.
 * Run once: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'game', 'assets', 'Imagens', 'Icone_Game.png');
const PUB  = path.join(ROOT, 'public');

// Ensure output dirs exist
fs.mkdirSync(path.join(PUB, 'icons'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'electron-assets'), { recursive: true });

/** Resize + save PNG */
async function savePng(size, outPath) {
  await sharp(SRC).resize(size, size).toFile(outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

// ── PWA / Web icons ──────────────────────────────────────────────────────────
const pwaIcons = [
  { size: 48,  name: 'icon-48x48.png'   },
  { size: 72,  name: 'icon-72x72.png'   },
  { size: 96,  name: 'icon-96x96.png'   },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 256, name: 'icon-256x256.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// ── Apple touch icon ─────────────────────────────────────────────────────────
const appleIcon = { size: 180, out: path.join(PUB, 'apple-touch-icon.png') };

// ── Electron / Windows exe icon sizes ────────────────────────────────────────
const icoSizes = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  console.log('\n[generate-icons] Source:', SRC);

  // PWA icons
  console.log('\n[1/4] PWA PNG icons → public/icons/');
  for (const { size, name } of pwaIcons) {
    await savePng(size, path.join(PUB, 'icons', name));
  }

  // Apple touch icon
  console.log('\n[2/4] Apple touch icon → public/apple-touch-icon.png');
  await savePng(appleIcon.size, appleIcon.out);

  // favicon.png (32x32) in public/
  console.log('\n[3/4] Favicon PNG → public/favicon.png');
  await savePng(32, path.join(PUB, 'favicon.png'));

  // Windows ICO
  console.log('\n[4/4] Windows ICO → electron-assets/icon.ico  &  public/favicon.ico');
  const icoPngs = [];
  for (const size of icoSizes) {
    const buf = await sharp(SRC).resize(size, size).png().toBuffer();
    icoPngs.push(buf);
  }
  const icoBuffer = await pngToIco(icoPngs);
  const icoElectron = path.join(ROOT, 'electron-assets', 'icon.ico');
  const icoFavicon  = path.join(PUB, 'favicon.ico');
  fs.writeFileSync(icoElectron, icoBuffer);
  fs.writeFileSync(icoFavicon,  icoBuffer);
  console.log(`  ✓ ${path.relative(ROOT, icoElectron)}`);
  console.log(`  ✓ ${path.relative(ROOT, icoFavicon)}`);

  console.log('\n[generate-icons] Done!\n');
}

main().catch(err => { console.error(err); process.exit(1); });
