
import { Item, Skill, EnemyTemplate, DungeonEnemyTemplate, DungeonBossTemplate, AlchemistItemOffer } from './types';
import { REGISTERED_WEAPON_ITEMS } from './game/data/weaponCatalog';
import { CONSTELLATION_SKILLS } from './game/data/classTalents';
export { INITIAL_PLAYER } from './game/data/player';

export const SHOP_ITEMS: Item[] = [
  // --- POTIONS & CONSUMABLES ---
  { id: 'pot_1', name: 'Poção Menor', description: 'Cura ferimentos leves. +25 HP', cost: 40, type: 'potion', value: 25, icon: '🧪', rarity: 'bronze', minLevel: 1 },
  { id: 'pot_3', name: 'Poção de Vida', description: 'Recuperação moderada. +50 HP', cost: 70, type: 'potion', value: 50, icon: '❤️', rarity: 'bronze', minLevel: 2 },
  { id: 'pot_5', name: 'Elixir Rubro', description: 'Cura poderosa. +100 HP', cost: 120, type: 'potion', value: 100, icon: '💖', rarity: 'silver', minLevel: 3 },
  { id: 'pot_4', name: 'Ambrosia Dourada', description: 'Restauração superior. +220 HP', cost: 300, type: 'potion', value: 220, icon: '🌟', rarity: 'gold', minLevel: 7 },

  { id: 'pot_2', name: 'Essência de Mana Menor', description: 'Recupera energia arcana. +20 MP', cost: 40, type: 'potion', value: 20, icon: '⚗️', rarity: 'bronze', minLevel: 1 },
  { id: 'pot_mana_2', name: 'Tônico Arcano', description: 'Recuperação de mana intermediária. +45 MP', cost: 75, type: 'potion', value: 45, icon: '🔵', rarity: 'silver', minLevel: 3 },
  { id: 'pot_mana_3', name: 'Néctar Astral', description: 'Recuperação de mana avançada. +90 MP', cost: 140, type: 'potion', value: 90, icon: '🔷', rarity: 'gold', minLevel: 6 },

  { id: 'pot_mix_1', name: 'Tônico Balanceado', description: 'Recupera 35 HP e 20 MP.', cost: 95, type: 'potion', value: 35, icon: '🧬', rarity: 'silver', minLevel: 3 },
  { id: 'pot_mix_2', name: 'Elixir Dual', description: 'Recupera 80 HP e 50 MP.', cost: 190, type: 'potion', value: 80, icon: '💠', rarity: 'gold', minLevel: 6 },
  
  // Buff Items
  { id: 'pot_atk', name: 'Poção da Fúria', description: '+50% de Ataque por 3 turnos.', cost: 150, type: 'potion', value: 0.5, icon: '🔥', rarity: 'silver', minLevel: 3, duration: 3 },
  { id: 'pot_def', name: 'Tônico de Ferro', description: '+50% de Defesa por 3 turnos.', cost: 150, type: 'potion', value: 0.5, icon: '🛡️', rarity: 'silver', minLevel: 3, duration: 3 },

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

export const DUNGEON_ITEMS: Item[] = [
  { id: 'mat_ether_shard', name: 'Fragmento de Ether', description: 'Cristal instável recolhido das galerias da dungeon.', cost: 55, type: 'material', value: 0, icon: '🧿', rarity: 'silver', minLevel: 4, source: 'dungeon' },
  { id: 'mat_obsidian_heart', name: 'Coração de Obsidiana', description: 'Núcleo denso e quente arrancado de bestas abissais.', cost: 120, type: 'material', value: 0, icon: '🪨', rarity: 'gold', minLevel: 7, source: 'dungeon' },
  { id: 'mat_void_bloom', name: 'Flor do Vazio', description: 'Matéria viva que pulsa com energia da dungeon profunda.', cost: 180, type: 'material', value: 0, icon: '🌌', rarity: 'gold', minLevel: 9, source: 'dungeon' },
  { id: 'mat_nexus_core', name: 'Núcleo do Nexus', description: 'Relíquia absoluta deixada apenas pelo soberano da dungeon.', cost: 320, type: 'material', value: 0, icon: '💠', rarity: 'gold', minLevel: 12, source: 'dungeon' },
  { id: 'pot_dg_recall', name: 'Âncora de Retorno', description: 'Abre uma saída estável da dungeon e permite levar todo o espólio acumulado.', cost: 0, type: 'potion', value: 0, icon: '🧭', rarity: 'gold', minLevel: 1, source: 'dungeon' },
  { id: 'pot_alc_phantom_veil', name: 'Véu Fantasma', description: 'Reveste o corpo com névoa alquímica e garante evasão perfeita por 4 turnos em qualquer batalha.', cost: 0, type: 'potion', value: 1, icon: '👻', rarity: 'gold', minLevel: 1, source: 'alchemist', duration: 4 },
  { id: 'pot_alc_twin_fang', name: 'Presa Gêmea', description: 'Desperta um ritmo feroz e faz o comando Atacar acertar duas vezes por 6 turnos.', cost: 0, type: 'potion', value: 1, icon: '🦷', rarity: 'gold', minLevel: 1, source: 'alchemist', duration: 6 },
  { id: 'pot_dg_mana', name: 'Reserva de Mana Abissal', description: 'Energia condensada da dungeon. +80 MP', cost: 0, type: 'potion', value: 80, icon: '🔷', rarity: 'silver', minLevel: 6, source: 'dungeon' },
  { id: 'pot_dg_elixir', name: 'Elixir Abissal', description: 'Restauração reforçada da dungeon. +260 HP', cost: 0, type: 'potion', value: 260, icon: '🩸', rarity: 'gold', minLevel: 7, source: 'dungeon' },
  { id: 'pot_dg_ambrosia', name: 'Ambrosia do Nexus', description: 'Essência rara guardada no fundo da dungeon. +650 HP', cost: 0, type: 'potion', value: 650, icon: '🫧', rarity: 'gold', minLevel: 12, source: 'dungeon' },
  { id: 'wep_dg_nexus', name: 'Lâmina do Nexus', description: 'Arma exclusiva forjada com energia da dungeon. +58 ATK', cost: 0, type: 'weapon', value: 58, icon: '🗡️', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'arm_dg_abyss', name: 'Armadura do Abismo', description: 'Placas pesadas feitas para sobreviver aos ciclos profundos. +38 DEF', cost: 0, type: 'armor', value: 38, icon: '🥋', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'shd_dg_eclipse', name: 'Escudo Eclipse', description: 'Barreira exclusiva da dungeon que segura impactos do chefão. +32 DEF', cost: 0, type: 'shield', value: 32, icon: '🌘', rarity: 'gold', minLevel: 11, source: 'dungeon' },
  { id: 'hlm_dg_oracle', name: 'Elmo do Oráculo Fendido', description: 'Capacete ritualístico encontrado apenas em profundezas evoluídas. +24 DEF', cost: 0, type: 'helmet', value: 24, icon: '🔮', rarity: 'gold', minLevel: 10, source: 'dungeon' },
];

const NON_WEAPON_SHOP_ITEMS: Item[] = SHOP_ITEMS.filter((item) => item.type !== 'weapon');
const NON_WEAPON_DUNGEON_ITEMS: Item[] = DUNGEON_ITEMS.filter((item) => item.type !== 'weapon');

export const ALL_ITEMS: Item[] = [...NON_WEAPON_SHOP_ITEMS, ...REGISTERED_WEAPON_ITEMS, ...MATERIALS, ...NON_WEAPON_DUNGEON_ITEMS];

export const DUNGEON_ESCAPE_ITEM = DUNGEON_ITEMS.find(item => item.id === 'pot_dg_recall') as Item;

export const ALCHEMIST_ITEM_OFFERS: AlchemistItemOffer[] = [
  {
    id: 'alchemist_item_recall_anchor',
    cost: 3,
    tagline: 'Relíquia rara para abandonar a dungeon sem perder o espólio acumulado.',
    item: DUNGEON_ESCAPE_ITEM,
  },
  {
    id: 'alchemist_item_phantom_veil',
    cost: 2,
    tagline: 'Uma relíquia instável que torna o herói intocável por 4 turnos em qualquer batalha.',
    item: DUNGEON_ITEMS.find(item => item.id === 'pot_alc_phantom_veil') as Item,
  },
  {
    id: 'alchemist_item_twin_fang',
    cost: 2,
    tagline: 'Relíquia ofensiva que transforma seus ataques básicos em dois golpes por 6 turnos.',
    item: DUNGEON_ITEMS.find(item => item.id === 'pot_alc_twin_fang') as Item,
  },
];

const BASE_SKILLS: Skill[] = [
  { id: 'skl_1', name: 'Corte Voxel', cost: 0, damageMult: 1.5, minLevel: 1, description: 'Golpe físico preciso. 8 MP', manaCost: 8, type: 'physical' },
  { id: 'skl_2', name: 'Luz Sagrada', cost: 0, damageMult: 0.4, minLevel: 1, description: 'Cura 40% da vida maxima. 15 MP', manaCost: 15, type: 'heal' },
  { id: 'skl_3', name: 'Bola de Fogo', cost: 0, damageMult: 2.2, minLevel: 3, description: 'Projétil arcano em chamas. 20 MP', manaCost: 20, type: 'magic' },
  { id: 'skl_4', name: 'Lâmina do Dragão', cost: 0, damageMult: 3.5, minLevel: 8, description: 'Investida lendária devastadora. 45 MP', manaCost: 45, type: 'physical' },
  { id: 'skl_5', name: 'Tempestade Arcana', cost: 0, damageMult: 2.8, minLevel: 4, description: 'Explosão violeta que estilhaça o alvo. 24 MP', manaCost: 24, type: 'magic' },
  { id: 'skl_6', name: 'Quebraterra', cost: 0, damageMult: 2.9, minLevel: 5, description: 'Golpe bruto que faz a arena tremer. 26 MP', manaCost: 26, type: 'physical' },
  { id: 'skl_7', name: 'Nova Glacial', cost: 0, damageMult: 2.6, minLevel: 6, description: 'Rajada gelida de impacto concentrado. 28 MP', manaCost: 28, type: 'magic' },
  { id: 'skl_8', name: 'Cura Astral', cost: 0, damageMult: 0.65, minLevel: 6, description: 'Cura 65% da vida maxima. 30 MP', manaCost: 30, type: 'heal' },
  { id: 'skl_9', name: 'Lança Sombria', cost: 0, damageMult: 3.2, minLevel: 7, description: 'Perfuração sombria com rastro espectral. 34 MP', manaCost: 34, type: 'physical' },
  { id: 'skl_10', name: 'Julgamento Solar', cost: 0, damageMult: 4.1, minLevel: 9, description: 'Coluna sagrada de luz esmagadora. 52 MP', manaCost: 52, type: 'magic' },
];

export const SKILLS: Skill[] = [...BASE_SKILLS, ...CONSTELLATION_SKILLS];

const skeletonAnimationFiles = [
  'Rig_Medium_CombatMelee.fbx',
  'Rig_Medium_CombatRanged.fbx',
  'Rig_Medium_General.fbx',
  'Rig_Medium_MovementAdvanced.fbx',
  'Rig_Medium_MovementBasic.fbx',
  'Rig_Medium_Simulation.fbx',
  'Rig_Medium_Special.fbx',
  'Rig_Medium_Tools.fbx',
] as const;

const skeletonAnimationMap = {
  idle: 'Rig_Medium_General:Idle_A',
  battleIdle: 'Rig_Medium_CombatMelee:Melee_Unarmed_Idle',
  attackWeapon: 'Rig_Medium_CombatMelee:Melee_1H_Attack_Jump_Chop',
  attackUnarmed: 'Rig_Medium_CombatMelee:Melee_Unarmed_Attack_Punch_A',
  defend: 'Rig_Medium_CombatMelee:Melee_Blocking',
  defendHit: 'Rig_Medium_CombatMelee:Melee_Block_Hit',
  hit: 'Rig_Medium_General:Hit_A',
  criticalHit: 'Rig_Medium_General:Hit_B',
  item: 'Rig_Medium_CombatRanged:Ranged_Magic_Raise',
  heal: 'Rig_Medium_General:Use_Item',
  skill: 'Rig_Medium_CombatRanged:Ranged_Magic_Raise',
  evadeLeft: 'Rig_Medium_MovementAdvanced:Dodge_Left',
  evadeRight: 'Rig_Medium_MovementAdvanced:Dodge_Right',
  death: 'Rig_Medium_General:Death_A',
} as const;

const createSkeletonAssets = (modelFile: 'Skeleton_Minion.fbx' | 'Skeleton_Rogue.fbx' | 'Skeleton_Warrior.fbx' | 'Skeleton_Mage.fbx', scale: number) => ({
  modelPath: `game/assets/Characters/Monsters/Skeleton/${modelFile}`,
  modelUrl: new URL(`./game/assets/Characters/Monsters/Skeleton/${modelFile}`, import.meta.url).href,
  texturePath: 'game/assets/Characters/Monsters/Skeleton/skeleton_texture.png',
  textureUrl: new URL('./game/assets/Characters/Monsters/Skeleton/skeleton_texture.png', import.meta.url).href,
  animationDirectory: 'game/assets/Characters/Animations/Rig_Medium',
  animationFiles: [...skeletonAnimationFiles],
  animationUrls: [
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_CombatMelee.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_CombatRanged.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_General.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_MovementAdvanced.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_MovementBasic.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_Simulation.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_Special.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_Tools.fbx', import.meta.url).href,
  ],
  animationMap: skeletonAnimationMap,
  implementationStatus: 'fbx' as const,
  calibration: {
    scale,
    positionOffset: [0, 0, 0] as [number, number, number],
    rotationOffset: [0, Math.PI, 0] as [number, number, number],
  },
});

export const ENEMY_DATA: EnemyTemplate[] = [
  { name: 'Skeleton Minion', type: 'undead', color: '#d6d3d1', scale: 1.02, assets: createSkeletonAssets('Skeleton_Minion.fbx', 2.02), attackStyle: 'unarmed' },
  { name: 'Skeleton Rogue', type: 'undead', color: '#cbd5e1', scale: 1.04, assets: createSkeletonAssets('Skeleton_Rogue.fbx', 2.06), attackStyle: 'unarmed' },
  { name: 'Skeleton Warrior', type: 'undead', color: '#e2e8f0', scale: 1.08, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.14), attackStyle: 'unarmed' },
  { name: 'Skeleton Mage', type: 'undead', color: '#c4b5fd', scale: 1.06, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.1), attackStyle: 'unarmed' },
];

