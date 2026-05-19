import { SKILLS } from '../../../constants';
import type { Skill } from '../../../types';

export const SKILL_REGISTRY: ReadonlyMap<string, Skill> = new Map(
  SKILLS.map((skill) => [skill.id, skill]),
);

export const getSkillById = (skillId: string | null | undefined): Skill | null => {
  if (!skillId) {
    return null;
  }

  return SKILL_REGISTRY.get(skillId) ?? null;
};

export const mergeCatalogSkill = (skill: Skill): Skill => {
  const catalogSkill = getSkillById(skill.id);
  return catalogSkill ? { ...skill, ...catalogSkill } : skill;
};

export const restoreCatalogSkillIcon = (skill: Skill): Skill => {
  const catalogSkill = getSkillById(skill.id);
  if (catalogSkill?.icon && !skill.icon) {
    return { ...skill, icon: catalogSkill.icon };
  }

  return skill;
};

export const findDuplicateSkillIds = (): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  SKILLS.forEach((skill) => {
    if (seen.has(skill.id)) {
      duplicates.add(skill.id);
      return;
    }

    seen.add(skill.id);
  });

  return Array.from(duplicates).sort();
};