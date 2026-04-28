// No-op stub that replaces `virtual:pwa-register` when building for Electron.
// Service Workers do not function on the file:// protocol used by Electron,
// so the PWA plugin is disabled and this stub is aliased in its place.
export function registerSW(_options?: Record<string, unknown>): () => void {
  return () => undefined;
}
