
import { Item, Skill, Player } from './types';

export const SHOP_ITEMS: Item[] = [
  // --- POTIONS & CONSUMABLES ---
  { id: 'pot_1', name: 'Poção Menor', description: 'Cura ferimentos leves. +50 HP', cost: 30, type: 'potion', value: 50, icon: '🧪', rarity: 'bronze', minLevel: 1 },
  { id: 'pot_2', name: 'Poção de Mana', description: 'Restaura energia mágica. +30 MP', cost: 40, type: 'potion', value: 30, icon: '⚗️', rarity: 'bronze', minLevel: 1 },
  
  // Buff Items
  { id: 'pot_atk', name: 'Poção da Fúria', description: '+50% de Ataque por 3 turnos.', cost: 120, type: 'potion', value: 0.5, icon: '🔥', rarity: 'silver', minLevel: 3, duration: 3 },
  { id: 'pot_def', name: 'Tônico de Ferro', description: '+50% de Defesa por 3 turnos.', cost: 120, type: 'potion', value: 0.5, icon: '🛡️', rarity: 'silver', minLevel: 3, duration: 3 },

  { id: 'pot_3', name: 'Elixir Prateado', description: 'Cura potente. +150 HP', cost: 150, type: 'potion', value: 150, icon: '💖', rarity: 'silver', minLevel: 3 },
  { id: 'pot_4', name: 'Ambrosia Dourada', description: 'Restauração total. +500 HP', cost: 600, type: 'potion', value: 500, icon: '🌟', rarity: 'gold', minLevel: 8 },

  // --- WEAPONS ---
  // Bronze (Lvl 1-2)
  { id: 'wep_b1', name: 'Adaga de Cobre', description: 'Simples mas afiada. +6 ATK', cost: 100, type: 'weapon', value: 6, icon: '🗡️', rarity: 'bronze', minLevel: 1 },
  { id: 'wep_b2', name: 'Machadinha Velha', description: 'Pesada e brutal. +10 ATK', cost: 250, type: 'weapon', value: 10, icon: '🪓', rarity: 'bronze', minLevel: 2 },
  
  // Silver (Lvl 3-6)
  { id: 'wep_s1', name: 'Espada de Aço', description: 'Forjada por ferreiros reais. +18 ATK', cost: 600, type: 'weapon', value: 18, icon: '⚔️', rarity: 'silver', minLevel: 4 },
  { id: 'wep_s2', name: 'Lança de Mithril', description: 'Leve e letal. +25 ATK', cost: 1200, type: 'weapon', value: 25, icon: '🔱', rarity: 'silver', minLevel: 6 },

  // Gold (Lvl 7+)
  { id: 'wep_g1', name: 'Katana do Vazio', description: 'Corta a própria realidade. +45 ATK', cost: 3500, type: 'weapon', value: 45, icon: '🌑', rarity: 'gold', minLevel: 8 },
  { id: 'wep_g2', name: 'Excalibur Pixel', description: 'A lenda digital. +70 ATK', cost: 8000, type: 'weapon', value: 70, icon: '✨', rarity: 'gold', minLevel: 12 },

  // --- ARMOR (CHEST) ---
  { id: 'arm_b1', name: 'Túnica de Couro', description: 'Proteção básica. +4 DEF', cost: 80, type: 'armor', value: 4, icon: '👕', rarity: 'bronze', minLevel: 1 },
  { id: 'arm_s1', name: 'Cota de Malha', description: 'Elos de aço entrelaçados. +12 DEF', cost: 500, type: 'armor', value: 12, icon: '⛓️', rarity: 'silver', minLevel: 4 },
  { id: 'arm_g1', name: 'Peitoral Rúnico', description: 'Encantado com magia antiga. +30 DEF', cost: 2800, type: 'armor', value: 30, icon: '🛡️', rarity: 'gold', minLevel: 9 },

  // --- HELMETS ---
  { id: 'hlm_b1', name: 'Capuz de Viajante', description: 'Protege do sol. +2 DEF', cost: 50, type: 'helmet', value: 2, icon: '🧢', rarity: 'bronze', minLevel: 1 },
  { id: 'hlm_s1', name: 'Elmo de Gladiador', description: 'Intimidador. +8 DEF', cost: 400, type: 'helmet', value: 8, icon: '🪖', rarity: 'silver', minLevel: 5 },
  { id: 'hlm_g1', name: 'Coroa do Rei Lich', description: 'Gelada ao toque. +20 DEF', cost: 2200, type: 'helmet', value: 20, icon: '👑', rarity: 'gold', minLevel: 10 },

  // --- LEGS ---
  { id: 'leg_b1', name: 'Botas de Pano', description: 'Confortáveis. +1 DEF', cost: 40, type: 'legs', value: 1, icon: '🧦', rarity: 'bronze', minLevel: 1 },
  { id: 'leg_s1', name: 'Grevas de Ferro', description: 'Protege as canelas. +6 DEF', cost: 350, type: 'legs', value: 6, icon: '👢', rarity: 'silver', minLevel: 4 },
  
  // --- SHIELDS ---
  { id: 'shd_b1', name: 'Tábua de Madeira', description: 'Melhor que nada. +3 DEF', cost: 70, type: 'shield', value: 3, icon: '🪵', rarity: 'bronze', minLevel: 1 },
  { id: 'shd_s1', name: 'Escudo Torre', description: 'Uma parede móvel. +10 DEF', cost: 550, type: 'shield', value: 10, icon: '🚪', rarity: 'silver', minLevel: 5 },
  { id: 'shd_g1', name: 'Égide Sagrada', description: 'Reflete o mal. +25 DEF', cost: 3000, type: 'shield', value: 25, icon: '☀️', rarity: 'gold', minLevel: 9 },
];