export const DUNGEON_ENEMY_DATA: DungeonEnemyTemplate[] = [
  { name: 'Bone Minion', type: 'undead', minEvolution: 0, scale: 1.02, assets: createSkeletonAssets('Skeleton_Minion.fbx', 2.02), attackStyle: 'unarmed', hpMultiplier: 0.96, atkMultiplier: 1.05, guaranteedDrops: ['mat_ether_shard'], rareDrops: [{ itemId: 'pot_dg_mana', chance: 0.08 }] },
  { name: 'Bone Rogue', type: 'undead', minEvolution: 0, scale: 1.04, assets: createSkeletonAssets('Skeleton_Rogue.fbx', 2.06), attackStyle: 'unarmed', hpMultiplier: 1.02, atkMultiplier: 1.14, speedBonus: 1, guaranteedDrops: ['mat_obsidian_heart'] },
  { name: 'Bone Warrior', type: 'undead', minEvolution: 1, scale: 1.08, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.14), attackStyle: 'unarmed', hpMultiplier: 1.14, defMultiplier: 1.16, guaranteedDrops: ['mat_ether_shard'] },
  { name: 'Bone Mage', type: 'undead', minEvolution: 1, scale: 1.06, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.1), attackStyle: 'unarmed', atkMultiplier: 1.22, speedBonus: 2, rareDrops: [{ itemId: 'mat_void_bloom', chance: 0.14 }] },
  { name: 'Crypt Warrior', type: 'undead', minEvolution: 2, scale: 1.14, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.2), attackStyle: 'unarmed', hpMultiplier: 1.2, atkMultiplier: 1.16, rareDrops: [{ itemId: 'pot_dg_elixir', chance: 0.12 }] },
  { name: 'Crypt Rogue', type: 'undead', minEvolution: 3, scale: 1.06, assets: createSkeletonAssets('Skeleton_Rogue.fbx', 2.08), attackStyle: 'unarmed', atkMultiplier: 1.24, speedBonus: 2, rareDrops: [{ itemId: 'wep_3d_sword_d', chance: 0.08 }] },
  { name: 'Crypt Mage', type: 'undead', minEvolution: 4, scale: 1.08, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.14), attackStyle: 'unarmed', hpMultiplier: 1.08, atkMultiplier: 1.28, speedBonus: 3, rareDrops: [{ itemId: 'shd_dg_eclipse', chance: 0.08 }] },
  { name: 'Bone Champion', type: 'undead', minEvolution: 5, scale: 1.18, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.26), attackStyle: 'unarmed', hpMultiplier: 1.26, defMultiplier: 1.2, guaranteedDrops: ['mat_void_bloom'], rareDrops: [{ itemId: 'arm_dg_abyss', chance: 0.1 }] },
  { name: 'Catacomb Archmage', type: 'undead', minEvolution: 6, scale: 1.12, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.18), attackStyle: 'unarmed', hpMultiplier: 1.18, atkMultiplier: 1.32, speedBonus: 4, rareDrops: [{ itemId: 'pot_dg_ambrosia', chance: 0.14 }] },
];

export const DUNGEON_BOSS: DungeonBossTemplate = {
  name: 'Skeleton Overlord',
  type: 'undead' as const,
  color: '#67e8f9',
  scale: 1.26,
  assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.42),
  attackStyle: 'unarmed',
  hpMultiplier: 1.4,
  atkMultiplier: 1.24,
  defMultiplier: 1.2,
  speedBonus: 4,
  guaranteedDrops: ['mat_nexus_core'],
  rareDrops: [
    { itemId: 'pot_dg_recall', chance: 0.22 },
    { itemId: 'pot_dg_ambrosia', chance: 0.4 },
    { itemId: 'wep_3d_sword_e', chance: 0.24 },
    { itemId: 'arm_dg_abyss', chance: 0.24 },
    { itemId: 'shd_dg_eclipse', chance: 0.24 },
    { itemId: 'hlm_dg_oracle', chance: 0.24 },
  ],
};

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
