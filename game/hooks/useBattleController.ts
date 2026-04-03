import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ALL_ITEMS, SKILLS } from '../../constants';
import { COMBAT_SPRITE_ANIMATION_DEFAULTS, getSpriteAnimationRegistryEntry, SPRITE_ANIMATION_IDS } from '../data/sprite-animations/registry';
import { estimateAnimationPlaybackDurationMs } from '../mechanics/spriteOverlayPlayback';
import {
  applyStatusEffect,
  calculateDamage,
  consumeTurnBuffs,
  createStatusEffect,
  tickStatusEffects,
} from '../mechanics/combat';
import { getTalentBonuses } from '../mechanics/classProgression';
import { battleSfx } from '../audio/sfx';
import {
  BattleLog,
  DungeonResult,
  DungeonRunState,
  Enemy,
  EnemyIntentPreview,
  EnemyIntentType,
  GameState,
  Player,
  PlayerAnimationAction,
  Skill,
  TurnState,
} from '../../types';

const GENERATED_ANIMATION_JSON_MODULES = import.meta.glob('../data/sprite-animations/generated/*.json', { eager: true }) as Record<string, { default?: unknown } | unknown>;

const getPathBasename = (input?: string | null) => {
  if (!input) return null;
  const normalized = input.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || null;
};

const BUILT_IN_ANIMATIONS_BY_FILE = Object.entries(GENERATED_ANIMATION_JSON_MODULES).reduce<Record<string, unknown>>((acc, [modulePath, moduleValue]) => {
  const fileName = getPathBasename(modulePath);
  if (!fileName) return acc;
  const resolved = (moduleValue as { default?: unknown })?.default ?? moduleValue;
  acc[fileName] = resolved;
  return acc;
}, {});

const getAnimationDurationMsById = (animationId?: string | null) => {
  if (!animationId) return 0;
  const registryEntry = getSpriteAnimationRegistryEntry(animationId);
  const fileName = getPathBasename(registryEntry?.arquivo);
  if (!fileName) return 0;
  const definition = BUILT_IN_ANIMATIONS_BY_FILE[fileName] as import('../../types').SpriteOverlayAnimationDefinition | undefined;
  const duration = estimateAnimationPlaybackDurationMs(definition);
  return Math.max(0, Math.round(duration));
};

interface SkillVisualConfig {
  color: string;
  particleCount: number;
  shake: number;
  castDelay: number;
}

interface UseBattleControllerParams {
  player: Player;
  enemy: Enemy | null;
  gameState: GameState;
  turnState: TurnState;
  dungeonRun: DungeonRunState | null;
  clonePlayer: (source: Player) => Player;
  getBossDamageMultiplier: () => number;
  getHealingValue: (baseValue: number) => number;
  getSkillVisualConfig: (skill: Skill) => SkillVisualConfig;
  addLog: (message: string, type?: BattleLog['type']) => void;
  withdrawFromDungeon: (reason: string, consumeItemId?: string) => boolean;
  handleVictory: (delayMs?: number) => Promise<void> | void;
  triggerEnemyAnimationAction: (action: PlayerAnimationAction, resetDelay?: number) => void;
  spawnParticles: (position: [number, number, number], count: number, color: string, type: 'explode' | 'heal' | 'spark') => void;
  spawnFloatingText: (
    value: string | number,
    target: 'player' | 'enemy',
    type: 'damage' | 'heal' | 'crit' | 'buff' | 'skill' | 'item',
    color?: string,
  ) => void;
  setPlayer: Dispatch<SetStateAction<Player>>;
  setEnemy: Dispatch<SetStateAction<Enemy | null>>;
  setTurnState: Dispatch<SetStateAction<TurnState>>;
  setKillCount: Dispatch<SetStateAction<number>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setDungeonRun: Dispatch<SetStateAction<DungeonRunState | null>>;
  setDungeonResult: Dispatch<SetStateAction<DungeonResult | null>>;
  setPlayerAnimationAction: Dispatch<SetStateAction<PlayerAnimationAction>>;
  setEnemyAnimationAction: Dispatch<SetStateAction<PlayerAnimationAction>>;
  setIsPlayerAttacking: Dispatch<SetStateAction<boolean>>;
  setIsEnemyAttacking: Dispatch<SetStateAction<boolean>>;
  setIsPlayerHit: Dispatch<SetStateAction<boolean>>;
  setIsPlayerCritHit: Dispatch<SetStateAction<boolean>>;
  setIsEnemyHit: Dispatch<SetStateAction<boolean>>;
  setScreenShake: Dispatch<SetStateAction<number>>;
  setEnemyIntentPreview: Dispatch<SetStateAction<EnemyIntentPreview | null>>;
  setPlayerExecutionAnimationId: Dispatch<SetStateAction<string | null>>;
  setEnemyExecutionAnimationId: Dispatch<SetStateAction<string | null>>;
  setPlayerExecutionAnimationTintColor: Dispatch<SetStateAction<string | null>>;
  setEnemyExecutionAnimationTintColor: Dispatch<SetStateAction<string | null>>;
  setPlayerImpactAnimationId: Dispatch<SetStateAction<string | null>>;
  setEnemyImpactAnimationId: Dispatch<SetStateAction<string | null>>;
  setPlayerImpactAnimationTintColor: Dispatch<SetStateAction<string | null>>;
  setEnemyImpactAnimationTintColor: Dispatch<SetStateAction<string | null>>;
  setPlayerImpactAnimationTarget: Dispatch<SetStateAction<'self' | 'target'>>;
  setEnemyImpactAnimationTarget: Dispatch<SetStateAction<'self' | 'target'>>;
  setPlayerImpactAnimationTrigger: Dispatch<SetStateAction<number>>;
  setEnemyImpactAnimationTrigger: Dispatch<SetStateAction<number>>;
  enemyIntentPreview?: EnemyIntentPreview | null;
  onPlayerDefeat?: () => void;
}

const getMarkedBonus = (statuses: Enemy['statusEffects'] | undefined, value: number) => (
  statuses?.some((status) => status.kind === 'marked') ? value : 0
);

const MANA_ONLY_POTION_IDS = new Set(['pot_2', 'pot_mana_2', 'pot_mana_3', 'pot_dg_mana']);
const MIXED_POTION_RECOVERY: Record<string, { hp: number; mp: number }> = {
  pot_mix_1: { hp: 35, mp: 20 },
  pot_mix_2: { hp: 80, mp: 50 },
};

const getEnemyAtkWithBuff = (target: Enemy) => (
  Math.floor(target.stats.atk * (1 + (target.combatBuffs?.atkMod ?? 0)))
);

const getEnemyDefWithBuff = (target: Enemy) => (
  Math.floor(target.stats.def * (1 + (target.combatBuffs?.defMod ?? 0)))
);

