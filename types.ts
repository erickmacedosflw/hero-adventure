
export enum GameState {
  MENU,
  TAVERN,
  BATTLE,
  SHOP,
  GAME_OVER,
  VICTORY,
  LEVEL_UP
}

export enum TurnState {
  PLAYER_INPUT,
  PLAYER_ANIMATION,
  ENEMY_TURN,
  PROCESSING
}

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  speed: number;
  luck: number; // New stat for crit chance
}

export type ItemType = 'weapon' | 'armor' | 'potion' | 'helmet' | 'legs' | 'shield' | 'material';
export type Rarity = 'bronze' | 'silver' | 'gold';

export interface Item {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: ItemType;
  value: number; // Atk, Def, or Heal amount
  icon: string; // Icon helper
  rarity: Rarity;
  minLevel: number;
  duration?: number; // For buffs
}

export interface Skill {
  id: string;
  name: string;
  cost: number; 
  damageMult: number;
  minLevel: number;
  description: string;
  manaCost: number;
  type: 'physical' | 'magic' | 'heal';
}

export interface Player {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  statPoints: number; // Points to distribute
  gold: number;
  stats: Stats;
  inventory: { [itemId: string]: number }; // Item ID -> Quantity
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedHelmet: Item | null;
  equippedLegs: Item | null;
  equippedShield: Item | null;
  skills: Skill[];
  isDefending: boolean;
  limitMeter: number; // 0 to 100
  buffs: {
    atkMod: number;
    defMod: number;
    atkTurns: number;
    defTurns: number;
  };
}

export interface Enemy {
  id: string;
  name: string;
  stats: Stats;
  level: number;
  xpReward: number;
  goldReward: number;
  color: string; 
  scale: number;
  type: 'beast' | 'humanoid' | 'undead';
  isBoss: boolean;
  isDefending: boolean;
}

export interface BattleLog {
  message: string;
  type: 'info' | 'damage' | 'heal' | 'crit' | 'evade' | 'buff';
}

export interface Particle {
  id: string;
  position: [number, number, number];
  color: string;
  scale: number;
  velocity: [number, number, number];
  life: number;
}

export interface FloatingText {
  id: string;
  text: string;
  type: 'damage' | 'heal' | 'crit' | 'buff';
  target: 'player' | 'enemy'; // Determines screen position
  xOffset: number; // Random slight offset
  yOffset: number;
}
