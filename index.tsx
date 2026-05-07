import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import gsap from 'gsap';
import App from './App';

// ── GSAP global ticker config ─────────────────────────────────────────────
// Cap GSAP's independent RAF ticker to 30fps so it does not compete with
// Three.js for the full 16ms frame budget on every animation frame.
// lagSmoothing(0) prevents GSAP from generating a catch-up burst of tween
// updates after a tab switch or heavy JS task, which would compound jank.
gsap.ticker.fps(30);
gsap.ticker.lagSmoothing(0);

// ── three-mesh-bvh global prototype patches ──────────────────────────────
// Must run before any geometry is loaded. Accelerates raycasting on all
// BufferGeometry instances (FBX characters, GLTF scenes, etc.) automatically.
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const clearServiceWorkers = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
};

// VITE_ELECTRON is injected at build time by the electron:build script.
// Service Workers don't work on the file:// protocol used by Electron.
const isElectronBuild = import.meta.env.VITE_ELECTRON === 'true';

if (!isElectronBuild && import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Falha ao registrar Service Worker:', error);
    },
  });
} else if (!isElectronBuild) {
  clearServiceWorkers();
}

// Suppress noisy THREE.js loader warnings that are harmless and unfixable at
// the game level (the FBX files contain maps three.js simply skips).
const _origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('THREE.FBXLoader') && msg.includes('is not supported in three.js')) return;
  _origWarn(...args);
};

// iOS PWA (WKWebView) fix: use window — fires before document, before browser
// decides to handle the gesture natively. Non-passive touchstart "claims" the
// touch sequence so subsequent touchmove events are cancelable.
window.addEventListener('touchstart', () => {
  // intentionally empty — non-passive claim is what matters
}, { passive: false });

// Block viewport scroll/bounce on any element that is NOT a scrollable panel.
window.addEventListener('touchmove', (e: TouchEvent) => {
  const target = e.target as Element | null;
  if (target?.closest('.overflow-y-auto, .overflow-y-scroll, .overflow-x-auto, .overflow-x-scroll, [data-scrollable]')) return;
  e.preventDefault();
}, { passive: false });

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
