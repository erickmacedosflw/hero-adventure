
import { Item, Skill, Player } from './types';

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
  skills: []
};

export const SHOP_ITEMS: Item[] = [
  // POTIONS
  { id: 'pot_1', name: 'Poção de Vida P', description: 'Recupera 50 HP', cost: 30, type: 'potion', value: 50, icon: '🧪' },
  { id: 'pot_2', name: 'Poção de Mana P', description: 'Recupera 30 MP', cost: 30, type: 'potion', value: 30, icon: '⚗️' },
  { id: 'pot_3', name: 'Elixir da Vida', description: 'Recupera 150 HP', cost: 100, type: 'potion', value: 150, icon: '❤️' },
  
  // WEAPONS
  { id: 'wep_1', name: 'Adaga de Ferro', description: '+8 Ataque', cost: 150, type: 'weapon', value: 8, icon: '🗡️' },
  { id: 'wep_2', name: 'Espada Longa', description: '+18 Ataque', cost: 400, type: 'weapon', value: 18, icon: '⚔️' },
  { id: 'wep_3', name: 'Katana Sombria', description: '+45 Ataque', cost: 1200, type: 'weapon', value: 45, icon: '🌑' },
  
  // ARMOR (CHEST)
  { id: 'arm_1', name: 'Túnica de Viajante', description: '+5 Defesa', cost: 120, type: 'armor', value: 5, icon: '👕' },
  { id: 'arm_2', name: 'Peitoral de Aço', description: '+15 Defesa', cost: 380, type: 'armor', value: 15, icon: '🛡️' },
  { id: 'arm_3', name: 'Armadura Samurai', description: '+35 Defesa', cost: 1100, type: 'armor', value: 35, icon: '👹' },

  // HELMETS
  { id: 'hlm_1', name: 'Capuz de Couro', description: '+3 Defesa', cost: 80, type: 'helmet', value: 3, icon: '🧢' },
  { id: 'hlm_2', name: 'Elmo de Ferro', description: '+10 Defesa', cost: 250, type: 'helmet', value: 10, icon: '🪖' },

  // LEGS
  { id: 'leg_1', name: 'Botas Leves', description: '+2 Defesa', cost: 60, type: 'legs', value: 2, icon: '👢' },
  { id: 'leg_2', name: 'Grevas de Batalha', description: '+8 Defesa', cost: 220, type: 'legs', value: 8, icon: '🦵' },

  // SHIELDS
  { id: 'shd_1', name: 'Escudo de Madeira', description: '+5 Defesa', cost: 100, type: 'shield', value: 5, icon: '🛡️' },
  { id: 'shd_2', name: 'Escudo Torre', description: '+12 Defesa', cost: 450, type: 'shield', value: 12, icon: '🚪' },
];

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

// Legacy helper for simple name list if needed elsewhere, though we prefer ENEMY_DATA
export const ENEMY_NAMES = ENEMY_DATA.map(e => e.name);

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
