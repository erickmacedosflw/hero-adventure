import { Enemy } from '../../types';

type EnemyTemplate = { name: string; type: 'beast' | 'humanoid' | 'undead' };

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
    },
    xpReward: Math.floor(40 * levelMult * (isBoss ? 3 : 1)),
    goldReward: Math.floor(25 * levelMult * (isBoss ? 3 : 1)),
    color: isBoss ? '#ef4444' : color,
    scale: (0.8 + Math.random() * 0.4) * (isBoss ? 2.0 : 1.0),
    type: enemyTemplate.type,
    isBoss,
    isDefending: false,
  };
};
