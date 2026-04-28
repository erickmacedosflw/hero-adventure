'use strict';

const { app, BrowserWindow, Menu, powerSaveBlocker } = require('electron');
const path = require('path');

// ─── User data path ───────────────────────────────────────────────────────────
// Must be set BEFORE app.whenReady() and BEFORE any other app.commandLine calls.
// Without this Electron picks a temp dir that may not be writable, causing
// quota_database and disk_cache errors in the console.
app.setPath('userData', path.join(app.getPath('appData'), 'HeroTower'));

// ─── GPU / performance flags (must be set BEFORE app.whenReady) ──────────────

// Force Direct3D 11 as the ANGLE backend — best WebGL2 on Windows, avoids
// the OpenGL software fallback that can cause black screens on some drivers.
app.commandLine.appendSwitch('use-angle', 'd3d11');

// GPU rasterization & compositing
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Zero-copy GPU memory: textures are uploaded directly, no CPU round-trip.
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

// Ensure the system reports native DPI (important for 1440p / 4K monitors).
app.commandLine.appendSwitch('force-high-dpi-support');
app.commandLine.appendSwitch('high-dpi-support', '1');

// Remove Chromium's internal 60 fps cap on the compositor thread.
app.commandLine.appendSwitch('disable-frame-rate-limit');

// Prevent Chromium from throttling RAF / timers when the window loses focus.
// Critical for Three.js — without these the canvas goes black when unfocused.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// The game loads everything from file:// — HTTP disk cache is useless and
// causes quota_database errors when the cache dir is not yet initialised.
app.commandLine.appendSwitch('disk-cache-size', '0');

// Enable Gamepad API features — needed for Xbox BT on Windows.
// GamepadButtonAxisEvents: enables extended polling on Windows Gaming Input (WGI)
// path which is used by BT Xbox controllers (vs XInput for wired).
app.commandLine.appendSwitch('enable-features', 'GamepadButtonAxisEvents');

// ─── Window factory ──────────────────────────────────────────────────────────
function createWindow() {
  const isDev = process.env.ELECTRON_DEV === 'true';
  // In production remove the menu entirely; in dev keep it for Reload / DevTools shortcuts.
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  // Prevent Windows from putting the process into a low-power sleep state
  // while the game is running (display stays on, CPU/GPU unthrottled).
  powerSaveBlocker.start('prevent-app-suspension');

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    // Lock minimum size well above all mobile breakpoints (sm:640, md:768, lg:1024, xl:1280).
    // This ensures window.innerWidth never drops into the mobile range regardless
    // of how small the player resizes the window, so all CSS Tailwind breakpoints
    // and JS isMobile checks always resolve to desktop values.
    minWidth: 1280,
    minHeight: 720,
    title: 'Hero Tower',
    icon: path.join(__dirname, '..', 'electron-assets', 'icon.ico'),
    // Start windowed — F11 toggles fullscreen in-game.
    fullscreen: false,
    // Matches the game dark background so there is no white flash on load.
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Keep the renderer alive and rendering even when the window is hidden /
      // minimised. Prevents the Three.js canvas going black.
      backgroundThrottling: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist-electron-web', 'index.html'));
  }

  // Log renderer errors to the main-process console for diagnostics.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Hero Tower] renderer gone —', details.reason, 'exit:', details.exitCode);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Hero Tower] did-fail-load —', errorCode, errorDescription);
  });

  // F11 — toggle fullscreen (standard PC game convention).
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  // ── Gamepad API unlock ────────────────────────────────────────────────────
  // Chromium requires a "user gesture" before navigator.getGamepads() returns
  // any controllers. We send a synthetic focus + click event right after the
  // page is done loading to satisfy this requirement automatically, so the
  // gamepad badge appears without the player needing to click the mouse first.
  win.webContents.on('did-finish-load', () => {
    // Small delay to ensure the renderer's JS event loop is running
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.sendInputEvent({ type: 'mouseMove', x: 640, y: 360 });
        win.webContents.sendInputEvent({ type: 'mouseDown', x: 640, y: 360, button: 'left', clickCount: 1 });
        win.webContents.sendInputEvent({ type: 'mouseUp',   x: 640, y: 360, button: 'left', clickCount: 1 });
      }
    }, 500);
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

