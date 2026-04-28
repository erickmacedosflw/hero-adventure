/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ELECTRON: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Bridge exposed by electron/preload.cjs when running inside Electron.
interface Window {
  electronBridge?: {
    isElectron: boolean;
  };
}