const tickEnemyBuffs = (target: Enemy): Enemy => {
  if (!target.combatBuffs || target.combatBuffs.turns <= 0) {
    return target;
  }

  const nextTurns = target.combatBuffs.turns - 1;
  if (nextTurns <= 0) {
    return {
      ...target,
      combatBuffs: {
        atkMod: 0,
        defMod: 0,
        turns: 0,
      },
    };
  }

  return {
    ...target,
    combatBuffs: {
      ...target.combatBuffs,
      turns: nextTurns,
    },
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampImpulse = (value: number) => clamp(value, 0, 3);
const IMPULSE_ATTACK_DAMAGE_BONUS = 0.5;
const IMPULSE_DEF_IGNORE_RATIO = 0.5;
const IMPULSE_MANA_DISCOUNT = 0.5;
const IMPULSE_SKILL_EFFECT_BONUS = 0.5;
const IMPULSE_DEFENSE_EXTRA_MITIGATION = 0.5;

const ENEMY_INTENT_ATTACK_OR_DEFEND_EXECUTION_CHANCE = 0.8;

const ENEMY_INTENT_PROBABILITY_BY_TYPE: Record<EnemyIntentType, number> = {
  attack: 80,
  defend: 80,
  impulse: 100,
  skill: 100,
  item: 100,
};

const ENEMY_CLASS_SKILL_BIAS: Record<Player['classId'], number> = {
  knight: 0.06,
  barbarian: 0.04,
  mage: 0.16,
  ranger: 0.08,
  rogue: 0.1,
};
const ENEMY_CLASS_BASIC_DAMAGE_MULT: Record<Player['classId'], number> = {
  knight: 1.12,
  barbarian: 1.2,
  mage: 1.04,
  ranger: 1.1,
  rogue: 1.16,
};
const ENEMY_CLASS_SKILL_DAMAGE_MULT: Record<Player['classId'], number> = {
  knight: 1.12,
  barbarian: 1.18,
  mage: 1.24,
  ranger: 1.14,
  rogue: 1.2,
};

const ENEMY_STEAL_BASE_CHANCE = 0.28;
const ENEMY_STEAL_SPEED_WEIGHT = 0.006;
const ENEMY_STEAL_LUCK_WEIGHT = 0.004;
const ENEMY_ACTION_READ_DELAY_MS = 1250;
const ENEMY_ACTION_READ_DELAY_LONG_MS = 1650;
const IMPACT_TO_DEATH_SFX_DELAY_MS = 120;
const RIPOSTE_DAMAGE_MULTIPLIER = 1.35;
const RIPOSTE_RESOURCE_BONUS = 1;
const DEFEND_COUNTER_BASE_CHANCE = 0.06;
const DEFEND_COUNTER_TALENT_CAP = 0.12;
const DEFEND_COUNTER_MAX_CHANCE_BY_CLASS: Record<Player['classId'], number> = {
  knight: 0.25,
  barbarian: 0.25,
  mage: 0.3,
  ranger: 0.4,
  rogue: 0.4,
};
const DEFEND_COUNTER_DEF_WEIGHT = 0.0025;
const DEFEND_COUNTER_SPEED_WEIGHT = 0.002;
const DEFEND_COUNTER_LUCK_WEIGHT = 0.0015;
const DEFEND_COUNTER_DAMAGE_RATIO = 0.45;

const getEnemyDamagePressure = (target: Enemy, kind: 'basic' | 'skill') => {
  const tierBonus = Math.min(0.2, (target.aiProfile?.tier ?? 0) * 0.02);
  const classMult = kind === 'skill'
    ? (ENEMY_CLASS_SKILL_DAMAGE_MULT[target.enemyClassId] ?? 1.1)
    : (ENEMY_CLASS_BASIC_DAMAGE_MULT[target.enemyClassId] ?? 1.1);
  return classMult * (1 + tierBonus);
};

const getSkillCastColor = (skill: Enemy['skillSet'][number]) => {
  if (skill.effect === 'heal') return '#34d399';
  if (skill.effect === 'buff_atk') return '#f97316';
  if (skill.effect === 'buff_def') return '#60a5fa';
  return skill.attackKind === 'magic' ? '#60a5fa' : '#f97316';
};

const getEnemyItemUseLabel = (healAmount: number) => {
  if (healAmount >= 220) return '🌟';
  if (healAmount >= 100) return '💖';
  if (healAmount >= 50) return '❤️';
  return '🧪';
};

const playAttackImpactSfx = ({
  attackKind,
  attackerStyle,
  defended,
  source,
}: {
  attackKind: 'physical' | 'magic';
  attackerStyle: 'weapon' | 'unarmed';
  defended: boolean;
  source: 'hero' | 'enemy';
}) => {
  battleSfx.play(attackerStyle === 'weapon' ? 'attack_weapon_swing' : 'attack_unarmed_swing', {
    attackKind,
    attackerStyle,
    defended,
    source,
  });

  if (defended) {
    battleSfx.play('defended_hit', { attackKind, attackerStyle, defended: true, source });
    return;
  }

  if (attackerStyle === 'weapon' && attackKind === 'physical') {
    battleSfx.play('attack_weapon_impact', { attackKind, attackerStyle, defended: false, source });
    return;
  }

  battleSfx.play('attack_unarmed_or_magic_impact', { attackKind, attackerStyle, defended: false, source });
};

const playEnemyDeathAfterImpactSfx = () => {
  window.setTimeout(() => {
    battleSfx.play('death');
  }, IMPACT_TO_DEATH_SFX_DELAY_MS);
};

const playMovementSfx = (attackerStyle: 'weapon' | 'unarmed') => {
  battleSfx.play(attackerStyle === 'weapon' ? 'movement_armed' : 'movement_unarmed', {
    attackerStyle,
  });
};

const getImpulseColorByLevel = (level: number) => (
  level >= 3 ? '#3b82f6' : level === 2 ? '#a855f7' : '#ef4444'
);

export const useBattleController = ({
  player,
  enemy,
  gameState,
  turnState,
  dungeonRun,
  clonePlayer,
  getBossDamageMultiplier,
  getHealingValue,
  getSkillVisualConfig,
  addLog,
  withdrawFromDungeon,
  handleVictory,
  triggerEnemyAnimationAction,
  spawnParticles,
  spawnFloatingText,
  setPlayer,
  setEnemy,
  setTurnState,
  setKillCount,
  setGameState,
  setDungeonRun,
  setDungeonResult,
  setPlayerAnimationAction,
  setEnemyAnimationAction,
  setIsPlayerAttacking,
  setIsEnemyAttacking,
  setIsPlayerHit,
  setIsPlayerCritHit,
  setIsEnemyHit,
  setScreenShake,
  setEnemyIntentPreview,
  setPlayerExecutionAnimationId,
  setEnemyExecutionAnimationId,
  setPlayerExecutionAnimationTintColor,
  setEnemyExecutionAnimationTintColor,
  setPlayerImpactAnimationId,
  setEnemyImpactAnimationId,
  setPlayerImpactAnimationTintColor,
  setEnemyImpactAnimationTintColor,
  setPlayerImpactAnimationTarget,
  setEnemyImpactAnimationTarget,
  setPlayerImpactAnimationTrigger,
  setEnemyImpactAnimationTrigger,
  enemyIntentPreview,
  onPlayerDefeat,
}: UseBattleControllerParams) => {
  const handleVictoryRef = useRef(handleVictory);
  const lastPlayerActionRef = useRef<'attack' | 'defend' | 'skill' | 'item' | null>(null);
  const pendingEnemyIntentRef = useRef<EnemyIntentType | null>(null);

  const announceCounterAttack = useCallback((attacker: 'player' | 'enemy') => {
    spawnFloatingText('⚔ CONTRA-ATAQUE!', attacker, 'damage');
  }, [spawnFloatingText]);

  useEffect(() => {
    handleVictoryRef.current = handleVictory;
  }, [handleVictory]);

  const consumeActiveImpulse = useCallback(() => {
    const active = clampImpulse(player.impulsoAtivo);
    if (active <= 0) {
      return 0;
    }

    setPlayer((prev) => ({ ...prev, impulsoAtivo: 0 }));
    return active;
  }, [player.impulsoAtivo, setPlayer]);

  const createEnemyIntentPreview = useCallback((type: EnemyIntentType): EnemyIntentPreview => ({
    type,
    probability: ENEMY_INTENT_PROBABILITY_BY_TYPE[type],
  }), []);

  const playImpulseVisual = useCallback((target: 'player' | 'enemy', level: number, label: string, overrideColor?: string | null) => {
    const color = overrideColor ?? getImpulseColorByLevel(level);
    const basePosition: [number, number, number] = target === 'player' ? [-2, -0.45, 0] : [2, -0.45, 0];
    const corePosition: [number, number, number] = target === 'player' ? [-2, 0.1, 0] : [2, 0.1, 0];
    spawnParticles(basePosition, 22 + (level * 6), color, 'spark');
    spawnParticles(corePosition, 18 + (level * 4), color, 'heal');
    spawnParticles(corePosition, 14 + (level * 4), '#ffffff', 'spark');
    spawnFloatingText(label, target, 'buff', color);
  }, [spawnFloatingText, spawnParticles]);

  const awardCombatBenefits = useCallback((damage: number, resourceGain: number, talentBonuses: ReturnType<typeof getTalentBonuses>) => {
    if (damage <= 0 && resourceGain <= 0 && talentBonuses.lifeSteal <= 0 && talentBonuses.manaOnHit <= 0) {
      return;
    }

    const lifeSteal = damage > 0 ? Math.max(0, Math.floor(damage * talentBonuses.lifeSteal)) : 0;
    const manaGain = damage > 0 ? Math.max(0, Math.floor(talentBonuses.manaOnHit)) : 0;

    setPlayer((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        hp: Math.min(prev.stats.maxHp, prev.stats.hp + lifeSteal),
        mp: Math.min(prev.stats.maxMp, prev.stats.mp + manaGain),
      },
      classResource: {
        ...prev.classResource,
        value: Math.min(prev.classResource.max, prev.classResource.value + resourceGain),
      },
    }));

    if (lifeSteal > 0) {
      setPlayerImpactAnimationId(SPRITE_ANIMATION_IDS.execAbsorb2);
      setPlayerImpactAnimationTintColor(null);
      setPlayerImpactAnimationTarget('self');
      setPlayerImpactAnimationTrigger((prev) => prev + 1);
      spawnFloatingText(`+${lifeSteal} HP`, 'player', 'heal');
      addLog(`Roubo de vida recuperou ${lifeSteal} HP.`, 'heal');
    }

    if (manaGain > 0) {
      spawnFloatingText(`+${manaGain} Mana`, 'player', 'heal');
      addLog(`Fluxo da constelacao restaurou ${manaGain} Mana.`, 'heal');
    }

    if (resourceGain > 0 && player.classResource.max > 0) {
      spawnFloatingText(`+${resourceGain} ${player.classResource.name}`, 'player', 'buff', player.classResource.color);
    }
  }, [
    addLog,
    player.classResource.max,
    player.classResource.name,
    setPlayer,
    setPlayerImpactAnimationId,
    setPlayerImpactAnimationTintColor,
    setPlayerImpactAnimationTarget,
    setPlayerImpactAnimationTrigger,
    spawnFloatingText,
  ]);

  const tryApplySkillStatus = useCallback((skill: Skill, talentBonuses: ReturnType<typeof getTalentBonuses>) => {
    if (!enemy || !skill.statusEffect) {
      return;
    }

    if (Math.random() > skill.statusEffect.chance) {
      return;
    }

    const potency = skill.statusEffect.potency + talentBonuses.statusPotency;
    const status = createStatusEffect(skill.statusEffect.kind, skill.statusEffect.duration, potency, 'skill');

    setEnemy((prev) => {
      if (!prev) {
        return null;
      }

      return {
        ...prev,
        statusEffects: applyStatusEffect(prev.statusEffects ?? [], status),
      };
    });

    spawnFloatingText(status.name.toUpperCase(), 'enemy', 'buff');
    addLog(`${skill.name} aplicou ${status.name.toLowerCase()}!`, 'buff');
  }, [addLog, enemy, setEnemy, spawnFloatingText]);

  const handleChargeImpulse = useCallback(() => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT || player.impulso >= 3) return;
    lastPlayerActionRef.current = 'item';
    setTurnState(TurnState.PLAYER_ANIMATION);
    battleSfx.play('defense_use', { source: 'hero' });
    const nextReserve = clampImpulse(player.impulso + 1);
    const impulseTintColor = player.classResource.color || '#22d3ee';
    const impulseAnimationDurationMs = getAnimationDurationMsById(SPRITE_ANIMATION_IDS.execImpulse);
    const impulseFinishDelayMs = impulseAnimationDurationMs > 0 ? (impulseAnimationDurationMs + 80) : 520;
    setPlayerAnimationAction('item');
    setPlayerImpactAnimationId(SPRITE_ANIMATION_IDS.execImpulse);
    setPlayerImpactAnimationTintColor(impulseTintColor);
    setPlayerImpactAnimationTarget('self');
    setPlayerImpactAnimationTrigger((prev) => prev + 1);
    setPlayer((prev) => ({
      ...prev,
      impulso: clampImpulse(prev.impulso + 1),
    }));
    playImpulseVisual('player', nextReserve, '+1 IMPULSO', impulseTintColor);
    addLog('Impulso carregado +1.', 'buff');

    window.setTimeout(() => {
      setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs) }));
      setPlayerImpactAnimationId(null);
      setPlayerImpactAnimationTintColor(null);
      setPlayerAnimationAction('idle');
      setTurnState(TurnState.ENEMY_TURN);
    }, impulseFinishDelayMs);
  }, [
    addLog,
    enemy,
    playImpulseVisual,
    player.classResource.color,
    player.impulso,
    setPlayer,
    setPlayerAnimationAction,
    setPlayerImpactAnimationId,
    setPlayerImpactAnimationTintColor,
    setPlayerImpactAnimationTarget,
    setPlayerImpactAnimationTrigger,
    setTurnState,
    turnState,
  ]);

  const handleAbsorbImpulse = useCallback(() => {
    if (turnState !== TurnState.PLAYER_INPUT || player.impulso <= 0 || player.impulsoAtivo >= 3) return;

    setPlayer((prev) => ({
      ...prev,
      impulso: clampImpulse(prev.impulso - 1),
      impulsoAtivo: clampImpulse(prev.impulsoAtivo + 1),
    }));
    const nextActive = clampImpulse(player.impulsoAtivo + 1);
    playImpulseVisual('player', nextActive, `ABSORVER ${nextActive}/3`);
    addLog(`Absorcao de impulso: ${nextActive}/3 ativo.`, 'buff');
  }, [
    addLog,
    playImpulseVisual,
    player.impulso,
    player.impulsoAtivo,
    setPlayer,
    turnState,
  ]);

  const handlePlayerAttack = useCallback(() => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;
    lastPlayerActionRef.current = 'attack';
    setPlayerImpactAnimationId(null);
    setPlayerImpactAnimationTintColor(null);
    setPlayerImpactAnimationTarget('target');

    const talentBonuses = getTalentBonuses(player);
    const doubleAttackActive = player.buffs.doubleAttackTurns > 0;
    const riposteActive = Boolean(player.buffs.riposteArmed);
    const activeImpulse = consumeActiveImpulse();
    const attackImpulseMultiplier = activeImpulse > 0 ? (1 + IMPULSE_ATTACK_DAMAGE_BONUS) : 1;
    const attackDefenseIgnoreRatio = activeImpulse >= 2 ? IMPULSE_DEF_IGNORE_RATIO : 0;
    const guaranteedCritFromImpulse = activeImpulse >= 3;
    const attackDelay = player.equippedWeapon ? 650 : 400;
    const idleDelay = player.equippedWeapon ? 400 : 550;

    setTurnState(TurnState.PLAYER_ANIMATION);
    setIsPlayerAttacking(true);
    playMovementSfx(player.equippedWeapon ? 'weapon' : 'unarmed');
    setPlayerAnimationAction('attack');
    setEnemyAnimationAction(enemy.isDefending ? 'defend' : 'battle-idle');
    if (riposteActive) {
      setPlayer((prev) => ({
        ...prev,
        buffs: {
          ...prev.buffs,
          riposteArmed: false,
          riposteTurns: 0,
        },
      }));
    }

    const resolveStrike = (remainingHp: number, isFirstStrike: boolean) => {
      const riposteMultiplier = riposteActive && isFirstStrike ? RIPOSTE_DAMAGE_MULTIPLIER : 1;
      const attackResult = calculateDamage({
        attackerAtk: player.stats.atk,
        defenderDef: getEnemyDefWithBuff(enemy),
        attackerSpeed: player.stats.speed,
        defenderSpeed: enemy.stats.speed,
        multiplier: getBossDamageMultiplier() * attackImpulseMultiplier * (1 + talentBonuses.physicalDamage + getMarkedBonus(enemy.statusEffects, talentBonuses.markedDamage)) * riposteMultiplier,
        luck: player.stats.luck,
        attackKind: 'physical',
        defenderIsDefending: isFirstStrike ? enemy.isDefending : false,
        attackerBuffs: player.buffs,
        applyAttackBuff: true,
        critChanceBonus: talentBonuses.critChance,
        critDamageBonus: talentBonuses.critDamage,
        defenderDefenseIgnoreRatio: attackDefenseIgnoreRatio,
        forceCrit: guaranteedCritFromImpulse,
      });

      if (attackResult.evaded) {
        battleSfx.play('evade');
        spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
        addLog(isFirstStrike ? `${enemy.name} desviou do ataque!` : `${enemy.name} desviou do segundo golpe!`, 'evade');
        triggerEnemyAnimationAction('evade', 520);
        return { remainingHp, defeated: false, evaded: true };
      }

      const enemyGuardLevel = isFirstStrike && enemy.isDefending ? clampImpulse(enemy.impulseGuardLevel ?? 0) : 0;
      const defendedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
      const appliedDamage = enemyGuardLevel >= 2
        ? 0
        : enemyGuardLevel === 1
          ? Math.floor(defendedDamage * (1 - IMPULSE_DEFENSE_EXTRA_MITIGATION))
          : defendedDamage;
      const blockedByDefense = isFirstStrike && enemy.isDefending;
      if (blockedByDefense) {
        setPlayerImpactAnimationId(SPRITE_ANIMATION_IDS.hitBlock);
        setPlayerImpactAnimationTintColor(null);
      }
      playAttackImpactSfx({
        attackKind: 'physical',
        attackerStyle: player.equippedWeapon ? 'weapon' : 'unarmed',
        defended: isFirstStrike ? enemy.isDefending : false,
        source: 'hero',
      });
      const strikeLabel = isFirstStrike ? '' : '2o GOLPE! ';
      spawnParticles([2, -0.5, 0], isFirstStrike ? 10 : 12, attackResult.isCrit ? '#fbbf24' : '#ffffff', 'explode');
      spawnFloatingText(attackResult.isCrit ? `${strikeLabel}CRIT! ${appliedDamage}` : `${strikeLabel}${appliedDamage}`, 'enemy', attackResult.isCrit ? 'crit' : 'damage');
      setScreenShake(attackResult.isCrit ? 0.5 : 0.2);
      setIsEnemyHit(true);
      window.setTimeout(() => {
        setScreenShake(0);
        setIsEnemyHit(false);
      }, 200);

      const updatedHp = Math.max(0, remainingHp - appliedDamage);
      if (updatedHp <= 0) {
        playEnemyDeathAfterImpactSfx();
      }
      triggerEnemyAnimationAction(updatedHp <= 0 ? 'death' : attackResult.isCrit ? 'critical-hit' : 'hit', updatedHp <= 0 ? 900 : attackResult.isCrit ? 620 : 360);
      setEnemy((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - appliedDamage) },
          isDefending: false,
          impulseGuardLevel: 0,
        };
      });
      const riposteResourceGain = riposteActive && isFirstStrike ? RIPOSTE_RESOURCE_BONUS : 0;
      awardCombatBenefits(appliedDamage, 1 + Math.max(0, Math.floor(talentBonuses.resourceOnAttack)) + riposteResourceGain, talentBonuses);
      addLog(`${isFirstStrike ? 'Causou' : 'Segundo golpe:'} ${appliedDamage} dano!${isFirstStrike && enemy.isDefending ? ' (Defendido)' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
      return { remainingHp: updatedHp, defeated: updatedHp <= 0, evaded: false };
    };

    window.setTimeout(() => {
      setIsPlayerAttacking(false);

      const firstStrike = resolveStrike(enemy.stats.hp, true);
      if (firstStrike.defeated) {
        setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs) }));
        void handleVictoryRef.current(900);
        return;
      }

      const resolvedIdleDelay = firstStrike.evaded ? Math.max(idleDelay, 570) : idleDelay;
      if (!doubleAttackActive) {
        window.setTimeout(() => {
          setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs) }));
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, resolvedIdleDelay);
        return;
      }

      addLog('Presa Gemea ativada: segundo golpe imediato!', 'buff');
      window.setTimeout(() => {
        const secondStrike = resolveStrike(firstStrike.remainingHp, false);
        if (secondStrike.defeated) {
          setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs) }));
          void handleVictoryRef.current(900);
          return;
        }
        window.setTimeout(() => {
          setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs) }));
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, 450);
      }, 260);
    }, attackDelay);
  }, [
    addLog,
    awardCombatBenefits,
    enemy,
    getBossDamageMultiplier,
    handleVictory,
    player,
    setEnemy,
    setEnemyAnimationAction,
    setIsEnemyHit,
    setIsPlayerAttacking,
    setPlayerAnimationAction,
    setScreenShake,
    setTurnState,
    spawnFloatingText,
    spawnParticles,
    triggerEnemyAnimationAction,
    turnState,
    setPlayer,
  ]);

  const handlePlayerDefense = useCallback(() => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;
    lastPlayerActionRef.current = 'defend';

    const talentBonuses = getTalentBonuses(player);
    const activeImpulse = consumeActiveImpulse();
    const perfectGuardTurns = activeImpulse >= 2 ? 1 : 0;
    const guaranteedCounterTurns = activeImpulse >= 3 ? 1 : 0;
    const impulseDefenseBoostTurns = activeImpulse >= 1 ? 1 : 0;
    const manaRecovered = Math.max(1, Math.floor(player.stats.maxMp * (0.05 + player.cardBonuses.defendManaRestore)) + Math.floor(talentBonuses.manaOnDefend));

    setTurnState(TurnState.PLAYER_ANIMATION);
    battleSfx.play('defense_use', { source: 'hero' });
    setPlayerAnimationAction('defend');

    setPlayer((prev) => ({
      ...prev,
      isDefending: true,
      buffs: {
        ...prev.buffs,
        riposteTurns: 1,
        riposteArmed: false,
        perfectGuardTurns: Math.max(prev.buffs.perfectGuardTurns, perfectGuardTurns),
        guaranteedCounterTurns: Math.max(prev.buffs.guaranteedCounterTurns, guaranteedCounterTurns),
        impulseDefenseBoostTurns: Math.max(prev.buffs.impulseDefenseBoostTurns, impulseDefenseBoostTurns),
      },
      stats: {
        ...prev.stats,
        mp: Math.min(prev.stats.maxMp, prev.stats.mp + manaRecovered),
      },
      classResource: {
        ...prev.classResource,
        value: Math.min(prev.classResource.max, prev.classResource.value + 1),
      },
    }));
    addLog(`+${manaRecovered} Mana`, 'heal');
    if (activeImpulse > 0) {
      addLog(`Defesa reforcada por impulso nivel ${activeImpulse}.`, 'buff');
      spawnFloatingText(
        activeImpulse >= 3 ? 'DEFESA PERFEITA + CONTRA!' : activeImpulse >= 2 ? 'DEFESA PERFEITA!' : 'DEFESA REFORCADA!',
        'player',
        'buff',
        activeImpulse >= 3 ? '#3b82f6' : activeImpulse >= 2 ? '#a855f7' : '#ef4444',
      );
    }
    spawnFloatingText(`+${manaRecovered} Mana`, 'player', 'heal');
    spawnParticles([-2, -1, 0], 10, '#3b82f6', 'spark');

    window.setTimeout(() => {
      setPlayer((prev) => {
        const consumedBuffs = consumeTurnBuffs(prev.buffs);
        consumedBuffs.perfectGuardTurns = prev.buffs.perfectGuardTurns;
        consumedBuffs.guaranteedCounterTurns = prev.buffs.guaranteedCounterTurns;
        consumedBuffs.impulseDefenseBoostTurns = prev.buffs.impulseDefenseBoostTurns;
        return { ...prev, buffs: consumedBuffs };
      });
      setTurnState(TurnState.ENEMY_TURN);
    }, 600);
  }, [
    addLog,
    consumeActiveImpulse,
    enemy,
    player,
    setPlayer,
    setPlayerAnimationAction,
    setTurnState,
    spawnFloatingText,
    spawnParticles,
    turnState,
  ]);

  const handleSkill = useCallback((inputSkill: Skill) => {
    const catalogSkill = SKILLS.find((entry) => entry.id === inputSkill.id);
    const skill: Skill = catalogSkill ? { ...inputSkill, ...catalogSkill } : inputSkill;
    const requiredResource = skill.resourceEffect?.cost ?? 0;
    const previewImpulse = clampImpulse(player.impulsoAtivo);
    const discountedManaCost = previewImpulse >= 1
      ? Math.max(1, Math.floor(skill.manaCost * (1 - IMPULSE_MANA_DISCOUNT)))
      : skill.manaCost;
    if (!enemy || turnState !== TurnState.PLAYER_INPUT || player.stats.mp < discountedManaCost || player.classResource.value < requiredResource) return;
    lastPlayerActionRef.current = 'skill';

    const activeImpulse = consumeActiveImpulse();
    const talentBonuses = getTalentBonuses(player);
    const riposteActive = skill.type !== 'heal' && Boolean(player.buffs.riposteArmed);
    const hasEmpowerBuff = player.buffs.skillEmpowerTurns > 0;
    const boostedByImpulse = activeImpulse >= 2;
    const skillEffectMultiplier = boostedByImpulse || hasEmpowerBuff ? (1 + IMPULSE_SKILL_EFFECT_BONUS) : 1;
    const grantEmpowerTurns = activeImpulse >= 3 ? 2 : 0;
    const visual = getSkillVisualConfig(skill);
    const skillAnimationType = skill.tipoAnimacao
      ?? (skill.type === 'heal' ? 'cura_status' : skill.type === 'magic' ? 'magia' : 'ataque');
    const skillImpactTarget = skill.animacaoImpactoAlvo
      ?? (skillAnimationType === 'cura_status' ? 'self' : 'target');
    const executionAnimationDurationMs = getAnimationDurationMsById(skill.animacaoExecucao);
    const skillImpactDelayMs = executionAnimationDurationMs > 0 ? executionAnimationDurationMs + 40 : 0;
    const skillImpactAnimationDurationMs = getAnimationDurationMsById(skill.animacaoImpacto);
    const skillImpactPlaybackWindowMs = skillImpactAnimationDurationMs > 0 ? (skillImpactAnimationDurationMs + 80) : 520;
    const impactColor = skill.trailColor ?? visual.color;
    const resourceSpent = skill.resourceEffect?.consumeAll ? player.classResource.value : requiredResource;
    const isAutoGuardSkill = skill.id === 'skl_11';

    setTurnState(TurnState.PLAYER_ANIMATION);
    setPlayerExecutionAnimationId(skill.animacaoExecucao ?? null);
    setPlayerExecutionAnimationTintColor(skill.animacaoExecucaoCor ?? null);
    setPlayerImpactAnimationId(null);
    setPlayerImpactAnimationTintColor(null);
    setPlayerImpactAnimationTarget(skillImpactTarget);
    setPlayerAnimationAction(isAutoGuardSkill ? 'defend' : skill.type === 'heal' ? 'heal' : skill.type === 'magic' ? 'skill' : 'attack');
    setEnemyAnimationAction(enemy.isDefending ? 'defend' : 'battle-idle');
    setPlayer((prev) => ({
      ...prev,
      stats: { ...prev.stats, mp: prev.stats.mp - discountedManaCost },
      classResource: {
        ...prev.classResource,
        value: Math.max(0, prev.classResource.value - resourceSpent),
      },
      buffs: {
        ...(riposteActive
          ? {
            ...prev.buffs,
            riposteArmed: false,
            riposteTurns: 0,
          }
          : prev.buffs),
        skillEmpowerTurns: grantEmpowerTurns > 0 ? Math.max(prev.buffs.skillEmpowerTurns, grantEmpowerTurns) : prev.buffs.skillEmpowerTurns,
      },
    }));
    spawnFloatingText(skill.name.toUpperCase(), 'player', 'skill');
    if (activeImpulse > 0) {
      spawnFloatingText(`IMPULSO ${activeImpulse}`, 'player', 'buff', activeImpulse >= 3 ? '#3b82f6' : activeImpulse === 2 ? '#a855f7' : '#ef4444');
    }
    if (grantEmpowerTurns > 0) {
      addLog(`${skill.name}: efeito ampliado por 2 turnos.`, 'buff');
    }

    if (resourceSpent > 0) {
      spawnFloatingText(`-${resourceSpent} ${player.classResource.name}`, 'player', 'buff', player.classResource.color);
      spawnParticles([-2, -1, 0], 14, player.classResource.color, 'spark');
      addLog(`${skill.name} consumiu ${resourceSpent} ${player.classResource.name}.`, 'info');
    }

    if (isAutoGuardSkill) {
      setPlayer((prev) => ({
        ...prev,
        buffs: {
          ...prev.buffs,
          autoGuardTurns: Math.max(prev.buffs.autoGuardTurns, 3),
        },
      }));

      spawnParticles([-2, -1, 0], visual.particleCount + 10, '#60a5fa', 'spark');
      spawnFloatingText('GUARDA AUTOMATICA!', 'player', 'buff');
      addLog(`${skill.name}: defesa automatica ativa por 3 turnos.`, 'buff');

      window.setTimeout(() => {
        setPlayer((prev) => {
          const consumedBuffs = consumeTurnBuffs(prev.buffs);
          consumedBuffs.autoGuardTurns = prev.buffs.autoGuardTurns;
          return { ...prev, buffs: consumedBuffs };
        });
        setPlayerExecutionAnimationId(null);
        setPlayerExecutionAnimationTintColor(null);
        setPlayerImpactAnimationId(null);
        setPlayerImpactAnimationTintColor(null);
        setPlayerAnimationAction('idle');
        setTurnState(TurnState.ENEMY_TURN);
      }, 1500);
      return;
    }

    if (skill.type === 'heal') {
      const healPower = 1 + talentBonuses.healPower;
      const healAmount = getHealingValue(Math.floor(player.stats.maxHp * skill.damageMult * healPower * skillEffectMultiplier));
      const resourceGain = (skill.resourceEffect?.gain ?? 0) + Math.max(0, Math.floor(talentBonuses.resourceOnSkill));
      const impactDelayMs = Math.max(120, skillImpactDelayMs);
      const finishDelayMs = Math.max(impactDelayMs + skillImpactPlaybackWindowMs, impactDelayMs + 420);

      window.setTimeout(() => {
        if (skill.animacaoImpacto) {
          setPlayerImpactAnimationId(skill.animacaoImpacto ?? null);
          setPlayerImpactAnimationTintColor(skill.animacaoImpactoCor ?? null);
          setPlayerImpactAnimationTarget(skillImpactTarget);
          setPlayerImpactAnimationTrigger((prev) => prev + 1);
        }

        setPlayer((prev) => {
          const nextBuffs = { ...prev.buffs };
          if (skill.buffEffect?.target === 'player') {
            if (skill.buffEffect.kind === 'atk') {
              nextBuffs.atkMod = Math.max(nextBuffs.atkMod, skill.buffEffect.modifier * skillEffectMultiplier);
              nextBuffs.atkTurns = Math.max(nextBuffs.atkTurns, skill.buffEffect.duration);
            }
            if (skill.buffEffect.kind === 'def') {
              nextBuffs.defMod = Math.max(nextBuffs.defMod, skill.buffEffect.modifier * skillEffectMultiplier);
              nextBuffs.defTurns = Math.max(nextBuffs.defTurns, skill.buffEffect.duration);
            }
          }

          return {
            ...prev,
            stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + healAmount) },
            buffs: nextBuffs,
            classResource: {
              ...prev.classResource,
              value: Math.min(prev.classResource.max, prev.classResource.value + resourceGain),
            },
          };
        });

        spawnParticles([-2, -1, 0], visual.particleCount + 14, visual.color, 'heal');
        spawnFloatingText(`+${healAmount}`, 'player', 'heal');
        if (resourceGain > 0 && player.classResource.max > 0) {
          spawnFloatingText(`+${resourceGain} ${player.classResource.name}`, 'player', 'buff', player.classResource.color);
        }
        battleSfx.play('heal');
        addLog(`${skill.name}: curou ${healAmount} HP!`, 'heal');

        if (skill.buffEffect?.target === 'player') {
          spawnFloatingText(skill.buffEffect.kind === 'atk' ? 'ATAQUE UP!' : 'DEFESA UP!', 'player', 'buff');
          addLog(`${skill.name} fortaleceu ${skill.buffEffect.kind === 'atk' ? 'o ataque' : 'a defesa'} por ${skill.buffEffect.duration} turnos.`, 'buff');
        }
      }, impactDelayMs);

      window.setTimeout(() => {
        setPlayer((prev) => {
          const consumedBuffs = consumeTurnBuffs(prev.buffs);
          if (grantEmpowerTurns > 0) {
            consumedBuffs.skillEmpowerTurns = prev.buffs.skillEmpowerTurns;
          }
          return { ...prev, buffs: consumedBuffs };
        });
        setPlayerExecutionAnimationId(null);
        setPlayerExecutionAnimationTintColor(null);
        setPlayerImpactAnimationId(null);
        setPlayerImpactAnimationTintColor(null);
        setPlayerAnimationAction('idle');
        setTurnState(TurnState.ENEMY_TURN);
      }, finishDelayMs);
      return;
    }

    const shouldLungeForSkill = skillAnimationType === 'ataque';
    setIsPlayerAttacking(shouldLungeForSkill);
    if (shouldLungeForSkill) {
      playMovementSfx(skill.type === 'magic' ? 'unarmed' : (player.equippedWeapon ? 'weapon' : 'unarmed'));
    }
    const doubleAttackActive = player.buffs.doubleAttackTurns > 0 && skill.type === 'physical';
    window.setTimeout(() => {
      setIsPlayerAttacking(false);

      const resolveSkillStrike = (remainingHp: number, isFirstStrike: boolean) => {
        const statusBonus = getMarkedBonus(enemy.statusEffects, talentBonuses.markedDamage);
        const schoolBonus = skill.type === 'magic' ? talentBonuses.magicDamage : talentBonuses.physicalDamage;
        const resourceBurst = resourceSpent * (skill.resourceEffect?.bonusDamagePerPoint ?? 0);
        const riposteMultiplier = riposteActive && isFirstStrike ? RIPOSTE_DAMAGE_MULTIPLIER : 1;
        const attackResult = calculateDamage({
          attackerAtk: player.stats.atk,
          defenderDef: getEnemyDefWithBuff(enemy),
          attackerSpeed: player.stats.speed,
          defenderSpeed: enemy.stats.speed,
          multiplier: (skill.damageMult + resourceBurst) * getBossDamageMultiplier() * skillEffectMultiplier * (1 + schoolBonus + statusBonus) * riposteMultiplier,
          luck: player.stats.luck,
          attackKind: skill.type === 'magic' ? 'magic' : 'physical',
          defenderIsDefending: isFirstStrike ? enemy.isDefending : false,
          attackerBuffs: player.buffs,
          applyAttackBuff: true,
          critChanceBonus: talentBonuses.critChance,
          critDamageBonus: talentBonuses.critDamage,
          defenderDefenseIgnoreRatio: activeImpulse >= 2 ? IMPULSE_DEF_IGNORE_RATIO : 0,
          forceCrit: activeImpulse >= 3,
        });

        if (attackResult.evaded) {
          battleSfx.play('evade');
          spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
          addLog(isFirstStrike ? `${enemy.name} desviou de ${skill.name}!` : `${enemy.name} desviou da repeticao de ${skill.name}!`, 'evade');
          triggerEnemyAnimationAction('evade', 520);
          return { remainingHp, defeated: false };
        }

        const enemyGuardLevel = isFirstStrike && enemy.isDefending ? clampImpulse(enemy.impulseGuardLevel ?? 0) : 0;
        const defendedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
        const appliedDamage = enemyGuardLevel >= 2
          ? 0
          : enemyGuardLevel === 1
            ? Math.floor(defendedDamage * (1 - IMPULSE_DEFENSE_EXTRA_MITIGATION))
            : defendedDamage;
        const blockedByDefense = isFirstStrike && enemy.isDefending;
        playAttackImpactSfx({
          attackKind: skill.type === 'magic' ? 'magic' : 'physical',
          attackerStyle: skill.type === 'magic' ? 'unarmed' : (player.equippedWeapon ? 'weapon' : 'unarmed'),
          defended: isFirstStrike ? enemy.isDefending : false,
          source: 'hero',
        });
        const strikePrefix = isFirstStrike ? '' : '2o ';
        const impactPosition: [number, number, number] = [2, 0.62, 0.06];
        const strikeBurstCount = visual.particleCount + (isFirstStrike ? 10 : 14) + (attackResult.isCrit ? 8 : 0);
        spawnParticles(impactPosition, strikeBurstCount, impactColor, 'explode');
        spawnParticles(impactPosition, 14 + (attackResult.isCrit ? 6 : 0), impactColor, 'spark');
        spawnFloatingText(attackResult.isCrit ? `${strikePrefix}CRIT! ${appliedDamage}` : `${strikePrefix}${appliedDamage}`, 'enemy', attackResult.isCrit ? 'crit' : 'damage');
        if (blockedByDefense) {
          setPlayerImpactAnimationId(SPRITE_ANIMATION_IDS.hitBlock);
          setPlayerImpactAnimationTintColor(null);
          setPlayerImpactAnimationTarget('target');
        } else {
          setPlayerImpactAnimationId(skill.animacaoImpacto ?? null);
          setPlayerImpactAnimationTintColor(skill.animacaoImpactoCor ?? null);
          setPlayerImpactAnimationTarget(skillImpactTarget);
        }
        setPlayerImpactAnimationTrigger((prev) => prev + 1);
        setIsEnemyHit(true);
        window.setTimeout(() => setIsEnemyHit(false), 150);
        setScreenShake(attackResult.isCrit ? visual.shake + 0.18 : visual.shake);
        window.setTimeout(() => setScreenShake(0), 200);

        const updatedHp = Math.max(0, remainingHp - appliedDamage);
        if (updatedHp <= 0) {
          playEnemyDeathAfterImpactSfx();
        }
        triggerEnemyAnimationAction(updatedHp <= 0 ? 'death' : attackResult.isCrit ? 'critical-hit' : 'hit', updatedHp <= 0 ? 900 : attackResult.isCrit ? 620 : 360);
        setEnemy((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - appliedDamage) },
            isDefending: false,
            impulseGuardLevel: 0,
          };
        });

        const riposteResourceGain = riposteActive && isFirstStrike ? RIPOSTE_RESOURCE_BONUS : 0;
        awardCombatBenefits(appliedDamage, (skill.resourceEffect?.gain ?? 0) + Math.max(0, Math.floor(talentBonuses.resourceOnSkill)) + riposteResourceGain, talentBonuses);
        if (isFirstStrike) {
          tryApplySkillStatus(skill, talentBonuses);
        }
        addLog(`${isFirstStrike ? skill.name : `${skill.name} (2o golpe)`}: ${appliedDamage} dano!${isFirstStrike && enemy.isDefending ? ' (Defendido)' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
        return { remainingHp: updatedHp, defeated: updatedHp <= 0 };
      };

      const firstStrike = resolveSkillStrike(enemy.stats.hp, true);
      if (firstStrike.defeated) {
        setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs) }));
        setPlayerExecutionAnimationId(null);
        setPlayerExecutionAnimationTintColor(null);
        setPlayerImpactAnimationId(null);
        setPlayerImpactAnimationTintColor(null);
        void handleVictoryRef.current(Math.max(900, skillImpactPlaybackWindowMs));
        return;
      }

      if (!doubleAttackActive) {
        window.setTimeout(() => {
          setPlayer((prev) => {
            const consumedBuffs = consumeTurnBuffs(prev.buffs);
            if (grantEmpowerTurns > 0) {
              consumedBuffs.skillEmpowerTurns = prev.buffs.skillEmpowerTurns;
            }
            return { ...prev, buffs: consumedBuffs };
          });
          setPlayerExecutionAnimationId(null);
          setPlayerExecutionAnimationTintColor(null);
          setPlayerImpactAnimationId(null);
          setPlayerImpactAnimationTintColor(null);
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, Math.max(420, skillImpactPlaybackWindowMs));
        return;
      }

      addLog(`Presa Gemea repetiu ${skill.name}!`, 'buff');
      window.setTimeout(() => {
        const secondStrike = resolveSkillStrike(firstStrike.remainingHp, false);
        if (secondStrike.defeated) {
          setPlayer((prev) => {
            const consumedBuffs = consumeTurnBuffs(prev.buffs);
            if (grantEmpowerTurns > 0) {
              consumedBuffs.skillEmpowerTurns = prev.buffs.skillEmpowerTurns;
            }
            return { ...prev, buffs: consumedBuffs };
          });
          setPlayerExecutionAnimationId(null);
          setPlayerExecutionAnimationTintColor(null);
          setPlayerImpactAnimationId(null);
          setPlayerImpactAnimationTintColor(null);
          void handleVictoryRef.current(Math.max(900, skillImpactPlaybackWindowMs));
          return;
        }
        window.setTimeout(() => {
          setPlayer((prev) => {
            const consumedBuffs = consumeTurnBuffs(prev.buffs);
            if (grantEmpowerTurns > 0) {
              consumedBuffs.skillEmpowerTurns = prev.buffs.skillEmpowerTurns;
            }
            return { ...prev, buffs: consumedBuffs };
          });
          setPlayerExecutionAnimationId(null);
          setPlayerExecutionAnimationTintColor(null);
          setPlayerImpactAnimationId(null);
          setPlayerImpactAnimationTintColor(null);
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, Math.max(420, skillImpactPlaybackWindowMs));
      }, 260);
    }, Math.max(visual.castDelay, skillImpactDelayMs));
  }, [
    addLog,
    awardCombatBenefits,
    enemy,
    getBossDamageMultiplier,
    getHealingValue,
    getSkillVisualConfig,
    handleVictory,
    player,
    setEnemy,
    setEnemyAnimationAction,
    setIsPlayerAttacking,
    setPlayer,
    setPlayerAnimationAction,
    setPlayerExecutionAnimationId,
    setScreenShake,
    setIsEnemyHit,
    setTurnState,
    spawnFloatingText,
    spawnParticles,
    triggerEnemyAnimationAction,
    tryApplySkillStatus,
    turnState,
  ]);

  const handleUseItem = useCallback((itemId: string) => {
    if (turnState !== TurnState.PLAYER_INPUT) return;
    lastPlayerActionRef.current = 'item';

    const item = ALL_ITEMS.find((entry) => entry.id === itemId);
    const qty = player.inventory[itemId] || 0;
    if (!item || qty <= 0) return;

    if (item.id === 'pot_dg_recall') {
      if (!dungeonRun) {
        addLog('A Ancora de Retorno so funciona dentro da dungeon.', 'info');
        return;
      }

      const withdrew = withdrawFromDungeon('Voce ativou a Ancora de Retorno e estabilizou uma rota de fuga, levando todo o espolio acumulado ate aqui.', item.id);
      if (withdrew) {
        addLog('A Ancora de Retorno abriu uma saida segura da dungeon.', 'crit');
      }
      return;
    }

    if (gameState === GameState.BATTLE) {
      setTurnState(TurnState.PLAYER_ANIMATION);
      setPlayerAnimationAction('item');
      setPlayerExecutionAnimationId(item.animacaoExecucao ?? COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId);
      setPlayerExecutionAnimationTintColor(item.animacaoExecucaoCor ?? null);
      setPlayerImpactAnimationId(null);
      setPlayerImpactAnimationTintColor(null);
      setPlayerImpactAnimationTarget('self');
      spawnFloatingText(item.icon, 'player', 'item');
    }

    const itemExecutionAnimationId = item.animacaoExecucao ?? COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId;
    const itemExecutionDurationMs = getAnimationDurationMsById(itemExecutionAnimationId);
    const itemImpactDurationMs = getAnimationDurationMsById(item.animacaoImpacto);
    const itemImpactDelayMs = Math.max(120, itemExecutionDurationMs > 0 ? itemExecutionDurationMs + 40 : 120);
    const itemImpactPlaybackWindowMs = itemImpactDurationMs > 0 ? (itemImpactDurationMs + 80) : 520;
    const itemFinishDelayMs = itemImpactDelayMs + itemImpactPlaybackWindowMs;

    const mixedRecovery = MIXED_POTION_RECOVERY[item.id];
    const recoveredHp = mixedRecovery
      ? getHealingValue(mixedRecovery.hp)
      : MANA_ONLY_POTION_IDS.has(item.id)
        ? 0
        : getHealingValue(item.value);
    const recoveredMp = mixedRecovery
      ? mixedRecovery.mp
      : MANA_ONLY_POTION_IDS.has(item.id)
        ? item.value
        : 0;

    if (recoveredHp > 0 && recoveredMp > 0) {
      battleSfx.play('heal');
      spawnParticles([-2, -1, 0], 26, '#4ade80', 'heal');
      spawnParticles([-2, -1, 0], 20, '#3b82f6', 'heal');
      spawnFloatingText(`+${recoveredHp} HP`, 'player', 'heal');
      spawnFloatingText(`+${recoveredMp} Mana`, 'player', 'heal');
      addLog(`Usou ${item.name}, recuperou ${recoveredHp} HP e ${recoveredMp} Mana`, 'heal');
    } else if (recoveredHp > 0) {
      battleSfx.play('heal');
      spawnParticles([-2, -1, 0], 24, '#4ade80', 'heal');
      spawnFloatingText(`+${recoveredHp}`, 'player', 'heal');
      addLog(`Usou ${item.name}, recuperou ${recoveredHp} HP`, 'heal');
    } else if (recoveredMp > 0) {
      battleSfx.play('heal');
      spawnParticles([-2, -1, 0], 24, '#3b82f6', 'heal');
      spawnFloatingText(`+${recoveredMp} Mana`, 'player', 'heal');
      addLog(`Usou ${item.name}, recuperou ${recoveredMp} Mana`, 'heal');
    } else if (item.id === 'pot_atk') {
      spawnParticles([-2, -1, 0], 15, '#f97316', 'spark');
      spawnFloatingText('ATAQUE UP!', 'player', 'buff');
      addLog(`Usou ${item.name}! Dano aumentado por ${item.duration} turnos.`, 'buff');
    } else if (item.id === 'pot_def') {
      spawnParticles([-2, -1, 0], 15, '#10b981', 'spark');
      spawnFloatingText('DEFESA UP!', 'player', 'buff');
      addLog(`Usou ${item.name}! Defesa aumentada por ${item.duration} turnos.`, 'buff');
    } else if (item.id === 'pot_war_sigil' || item.id === 'pot_overclock') {
      spawnParticles([-2, -1, 0], 16, '#f97316', 'spark');
      spawnParticles([-2, -1, 0], 16, '#10b981', 'spark');
      spawnFloatingText('ATK/DEF UP!', 'player', 'buff');
      addLog(`Usou ${item.name}! Ataque e defesa aumentados por ${item.duration || 2} turnos.`, 'buff');
    } else if (item.id === 'pot_alc_phantom_veil') {
      spawnParticles([-2, -1, 0], 18, '#a78bfa', 'spark');
      spawnFloatingText('INTANGIVEL!', 'player', 'buff');
      addLog(`Usou ${item.name}! Evasao perfeita ativa por ${item.duration || 4} turnos.`, 'crit');
    } else if (item.id === 'pot_alc_twin_fang') {
      spawnParticles([-2, -1, 0], 18, '#f97316', 'spark');
      spawnFloatingText('ATAQUE DUPLO!', 'player', 'buff');
      addLog(`Usou ${item.name}! O comando Atacar golpeia duas vezes por ${item.duration || 6} turnos.`, 'crit');
    }

    setPlayer((prev) => {
      const currentQty = prev.inventory[itemId] || 0;
      if (currentQty <= 0) return prev;

      const newInv = { ...prev.inventory };
      newInv[itemId] = currentQty - 1;
      let newHp = prev.stats.hp;
      let newMp = prev.stats.mp;
      const newBuffs = { ...prev.buffs };

      if (recoveredHp > 0) {
        newHp = Math.min(prev.stats.maxHp, prev.stats.hp + recoveredHp);
      }

      if (recoveredMp > 0) {
        newMp = Math.min(prev.stats.maxMp, prev.stats.mp + recoveredMp);
      } else if (item.id === 'pot_atk') {
        newBuffs.atkMod = item.value;
        newBuffs.atkTurns = item.duration || 3;
      } else if (item.id === 'pot_def') {
        newBuffs.defMod = item.value;
        newBuffs.defTurns = item.duration || 3;
      } else if (item.id === 'pot_war_sigil' || item.id === 'pot_overclock') {
        newBuffs.atkMod = item.value;
        newBuffs.defMod = item.value;
        newBuffs.atkTurns = item.duration || 2;
        newBuffs.defTurns = item.duration || 2;
      } else if (item.id === 'pot_alc_phantom_veil') {
        newBuffs.perfectEvadeTurns = Math.max(newBuffs.perfectEvadeTurns, item.duration || 4);
      } else if (item.id === 'pot_alc_twin_fang') {
        newBuffs.doubleAttackTurns = Math.max(newBuffs.doubleAttackTurns, item.duration || 6);
      }

      return { ...prev, inventory: newInv, stats: { ...prev.stats, hp: newHp, mp: newMp }, buffs: newBuffs };
    });

    if (gameState === GameState.BATTLE) {
      if (item.animacaoImpacto) {
        window.setTimeout(() => {
          setPlayerImpactAnimationId(item.animacaoImpacto ?? null);
          setPlayerImpactAnimationTintColor(item.animacaoImpactoCor ?? null);
          setPlayerImpactAnimationTarget('self');
          setPlayerImpactAnimationTrigger((prev) => prev + 1);
        }, itemImpactDelayMs);
      }

      window.setTimeout(() => {
        setPlayer((prev) => {
          const consumedBuffs = consumeTurnBuffs(prev.buffs);
          if (item.id === 'pot_atk') {
            consumedBuffs.atkTurns = prev.buffs.atkTurns;
          }
          if (item.id === 'pot_def') {
            consumedBuffs.defTurns = prev.buffs.defTurns;
          }
          if (item.id === 'pot_alc_phantom_veil') {
            consumedBuffs.perfectEvadeTurns = prev.buffs.perfectEvadeTurns;
          }
          if (item.id === 'pot_alc_twin_fang') {
            consumedBuffs.doubleAttackTurns = prev.buffs.doubleAttackTurns;
          }
          if (item.id === 'pot_war_sigil' || item.id === 'pot_overclock') {
            consumedBuffs.atkTurns = prev.buffs.atkTurns;
            consumedBuffs.defTurns = prev.buffs.defTurns;
          }
          return { ...prev, buffs: consumedBuffs };
        });
        setPlayerAnimationAction('idle');
        setPlayerExecutionAnimationId(null);
        setPlayerExecutionAnimationTintColor(null);
        setPlayerImpactAnimationId(null);
        setPlayerImpactAnimationTintColor(null);
        setTurnState(TurnState.ENEMY_TURN);
      }, itemFinishDelayMs);
    }
  }, [
    addLog,
    dungeonRun,
    gameState,
    getHealingValue,
    player.inventory,
    setPlayer,
    setPlayerAnimationAction,
    setTurnState,
    spawnFloatingText,
    spawnParticles,
    turnState,
    withdrawFromDungeon,
  ]);

  const handleEnemyTurn = useCallback(() => {
    if (!enemy || gameState !== GameState.BATTLE) return;

    setEnemyIntentPreview(null);
    setEnemyImpactAnimationId(null);
    setEnemyImpactAnimationTintColor(null);
    setEnemyImpactAnimationTarget('target');
    setTurnState(TurnState.PROCESSING);
    const talentBonuses = getTalentBonuses(player);

    const enemyStatusTick = tickStatusEffects(enemy.statusEffects ?? [], enemy.stats.maxHp, {
      burnBonus: talentBonuses.burnDamage,
      bleedBonus: talentBonuses.bleedDamage,
    });

    let simulatedEnemy: Enemy = {
      ...enemy,
      enemyClassId: enemy.enemyClassId ?? 'knight',
      impulso: clampImpulse(enemy.impulso ?? 0),
      aiTurnCounter: (enemy.aiTurnCounter ?? 0) + 1,
      stealAttemptsUsed: enemy.stealAttemptsUsed ?? 0,
      maxStealAttempts: enemy.maxStealAttempts ?? 3,
      lastStealTurn: enemy.lastStealTurn ?? -99,
      stolenGoldTotal: enemy.stolenGoldTotal ?? 0,
      maxGoldStealPerBattle: enemy.maxGoldStealPerBattle ?? Math.max(1, Math.floor(enemy.goldReward * 0.5)),
      stolenItems: [...(enemy.stolenItems ?? [])],
      statusEffects: enemyStatusTick.nextStatuses,
      stats: {
        ...enemy.stats,
        hp: Math.max(0, enemy.stats.hp - enemyStatusTick.damage),
      },
      isDefending: false,
      skillSet: enemy.skillSet.map((skill) => ({
        ...skill,
        currentCooldown: Math.max(0, skill.currentCooldown - 1),
      })),
    };

    if (enemyStatusTick.damage > 0) {
      spawnParticles([2, -0.5, 0], 18, '#fb7185', 'spark');
      spawnFloatingText(enemyStatusTick.damage, 'enemy', 'damage');
      enemyStatusTick.logs.forEach((message) => addLog(`${enemy.name}: ${message}`, 'damage'));
    }

    if (simulatedEnemy.stats.hp <= 0) {
      setEnemy(simulatedEnemy);
      setEnemyIntentPreview(null);
      battleSfx.play('death');
      triggerEnemyAnimationAction('death', 900);
      void handleVictoryRef.current(900);
      return;
    }

    const playerAggressive = lastPlayerActionRef.current === 'attack' || lastPlayerActionRef.current === 'skill';
    const playerDefensive = lastPlayerActionRef.current === 'defend';
    const equippedItemIds = new Set([
      player.equippedWeapon?.id,
      player.equippedArmor?.id,
      player.equippedHelmet?.id,
      player.equippedLegs?.id,
      player.equippedShield?.id,
    ].filter((entry): entry is string => Boolean(entry)));
    const stealableInventoryIds = Object.entries(player.inventory)
      .filter(([itemId, quantity]) => quantity > 0 && !equippedItemIds.has(itemId))
      .map(([itemId]) => itemId);
    const getEnemyTurnContext = (enemyState: Enemy) => {
      const hpRatio = enemyState.stats.hp / Math.max(1, enemyState.stats.maxHp);
      const mpRatio = enemyState.stats.maxMp > 0 ? enemyState.stats.mp / enemyState.stats.maxMp : 1;
      const hasPotion = enemyState.potionCharges > 0;
      const lowHp = hpRatio <= enemyState.aiProfile.lowHpThreshold;
      const criticalHp = hpRatio <= enemyState.aiProfile.criticalHpThreshold;
      const lowMana = enemyState.stats.maxMp > 0 && mpRatio <= enemyState.aiProfile.lowManaThreshold;
      const canDefend = enemyState.lastAction !== 'defend';
      const canAttemptSteal = enemyState.enemyClassId === 'rogue'
        && enemyState.stealAttemptsUsed < enemyState.maxStealAttempts
        && enemyState.lastAction !== 'steal'
        && (enemyState.aiTurnCounter - enemyState.lastStealTurn) > 1;
      const usableSkills = enemyState.skillSet.filter((skill) => (
        skill.currentCooldown <= 0
          && enemyState.stats.mp >= (enemyState.impulso >= 1
            ? Math.max(1, Math.floor(skill.manaCost * (1 - IMPULSE_MANA_DISCOUNT)))
            : skill.manaCost)
      ));
      const enemyUsesManaSkills = enemyState.skillSet.some((skill) => skill.manaCost > 0);

      return {
        lowHp,
        hasPotion,
        criticalHp,
        lowMana,
        canDefend,
        canAttemptSteal,
        usableSkills,
        enemyUsesManaSkills,
      };
    };

    const chooseEnemyIntent = (enemyState: Enemy): EnemyIntentType => {
      const context = getEnemyTurnContext(enemyState);
      if (context.lowHp && context.hasPotion) return 'item';
      if (context.criticalHp && !context.hasPotion && context.canDefend) return 'defend';
      if (context.lowMana && context.canDefend) return 'defend';
      if (context.canAttemptSteal) return 'item';
      if (enemyState.impulso < 3 && Math.random() < clamp(0.14 + (enemyState.aiProfile.tier * 0.02), 0.14, 0.28)) return 'impulse';

      const extraSkillBias = playerDefensive ? 0.15 : 0;
      const classSkillBias = ENEMY_CLASS_SKILL_BIAS[enemyState.enemyClassId] ?? 0.06;
      const skillChance = Math.min(0.9, 0.2 + (enemyState.aiProfile.tier * 0.05) + extraSkillBias + classSkillBias);
      if (context.usableSkills.length > 0 && Math.random() < skillChance) return 'skill';

      const defensiveReactionBoost = playerAggressive ? 0.08 : 0;
      const shouldDefend = context.canDefend && Math.random() < Math.min(0.65, enemyState.aiProfile.defendBaseChance + defensiveReactionBoost);
      return shouldDefend ? 'defend' : 'attack';
    };

    const turnContext = getEnemyTurnContext(simulatedEnemy);
    const {
      lowHp,
      hasPotion,
      canAttemptSteal,
      canDefend,
      usableSkills,
      enemyUsesManaSkills,
    } = turnContext;

    const plannedIntent = enemyIntentPreview?.type ?? pendingEnemyIntentRef.current ?? chooseEnemyIntent(simulatedEnemy);
    pendingEnemyIntentRef.current = null;
    const isIntentFeasible = (intent: EnemyIntentType) => {
      if (intent === 'attack') return true;
      if (intent === 'defend') return canDefend;
      if (intent === 'impulse') return simulatedEnemy.impulso < 3;
      if (intent === 'skill') return usableSkills.length > 0;
      return (lowHp && hasPotion) || canAttemptSteal;
    };
    const resolveFallbackIntent = (): EnemyIntentType => {
      if (usableSkills.length > 0) return 'skill';
      if (canDefend) return 'defend';
      return 'attack';
    };
    const feasibleIntent = isIntentFeasible(plannedIntent) ? plannedIntent : resolveFallbackIntent();
    const executedIntent = (feasibleIntent === 'attack' || feasibleIntent === 'defend')
      ? (Math.random() < ENEMY_INTENT_ATTACK_OR_DEFEND_EXECUTION_CHANCE
        ? feasibleIntent
        : (feasibleIntent === 'attack' && canDefend ? 'defend' : 'attack'))
      : feasibleIntent;
    const consumeEnemyImpulseForAction = (actionLabel: string) => {
      const activeImpulse = clampImpulse(simulatedEnemy.impulso);
      if (activeImpulse <= 0) return 0;
      simulatedEnemy = {
        ...simulatedEnemy,
        impulso: 0,
      };
      playImpulseVisual('enemy', activeImpulse, `IMPULSO ${activeImpulse}`);
      addLog(`${simulatedEnemy.name} canalizou impulso nivel ${activeImpulse} em ${actionLabel}.`, 'buff');
      return activeImpulse;
    };
    const defendingActive = player.isDefending || player.buffs.autoGuardTurns > 0;
    const perfectGuardActive = defendingActive && player.buffs.perfectGuardTurns > 0;
    const extraImpulseMitigationActive = defendingActive && player.buffs.impulseDefenseBoostTurns > 0;

    if (defendingActive) {
      // Auto-guard mirrors defend posture while the enemy resolves actions.
      setPlayerAnimationAction('defend');
    }

    const finishEnemyActionToPlayerTurn = (nextEnemy: Enemy) => {
      const enemyAfterBuffTick = tickEnemyBuffs(nextEnemy);
      setEnemy(enemyAfterBuffTick);
      setEnemyExecutionAnimationId(null);
      setEnemyExecutionAnimationTintColor(null);
      setEnemyImpactAnimationId(null);
      setEnemyImpactAnimationTintColor(null);
      setPlayer((prev) => {
        const nextBuffs = { ...prev.buffs };
        if (!nextBuffs.riposteArmed) {
          nextBuffs.riposteTurns = 0;
        }
        nextBuffs.perfectGuardTurns = 0;
        nextBuffs.impulseDefenseBoostTurns = 0;
        nextBuffs.guaranteedCounterTurns = 0;
        return { ...prev, buffs: nextBuffs, isDefending: false };
      });
      const nextIntent = chooseEnemyIntent(enemyAfterBuffTick);
      pendingEnemyIntentRef.current = nextIntent;
      setEnemyIntentPreview(createEnemyIntentPreview(nextIntent));
      setPlayerAnimationAction('idle');
      setTurnState(TurnState.PLAYER_INPUT);
    };

    const rollDefensiveCounter = (targetEnemy: Enemy) => {
      if (!defendingActive || player.stats.hp <= 0) {
        return { triggered: false as const, damage: 0, nextEnemy: targetEnemy };
      }

      const talentBonus = Math.max(0, Math.min(DEFEND_COUNTER_TALENT_CAP, talentBonuses.counterOnDefendChance));
      const attributeBonus =
        (Math.max(0, player.stats.def) * DEFEND_COUNTER_DEF_WEIGHT)
        + (Math.max(0, player.stats.speed) * DEFEND_COUNTER_SPEED_WEIGHT)
        + (Math.max(0, player.stats.luck) * DEFEND_COUNTER_LUCK_WEIGHT);
      const cardBonus = Math.max(0, player.cardBonuses.counterAttackChanceBonus ?? 0);
      const openingBonus = player.buffs.counterChanceBoostTurns > 0 ? Math.max(0, player.buffs.counterChanceBoost) : 0;
      const classCap = DEFEND_COUNTER_MAX_CHANCE_BY_CLASS[player.classId] ?? 0.3;
      const counterChance = Math.min(
        classCap,
        DEFEND_COUNTER_BASE_CHANCE + talentBonus + attributeBonus + cardBonus + openingBonus,
      );
      const guaranteedCounter = player.buffs.guaranteedCounterTurns > 0;
      if (!guaranteedCounter && Math.random() >= counterChance) {
        return { triggered: false as const, damage: 0, nextEnemy: targetEnemy };
      }

      const counterDamage = Math.max(1, Math.floor(player.stats.atk * DEFEND_COUNTER_DAMAGE_RATIO));
      const remainingEnemyHp = Math.max(0, targetEnemy.stats.hp - counterDamage);
      const enemyAfterCounter = {
        ...targetEnemy,
        stats: {
          ...targetEnemy.stats,
          hp: remainingEnemyHp,
        },
        isDefending: false,
      };

      return {
        nextEnemy: enemyAfterCounter,
        triggered: true as const,
        damage: counterDamage,
      };
    };

    const executeDefensiveCounter = (
      enemyStateBeforeCounter: Enemy,
      counterDamage: number,
      onComplete: (nextEnemyState: Enemy, defeated: boolean) => void,
    ) => {
      window.setTimeout(() => {
        setIsPlayerHit(true);
        setScreenShake(0.12);
        window.setTimeout(() => {
          setIsPlayerHit(false);
          setScreenShake(0);
          setIsPlayerAttacking(true);
          setPlayerAnimationAction('attack');
          playMovementSfx(player.equippedWeapon ? 'weapon' : 'unarmed');

          window.setTimeout(() => {
            setIsPlayerAttacking(false);
            playAttackImpactSfx({
              attackKind: 'physical',
              attackerStyle: player.equippedWeapon ? 'weapon' : 'unarmed',
              defended: false,
              source: 'hero',
            });
            announceCounterAttack('player');
            spawnParticles([2, -0.5, 0], 14, '#f59e0b', 'explode');
            spawnFloatingText(`CONTRA ${counterDamage}`, 'enemy', 'crit');
            addLog(`Contra-ataque defensivo: ${counterDamage} dano!`, 'crit');

            const remainingEnemyHp = Math.max(0, enemyStateBeforeCounter.stats.hp - counterDamage);
            const enemyAfterCounter = {
              ...enemyStateBeforeCounter,
              stats: {
                ...enemyStateBeforeCounter.stats,
                hp: remainingEnemyHp,
              },
              isDefending: false,
            };
            setEnemy(enemyAfterCounter);
            triggerEnemyAnimationAction(remainingEnemyHp <= 0 ? 'death' : 'hit', remainingEnemyHp <= 0 ? 900 : 360);

            window.setTimeout(() => {
              setPlayerAnimationAction('idle');
              onComplete(enemyAfterCounter, remainingEnemyHp <= 0);
            }, 420);
          }, 380);
        }, 160);
      }, 40);
    };

    const useDefendAction = (_reasonLabel: string, activeEnemyImpulse: number) => {
    battleSfx.play('defense_use', { source: 'enemy' });
      const recoveredMp = enemyUsesManaSkills
        ? Math.max(1, Math.min(simulatedEnemy.manaRegenOnDefend, simulatedEnemy.stats.maxMp - simulatedEnemy.stats.mp))
        : 0;
      const nextEnemy = {
        ...simulatedEnemy,
        lastAction: 'defend' as const,
        isDefending: true,
        impulseGuardLevel: activeEnemyImpulse,
        stats: {
          ...simulatedEnemy.stats,
          mp: Math.min(simulatedEnemy.stats.maxMp, simulatedEnemy.stats.mp + recoveredMp),
        },
      };
      if (recoveredMp > 0) {
        addLog(`+${recoveredMp} Mana`, 'heal');
        spawnFloatingText(`+${recoveredMp} Mana`, 'enemy', 'heal');
      }
      spawnParticles([2, -0.5, 0], 12, '#3b82f6', 'spark');
      finishEnemyActionToPlayerTurn(nextEnemy);
    };

    if (executedIntent === 'item' && lowHp && hasPotion) {
      const healAmount = Math.max(1, simulatedEnemy.potionHealValue);
      const nextEnemy = {
        ...simulatedEnemy,
        lastAction: 'item' as const,
        potionCharges: simulatedEnemy.potionCharges - 1,
        stats: {
          ...simulatedEnemy.stats,
          hp: Math.min(simulatedEnemy.stats.maxHp, simulatedEnemy.stats.hp + healAmount),
        },
      };
      setIsEnemyAttacking(false);
      setEnemyExecutionAnimationId(COMBAT_SPRITE_ANIMATION_DEFAULTS.unarmedExecutionAnimationId);
      setEnemyExecutionAnimationTintColor(null);
      triggerEnemyAnimationAction('item', 900);
      window.setTimeout(() => {
        addLog(`${simulatedEnemy.name} usou pocao e curou ${healAmount} HP.`, 'heal');
        battleSfx.play('heal');
        spawnFloatingText(getEnemyItemUseLabel(healAmount), 'enemy', 'item');
        spawnFloatingText(`+${healAmount}`, 'enemy', 'heal');
        spawnParticles([2, -0.5, 0], 20, '#22c55e', 'heal');
        window.setTimeout(() => {
          finishEnemyActionToPlayerTurn(nextEnemy);
        }, ENEMY_ACTION_READ_DELAY_MS);
      }, 520);
      return;
    }

    if (executedIntent === 'item' && canAttemptSteal) {
      setIsEnemyAttacking(true);
      playMovementSfx(simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed');
      triggerEnemyAnimationAction('attack', 800);
      window.setTimeout(() => {
        const chanceFinal = clamp(
          ENEMY_STEAL_BASE_CHANCE
            + (ENEMY_STEAL_SPEED_WEIGHT * (simulatedEnemy.stats.speed - player.stats.speed))
            + (ENEMY_STEAL_LUCK_WEIGHT * (simulatedEnemy.stats.luck - player.stats.luck)),
          0.1,
          0.75,
        );
        let nextEnemy = {
          ...simulatedEnemy,
          lastAction: 'steal' as const,
          stealAttemptsUsed: simulatedEnemy.stealAttemptsUsed + 1,
          lastStealTurn: simulatedEnemy.aiTurnCounter,
        };

        if (Math.random() >= chanceFinal) {
          spawnFloatingText('Falha ao saquear', 'enemy', 'buff');
          addLog(`${simulatedEnemy.name} falhou ao saquear.`, 'info');
          window.setTimeout(() => {
            setIsEnemyAttacking(false);
            finishEnemyActionToPlayerTurn(nextEnemy);
          }, ENEMY_ACTION_READ_DELAY_MS);
          return;
        }

        const preferGold = player.gold > 0 && (stealableInventoryIds.length === 0 || Math.random() < 0.55);
        if (preferGold) {
          const attemptedGold = Math.max(1, Math.floor(player.gold * (0.12 + (simulatedEnemy.aiProfile.tier * 0.012))));
          const remainingStealCap = Math.max(0, nextEnemy.maxGoldStealPerBattle - nextEnemy.stolenGoldTotal);
          const stolenGold = Math.min(attemptedGold, player.gold, remainingStealCap);
          if (stolenGold > 0) {
            setPlayer((prev) => ({ ...prev, gold: Math.max(0, prev.gold - stolenGold) }));
            nextEnemy = {
              ...nextEnemy,
              stolenGoldTotal: nextEnemy.stolenGoldTotal + stolenGold,
            };
            battleSfx.play('enemy_steal_success');
            spawnFloatingText(`💰 ${stolenGold} Ouro Saqueado`, 'player', 'item');
            addLog(`${simulatedEnemy.name} saqueou ${stolenGold} de ouro.`, 'crit');
            window.setTimeout(() => {
              setIsEnemyAttacking(false);
              finishEnemyActionToPlayerTurn(nextEnemy);
            }, ENEMY_ACTION_READ_DELAY_LONG_MS);
            return;
          }
        }

        if (stealableInventoryIds.length > 0) {
          const targetItemId = stealableInventoryIds[Math.floor(Math.random() * stealableInventoryIds.length)];
          const stolenItem = ALL_ITEMS.find((entry) => entry.id === targetItemId);
          setPlayer((prev) => {
            const qty = prev.inventory[targetItemId] || 0;
            if (qty <= 0) return prev;
            return { ...prev, inventory: { ...prev.inventory, [targetItemId]: qty - 1 } };
          });
          nextEnemy = {
            ...nextEnemy,
            stolenItems: [...nextEnemy.stolenItems, targetItemId],
          };
          battleSfx.play('enemy_steal_success');
          spawnFloatingText(`${stolenItem?.icon ?? '🎒'} ${stolenItem?.name ?? 'Item'} Saqueado`, 'player', 'item');
          addLog(`${simulatedEnemy.name} saqueou ${stolenItem?.name ?? 'um item'}!`, 'crit');
          window.setTimeout(() => {
            setIsEnemyAttacking(false);
            finishEnemyActionToPlayerTurn(nextEnemy);
          }, ENEMY_ACTION_READ_DELAY_LONG_MS);
          return;
        }

        spawnFloatingText('Falha ao saquear', 'enemy', 'buff');
        addLog(`${simulatedEnemy.name} nao conseguiu saquear.`, 'info');
        window.setTimeout(() => {
          setIsEnemyAttacking(false);
          finishEnemyActionToPlayerTurn(nextEnemy);
        }, ENEMY_ACTION_READ_DELAY_MS);
      }, 420);
      return;
    }

    if (executedIntent === 'impulse' && simulatedEnemy.impulso < 3) {
      const nextImpulse = clampImpulse(simulatedEnemy.impulso + 1);
      const nextEnemy = {
        ...simulatedEnemy,
        lastAction: 'none' as const,
        impulso: nextImpulse,
      };
      battleSfx.play('defense_use', { source: 'enemy' });
      triggerEnemyAnimationAction('defend', 760);
      playImpulseVisual('enemy', nextImpulse, 'IMPULSO');
      addLog(`${simulatedEnemy.name} carregou impulso.`, 'buff');
      window.setTimeout(() => {
        finishEnemyActionToPlayerTurn(nextEnemy);
      }, ENEMY_ACTION_READ_DELAY_MS);
      return;
    }

    if (executedIntent === 'skill' && usableSkills.length > 0) {
      const activeEnemyImpulse = consumeEnemyImpulseForAction('habilidade');
      const chosenSkill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
      const effectiveSkillManaCost = activeEnemyImpulse >= 1 ? Math.max(1, Math.floor(chosenSkill.manaCost * (1 - IMPULSE_MANA_DISCOUNT))) : chosenSkill.manaCost;
      const skillEffectMultiplier = activeEnemyImpulse >= 2 ? (1 + IMPULSE_SKILL_EFFECT_BONUS) : 1;
      const nextSkillSet = simulatedEnemy.skillSet.map((skill) => (
        skill.id === chosenSkill.id
          ? { ...skill, currentCooldown: skill.cooldown }
          : skill
      ));
      simulatedEnemy = {
        ...simulatedEnemy,
        lastAction: 'skill',
        skillSet: nextSkillSet,
        stats: {
          ...simulatedEnemy.stats,
          mp: Math.max(0, simulatedEnemy.stats.mp - effectiveSkillManaCost),
        },
      };

      const enemySkillAnimationType: 'cura_status' | 'ataque' | 'magia' = chosenSkill.effect === 'damage'
        ? (chosenSkill.attackKind === 'magic' ? 'magia' : 'ataque')
        : 'cura_status';
      const enemyShouldLungeForSkill = enemySkillAnimationType === 'ataque';
      setIsEnemyAttacking(enemyShouldLungeForSkill);
      if (enemyShouldLungeForSkill) {
        playMovementSfx(chosenSkill.attackKind === 'magic' ? 'unarmed' : (simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed'));
      }
      triggerEnemyAnimationAction('skill', 760);
      const castColor = getSkillCastColor(chosenSkill);
      spawnFloatingText(chosenSkill.name.toUpperCase(), 'enemy', 'skill');
      spawnParticles([2, -0.5, 0], 16, castColor, 'spark');
      window.setTimeout(() => {
        if (chosenSkill.effect === 'heal') {
          const healAmount = Math.max(1, Math.floor(simulatedEnemy.stats.maxHp * (chosenSkill.healMultiplier ?? 0.2) * skillEffectMultiplier));
          const healedEnemy = {
            ...simulatedEnemy,
            stats: {
              ...simulatedEnemy.stats,
              hp: Math.min(simulatedEnemy.stats.maxHp, simulatedEnemy.stats.hp + healAmount),
            },
          };
          addLog(`${simulatedEnemy.name} usou ${chosenSkill.name} e curou ${healAmount} HP.`, 'heal');
          battleSfx.play('heal');
          spawnFloatingText(`+${healAmount} HP`, 'enemy', 'heal');
          spawnParticles([2, -0.5, 0], 22, '#34d399', 'heal');
          window.setTimeout(() => {
            setIsEnemyAttacking(false);
            finishEnemyActionToPlayerTurn(healedEnemy);
          }, ENEMY_ACTION_READ_DELAY_MS);
          return;
        }

        if (chosenSkill.effect === 'buff_atk' || chosenSkill.effect === 'buff_def') {
          const buffModifier = chosenSkill.buffModifier ?? 0.18;
          const buffDuration = chosenSkill.buffDuration ?? 2;
          const buffedEnemy = {
            ...simulatedEnemy,
            combatBuffs: {
              atkMod: chosenSkill.effect === 'buff_atk'
                ? Math.max(simulatedEnemy.combatBuffs.atkMod, buffModifier * skillEffectMultiplier)
                : simulatedEnemy.combatBuffs.atkMod,
              defMod: chosenSkill.effect === 'buff_def'
                ? Math.max(simulatedEnemy.combatBuffs.defMod, buffModifier * skillEffectMultiplier)
                : simulatedEnemy.combatBuffs.defMod,
              turns: Math.max(simulatedEnemy.combatBuffs.turns, buffDuration),
            },
          };
          const buffText = chosenSkill.effect === 'buff_atk' ? 'ATAQUE UP!' : 'DEFESA UP!';
          addLog(`${simulatedEnemy.name} usou ${chosenSkill.name} (${buffText}).`, 'buff');
          spawnFloatingText(buffText, 'enemy', 'buff');
          spawnParticles([2, -0.5, 0], 18, chosenSkill.effect === 'buff_atk' ? '#f97316' : '#60a5fa', 'spark');
          window.setTimeout(() => {
            setIsEnemyAttacking(false);
            finishEnemyActionToPlayerTurn(buffedEnemy);
          }, ENEMY_ACTION_READ_DELAY_MS);
          return;
        }

        const skillAttackResult = calculateDamage({
          attackerAtk: getEnemyAtkWithBuff(simulatedEnemy),
          defenderDef: player.stats.def,
          attackerSpeed: simulatedEnemy.stats.speed,
          defenderSpeed: player.stats.speed,
          defenderHasPerfectEvade: player.buffs.perfectEvadeTurns > 0,
          multiplier: chosenSkill.damageMultiplier * getEnemyDamagePressure(simulatedEnemy, 'skill') * skillEffectMultiplier,
          luck: simulatedEnemy.stats.luck,
          attackKind: chosenSkill.attackKind,
          defenderIsDefending: defendingActive,
          defenderBuffs: player.buffs,
          applyDefenseBuff: true,
          critChanceBonus: simulatedEnemy.aiProfile.critChanceBonus,
          critDamageBonus: simulatedEnemy.aiProfile.critDamageBonus,
          damageReduction: talentBonuses.damageReduction,
          defendMitigationBonus: talentBonuses.defendMitigation,
        });

        if (skillAttackResult.evaded) {
          battleSfx.play('evade');
          addLog(`Voce desviou de ${chosenSkill.name}!`, 'evade');
          spawnFloatingText('DESVIO!', 'player', 'buff');
          finishEnemyActionToPlayerTurn(simulatedEnemy);
          setIsEnemyAttacking(false);
          return;
        }

        const defendedDamage = defendingActive ? Math.floor(skillAttackResult.damage * 0.5) : skillAttackResult.damage;
        const afterImpulseMitigation = extraImpulseMitigationActive ? Math.floor(defendedDamage * (1 - IMPULSE_DEFENSE_EXTRA_MITIGATION)) : defendedDamage;
        const finalDamage = perfectGuardActive ? 0 : afterImpulseMitigation;
        const mitigatedDamage = defendingActive ? Math.max(0, skillAttackResult.damage - finalDamage) : 0;
        const remainingHpAfterHit = Math.max(0, player.stats.hp - finalDamage);
        playAttackImpactSfx({
          attackKind: chosenSkill.attackKind,
          attackerStyle: chosenSkill.attackKind === 'magic' ? 'unarmed' : (simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed'),
          defended: defendingActive,
          source: 'enemy',
        });
        if (remainingHpAfterHit <= 0) {
          battleSfx.play('death');
        }
        const hitAnimationAction: PlayerAnimationAction = remainingHpAfterHit <= 0
          ? 'death'
          : defendingActive
            ? 'defend-hit'
            : skillAttackResult.isCrit
              ? 'critical-hit'
              : 'hit';

        spawnParticles([-2, -1, 0], 14, castColor, 'explode');
        spawnParticles([-2, -1, 0], 10, chosenSkill.attackKind === 'magic' ? '#7dd3fc' : '#fb7185', 'spark');
        spawnFloatingText(skillAttackResult.isCrit ? `CRIT ${finalDamage}` : finalDamage, 'player', skillAttackResult.isCrit ? 'crit' : 'damage');
        if (defendingActive) {
          setEnemyImpactAnimationId(SPRITE_ANIMATION_IDS.hitBlock);
          setEnemyImpactAnimationTintColor(null);
        } else {
          setEnemyImpactAnimationId(null);
          setEnemyImpactAnimationTintColor(null);
        }
        setScreenShake(skillAttackResult.isCrit ? 0.34 : 0.22);
        setIsPlayerHit(true);
        setIsPlayerCritHit(skillAttackResult.isCrit);
        window.setTimeout(() => {
          setScreenShake(0);
          setIsPlayerHit(false);
          setIsPlayerCritHit(false);
        }, 220);

        if (mitigatedDamage > 0) {
          addLog(`Defesa mitigou ${mitigatedDamage} dano.`, 'buff');
        }

        let pendingCounter: { damage: number; enemyStateBeforeCounter: Enemy } | null = null;
        setPlayer((prev) => ({
          ...prev,
          buffs: {
            ...prev.buffs,
            riposteTurns: defendingActive ? 1 : prev.buffs.riposteTurns,
            riposteArmed: defendingActive ? true : prev.buffs.riposteArmed,
          },
          isDefending: false,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) },
        }));
        if (defendingActive && remainingHpAfterHit > 0) {
          const counterResult = rollDefensiveCounter(simulatedEnemy);
          if (counterResult.triggered) {
            pendingCounter = {
              damage: counterResult.damage,
              enemyStateBeforeCounter: simulatedEnemy,
            };
          }
        }
        setPlayerAnimationAction(hitAnimationAction);
        addLog(`${simulatedEnemy.name} usou ${chosenSkill.name}: ${finalDamage} dano!${skillAttackResult.isCrit ? ' CRITICO!' : ''}`, skillAttackResult.isCrit ? 'crit' : 'damage');

        window.setTimeout(() => {
          setIsEnemyAttacking(false);
          if (remainingHpAfterHit <= 0) {
            onPlayerDefeat?.();
            window.setTimeout(() => {
              if (dungeonRun) {
                setKillCount(0);
                setPlayer((prev) => ({
                  ...clonePlayer(dungeonRun.entrySnapshot),
                  xp: prev.xp,
                  level: prev.level,
                  xpToNext: prev.xpToNext,
                  talentPoints: prev.talentPoints,
                }));
                setDungeonResult({
                  outcome: 'defeat',
                  rewards: dungeonRun.rewards,
                  reason: enemy.isBoss ? 'O chefao final da dungeon venceu voce. O espolio acumulado foi perdido, mas o XP obtido nas vitorias foi mantido.' : 'Voce caiu antes de terminar a dungeon. O espolio acumulado foi perdido, mas o XP obtido nas vitorias foi mantido.',
                });
                setDungeonRun(null);
                setEnemy(null);
                setEnemyIntentPreview(null);
                setGameState(GameState.DUNGEON_RESULT);
              } else if (enemy.isBoss) {
                setKillCount(0);
                setEnemyIntentPreview(null);
                setGameState(GameState.GAME_OVER);
              } else {
                setEnemyIntentPreview(null);
                setGameState(GameState.GAME_OVER);
              }
            }, 900);
          } else {
            if (pendingCounter) {
              window.setTimeout(() => {
                executeDefensiveCounter(
                  pendingCounter.enemyStateBeforeCounter,
                  pendingCounter.damage,
                  (enemyAfterCounter, enemyDefeatedByCounter) => {
                    if (enemyDefeatedByCounter) {
                      void handleVictoryRef.current(900);
                      return;
                    }
                    finishEnemyActionToPlayerTurn(enemyAfterCounter);
                  },
                );
              }, 150);
              return;
            }
            finishEnemyActionToPlayerTurn(simulatedEnemy);
          }
        }, ENEMY_ACTION_READ_DELAY_MS);
      }, 420);
      return;
    }

    if (executedIntent === 'defend' && canDefend) {
      const activeEnemyImpulse = consumeEnemyImpulseForAction('defesa');
      useDefendAction('segurar a ofensiva', activeEnemyImpulse);
      return;
    }

    const activeEnemyImpulse = consumeEnemyImpulseForAction('ataque');
    simulatedEnemy = {
      ...simulatedEnemy,
      lastAction: 'attack',
    };
    setIsEnemyAttacking(true);
    playMovementSfx(simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed');
    triggerEnemyAnimationAction('attack', 750);

    window.setTimeout(() => {
      const attackResult = calculateDamage({
        attackerAtk: getEnemyAtkWithBuff(simulatedEnemy),
        defenderDef: player.stats.def,
        attackerSpeed: simulatedEnemy.stats.speed,
        defenderSpeed: player.stats.speed,
        defenderHasPerfectEvade: player.buffs.perfectEvadeTurns > 0,
        multiplier: getEnemyDamagePressure(simulatedEnemy, 'basic') * (activeEnemyImpulse > 0 ? (1 + IMPULSE_ATTACK_DAMAGE_BONUS) : 1),
        luck: simulatedEnemy.stats.luck,
        attackKind: 'physical',
        defenderIsDefending: defendingActive,
        defenderBuffs: player.buffs,
        applyDefenseBuff: true,
        critChanceBonus: simulatedEnemy.aiProfile.critChanceBonus,
        critDamageBonus: simulatedEnemy.aiProfile.critDamageBonus,
        damageReduction: talentBonuses.damageReduction,
        defendMitigationBonus: talentBonuses.defendMitigation,
        defenderDefenseIgnoreRatio: activeEnemyImpulse >= 2 ? IMPULSE_DEF_IGNORE_RATIO : 0,
        forceCrit: activeEnemyImpulse >= 3,
      });

      if (attackResult.evaded) {
        battleSfx.play('evade');
        spawnFloatingText('DESVIO!', 'player', 'buff');
        addLog(`Voce desviou do ataque de ${simulatedEnemy.name}!`, 'evade');
        setPlayer((prev) => ({ ...prev, isDefending: false }));
        setPlayerAnimationAction('evade');
        window.setTimeout(() => {
          setIsEnemyAttacking(false);
          finishEnemyActionToPlayerTurn(simulatedEnemy);
        }, 600);
        return;
      }

      const defendedDamage = defendingActive ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
      const afterImpulseMitigation = extraImpulseMitigationActive ? Math.floor(defendedDamage * (1 - IMPULSE_DEFENSE_EXTRA_MITIGATION)) : defendedDamage;
      const finalDamage = perfectGuardActive ? 0 : afterImpulseMitigation;
      const mitigatedDamage = defendingActive ? Math.max(0, attackResult.damage - finalDamage) : 0;
      const remainingHpAfterHit = Math.max(0, player.stats.hp - finalDamage);
      playAttackImpactSfx({
        attackKind: 'physical',
        attackerStyle: simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed',
        defended: defendingActive,
        source: 'enemy',
      });
      if (remainingHpAfterHit <= 0) {
        battleSfx.play('death');
      }
      const hitAnimationAction: PlayerAnimationAction = remainingHpAfterHit <= 0
        ? 'death'
        : defendingActive
          ? 'defend-hit'
          : attackResult.isCrit
            ? 'critical-hit'
            : 'hit';

      spawnParticles([-2, -1, 0], 5, '#dc2626', 'spark');
      spawnFloatingText(finalDamage, 'player', attackResult.isCrit ? 'crit' : 'damage');
      if (defendingActive) {
        setEnemyImpactAnimationId(SPRITE_ANIMATION_IDS.hitBlock);
        setEnemyImpactAnimationTintColor(null);
      } else {
        setEnemyImpactAnimationId(null);
        setEnemyImpactAnimationTintColor(null);
      }
      setScreenShake(0.22);
      setIsPlayerHit(true);
      setIsPlayerCritHit(attackResult.isCrit);
      window.setTimeout(() => {
        setScreenShake(0);
        setIsPlayerHit(false);
        setIsPlayerCritHit(false);
      }, 200);

      if (mitigatedDamage > 0) {
        addLog(`Defesa mitigou ${mitigatedDamage} dano.`, 'buff');
      }

      let pendingCounter: { damage: number; enemyStateBeforeCounter: Enemy } | null = null;
      setPlayer((prev) => {
        const nextBuffs = { ...prev.buffs };
        if (defendingActive) {
          nextBuffs.riposteTurns = 1;
          nextBuffs.riposteArmed = true;
        }
        return {
          ...prev,
          buffs: nextBuffs,
          isDefending: false,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) },
        };
      });
      if (defendingActive && remainingHpAfterHit > 0) {
        const counterResult = rollDefensiveCounter(simulatedEnemy);
        if (counterResult.triggered) {
          pendingCounter = {
            damage: counterResult.damage,
            enemyStateBeforeCounter: simulatedEnemy,
          };
        }
      }

      addLog(`${simulatedEnemy.name} atacou: ${finalDamage} dano!${defendingActive ? ' (Defendido)' : ''}${attackResult.isCrit ? ' CRITICO!' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
      setPlayerAnimationAction(hitAnimationAction);

      window.setTimeout(() => {
        setIsEnemyAttacking(false);
        if (remainingHpAfterHit <= 0) {
          onPlayerDefeat?.();
          window.setTimeout(() => {
            if (dungeonRun) {
              setKillCount(0);
              setPlayer((prev) => ({
                ...clonePlayer(dungeonRun.entrySnapshot),
                xp: prev.xp,
                level: prev.level,
                xpToNext: prev.xpToNext,
                talentPoints: prev.talentPoints,
              }));
              setDungeonResult({
                outcome: 'defeat',
                rewards: dungeonRun.rewards,
                reason: enemy.isBoss ? 'O chefao final da dungeon venceu voce. O espolio acumulado foi perdido, mas o XP obtido nas vitorias foi mantido.' : 'Voce caiu antes de terminar a dungeon. O espolio acumulado foi perdido, mas o XP obtido nas vitorias foi mantido.',
              });
              setDungeonRun(null);
              setEnemy(null);
              setEnemyIntentPreview(null);
              setGameState(GameState.DUNGEON_RESULT);
            } else if (enemy.isBoss) {
              setKillCount(0);
              setEnemyIntentPreview(null);
              setGameState(GameState.GAME_OVER);
            } else {
              setEnemyIntentPreview(null);
              setGameState(GameState.GAME_OVER);
            }
          }, 900);
        } else {
          if (pendingCounter) {
            window.setTimeout(() => {
              executeDefensiveCounter(
                pendingCounter.enemyStateBeforeCounter,
                pendingCounter.damage,
                (enemyAfterCounter, enemyDefeatedByCounter) => {
                  if (enemyDefeatedByCounter) {
                    void handleVictoryRef.current(900);
                    return;
                  }
                  finishEnemyActionToPlayerTurn(enemyAfterCounter);
                },
              );
            }, 500);
            return;
          }
          finishEnemyActionToPlayerTurn(simulatedEnemy);
        }
      }, 350);
    }, 400);
  }, [
    addLog,
    announceCounterAttack,
    clonePlayer,
    dungeonRun,
    enemy,
    enemyIntentPreview,
    gameState,
    handleVictory,
    player,
    setDungeonResult,
    setDungeonRun,
    setEnemy,
    setEnemyExecutionAnimationId,
    setGameState,
    setIsEnemyAttacking,
    setIsPlayerCritHit,
    setIsPlayerHit,
    setPlayer,
    setPlayerAnimationAction,
    setScreenShake,
    setTurnState,
    playImpulseVisual,
    spawnFloatingText,
    spawnParticles,
    triggerEnemyAnimationAction,
  ]);

  return {
    handleChargeImpulse,
    handleAbsorbImpulse,
    handlePlayerAttack,
    handlePlayerDefense,
    handleSkill,
    handleUseItem,
    handleEnemyTurn,
  };
};

