import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ALL_ITEMS } from '../../constants';
import { createEmptyBuffState } from '../mechanics/combat';
import { CardRewardOffer, DungeonResult, DungeonRunState, DungeonRewards, Enemy, GameState, Item, Player } from '../../types';

interface LootResult {
  gold: number;
  xp: number;
  diamonds?: number;
  drops: Item[];
  isBoss: boolean;
  enemyName: string;
}

interface UseBattleResolutionParams {
  player: Player;
  enemy: Enemy | null;
  stage: number;
  dungeonRun: DungeonRunState | null;
  pendingDungeonQueue: CardRewardOffer[];
  applyLevelProgression: (basePlayer: Player) => { nextPlayer: Player; levelsGained: number };
  createLevelUpOffers: (count: number) => CardRewardOffer[];
  triggerLevelUpPulse: () => void;
  generateDungeonDrops: (targetEnemy: Enemy, evolution: number, wasBoss: boolean) => string[];
  applyDropsToInventory: (inventory: Record<string, number>, rewardDrops: Record<string, number>) => Record<string, number>;
  getDungeonMonsterTarget: (evolution: number) => number;
  openCardRewardQueue: (currentPlayer: Player, queue: CardRewardOffer[]) => void;
  enterBattle: (isBoss: boolean, mode?: 'hunt' | 'dungeon', dungeonClearedOverride?: number) => void;
  addLog: (message: string, type?: 'info' | 'damage' | 'heal' | 'crit' | 'evade' | 'buff') => void;
  setPlayer: Dispatch<SetStateAction<Player>>;
  setEnemy: Dispatch<SetStateAction<Enemy | null>>;
  setNarration: Dispatch<SetStateAction<string>>;
  setLootResult: Dispatch<SetStateAction<LootResult | null>>;
  setDungeonRun: Dispatch<SetStateAction<DungeonRunState | null>>;
  setDungeonResult: Dispatch<SetStateAction<DungeonResult | null>>;
  setDungeonEvolution: Dispatch<SetStateAction<number>>;
  setBossVictoryContext: Dispatch<SetStateAction<any>>;
  setPendingDungeonQueue: Dispatch<SetStateAction<CardRewardOffer[]>>;
  setPostCardFlow: Dispatch<SetStateAction<'tavern' | 'boss-victory' | 'resume-hunt' | null>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setStage: Dispatch<SetStateAction<number>>;
  setKillCount: Dispatch<SetStateAction<number>>;
  setEnemyAnimationAction: Dispatch<SetStateAction<any>>;
  setPlayerAnimationAction: Dispatch<SetStateAction<any>>;
  generateVictorySpeech: (enemyName: string) => Promise<string>;
  shouldForceFirstEnemyDrop: boolean;
  shouldTriggerInventoryUnlockTutorial: boolean;
  onTriggerInventoryUnlockTutorial: () => void;
  allowPotionDrops: boolean;
}

