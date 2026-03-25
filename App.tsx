
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShoppingBag, Play } from 'lucide-react';
import { DeveloperConsole } from './components/DeveloperConsole';
import { GameScene } from './components/Scene3D';
import { OpeningScreen } from './components/OpeningScreen';
import { BattleHUD, MenuScreen, ShopScreen, TavernScreen, KillLootOverlay, CardChoiceScreen, AlchemistScreen, DungeonResultScreen } from './components/GameUI';
import { 
    Player, Enemy, GameState, TurnState, BattleLog, Item, Skill, Stats, Particle, FloatingText, ProgressionCard, CardRewardOffer, AlchemistCardOffer, AlchemistItemOffer, DungeonRunState, DungeonResult, DungeonRewards, EnemyTemplate, DungeonEnemyTemplate, DungeonBossTemplate, PlayerAnimationAction
} from './types';
import { 
    INITIAL_PLAYER, SHOP_ITEMS, ALL_ITEMS, MATERIALS, SKILLS, ENEMY_DATA, ENEMY_COLORS, DUNGEON_ENEMY_DATA, DUNGEON_BOSS, ALCHEMIST_ITEM_OFFERS 
} from './constants';
import { PROGRESSION_CARDS, ALCHEMIST_CARDS } from './game/data/cards';
import { applyPlayerClass, PLAYER_CLASSES } from './game/data/classes';
import { generateBattleDescription, generateVictorySpeech } from './services/geminiService';

type BootWindow = Window & { __heroAdventureBootReady?: boolean };

const getBootReadyMemory = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return Boolean((window as BootWindow).__heroAdventureBootReady);
};

const setBootReadyMemory = (value: boolean) => {
    if (typeof window === 'undefined') {
        return;
    }

    (window as BootWindow).__heroAdventureBootReady = value;
};

class SceneErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('GameScene runtime error:', error);
    }

    render() {
        if (this.state.hasError) {
            return <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#020617_0%,#020617_45%,#000000_100%)]" />;
        }

        return this.props.children;
    }
}

