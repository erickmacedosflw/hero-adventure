import {
  ClassResourceState,
  Player,
  PlayerClassId,
  Skill,
  Stats,
  TalentCombatBonuses,
  TalentNode,
} from '../../types';
import { getConstellationByClassId } from '../data/classTalents';

const emptyBonuses = (): TalentCombatBonuses => ({
  critChance: 0,
  critDamage: 0,
  healPower: 0,
  physicalDamage: 0,
  magicDamage: 0,
  damageReduction: 0,
  defendMitigation: 0,
  statusPotency: 0,
  burnDamage: 0,
  bleedDamage: 0,
  markedDamage: 0,
  manaOnHit: 0,
  manaOnDefend: 0,
  lifeSteal: 0,
  counterOnDefendChance: 0,
  resourceOnAttack: 0,
  resourceOnSkill: 0,
  resourceCap: 0,
  resourceStart: 0,
});

export const createClassResourceState = (classId: PlayerClassId): ClassResourceState => {
  const resource = getConstellationByClassId(classId).resource;
  return {
    ...resource,
    max: 0,
    value: 0,
  };
};

export const hasUnlockedClassResource = (player: Pick<Player, 'skills'>): boolean => (
  player.skills.some((skill) => Boolean(skill.resourceEffect))
);

export const getUnlockedResourceMax = (player: Player): number => {
  if (!hasUnlockedClassResource(player)) {
    return 0;
  }

  const bonuses = getTalentBonuses(player);
  const baseMax = getConstellationByClassId(player.classId).resource.max;
  return Math.max(0, baseMax + bonuses.resourceCap);
};

export const getConstellationNodes = (classId: PlayerClassId): TalentNode[] => (
  getConstellationByClassId(classId).trails.flatMap((trail) => trail.nodes)
);

export const getTalentNodeById = (classId: PlayerClassId, nodeId: string): TalentNode | null => (
  getConstellationNodes(classId).find((node) => node.id === nodeId) ?? null
);

export const getUnlockedTalentNodes = (player: Player): TalentNode[] => (
  getConstellationNodes(player.classId).filter((node) => player.unlockedTalentNodeIds.includes(node.id))
);

export const getTalentBonuses = (player: Player): TalentCombatBonuses => {
  const bonuses = emptyBonuses();

  getUnlockedTalentNodes(player).forEach((node) => {
    node.effects.forEach((effect) => {
      if (!effect.bonuses) {
        return;
      }

      Object.entries(effect.bonuses).forEach(([key, value]) => {
        const typedKey = key as keyof TalentCombatBonuses;
        bonuses[typedKey] += value ?? 0;
      });
    });
  });

  return bonuses;
};

export const getUnlockedConstellationSkills = (player: Player, skillCatalog: Skill[]): Skill[] => {
  const unlockedSkillIds = new Set<string>();

  getUnlockedTalentNodes(player).forEach((node) => {
    node.effects.forEach((effect) => {
      if (effect.unlockSkillId) {
        unlockedSkillIds.add(effect.unlockSkillId);
      }
    });
  });

  return skillCatalog.filter((skill) => unlockedSkillIds.has(skill.id));
};

export const canUnlockTalentNode = (player: Player, nodeId: string) => {
  const node = getTalentNodeById(player.classId, nodeId);
  if (!node) {
    return { ok: false as const, reason: 'Nodo nao encontrado.' };
  }

  if (player.unlockedTalentNodeIds.includes(node.id)) {
    return { ok: false as const, reason: 'Nodo ja desbloqueado.' };
  }

  if (player.level < node.requiredLevel) {
    return { ok: false as const, reason: `Requer nivel ${node.requiredLevel}.` };
  }

  if (player.talentPoints < node.cost) {
    return { ok: false as const, reason: 'Sem pontos de constelacao.' };
  }

  const missingRequirement = node.prerequisites.find((prerequisiteId) => !player.unlockedTalentNodeIds.includes(prerequisiteId));
  if (missingRequirement) {
    return { ok: false as const, reason: 'Desbloqueie o nodo anterior desta trilha.' };
  }

  return { ok: true as const, node };
};

