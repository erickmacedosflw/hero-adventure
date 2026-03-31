import { Item } from '../../types';

export type RegisteredWeaponGrip = 'dagger' | 'sword' | 'axe' | 'hammer' | 'wand' | 'staff' | 'spear' | 'halberd' | 'bow' | 'fist';

export interface RegisteredWeaponGripPoint {
  ratio: number;
  axis?: 'x' | 'y' | 'z';
  cross?: Partial<Record<'x' | 'y' | 'z', number>>;
}

export interface RegisteredWeapon3DDefinition {
  item: Item;
  modelPath: string;
  modelUrl: string;
  texturePath: string;
  textureUrl: string;
  grip: RegisteredWeaponGrip;
  gripPoint?: RegisteredWeaponGripPoint;
  handTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
  previewTransform: {
    rotation: [number, number, number];
    scaleMultiplier: number;
    positionY: number;
  };
}

const sharedTexturePath = 'game/assets/Characters/Weapons/another/weapons_bits_texture.png';
const sharedTextureUrl = new URL('../assets/Characters/Weapons/another/weapons_bits_texture.png', import.meta.url).href;
const MIN_WEAPON_COST_BY_RARITY: Record<Item['rarity'], number> = {
  bronze: 240,
  silver: 1200,
  gold: 3600,
};

const createRegisteredWeapon = ({
  id,
  name,
  description,
  cost,
  value,
  rarity,
  minLevel,
  icon,
  modelFile,
  grip,
  gripPoint,
  handTransform,
  previewTransform,
}: {
  id: string;
  name: string;
  description: string;
  cost: number;
  value: number;
  rarity: Item['rarity'];
  minLevel: number;
  icon: string;
  modelFile: string;
  grip: RegisteredWeaponGrip;
  gripPoint?: RegisteredWeaponGripPoint;
  handTransform: RegisteredWeapon3DDefinition['handTransform'];
  previewTransform: RegisteredWeapon3DDefinition['previewTransform'];
}): RegisteredWeapon3DDefinition => ({
  item: {
    id,
    name,
    description,
    cost: Math.max(cost, MIN_WEAPON_COST_BY_RARITY[rarity]),
    type: 'weapon',
    value,
    icon,
    rarity,
    minLevel,
    source: 'shop',
  },
  modelPath: `game/assets/Characters/Weapons/another/${modelFile}`,
  modelUrl: new URL(`../assets/Characters/Weapons/another/${modelFile}`, import.meta.url).href,
  texturePath: sharedTexturePath,
  textureUrl: sharedTextureUrl,
  grip,
  gripPoint,
  handTransform,
  previewTransform,
});

// Per-category calibrated hand transforms
const daggerPos: [number, number, number] = [0.006, 0.119, -0.059];
const daggerRot: [number, number, number] = [0.288, -0.394, 0.243];
const swordPos: [number, number, number] = [-0.009, -0.051, -0.016];
const swordRot: [number, number, number] = [3.077, 0.077, -3.124];
const axePos: [number, number, number] = [0.004, 0.058, -0.025];
const axeRot: [number, number, number] = [0.032, -1.006, -0.147];
const hammerPos: [number, number, number] = [0.003, 0.033, -0.076];
const hammerRot: [number, number, number] = [-2.939, 0.872, 3.011];
const wandPos: [number, number, number] = [-0.025, 0.094, -0.028];
const wandRot: [number, number, number] = [-0.175, 1.136, 0.265];
const staffPos: [number, number, number] = [0.001, -0.062, -0.059];
const staffRot: [number, number, number] = [-2.780, 1.233, 2.882];
const spearPos: [number, number, number] = [0.031, -0.213, -0.021];
const spearRot: [number, number, number] = [0.124, 0.182, 0.097];
const halberdPos: [number, number, number] = [0.031, -0.213, -0.021];
const halberdRot: [number, number, number] = [0.124, 0.182, 0.097];
const bowPos: [number, number, number] = [0.121, -0.210, -0.127];
const bowRot: [number, number, number] = [-1.188, -0.416, -0.306];
const fistAPos: [number, number, number] = [0.075, 0.153, 0.116];
const fistARot: [number, number, number] = [3.141, -1.193, 1.179];
const fistBPos: [number, number, number] = [-0.057, 0.476, 0.227];
const fistBRot: [number, number, number] = [-3.045, -1.153, 1.263];

