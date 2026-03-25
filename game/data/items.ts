import { Item } from '../../types';
import { REGISTERED_WEAPON_ITEMS } from './weaponCatalog';

export const SHOP_ITEMS: Item[] = [
  { id: 'pot_1', name: 'Pocao Menor', description: 'Cura ferimentos leves. +50 HP', cost: 30, type: 'potion', value: 50, icon: '🧪', rarity: 'bronze', minLevel: 1 },
  { id: 'pot_2', name: 'Pocao de Mana', description: 'Restaura energia magica. +30 MP', cost: 40, type: 'potion', value: 30, icon: '⚗️', rarity: 'bronze', minLevel: 1 },
  { id: 'pot_atk', name: 'Pocao da Furia', description: '+50% de Ataque por 3 turnos.', cost: 120, type: 'potion', value: 0.5, icon: '🔥', rarity: 'silver', minLevel: 3, duration: 3 },
  { id: 'pot_def', name: 'Tonico de Ferro', description: '+50% de Defesa por 3 turnos.', cost: 120, type: 'potion', value: 0.5, icon: '🛡️', rarity: 'silver', minLevel: 3, duration: 3 },
  { id: 'pot_3', name: 'Elixir Prateado', description: 'Cura potente. +150 HP', cost: 150, type: 'potion', value: 150, icon: '💖', rarity: 'silver', minLevel: 3 },
  { id: 'pot_4', name: 'Ambrosia Dourada', description: 'Restauracao total. +500 HP', cost: 600, type: 'potion', value: 500, icon: '🌟', rarity: 'gold', minLevel: 8 },
  { id: 'wep_b1', name: 'Adaga de Cobre', description: 'Simples mas afiada. +6 ATK', cost: 100, type: 'weapon', value: 6, icon: '🗡️', rarity: 'bronze', minLevel: 1 },
  { id: 'wep_b2', name: 'Machadinha Velha', description: 'Pesada e brutal. +10 ATK', cost: 250, type: 'weapon', value: 10, icon: '🪓', rarity: 'bronze', minLevel: 2 },
  { id: 'wep_s1', name: 'Espada de Aco', description: 'Forjada por ferreiros reais. +18 ATK', cost: 600, type: 'weapon', value: 18, icon: '⚔️', rarity: 'silver', minLevel: 4 },
  { id: 'wep_s2', name: 'Lanca de Mithril', description: 'Leve e letal. +25 ATK', cost: 1200, type: 'weapon', value: 25, icon: '🔱', rarity: 'silver', minLevel: 6 },
  { id: 'wep_g1', name: 'Katana do Vazio', description: 'Corta a propria realidade. +45 ATK', cost: 3500, type: 'weapon', value: 45, icon: '🌑', rarity: 'gold', minLevel: 8 },
  { id: 'wep_g2', name: 'Excalibur Pixel', description: 'A lenda digital. +70 ATK', cost: 8000, type: 'weapon', value: 70, icon: '✨', rarity: 'gold', minLevel: 12 },
  { id: 'arm_b1', name: 'Tunica de Couro', description: 'Protecao basica. +4 DEF', cost: 80, type: 'armor', value: 4, icon: '👕', rarity: 'bronze', minLevel: 1 },
  { id: 'arm_s1', name: 'Cota de Malha', description: 'Elos de aco entrelacados. +12 DEF', cost: 500, type: 'armor', value: 12, icon: '⛓️', rarity: 'silver', minLevel: 4 },
  { id: 'arm_g1', name: 'Peitoral Runico', description: 'Encantado com magia antiga. +30 DEF', cost: 2800, type: 'armor', value: 30, icon: '🛡️', rarity: 'gold', minLevel: 9 },
  { id: 'hlm_b1', name: 'Capuz de Viajante', description: 'Protege do sol. +2 DEF', cost: 50, type: 'helmet', value: 2, icon: '🧢', rarity: 'bronze', minLevel: 1 },
  { id: 'hlm_s1', name: 'Elmo de Gladiador', description: 'Intimidador. +8 DEF', cost: 400, type: 'helmet', value: 8, icon: '🪖', rarity: 'silver', minLevel: 5 },
  { id: 'hlm_g1', name: 'Coroa do Rei Lich', description: 'Gelada ao toque. +20 DEF', cost: 2200, type: 'helmet', value: 20, icon: '👑', rarity: 'gold', minLevel: 10 },
  { id: 'leg_b1', name: 'Botas de Pano', description: 'Confortaveis. +1 DEF', cost: 40, type: 'legs', value: 1, icon: '🧦', rarity: 'bronze', minLevel: 1 },
  { id: 'leg_s1', name: 'Grevas de Ferro', description: 'Protege as canelas. +6 DEF', cost: 350, type: 'legs', value: 6, icon: '👢', rarity: 'silver', minLevel: 4 },
  { id: 'shd_b1', name: 'Tabua de Madeira', description: 'Melhor que nada. +3 DEF', cost: 70, type: 'shield', value: 3, icon: '🪵', rarity: 'bronze', minLevel: 1 },
  { id: 'shd_s1', name: 'Escudo Torre', description: 'Uma parede movel. +10 DEF', cost: 550, type: 'shield', value: 10, icon: '🚪', rarity: 'silver', minLevel: 5 },
  { id: 'shd_g1', name: 'Egide Sagrada', description: 'Reflete o mal. +25 DEF', cost: 3000, type: 'shield', value: 25, icon: '☀️', rarity: 'gold', minLevel: 9 },
];

export const MATERIALS: Item[] = [
  { id: 'mat_wood', name: 'Madeira', description: 'Um pedaco de madeira comum.', cost: 10, type: 'material', value: 0, icon: '🪵', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_bone', name: 'Osso', description: 'Um osso velho e ressecado.', cost: 15, type: 'material', value: 0, icon: '🦴', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_slime', name: 'Gosma', description: 'Uma substancia pegajosa e nojenta.', cost: 12, type: 'material', value: 0, icon: '💧', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_cloth', name: 'Retalho de Pano', description: 'Um pedaco de tecido rasgado.', cost: 8, type: 'material', value: 0, icon: '🧻', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_iron', name: 'Fragmento de Ferro', description: 'Um pedaco de metal enferrujado.', cost: 25, type: 'material', value: 0, icon: '🔩', rarity: 'silver', minLevel: 3 },
  { id: 'mat_gold', name: 'Pepita de Ouro', description: 'Pequena, mas valiosa.', cost: 100, type: 'material', value: 0, icon: '🪙', rarity: 'gold', minLevel: 5 },
];

const NON_WEAPON_SHOP_ITEMS: Item[] = SHOP_ITEMS.filter((item) => item.type !== 'weapon');

export const ALL_ITEMS: Item[] = [...NON_WEAPON_SHOP_ITEMS, ...REGISTERED_WEAPON_ITEMS, ...MATERIALS];
