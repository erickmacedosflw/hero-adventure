/**
 * Central registry of video VFX assets shipped in `game/vfx/`.
 *
 * Each entry pairs a `.webm` (resolved by Vite as a hashed asset URL) with
 * its inlined `.json` config (typed as {@link VfxConfig}).
 *
 * Lookup via {@link getVfxById}; add entries here when authoring new VFX
 * in the `VideoEffectLab` developer tool.
 */

import type { VfxConfig, VfxEntry } from './types';

// ── Asset imports (Vite resolves `?url` to hashed CDN-style paths). ──────────
import absorveAuraUrl from './absorve_aura.webm?url';
import actionDefenseUrl from './action_defense.webm?url';
import basicAtackUrl from './basic_atack.webm?url';
import basicSwordUrl from './basic_sword.webm?url';
import boostUpUrl from './boost_up.webm?url';
import criticalSwordUrl from './critical_sword.webm?url';
import debuffDownUrl from './debuff_down.webm?url';
import dragonKickUrl from './dragon_kick.webm?url';
import healLifeUrl from './heal_life.webm?url';
import healLifeManaUrl from './heal_life_mana.webm?url';
import impulseAuraLoopUrl from './impulse_aura_loop.webm?url';
import impulseAuraStartUrl from './impulse_aura_start.webm?url';
import staffFinalBeamUrl from './staff_final_beam.webm?url';
import tigerPunchUrl from './tiger_punch.webm?url';

// ── Config imports (Vite inlines `.json` automatically). ─────────────────────
import absorveAuraConfig from './absorve_aura.json';
import actionDefenseConfig from './action_defense.json';
import basicAtackConfig from './basic_atack.json';
import basicSwordConfig from './basic_sword.json';
import boostUpConfig from './boost_up.json';
import criticalSwordConfig from './critical_sword.json';
import debuffDownConfig from './debuff_down.json';
import dragonKickConfig from './dragon_kick.json';
import healLifeConfig from './heal_life.json';
import healLifeManaConfig from './heal_life_mana.json';
import impulseAuraLoopConfig from './impulse_aura_loop.json';
import impulseAuraStartConfig from './impulse_aura_start.json';
import staffFinalBeamConfig from './staff_final_beam.json';
import tigerPunchConfig from './tiger_punch.json';

const entry = (id: string, name: string, videoUrl: string, config: unknown): VfxEntry => ({
  id,
  name,
  videoUrl,
  config: config as VfxConfig,
});

export const VFX_REGISTRY: Record<string, VfxEntry> = {
  absorve_aura:        entry('absorve_aura',        'Absorve Aura',        absorveAuraUrl,        absorveAuraConfig),
  action_defense:      entry('action_defense',      'Action Defense',      actionDefenseUrl,      actionDefenseConfig),
  basic_atack:         entry('basic_atack',         'Basic Atack',         basicAtackUrl,         basicAtackConfig),
  basic_sword:         entry('basic_sword',         'Basic Sword',         basicSwordUrl,         basicSwordConfig),
  boost_up:            entry('boost_up',            'Boost Up',            boostUpUrl,            boostUpConfig),
  critical_sword:      entry('critical_sword',      'Critical Sword',      criticalSwordUrl,      criticalSwordConfig),
  debuff_down:         entry('debuff_down',         'Debuff Down',         debuffDownUrl,         debuffDownConfig),
  dragon_kick:         entry('dragon_kick',         'Dragon Kick',         dragonKickUrl,         dragonKickConfig),
  heal_life:           entry('heal_life',           'Heal Life',           healLifeUrl,           healLifeConfig),
  heal_life_mana:      entry('heal_life_mana',      'Heal Life + Mana',    healLifeManaUrl,       healLifeManaConfig),
  impulse_aura_loop:   entry('impulse_aura_loop',   'Impulse Aura Loop',   impulseAuraLoopUrl,    impulseAuraLoopConfig),
  impulse_aura_start:  entry('impulse_aura_start',  'Impulse Aura Start',  impulseAuraStartUrl,   impulseAuraStartConfig),
  staff_final_beam:    entry('staff_final_beam',    'Staff Final Beam',    staffFinalBeamUrl,     staffFinalBeamConfig),
  tiger_punch:         entry('tiger_punch',         'Tiger Punch',         tigerPunchUrl,         tigerPunchConfig),
};

export const getVfxById = (id: string | undefined | null): VfxEntry | undefined =>
  id ? VFX_REGISTRY[id] : undefined;

export const VFX_IDS = Object.keys(VFX_REGISTRY);

// ── Warm <video> pool ────────────────────────────────────────────────────────
// Keep ONE fully-loaded `<video>` element alive per VFX id. `acquireVfxVideo`
// hands the warm element to the runtime (instant start, no decoder cold-start)
// then schedules a replacement so the next play is also instant.

const WARM_POOL: Map<string, HTMLVideoElement> = new Map();

const createWarmVideo = (id: string, url: string): void => {
  if (typeof document === 'undefined') return;
  // Avoid stacking duplicates.
  const existing = WARM_POOL.get(id);
  if (existing) {
    try { existing.pause(); } catch { /* noop */ }
    existing.removeAttribute('src');
    try { existing.load(); } catch { /* noop */ }
  }
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  el.src = url;
  try { el.load(); } catch { /* noop */ }
  WARM_POOL.set(id, el);
};

/**
 * Return a `<video>` element already pointing at the VFX asset. If a warm
 * element is pooled (typical case after first warm-up tick) it has already
 * loaded the first frames and playback starts on the next animation frame.
 * A fresh warm element is queued for the next acquire.
 */
export const acquireVfxVideo = (id: string): HTMLVideoElement | null => {
  if (typeof document === 'undefined') return null;
  const entry = VFX_REGISTRY[id];
  if (!entry) return null;
  let el = WARM_POOL.get(id) ?? null;
  if (el) {
    WARM_POOL.delete(id);
  } else {
    // Cold path — create a brand-new element. Still works, just no warm-up.
    el = document.createElement('video');
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.src = entry.videoUrl;
    try { el.load(); } catch { /* noop */ }
  }
  // Refill the pool for next time so subsequent absorbs / potions stay snappy.
  // Defer slightly so we don't compete with the in-flight playback for I/O.
  setTimeout(() => createWarmVideo(id, entry.videoUrl), 300);
  return el;
};

// ── Eager browser-cache warm-up ──────────────────────────────────────────────
// Fire-and-forget GET requests during idle time so the browser caches every
// VFX webm before it's first used in battle. Eliminates the visible loading
// stutter on the first play of each effect.
if (typeof window !== 'undefined') {
  const warmCache = () => {
    for (const e of Object.values(VFX_REGISTRY)) {
      // `fetch` populates the HTTP cache; the cached response is reused by
      // the <video> element's later `src = videoUrl`. We ignore errors and
      // bodies — only the cache write matters.
      fetch(e.videoUrl, { credentials: 'omit', cache: 'force-cache' }).catch(() => {});
      // Also warm the decoder pipeline by populating the persistent pool.
      createWarmVideo(e.id, e.videoUrl);
    }
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(warmCache, { timeout: 4000 });
  } else {
    setTimeout(warmCache, 1500);
  }
}
