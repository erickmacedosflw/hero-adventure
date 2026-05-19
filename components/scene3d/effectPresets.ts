/**
 * Effect Lab — Built-in procedural effect presets
 * Each preset drives the EffectLabRenderer with Three.js particles.
 * Optionally, a .efk file URL can override the procedural effect.
 */

export type EffectCategory =
  | 'magic'
  | 'fire'
  | 'wind'
  | 'slash'
  | 'arrow'
  | 'explosion'
  | 'aura'
  | 'hit'
  | 'buff'
  | 'ambient';

export interface EffectLabParams {
  /** Primary hex color (no #) */
  color: string;
  /** Secondary hex color used for gradient / dual-tone effects */
  colorSecondary: string;
  /** Overall scale factor (0.1 – 5) */
  scale: number;
  /** Particle emission speed / velocity magnitude */
  speed: number;
  /** Number of particles emitted per burst */
  count: number;
  /** Effect lifetime in seconds */
  duration: number;
  /** Emission intensity / brightness multiplier (0 – 3) */
  intensity: number;
}

export interface EffectPreset {
  id: string;
  category: EffectCategory;
  label: string;
  description: string;
  /** Spawn position offset relative to mannequin origin */
  spawnOffset: [number, number, number];
  /** Default tunable parameters */
  params: EffectLabParams;
  /**
   * Particle behaviour descriptor consumed by ProceduralEffectPlayer.
   * 'burst'  → one-shot cloud
   * 'stream' → continuous emitter while playing
   * 'orbit'  → particles revolve around spawn point
   * 'trail'  → animated arc / sweep
   */
  emitterMode: 'burst' | 'stream' | 'orbit' | 'trail';
  /** Three.js additive blending vs normal */
  additiveBlend: boolean;
  /** For 'orbit' / 'stream' — radius in world units */
  orbitRadius?: number;
  /** Lift bias: 0 = no lift, 1 = fully upward */
  liftBias: number;
  /** Spread half-angle in radians for burst/stream */
  spread: number;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const EFFECT_PRESETS: EffectPreset[] = [
  // ── MAGIC ─────────────────────────────────────────────────────────────────
  {
    id: 'magic-arcane',
    category: 'magic',
    label: 'Arcano',
    description: 'Anel de partículas violetas com brilho central e orbita lenta.',
    spawnOffset: [0, 1.2, 0],
    emitterMode: 'orbit',
    additiveBlend: true,
    orbitRadius: 0.5,
    liftBias: 0.1,
    spread: Math.PI / 6,
    params: {
      color: '8b5cf6',
      colorSecondary: 'c084fc',
      scale: 1,
      speed: 1.4,
      count: 60,
      duration: 2.0,
      intensity: 1.8,
    },
  },
  {
    id: 'magic-frost',
    category: 'magic',
    label: 'Gelo',
    description: 'Cristais cintilantes ciano spiraling para o centro.',
    spawnOffset: [0, 1.0, 0],
    emitterMode: 'orbit',
    additiveBlend: true,
    orbitRadius: 0.7,
    liftBias: 0.15,
    spread: Math.PI / 4,
    params: {
      color: '67e8f9',
      colorSecondary: 'e0f2fe',
      scale: 0.85,
      speed: 2.0,
      count: 55,
      duration: 1.8,
      intensity: 1.5,
    },
  },

  // ── FIRE ──────────────────────────────────────────────────────────────────
  {
    id: 'fire-blaze',
    category: 'fire',
    label: 'Chamas',
    description: 'Coluna de fogo com partículas laranja/vermelho subindo.',
    spawnOffset: [0, 0.1, 0],
    emitterMode: 'stream',
    additiveBlend: true,
    liftBias: 0.9,
    spread: Math.PI / 8,
    params: {
      color: 'f97316',
      colorSecondary: 'fde047',
      scale: 1,
      speed: 2.2,
      count: 80,
      duration: 2.5,
      intensity: 2.0,
    },
  },
  {
    id: 'fire-ember',
    category: 'fire',
    label: 'Brasa',
    description: 'Faíscas vermelhas espalhadas com drift lento.',
    spawnOffset: [0, 0.5, 0],
    emitterMode: 'burst',
    additiveBlend: true,
    liftBias: 0.6,
    spread: Math.PI / 2,
    params: {
      color: 'ef4444',
      colorSecondary: 'fb923c',
      scale: 0.7,
      speed: 1.6,
      count: 45,
      duration: 1.5,
      intensity: 1.4,
    },
  },

  // ── WIND ──────────────────────────────────────────────────────────────────
  {
    id: 'wind-gust',
    category: 'wind',
    label: 'Rajada',
    description: 'Linhas horizontais de ar com partículas esverdeadas.',
    spawnOffset: [0, 1.0, 0],
    emitterMode: 'burst',
    additiveBlend: false,
    liftBias: 0.2,
    spread: Math.PI / 3,
    params: {
      color: '86efac',
      colorSecondary: 'bbf7d0',
      scale: 1.2,
      speed: 3.5,
      count: 50,
      duration: 0.8,
      intensity: 1.2,
    },
  },
  {
    id: 'wind-tornado',
    category: 'wind',
    label: 'Tornardo',
    description: 'Espiral de partículas subindo em helix verde-branco.',
    spawnOffset: [0, 0.0, 0],
    emitterMode: 'orbit',
    additiveBlend: true,
    orbitRadius: 0.45,
    liftBias: 0.8,
    spread: Math.PI / 12,
    params: {
      color: '4ade80',
      colorSecondary: 'f0fdf4',
      scale: 1,
      speed: 2.8,
      count: 70,
      duration: 3.0,
      intensity: 1.3,
    },
  },

  // ── SLASH ─────────────────────────────────────────────────────────────────
  {
    id: 'slash-blade',
    category: 'slash',
    label: 'Corte',
    description: 'Arco de energia branca com partículas de rastro.',
    spawnOffset: [0, 1.2, 0.3],
    emitterMode: 'trail',
    additiveBlend: true,
    liftBias: 0.0,
    spread: Math.PI * 0.6,
    params: {
      color: 'f8fafc',
      colorSecondary: 'bae6fd',
      scale: 1.3,
      speed: 5.0,
      count: 35,
      duration: 0.5,
      intensity: 2.5,
    },
  },
  {
    id: 'slash-critical',
    category: 'slash',
    label: 'Critico',
    description: 'Corte duplo dourado com flash de impacto.',
    spawnOffset: [0, 1.0, 0.3],
    emitterMode: 'trail',
    additiveBlend: true,
    liftBias: 0.0,
    spread: Math.PI * 0.7,
    params: {
      color: 'fde047',
      colorSecondary: 'fca5a5',
      scale: 1.5,
      speed: 6.0,
      count: 50,
      duration: 0.6,
      intensity: 3.0,
    },
  },

  // ── ARROW ─────────────────────────────────────────────────────────────────
  {
    id: 'arrow-projectile',
    category: 'arrow',
    label: 'Flecha',
    description: 'Projétil com rastro de partículas marrons e impacto.',
    spawnOffset: [-1.5, 1.0, 0],
    emitterMode: 'stream',
    additiveBlend: false,
    liftBias: 0.05,
    spread: Math.PI / 32,
    params: {
      color: 'a16207',
      colorSecondary: 'fde68a',
      scale: 0.6,
      speed: 8.0,
      count: 20,
      duration: 0.6,
      intensity: 1.0,
    },
  },
  {
    id: 'arrow-magical',
    category: 'arrow',
    label: 'Flecha Magica',
    description: 'Flecha de energia com rastro arcano ciano.',
    spawnOffset: [-1.5, 1.0, 0],
    emitterMode: 'stream',
    additiveBlend: true,
    liftBias: 0.0,
    spread: Math.PI / 24,
    params: {
      color: '22d3ee',
      colorSecondary: '818cf8',
      scale: 0.7,
      speed: 9.0,
      count: 30,
      duration: 0.5,
      intensity: 1.8,
    },
  },

  // ── EXPLOSION ─────────────────────────────────────────────────────────────
  {
    id: 'explosion-standard',
    category: 'explosion',
    label: 'Explosao',
    description: 'Burst radial de partículas laranja com shockwave.',
    spawnOffset: [0, 0.8, 0],
    emitterMode: 'burst',
    additiveBlend: true,
    liftBias: 0.3,
    spread: Math.PI,
    params: {
      color: 'f97316',
      colorSecondary: 'fbbf24',
      scale: 2.0,
      speed: 4.5,
      count: 120,
      duration: 1.2,
      intensity: 2.5,
    },
  },
  {
    id: 'explosion-dark',
    category: 'explosion',
    label: 'Explosao Sombria',
    description: 'Explosão roxa com energia sombria.',
    spawnOffset: [0, 0.8, 0],
    emitterMode: 'burst',
    additiveBlend: true,
    liftBias: 0.4,
    spread: Math.PI,
    params: {
      color: '7c3aed',
      colorSecondary: 'e879f9',
      scale: 1.8,
      speed: 3.8,
      count: 100,
      duration: 1.4,
      intensity: 2.2,
    },
  },

  // ── AURA ──────────────────────────────────────────────────────────────────
  {
    id: 'aura-hero',
    category: 'aura',
    label: 'Aura Heroi',
    description: 'Aura dourada em órbita contínua ao redor do personagem.',
    spawnOffset: [0, 0.5, 0],
    emitterMode: 'orbit',
    additiveBlend: true,
    orbitRadius: 0.9,
    liftBias: 0.05,
    spread: Math.PI * 2,
    params: {
      color: 'fbbf24',
      colorSecondary: 'fef3c7',
      scale: 1,
      speed: 1.0,
      count: 80,
      duration: 99, // continuous
      intensity: 1.6,
    },
  },
  {
    id: 'aura-dark',
    category: 'aura',
    label: 'Aura Sombria',
    description: 'Aura sombria vermelha pulsante.',
    spawnOffset: [0, 0.5, 0],
    emitterMode: 'orbit',
    additiveBlend: true,
    orbitRadius: 0.95,
    liftBias: 0.05,
    spread: Math.PI * 2,
    params: {
      color: 'dc2626',
      colorSecondary: '450a0a',
      scale: 1,
      speed: 0.8,
      count: 60,
      duration: 99,
      intensity: 1.4,
    },
  },

  // ── HIT ───────────────────────────────────────────────────────────────────
  {
    id: 'hit-physical',
    category: 'hit',
    label: 'Impacto Fisico',
    description: 'Flash branco + sparks de impacto físico.',
    spawnOffset: [0, 1.1, 0.3],
    emitterMode: 'burst',
    additiveBlend: true,
    liftBias: 0.1,
    spread: Math.PI * 0.8,
    params: {
      color: 'f8fafc',
      colorSecondary: 'fca5a5',
      scale: 0.8,
      speed: 3.5,
      count: 40,
      duration: 0.4,
      intensity: 2.0,
    },
  },
  {
    id: 'hit-magical',
    category: 'hit',
    label: 'Impacto Magico',
    description: 'Burst de energia arcana violeta no ponto de impacto.',
    spawnOffset: [0, 1.1, 0.3],
    emitterMode: 'burst',
    additiveBlend: true,
    liftBias: 0.2,
    spread: Math.PI * 0.9,
    params: {
      color: 'a78bfa',
      colorSecondary: 'e9d5ff',
      scale: 1.0,
      speed: 3.0,
      count: 50,
      duration: 0.5,
      intensity: 2.2,
    },
  },

  // ── BUFF / DEBUFF ─────────────────────────────────────────────────────────
  {
    id: 'buff-heal',
    category: 'buff',
    label: 'Cura',
    description: 'Partículas verdes subindo em espiral — cura/regeneração.',
    spawnOffset: [0, 0.0, 0],
    emitterMode: 'orbit',
    additiveBlend: false,
    orbitRadius: 0.55,
    liftBias: 0.95,
    spread: Math.PI / 4,
    params: {
      color: '4ade80',
      colorSecondary: 'bbf7d0',
      scale: 0.8,
      speed: 1.5,
      count: 45,
      duration: 2.0,
      intensity: 1.2,
    },
  },
  {
    id: 'buff-power',
    category: 'buff',
    label: 'Forca',
    description: 'Energia dourada em espiral — buff de ataque.',
    spawnOffset: [0, 0.0, 0],
    emitterMode: 'orbit',
    additiveBlend: true,
    orbitRadius: 0.6,
    liftBias: 0.8,
    spread: Math.PI / 5,
    params: {
      color: 'fbbf24',
      colorSecondary: 'fef9c3',
      scale: 0.9,
      speed: 1.8,
      count: 50,
      duration: 2.2,
      intensity: 1.5,
    },
  },
  {
    id: 'debuff-poison',
    category: 'buff',
    label: 'Veneno',
    description: 'Bolhas venenosas subindo — debuff de veneno.',
    spawnOffset: [0, 0.0, 0],
    emitterMode: 'stream',
    additiveBlend: false,
    liftBias: 0.7,
    spread: Math.PI / 6,
    params: {
      color: '84cc16',
      colorSecondary: '365314',
      scale: 0.75,
      speed: 0.9,
      count: 30,
      duration: 3.0,
      intensity: 1.0,
    },
  },

  // ── AMBIENT ───────────────────────────────────────────────────────────────
  {
    id: 'ambient-dust',
    category: 'ambient',
    label: 'Poeira',
    description: 'Partículas de poeira flutuando aleatoriamente.',
    spawnOffset: [0, 0.5, 0],
    emitterMode: 'stream',
    additiveBlend: false,
    liftBias: 0.3,
    spread: Math.PI * 2,
    params: {
      color: 'e2d9c4',
      colorSecondary: 'f5f0e8',
      scale: 0.5,
      speed: 0.3,
      count: 25,
      duration: 99,
      intensity: 0.6,
    },
  },
  {
    id: 'ambient-sparkle',
    category: 'ambient',
    label: 'Brilhos',
    description: 'Cintilações mágicas espalhadas no espaço.',
    spawnOffset: [0, 1.0, 0],
    emitterMode: 'stream',
    additiveBlend: true,
    liftBias: 0.1,
    spread: Math.PI * 2,
    params: {
      color: 'e0f2fe',
      colorSecondary: 'fef08a',
      scale: 0.4,
      speed: 0.5,
      count: 20,
      duration: 99,
      intensity: 1.0,
    },
  },
];

export const EFFECT_PRESETS_BY_CATEGORY: Record<EffectCategory, EffectPreset[]> = {
  magic: EFFECT_PRESETS.filter((p) => p.category === 'magic'),
  fire: EFFECT_PRESETS.filter((p) => p.category === 'fire'),
  wind: EFFECT_PRESETS.filter((p) => p.category === 'wind'),
  slash: EFFECT_PRESETS.filter((p) => p.category === 'slash'),
  arrow: EFFECT_PRESETS.filter((p) => p.category === 'arrow'),
  explosion: EFFECT_PRESETS.filter((p) => p.category === 'explosion'),
  aura: EFFECT_PRESETS.filter((p) => p.category === 'aura'),
  hit: EFFECT_PRESETS.filter((p) => p.category === 'hit'),
  buff: EFFECT_PRESETS.filter((p) => p.category === 'buff'),
  ambient: EFFECT_PRESETS.filter((p) => p.category === 'ambient'),
};

export const EFFECT_CATEGORY_LABELS: Record<EffectCategory, string> = {
  magic: 'Magia',
  fire: 'Fogo',
  wind: 'Vento',
  slash: 'Corte',
  arrow: 'Flecha',
  explosion: 'Explosão',
  aura: 'Aura',
  hit: 'Impacto',
  buff: 'Buff/Debuff',
  ambient: 'Ambiente',
};

export const EFFECT_CATEGORY_ICONS: Record<EffectCategory, string> = {
  magic: '✦',
  fire: '🔥',
  wind: '🌀',
  slash: '⚔️',
  arrow: '🏹',
  explosion: '💥',
  aura: '⭐',
  hit: '💢',
  buff: '⬆️',
  ambient: '🌿',
};