export const useBattleResolution = ({
  player,
  enemy,
  stage,
  dungeonRun,
  pendingDungeonQueue,
  applyLevelProgression,
  createLevelUpOffers,
  triggerLevelUpPulse,
  generateDungeonDrops,
  applyDropsToInventory,
  getDungeonMonsterTarget,
  openCardRewardQueue,
  enterBattle,
  addLog,
  setPlayer,
  setEnemy,
  setNarration,
  setLootResult,
  setDungeonRun,
  setDungeonResult,
  setDungeonEvolution,
  setBossVictoryContext,
  setPendingDungeonQueue,
  setPostCardFlow,
  setGameState,
  setStage,
  setKillCount,
  setEnemyAnimationAction,
  setPlayerAnimationAction,
  generateVictorySpeech,
  shouldForceFirstEnemyDrop,
  shouldTriggerInventoryUnlockTutorial,
  onTriggerInventoryUnlockTutorial,
  allowPotionDrops,
}: UseBattleResolutionParams) => {
  const handleVictory = useCallback(async (delayMs = 0) => {
    if (!enemy) return;

    setPlayerAnimationAction('idle');

    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), delayMs);
      });
    }

    const xpGain = Math.floor(enemy.xpReward * (1 + player.cardBonuses.xpGainMultiplier));
    const goldGain = Math.floor(enemy.goldReward * (1 + player.cardBonuses.goldGainMultiplier));
    const wasBoss = enemy.isBoss;

    const drops: string[] = [];
    if (dungeonRun) {
      drops.push(...generateDungeonDrops(enemy, dungeonRun.evolution, wasBoss));
    } else {
      if (Math.random() < 0.6) {
        if (enemy.type === 'beast') drops.push(Math.random() < 0.5 ? 'mat_bone' : 'mat_slime');
        else if (enemy.type === 'humanoid') drops.push(Math.random() < 0.5 ? 'mat_cloth' : 'mat_wood');
        else if (enemy.type === 'undead') drops.push(Math.random() < 0.5 ? 'mat_bone' : 'mat_cloth');
      }
      if (wasBoss) {
        drops.push('mat_iron');
        if (Math.random() < 0.3) drops.push('mat_gold');
        if (Math.random() < 0.5) drops.push('pot_1');
      } else if (Math.random() < 0.15) {
        drops.push('pot_1');
      }

      // One-time onboarding rule: the very first enemy kill always grants at least one item.
      if (!wasBoss && shouldForceFirstEnemyDrop && drops.length === 0) {
        if (enemy.type === 'beast') {
          drops.push(Math.random() < 0.5 ? 'mat_bone' : 'mat_slime');
        } else if (enemy.type === 'humanoid') {
          drops.push(Math.random() < 0.5 ? 'mat_cloth' : 'mat_wood');
        } else {
          drops.push(Math.random() < 0.5 ? 'mat_bone' : 'mat_cloth');
        }
      }

      if (!wasBoss && shouldTriggerInventoryUnlockTutorial && drops.length === 0) {
        if (enemy.type === 'beast') {
          drops.push(Math.random() < 0.5 ? 'mat_bone' : 'mat_slime');
        } else if (enemy.type === 'humanoid') {
          drops.push(Math.random() < 0.5 ? 'mat_cloth' : 'mat_wood');
        } else {
          drops.push(Math.random() < 0.5 ? 'mat_bone' : 'mat_cloth');
        }
      }
    }

    const effectiveDrops = allowPotionDrops
      ? drops
      : drops.filter((dropId) => ALL_ITEMS.find((item) => item.id === dropId)?.type !== 'potion');

    const dungeonEncounterNumber = dungeonRun ? dungeonRun.rewards.clearedMonsters + (wasBoss ? 0 : 1) : 0;
    const diamondGain = dungeonRun
      ? (wasBoss
          ? 3 + (Math.random() < 0.45 ? 1 : 0)
          : ((dungeonEncounterNumber % 10 === 0 ? 1 : 0) + (Math.random() < 0.08 ? 1 : 0)))
      : 0;

    const dropItems = effectiveDrops.map(dropId => ALL_ITEMS.find(item => item.id === dropId)).filter((item): item is Item => Boolean(item));

    if (dungeonRun) {
      const playerAfterXpGain = {
        ...player,
        xp: player.xp + xpGain,
        chosenCards: [...player.chosenCards],
        cardBonuses: { ...player.cardBonuses },
        buffs: { ...player.buffs },
      };
      let levelsGained = 0;
      let progressedDungeonPlayer = playerAfterXpGain;
      ({ nextPlayer: progressedDungeonPlayer, levelsGained } = applyLevelProgression(playerAfterXpGain));

      const nextDrops = { ...dungeonRun.rewards.drops };
      effectiveDrops.forEach(dropId => {
        nextDrops[dropId] = (nextDrops[dropId] || 0) + 1;
      });

      const clearedMonsters = wasBoss ? dungeonRun.rewards.clearedMonsters : dungeonRun.rewards.clearedMonsters + 1;
      const nextRewards: DungeonRewards = {
        ...dungeonRun.rewards,
        gold: dungeonRun.rewards.gold + goldGain,
        xp: dungeonRun.rewards.xp + xpGain,
        diamonds: dungeonRun.rewards.diamonds + diamondGain,
        drops: nextDrops,
        clearedMonsters,
        bossDefeated: wasBoss,
      };

      if (levelsGained > 0) {
        triggerLevelUpPulse();
      }

      const levelUpOffers = levelsGained > 0 ? createLevelUpOffers(levelsGained) : [];

      setPlayer(progressedDungeonPlayer);
      if (levelsGained > 0 && !wasBoss) {
        setPendingDungeonQueue(prev => [...prev, ...levelUpOffers]);
      }

      addLog(`Vitória na dungeon! +${xpGain} XP ganho agora, +${goldGain} Ouro em reserva${diamondGain > 0 ? `, +${diamondGain} Diamante` : ''}.`, 'crit');
      setLootResult({ gold: goldGain, xp: xpGain, diamonds: diamondGain, drops: dropItems, isBoss: wasBoss, enemyName: enemy.name });
      window.setTimeout(() => setLootResult(null), 2800);
      setEnemy(null);
      setEnemyAnimationAction('battle-idle');

      if (wasBoss) {
        const nextEvolution = dungeonRun.evolution + 1;
        const nextTotalMonsters = getDungeonMonsterTarget(nextEvolution);
        const updatedPlayer = {
          ...progressedDungeonPlayer,
          gold: progressedDungeonPlayer.gold + nextRewards.gold,
          diamonds: progressedDungeonPlayer.diamonds + nextRewards.diamonds,
          inventory: applyDropsToInventory(progressedDungeonPlayer.inventory, nextRewards.drops),
          chosenCards: [...progressedDungeonPlayer.chosenCards],
          cardBonuses: { ...progressedDungeonPlayer.cardBonuses },
          buffs: createEmptyBuffState(),
        };

        setPlayer(updatedPlayer);
        setDungeonEvolution(nextEvolution);
        setBossVictoryContext({
          mode: 'dungeon',
          bossName: enemy.name,
          nextEvolution,
          nextTotalMonsters,
          rewards: nextRewards,
        });
        setNarration('Escolha: continuar para a proxima evolucao da dungeon ou sair sem custo.');
        setDungeonRun(null);
        setDungeonResult(null);

        const bossQueue: CardRewardOffer[] = [
          { source: 'boss', reason: `Recompensa da dungeon: ${enemy.name}` },
          ...pendingDungeonQueue,
          ...levelUpOffers,
        ];
        setPendingDungeonQueue([]);

        if (bossQueue.length > 0) {
          setPostCardFlow('boss-victory');
          window.setTimeout(() => openCardRewardQueue(updatedPlayer, bossQueue), 3200);
        } else {
          setPostCardFlow(null);
          setGameState(GameState.BOSS_VICTORY);
        }
      } else {
        setDungeonRun({ ...dungeonRun, rewards: nextRewards });
        setNarration(clearedMonsters >= nextRewards.totalMonsters ? 'A câmara final se abriu. O chefão aguarda no fundo da dungeon.' : `A dungeon continua. Encontro ${clearedMonsters}/${nextRewards.totalMonsters}.`);
        window.setTimeout(() => {
          enterBattle(clearedMonsters >= nextRewards.totalMonsters, 'dungeon', clearedMonsters);
        }, 1500);
      }

      return;
    }

    const newInventory = { ...player.inventory };
    effectiveDrops.forEach(dropId => {
      newInventory[dropId] = (newInventory[dropId] || 0) + 1;
    });

    let updatedPlayer = {
      ...player,
      xp: player.xp + xpGain,
      gold: player.gold + goldGain,
      inventory: newInventory,
      chosenCards: [...player.chosenCards],
      cardBonuses: { ...player.cardBonuses },
      buffs: createEmptyBuffState(),
    };

    let levelsGained = 0;
    if (wasBoss) {
      setStage(prev => prev + 1);
      setKillCount(0);
      setBossVictoryContext({
        mode: 'hunt',
        bossName: enemy.name,
        nextStage: stage + 1,
      });
    } else {
      setKillCount(prev => prev + 1);
    }

    ({ nextPlayer: updatedPlayer, levelsGained } = applyLevelProgression(updatedPlayer));

    if (levelsGained > 0) {
      triggerLevelUpPulse();
    }

    setPlayer(updatedPlayer);

    const dropText = effectiveDrops.length > 0
      ? ` Drops: ${effectiveDrops.map(dropId => ALL_ITEMS.find(item => item.id === dropId)?.name).join(', ')}`
      : '';
    addLog(`Vitória! +${xpGain} XP, +${goldGain} Ouro.${dropText}`, 'crit');

    setLootResult({ gold: goldGain, xp: xpGain, drops: dropItems, isBoss: wasBoss, enemyName: enemy.name });
    window.setTimeout(() => setLootResult(null), 2800);

    setEnemy(null);
    setEnemyAnimationAction('battle-idle');
    const queuedCardRewards: CardRewardOffer[] = [];
    if (wasBoss) {
      queuedCardRewards.push({ source: 'boss', reason: `Recompensa do chefao ${enemy.name}` });
    }
    if (levelsGained > 0) {
      queuedCardRewards.push(...createLevelUpOffers(levelsGained));
    }

    const shouldOpenInventoryTutorial = !wasBoss && effectiveDrops.length > 0 && shouldTriggerInventoryUnlockTutorial;

    if (queuedCardRewards.length > 0) {
      setPostCardFlow(wasBoss ? 'boss-victory' : (shouldOpenInventoryTutorial ? 'tavern' : 'resume-hunt'));
      if (wasBoss) {
        generateVictorySpeech(enemy.name)
          .then(victoryText => setNarration(victoryText))
          .catch(() => undefined);
      }
      if (shouldOpenInventoryTutorial) {
        onTriggerInventoryUnlockTutorial();
      }
      window.setTimeout(() => openCardRewardQueue(updatedPlayer, queuedCardRewards), 3200);
    } else if (wasBoss) {
      setGameState(GameState.BOSS_VICTORY);
      try {
        const victoryText = await generateVictorySpeech(enemy.name);
        setNarration(victoryText);
      } catch {}
    } else if (shouldOpenInventoryTutorial) {
      setNarration('Voce encontrou itens novos. Volte ao acampamento para abrir a mochila.');
      window.setTimeout(() => {
        onTriggerInventoryUnlockTutorial();
      }, 2900);
    } else {
      setNarration('Procurando próximo inimigo...');
      window.setTimeout(() => {
        enterBattle(false);
      }, 1500);
    }
  }, [
    addLog,
    applyDropsToInventory,
    applyLevelProgression,
    createLevelUpOffers,
    dungeonRun,
    enemy,
    enterBattle,
    generateDungeonDrops,
    generateVictorySpeech,
    getDungeonMonsterTarget,
    openCardRewardQueue,
    pendingDungeonQueue,
    player,
    setBossVictoryContext,
    setDungeonEvolution,
    setDungeonResult,
    setDungeonRun,
    setEnemy,
    setEnemyAnimationAction,
    setGameState,
    setKillCount,
    setLootResult,
    setNarration,
    setPendingDungeonQueue,
    setPlayer,
    setPlayerAnimationAction,
    setPostCardFlow,
    setStage,
    shouldForceFirstEnemyDrop,
    shouldTriggerInventoryUnlockTutorial,
    onTriggerInventoryUnlockTutorial,
    allowPotionDrops,
    stage,
    triggerLevelUpPulse,
  ]);

  return { handleVictory };
};
