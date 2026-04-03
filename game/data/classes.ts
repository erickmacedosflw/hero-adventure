import { Player, PlayerClassAnimationMap, PlayerClassDefinition, PlayerClassId, Stats } from '../../types';

const statKeys: Array<keyof Pick<Stats, 'atk' | 'def' | 'speed' | 'luck'>> = ['atk', 'def', 'speed', 'luck'];
const animationDirectory = 'game/assets/Characters/Animations/Rig_Medium';
const animationFiles = [
  'Rig_Medium_CombatMelee.fbx',
  'Rig_Medium_CombatRanged.fbx',
  'Rig_Medium_General.fbx',
  'Rig_Medium_MovementAdvanced.fbx',
  'Rig_Medium_MovementBasic.fbx',
  'Rig_Medium_Simulation.fbx',
  'Rig_Medium_Special.fbx',
  'Rig_Medium_Tools.fbx',
] as const;

const createRigMediumAnimationMap = (): PlayerClassAnimationMap => ({
  idle: 'Rig_Medium_General:Idle_A',
  battleIdle: 'Rig_Medium_CombatMelee:Melee_Unarmed_Idle',
  attackWeapon: 'Rig_Medium_CombatMelee:Melee_1H_Attack_Jump_Chop',
  attackUnarmed: 'Rig_Medium_CombatMelee:Melee_Unarmed_Attack_Punch_A',
  defend: 'Rig_Medium_CombatMelee:Melee_Blocking',
  defendHit: 'Rig_Medium_CombatMelee:Melee_Block_Hit',
  hit: 'Rig_Medium_General:Hit_A',
  criticalHit: 'Rig_Medium_General:Hit_B',
  item: 'Rig_Medium_General:Use_Item',
  heal: 'Rig_Medium_CombatRanged:Ranged_Magic_Raise',
  skill: 'Rig_Medium_CombatRanged:Ranged_Magic_Raise',
  evadeLeft: 'Rig_Medium_MovementAdvanced:Dodge_Left',
  evadeRight: 'Rig_Medium_MovementAdvanced:Dodge_Right',
  death: 'Rig_Medium_General:Death_A',
});

const createAnimationUrls = () => [
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_CombatMelee.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_CombatRanged.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_General.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_MovementAdvanced.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_MovementBasic.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_Simulation.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_Special.fbx', import.meta.url).href,
  new URL('../assets/Characters/Animations/Rig_Medium/Rig_Medium_Tools.fbx', import.meta.url).href,
];

const createPlayerClass = ({
  id,
  name,
  title,
  description,
  modelPath,
  modelUrl,
  texturePath,
  textureUrl,
  baseStats,
  visualProfile,
  calibrationScale,
}: {
  id: PlayerClassId;
  name: string;
  title: string;
  description: string;
  modelPath: string;
  modelUrl: string;
  texturePath: string;
  textureUrl: string;
  baseStats: Stats;
  visualProfile: PlayerClassDefinition['visualProfile'];
  calibrationScale: number;
}): PlayerClassDefinition => ({
  id,
  name,
  title,
  description,
  baseStats,
  visualProfile,
  assets: {
    modelPath,
    modelUrl,
    texturePath,
    textureUrl,
    animationDirectory,
    animationFiles: [...animationFiles],
    animationUrls: createAnimationUrls(),
    animationMap: createRigMediumAnimationMap(),
    implementationStatus: 'fbx',
    calibration: {
      scale: calibrationScale,
      positionOffset: [0, 0, 0],
      rotationOffset: [0, 0, 0],
    },
  },
});

