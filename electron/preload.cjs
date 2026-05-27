'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, typed API surface to the renderer process.
// NEVER enable nodeIntegration — use this bridge for everything.
contextBridge.exposeInMainWorld('electronBridge', {
  /** True when the game is running inside Electron (desktop build). */
  isElectron: true,

  /**
   * Sprite Cutter: abre diálogo de pasta nativo e salva sprites no filesystem.
   * @param charId  - ID do personagem (usado como nome da subpasta e prefixo dos arquivos)
   * @param sprites - Array de { position: string, dataUrl: string }
   * @returns { success: boolean, canceled?: boolean, path?: string }
   */
  saveSprites: (charId, sprites) =>
    ipcRenderer.invoke('sprite-cutter:save-files', charId, sprites),
});
