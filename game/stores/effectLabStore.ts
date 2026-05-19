import { create } from 'zustand';
import type { EffectCategory, EffectLabParams, EffectPreset } from '../../components/scene3d/effectPresets';
import { EFFECT_PRESETS, EFFECT_PRESETS_BY_CATEGORY } from '../../components/scene3d/effectPresets';

export interface EffectLabExportEntry {
  id: string;
  presetId: string;
  label: string;
  timestamp: number;
  code: string;
}

interface EffectLabState {
  /** Active category filter */
  selectedCategory: EffectCategory;
  /** Active preset within the category */
  selectedPresetId: string;
  /** Live-editable param overrides (merged on top of preset.params) */
  params: EffectLabParams;
  /** Playback */
  isPlaying: boolean;
  loop: boolean;
  /** Optional Effekseer .efk file URL — loaded via dynamic script */
  efkUrl: string;
  efkLoadError: string | null;
  /** Effect origin position in the 3D scene (relative to mannequin) */
  spawnOffset: [number, number, number];
  /** Generated code history */
  exportHistory: EffectLabExportEntry[];

  // ── Actions ──────────────────────────────────────────────────────────────
  setCategory: (cat: EffectCategory) => void;
  setPreset: (presetId: string) => void;
  updateParam: <K extends keyof EffectLabParams>(key: K, value: EffectLabParams[K]) => void;
  setIsPlaying: (v: boolean) => void;
  setLoop: (v: boolean) => void;
  setEfkUrl: (url: string) => void;
  setEfkLoadError: (err: string | null) => void;
  setSpawnOffset: (offset: [number, number, number]) => void;
  triggerPlay: () => void;
  triggerStop: () => void;
  addExport: (entry: EffectLabExportEntry) => void;
  clearExports: () => void;
  /** Returns the currently selected preset (with live param overrides) */
  getActivePreset: () => EffectPreset;
}

const defaultCategory: EffectCategory = 'magic';
const defaultPreset = EFFECT_PRESETS_BY_CATEGORY[defaultCategory][0];

export const useEffectLabStore = create<EffectLabState>((set, get) => ({
  selectedCategory: defaultCategory,
  selectedPresetId: defaultPreset.id,
  params: { ...defaultPreset.params },
  isPlaying: false,
  loop: false,
  efkUrl: '',
  efkLoadError: null,
  spawnOffset: [...defaultPreset.spawnOffset] as [number, number, number],
  exportHistory: [],

  setCategory: (cat) => {
    const firstPreset = EFFECT_PRESETS_BY_CATEGORY[cat][0];
    set({
      selectedCategory: cat,
      selectedPresetId: firstPreset.id,
      params: { ...firstPreset.params },
      spawnOffset: [...firstPreset.spawnOffset] as [number, number, number],
      isPlaying: false,
      efkUrl: '',
      efkLoadError: null,
    });
  },

  setPreset: (presetId) => {
    const preset = EFFECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    set({
      selectedPresetId: presetId,
      params: { ...preset.params },
      spawnOffset: [...preset.spawnOffset] as [number, number, number],
      isPlaying: false,
    });
  },

  updateParam: (key, value) => {
    set((s) => ({ params: { ...s.params, [key]: value } }));
  },

  setIsPlaying: (v) => set({ isPlaying: v }),
  setLoop: (v) => set({ loop: v }),
  setEfkUrl: (url) => set({ efkUrl: url, efkLoadError: null }),
  setEfkLoadError: (err) => set({ efkLoadError: err }),
  setSpawnOffset: (offset) => set({ spawnOffset: offset }),

  triggerPlay: () => set({ isPlaying: true }),
  triggerStop: () => set({ isPlaying: false }),

  addExport: (entry) =>
    set((s) => ({ exportHistory: [entry, ...s.exportHistory].slice(0, 20) })),
  clearExports: () => set({ exportHistory: [] }),

  getActivePreset: () => {
    const { selectedPresetId } = get();
    return EFFECT_PRESETS.find((p) => p.id === selectedPresetId) ?? defaultPreset;
  },
}));
