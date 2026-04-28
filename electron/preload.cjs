'use strict';

const { contextBridge } = require('electron');

// Expose a minimal, typed API surface to the renderer process.
// NEVER enable nodeIntegration — use this bridge for everything.
contextBridge.exposeInMainWorld('electronBridge', {
  /** True when the game is running inside Electron (desktop build). */
  isElectron: true,
});