export const MATERIALS: Item[] = [
  { id: 'mat_wood', name: 'Madeira', description: 'Um pedaço de madeira comum.', cost: 10, type: 'material', value: 0, icon: '🪵', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_bone', name: 'Osso', description: 'Um osso velho e ressecado.', cost: 15, type: 'material', value: 0, icon: '🦴', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_slime', name: 'Gosma', description: 'Uma substância pegajosa e nojenta.', cost: 12, type: 'material', value: 0, icon: '💧', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_cloth', name: 'Retalho de Pano', description: 'Um pedaço de tecido rasgado.', cost: 8, type: 'material', value: 0, icon: '🧻', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_iron', name: 'Fragmento de Ferro', description: 'Um pedaço de metal enferrujado.', cost: 25, type: 'material', value: 0, icon: '🔩', rarity: 'silver', minLevel: 3 },
  { id: 'mat_gold', name: 'Pepita de Ouro', description: 'Pequena, mas valiosa.', cost: 100, type: 'material', value: 0, icon: '🪙', rarity: 'gold', minLevel: 5 },
];

export const ALL_ITEMS: Item[] = [...SHOP_ITEMS, ...MATERIALS];

export const INITIAL_PLAYER: Player = {
  name: "Herói",
  level: 1,
  xp: 0,
  xpToNext: 100,
  statPoints: 0,
  gold: 150,
  stats: {
    hp: 120,
    maxHp: 120,
    mp: 50,
    maxMp: 50,
    atk: 12,
    def: 5,
    speed: 10,
    luck: 5
  },
  inventory: {
    'pot_1': 2 // Starts with 2 potions
  },
  equippedWeapon: null,
  equippedArmor: null,
  equippedHelmet: null,
  equippedLegs: null,
  equippedShield: null,
  skills: [],
  isDefending: false,
  limitMeter: 0,
  buffs: {
    atkMod: 0,
    defMod: 0,
    atkTurns: 0,
    defTurns: 0
  }
};

export const SKILLS: Skill[] = [
  { id: 'skl_1', name: 'Corte Voxel', cost: 0, damageMult: 1.5, minLevel: 2, description: 'Golpe físico preciso. 8 MP', manaCost: 8, type: 'physical' },
  { id: 'skl_2', name: 'Luz Sagrada', cost: 0, damageMult: 0, minLevel: 3, description: 'Cura feridas. 15 MP', manaCost: 15, type: 'heal' },
  { id: 'skl_3', name: 'Bola de Fogo', cost: 0, damageMult: 2.2, minLevel: 5, description: 'Queima o alvo. 20 MP', manaCost: 20, type: 'magic' },
  { id: 'skl_4', name: 'Lâmina do Dragão', cost: 0, damageMult: 3.5, minLevel: 8, description: 'Dano massivo. 45 MP', manaCost: 45, type: 'physical' },
];

export const ENEMY_DATA = [
  { name: "Slime Voxel", type: 'beast' },
  { name: "Lobo LowPoly", type: 'beast' },
  { name: "Javali Cúbico", type: 'beast' },
  { name: "Urso de Blocos", type: 'beast' },
  
  { name: "Goblin Cúbico", type: 'humanoid' },
  { name: "Orc Blocado", type: 'humanoid' },
  { name: "Cavaleiro 8-Bits", type: 'humanoid' },
  { name: "Bandido Voxel", type: 'humanoid' },
  
  { name: "Esqueleto Pixel", type: 'undead' },
  { name: "Lich Renderizado", type: 'undead' },
  { name: "Fantasma Glitch", type: 'undead' },
  { name: "Sombra Digital", type: 'undead' },
];

export const ENEMY_COLORS = [
  "#4ade80", // green
  "#84cc16", // lime
  "#e2e8f0", // bone
  "#475569", // dark grey
  "#15803d", // dark green
  "#78716c", // stone
  "#0f172a", // black
  "#9333ea", // purple
  "#dc2626", // red
  "#f59e0b", // amber
];
