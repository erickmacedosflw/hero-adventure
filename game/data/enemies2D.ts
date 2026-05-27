/**
 * Bestiário de Inimigos 2D — Lendas do Abismo
 *
 * Cada inimigo usa sprites PNG estáticos (6 posições) em vez de modelos 3D.
 * Os sprites ficam em:  game/assets/Characters/2D/{race}/{id}/{id}_{position}.png
 *
 * Raças disponíveis: Criaturas | Orcs
 */

import type { LootChance } from '../../types';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Enemy2DRace = 'Criaturas' | 'Orcs';

export type Enemy2DSpritePosition = 'idle' | 'attack' | 'defense' | 'magic' | 'damage' | 'dead';

export type Enemy2DType = 'beast' | 'humanoid' | 'undead';

export const ENEMY_2D_SPRITE_POSITIONS: Array<{ id: Enemy2DSpritePosition; label: string }> = [
  { id: 'idle',     label: 'Idle'     },
  { id: 'attack',   label: 'Ataque'   },
  { id: 'defense',  label: 'Defesa'   },
  { id: 'magic',    label: 'Magia'    },
  { id: 'damage',   label: 'Dano'     },
  { id: 'dead',     label: 'Morte'    },
];

export interface Enemy2DSprites {
  idle:    string;
  attack:  string;
  defense: string;
  magic:   string;
  damage:  string;
  dead:    string;
}

export interface Enemy2DBaseStats {
  hp:       number;
  maxHp:    number;
  mp:       number;
  maxMp:    number;
  atk:      number;
  def:      number;
  magicDef: number;
  speed:    number;
  luck:     number;
  magic:    number;
}

export interface Enemy2DTemplate {
  id:              string;
  name:            string;
  race:            Enemy2DRace;
  lore:            string;
  type:            Enemy2DType;
  level:           number;
  baseStats:       Enemy2DBaseStats;
  xpReward:        number;
  goldReward:      number;
  sprites:         Enemy2DSprites;
  scale?:          number;   // altura em unidades Three.js (default 2.0)
  attackStyle?:    'melee' | 'ranged'; // controla animação de ataque (default: 'melee')
  guaranteedDrops?: string[];
  rareDrops?:      LootChance[];
}

// ── Helper de sprites ────────────────────────────────────────────────────────

function makeSprites(race: Enemy2DRace, id: string): Enemy2DSprites {
  const base = `/game/assets/Characters/2D/${race}/${id}`;
  return {
    idle:    `${base}/${id}_idle.png`,
    attack:  `${base}/${id}_attack.png`,
    defense: `${base}/${id}_defense.png`,
    magic:   `${base}/${id}_magic.png`,
    damage:  `${base}/${id}_damage.png`,
    dead:    `${base}/${id}_dead.png`,
  };
}

// ── Bestiário ─────────────────────────────────────────────────────────────────

