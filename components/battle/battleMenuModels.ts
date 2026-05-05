import { getClassSlots } from '../../constants';
import type { Item, Player, PlayerClassId } from '../../types';

export type BattleBadge = {
  label: string;
  color: string;
  bg: string;
  border: string;
};

export type BattleBadgeVariant = 'compact' | 'detailed';

export const getBattleMenuSlotCounts = (classId: PlayerClassId) => {
  const { skills, items } = getClassSlots(classId);
  return {
    skillSlots: skills,
    itemSlots: items,
  };
};

export const getPaddedBattleSkillIds = (player: Pick<Player, 'classId' | 'equippedSkillIds'>) => {
  const { skillSlots } = getBattleMenuSlotCounts(player.classId);
  const skillIds = [...(player.equippedSkillIds ?? [])];
  while (skillIds.length < skillSlots) {
    skillIds.push('');
  }
  return skillIds;
};

export const getBattleItemBadges = (item: Item, variant: BattleBadgeVariant = 'compact'): BattleBadge[] => {
  const lower = (item.description ?? '').toLowerCase();
  if (['pot_2', 'pot_mana_2', 'pot_mana_3', 'pot_dg_mana'].includes(item.id)) {
    return [{ label: `+${item.value} MP`, color: '#7dd3fc', bg: 'rgba(7,89,133,0.30)', border: 'rgba(125,211,252,0.30)' }];
  }
  if (item.id === 'pot_atk') {
    return [
      {
        label: variant === 'detailed' ? `+${Math.round((item.value as number) * 100)}% ATK` : 'ATK↑',
        color: '#f87171',
        bg: 'rgba(127,29,29,0.30)',
        border: 'rgba(248,113,113,0.30)',
      },
      { label: `${item.duration ?? 3}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.30)', border: 'rgba(252,211,77,0.28)' },
    ];
  }
  if (item.id === 'pot_def') {
    return [
      {
        label: variant === 'detailed' ? `+${Math.round((item.value as number) * 100)}% DEF` : 'DEF↑',
        color: '#fb923c',
        bg: 'rgba(154,52,18,0.30)',
        border: 'rgba(251,146,60,0.30)',
      },
      { label: `${item.duration ?? 3}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.30)', border: 'rgba(252,211,77,0.28)' },
    ];
  }
  if (lower.includes('hp') || lower.includes('vida') || lower.includes('cura') || lower.includes('restaura')) {
    return [{ label: `+${item.value} HP`, color: '#86efac', bg: 'rgba(20,83,45,0.30)', border: 'rgba(134,239,172,0.28)' }];
  }
  if (lower.includes('mp') || lower.includes('mana') || lower.includes('energia')) {
    return [{ label: `+${item.value} MP`, color: '#7dd3fc', bg: 'rgba(7,89,133,0.30)', border: 'rgba(125,211,252,0.28)' }];
  }
  if ((item.duration ?? 0) > 0) {
    return [
      { label: 'BOOST', color: '#fcd34d', bg: 'rgba(120,53,15,0.30)', border: 'rgba(252,211,77,0.28)' },
      { label: `${item.duration}t`, color: '#fcd34d', bg: 'rgba(120,53,15,0.20)', border: 'rgba(252,211,77,0.18)' },
    ];
  }
  return [{ label: 'ESPECIAL', color: '#c4b5fd', bg: 'rgba(76,29,149,0.30)', border: 'rgba(196,181,253,0.28)' }];
};