export const REGISTERED_WEAPON_3D_CATALOG: RegisteredWeapon3DDefinition[] = [
  createRegisteredWeapon({
    id: 'wep_3d_dagger_a',
    name: 'Punhal de Treino A',
    description: 'Versao simples e rapida para iniciantes. +9 ATK',
    cost: 200,
    value: 9,
    rarity: 'bronze',
    minLevel: 1,
    icon: '🗡️',
    modelFile: 'dagger_A.fbx',
    grip: 'dagger',
    handTransform: { position: daggerPos, rotation: daggerRot, scale: 0.600 },
    previewTransform: { rotation: [0.12, 0.42, -1.0], scaleMultiplier: 1.04, positionY: 0.05 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_dagger_b',
    name: 'Punhal de Assalto B',
    description: 'Lamina curta refinada para golpes mais letais. +15 ATK',
    cost: 980,
    value: 15,
    rarity: 'silver',
    minLevel: 3,
    icon: '🗡️',
    modelFile: 'dagger_B.fbx',
    grip: 'dagger',
    handTransform: { position: daggerPos, rotation: daggerRot, scale: 0.600 },
    previewTransform: { rotation: [0.12, 0.42, -1.0], scaleMultiplier: 1.08, positionY: 0.05 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_sword_a',
    name: 'Espada Recruta A',
    description: 'Espada reta de entrada para combates simples. +14 ATK',
    cost: 320,
    value: 14,
    rarity: 'bronze',
    minLevel: 2,
    icon: '⚔️',
    modelFile: 'sword_A.fbx',
    grip: 'sword',
    handTransform: { position: swordPos, rotation: swordRot, scale: 1.079 },
    previewTransform: { rotation: [0.14, 0.36, -0.9], scaleMultiplier: 1.08, positionY: 0.06 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_sword_b',
    name: 'Espada Guarda B',
    description: 'Aco melhor balanceado e mais seguro no impacto. +20 ATK',
    cost: 1380,
    value: 20,
    rarity: 'silver',
    minLevel: 4,
    icon: '⚔️',
    modelFile: 'sword_B.fbx',
    grip: 'sword',
    handTransform: { position: swordPos, rotation: swordRot, scale: 1.079 },
    previewTransform: { rotation: [0.14, 0.34, -0.88], scaleMultiplier: 1.1, positionY: 0.06 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_sword_c',
    name: 'Espada Nobre C',
    description: 'Lamina mais longa com corte de elite. +28 ATK',
    cost: 2880,
    value: 28,
    rarity: 'gold',
    minLevel: 6,
    icon: '⚔️',
    modelFile: 'sword_C.fbx',
    grip: 'sword',
    handTransform: { position: swordPos, rotation: swordRot, scale: 1.079 },
    previewTransform: { rotation: [0.14, 0.32, -0.84], scaleMultiplier: 1.14, positionY: 0.08 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_sword_d',
    name: 'Espada Regia D',
    description: 'Forja superior com alcance e impacto ampliados. +38 ATK',
    cost: 4360,
    value: 38,
    rarity: 'gold',
    minLevel: 8,
    icon: '⚔️',
    modelFile: 'sword_D.fbx',
    grip: 'sword',
    handTransform: { position: swordPos, rotation: swordRot, scale: 1.079 },
    previewTransform: { rotation: [0.14, 0.3, -0.82], scaleMultiplier: 1.18, positionY: 0.1 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_sword_e',
    name: 'Espada Suprema E',
    description: 'Versao mais poderosa da linha de espadas. +52 ATK',
    cost: 6200,
    value: 52,
    rarity: 'gold',
    minLevel: 10,
    icon: '✨',
    modelFile: 'sword_E.fbx',
    grip: 'sword',
    handTransform: { position: swordPos, rotation: swordRot, scale: 1.079 },
    previewTransform: { rotation: [0.14, 0.28, -0.8], scaleMultiplier: 1.22, positionY: 0.12 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_axe_a',
    name: 'Machado Lenhador A',
    description: 'A mais simples da linha, mas ainda brutal. +16 ATK',
    cost: 420,
    value: 16,
    rarity: 'bronze',
    minLevel: 2,
    icon: '🪓',
    modelFile: 'axe_A.fbx',
    grip: 'axe',
    handTransform: { position: axePos, rotation: axeRot, scale: 0.753 },
    previewTransform: { rotation: [0.12, 0.3, -0.82], scaleMultiplier: 1.08, positionY: 0.08 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_axe_b',
    name: 'Machado Executor B',
    description: 'Cabeca de corte mais larga e mais pesada. +24 ATK',
    cost: 1820,
    value: 24,
    rarity: 'silver',
    minLevel: 5,
    icon: '🪓',
    modelFile: 'axe_B.fbx',
    grip: 'axe',
    handTransform: { position: axePos, rotation: axeRot, scale: 0.753 },
    previewTransform: { rotation: [0.14, 0.28, -0.78], scaleMultiplier: 1.12, positionY: 0.09 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_axe_c',
    name: 'Machado Tirano C',
    description: 'Versao superior para romper linhas pesadas. +34 ATK',
    cost: 3920,
    value: 34,
    rarity: 'gold',
    minLevel: 7,
    icon: '🪓',
    modelFile: 'axe_C.fbx',
    grip: 'axe',
    handTransform: { position: [-0.132, 0.093, -0.166], rotation: [0.268, -0.882, 0.172], scale: 0.723 },
    previewTransform: { rotation: [0.14, 0.26, -0.74], scaleMultiplier: 1.14, positionY: 0.1 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_hammer_a',
    name: 'Martelo Ferreiro A',
    description: 'Modelo simples, pesado e resistente. +18 ATK',
    cost: 700,
    value: 18,
    rarity: 'bronze',
    minLevel: 3,
    icon: '🔨',
    modelFile: 'hammer_A.fbx',
    grip: 'hammer',
    handTransform: { position: hammerPos, rotation: hammerRot, scale: 0.684 },
    previewTransform: { rotation: [0.18, 0.28, -0.76], scaleMultiplier: 1.04, positionY: 0.08 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_hammer_b',
    name: 'Martelo Sentinela B',
    description: 'Mais massa de impacto para quebrar defesas. +28 ATK',
    cost: 2280,
    value: 28,
    rarity: 'silver',
    minLevel: 5,
    icon: '🔨',
    modelFile: 'hammer_B.fbx',
    grip: 'hammer',
    handTransform: { position: hammerPos, rotation: hammerRot, scale: 0.684 },
    previewTransform: { rotation: [0.18, 0.26, -0.74], scaleMultiplier: 1.08, positionY: 0.08 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_hammer_c',
    name: 'Martelo Colosso C',
    description: 'A melhor variante da linha de martelos. +42 ATK',
    cost: 4820,
    value: 42,
    rarity: 'gold',
    minLevel: 8,
    icon: '🔨',
    modelFile: 'hammer_C.fbx',
    grip: 'hammer',
    handTransform: { position: hammerPos, rotation: hammerRot, scale: 0.684 },
    previewTransform: { rotation: [0.18, 0.24, -0.7], scaleMultiplier: 1.12, positionY: 0.1 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_wand_a',
    name: 'Varinha Arcana A',
    description: 'Foco simples para usuarios de magia. +17 ATK',
    cost: 460,
    value: 17,
    rarity: 'bronze',
    minLevel: 2,
    icon: '🪄',
    modelFile: 'wand_A.fbx',
    grip: 'wand',
    handTransform: { position: wandPos, rotation: wandRot, scale: 0.918 },
    previewTransform: { rotation: [0.06, 0.5, -0.54], scaleMultiplier: 1.02, positionY: 0.02 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_staff_a',
    name: 'Cajado Iniciado A',
    description: 'Cajado simples para canalizacao basica. +19 ATK',
    cost: 860,
    value: 19,
    rarity: 'bronze',
    minLevel: 3,
    icon: '🪄',
    modelFile: 'staff_A.fbx',
    grip: 'staff',
    handTransform: { position: staffPos, rotation: staffRot, scale: 1.203 },
    previewTransform: { rotation: [0.1, 0.26, -0.68], scaleMultiplier: 0.94, positionY: 0.12 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_staff_b',
    name: 'Cajado Oraculo B',
    description: 'Canalizador melhorado para magia pesada. +31 ATK',
    cost: 3260,
    value: 31,
    rarity: 'gold',
    minLevel: 7,
    icon: '🪄',
    modelFile: 'staff_B.fbx',
    grip: 'staff',
    handTransform: { position: staffPos, rotation: staffRot, scale: 1.203 },
    previewTransform: { rotation: [0.1, 0.24, -0.64], scaleMultiplier: 1.0, positionY: 0.12 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_spear_a',
    name: 'Lanca de Juramento A',
    description: 'Perfura e controla a media distancia. +27 ATK',
    cost: 2520,
    value: 27,
    rarity: 'silver',
    minLevel: 6,
    icon: '🔱',
    modelFile: 'spear_A.fbx',
    grip: 'spear',
    handTransform: { position: spearPos, rotation: spearRot, scale: 1.454 },
    previewTransform: { rotation: [0.1, 0.26, -0.68], scaleMultiplier: 0.94, positionY: 0.12 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_halberd_d',
    name: 'Alabarda de Guerra D',
    description: 'Arma de haste superior com corte e perfuracao. +44 ATK',
    cost: 5400,
    value: 44,
    rarity: 'gold',
    minLevel: 9,
    icon: '🔱',
    modelFile: 'halberd.fbx',
    grip: 'halberd',
    handTransform: { position: halberdPos, rotation: halberdRot, scale: 1.454 },
    previewTransform: { rotation: [0.12, 0.2, -0.58], scaleMultiplier: 0.92, positionY: 0.16 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_bow_a',
    name: 'Arco Curto A',
    description: 'Arco simples para ataques precisos a distancia. +15 ATK',
    cost: 520,
    value: 15,
    rarity: 'bronze',
    minLevel: 2,
    icon: '🏹',
    modelFile: 'bow_A_withString.fbx',
    grip: 'bow',
    handTransform: { position: bowPos, rotation: bowRot, scale: 1.803 },
    previewTransform: { rotation: [0.1, 0.4, -0.36], scaleMultiplier: 0.92, positionY: 0.08 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_bow_b',
    name: 'Arco de Guerra B',
    description: 'Arco mais forte e com melhor tensao. +25 ATK',
    cost: 2050,
    value: 25,
    rarity: 'silver',
    minLevel: 5,
    icon: '🏹',
    modelFile: 'bow_B_withString.fbx',
    grip: 'bow',
    handTransform: { position: bowPos, rotation: bowRot, scale: 1.803 },
    previewTransform: { rotation: [0.1, 0.38, -0.32], scaleMultiplier: 0.96, positionY: 0.1 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_fist_a',
    name: 'Garra de Impacto A',
    description: 'Arma de punho simples para combate rapido. +13 ATK',
    cost: 560,
    value: 13,
    rarity: 'bronze',
    minLevel: 2,
    icon: '🥊',
    modelFile: 'fistweapon_A.fbx',
    grip: 'fist',
    handTransform: { position: fistAPos, rotation: fistARot, scale: 0.376 },
    previewTransform: { rotation: [0.2, 0.52, -0.3], scaleMultiplier: 1.08, positionY: 0.02 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_fist_a_stacked',
    name: 'Garra Reforcada A+',
    description: 'Versao simples com massa adicional para o punho. +17 ATK',
    cost: 1120,
    value: 17,
    rarity: 'silver',
    minLevel: 3,
    icon: '🥊',
    modelFile: 'fistweapon_A_stacked.fbx',
    grip: 'fist',
    handTransform: { position: fistAPos, rotation: fistARot, scale: 0.376 },
    previewTransform: { rotation: [0.2, 0.5, -0.28], scaleMultiplier: 1.12, positionY: 0.02 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_fist_b',
    name: 'Punho Rachador B',
    description: 'Arma de punho melhorada para pressao continua. +23 ATK',
    cost: 1580,
    value: 23,
    rarity: 'silver',
    minLevel: 5,
    icon: '🥊',
    modelFile: 'fistweapon_B.fbx',
    grip: 'fist',
    handTransform: { position: fistBPos, rotation: fistBRot, scale: 0.536 },
    previewTransform: { rotation: [0.18, 0.48, -0.24], scaleMultiplier: 1.14, positionY: 0.02 },
  }),
  createRegisteredWeapon({
    id: 'wep_3d_fist_b_stacked',
    name: 'Punho Colapso C',
    description: 'Versao empilhada para impacto brutal. +30 ATK',
    cost: 3580,
    value: 30,
    rarity: 'gold',
    minLevel: 7,
    icon: '🥊',
    modelFile: 'fistweapon_B_stacked.fbx',
    grip: 'fist',
    handTransform: { position: fistBPos, rotation: fistBRot, scale: 0.536 },
    previewTransform: { rotation: [0.18, 0.46, -0.22], scaleMultiplier: 1.18, positionY: 0.02 },
  }),
];

export const REGISTERED_WEAPON_ITEMS: Item[] = REGISTERED_WEAPON_3D_CATALOG.map((entry) => entry.item);
export const REGISTERED_WEAPON_ITEM_IDS = new Set(REGISTERED_WEAPON_ITEMS.map((item) => item.id));

export const getRegisteredWeapon3DByItemId = (itemId?: string | null): RegisteredWeapon3DDefinition | undefined => (
  itemId ? REGISTERED_WEAPON_3D_CATALOG.find((entry) => entry.item.id === itemId) : undefined
);

/**
 * Maps each weapon grip type to the PlayerAnimationAction that best represents
 * its combat style. Used to pick idle/attack clips when a weapon is equipped.
 * wand/staff use 'skill' (magic-raise anim); bow uses 'attack' (ranged); all
 * melee grips use 'attack' (1H weapon chop by default).
 */
export const GRIP_TO_ANIMATION_ACTION: Record<RegisteredWeaponGrip, 'attack' | 'skill'> = {
  dagger:  'attack',
  sword:   'attack',
  axe:     'attack',
  hammer:  'attack',
  spear:   'attack',
  halberd: 'attack',
  bow:     'attack',
  fist:    'attack',
  wand:    'skill',
  staff:   'skill',
};

/** Return the grip of an equipped weapon, or undefined if the item ID has no 3D entry. */
export const getEquippedWeaponGrip = (itemId?: string | null): RegisteredWeaponGrip | undefined =>
  getRegisteredWeapon3DByItemId(itemId)?.grip;