export const ENEMIES_2D: Enemy2DTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CRIATURAS — feras selvagens do campo e das florestas
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:   'aguia_comum',
    name: 'Águia Comum',
    race: 'Criaturas',
    lore: 'Rapineira dos picos abissais que mergulha em pique para rasgar presas com garras afiadas como lâminas. Sua velocidade a torna difícil de prever.',
    type:  'beast',
    level: 3,
    baseStats: {
      hp: 28, maxHp: 28,
      mp:  0, maxMp:  0,
      atk: 7, def: 3, magicDef: 2,
      speed: 12, luck: 4, magic: 0,
    },
    xpReward:   22,
    goldReward:  9,
    scale: 1.9,
    sprites: makeSprites('Criaturas', 'aguia_comum'),
    rareDrops: [{ itemId: 'mat_feather', chance: 0.30 }],
  },

  {
    id:   'lobo_comum',
    name: 'Lobo Comum',
    race: 'Criaturas',
    lore: 'Predador de matilha das sombras da floresta. Ataca com força bruta e não recua enquanto seus companheiros ainda uivam ao fundo.',
    type:  'beast',
    level: 4,
    baseStats: {
      hp: 36, maxHp: 36,
      mp:  0, maxMp:  0,
      atk: 9, def: 4, magicDef: 2,
      speed: 9, luck: 3, magic: 0,
    },
    xpReward:   28,
    goldReward: 12,
    scale: 2.1,
    sprites: makeSprites('Criaturas', 'lobo_comum'),
    rareDrops: [
      { itemId: 'mat_bone', chance: 0.20 },
      { itemId: 'pot_1',    chance: 0.06 },
    ],
  },

  {
    id:   'rato_comum',
    name: 'Rato Comum',
    race: 'Criaturas',
    lore: 'Roedor gigante das tocas subterrâneas do Abismo. Fraco individualmente, mas se aproveita da velocidade para fugir e atacar de surpresa.',
    type:  'beast',
    level: 1,
    baseStats: {
      hp: 18, maxHp: 18,
      mp:  0, maxMp:  0,
      atk: 4, def: 2, magicDef: 1,
      speed: 14, luck: 5, magic: 0,
    },
    xpReward:   12,
    goldReward:  5,
    scale: 1.7,
    sprites: makeSprites('Criaturas', 'rato_comum'),
    rareDrops: [{ itemId: 'mat_slime', chance: 0.15 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORCS — humanóides guerreiros das planícies de cinzas
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:   'orc_arqueiro_comum',
    name: 'Orc Arqueiro',
    race: 'Orcs',
    lore: 'Atirador das hordas verdes que recua ao menor sinal de perigo. Suas flechas envenenadas causam sangramento antes de qualquer confronto corpo a corpo.',
    type:  'humanoid',
    level: 5,
    baseStats: {
      hp: 40, maxHp: 40,
      mp: 10, maxMp: 10,
      atk: 10, def: 5, magicDef: 4,
      speed: 10, luck: 5, magic: 3,
    },
    xpReward:   35,
    goldReward: 16,
    scale: 2.7,
    attackStyle: 'ranged',
    sprites: makeSprites('Orcs', 'orc_arqueiro_comum'),
    rareDrops: [
      { itemId: 'mat_cloth', chance: 0.18 },
      { itemId: 'pot_1',     chance: 0.08 },
    ],
  },

  {
    id:   'orc_barbaro_comum',
    name: 'Orc Bárbaro',
    race: 'Orcs',
    lore: 'Colosso de músculos e raiva pura que entra em frenesi ao ver sangue. Lento, mas cada golpe pode partir armaduras de aço.',
    type:  'humanoid',
    level: 6,
    baseStats: {
      hp: 60, maxHp: 60,
      mp:  0, maxMp:  0,
      atk: 15, def: 7, magicDef: 3,
      speed: 5, luck: 2, magic: 0,
    },
    xpReward:   45,
    goldReward: 20,
    scale: 3.0,
    sprites: makeSprites('Orcs', 'orc_barbaro_comum'),
    rareDrops: [
      { itemId: 'mat_bone',  chance: 0.22 },
      { itemId: 'mat_metal', chance: 0.12 },
    ],
  },

  {
    id:   'orc_ladrao_comum',
    name: 'Orc Ladrão',
    race: 'Orcs',
    lore: 'Especialista em golpes sujos e roubos em combate. Capaz de roubar itens do inventário do herói antes de desaparecer nas sombras.',
    type:  'humanoid',
    level: 5,
    baseStats: {
      hp: 38, maxHp: 38,
      mp:  8, maxMp:  8,
      atk: 11, def: 4, magicDef: 5,
      speed: 13, luck: 8, magic: 2,
    },
    xpReward:   33,
    goldReward: 14,
    scale: 2.6,
    sprites: makeSprites('Orcs', 'orc_ladrao_comum'),
    rareDrops: [
      { itemId: 'mat_cloth', chance: 0.20 },
      { itemId: 'pot_1',     chance: 0.10 },
    ],
  },
];

// ── Helpers de consulta ───────────────────────────────────────────────────────

export const ENEMIES_2D_BY_RACE: Record<Enemy2DRace, Enemy2DTemplate[]> = {
  Criaturas: ENEMIES_2D.filter((e) => e.race === 'Criaturas'),
  Orcs:      ENEMIES_2D.filter((e) => e.race === 'Orcs'),
};

export const ENEMY_2D_RACES: Enemy2DRace[] = ['Criaturas', 'Orcs'];

export function getEnemy2DById(id: string): Enemy2DTemplate | undefined {
  return ENEMIES_2D.find((e) => e.id === id);
}

export function getEnemy2DTypeLabel(type: Enemy2DType): string {
  return type === 'beast' ? 'Fera' : type === 'humanoid' ? 'Humanoide' : 'Morto-vivo';
}