const applyNodeStats = (stats: Stats, node: TalentNode): Stats => {
  const nextStats = { ...stats };

  node.effects.forEach((effect) => {
    if (!effect.stats) {
      return;
    }

    Object.entries(effect.stats).forEach(([key, value]) => {
      const typedKey = key as keyof Stats;
      nextStats[typedKey] += value ?? 0;
    });
  });

  return nextStats;
};

const removeNodeStats = (stats: Stats, node: TalentNode): Stats => {
  const nextStats = { ...stats };

  node.effects.forEach((effect) => {
    if (!effect.stats) {
      return;
    }

    Object.entries(effect.stats).forEach(([key, value]) => {
      const typedKey = key as keyof Stats;
      nextStats[typedKey] -= value ?? 0;
    });
  });

  return nextStats;
};

export const syncPlayerConstellationSkills = (player: Player, skillCatalog: Skill[]): Player => {
  const constellationSkills = getUnlockedConstellationSkills(player, skillCatalog);
  const nonConstellationSkills = player.skills.filter((skill) => skill.source !== 'constellation');
  const nextSkills = [...nonConstellationSkills, ...constellationSkills];
  const hasResourceUnlocked = nextSkills.some((skill) => Boolean(skill.resourceEffect));
  const bonuses = getTalentBonuses(player);
  const resourceTemplate = getConstellationByClassId(player.classId).resource;
  const unlockedResourceMax = hasResourceUnlocked ? Math.max(0, resourceTemplate.max + bonuses.resourceCap) : 0;
  const startValue = hasResourceUnlocked ? Math.max(0, bonuses.resourceStart) : 0;

  return {
    ...player,
    skills: nextSkills,
    classResource: {
      ...resourceTemplate,
      max: unlockedResourceMax,
      value: Math.min(unlockedResourceMax, Math.max(player.classResource.value, startValue)),
    },
  };
};

export const unlockTalentNode = (player: Player, nodeId: string, skillCatalog: Skill[]): { player: Player; node: TalentNode } | null => {
  const unlockCheck = canUnlockTalentNode(player, nodeId);
  if (!unlockCheck.ok) {
    return null;
  }

  const { node } = unlockCheck;
  const nextStats = applyNodeStats(player.stats, node);

  const nextPlayer = syncPlayerConstellationSkills({
    ...player,
    talentPoints: player.talentPoints - node.cost,
    unlockedTalentNodeIds: [...player.unlockedTalentNodeIds, node.id],
    stats: {
      ...nextStats,
      hp: Math.min(nextStats.maxHp, nextStats.hp),
      mp: Math.min(nextStats.maxMp, nextStats.mp),
    },
    classResource: { ...player.classResource },
  }, skillCatalog);

  return { player: nextPlayer, node };
};

export const resetTalentNodes = (player: Player, skillCatalog: Skill[]): Player => {
  const unlockedNodes = getUnlockedTalentNodes(player);
  if (unlockedNodes.length === 0) {
    return player;
  }

  const refundedPoints = unlockedNodes.reduce((sum, node) => sum + node.cost, 0);
  const resetStats = unlockedNodes.reduce((currentStats, node) => removeNodeStats(currentStats, node), { ...player.stats });

  const nextPlayer = syncPlayerConstellationSkills({
    ...player,
    talentPoints: player.talentPoints + refundedPoints,
    unlockedTalentNodeIds: [],
    stats: {
      ...resetStats,
      hp: Math.min(resetStats.maxHp, resetStats.hp),
      mp: Math.min(resetStats.maxMp, resetStats.mp),
    },
    classResource: { ...player.classResource },
  }, skillCatalog);

  return {
    ...nextPlayer,
    stats: {
      ...nextPlayer.stats,
      hp: Math.min(nextPlayer.stats.maxHp, nextPlayer.stats.hp),
      mp: Math.min(nextPlayer.stats.maxMp, nextPlayer.stats.mp),
    },
  };
};

export const gainClassResource = (player: Player, amount: number): Player => {
  if (amount <= 0) {
    return player;
  }

  return {
    ...player,
    classResource: {
      ...player.classResource,
      value: Math.min(player.classResource.max, player.classResource.value + amount),
    },
  };
};

export const spendClassResource = (player: Player, amount: number): Player => {
  if (amount <= 0) {
    return player;
  }

  return {
    ...player,
    classResource: {
      ...player.classResource,
      value: Math.max(0, player.classResource.value - amount),
    },
  };
};