export const PLAYER_CLASSES: PlayerClassDefinition[] = [
  createPlayerClass({
    id: 'knight',
    name: 'Knight',
    title: 'Vanguarda de Aco',
    description: 'Classe pesada focada em presenca de campo, defesa solida e combate corpo a corpo.',
    modelPath: 'game/assets/Characters/Knight/Knight.fbx',
    modelUrl: new URL('../assets/Characters/Knight/Knight.fbx', import.meta.url).href,
    texturePath: 'game/assets/Characters/Knight/knight_texture.png',
    textureUrl: new URL('../assets/Characters/Knight/knight_texture.png', import.meta.url).href,
    baseStats: {
      hp: 140,
      maxHp: 140,
      mp: 40,
      maxMp: 40,
      atk: 14,
      def: 8,
      speed: 8,
      luck: 4,
    },
    visualProfile: {
      silhouette: 'knight',
      primaryColor: '#94a3b8',
      secondaryColor: '#1d4ed8',
      detailColor: '#f8fafc',
      auraColor: '#60a5fa',
    },
    calibrationScale: 2.15,
  }),
  createPlayerClass({
    id: 'barbarian',
    name: 'Barbarian',
    title: 'Colosso Tribal',
    description: 'Aguenta pancada, converte furia em dano bruto e domina trocas curtas com alta pressao.',
    modelPath: 'game/assets/Characters/Barbarian/Barbarian.fbx',
    modelUrl: new URL('../assets/Characters/Barbarian/Barbarian.fbx', import.meta.url).href,
    texturePath: 'game/assets/Characters/Barbarian/barbarian_texture.png',
    textureUrl: new URL('../assets/Characters/Barbarian/barbarian_texture.png', import.meta.url).href,
    baseStats: {
      hp: 164,
      maxHp: 164,
      mp: 26,
      maxMp: 26,
      atk: 18,
      def: 7,
      speed: 9,
      luck: 5,
    },
    visualProfile: {
      silhouette: 'barbarian',
      primaryColor: '#92400e',
      secondaryColor: '#dc2626',
      detailColor: '#fde68a',
      auraColor: '#fb923c',
    },
    calibrationScale: 2.18,
  }),
  createPlayerClass({
    id: 'mage',
    name: 'Mage',
    title: 'Arcanista do Crepusculo',
    description: 'Especialista em mana e explosoes magicas, frágil na linha de frente mas muito eficiente em ofensiva sustentada.',
    modelPath: 'game/assets/Characters/Mage/Mage.fbx',
    modelUrl: new URL('../assets/Characters/Mage/Mage.fbx', import.meta.url).href,
    texturePath: 'game/assets/Characters/Mage/mage_texture.png',
    textureUrl: new URL('../assets/Characters/Mage/mage_texture.png', import.meta.url).href,
    baseStats: {
      hp: 96,
      maxHp: 96,
      mp: 110,
      maxMp: 110,
      atk: 17,
      def: 4,
      speed: 10,
      luck: 8,
    },
    visualProfile: {
      silhouette: 'mage',
      primaryColor: '#7c3aed',
      secondaryColor: '#2563eb',
      detailColor: '#e0e7ff',
      auraColor: '#c084fc',
    },
    calibrationScale: 2.1,
  }),
  createPlayerClass({
    id: 'ranger',
    name: 'Ranger',
    title: 'Batedora da Fronteira',
    description: 'Classe agil e tecnica, equilibrada entre pressao ofensiva, mobilidade alta e boa economia de recursos.',
    modelPath: 'game/assets/Characters/Ranger/Ranger.fbx',
    modelUrl: new URL('../assets/Characters/Ranger/Ranger.fbx', import.meta.url).href,
    texturePath: 'game/assets/Characters/Ranger/ranger_texture.png',
    textureUrl: new URL('../assets/Characters/Ranger/ranger_texture.png', import.meta.url).href,
    baseStats: {
      hp: 118,
      maxHp: 118,
      mp: 58,
      maxMp: 58,
      atk: 15,
      def: 6,
      speed: 14,
      luck: 7,
    },
    visualProfile: {
      silhouette: 'ranger',
      primaryColor: '#0f766e',
      secondaryColor: '#84cc16',
      detailColor: '#ecfccb',
      auraColor: '#22c55e',
    },
    calibrationScale: 2.12,
  }),
  createPlayerClass({
    id: 'rogue',
    name: 'Rogue',
    title: 'Lamina das Sombras',
    description: 'Explora velocidade, precisão e sorte alta para vencer com pressão contínua e janelas curtas de burst.',
    modelPath: 'game/assets/Characters/Rogue/Rogue.fbx',
    modelUrl: new URL('../assets/Characters/Rogue/Rogue.fbx', import.meta.url).href,
    texturePath: 'game/assets/Characters/Rogue/rogue_texture.png',
    textureUrl: new URL('../assets/Characters/Rogue/rogue_texture.png', import.meta.url).href,
    baseStats: {
      hp: 108,
      maxHp: 108,
      mp: 52,
      maxMp: 52,
      atk: 16,
      def: 5,
      speed: 16,
      luck: 10,
    },
    visualProfile: {
      silhouette: 'rogue',
      primaryColor: '#334155',
      secondaryColor: '#db2777',
      detailColor: '#f8fafc',
      auraColor: '#f472b6',
    },
    calibrationScale: 2.12,
  }),
];

export const DEFAULT_PLAYER_CLASS_ID: PlayerClassId = 'knight';

export const getPlayerClassById = (classId: PlayerClassId): PlayerClassDefinition => (
  PLAYER_CLASSES.find(playerClass => playerClass.id === classId) ?? PLAYER_CLASSES[0]
);

export const createClassBaseStats = (classId: PlayerClassId): Stats => ({
  ...getPlayerClassById(classId).baseStats,
});

export const applyPlayerClass = (player: Player, targetClassId: PlayerClassId): Player => {
  const currentClass = getPlayerClassById(player.classId);
  const targetClass = getPlayerClassById(targetClassId);

  if (currentClass.id === targetClass.id) {
    return {
      ...player,
      classId: targetClass.id,
      stats: { ...player.stats },
    };
  }

  const nextStats: Stats = { ...player.stats };

  const hpMissing = Math.max(0, player.stats.maxHp - player.stats.hp);
  const hpBonus = player.stats.maxHp - currentClass.baseStats.maxHp;
  nextStats.maxHp = Math.max(1, targetClass.baseStats.maxHp + hpBonus);
  nextStats.hp = Math.max(1, Math.min(nextStats.maxHp, nextStats.maxHp - hpMissing));

  const mpMissing = Math.max(0, player.stats.maxMp - player.stats.mp);
  const mpBonus = player.stats.maxMp - currentClass.baseStats.maxMp;
  nextStats.maxMp = Math.max(0, targetClass.baseStats.maxMp + mpBonus);
  nextStats.mp = Math.max(0, Math.min(nextStats.maxMp, nextStats.maxMp - mpMissing));

  statKeys.forEach((key) => {
    const bonus = player.stats[key] - currentClass.baseStats[key];
    nextStats[key] = Math.max(1, targetClass.baseStats[key] + bonus);
  });

  return {
    ...player,
    classId: targetClass.id,
    stats: nextStats,
  };
};