export default function App() {
    const clonePlayer = (source: Player): Player => ({
        ...source,
        stats: { ...source.stats },
        inventory: { ...source.inventory },
        skills: [...source.skills],
        chosenCards: [...source.chosenCards],
        cardBonuses: { ...source.cardBonuses },
        buffs: { ...source.buffs },
    });

    const getDungeonMonsterTarget = (evolution: number) => 30 + Math.floor(evolution / 3) * 10;
    const getDungeonPowerMultiplier = (evolution: number) => 1 + (evolution * 0.12);
    const pickRandom = <T,>(entries: T[]) => entries[Math.floor(Math.random() * entries.length)];

    const createEmptyDungeonRewards = (evolution: number): DungeonRewards => ({
        gold: 0,
        xp: 0,
        diamonds: 0,
        drops: {},
        clearedMonsters: 0,
        totalMonsters: getDungeonMonsterTarget(evolution),
        evolution,
        bossDefeated: false,
    });

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [turnState, setTurnState] = useState<TurnState>(TurnState.PLAYER_INPUT);
    const [player, setPlayer] = useState<Player>(() => clonePlayer(INITIAL_PLAYER));
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [narration, setNarration] = useState<string>("");
  
  const [stage, setStage] = useState(1);
  const [killCount, setKillCount] = useState(0); // Track kills in current stage
    const [dungeonEvolution, setDungeonEvolution] = useState(0);

  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
    const [lootResult, setLootResult] = useState<{ gold: number; xp: number; diamonds?: number; drops: Item[]; isBoss: boolean; enemyName: string } | null>(null);
    const [cardRewardQueue, setCardRewardQueue] = useState<CardRewardOffer[]>([]);
    const [currentCardOffer, setCurrentCardOffer] = useState<CardRewardOffer | null>(null);
    const [currentCardChoices, setCurrentCardChoices] = useState<ProgressionCard[]>([]);
    const [postCardFlow, setPostCardFlow] = useState<'tavern' | 'victory' | 'resume-hunt' | null>(null);
    const [dungeonRun, setDungeonRun] = useState<DungeonRunState | null>(null);
    const [dungeonResult, setDungeonResult] = useState<DungeonResult | null>(null);
    const [pendingDungeonQueue, setPendingDungeonQueue] = useState<CardRewardOffer[]>([]);
    const [isBootReady, setIsBootReady] = useState(() => getBootReadyMemory());
    const [pathname, setPathname] = useState(() => window.location.pathname);

    const bootEnemies = useMemo(() => [...ENEMY_DATA, ...DUNGEON_ENEMY_DATA, DUNGEON_BOSS], []);
    const handleBootReady = useCallback(() => {
        setBootReadyMemory(true);
        setIsBootReady(true);
    }, []);

  // Game Time (from Scene3D day/night cycle)
  const [gameTime, setGameTime] = useState("12:00");

  // Animation States
  const [isPlayerAttacking, setIsPlayerAttacking] = useState(false);
  const [isEnemyAttacking, setIsEnemyAttacking] = useState(false);
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [isPlayerCritHit, setIsPlayerCritHit] = useState(false);
  const [isEnemyHit, setIsEnemyHit] = useState(false);
  const [screenShake, setScreenShake] = useState(0);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
    const [playerAnimationAction, setPlayerAnimationAction] = useState<PlayerAnimationAction>('idle');
    const [enemyAnimationAction, setEnemyAnimationAction] = useState<PlayerAnimationAction>('battle-idle');
    const enemyAnimationResetTimerRef = useRef<number | null>(null);

    const triggerEnemyAnimationAction = useCallback((action: PlayerAnimationAction, resetDelay?: number) => {
        if (enemyAnimationResetTimerRef.current !== null) {
            window.clearTimeout(enemyAnimationResetTimerRef.current);
            enemyAnimationResetTimerRef.current = null;
        }

        setEnemyAnimationAction(action);

        if (action === 'death') {
            return;
        }

        enemyAnimationResetTimerRef.current = window.setTimeout(() => {
            enemyAnimationResetTimerRef.current = null;
            setEnemyAnimationAction('battle-idle');
        }, resetDelay ?? (action === 'critical-hit' ? 620 : 360));
    }, []);

    useEffect(() => () => {
        if (enemyAnimationResetTimerRef.current !== null) {
            window.clearTimeout(enemyAnimationResetTimerRef.current);
        }
    }, []);

  // --- VFX SYSTEM ---
  const spawnParticles = (position: [number, number, number], count: number, color: string, type: 'explode' | 'heal' | 'spark') => {
      const newParticles: Particle[] = [];
      for(let i=0; i<count; i++) {
          newParticles.push({
              id: Math.random().toString(36),
              position: [position[0], position[1], position[2]],
              color: color,
              scale: type === 'heal' ? 0.2 : 0.3,
              life: 1.0,
              velocity: [
                  (Math.random() - 0.5) * (type === 'heal' ? 0.5 : 2), 
                  (Math.random() - 0.5) * 2 + (type === 'heal' ? 2 : 0), // Upwards for heal
                  (Math.random() - 0.5) * 2
              ]
          });
      }
      setParticles(prev => [...prev, ...newParticles]);
      
      // Cleanup handled by Scene component mostly, but we can prune simply here if needed
      setTimeout(() => {
          setParticles(prev => prev.slice(count)); 
      }, 1000);
  };

  const spawnFloatingText = (value: string | number, target: 'player' | 'enemy', type: 'damage' | 'heal' | 'crit' | 'buff') => {
      const id = Math.random().toString(36);
      setFloatingTexts(prev => [...prev, {
          id,
          text: value.toString(),
          type,
          target,
          xOffset: (Math.random() * 40) - 20, // Random spread
          yOffset: (Math.random() * 20) - 10
      }]);

      // Auto remove after animation
      setTimeout(() => {
          setFloatingTexts(prev => prev.filter(t => t.id !== id));
      }, 1000);
  };

    useEffect(() => {
        const handleLocationChange = () => setPathname(window.location.pathname);
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const createLevelUpOffers = (count: number): CardRewardOffer[] =>
        Array.from({ length: count }, (_, index) => ({
            source: 'level-up',
            reason: count > 1 ? `Carta de evolucao ${index + 1}/${count}` : 'Carta de evolucao',
        }));

    const hasUnlockedSkill = (currentPlayer: Player, skillId?: string) => {
        if (!skillId) {
            return false;
        }

        return currentPlayer.skills.some(skill => skill.id === skillId);
    };

    const isCardEligibleForOffer = (card: ProgressionCard, source: CardRewardOffer['source'], currentPlayer: Player) => {
        if (!card.offerSources.includes(source) || card.minLevel > currentPlayer.level) {
            return false;
        }

        const unlockEffects = card.effects.filter(effect => effect.type === 'unlock_skill');
        if (unlockEffects.length === 0) {
            return true;
        }

        return unlockEffects.some(effect => !hasUnlockedSkill(currentPlayer, effect.skillId))
            || card.effects.some(effect => effect.type !== 'unlock_skill');
    };

    const generateCardChoices = (source: CardRewardOffer['source'], currentPlayer: Player) => {
        const availablePool = PROGRESSION_CARDS.filter(card => isCardEligibleForOffer(card, source, currentPlayer));

        const fallbackPool = PROGRESSION_CARDS.filter(card => (
            card.offerSources.includes(source)
            && card.minLevel <= currentPlayer.level
        ));

        const pool = availablePool.length >= 3 ? availablePool : fallbackPool;
        return [...pool]
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(3, pool.length));
    };

    const applyLevelProgression = (basePlayer: Player) => {
        let nextPlayer: Player = {
            ...basePlayer,
            stats: { ...basePlayer.stats },
            inventory: { ...basePlayer.inventory },
            skills: [...basePlayer.skills],
            chosenCards: [...basePlayer.chosenCards],
            cardBonuses: { ...basePlayer.cardBonuses },
            buffs: { ...basePlayer.buffs },
        };
        let levelsGained = 0;

        while (nextPlayer.xp >= nextPlayer.xpToNext) {
            levelsGained += 1;
            nextPlayer.level += 1;
            nextPlayer.xp -= nextPlayer.xpToNext;
            nextPlayer.xpToNext = Math.floor(nextPlayer.xpToNext * 1.5);
        }

        if (levelsGained > 0) {
            nextPlayer.stats.hp = nextPlayer.stats.maxHp;
            nextPlayer.stats.mp = nextPlayer.stats.maxMp;
        }

        return { nextPlayer, levelsGained };
    };

    const triggerLevelUpPulse = () => {
        setIsLevelingUp(true);
        window.setTimeout(() => setIsLevelingUp(false), 1100);
    };

    const getSkillVisualConfig = (skill: Skill) => {
        if (skill.id === 'skl_1') return { color: '#f59e0b', particleCount: 14, shake: 0.22, castDelay: 420 };
        if (skill.id === 'skl_2') return { color: '#22c55e', particleCount: 18, shake: 0.0, castDelay: 520 };
        if (skill.id === 'skl_3') return { color: '#ef4444', particleCount: 22, shake: 0.34, castDelay: 520 };
        if (skill.id === 'skl_4') return { color: '#f97316', particleCount: 26, shake: 0.58, castDelay: 620 };
        if (skill.id === 'skl_5') return { color: '#a855f7', particleCount: 30, shake: 0.44, castDelay: 620 };
        if (skill.id === 'skl_6') return { color: '#f59e0b', particleCount: 28, shake: 0.62, castDelay: 560 };
        if (skill.id === 'skl_7') return { color: '#38bdf8', particleCount: 24, shake: 0.4, castDelay: 560 };
        if (skill.id === 'skl_8') return { color: '#e879f9', particleCount: 24, shake: 0.0, castDelay: 540 };
        if (skill.id === 'skl_9') return { color: '#6366f1', particleCount: 26, shake: 0.5, castDelay: 580 };
        if (skill.id === 'skl_10') return { color: '#fde047', particleCount: 38, shake: 0.72, castDelay: 700 };
        return { color: skill.type === 'magic' ? '#ef4444' : '#a855f7', particleCount: 20, shake: 0.3, castDelay: 500 };
    };

    const unlockSkillOnPlayer = (currentPlayer: Player, skillId?: string) => {
        if (!skillId) return currentPlayer;

        const skill = SKILLS.find(entry => entry.id === skillId);
        if (!skill || currentPlayer.skills.some(entry => entry.id === skillId)) {
            return currentPlayer;
        }

        return {
            ...currentPlayer,
            skills: [...currentPlayer.skills, skill],
        };
    };

    const applyCardChoice = (basePlayer: Player, card: ProgressionCard) => {
        const nextPlayer: Player = {
            ...basePlayer,
            stats: { ...basePlayer.stats },
            inventory: { ...basePlayer.inventory },
            skills: [...basePlayer.skills],
            chosenCards: [...basePlayer.chosenCards],
            cardBonuses: { ...basePlayer.cardBonuses },
            buffs: { ...basePlayer.buffs },
        };

        nextPlayer.chosenCards.push(card.id);

        card.effects.forEach(effect => {
            switch (effect.type) {
                case 'gold_instant':
                    nextPlayer.gold += Math.floor(effect.value);
                    break;
                case 'xp_instant':
                    nextPlayer.xp += Math.floor(effect.value);
                    break;
                case 'max_hp':
                    nextPlayer.stats.maxHp += Math.floor(effect.value);
                    nextPlayer.stats.hp = Math.min(nextPlayer.stats.maxHp, nextPlayer.stats.hp + Math.floor(effect.value));
                    break;
                case 'max_mp':
                    nextPlayer.stats.maxMp += Math.floor(effect.value);
                    nextPlayer.stats.mp = Math.min(nextPlayer.stats.maxMp, nextPlayer.stats.mp + Math.floor(effect.value));
                    break;
                case 'atk':
                    nextPlayer.stats.atk += Math.floor(effect.value);
                    break;
                case 'def':
                    nextPlayer.stats.def += Math.floor(effect.value);
                    break;
                case 'speed':
                    nextPlayer.stats.speed += Math.floor(effect.value);
                    break;
                case 'luck':
                    nextPlayer.stats.luck += Math.floor(effect.value);
                    break;
                case 'gold_gain_multiplier':
                    nextPlayer.cardBonuses.goldGainMultiplier = Math.min(1.5, nextPlayer.cardBonuses.goldGainMultiplier + effect.value);
                    break;
                case 'xp_gain_multiplier':
                    nextPlayer.cardBonuses.xpGainMultiplier = Math.min(1.5, nextPlayer.cardBonuses.xpGainMultiplier + effect.value);
                    break;
                case 'boss_damage_multiplier':
                    nextPlayer.cardBonuses.bossDamageMultiplier = Math.min(1, nextPlayer.cardBonuses.bossDamageMultiplier + effect.value);
                    break;
                case 'heal_multiplier':
                    nextPlayer.cardBonuses.healingMultiplier = Math.min(1, nextPlayer.cardBonuses.healingMultiplier + effect.value);
                    break;
                case 'opening_atk_buff':
                    nextPlayer.cardBonuses.openingAtkBuff = Math.min(0.75, nextPlayer.cardBonuses.openingAtkBuff + effect.value);
                    break;
                case 'opening_def_buff':
                    nextPlayer.cardBonuses.openingDefBuff = Math.min(0.75, nextPlayer.cardBonuses.openingDefBuff + effect.value);
                    break;
                case 'defend_mana_restore':
                    nextPlayer.cardBonuses.defendManaRestore = Math.min(0.4, nextPlayer.cardBonuses.defendManaRestore + effect.value);
                    break;
                case 'hp_regen_per_turn':
                    nextPlayer.cardBonuses.hpRegenPerTurn = Math.min(60, nextPlayer.cardBonuses.hpRegenPerTurn + Math.floor(effect.value));
                    break;
                case 'mp_regen_per_turn':
                    nextPlayer.cardBonuses.mpRegenPerTurn = Math.min(40, nextPlayer.cardBonuses.mpRegenPerTurn + Math.floor(effect.value));
                    break;
                case 'unlock_skill': {
                    const unlockedPlayer = unlockSkillOnPlayer(nextPlayer, effect.skillId);
                    nextPlayer.skills = unlockedPlayer.skills;
                    break;
                }
                default:
                    break;
            }
        });

        return nextPlayer;
    };

    const openCardRewardQueue = (currentPlayer: Player, queue: CardRewardOffer[]) => {
        if (queue.length === 0) {
            setCurrentCardOffer(null);
            setCurrentCardChoices([]);
            setCardRewardQueue([]);
            return false;
        }

        const [nextOffer, ...remainingOffers] = queue;
        setCurrentCardOffer(nextOffer);
        setCurrentCardChoices(generateCardChoices(nextOffer.source, currentPlayer));
        setCardRewardQueue(remainingOffers);
        setGameState(GameState.CARD_REWARD);
        return true;
    };

    const continueProgressionFlow = (currentPlayer: Player, queue: CardRewardOffer[]) => {
        if (queue.length === 0) {
            setCurrentCardOffer(null);
            setCurrentCardChoices([]);
            setCardRewardQueue([]);
            const nextFlow = postCardFlow;
            setPostCardFlow(null);

            if (nextFlow === 'victory') {
                setGameState(GameState.VICTORY);
                return;
            }

            if (nextFlow === 'resume-hunt') {
                setNarration('Procurando próximo inimigo...');
                window.setTimeout(() => {
                    enterBattle(false);
                }, 200);
                return;
            }

            setGameState(GameState.TAVERN);
            return;
        }

        openCardRewardQueue(currentPlayer, queue);
    };

  // --- LOGIC ---

  const addLog = (message: string, type: BattleLog['type'] = 'info') => {
    setLogs(prev => [{ message, type }, ...prev]);
  };

    const spawnEnemy = async (currentStage: number, isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonEvolutionOverride?: number) => {
    // Scale stats based on stage
    let levelMult = 1 + (currentStage * 0.15);
    const isDungeonEncounter = mode === 'dungeon';
    const activeDungeonEvolution = dungeonEvolutionOverride ?? dungeonRun?.evolution ?? dungeonEvolution;
    if (isDungeonEncounter) {
    levelMult *= getDungeonPowerMultiplier(activeDungeonEvolution);
    }
    if (isBoss) levelMult *= 2.0; // Boss is significantly stronger

    const availableDungeonEnemies = DUNGEON_ENEMY_DATA.filter(template => template.minEvolution <= activeDungeonEvolution);
    const dungeonEnemyPool = availableDungeonEnemies.length > 0 ? availableDungeonEnemies : DUNGEON_ENEMY_DATA;
    const enemyTemplate: EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate = isBoss
        ? (isDungeonEncounter ? DUNGEON_BOSS : pickRandom(ENEMY_DATA))
        : (isDungeonEncounter ? pickRandom(dungeonEnemyPool) : pickRandom(ENEMY_DATA));
    const templateCombatProfile = enemyTemplate as Partial<DungeonEnemyTemplate & DungeonBossTemplate>;
    const hpMultiplier = templateCombatProfile.hpMultiplier ?? 1;
    const atkMultiplier = templateCombatProfile.atkMultiplier ?? 1;
    const defMultiplier = templateCombatProfile.defMultiplier ?? 1;
    const speedBonus = templateCombatProfile.speedBonus ?? 0;
    const color = isBoss && isDungeonEncounter
        ? DUNGEON_BOSS.color
        : ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
    
        const name = isBoss
                ? (isDungeonEncounter ? DUNGEON_BOSS.name : `General ${enemyTemplate.name}`)
                : enemyTemplate.name;

    const newEnemy: Enemy = {
      id: `enemy_${Date.now()}`,
      name: name,
      level: currentStage,
      stats: {
                hp: Math.floor(60 * levelMult * hpMultiplier),
                maxHp: Math.floor(60 * levelMult * hpMultiplier),
        mp: 0, maxMp: 0,
                atk: Math.floor(8 * levelMult * atkMultiplier),
                def: Math.floor(2 * levelMult * defMultiplier),
                speed: 10 + speedBonus + (isDungeonEncounter ? Math.floor(activeDungeonEvolution / 3) : 0),
        luck: 0
      },
            xpReward: Math.floor(40 * levelMult * (isBoss ? (isDungeonEncounter ? 3.6 : 3) : 1)),
            goldReward: Math.floor(25 * levelMult * (isBoss ? (isDungeonEncounter ? 3.2 : 3) : 1)),
                        color: isBoss ? (isDungeonEncounter ? DUNGEON_BOSS.color : '#ef4444') : (enemyTemplate.color ?? color),
                        scale: isBoss ? (isDungeonEncounter ? DUNGEON_BOSS.scale : (0.8 + (Math.random() * 0.4)) * 2.0) : (enemyTemplate.scale ?? (0.8 + (Math.random() * 0.4))),
      type: enemyTemplate.type as 'beast' | 'humanoid' | 'undead',
      isBoss,
            isDefending: false,
                assets: enemyTemplate.assets,
                attackStyle: enemyTemplate.attackStyle,
            guaranteedDrops: templateCombatProfile.guaranteedDrops,
            rareDrops: templateCombatProfile.rareDrops,
    };

    setEnemy(newEnemy);
        setEnemyAnimationAction('battle-idle');
        setNarration(isBoss ? (isDungeonEncounter ? 'O soberano da dungeon despertou.' : `O CHEFÃO DA FASE ${currentStage} RUGIU!`) : (isDungeonEncounter ? 'Uma presença da dungeon bloqueia seu caminho.' : 'Um inimigo se aproxima...'));
    
    try {
        const flavor = await generateBattleDescription(newEnemy.name, newEnemy.level);
        setNarration(flavor);
    } catch (e) {
        console.log("GenAI skipped");
    }
  };

  const startGame = () => {
    setStage(1);
    setKillCount(0);
        setDungeonEvolution(0);
        setPlayer(clonePlayer(INITIAL_PLAYER));
    setLogs([]);
        setDungeonRun(null);
        setDungeonResult(null);
        setPendingDungeonQueue([]);
        setCardRewardQueue([]);
        setCurrentCardOffer(null);
        setCurrentCardChoices([]);
    setPlayerAnimationAction('idle');
    setEnemyAnimationAction('battle-idle');
    setGameState(GameState.TAVERN);
  };

  const startDungeon = () => {
            const nextRun: DungeonRunState = {
                entrySnapshot: clonePlayer(player),
                rewards: createEmptyDungeonRewards(dungeonEvolution),
                evolution: dungeonEvolution,
            };
            setDungeonRun(nextRun);
            setLogs([]);
            setEnemy(null);
            enterBattle(false, 'dungeon', 0);
  };

  const enterBattle = (isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonClearedOverride?: number) => {
            const isDungeonBattle = mode === 'dungeon';
            const dungeonCleared = dungeonClearedOverride ?? dungeonRun?.rewards.clearedMonsters ?? 0;
            const activeDungeonEvolution = dungeonRun?.evolution ?? dungeonEvolution;
            const encounterStage = isDungeonBattle ? stage + Math.floor(dungeonCleared / 5) + Math.floor(activeDungeonEvolution / 2) : stage;
            setPlayer(prev => {
                const nextBuffs = { ...prev.buffs };
                if (prev.cardBonuses.openingAtkBuff > 0) {
                    nextBuffs.atkMod = Math.max(nextBuffs.atkMod, prev.cardBonuses.openingAtkBuff);
                    nextBuffs.atkTurns = Math.max(nextBuffs.atkTurns, 2);
                }
                if (prev.cardBonuses.openingDefBuff > 0) {
                    nextBuffs.defMod = Math.max(nextBuffs.defMod, prev.cardBonuses.openingDefBuff);
                    nextBuffs.defTurns = Math.max(nextBuffs.defTurns, 2);
                }
                return { ...prev, buffs: nextBuffs };
            });
    setGameState(GameState.BATTLE);
      setTurnState(TurnState.PLAYER_INPUT);
    setEnemyAnimationAction('battle-idle');
      setEnemy(null);
      setLogs([]);
      spawnEnemy(encounterStage, isBoss, mode, isDungeonBattle ? activeDungeonEvolution : undefined);
  }

    const handleChangePlayerClass = (classId: Player['classId']) => {
        setPlayer(prev => applyPlayerClass(prev, classId));
    };

  const handleLimitBreak = () => {
    if (turnState !== TurnState.PLAYER_INPUT || player.limitMeter < 100 || !enemy) return;

    setTurnState(TurnState.PLAYER_ANIMATION);
    setIsPlayerAttacking(true);
    
    const baseDamage = player.stats.atk * 5; // Massive damage
    const finalDamage = Math.floor(baseDamage * (1 + player.buffs.atkMod));

    addLog(`LIMIT BREAK! ${player.name} desencadeia um ataque devastador!`, 'crit');

    setTimeout(() => {
      setIsPlayerAttacking(false);
      spawnParticles([2, -0.5, 0], 40, '#facc15', 'explode');
      spawnFloatingText(`ULTIMATE! ${finalDamage}`, 'enemy', 'crit');
      setScreenShake(1.0);
      setIsEnemyHit(true);
      setTimeout(() => {
          setScreenShake(0);
          setIsEnemyHit(false);
      }, 500);

            const enemyRemainingHp = Math.max(0, enemy.stats.hp - finalDamage);
            triggerEnemyAnimationAction(enemyRemainingHp <= 0 ? 'death' : 'critical-hit', enemyRemainingHp <= 0 ? 900 : 620);

      setEnemy(prev => {
        if (!prev) return null;
        return { ...prev, stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) } };
      });

      setPlayer(prev => ({ ...prev, limitMeter: 0 }));

      setTimeout(() => {
                if (enemyRemainingHp <= 0) {
                        void handleVictory(900);
                        return;
                }
                setTurnState(TurnState.ENEMY_TURN);
      }, 1000);
    }, 800);
  };

  const handleFlee = () => {
      if (dungeonRun) {
          return;
      }

      const canLeaveFreely = killCount >= 10;
      const cost = canLeaveFreely ? 0 : 50;
      const lostGold = Math.min(player.gold, cost);

      setPlayer(prev => ({
          ...prev,
          gold: prev.gold - lostGold,
          stats: {
              ...prev.stats,
              hp: prev.stats.maxHp,
          },
          isDefending: false,
          buffs: { atkMod: 0, defMod: 0, atkTurns: 0, defTurns: 0, perfectEvadeTurns: 0, doubleAttackTurns: 0 } // Reset buffs on flee
      }));
      setKillCount(0);

      addLog(canLeaveFreely ? 'Saiu da batalha sem custo, recuperou toda a vida e reiniciou a fase.' : `Fugiu! Perdeu ${lostGold} Ouro, recuperou toda a vida e voltou ao inicio da fase.`, "info");
      setGameState(GameState.TAVERN);
      setEnemy(null);
  }

    const getEvadeChance = (
        attackerSpeed: number,
        defenderSpeed: number,
        defenderHasPerfectEvade: boolean = false,
        attackKind: 'physical' | 'magic' = 'physical',
        defenderIsDefending: boolean = false,
    ) => {
        if (defenderHasPerfectEvade) {
            return 1;
        }

        const speedDelta = defenderSpeed - attackerSpeed;
        let evadeChance = 0.03 + (speedDelta * 0.01);

        if (defenderIsDefending) {
            evadeChance += 0.04;
        }

        if (attackKind === 'magic') {
            evadeChance *= 0.45;
        }

        const cap = attackKind === 'magic' ? 0.12 : 0.22;
        return Math.max(0.01, Math.min(cap, evadeChance));
    };

    const calculateDamage = (
        attackerAtk: number,
        defenderDef: number,
        attackerSpeed: number,
        defenderSpeed: number,
        defenderHasPerfectEvade: boolean = false,
        multiplier: number = 1,
        luck: number = 0,
        isPlayerAttacking: boolean = false,
        attackKind: 'physical' | 'magic' = 'physical',
        defenderIsDefending: boolean = false,
    ) => {
    // Apply Player Buffs to Attack or Defense calculations
    let finalAtk = attackerAtk;
    let finalDef = defenderDef;

    if (isPlayerAttacking) {
        if (player.buffs.atkTurns > 0) {
            finalAtk *= (1 + player.buffs.atkMod);
        }
    } else {
        // Enemy Attacking, Player Defending
        if (player.buffs.defTurns > 0) {
            finalDef *= (1 + player.buffs.defMod);
        }
    }

        const evadeChance = getEvadeChance(attackerSpeed, defenderSpeed, defenderHasPerfectEvade, attackKind, defenderIsDefending);
        const evaded = Math.random() < evadeChance;
        if (evaded) {
            return {
                damage: 0,
                isCrit: false,
                evaded: true,
            };
        }

    const base = Math.max(1, finalAtk - (finalDef * 0.3)); 
    const variance = Math.random() * 0.2 + 0.9; 
    
    // Crit calculation
    const critChance = luck * 0.02; // 2% per luck point
    const isCrit = Math.random() < (0.05 + critChance);
    const critMult = isCrit ? 1.5 : 1;

    return { 
      damage: Math.floor(base * multiplier * variance * critMult), 
            isCrit,
            evaded: false,
    };
  };

    const consumePlayerTurnBuffs = (buffs: Player['buffs']) => {
            const nextBuffs = { ...buffs };
            if (nextBuffs.atkTurns > 0) nextBuffs.atkTurns--;
            if (nextBuffs.defTurns > 0) nextBuffs.defTurns--;
            if (nextBuffs.perfectEvadeTurns > 0) nextBuffs.perfectEvadeTurns--;
          if (nextBuffs.doubleAttackTurns > 0) nextBuffs.doubleAttackTurns--;
            return nextBuffs;
    };

    const getBossDamageMultiplier = () => {
        if (!enemy?.isBoss) return 1;
        return 1 + player.cardBonuses.bossDamageMultiplier;
    };

    const getHealingValue = (baseValue: number) => Math.floor(baseValue * (1 + player.cardBonuses.healingMultiplier));

    const getDungeonBaseDrop = (enemyType: Enemy['type']) => {
        if (enemyType === 'beast') {
            return Math.random() < 0.5 ? 'mat_obsidian_heart' : 'mat_ether_shard';
        }

        if (enemyType === 'humanoid') {
            return Math.random() < 0.5 ? 'mat_ether_shard' : 'mat_void_bloom';
        }

        return Math.random() < 0.5 ? 'mat_void_bloom' : 'mat_ether_shard';
    };

    const generateDungeonDrops = (targetEnemy: Enemy, evolution: number, wasBoss: boolean) => {
        const rewardDrops: string[] = [];

        if (Math.random() < 0.92) {
            rewardDrops.push(getDungeonBaseDrop(targetEnemy.type));
        }

        if (evolution >= 2 && Math.random() < 0.22) {
            rewardDrops.push('mat_iron');
        }

        if (evolution >= 4 && Math.random() < 0.16) {
            rewardDrops.push('mat_gold');
        }

        targetEnemy.guaranteedDrops?.forEach(dropId => rewardDrops.push(dropId));

        targetEnemy.rareDrops?.forEach(drop => {
            const finalChance = Math.min(0.92, drop.chance + (evolution * 0.02) + (wasBoss ? 0.08 : 0));
            if (Math.random() < finalChance) {
                rewardDrops.push(drop.itemId);
            }
        });

        if (!wasBoss && Math.random() < Math.min(0.45, 0.12 + (evolution * 0.03))) {
            rewardDrops.push(Math.random() < 0.55 ? 'pot_dg_mana' : 'pot_3');
        }

        if (wasBoss && evolution >= 3 && Math.random() < 0.28) {
            rewardDrops.push('pot_dg_elixir');
        }

        return rewardDrops;
    };

    const applyDropsToInventory = (inventory: Record<string, number>, rewardDrops: Record<string, number>) => {
        const mergedInventory = { ...inventory };
        Object.entries(rewardDrops).forEach(([itemId, quantity]) => {
            mergedInventory[itemId] = (mergedInventory[itemId] || 0) + quantity;
        });
        return mergedInventory;
    };

    const withdrawFromDungeon = (reason: string, consumeItemId?: string) => {
        if (!dungeonRun) {
            return false;
        }

        let updatedInventory = { ...player.inventory };
        if (consumeItemId) {
            const currentQty = updatedInventory[consumeItemId] || 0;
            if (currentQty <= 0) {
                return false;
            }

            updatedInventory[consumeItemId] = currentQty - 1;
        }

        let updatedPlayer = {
            ...player,
            xp: player.xp,
            gold: player.gold + dungeonRun.rewards.gold,
            diamonds: player.diamonds + dungeonRun.rewards.diamonds,
            inventory: applyDropsToInventory(updatedInventory, dungeonRun.rewards.drops),
            chosenCards: [...player.chosenCards],
            cardBonuses: { ...player.cardBonuses },
            buffs: { atkMod: 0, defMod: 0, atkTurns: 0, defTurns: 0, perfectEvadeTurns: 0, doubleAttackTurns: 0 },
            isDefending: false,
        };

        setPlayer(updatedPlayer);
        setDungeonResult({
            outcome: 'withdrawal',
            rewards: dungeonRun.rewards,
            reason,
        });
        setDungeonRun(null);
        setEnemy(null);
        setTurnState(TurnState.PLAYER_INPUT);
        setGameState(GameState.DUNGEON_RESULT);
        return true;
    };

  const handlePlayerAttack = () => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;

    setTurnState(TurnState.PLAYER_ANIMATION);
    setIsPlayerAttacking(true);
        setPlayerAnimationAction('attack');
                setEnemyAnimationAction(enemy.isDefending ? 'defend' : 'battle-idle');
    const doubleAttackActive = player.buffs.doubleAttackTurns > 0;
    // Weapon attack clip is longer than unarmed punch — resolve damage near the end of the animation
    const attackDelay = player.equippedWeapon ? 650 : 400;
    const idleDelay = player.equippedWeapon ? 400 : 550;

    const resolveStrike = (remainingHp: number, isFirstStrike: boolean) => {
        const attackResult = calculateDamage(
            player.stats.atk,
            enemy.stats.def,
            player.stats.speed,
            enemy.stats.speed,
            false,
            getBossDamageMultiplier(),
            player.stats.luck,
            true,
            'physical',
            isFirstStrike ? enemy.isDefending : false,
        );

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
        setTimeout(() => {
            setScreenShake(0);
            setIsEnemyHit(false);
        }, 200);

        const updatedHp = Math.max(0, remainingHp - appliedDamage);
        triggerEnemyAnimationAction(updatedHp <= 0 ? 'death' : attackResult.isCrit ? 'critical-hit' : 'hit', updatedHp <= 0 ? 900 : attackResult.isCrit ? 620 : 360);
        setEnemy(prev => {
            if (!prev) return null;
            return {
                ...prev,
                stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - appliedDamage) },
                isDefending: false,
            };
        });
        addLog(`${isFirstStrike ? 'Causou' : 'Segundo golpe:'} ${appliedDamage} dano!${isFirstStrike && enemy.isDefending ? ' (Defendido)' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
        return { remainingHp: updatedHp, defeated: updatedHp <= 0, evaded: false };
    };

    setTimeout(() => {
      setIsPlayerAttacking(false);

      const firstStrike = resolveStrike(enemy.stats.hp, true);
      if (firstStrike.defeated) {
          void handleVictory(900);
          return;
      }

      // If enemy evaded, wait for the full evade animation (520ms) before starting enemy turn
      const resolvedIdleDelay = firstStrike.evaded ? Math.max(idleDelay, 570) : idleDelay;
      if (!doubleAttackActive) {
          setTimeout(() => {
              setPlayerAnimationAction('idle');
              setTurnState(TurnState.ENEMY_TURN);
          }, resolvedIdleDelay);
          return;
      }

      addLog(`Presa Gêmea ativada: segundo golpe imediato!`, 'buff');
      setTimeout(() => {
          const secondStrike = resolveStrike(firstStrike.remainingHp, false);
          if (secondStrike.defeated) {
              void handleVictory(900);
              return;
          }
          setTimeout(() => {
              setPlayerAnimationAction('idle');
              setTurnState(TurnState.ENEMY_TURN);
          }, 450);
      }, 260);
    }, attackDelay);
  };

  const handlePlayerDefense = () => {
    if (!enemy || turnState !== TurnState.PLAYER_INPUT) return;

                setTurnState(TurnState.PLAYER_ANIMATION);
                setPlayerAnimationAction('defend');

        const manaRecovered = Math.max(1, Math.floor(player.stats.maxMp * (0.05 + player.cardBonuses.defendManaRestore)));

        setPlayer(prev => ({
                ...prev,
                isDefending: true,
                stats: {
                        ...prev.stats,
                        mp: Math.min(prev.stats.maxMp, prev.stats.mp + manaRecovered),
                },
        }));
        addLog(`Você se preparou para defender, ganhou evasão temporária e recuperou ${manaRecovered} MP!`, "buff");
    spawnFloatingText("DEFESA!", "player", "buff");
        spawnFloatingText(`+${manaRecovered} MP`, 'player', 'heal');
    spawnParticles([-2, -1, 0], 10, "#3b82f6", "spark");

    setTimeout(() => setTurnState(TurnState.ENEMY_TURN), 600);
  };

  const handleSkill = (skill: Skill) => {
      if (!enemy || turnState !== TurnState.PLAYER_INPUT || player.stats.mp < skill.manaCost) return;
      
      setTurnState(TurnState.PLAYER_ANIMATION);
      setPlayerAnimationAction(skill.type === 'heal' ? 'heal' : skill.type === 'magic' ? 'skill' : 'attack');
      setEnemyAnimationAction(enemy.isDefending ? 'defend' : 'battle-idle');
      setPlayer(p => ({ ...p, stats: { ...p.stats, mp: p.stats.mp - skill.manaCost } }));
      const visual = getSkillVisualConfig(skill);
      
      if (skill.type === 'heal') {
          const healAmount = getHealingValue(Math.floor(player.stats.maxHp * skill.damageMult));
          setPlayer(p => ({ ...p, stats: { ...p.stats, hp: Math.min(p.stats.maxHp, p.stats.hp + healAmount) }}));
          
          spawnParticles([-2, -1, 0], visual.particleCount + 14, visual.color, 'heal');
          spawnFloatingText(`+${healAmount}`, 'player', 'heal');
          addLog(`${skill.name}: curou ${healAmount} HP!`, 'heal');
          
          setTimeout(() => {
              setPlayerAnimationAction('idle');
              setTurnState(TurnState.ENEMY_TURN);
          }, 1500);
      } else {
          setIsPlayerAttacking(true);
          const doubleAttackActive = player.buffs.doubleAttackTurns > 0 && skill.type === 'physical';
          setTimeout(() => {
              setIsPlayerAttacking(false);

              const resolveSkillStrike = (remainingHp: number, isFirstStrike: boolean) => {
                  const attackResult = calculateDamage(
                      player.stats.atk,
                      enemy.stats.def,
                      player.stats.speed,
                      enemy.stats.speed,
                      false,
                      skill.damageMult * getBossDamageMultiplier(),
                      player.stats.luck,
                      true,
                      skill.type === 'magic' ? 'magic' : 'physical',
                      isFirstStrike ? enemy.isDefending : false,
                  );

                  if (attackResult.evaded) {
                      spawnFloatingText(isFirstStrike ? 'DESVIO!' : '2o DESVIO!', 'enemy', 'buff');
                      addLog(isFirstStrike ? `${enemy.name} desviou de ${skill.name}!` : `${enemy.name} desviou da repetição de ${skill.name}!`, 'evade');
                      triggerEnemyAnimationAction('evade', 520);
                      return { remainingHp, defeated: false };
                  }

                  const appliedDamage = isFirstStrike && enemy.isDefending ? Math.floor(attackResult.damage * 0.5) : attackResult.damage;
                  const strikePrefix = isFirstStrike ? '' : '2o '; 
                  spawnParticles([2, -0.5, 0], visual.particleCount + (isFirstStrike ? 0 : 4), visual.color, 'explode');
                  spawnFloatingText(attackResult.isCrit ? `${strikePrefix}CRIT! ${appliedDamage}` : `${strikePrefix}${appliedDamage}`, 'enemy', attackResult.isCrit ? 'crit' : 'damage');
                  setScreenShake(attackResult.isCrit ? visual.shake + 0.18 : visual.shake);
                  setTimeout(() => setScreenShake(0), 200);

                  const updatedHp = Math.max(0, remainingHp - appliedDamage);
                  triggerEnemyAnimationAction(updatedHp <= 0 ? 'death' : attackResult.isCrit ? 'critical-hit' : 'hit', updatedHp <= 0 ? 900 : attackResult.isCrit ? 620 : 360);
                  setEnemy(prev => {
                      if (!prev) return null;
                      return {
                          ...prev,
                          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - appliedDamage) },
                          isDefending: false,
                      };
                  });
                  addLog(`${isFirstStrike ? skill.name : `${skill.name} (2o golpe)`}: ${appliedDamage} dano!${isFirstStrike && enemy.isDefending ? ' (Defendido)' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
                  return { remainingHp: updatedHp, defeated: updatedHp <= 0 };
              };

              const firstStrike = resolveSkillStrike(enemy.stats.hp, true);
              if (firstStrike.defeated) {
                  void handleVictory(900);
                  return;
              }

              if (!doubleAttackActive) {
                  setTimeout(() => {
                      setPlayerAnimationAction('idle');
                      setTurnState(TurnState.ENEMY_TURN);
                  }, 800);
                  return;
              }

              addLog(`Presa Gêmea repetiu ${skill.name}!`, 'buff');
              setTimeout(() => {
                  const secondStrike = resolveSkillStrike(firstStrike.remainingHp, false);
                  if (secondStrike.defeated) {
                      void handleVictory(900);
                      return;
                  }
                  setTimeout(() => {
                      setPlayerAnimationAction('idle');
                      setTurnState(TurnState.ENEMY_TURN);
                  }, 700);
              }, 260);
          }, visual.castDelay);
      }
  };

  const handleUseItem = (itemId: string) => {
      if (turnState !== TurnState.PLAYER_INPUT) return;

      const item = ALL_ITEMS.find(i => i.id === itemId);
      const qty = player.inventory[itemId] || 0;
      if (!item || qty <= 0) return;

      if (item.id === 'pot_dg_recall') {
          if (!dungeonRun) {
              addLog('A Âncora de Retorno só funciona dentro da dungeon.', 'info');
              return;
          }

          const withdrew = withdrawFromDungeon('Você ativou a Âncora de Retorno e estabilizou uma rota de fuga, levando todo o espólio acumulado até aqui.', item.id);
          if (withdrew) {
              addLog('A Âncora de Retorno abriu uma saída segura da dungeon.', 'crit');
          }
          return;
      }

      if (gameState === GameState.BATTLE) {
          setTurnState(TurnState.PLAYER_ANIMATION);
          setPlayerAnimationAction('item');
      }

      // --- Side-effects OUTSIDE the updater to prevent React double-invocation duplication ---
      if (item.name.includes("Vida") || item.name.includes("Elixir") || item.name.includes("Ambrosia") || item.name.includes("Menor")) {
          const healVal = getHealingValue(item.value);
          spawnParticles([-2, -1, 0], 24, '#4ade80', 'heal');
          spawnFloatingText(`+${healVal}`, 'player', 'heal');
          addLog(`Usou ${item.name}, recuperou ${healVal} HP`, 'heal');
      } else if (item.name.includes("Mana")) {
          spawnParticles([-2, -1, 0], 24, '#3b82f6', 'heal');
          spawnFloatingText(`+${item.value} MP`, 'player', 'heal');
          addLog(`Usou ${item.name}, recuperou ${item.value} MP`, 'heal');
      } else if (item.id === 'pot_atk') {
          spawnParticles([-2, -1, 0], 15, '#f97316', 'spark');
          spawnFloatingText(`ATAQUE UP!`, 'player', 'buff');
          addLog(`Usou ${item.name}! Dano aumentado por ${item.duration} turnos.`, 'buff');
      } else if (item.id === 'pot_def') {
          spawnParticles([-2, -1, 0], 15, '#10b981', 'spark');
          spawnFloatingText(`DEFESA UP!`, 'player', 'buff');
          addLog(`Usou ${item.name}! Defesa aumentada por ${item.duration} turnos.`, 'buff');
      } else if (item.id === 'pot_alc_phantom_veil') {
          spawnParticles([-2, -1, 0], 18, '#a78bfa', 'spark');
          spawnFloatingText('INTANGIVEL!', 'player', 'buff');
          addLog(`Usou ${item.name}! Evasão perfeita ativa por ${item.duration || 4} turnos.`, 'crit');
      } else if (item.id === 'pot_alc_twin_fang') {
          spawnParticles([-2, -1, 0], 18, '#f97316', 'spark');
          spawnFloatingText('ATAQUE DUPLO!', 'player', 'buff');
          addLog(`Usou ${item.name}! O comando Atacar golpeia duas vezes por ${item.duration || 6} turnos.`, 'crit');
      }

      setPlayer(p => {
          const currentQty = p.inventory[itemId] || 0;
          if (currentQty <= 0) return p;

          const newInv = { ...p.inventory };
          newInv[itemId] = currentQty - 1;
          let newHp = p.stats.hp;
          let newMp = p.stats.mp;
          let newBuffs = { ...p.buffs };

          if (item.name.includes("Vida") || item.name.includes("Elixir") || item.name.includes("Ambrosia") || item.name.includes("Menor")) {
              newHp = Math.min(p.stats.maxHp, p.stats.hp + getHealingValue(item.value));
          } else if (item.name.includes("Mana")) {
              newMp = Math.min(p.stats.maxMp, p.stats.mp + item.value);
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

          return { ...p, inventory: newInv, stats: { ...p.stats, hp: newHp, mp: newMp }, buffs: newBuffs };
      });

      if (gameState === GameState.BATTLE) {
          setTimeout(() => {
              setPlayerAnimationAction('idle');
              setTurnState(TurnState.ENEMY_TURN);
          }, 1500);
      }
  };

  const handleEnemyTurn = () => {
    if (!enemy || gameState !== GameState.BATTLE) return;

    const shouldDefend = Math.random() < 0.2;
    // Reset defense from previous turn immediately
    setEnemy(prev => prev ? ({ ...prev, isDefending: false }) : null);

    if (shouldDefend) {
      // Defend in place — no movement toward hero
      setEnemy(prev => prev ? ({ ...prev, isDefending: true }) : null);
      addLog(`${enemy.name} está se defendendo e ficou mais difícil de acertar!`, "buff");
      spawnFloatingText("DEFESA!", "enemy", "buff");
      spawnParticles([2, -0.5, 0], 10, "#3b82f6", "spark");
      setPlayer(p => ({ ...p, buffs: consumePlayerTurnBuffs(p.buffs), isDefending: false }));
      setPlayerAnimationAction('idle');
      setTurnState(TurnState.PLAYER_INPUT);
      return;
    }

    // Enemy attacks — move toward hero and play attack animation
    setIsEnemyAttacking(true);
    triggerEnemyAnimationAction('attack', 750);

    // Damage lands mid-animation (~400ms), matching hero attack timing
    setTimeout(() => {
      const attackResult = calculateDamage(enemy.stats.atk, player.stats.def, enemy.stats.speed, player.stats.speed, player.buffs.perfectEvadeTurns > 0, 1, 0, false, 'physical', player.isDefending);

      if (attackResult.evaded) {
          spawnFloatingText('DESVIO!', 'player', 'buff');
          addLog(`Você desviou do ataque de ${enemy.name}!`, 'evade');
          setPlayer(p => ({ ...p, buffs: consumePlayerTurnBuffs(p.buffs), isDefending: false }));
          setPlayerAnimationAction('evade');
          // Wait for evade animation (520ms) and enemy to retreat (350ms) before giving turn back
          setTimeout(() => {
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
      setTimeout(() => {
          setScreenShake(0);
          setIsPlayerHit(false);
          setIsPlayerCritHit(false);
      }, 200);

      setPlayer(prev => {
          const nextBuffs = consumePlayerTurnBuffs(prev.buffs);
          return {
            ...prev,
            buffs: nextBuffs,
            isDefending: false,
            stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - finalDamage) }
          };
      });

      addLog(`${enemy.name} atacou: ${finalDamage} dano!${player.isDefending ? ' (Defendido)' : ''}${attackResult.isCrit ? ' CRITICO!' : ''}`, attackResult.isCrit ? 'crit' : 'damage');
      setPlayerAnimationAction(hitAnimationAction);
      if (hitAnimationAction !== 'death') {
          setTimeout(() => setPlayerAnimationAction('idle'), hitAnimationAction === 'defend-hit' ? 520 : hitAnimationAction === 'critical-hit' ? 620 : 360);
      }

      const hpRegen = remainingHpAfterHit > 0 ? Math.min(player.cardBonuses.hpRegenPerTurn, player.stats.maxHp - remainingHpAfterHit) : 0;
      const mpRegen = remainingHpAfterHit > 0 ? Math.min(player.cardBonuses.mpRegenPerTurn, player.stats.maxMp - player.stats.mp) : 0;

      // Enemy retreats after full attack animation completes (400 + 350 = 750ms total)
      setTimeout(() => {
        setIsEnemyAttacking(false);

        if (remainingHpAfterHit <= 0) {
           window.setTimeout(() => {
               if (dungeonRun) {
                  setPlayer(prev => ({
                      ...clonePlayer(dungeonRun.entrySnapshot),
                      xp: prev.xp,
                      level: prev.level,
                      xpToNext: prev.xpToNext,
                  }));
                  setDungeonResult({
                      outcome: 'defeat',
                      rewards: dungeonRun.rewards,
                      reason: enemy.isBoss ? 'O chefão final da dungeon venceu você. O espólio acumulado foi perdido, mas o XP obtido nas vitórias foi mantido.' : 'Você caiu antes de terminar a dungeon. O espólio acumulado foi perdido, mas o XP obtido nas vitórias foi mantido.',
                  });
                   setDungeonRun(null);
                   setEnemy(null);
                   setGameState(GameState.DUNGEON_RESULT);
               } else if (enemy.isBoss) {
                   setGameState(GameState.TAVERN);
                   setPlayer(p => ({ ...p, stats: { ...p.stats, hp: 1 }, buffs: { atkMod:0, defMod:0, atkTurns:0, defTurns:0, perfectEvadeTurns: 0, doubleAttackTurns: 0 }, isDefending: false }));
                   addLog('Derrotado pelo Chefão. Recuou para Taverna.', 'info');
               } else {
                   setGameState(GameState.GAME_OVER);
               }
           }, 900);
        } else {
           if (hpRegen > 0) { spawnFloatingText(`+${hpRegen} HP`, 'player', 'heal'); }
           if (mpRegen > 0) { spawnFloatingText(`+${mpRegen} MP`, 'player', 'heal'); }
           if (hpRegen > 0 || mpRegen > 0) {
               addLog(`Regeneração: +${hpRegen} HP ${mpRegen > 0 ? `/ +${mpRegen} MP` : ''}`.trim(), 'heal');
           }
           setPlayer(p => ({
               ...p,
               stats: {
                   ...p.stats,
                   hp: Math.min(p.stats.maxHp, p.stats.hp + hpRegen),
                   mp: Math.min(p.stats.maxMp, p.stats.mp + mpRegen),
               }
           }));
           setPlayer(p => ({ ...p, isDefending: false }));
           setTurnState(TurnState.PLAYER_INPUT);
        }
      }, 350);
    }, 400);
  };

  useEffect(() => {
    if (turnState === TurnState.ENEMY_TURN && enemy && gameState === GameState.BATTLE) {
       handleEnemyTurn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnState]);

    const handleVictory = async (delayMs = 0) => {
     if (!enemy) return;

        // Reset hero animation immediately so it doesn't stay frozen in attack/skill pose
        setPlayerAnimationAction('idle');

        if (delayMs > 0) {
                await new Promise<void>((resolve) => {
                        window.setTimeout(() => resolve(), delayMs);
                });
        }
     
    const xpGain = Math.floor(enemy.xpReward * (1 + player.cardBonuses.xpGainMultiplier));
    const goldGain = Math.floor(enemy.goldReward * (1 + player.cardBonuses.goldGainMultiplier));
     const wasBoss = enemy.isBoss;
     
     // Generate Drops
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
     }

      const dungeonEncounterNumber = dungeonRun ? dungeonRun.rewards.clearedMonsters + (wasBoss ? 0 : 1) : 0;
      const diamondGain = dungeonRun
          ? (wasBoss
                ? 3 + (Math.random() < 0.45 ? 1 : 0)
                : ((dungeonEncounterNumber % 10 === 0 ? 1 : 0) + (Math.random() < 0.08 ? 1 : 0)))
        : 0;

     const dropItems = drops.map(d => ALL_ITEMS.find(i => i.id === d)).filter((i): i is Item => Boolean(i));

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
         drops.forEach(dropId => {
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

         setPlayer(progressedDungeonPlayer);
         if (levelsGained > 0) {
             setPendingDungeonQueue(prev => [...prev, ...createLevelUpOffers(levelsGained)]);
         }

         addLog(`Vitória na dungeon! +${xpGain} XP ganho agora, +${goldGain} Ouro em reserva${diamondGain > 0 ? `, +${diamondGain} Diamante` : ''}.`, 'crit');
         setLootResult({ gold: goldGain, xp: xpGain, diamonds: diamondGain, drops: dropItems, isBoss: wasBoss, enemyName: enemy.name });
         setTimeout(() => setLootResult(null), 2800);
         setEnemy(null);
         setEnemyAnimationAction('battle-idle');

         if (wasBoss) {
             const nextEvolution = dungeonRun.evolution + 1;
             const nextTotalMonsters = getDungeonMonsterTarget(nextEvolution);
             let updatedPlayer = {
                 ...progressedDungeonPlayer,
                 gold: progressedDungeonPlayer.gold + nextRewards.gold,
                 diamonds: progressedDungeonPlayer.diamonds + nextRewards.diamonds,
                 inventory: applyDropsToInventory(progressedDungeonPlayer.inventory, nextRewards.drops),
                 chosenCards: [...progressedDungeonPlayer.chosenCards],
                 cardBonuses: { ...progressedDungeonPlayer.cardBonuses },
                 buffs: { atkMod: 0, defMod: 0, atkTurns: 0, defTurns: 0, perfectEvadeTurns: 0, doubleAttackTurns: 0 }
             };

             setPlayer(updatedPlayer);
             setDungeonEvolution(nextEvolution);
             setPendingDungeonQueue(prev => [{ source: 'boss', reason: `Recompensa da dungeon: ${enemy.name}` }, ...prev]);
             setDungeonResult({
                 outcome: 'victory',
                 rewards: nextRewards,
                 reason: `Você limpou a dungeon inteira e garantiu todo o espólio acumulado. A dungeon evoluiu para o nível ${nextEvolution} e agora exige ${nextTotalMonsters} monstros antes do chefão final.`,
                 nextEvolution,
                 nextTotalMonsters,
             });
             setDungeonRun(null);
             setGameState(GameState.DUNGEON_RESULT);
         } else {
             setDungeonRun({ ...dungeonRun, rewards: nextRewards });
             setNarration(clearedMonsters >= nextRewards.totalMonsters ? 'A câmara final se abriu. O chefão aguarda no fundo da dungeon.' : `A dungeon continua. Encontro ${clearedMonsters}/${nextRewards.totalMonsters}.`);
             setTimeout(() => {
                enterBattle(clearedMonsters >= nextRewards.totalMonsters, 'dungeon', clearedMonsters);
             }, 1500);
         }

         return;
     }

     const newInventory = { ...player.inventory };
     drops.forEach(d => {
         newInventory[d] = (newInventory[d] || 0) + 1;
     });

     // Give rewards
     let updatedPlayer = {
         ...player,
         xp: player.xp + xpGain,
         gold: player.gold + goldGain,
         inventory: newInventory,
         chosenCards: [...player.chosenCards],
         cardBonuses: { ...player.cardBonuses },
         buffs: { atkMod: 0, defMod: 0, atkTurns: 0, defTurns: 0, perfectEvadeTurns: 0, doubleAttackTurns: 0 } // Reset buffs on victory
     };

     // Update Stage Logic
     let levelsGained = 0;
     if (wasBoss) {
         setStage(s => s + 1);
         setKillCount(0);
     } else {
         setKillCount(k => k + 1);
     }

     // Check Level Up logic
     ({ nextPlayer: updatedPlayer, levelsGained } = applyLevelProgression(updatedPlayer));

     if (levelsGained > 0) {
         triggerLevelUpPulse();
     }

     setPlayer(updatedPlayer);
     
     let dropText = drops.length > 0 
        ? ` Drops: ${drops.map(d => ALL_ITEMS.find(i => i.id === d)?.name).join(', ')}` 
        : '';
     addLog(`Vitória! +${xpGain} XP, +${goldGain} Ouro.${dropText}`, 'crit');

     // Show kill loot overlay
     setLootResult({ gold: goldGain, xp: xpGain, drops: dropItems, isBoss: wasBoss, enemyName: enemy.name });
     setTimeout(() => setLootResult(null), 2800);

     // Logic for Auto Battle / Level Up Interruption
     setEnemy(null); // Clear enemy model immediately
    setEnemyAnimationAction('battle-idle');
     const queuedCardRewards: CardRewardOffer[] = [];
     if (wasBoss) {
        queuedCardRewards.push({ source: 'boss', reason: `Recompensa do chefao ${enemy.name}` });
     }
     if (levelsGained > 0) {
        queuedCardRewards.push(...createLevelUpOffers(levelsGained));
     }
     
     if (queuedCardRewards.length > 0) {
         setPostCardFlow(wasBoss ? 'victory' : 'resume-hunt');
         if (wasBoss) {
             generateVictorySpeech(enemy.name)
                .then(victoryText => setNarration(victoryText))
                .catch(() => undefined);
         }
         openCardRewardQueue(updatedPlayer, queuedCardRewards);
     } else if (wasBoss) {
         // Boss win -> Go to Victory Screen (which leads to Tavern)
         setGameState(GameState.VICTORY);
         try {
            const victoryText = await generateVictorySpeech(enemy.name);
            setNarration(victoryText);
         } catch(e) {}
     } else {
         // Normal Mob -> Auto Continue after delay
         setNarration("Procurando próximo inimigo...");
         setTimeout(() => {
            enterBattle(false);
         }, 1500);
     }
  };

  const handleCardSelection = (card: ProgressionCard) => {
      if (!currentCardOffer) return;

      addLog(`Carta escolhida: ${card.name}`, 'buff');
      const afterCardPlayer = applyCardChoice(player, card);
      const { nextPlayer, levelsGained } = applyLevelProgression(afterCardPlayer);
      let nextQueue = [...cardRewardQueue];

      if (levelsGained > 0) {
        triggerLevelUpPulse();
        nextQueue = [...createLevelUpOffers(levelsGained), ...nextQueue];
      }

      setPlayer(nextPlayer);
      continueProgressionFlow(nextPlayer, nextQueue);
  };

  const buyItem = (item: Item) => {
      if (player.gold >= item.cost && player.level >= item.minLevel) {
          setPlayer(p => {
              const newGold = p.gold - item.cost;
              const newInv = { ...p.inventory };

              newInv[item.id] = (newInv[item.id] || 0) + 1;
              return { ...p, gold: newGold, inventory: newInv };
          });
      }
  };

  const buyAlchemistCard = (offer: AlchemistCardOffer) => {
      if (player.diamonds < offer.cost || player.level < offer.card.minLevel || player.chosenCards.includes(offer.card.id)) {
          return;
      }

      let levelsGained = 0;
      setPlayer(prev => {
          if (prev.diamonds < offer.cost || prev.level < offer.card.minLevel || prev.chosenCards.includes(offer.card.id)) {
              return prev;
          }

          const afterCard = applyCardChoice(prev, offer.card);
          afterCard.diamonds -= offer.cost;

          const leveledPlayer = applyLevelProgression(afterCard);
          levelsGained = leveledPlayer.levelsGained;
          return leveledPlayer.nextPlayer;
      });

      if (levelsGained > 0) {
          triggerLevelUpPulse();
      }
  };

  const buyAlchemistItem = (offer: AlchemistItemOffer) => {
      if (player.diamonds < offer.cost || player.level < offer.item.minLevel) {
          return;
      }

      setPlayer(prev => {
          if (prev.diamonds < offer.cost || prev.level < offer.item.minLevel) {
              return prev;
          }

          return {
              ...prev,
              diamonds: prev.diamonds - offer.cost,
              inventory: {
                  ...prev.inventory,
                  [offer.item.id]: (prev.inventory[offer.item.id] || 0) + 1,
              },
          };
      });
  };

  const equipItem = (item: Item) => {
      setPlayer(p => {
          const qty = p.inventory[item.id];
          if (!qty || qty <= 0) return p;

          const newInv = { ...p.inventory };
          
          // Remove 1 from inventory
          newInv[item.id] = qty - 1;

          // Gear -> Equip Logic with Swap to Inventory
          let newStats = { ...p.stats };
          let newWep = p.equippedWeapon;
          let newArm = p.equippedArmor;
          let newHelm = p.equippedHelmet;
          let newLegs = p.equippedLegs;
          let newShield = p.equippedShield;

          // Helper: put old item into inventory
          const unequipToInventory = (oldItem: Item | null) => {
              if (oldItem) {
                  newInv[oldItem.id] = (newInv[oldItem.id] || 0) + 1;
              }
          }

          if (item.type === 'weapon') {
              unequipToInventory(newWep);
              if (newWep) newStats.atk -= newWep.value;
              newStats.atk += item.value;
              newWep = item;
          }
          if (item.type === 'armor') {
              unequipToInventory(newArm);
              if (newArm) newStats.def -= newArm.value;
              newStats.def += item.value;
              newArm = item;
          }
          if (item.type === 'helmet') {
              unequipToInventory(newHelm);
              if (newHelm) newStats.def -= newHelm.value;
              newStats.def += item.value;
              newHelm = item;
          }
          if (item.type === 'legs') {
              unequipToInventory(newLegs);
              if (newLegs) newStats.def -= newLegs.value;
              newStats.def += item.value;
              newLegs = item;
          }
          if (item.type === 'shield') {
              unequipToInventory(newShield);
              if (newShield) newStats.def -= newShield.value;
              newStats.def += item.value;
              newShield = item;
          }

          return { 
              ...p, 
              stats: newStats,
              inventory: newInv,
              equippedWeapon: newWep,
              equippedArmor: newArm,
              equippedHelmet: newHelm,
              equippedLegs: newLegs,
              equippedShield: newShield
          };
      });
  };

  const sellItem = (item: Item) => {
      const sellPrice = Math.floor(item.cost / 2);

      setPlayer(p => {
          const qty = p.inventory[item.id];
          if (!qty || qty <= 0) return p;

          const newInv = { ...p.inventory };
          newInv[item.id] = qty - 1;
          return { ...p, gold: p.gold + sellPrice, inventory: newInv };
      });
  };

    const resolvedGameState = (() => {
        if (gameState === GameState.CARD_REWARD && (!currentCardOffer || currentCardChoices.length === 0)) {
            return GameState.TAVERN;
        }

        if (gameState === GameState.DUNGEON_RESULT && !dungeonResult) {
            return GameState.TAVERN;
        }

        return gameState;
    })();

    if (pathname.startsWith('/developer')) {
        return <DeveloperConsole />;
    }

    if (!isBootReady) {
        return (
            <div className="w-full h-screen bg-black overflow-hidden select-none">
                <OpeningScreen classes={PLAYER_CLASSES} enemies={bootEnemies} onReady={handleBootReady} />
            </div>
        );
    }

  return (
    <div className="w-full h-screen bg-black overflow-hidden select-none">
            <SceneErrorBoundary>
                    <GameScene 
                        enemyColor={enemy?.color || '#ff0000'} 
                        enemyScale={enemy?.scale || 1}
                                        enemyName={enemy?.name}
                        turnState={turnState}
                        onGameTimeUpdate={setGameTime}
                                playerAnimationAction={playerAnimationAction === 'idle' && resolvedGameState === GameState.BATTLE ? 'battle-idle' : playerAnimationAction === 'defend-hit' || playerAnimationAction === 'evade' ? playerAnimationAction : player.isDefending ? 'defend' : playerAnimationAction}
                        isPlayerAttacking={isPlayerAttacking}
                        isEnemyAttacking={isEnemyAttacking}
                        particles={particles}
                        floatingTexts={floatingTexts}
                        equippedWeaponId={player.equippedWeapon?.id}
                        equippedArmorId={player.equippedArmor?.id}
                        equippedHelmetId={player.equippedHelmet?.id}
                        equippedLegsId={player.equippedLegs?.id}
                        equippedShieldId={player.equippedShield?.id}
                        enemyAssets={enemy?.assets}
                        enemyAttackStyle={enemy?.attackStyle}
                        enemyAnimationAction={enemyAnimationAction}
                        enemyType={enemy?.type || 'beast'}
                        isEnemyBoss={enemy?.isBoss}
                        isPlayerDefending={player.isDefending}
                        isEnemyDefending={enemy?.isDefending}
                        isPlayerHit={isPlayerHit}
                        isPlayerCritHit={isPlayerCritHit}
                        isEnemyHit={isEnemyHit}
                        hasPerfectEvadeAura={player.buffs.perfectEvadeTurns > 0}
                        hasDoubleAttackAura={player.buffs.doubleAttackTurns > 0}
                        screenShake={screenShake}
                        isLevelingUp={isLevelingUp}
                        stage={stage}
                        playerClassId={player.classId}
                                        isDungeonRun={Boolean(dungeonRun)}
                    />
            </SceneErrorBoundary>

            {resolvedGameState === GameState.MENU && <MenuScreen onStart={startGame} />}
      
            {resolvedGameState === GameState.TAVERN && (
          <TavernScreen 
            player={player}
            stage={stage}
            killCount={killCount}
                        dungeonEvolution={dungeonEvolution}
                        dungeonTotalMonsters={getDungeonMonsterTarget(dungeonEvolution)}
            onHunt={() => enterBattle(false)}
            onBoss={() => enterBattle(true)}
                        onDungeon={startDungeon}
            onShop={() => setGameState(GameState.SHOP)}
                        onAlchemist={() => setGameState(GameState.ALCHEMIST)}
                        onChangeClass={handleChangePlayerClass}
            shopItems={ALL_ITEMS}
            onEquipItem={equipItem}
            onUseItem={handleUseItem}
          />
      )}

            {resolvedGameState === GameState.CARD_REWARD && currentCardOffer && currentCardChoices.length > 0 && (
                    <CardChoiceScreen
                        offer={currentCardOffer}
                        cards={currentCardChoices}
                        onSelect={handleCardSelection}
                    />
            )}

            {resolvedGameState === GameState.SHOP && (
        <ShopScreen 
            player={player} 
            items={ALL_ITEMS} 
            onBuy={buyItem} 
            onSell={sellItem}
            onLeave={() => setGameState(GameState.TAVERN)} 
        />
      )}

            {resolvedGameState === GameState.ALCHEMIST && (
                <AlchemistScreen
                        player={player}
                        offers={ALCHEMIST_CARDS}
                    itemOffers={ALCHEMIST_ITEM_OFFERS}
                        onBuyCard={buyAlchemistCard}
                    onBuyItem={buyAlchemistItem}
                        onLeave={() => setGameState(GameState.TAVERN)}
                />
            )}

    {resolvedGameState === GameState.BATTLE && (
        <BattleHUD 
            player={player}
            enemy={enemy}
        gameState={resolvedGameState}
            turnState={turnState}
            logs={logs}
            onAttack={handlePlayerAttack}
            onDefend={handlePlayerDefense}
            onSkill={handleSkill}
            onUseItem={handleUseItem}
            onStartBattle={(isBoss) => enterBattle(isBoss)}
            onEnterShop={() => {}} // Disabled in battle
            onBuyItem={buyItem}
            onSellItem={sellItem}
            onEquipItem={equipItem}
            onContinue={() => {}}
            onFlee={handleFlee}
            currentNarration={narration}
            shopItems={ALL_ITEMS}
            floatingTexts={floatingTexts}
            stage={stage}
            killCount={killCount}
            isDungeonRun={Boolean(dungeonRun)}
                        dungeonRewards={dungeonRun?.rewards ?? null}
            dungeonCleared={dungeonRun?.rewards.clearedMonsters ?? 0}
            dungeonTotal={dungeonRun?.rewards.totalMonsters ?? 30}
            gameTime={gameTime}
        />
      )}

            {resolvedGameState === GameState.DUNGEON_RESULT && dungeonResult && (
        <DungeonResultScreen
            result={dungeonResult}
            onContinue={() => {
                const queue = [...pendingDungeonQueue];
                                const shouldOpenCards = queue.length > 0;
                setDungeonResult(null);
                setPendingDungeonQueue([]);

                if (shouldOpenCards) {
                    setPostCardFlow('tavern');
                    openCardRewardQueue(player, queue);
                } else {
                    setGameState(GameState.TAVERN);
                }
            }}
        />
      )}

      {resolvedGameState === GameState.VICTORY && (
          <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
              <div className="bg-slate-900/90 border-2 border-amber-500 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full animate-fade-in-down">
                  <h2 className="text-4xl font-black text-amber-400 mb-2">VITÓRIA!</h2>
                  <p className="text-slate-300 mb-8 italic">"{narration}"</p>
                  
                  <button onClick={() => setGameState(GameState.TAVERN)} className="w-full bg-amber-600 hover:bg-amber-500 py-4 rounded-xl font-bold flex flex-col items-center gap-2 shadow-lg shadow-amber-500/20 transition-transform hover:scale-105">
                      <Play />
                      <span>Voltar para Taverna</span>
                  </button>
              </div>
          </div>
      )}

      {resolvedGameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 z-50 bg-red-950/90 flex flex-col items-center justify-center text-white">
              <h1 className="text-6xl font-black mb-4 text-red-500 tracking-widest">GAME OVER</h1>
              <p className="text-2xl mb-8 opacity-70">Sua jornada terminou na Fase {stage}</p>
              <button onClick={startGame} className="px-10 py-4 bg-white text-red-900 font-black rounded hover:bg-gray-200 text-xl uppercase tracking-widest">
                  Renascer
              </button>
          </div>
      )}

      {lootResult && <KillLootOverlay loot={lootResult} />}
    </div>
  );
}
