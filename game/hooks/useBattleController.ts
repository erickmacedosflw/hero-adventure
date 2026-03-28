import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ALL_ITEMS } from '../../constants';
import {
  applyStatusEffect,
  calculateDamage,
  consumeTurnBuffs,
  createEmptyBuffState,
  createStatusEffect,
  tickStatusEffects,
} from '../mechanics/combat';
import { getTalentBonuses } from '../mechanics/classProgression';
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
  spawnFloatingText: (value: string | number, target: 'player' | 'enemy', type: 'damage' | 'heal' | 'crit' | 'buff') => void;
  setPlayer: Dispatch<SetStateAction<Player>>;
  setEnemy: Dispatch<SetStateAction<Enemy | null>>;
  setTurnState: Dispatch<SetStateAction<TurnState>>;
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
}

const getMarkedBonus = (statuses: Enemy['statusEffects'] | undefined, value: number) => (
  statuses?.some((status) => status.kind === 'marked') ? value : 0
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
}: UseBattleControllerParams) => {
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
      spawnFloatingText(`+${manaGain} MP`, 'player', 'heal');
      addLog(`Fluxo da constelacao restaurou ${manaGain} MP.`, 'heal');
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

    const talentBonuses = getTalentBonuses(player);
    const doubleAttackActive = player.buffs.doubleAttackTurns > 0;
    const attackDelay = player.equippedWeapon ? 650 : 400;
    const idleDelay = player.equippedWeapon ? 400 : 550;

    setTurnState(TurnState.PLAYER_ANIMATION);
    setIsPlayerAttacking(true);
    setPlayerAnimationAction('attack');
    setEnemyAnimationAction(enemy.isDefending ? 'defend' : 'battle-idle');

    const resolveStrike = (remainingHp: number, isFirstStrike: boolean) => {
      const attackResult = calculateDamage({
        attackerAtk: player.stats.atk,
        defenderDef: enemy.stats.def,
        attackerSpeed: player.stats.speed,
        defenderSpeed: enemy.stats.speed,
        multiplier: getBossDamageMultiplier() * (1 + talentBonuses.physicalDamage + getMarkedBonus(enemy.statusEffects, talentBonuses.markedDamage)),
        luck: player.stats.luck,
        attackKind: 'physical',
        defenderIsDefending: isFirstStrike ? enemy.isDefending : false,
        attackerBuffs: player.buffs,
        applyAttackBuff: true,
        critChanceBonus: talentBonuses.critChance,
        critDamageBonus: talentBonuses.critDamage,
      });

      if (attackResult.evaded) {
        spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
        addLog(isFirstStrike ? `${enemy.name} desviou do ataque!` : `${enemy.name} desviou do segundo golpe!`, 'evade');
        triggerEnemyAnimationAction('evade', 520);
        return { remainingHp, defeated: false, evaded: true };
      }

      const appliedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
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
      triggerEnemyAnimationAction(updatedHp <= 0 ? 'death' : attackResult.isCrit ? 'critical-hit' : 'hit', updatedHp <= 0 ? 900 : attackResult.isCrit ? 620 : 360);
      setEnemy((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - appliedDamage) },
          isDefending: false,
        };
      });
      awardCombatBenefits(appliedDamage, 1 + Math.max(0, Math.floor(talentBonuses.resourceOnAttack)), talentBonuses);
      addLog(`${isFirstStrike ? 'Causou' : 'Segundo golpe:'} ${appliedDamage} dano!${isFirstStrike && enemy.isDefending ? ' (Defendido)' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
      return { remainingHp: updatedHp, defeated: updatedHp <= 0, evaded: false };
    };

    window.setTimeout(() => {
      setIsPlayerAttacking(false);

      const firstStrike = resolveStrike(enemy.stats.hp, true);
      if (firstStrike.defeated) {
        void handleVictory(900);
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
          void handleVictory(900);
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
  ]);

  const handlePlayerDefense = useCallback(() => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;

    const talentBonuses = getTalentBonuses(player);
    const manaRecovered = Math.max(1, Math.floor(player.stats.maxMp * (0.05 + player.cardBonuses.defendManaRestore)) + Math.floor(talentBonuses.manaOnDefend));

    setTurnState(TurnState.PLAYER_ANIMATION);
    setPlayerAnimationAction('defend');

    setPlayer((prev) => ({
      ...prev,
      isDefending: true,
      stats: {
        ...prev.stats,
        mp: Math.min(prev.stats.maxMp, prev.stats.mp + manaRecovered),
      },
      classResource: {
        ...prev.classResource,
        value: Math.min(prev.classResource.max, prev.classResource.value + 1),
      },
    }));
    addLog(`Voce se preparou para defender, ganhou evasao temporaria e recuperou ${manaRecovered} MP!`, 'buff');
    spawnFloatingText('DEFESA!', 'player', 'buff');
    spawnFloatingText(`+${manaRecovered} MP`, 'player', 'heal');
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

    const talentBonuses = getTalentBonuses(player);
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
    }));

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
    const doubleAttackActive = player.buffs.doubleAttackTurns > 0 && skill.type === 'physical';
    window.setTimeout(() => {
      setIsPlayerAttacking(false);

      const resolveSkillStrike = (remainingHp: number, isFirstStrike: boolean) => {
        const statusBonus = getMarkedBonus(enemy.statusEffects, talentBonuses.markedDamage);
        const schoolBonus = skill.type === 'magic' ? talentBonuses.magicDamage : talentBonuses.physicalDamage;
        const resourceBurst = resourceSpent * (skill.resourceEffect?.bonusDamagePerPoint ?? 0);
        const attackResult = calculateDamage({
          attackerAtk: player.stats.atk,
          defenderDef: enemy.stats.def,
          attackerSpeed: player.stats.speed,
          defenderSpeed: enemy.stats.speed,
          multiplier: (skill.damageMult + resourceBurst) * getBossDamageMultiplier() * (1 + schoolBonus + statusBonus),
          luck: player.stats.luck,
          attackKind: skill.type === 'magic' ? 'magic' : 'physical',
          defenderIsDefending: isFirstStrike ? enemy.isDefending : false,
          attackerBuffs: player.buffs,
          applyAttackBuff: true,
          critChanceBonus: talentBonuses.critChance,
          critDamageBonus: talentBonuses.critDamage,
        });

        if (attackResult.evaded) {
          spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
          addLog(isFirstStrike ? `${enemy.name} desviou de ${skill.name}!` : `${enemy.name} desviou da repeticao de ${skill.name}!`, 'evade');
          triggerEnemyAnimationAction('evade', 520);
          return { remainingHp, defeated: false };
        }

        const appliedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
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
        triggerEnemyAnimationAction(updatedHp <= 0 ? 'death' : attackResult.isCrit ? 'critical-hit' : 'hit', updatedHp <= 0 ? 900 : attackResult.isCrit ? 620 : 360);
        setEnemy((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - appliedDamage) },
            isDefending: false,
          };
        });

        awardCombatBenefits(appliedDamage, (skill.resourceEffect?.gain ?? 0) + Math.max(0, Math.floor(talentBonuses.resourceOnSkill)), talentBonuses);
        if (isFirstStrike) {
          tryApplySkillStatus(skill, talentBonuses);
        }
        addLog(`${isFirstStrike ? skill.name : `${skill.name} (2o golpe)`}: ${appliedDamage} dano!${isFirstStrike && enemy.isDefending ? ' (Defendido)' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
        return { remainingHp: updatedHp, defeated: updatedHp <= 0 };
      };

      const firstStrike = resolveSkillStrike(enemy.stats.hp, true);
      if (firstStrike.defeated) {
        void handleVictory(900);
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
          void handleVictory(900);
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
    }

    if (item.name.includes('Vida') || item.name.includes('Elixir') || item.name.includes('Ambrosia') || item.name.includes('Menor')) {
      const healVal = getHealingValue(item.value);
      spawnParticles([-2, -1, 0], 24, '#4ade80', 'heal');
      spawnFloatingText(`+${healVal}`, 'player', 'heal');
      addLog(`Usou ${item.name}, recuperou ${healVal} HP`, 'heal');
    } else if (item.name.includes('Mana')) {
      spawnParticles([-2, -1, 0], 24, '#3b82f6', 'heal');
      spawnFloatingText(`+${item.value} MP`, 'player', 'heal');
      addLog(`Usou ${item.name}, recuperou ${item.value} MP`, 'heal');
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

      if (item.name.includes('Vida') || item.name.includes('Elixir') || item.name.includes('Ambrosia') || item.name.includes('Menor')) {
        newHp = Math.min(prev.stats.maxHp, prev.stats.hp + getHealingValue(item.value));
      } else if (item.name.includes('Mana')) {
        newMp = Math.min(prev.stats.maxMp, prev.stats.mp + item.value);
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

    // Prevent the App-level enemy-turn effect from re-entering this handler
    // when player/enemy state changes during the same enemy action.
    setTurnState(TurnState.PROCESSING);

    const talentBonuses = getTalentBonuses(player);
    const enemyStatusTick = tickStatusEffects(enemy.statusEffects ?? [], enemy.stats.maxHp, {
      burnBonus: talentBonuses.burnDamage,
      bleedBonus: talentBonuses.bleedDamage,
    });

    if (enemyStatusTick.damage > 0) {
      spawnParticles([2, -0.5, 0], 18, '#fb7185', 'spark');
      spawnFloatingText(enemyStatusTick.damage, 'enemy', 'damage');
      enemyStatusTick.logs.forEach((message) => addLog(`${enemy.name}: ${message}`, 'damage'));

      const enemyRemainingHp = Math.max(0, enemy.stats.hp - enemyStatusTick.damage);
      setEnemy((prev) => (
        prev
          ? {
              ...prev,
              stats: { ...prev.stats, hp: enemyRemainingHp },
              statusEffects: enemyStatusTick.nextStatuses,
            }
          : null
      ));

      if (enemyRemainingHp <= 0) {
        triggerEnemyAnimationAction('death', 900);
        void handleVictory(900);
        return;
      }
    } else if ((enemy.statusEffects ?? []).length > 0) {
      setEnemy((prev) => prev ? ({ ...prev, statusEffects: enemyStatusTick.nextStatuses }) : null);
    }

    const shouldDefend = Math.random() < 0.2;
    setEnemy((prev) => prev ? ({ ...prev, isDefending: false }) : null);

    if (shouldDefend) {
      setEnemy((prev) => prev ? ({ ...prev, isDefending: true }) : null);
      addLog(`${enemy.name} esta se defendendo e ficou mais dificil de acertar!`, 'buff');
      spawnFloatingText('DEFESA!', 'enemy', 'buff');
      spawnParticles([2, -0.5, 0], 10, '#3b82f6', 'spark');
      setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs), isDefending: false }));
      setPlayerAnimationAction('idle');
      setTurnState(TurnState.PLAYER_INPUT);
      return;
    }

    setIsEnemyAttacking(true);
    triggerEnemyAnimationAction('attack', 750);

    window.setTimeout(() => {
      const attackResult = calculateDamage({
        attackerAtk: enemy.stats.atk,
        defenderDef: player.stats.def,
        attackerSpeed: enemy.stats.speed,
        defenderSpeed: player.stats.speed,
        defenderHasPerfectEvade: player.buffs.perfectEvadeTurns > 0,
        multiplier: 1,
        luck: 0,
        attackKind: 'physical',
        defenderIsDefending: player.isDefending,
        defenderBuffs: player.buffs,
        applyDefenseBuff: true,
        damageReduction: talentBonuses.damageReduction,
        defendMitigationBonus: talentBonuses.defendMitigation,
      });

      if (attackResult.evaded) {
        spawnFloatingText('DESVIO!', 'player', 'buff');
        addLog(`Voce desviou do ataque de ${enemy.name}!`, 'evade');
        setPlayer((prev) => ({ ...prev, buffs: consumeTurnBuffs(prev.buffs), isDefending: false }));
        setPlayerAnimationAction('evade');
        window.setTimeout(() => {
          setIsEnemyAttacking(false);
          setPlayerAnimationAction('idle');
          setTurnState(TurnState.PLAYER_INPUT);
        }, 600);
        return;
      }

      const finalDamage = player.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
      const remainingHpAfterHit = Math.max(0, player.stats.hp - finalDamage);
      const hitAnimationAction: PlayerAnimationAction = remainingHpAfterHit <= 0
        ? 'death'
        : player.isDefending
          ? 'defend-hit'
          : attackResult.isCrit
            ? 'critical-hit'
            : 'hit';

      spawnParticles([-2, -1, 0], 5, '#dc2626', 'spark');
      spawnFloatingText(finalDamage, 'player', 'damage');
      setScreenShake(0.2);
      setIsPlayerHit(true);
      setIsPlayerCritHit(attackResult.isCrit);
      window.setTimeout(() => {
        setScreenShake(0);
        setIsPlayerHit(false);
        setIsPlayerCritHit(false);
      }, 200);

      setPlayer((prev) => {
        const nextBuffs = consumeTurnBuffs(prev.buffs);
        return {
          ...prev,
          buffs: nextBuffs,
          isDefending: false,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) },
        };
      });

      addLog(`${enemy.name} atacou: ${finalDamage} dano!${player.isDefending ? ' (Defendido)' : ''}${attackResult.isCrit ? ' CRITICO!' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
      setPlayerAnimationAction(hitAnimationAction);
      if (hitAnimationAction !== 'death') {
        window.setTimeout(() => setPlayerAnimationAction('idle'), hitAnimationAction === 'defend-hit' ? 520 : hitAnimationAction === 'critical-hit' ? 620 : 360);
      }

      const hpRegen = remainingHpAfterHit > 0 ? Math.min(player.cardBonuses.hpRegenPerTurn, player.stats.maxHp - remainingHpAfterHit) : 0;
      const mpRegen = remainingHpAfterHit > 0 ? Math.min(player.cardBonuses.mpRegenPerTurn, player.stats.maxMp - player.stats.mp) : 0;

      window.setTimeout(() => {
        setIsEnemyAttacking(false);

        if (remainingHpAfterHit <= 0) {
          window.setTimeout(() => {
            if (dungeonRun) {
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
              setGameState(GameState.TAVERN);
              setPlayer((prev) => ({
                ...prev,
                stats: { ...prev.stats, hp: 1 },
                buffs: createEmptyBuffState(),
                isDefending: false,
                statusEffects: [],
              }));
              addLog('Derrotado pelo Chefao. Recuou para Taverna.', 'info');
            } else {
              setGameState(GameState.GAME_OVER);
            }
          }, 900);
        } else {
          const shouldCounter = player.isDefending && talentBonuses.counterOnDefendChance > 0 && Math.random() < talentBonuses.counterOnDefendChance;
          if (shouldCounter) {
            const counterDamage = Math.max(1, Math.floor(player.stats.atk * (0.7 + talentBonuses.physicalDamage)));
            spawnFloatingText(`CONTRA ${counterDamage}`, 'enemy', 'crit');
            spawnParticles([2, -0.5, 0], 16, '#f59e0b', 'explode');
            setEnemy((prev) => prev ? ({
              ...prev,
              stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - counterDamage) },
            }) : null);
            addLog(`Contra-ataque da constelacao causou ${counterDamage} dano!`, 'crit');
            if (enemy.stats.hp - counterDamage <= 0) {
              triggerEnemyAnimationAction('death', 900);
              void handleVictory(900);
              return;
            }
          }

          if (hpRegen > 0) spawnFloatingText(`+${hpRegen} HP`, 'player', 'heal');
          if (mpRegen > 0) spawnFloatingText(`+${mpRegen} MP`, 'player', 'heal');
          if (hpRegen > 0 || mpRegen > 0) {
            addLog(`Regeneracao: +${hpRegen} HP ${mpRegen > 0 ? `/ +${mpRegen} MP` : ''}`.trim(), 'heal');
          }
          setPlayer((prev) => ({
            ...prev,
            stats: {
              ...prev.stats,
              hp: Math.min(prev.stats.maxHp, prev.stats.hp + hpRegen),
              mp: Math.min(prev.stats.maxMp, prev.stats.mp + mpRegen),
            },
          }));
          setPlayer((prev) => ({ ...prev, isDefending: false }));
          setTurnState(TurnState.PLAYER_INPUT);
        }
      }, 350);
    }, 400);
  }, [
    addLog,
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
