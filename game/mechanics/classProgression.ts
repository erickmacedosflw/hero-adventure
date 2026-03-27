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
    value: 0,
  };
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

export const syncPlayerConstellationSkills = (player: Player, skillCatalog: Skill[]): Player => {
  const constellationSkills = getUnlockedConstellationSkills(player, skillCatalog);
  const nonConstellationSkills = player.skills.filter((skill) => skill.source !== 'constellation');

  return {
    ...player,
    skills: [...nonConstellationSkills, ...constellationSkills],
  };
};

export const unlockTalentNode = (player: Player, nodeId: string, skillCatalog: Skill[]): { player: Player; node: TalentNode } | null => {
  const unlockCheck = canUnlockTalentNode(player, nodeId);
  if (!unlockCheck.ok) {
    return null;
  }

  const { node } = unlockCheck;
  const nextStats = applyNodeStats(player.stats, node);
  const resourceBonuses = getTalentBonuses({
    ...player,
    unlockedTalentNodeIds: [...player.unlockedTalentNodeIds, node.id],
  });
  const resourceTemplate = getConstellationByClassId(player.classId).resource;
  const nextResourceMax = resourceTemplate.max + resourceBonuses.resourceCap;

  const nextPlayer = syncPlayerConstellationSkills({
    ...player,
    talentPoints: player.talentPoints - node.cost,
    unlockedTalentNodeIds: [...player.unlockedTalentNodeIds, node.id],
    stats: {
      ...nextStats,
      hp: Math.min(nextStats.maxHp, nextStats.hp),
      mp: Math.min(nextStats.maxMp, nextStats.mp),
    },
    classResource: {
      ...player.classResource,
      max: nextResourceMax,
      value: Math.min(nextResourceMax, player.classResource.value),
    },
  }, skillCatalog);

  return { player: nextPlayer, node };
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

