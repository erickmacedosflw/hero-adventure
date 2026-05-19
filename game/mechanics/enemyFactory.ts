import { Enemy, PlayerClassId } from '../../types';

type EnemyTemplate = { name: string; type: 'beast' | 'humanoid' | 'undead' };

const ENEMY_CLASS_BY_TYPE: Record<EnemyTemplate['type'], PlayerClassId> = {
  beast: 'barbarian',
  humanoid: 'knight',
  undead: 'mage',
};

export const createEnemy = (
  currentStage: number,
  isBoss: boolean,
  enemyData: EnemyTemplate[],
  enemyColors: string[],
): Enemy => {
  let levelMult = 1 + currentStage * 0.15;
  if (isBoss) {
    levelMult *= 2.0;
  }

  const enemyTemplate = enemyData[Math.floor(Math.random() * enemyData.length)];
  const color = enemyColors[Math.floor(Math.random() * enemyColors.length)];
  const name = isBoss ? `General ${enemyTemplate.name}` : enemyTemplate.name;
  const enemyClassId = ENEMY_CLASS_BY_TYPE[enemyTemplate.type];
  const tier = Math.max(0, Math.floor((currentStage - 1) / 2)) + (isBoss ? 1 : 0);

  return {
    id: `enemy_${Date.now()}`,
    name,
    level: currentStage,
    stats: {
      hp: Math.floor(60 * levelMult),
      maxHp: Math.floor(60 * levelMult),
      mp: 0,
      maxMp: 0,
      atk: Math.floor(8 * levelMult),
      def: Math.floor(2 * levelMult),
      speed: 10,
      luck: 0,
      magic: 0,
    },
    xpReward: Math.floor(40 * levelMult * (isBoss ? 3 : 1)),
    goldReward: Math.floor(25 * levelMult * (isBoss ? 3 : 1)),
    color: isBoss ? '#ef4444' : color,
    scale: (0.8 + Math.random() * 0.4) * (isBoss ? 2.0 : 1.0),
    type: enemyTemplate.type,
    enemyClassId,
    isBoss,
    isDefending: false,
    isDefendendo: false,
    tipoDefesaAtiva: null,
    impulso: 0,
    impulseGuardLevel: 0,
    statusEffects: [],
    attackStyle: enemyTemplate.type === 'humanoid' ? 'armed' : 'unarmed',
    manaRegenOnDefend: enemyClassId === 'mage' ? 5 : 3,
    potionCharges: isBoss ? 1 : 0,
    potionHealValue: currentStage >= 8 ? 100 : currentStage >= 3 ? 50 : 25,
    lastAction: 'none',
    aiTurnCounter: 0,
    stealAttemptsUsed: 0,
    maxStealAttempts: 3,
    lastStealTurn: -99,
    stolenGoldTotal: 0,
    maxGoldStealPerBattle: Math.max(1, Math.floor(Math.floor(25 * levelMult * (isBoss ? 3 : 1)) * 0.5)),
    stolenItems: [],
    aiProfile: {
      tier,
      lowHpThreshold: enemyClassId === 'mage' ? 0.58 : enemyClassId === 'knight' ? 0.52 : 0.48,
      criticalHpThreshold: 0.25,
      lowManaThreshold: enemyClassId === 'mage' ? 0.35 : 0.25,
      defendBaseChance: enemyClassId === 'knight' ? 0.16 : 0.08,
      reactToPlayerAction: true,
      critChanceBonus: Math.min(0.24, tier * 0.015),
      critDamageBonus: Math.min(0.5, tier * 0.03),
    },
    skillSet: [],
    combatBuffs: {
      atkMod: 0,
      defMod: 0,
      turns: 0,
    },
  };
};
