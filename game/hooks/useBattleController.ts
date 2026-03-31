import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ALL_ITEMS } from '../../constants';
import {
  applyStatusEffect,
  calculateDamage,
  consumeTurnBuffs,
  createStatusEffect,
  tickStatusEffects,
} from '../mechanics/combat';
import { getTalentBonuses } from '../mechanics/classProgression';
import { battleSfx } from '../audio/sfx';
import { BattleLog, DungeonResult, DungeonRunState, Enemy, GameState, Player, PlayerAnimationAction, Skill, TurnState } from '../../types';

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
  spawnFloatingText: (value: string | number, target: 'player' | 'enemy', type: 'damage' | 'heal' | 'crit' | 'buff' | 'skill' | 'item') => void;
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
const DEFEND_COUNTER_MAX_CHANCE = 0.3;
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
  if (healAmount >= 220) return '🌟 Ambrosia Dourada';
  if (healAmount >= 100) return '💖 Elixir Rubro';
  if (healAmount >= 50) return '❤ Pocao de Vida';
  return '🧪 Pocao Menor';
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
  onPlayerDefeat,
}: UseBattleControllerParams) => {
  const handleVictoryRef = useRef(handleVictory);
  const lastPlayerActionRef = useRef<'attack' | 'defend' | 'skill' | 'item' | null>(null);

  const announceCounterAttack = useCallback((attacker: 'player' | 'enemy') => {
    spawnFloatingText('⚔ CONTRA-ATAQUE!', attacker, 'damage');
  }, [spawnFloatingText]);

  useEffect(() => {
    handleVictoryRef.current = handleVictory;
  }, [handleVictory]);

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
      spawnFloatingText(`+${lifeSteal} HP`, 'player', 'heal');
      addLog(`Roubo de vida recuperou ${lifeSteal} HP.`, 'heal');
    }

    if (manaGain > 0) {
      spawnFloatingText(`+${manaGain} Mana`, 'player', 'heal');
      addLog(`Fluxo da constelacao restaurou ${manaGain} Mana.`, 'heal');
    }

    if (resourceGain > 0 && player.classResource.max > 0) {
      spawnFloatingText(`+${resourceGain} ${player.classResource.name}`, 'player', 'buff');
    }
  }, [addLog, player.classResource.max, player.classResource.name, setPlayer, spawnFloatingText]);

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

  const handlePlayerAttack = useCallback(() => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;
    lastPlayerActionRef.current = 'attack';

    const talentBonuses = getTalentBonuses(player);
    const doubleAttackActive = player.buffs.doubleAttackTurns > 0;
    const riposteActive = Boolean(player.buffs.riposteArmed);
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
      spawnFloatingText('CONTRA ATIVO!', 'player', 'buff');
      addLog('Contra ativado: o proximo golpe recebeu bonus ofensivo.', 'buff');
    }

    const resolveStrike = (remainingHp: number, isFirstStrike: boolean) => {
      const riposteMultiplier = riposteActive && isFirstStrike ? RIPOSTE_DAMAGE_MULTIPLIER : 1;
      const attackResult = calculateDamage({
        attackerAtk: player.stats.atk,
        defenderDef: getEnemyDefWithBuff(enemy),
        attackerSpeed: player.stats.speed,
        defenderSpeed: enemy.stats.speed,
        multiplier: getBossDamageMultiplier() * (1 + talentBonuses.physicalDamage + getMarkedBonus(enemy.statusEffects, talentBonuses.markedDamage)) * riposteMultiplier,
        luck: player.stats.luck,
        attackKind: 'physical',
        defenderIsDefending: isFirstStrike ? enemy.isDefending : false,
        attackerBuffs: player.buffs,
        applyAttackBuff: true,
        critChanceBonus: talentBonuses.critChance,
        critDamageBonus: talentBonuses.critDamage,
      });

      if (attackResult.evaded) {
        battleSfx.play('evade');
        spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
        addLog(isFirstStrike ? `${enemy.name} desviou do ataque!` : `${enemy.name} desviou do segundo golpe!`, 'evade');
        triggerEnemyAnimationAction('evade', 520);
        return { remainingHp, defeated: false, evaded: true };
      }

      const appliedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
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
        void handleVictoryRef.current(900);
        return;
      }

      const resolvedIdleDelay = firstStrike.evaded ? Math.max(idleDelay, 570) : idleDelay;
      if (!doubleAttackActive) {
        window.setTimeout(() => {
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, resolvedIdleDelay);
        return;
      }

      addLog('Presa Gemea ativada: segundo golpe imediato!', 'buff');
      window.setTimeout(() => {
        const secondStrike = resolveStrike(firstStrike.remainingHp, false);
        if (secondStrike.defeated) {
          void handleVictoryRef.current(900);
          return;
        }
        window.setTimeout(() => {
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
    spawnFloatingText(`+${manaRecovered} Mana`, 'player', 'heal');
    spawnParticles([-2, -1, 0], 10, '#3b82f6', 'spark');

    window.setTimeout(() => {
      setTurnState(TurnState.ENEMY_TURN);
    }, 600);
  }, [
    addLog,
    enemy,
    player,
    setPlayer,
    setPlayerAnimationAction,
    setTurnState,
    spawnFloatingText,
    spawnParticles,
    turnState,
  ]);

  const handleSkill = useCallback((skill: Skill) => {
    const requiredResource = skill.resourceEffect?.cost ?? 0;
    if (!enemy || turnState !== TurnState.PLAYER_INPUT || player.stats.mp < skill.manaCost || player.classResource.value < requiredResource) return;
    lastPlayerActionRef.current = 'skill';

    const talentBonuses = getTalentBonuses(player);
    const riposteActive = skill.type !== 'heal' && Boolean(player.buffs.riposteArmed);
    const visual = getSkillVisualConfig(skill);
    const impactColor = skill.trailColor ?? visual.color;
    const resourceSpent = skill.resourceEffect?.consumeAll ? player.classResource.value : requiredResource;

    setTurnState(TurnState.PLAYER_ANIMATION);
    setPlayerAnimationAction(skill.type === 'heal' ? 'heal' : skill.type === 'magic' ? 'skill' : 'attack');
    setEnemyAnimationAction(enemy.isDefending ? 'defend' : 'battle-idle');
    setPlayer((prev) => ({
      ...prev,
      stats: { ...prev.stats, mp: prev.stats.mp - skill.manaCost },
      classResource: {
        ...prev.classResource,
        value: Math.max(0, prev.classResource.value - resourceSpent),
      },
      buffs: riposteActive
        ? {
          ...prev.buffs,
          riposteArmed: false,
          riposteTurns: 0,
        }
        : prev.buffs,
    }));
    spawnFloatingText(skill.name.toUpperCase(), 'player', 'skill');
    if (riposteActive) {
      spawnFloatingText('CONTRA ATIVO!', 'player', 'buff');
      addLog('Contra ativado: a proxima habilidade ofensiva recebeu bonus.', 'buff');
    }

    if (resourceSpent > 0) {
      spawnFloatingText(`-${resourceSpent} ${player.classResource.name}`, 'player', 'buff');
      spawnParticles([-2, -1, 0], 14, player.classResource.color, 'spark');
      addLog(`${skill.name} consumiu ${resourceSpent} ${player.classResource.name}.`, 'info');
    }

    if (skill.type === 'heal') {
      const healPower = 1 + talentBonuses.healPower;
      const healAmount = getHealingValue(Math.floor(player.stats.maxHp * skill.damageMult * healPower));
      const resourceGain = (skill.resourceEffect?.gain ?? 0) + Math.max(0, Math.floor(talentBonuses.resourceOnSkill));

      setPlayer((prev) => {
        const nextBuffs = { ...prev.buffs };
        if (skill.buffEffect?.target === 'player') {
          if (skill.buffEffect.kind === 'atk') {
            nextBuffs.atkMod = Math.max(nextBuffs.atkMod, skill.buffEffect.modifier);
            nextBuffs.atkTurns = Math.max(nextBuffs.atkTurns, skill.buffEffect.duration);
          }
          if (skill.buffEffect.kind === 'def') {
            nextBuffs.defMod = Math.max(nextBuffs.defMod, skill.buffEffect.modifier);
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

      if (resourceGain > 0 && player.classResource.max > 0) {
        spawnFloatingText(`+${resourceGain} ${player.classResource.name}`, 'player', 'buff');
      }

      spawnParticles([-2, -1, 0], visual.particleCount + 14, visual.color, 'heal');
      spawnFloatingText(`+${healAmount}`, 'player', 'heal');
      battleSfx.play('heal');
      addLog(`${skill.name}: curou ${healAmount} HP!`, 'heal');

      if (skill.buffEffect?.target === 'player') {
        spawnFloatingText(skill.buffEffect.kind === 'atk' ? 'ATAQUE UP!' : 'DEFESA UP!', 'player', 'buff');
        addLog(`${skill.name} fortaleceu ${skill.buffEffect.kind === 'atk' ? 'o ataque' : 'a defesa'} por ${skill.buffEffect.duration} turnos.`, 'buff');
      }

      window.setTimeout(() => {
        setPlayerAnimationAction('idle');
        setTurnState(TurnState.ENEMY_TURN);
      }, 1500);
      return;
    }

    setIsPlayerAttacking(true);
    playMovementSfx(skill.type === 'magic' ? 'unarmed' : (player.equippedWeapon ? 'weapon' : 'unarmed'));
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
          multiplier: (skill.damageMult + resourceBurst) * getBossDamageMultiplier() * (1 + schoolBonus + statusBonus) * riposteMultiplier,
          luck: player.stats.luck,
          attackKind: skill.type === 'magic' ? 'magic' : 'physical',
          defenderIsDefending: isFirstStrike ? enemy.isDefending : false,
          attackerBuffs: player.buffs,
          applyAttackBuff: true,
          critChanceBonus: talentBonuses.critChance,
          critDamageBonus: talentBonuses.critDamage,
        });

        if (attackResult.evaded) {
          battleSfx.play('evade');
          spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
          addLog(isFirstStrike ? `${enemy.name} desviou de ${skill.name}!` : `${enemy.name} desviou da repeticao de ${skill.name}!`, 'evade');
          triggerEnemyAnimationAction('evade', 520);
          return { remainingHp, defeated: false };
        }

        const appliedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
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
        void handleVictoryRef.current(900);
        return;
      }

      if (!doubleAttackActive) {
        window.setTimeout(() => {
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, 800);
        return;
      }

      addLog(`Presa Gemea repetiu ${skill.name}!`, 'buff');
      window.setTimeout(() => {
        const secondStrike = resolveSkillStrike(firstStrike.remainingHp, false);
        if (secondStrike.defeated) {
          void handleVictoryRef.current(900);
          return;
        }
        window.setTimeout(() => {
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.ENEMY_TURN);
        }, 700);
      }, 260);
    }, visual.castDelay);
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
      spawnFloatingText(`${item.icon} ${item.name}`, 'player', 'item');
    }

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
      } else if (item.id === 'pot_alc_phantom_veil') {
        newBuffs.perfectEvadeTurns = Math.max(newBuffs.perfectEvadeTurns, item.duration || 4);
      } else if (item.id === 'pot_alc_twin_fang') {
        newBuffs.doubleAttackTurns = Math.max(newBuffs.doubleAttackTurns, item.duration || 6);
      }

      return { ...prev, inventory: newInv, stats: { ...prev.stats, hp: newHp, mp: newMp }, buffs: newBuffs };
    });

    if (gameState === GameState.BATTLE) {
      window.setTimeout(() => {
        setPlayerAnimationAction('idle');
        setTurnState(TurnState.ENEMY_TURN);
      }, 1500);
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

    setTurnState(TurnState.PROCESSING);
    const talentBonuses = getTalentBonuses(player);

    const enemyStatusTick = tickStatusEffects(enemy.statusEffects ?? [], enemy.stats.maxHp, {
      burnBonus: talentBonuses.burnDamage,
      bleedBonus: talentBonuses.bleedDamage,
    });

    let simulatedEnemy: Enemy = {
      ...enemy,
      enemyClassId: enemy.enemyClassId ?? 'knight',
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
      battleSfx.play('death');
      triggerEnemyAnimationAction('death', 900);
      void handleVictoryRef.current(900);
      return;
    }

    const hpRatio = simulatedEnemy.stats.hp / Math.max(1, simulatedEnemy.stats.maxHp);
    const mpRatio = simulatedEnemy.stats.maxMp > 0 ? simulatedEnemy.stats.mp / simulatedEnemy.stats.maxMp : 1;
    const hasPotion = simulatedEnemy.potionCharges > 0;
    const lowHp = hpRatio <= simulatedEnemy.aiProfile.lowHpThreshold;
    const criticalHp = hpRatio <= simulatedEnemy.aiProfile.criticalHpThreshold;
    const lowMana = simulatedEnemy.stats.maxMp > 0 && mpRatio <= simulatedEnemy.aiProfile.lowManaThreshold;
    const playerAggressive = lastPlayerActionRef.current === 'attack' || lastPlayerActionRef.current === 'skill';
    const playerDefensive = lastPlayerActionRef.current === 'defend';
    const canDefend = simulatedEnemy.lastAction !== 'defend';
    const enemyUsesManaSkills = simulatedEnemy.skillSet.some((skill) => skill.manaCost > 0);

    const finishEnemyActionToPlayerTurn = (nextEnemy: Enemy) => {
      const enemyAfterBuffTick = tickEnemyBuffs(nextEnemy);
      setEnemy(enemyAfterBuffTick);
      setPlayer((prev) => {
        const nextBuffs = consumeTurnBuffs(prev.buffs);
        if (!nextBuffs.riposteArmed) {
          nextBuffs.riposteTurns = 0;
        }
        return { ...prev, buffs: nextBuffs, isDefending: false };
      });
      setPlayerAnimationAction('idle');
      setTurnState(TurnState.PLAYER_INPUT);
    };

    const rollDefensiveCounter = (targetEnemy: Enemy) => {
      if (!player.isDefending || player.stats.hp <= 0) {
        return { triggered: false as const, damage: 0, nextEnemy: targetEnemy };
      }

      const talentBonus = Math.max(0, Math.min(DEFEND_COUNTER_TALENT_CAP, talentBonuses.counterOnDefendChance));
      const attributeBonus =
        (Math.max(0, player.stats.def) * DEFEND_COUNTER_DEF_WEIGHT)
        + (Math.max(0, player.stats.speed) * DEFEND_COUNTER_SPEED_WEIGHT)
        + (Math.max(0, player.stats.luck) * DEFEND_COUNTER_LUCK_WEIGHT);
      const counterChance = Math.min(
        DEFEND_COUNTER_MAX_CHANCE,
        DEFEND_COUNTER_BASE_CHANCE + talentBonus + attributeBonus,
      );
      if (Math.random() >= counterChance) {
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
    };

    const useDefendAction = (reasonLabel: string) => {
    battleSfx.play('defense_use', { source: 'enemy' });
      const recoveredMp = enemyUsesManaSkills
        ? Math.max(1, Math.min(simulatedEnemy.manaRegenOnDefend, simulatedEnemy.stats.maxMp - simulatedEnemy.stats.mp))
        : 0;
      const nextEnemy = {
        ...simulatedEnemy,
        lastAction: 'defend' as const,
        isDefending: true,
        stats: {
          ...simulatedEnemy.stats,
          mp: Math.min(simulatedEnemy.stats.maxMp, simulatedEnemy.stats.mp + recoveredMp),
        },
      };
      if (recoveredMp > 0) {
        addLog(`${simulatedEnemy.name} defendeu para ${reasonLabel} e recuperou ${recoveredMp} Mana.`, 'buff');
        spawnFloatingText('DEFESA + MANA', 'enemy', 'buff');
      } else {
        addLog(`${simulatedEnemy.name} defendeu para ${reasonLabel}.`, 'buff');
        spawnFloatingText('DEFESA', 'enemy', 'buff');
      }
      spawnParticles([2, -0.5, 0], 12, '#3b82f6', 'spark');
      finishEnemyActionToPlayerTurn(nextEnemy);
    };

    if (lowHp && hasPotion) {
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

    if (criticalHp && !hasPotion && canDefend) {
      useDefendAction('sobreviver');
      return;
    }

    if (lowMana && canDefend) {
      useDefendAction('recuperar mana');
      return;
    }

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
    const canAttemptSteal = simulatedEnemy.enemyClassId === 'rogue'
      && simulatedEnemy.stealAttemptsUsed < simulatedEnemy.maxStealAttempts
      && simulatedEnemy.lastAction !== 'steal'
      && (simulatedEnemy.aiTurnCounter - simulatedEnemy.lastStealTurn) > 1;
    const stealIntentChance = clamp(0.2 + (simulatedEnemy.aiProfile.tier * 0.025), 0.2, 0.55);
    if (canAttemptSteal && Math.random() < stealIntentChance) {
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

    const usableSkills = simulatedEnemy.skillSet.filter((skill) => (
      skill.currentCooldown <= 0 && simulatedEnemy.stats.mp >= skill.manaCost
    ));

    const extraSkillBias = playerDefensive ? 0.15 : 0;
    const classSkillBias = ENEMY_CLASS_SKILL_BIAS[simulatedEnemy.enemyClassId] ?? 0.06;
    const skillChance = Math.min(0.9, 0.2 + (simulatedEnemy.aiProfile.tier * 0.05) + extraSkillBias + classSkillBias);
    const shouldUseSkill = usableSkills.length > 0 && Math.random() < skillChance;

    if (shouldUseSkill) {
      const chosenSkill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
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
          mp: simulatedEnemy.stats.mp - chosenSkill.manaCost,
        },
      };

      setIsEnemyAttacking(true);
      playMovementSfx(chosenSkill.attackKind === 'magic' ? 'unarmed' : (simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed'));
      triggerEnemyAnimationAction('skill', 760);
      const castColor = getSkillCastColor(chosenSkill);
      spawnFloatingText(chosenSkill.name.toUpperCase(), 'enemy', 'skill');
      spawnParticles([2, -0.5, 0], 16, castColor, 'spark');
      window.setTimeout(() => {
        if (chosenSkill.effect === 'heal') {
          const healAmount = Math.max(1, Math.floor(simulatedEnemy.stats.maxHp * (chosenSkill.healMultiplier ?? 0.2)));
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
                ? Math.max(simulatedEnemy.combatBuffs.atkMod, buffModifier)
                : simulatedEnemy.combatBuffs.atkMod,
              defMod: chosenSkill.effect === 'buff_def'
                ? Math.max(simulatedEnemy.combatBuffs.defMod, buffModifier)
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
          multiplier: chosenSkill.damageMultiplier * getEnemyDamagePressure(simulatedEnemy, 'skill'),
          luck: simulatedEnemy.stats.luck,
          attackKind: chosenSkill.attackKind,
          defenderIsDefending: player.isDefending,
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

        const finalDamage = player.isDefending ? Math.floor(skillAttackResult.damage * 0.5) : skillAttackResult.damage;
        const mitigatedDamage = player.isDefending ? Math.max(0, skillAttackResult.damage - finalDamage) : 0;
        const remainingHpAfterHit = Math.max(0, player.stats.hp - finalDamage);
        playAttackImpactSfx({
          attackKind: chosenSkill.attackKind,
          attackerStyle: chosenSkill.attackKind === 'magic' ? 'unarmed' : (simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed'),
          defended: player.isDefending,
          source: 'enemy',
        });
        if (remainingHpAfterHit <= 0) {
          battleSfx.play('death');
        }
        const hitAnimationAction: PlayerAnimationAction = remainingHpAfterHit <= 0
          ? 'death'
          : player.isDefending
            ? 'defend-hit'
            : skillAttackResult.isCrit
              ? 'critical-hit'
              : 'hit';

        spawnParticles([-2, -1, 0], 14, castColor, 'explode');
        spawnParticles([-2, -1, 0], 10, chosenSkill.attackKind === 'magic' ? '#7dd3fc' : '#fb7185', 'spark');
        spawnFloatingText(skillAttackResult.isCrit ? `CRIT ${finalDamage}` : finalDamage, 'player', skillAttackResult.isCrit ? 'crit' : 'damage');
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
            ...consumeTurnBuffs(prev.buffs),
            riposteTurns: player.isDefending ? 1 : prev.buffs.riposteTurns,
            riposteArmed: player.isDefending ? true : prev.buffs.riposteArmed,
          },
          isDefending: false,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) },
        }));
        if (player.isDefending && remainingHpAfterHit > 0) {
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
                setGameState(GameState.DUNGEON_RESULT);
              } else if (enemy.isBoss) {
                setKillCount(0);
                setGameState(GameState.GAME_OVER);
              } else {
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

    const defensiveReactionBoost = playerAggressive ? 0.08 : 0;
    const shouldDefend = canDefend && Math.random() < Math.min(0.65, simulatedEnemy.aiProfile.defendBaseChance + defensiveReactionBoost);
    if (shouldDefend) {
      useDefendAction('segurar a ofensiva');
      return;
    }

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
        multiplier: getEnemyDamagePressure(simulatedEnemy, 'basic'),
        luck: simulatedEnemy.stats.luck,
        attackKind: 'physical',
        defenderIsDefending: player.isDefending,
        defenderBuffs: player.buffs,
        applyDefenseBuff: true,
        critChanceBonus: simulatedEnemy.aiProfile.critChanceBonus,
        critDamageBonus: simulatedEnemy.aiProfile.critDamageBonus,
        damageReduction: talentBonuses.damageReduction,
        defendMitigationBonus: talentBonuses.defendMitigation,
      });

      if (attackResult.evaded) {
        battleSfx.play('evade');
        spawnFloatingText('DESVIO!', 'player', 'buff');
        addLog(`Voce desviou do ataque de ${simulatedEnemy.name}!`, 'evade');
        setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs), isDefending: false }));
        setPlayerAnimationAction('evade');
        window.setTimeout(() => {
          setIsEnemyAttacking(false);
          finishEnemyActionToPlayerTurn(simulatedEnemy);
        }, 600);
        return;
      }

      const finalDamage = player.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
      const mitigatedDamage = player.isDefending ? Math.max(0, attackResult.damage - finalDamage) : 0;
      const remainingHpAfterHit = Math.max(0, player.stats.hp - finalDamage);
      playAttackImpactSfx({
        attackKind: 'physical',
        attackerStyle: simulatedEnemy.attackStyle === 'armed' ? 'weapon' : 'unarmed',
        defended: player.isDefending,
        source: 'enemy',
      });
      if (remainingHpAfterHit <= 0) {
        battleSfx.play('death');
      }
      const hitAnimationAction: PlayerAnimationAction = remainingHpAfterHit <= 0
        ? 'death'
        : player.isDefending
          ? 'defend-hit'
          : attackResult.isCrit
            ? 'critical-hit'
            : 'hit';

      spawnParticles([-2, -1, 0], 5, '#dc2626', 'spark');
      spawnFloatingText(finalDamage, 'player', attackResult.isCrit ? 'crit' : 'damage');
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
        const nextBuffs = consumeTurnBuffs(prev.buffs);
        if (player.isDefending) {
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
      if (player.isDefending && remainingHpAfterHit > 0) {
        const counterResult = rollDefensiveCounter(simulatedEnemy);
        if (counterResult.triggered) {
          pendingCounter = {
            damage: counterResult.damage,
            enemyStateBeforeCounter: simulatedEnemy,
          };
        }
      }

      addLog(`${simulatedEnemy.name} atacou: ${finalDamage} dano!${player.isDefending ? ' (Defendido)' : ''}${attackResult.isCrit ? ' CRITICO!' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
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
              setGameState(GameState.DUNGEON_RESULT);
            } else if (enemy.isBoss) {
              setKillCount(0);
              setGameState(GameState.GAME_OVER);
            } else {
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
    gameState,
    handleVictory,
    player,
    setDungeonResult,
    setDungeonRun,
    setEnemy,
    setGameState,
    setIsEnemyAttacking,
    setIsPlayerCritHit,
    setIsPlayerHit,
    setPlayer,
    setPlayerAnimationAction,
    setScreenShake,
    setTurnState,
    spawnFloatingText,
    spawnParticles,
    triggerEnemyAnimationAction,
  ]);

  return {
    handlePlayerAttack,
    handlePlayerDefense,
    handleSkill,
    handleUseItem,
    handleEnemyTurn,
  };
};

