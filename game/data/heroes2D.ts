/**
 * heroes2D.ts — Modelos 2D dos heróis jogáveis para visualização no bestiário dev.
 * Sprites de combate: idle, attack, defense, magic, damage, dead.
 *
 * Estrutura de pastas:
 *   game/assets/Characters/2D/Herois/{folder}/{prefix}_{position}.png
 *   (cavaleiro e maga têm subpasta extra com o mesmo nome)
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Hero2DSprites {
  idle:    string;
  attack:  string;
  defense: string;
  magic:   string;
  damage:  string;
  dead:    string;
}

export interface Hero2DTemplate {
  id:                  string;
  name:                string;
  title:               string;
  description:         string;
  classId:             string;       // corresponde ao id em PLAYER_CLASSES
  baseStats: {
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
  };
  weaponProficiencies: string[];
  sprites:             Hero2DSprites;
  scale?:              number;             // altura em unidades Three.js (default 2.0)
  attackStyle?:        'melee' | 'ranged'; // controla animação de ataque
}

// ── Posições de sprite ────────────────────────────────────────────────────────

export const HERO_2D_SPRITE_POSITIONS = [
  { id: 'idle',    label: 'Idle'   },
  { id: 'attack',  label: 'Ataque' },
  { id: 'defense', label: 'Defesa' },
  { id: 'magic',   label: 'Magia'  },
  { id: 'damage',  label: 'Dano'   },
  { id: 'dead',    label: 'Morte'  },
] as const;

export type Hero2DSpritePosition = (typeof HERO_2D_SPRITE_POSITIONS)[number]['id'];

// ── Helper de sprites ─────────────────────────────────────────────────────────

function makeHeroSprites(folder: string, prefix: string): Hero2DSprites {
  const base = `/game/assets/Characters/2D/Herois/${folder}`;
  return {
    idle:    `${base}/${prefix}_idle.png`,
    attack:  `${base}/${prefix}_attack.png`,
    defense: `${base}/${prefix}_defense.png`,
    magic:   `${base}/${prefix}_magic.png`,
    damage:  `${base}/${prefix}_damage.png`,
    dead:    `${base}/${prefix}_dead.png`,
  };
}

// ── Heróis ────────────────────────────────────────────────────────────────────

export const HEROES_2D: Hero2DTemplate[] = [
  {
    id:          'cavaleiro',
    name:        'Cavaleiro',
    title:       'Vanguarda de Aço',
    description: 'Classe pesada focada em presença de campo, defesa sólida e combate corpo a corpo. Absorve dano e protege os aliados com escudo e armadura.',
    classId:     'knight',
    baseStats:   { hp: 140, maxHp: 140, mp: 40,  maxMp: 40,  atk: 16, def: 14, magicDef: 8,  speed: 8,  luck: 2, magic: 10 },
    weaponProficiencies: ['Espada', 'Machado', 'Lança'],
    // cavaleiro_combat tem subpasta extra: cavaleiro_combat/cavaleiro_combat/
    sprites:     makeHeroSprites('cavaleiro_combat/cavaleiro_combat', 'cavaleiro_combat'),
    attackStyle: 'melee',
    scale:       2.5,
  },
  {
    id:          'barbaro',
    name:        'Bárbaro',
    title:       'Colosso Tribal',
    description: 'Aguenta pancada, converte fúria em dano bruto e domina trocas curtas com alta pressão. Ofensiva feroz com baixa defesa mágica.',
    classId:     'barbarian',
    baseStats:   { hp: 140, maxHp: 140, mp: 26,  maxMp: 26,  atk: 22, def: 8,  magicDef: 6,  speed: 6,  luck: 2, magic: 8  },
    weaponProficiencies: ['Machado', 'Maça', 'Espada Longa'],
    sprites:     makeHeroSprites('barbaro_combat', 'barbaro_combat'),
    attackStyle: 'melee',
    scale:       2.5,
  },
  {
    id:          'maga',
    name:        'Maga',
    title:       'Arcanista do Crepúsculo',
    description: 'Especialista em mana e explosões mágicas, frágil na linha de frente mas muito eficiente em ofensiva sustentada e controle de área.',
    classId:     'mage',
    baseStats:   { hp: 96,  maxHp: 96,  mp: 110, maxMp: 110, atk: 10, def: 8,  magicDef: 14, speed: 12, luck: 4, magic: 20 },
    weaponProficiencies: ['Cajado', 'Varinha', 'Livro Arcano'],
    // maga_combat tem subpasta extra: maga_combat/maga_combat/
    sprites:     makeHeroSprites('maga_combat/maga_combat', 'maga_combat'),
    attackStyle: 'ranged',
    scale:       2.5,
  },
  {
    id:          'arqueiro',
    name:        'Arqueiro',
    title:       'Batedora da Fronteira',
    description: 'Classe ágil e técnica, equilibrada entre pressão ofensiva, mobilidade alta e boa economia de recursos. Precisão e alcance como vantagem.',
    classId:     'ranger',
    baseStats:   { hp: 118, maxHp: 118, mp: 58,  maxMp: 58,  atk: 15, def: 10, magicDef: 10, speed: 14, luck: 8, magic: 12 },
    weaponProficiencies: ['Arco', 'Besta', 'Faca de Arremesso'],
    sprites:     makeHeroSprites('arqueiro_combat', 'arqueiro_combat'),
    attackStyle: 'ranged',
    scale:       2.5,
  },
  {
    id:          'ladino',
    name:        'Ladino',
    title:       'Lâmina das Sombras',
    description: 'Explora velocidade, precisão e sorte alta para vencer com pressão contínua e janelas curtas de burst. Mestre do crítico e da evasão.',
    classId:     'rogue',
    baseStats:   { hp: 108, maxHp: 108, mp: 52,  maxMp: 52,  atk: 14, def: 12, magicDef: 8,  speed: 16, luck: 5, magic: 12 },
    weaponProficiencies: ['Adaga', 'Espada Curta', 'Besta Leve'],
    sprites:     makeHeroSprites('ladino_combat', 'ladino_combat'),
    attackStyle: 'melee',
    scale:       2.5,
  },
];
