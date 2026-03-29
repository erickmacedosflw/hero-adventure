
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShoppingBag, Play, Sword, Home } from 'lucide-react';
import { DeveloperConsole } from './components/DeveloperConsole';
import { GameScene } from './components/Scene3D';
import { OpeningScreen } from './components/OpeningScreen';
import { ClassSelectionScreen } from './components/ClassSelectionScreen';
import { BattleHUD, MenuScreen, ShopScreen, TavernScreen, KillLootOverlay, CardChoiceScreen, AlchemistScreen, DungeonResultScreen, BossVictoryModal } from './components/GameUI';
import { ARModeOverlay } from './components/ARModeOverlay';
import { ARCameraFallbackOverlay } from './components/ARCameraFallbackOverlay';
import { ARFallback3DOverlay } from './components/ARFallback3DOverlay';
import { 
    Player, Enemy, GameState, TurnState, BattleLog, Item, Skill, Stats, Particle, FloatingText, ProgressionCard, CardRewardOffer, AlchemistCardOffer, AlchemistItemOffer, DungeonRunState, DungeonResult, DungeonRewards, EnemyTemplate, DungeonEnemyTemplate, DungeonBossTemplate, PlayerAnimationAction, BossVictoryContext, CardCategory, ArEntryPoint
} from './types';
import { 
    INITIAL_PLAYER, SHOP_ITEMS, ALL_ITEMS, MATERIALS, SKILLS, ENEMY_DATA, ENEMY_COLORS, DUNGEON_ENEMY_DATA, DUNGEON_BOSS, ALCHEMIST_ITEM_OFFERS 
} from './constants';
import { PROGRESSION_CARDS, ALCHEMIST_CARDS } from './game/data/cards';
import { applyPlayerClass, PLAYER_CLASSES } from './game/data/classes';
import { gameMusicManager, isNightTime, type MusicTrackId } from './game/audio/music';
import { createEmptyBuffState } from './game/mechanics/combat';
import { createClassResourceState, getTalentBonuses, getUnlockedResourceMax, syncPlayerConstellationSkills, unlockTalentNode } from './game/mechanics/classProgression';
import { SavePayload, SaveSlotId, SaveSlotSummary, getActiveSaveSlotId, listSaveSlots, loadSaveFromSlot, saveToActiveSlot, setActiveSaveSlotId, clearSlot } from './game/mechanics/saveSystem';
import { useBattleController } from './game/hooks/useBattleController';
import { useBattleResolution } from './game/hooks/useBattleResolution';
import { useARCapabilities } from './game/hooks/useARCapabilities';
import { generateBattleDescription, generateVictorySpeech } from './services/geminiService';

type BootWindow = Window & { __heroAdventureBootReady?: boolean };
const MENU_CAMERA_TRANSITION_MS = 2500;
type SceneRegion = 'forest' | 'dungeon';
type OnboardingPhase = 'intro_camp' | 'post_first_hunt' | 'inventory_prompt' | 'inventory_unlocked' | 'cards_prompt' | 'cards_unlocked' | 'merchant_prompt' | 'merchant_unlocked' | 'items_prompt' | 'flee_prompt' | 'flee_unlocked';

const ONBOARDING_PHASES: OnboardingPhase[] = [
    'intro_camp',
    'post_first_hunt',
    'inventory_prompt',
    'inventory_unlocked',
    'cards_prompt',
    'cards_unlocked',
    'merchant_prompt',
    'merchant_unlocked',
    'items_prompt',
    'flee_prompt',
    'flee_unlocked',
];
const AUTOSAVE_DEBOUNCE_MS = 10000;

const coerceOnboardingPhase = (value: string): OnboardingPhase => {
    if (ONBOARDING_PHASES.includes(value as OnboardingPhase)) {
        return value as OnboardingPhase;
    }

    return 'intro_camp';
};

const formatSaveDate = (timestamp: number | null) => {
    if (!timestamp) {
        return 'Vazio';
    }

    return new Date(timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

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
        talentPoints: source.talentPoints,
        unlockedTalentNodeIds: [...source.unlockedTalentNodeIds],
        classResource: { ...source.classResource },
        statusEffects: [...source.statusEffects],
        chosenCards: [...source.chosenCards],
        cardBonuses: { ...source.cardBonuses },
        buffs: { ...source.buffs },
    });

    const getDungeonMonsterTarget = (evolution: number) => 10 + Math.floor(evolution / 3) * 10;
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

  const [gameState, setGameState] = useState<GameState>(GameState.TAVERN);
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
    const [postCardFlow, setPostCardFlow] = useState<'tavern' | 'boss-victory' | 'resume-hunt' | null>(null);
    const [dungeonRun, setDungeonRun] = useState<DungeonRunState | null>(null);
    const [dungeonResult, setDungeonResult] = useState<DungeonResult | null>(null);
    const [bossVictoryContext, setBossVictoryContext] = useState<BossVictoryContext | null>(null);
    const postCardFlowRef = useRef<'tavern' | 'boss-victory' | 'resume-hunt' | null>(null);
    const bossVictoryContextRef = useRef<BossVictoryContext | null>(null);
    const [pendingDungeonQueue, setPendingDungeonQueue] = useState<CardRewardOffer[]>([]);
    const [isBootReady, setIsBootReady] = useState(() => getBootReadyMemory());
    const [pathname, setPathname] = useState(() => window.location.pathname);
    const [selectedStartingClassId, setSelectedStartingClassId] = useState<Player['classId']>(INITIAL_PLAYER.classId);
    const [hasConfirmedStartingClass, setHasConfirmedStartingClass] = useState(false);
    const [isSaveSlotCatalogReady, setIsSaveSlotCatalogReady] = useState(false);
    const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>([]);
    const [selectedSaveSlotId, setSelectedSaveSlotId] = useState<SaveSlotId>(() => getActiveSaveSlotId());
    const [hasSavePromptDecision, setHasSavePromptDecision] = useState(false);
    const [resourceUnlockModal, setResourceUnlockModal] = useState<{ name: string; color: string } | null>(null);
    const [openConstellationToken, setOpenConstellationToken] = useState(0);
    const { arSupport, refreshArSupport } = useARCapabilities();
    const [isArOverlayOpen, setIsArOverlayOpen] = useState(false);
    const [arEntryPoint, setArEntryPoint] = useState<ArEntryPoint>('tavern');
    const [isArCameraOpen, setIsArCameraOpen] = useState(false);
    const [isArFallback3DOpen, setIsArFallback3DOpen] = useState(false);
    const [isWebXrRoutingOpen, setIsWebXrRoutingOpen] = useState(false);

    const bootEnemies = useMemo(() => [...ENEMY_DATA, ...DUNGEON_ENEMY_DATA, DUNGEON_BOSS], []);
    const handleBootReady = useCallback(() => {
        setBootReadyMemory(true);
        setIsBootReady(true);
    }, []);

    const createStartingPlayer = useCallback((classId: Player['classId']) => (
        syncPlayerConstellationSkills({
            ...applyPlayerClass(clonePlayer(INITIAL_PLAYER), classId),
            classId,
            classResource: createClassResourceState(classId),
            statusEffects: [],
        }, SKILLS)
    ), []);

    const handleOpenAr = useCallback((entryPoint: ArEntryPoint) => {
        setArEntryPoint(entryPoint);
        setIsArOverlayOpen(true);
        void refreshArSupport();
    }, [refreshArSupport]);

    const handleCloseAr = useCallback(() => {
        setIsArOverlayOpen(false);
    }, []);

    const handleOpenFallback3D = useCallback(() => {
        setIsArOverlayOpen(false);
        setIsArCameraOpen(false);
        setIsArFallback3DOpen(true);
    }, []);

    const handleCloseFallback3D = useCallback(() => {
        setIsArFallback3DOpen(false);
    }, []);

    const handleCloseCameraFallback = useCallback(() => {
        setIsArCameraOpen(false);
    }, []);

    const handleCloseWebXrRouting = useCallback(() => {
        setIsWebXrRoutingOpen(false);
    }, []);

    const handleStartArExperience = useCallback(() => {
        if (arSupport.strategy === 'webxr') {
            setIsArOverlayOpen(false);
            setIsWebXrRoutingOpen(true);
            return;
        }

        if (arSupport.strategy === 'camera-fallback') {
            setIsArOverlayOpen(false);
            setIsArFallback3DOpen(false);
            setIsArCameraOpen(true);
            return;
        }

        handleOpenFallback3D();
    }, [arSupport.strategy, handleOpenFallback3D]);

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
    const [levelUpCardCategory, setLevelUpCardCategory] = useState<CardCategory>('especial');
    const [playerAnimationAction, setPlayerAnimationAction] = useState<PlayerAnimationAction>('idle');
    const [enemyAnimationAction, setEnemyAnimationAction] = useState<PlayerAnimationAction>('battle-idle');
    const [menuHeroAction, setMenuHeroAction] = useState<PlayerAnimationAction>('idle');
    const [menuCameraFocusOverride, setMenuCameraFocusOverride] = useState<boolean | null>(null);
    const [showTavernUi, setShowTavernUi] = useState(true);
    const [sceneRegion, setSceneRegion] = useState<SceneRegion>('forest');
    const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>('intro_camp');
    const [hasPlayerDiedOnce, setHasPlayerDiedOnce] = useState(false);
    const [skillsUnlockPromptPending, setSkillsUnlockPromptPending] = useState(false);
    const [constellationUnlockPromptPending, setConstellationUnlockPromptPending] = useState(false);
    const [skillsActionUnlocked, setSkillsActionUnlocked] = useState(false);
    const previousSkillCountRef = useRef(player.skills.length);
    const enemyAnimationResetTimerRef = useRef<number | null>(null);
    const menuTransitionTimerRef = useRef<number | null>(null);
    const autosaveTimerRef = useRef<number | null>(null);
    const lastSavedSignatureRef = useRef<string>('');
    const wasResourceUnlockedRef = useRef(player.classResource.max > 0);
    const particleBudgetRef = useRef({
        windowStart: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        spawnedInWindow: 0,
    });

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

    const refreshSaveSlotCatalog = useCallback(() => {
        const slots = listSaveSlots();
        setSaveSlots(slots);
        return slots;
    }, []);

    const buildSavePayload = useCallback((stateOverride?: Partial<SavePayload>): SavePayload => ({
        player: clonePlayer(player),
        stage,
        killCount,
        dungeonEvolution,
        onboardingPhase,
        hasPlayerDiedOnce,
        skillsActionUnlocked,
        gameState,
        hasEnemy: Boolean(enemy),
        hadDungeonRun: Boolean(dungeonRun),
        sceneRegion,
        ...stateOverride,
    }), [dungeonEvolution, dungeonRun, enemy, gameState, hasPlayerDiedOnce, killCount, onboardingPhase, player, sceneRegion, skillsActionUnlocked, stage]);

    const persistSaveNow = useCallback((stateOverride?: Partial<SavePayload>) => {
        if (!hasConfirmedStartingClass) {
            return false;
        }

        const payload = buildSavePayload(stateOverride);
        const signature = JSON.stringify(payload);
        if (signature === lastSavedSignatureRef.current) {
            return false;
        }

        const saved = saveToActiveSlot(payload);
        if (!saved) {
            return false;
        }

        lastSavedSignatureRef.current = signature;
        return true;
    }, [buildSavePayload, hasConfirmedStartingClass]);

    const applyLoadedSave = useCallback((slotId: SaveSlotId) => {
        const loaded = loadSaveFromSlot(slotId);
        if (!loaded) {
            return false;
        }

        const { payload, interruptedBattle, interruptedDungeon } = loaded;
        const wasInterrupted = interruptedBattle || interruptedDungeon;
        const safePhase = coerceOnboardingPhase(payload.onboardingPhase);

        setActiveSaveSlotId(slotId);
        setSelectedSaveSlotId(slotId);
        setSelectedStartingClassId(payload.player.classId);
        setHasConfirmedStartingClass(true);

        setPlayer(clonePlayer(payload.player));
        setStage(payload.stage);
        setKillCount(wasInterrupted ? 0 : payload.killCount);
        setDungeonEvolution(payload.dungeonEvolution);
        setOnboardingPhase(safePhase);
        setHasPlayerDiedOnce(payload.hasPlayerDiedOnce || wasInterrupted);
        setSkillsActionUnlocked(payload.skillsActionUnlocked);
        previousSkillCountRef.current = payload.player.skills.length;

        setEnemy(null);
        setLogs(wasInterrupted
            ? [{ message: interruptedDungeon ? 'Run da dungeon encerrada por fechamento inesperado. Voce voltou ao acampamento e perdeu o espolio pendente.' : 'Batalha interrompida por fechamento inesperado. Derrota aplicada e retorno ao acampamento.', type: 'info' }]
            : []);
        setNarration(wasInterrupted
            ? interruptedDungeon
                ? 'Voce retornou ao acampamento apos interrupcao da dungeon.'
                : 'Voce retornou ao acampamento apos interrupcao de batalha.'
            : 'Progresso carregado.');
        setPostCardFlow(null);
        setDungeonRun(null);
        setDungeonResult(null);
        setBossVictoryContext(null);
        setPendingDungeonQueue([]);
        setCardRewardQueue([]);
        setCurrentCardOffer(null);
        setCurrentCardChoices([]);
        setTurnState(TurnState.PLAYER_INPUT);
        setPlayerAnimationAction('idle');
        setEnemyAnimationAction('battle-idle');
        setSceneRegion('forest');
        setMenuHeroAction('idle');
        setHasSavePromptDecision(true);

        if (wasInterrupted) {
            setGameState(GameState.TAVERN);
        } else {
            const resumableState = payload.gameState === GameState.TAVERN
                || payload.gameState === GameState.SHOP
                || payload.gameState === GameState.ALCHEMIST
                ? payload.gameState
                : GameState.TAVERN;
            setGameState(resumableState);
            setSceneRegion(payload.sceneRegion);
        }

        lastSavedSignatureRef.current = JSON.stringify(buildSavePayload({
            gameState: wasInterrupted ? GameState.TAVERN : payload.gameState,
            hasEnemy: false,
            hadDungeonRun: false,
            sceneRegion: wasInterrupted ? 'forest' : payload.sceneRegion,
            killCount: wasInterrupted ? 0 : payload.killCount,
        }));

        return true;
    }, [buildSavePayload]);

    useEffect(() => () => {
        if (enemyAnimationResetTimerRef.current !== null) {
            window.clearTimeout(enemyAnimationResetTimerRef.current);
        }
        if (menuTransitionTimerRef.current !== null) {
            window.clearTimeout(menuTransitionTimerRef.current);
        }
        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
        }
    }, []);

    useEffect(() => {
        if (!isBootReady || hasConfirmedStartingClass) {
            return;
        }

        const slots = refreshSaveSlotCatalog();
        setSelectedSaveSlotId(getActiveSaveSlotId());
        setHasSavePromptDecision(!slots.some((slot) => slot.hasSave));
        setIsSaveSlotCatalogReady(true);
    }, [hasConfirmedStartingClass, isBootReady, refreshSaveSlotCatalog]);

    useEffect(() => {
        if (!hasConfirmedStartingClass) {
            return;
        }

        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }

        autosaveTimerRef.current = window.setTimeout(() => {
            autosaveTimerRef.current = null;
            persistSaveNow();
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        };
    }, [
        dungeonEvolution,
        dungeonRun,
        enemy,
        gameState,
        hasConfirmedStartingClass,
        hasPlayerDiedOnce,
        killCount,
        onboardingPhase,
        persistSaveNow,
        player,
        sceneRegion,
        skillsActionUnlocked,
        stage,
        turnState,
    ]);

    useEffect(() => {
        if (!hasConfirmedStartingClass) {
            return;
        }

        const shouldFlushNow = (gameState === GameState.TAVERN || gameState === GameState.SHOP || gameState === GameState.ALCHEMIST || gameState === GameState.BOSS_VICTORY || gameState === GameState.DUNGEON_RESULT)
            && turnState === TurnState.PLAYER_INPUT;

        if (shouldFlushNow) {
            persistSaveNow();
        }
    }, [gameState, hasConfirmedStartingClass, persistSaveNow, turnState]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const flushBeforeUnload = () => {
            if (!hasConfirmedStartingClass) {
                return;
            }

            persistSaveNow();
        };

        window.addEventListener('beforeunload', flushBeforeUnload);
        return () => window.removeEventListener('beforeunload', flushBeforeUnload);
    }, [hasConfirmedStartingClass, persistSaveNow]);

    useEffect(() => {
        const isUnlockedNow = player.classResource.max > 0;
        const wasUnlocked = wasResourceUnlockedRef.current;

        if (!wasUnlocked && isUnlockedNow) {
            setResourceUnlockModal({
                name: player.classResource.name,
                color: player.classResource.color,
            });
        }

        wasResourceUnlockedRef.current = isUnlockedNow;
    }, [player.classResource.color, player.classResource.max, player.classResource.name]);

    useEffect(() => {
        if (!resourceUnlockModal) {
            return;
        }

        const timer = window.setTimeout(() => {
            setResourceUnlockModal(null);
        }, 2600);

        return () => {
            window.clearTimeout(timer);
        };
    }, [resourceUnlockModal]);

    useEffect(() => {
        postCardFlowRef.current = postCardFlow;
    }, [postCardFlow]);

    useEffect(() => {
        bossVictoryContextRef.current = bossVictoryContext;
    }, [bossVictoryContext]);

  // --- VFX SYSTEM ---
  const spawnParticles = (position: [number, number, number], count: number, color: string, type: 'explode' | 'heal' | 'spark') => {
      const densityMultiplier = type === 'explode' ? 0.72 : type === 'spark' ? 0.68 : 0.78;
      const targetCount = Math.max(6, Math.round(count * densityMultiplier));
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const windowDurationMs = 240;
      const hardBudgetPerWindow = 70;

      if (now - particleBudgetRef.current.windowStart > windowDurationMs) {
          particleBudgetRef.current.windowStart = now;
          particleBudgetRef.current.spawnedInWindow = 0;
      }

      const remainingBudget = Math.max(0, hardBudgetPerWindow - particleBudgetRef.current.spawnedInWindow);
      const finalCount = Math.max(4, Math.min(targetCount, remainingBudget));
      if (finalCount <= 0) {
          return;
      }

      particleBudgetRef.current.spawnedInWindow += finalCount;
      const shardChance = type === 'explode' ? 0.22 : type === 'spark' ? 0.14 : 0.08;
      const newParticles: Particle[] = [];

      for (let i = 0; i < finalCount; i++) {
          const isShard = Math.random() < shardChance;
          const spread = type === 'heal' ? 0.55 : isShard ? 1.45 : 1.1;
          const lift = type === 'heal' ? 1.75 : isShard ? 0.5 : 0.85;

          newParticles.push({
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
              position: [position[0], position[1], position[2]],
              color,
              scale: type === 'heal' ? 0.18 : isShard ? 0.13 : 0.24,
              life: 1.0,
              ttl: type === 'heal' ? 0.8 : isShard ? 0.7 : 0.92,
              renderMode: isShard ? 'shard3d' : 'sprite2d',
              velocity: [
                  (Math.random() - 0.5) * spread * 2,
                  (Math.random() - 0.5) * 1.7 + lift,
                  (Math.random() - 0.5) * spread * 2,
              ],
          });
      }

      const spawnedIds = new Set(newParticles.map((particle) => particle.id));
    setParticles((prev) => [...prev, ...newParticles].slice(-120));

      setTimeout(() => {
          setParticles((prev) => prev.filter((particle) => !spawnedIds.has(particle.id)));
      }, 1100);
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
      }].slice(-8));

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

    const applyLevelProgression = (basePlayer: Player, levelUpRecoveryRatio = 1) => {
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
            const safeRatio = Math.max(0, Math.min(1, levelUpRecoveryRatio));
            const hpRecovery = Math.max(1, Math.floor(nextPlayer.stats.maxHp * safeRatio));
            const mpRecovery = nextPlayer.stats.maxMp > 0
                ? Math.max(1, Math.floor(nextPlayer.stats.maxMp * safeRatio))
                : 0;

            nextPlayer.stats.hp = Math.min(nextPlayer.stats.maxHp, nextPlayer.stats.hp + hpRecovery);
            nextPlayer.stats.mp = Math.min(nextPlayer.stats.maxMp, nextPlayer.stats.mp + mpRecovery);
        }

        return { nextPlayer, levelsGained };
    };

    const triggerLevelUpPulse = (category: CardCategory = 'especial') => {
        setLevelUpCardCategory(category);
        setIsLevelingUp(true);
        window.setTimeout(() => setIsLevelingUp(false), 1100);
    };

    const getSkillVisualConfig = (skill: Skill) => {
        if (skill.visualTheme === 'steel') return { color: '#93c5fd', particleCount: 22, shake: 0.28, castDelay: 520 };
        if (skill.visualTheme === 'solar') return { color: '#fbbf24', particleCount: 28, shake: 0.36, castDelay: 560 };
        if (skill.visualTheme === 'ember') return { color: '#fb7185', particleCount: 26, shake: 0.34, castDelay: 540 };
        if (skill.visualTheme === 'rage') return { color: '#f97316', particleCount: 34, shake: 0.7, castDelay: 620 };
        if (skill.visualTheme === 'storm') return { color: '#22c55e', particleCount: 20, shake: 0.26, castDelay: 500 };
        if (skill.visualTheme === 'frost') return { color: '#38bdf8', particleCount: 24, shake: 0.24, castDelay: 560 };
        if (skill.visualTheme === 'arcane') return { color: '#a78bfa', particleCount: 30, shake: 0.44, castDelay: 600 };
        if (skill.visualTheme === 'verdant') return { color: '#14b8a6', particleCount: 22, shake: 0.08, castDelay: 540 };
        if (skill.visualTheme === 'thorn') return { color: '#84cc16', particleCount: 24, shake: 0.32, castDelay: 520 };
        if (skill.visualTheme === 'shadow') return { color: '#818cf8', particleCount: 24, shake: 0.3, castDelay: 500 };
        if (skill.visualTheme === 'blood') return { color: '#ef4444', particleCount: 28, shake: 0.42, castDelay: 520 };
        if (skill.visualTheme === 'lunar') return { color: '#c084fc', particleCount: 30, shake: 0.46, castDelay: 580 };
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

    const handleUnlockTalent = (nodeId: string) => {
        setPlayer((prev) => {
            const result = unlockTalentNode(prev, nodeId, SKILLS);
            if (!result) {
                return prev;
            }

            addLog(`Constelacao: ${result.node.title} ativada.`, 'buff');
            return result.player;
        });
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

    const continueProgressionFlow = (
        currentPlayer: Player,
        queue: CardRewardOffer[],
        flowOverride?: 'tavern' | 'boss-victory' | 'resume-hunt' | null,
    ) => {
        if (queue.length === 0) {
            setCurrentCardOffer(null);
            setCurrentCardChoices([]);
            setCardRewardQueue([]);
            const nextFlow = flowOverride ?? postCardFlowRef.current;
            const nextBossContext = bossVictoryContextRef.current;

            if (nextFlow === 'resume-hunt') {
                setNarration('Procurando próximo inimigo...');
                enterBattle(false);
                setPostCardFlow(null);
                return;
            }

            setPostCardFlow(null);

            if (nextFlow === 'boss-victory' && nextBossContext) {
                setGameState(GameState.BOSS_VICTORY);
                return;
            }

            if (nextBossContext) {
                setGameState(GameState.BOSS_VICTORY);
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
            statusEffects: [],
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

    const handleContinueFromSave = () => {
        const restored = applyLoadedSave(selectedSaveSlotId);
        if (!restored) {
            const slots = refreshSaveSlotCatalog();
            setHasSavePromptDecision(!slots.some((slot) => slot.hasSave));
        }
    };

    const handleNewGameFromSlot = () => {
        clearSlot(selectedSaveSlotId);
        setActiveSaveSlotId(selectedSaveSlotId);
        setHasSavePromptDecision(true);
        refreshSaveSlotCatalog();
        lastSavedSignatureRef.current = '';
    };

    const startGame = (classId: Player['classId'] = selectedStartingClassId) => {
        const startingPlayer = createStartingPlayer(classId);
    setActiveSaveSlotId(selectedSaveSlotId);
    setStage(1);
    setKillCount(0);
        setDungeonEvolution(0);
        setSelectedStartingClassId(classId);
        setHasConfirmedStartingClass(true);
        setHasSavePromptDecision(true);
                setPlayer(startingPlayer);
    setLogs([]);
        setNarration('');
        setPostCardFlow(null);
        setDungeonRun(null);
        setDungeonResult(null);
        setBossVictoryContext(null);
        setPendingDungeonQueue([]);
        setCardRewardQueue([]);
        setCurrentCardOffer(null);
        setCurrentCardChoices([]);
    setPlayerAnimationAction('idle');
    setEnemyAnimationAction('battle-idle');
    setSceneRegion('forest');
    setOnboardingPhase('intro_camp');
    setHasPlayerDiedOnce(false);
        setSkillsUnlockPromptPending(false);
        setConstellationUnlockPromptPending(false);
        setSkillsActionUnlocked(false);
        previousSkillCountRef.current = startingPlayer.skills.length;
    setGameState(GameState.TAVERN);

        // Baseline save for the selected slot right after starting a fresh run.
        window.setTimeout(() => {
            saveToActiveSlot({
                player: clonePlayer(startingPlayer),
                stage: 1,
                killCount: 0,
                dungeonEvolution: 0,
                onboardingPhase: 'intro_camp',
                hasPlayerDiedOnce: false,
                skillsActionUnlocked: false,
                gameState: GameState.TAVERN,
                hasEnemy: false,
                hadDungeonRun: false,
                sceneRegion: 'forest',
            });
            refreshSaveSlotCatalog();
        }, 0);
  };

  const startDungeon = () => {
            setSceneRegion('dungeon');
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

  const enterBattleImmediate = (isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonClearedOverride?: number) => {
            const isDungeonBattle = mode === 'dungeon';
            if (mode === 'hunt' && onboardingPhase === 'merchant_unlocked') {
                setOnboardingPhase('items_prompt');
            }
            setSceneRegion(isDungeonBattle ? 'dungeon' : 'forest');
            const dungeonCleared = dungeonClearedOverride ?? dungeonRun?.rewards.clearedMonsters ?? 0;
            const activeDungeonEvolution = dungeonRun?.evolution ?? dungeonEvolution;
            const encounterStage = isDungeonBattle ? stage + Math.floor(dungeonCleared / 5) + Math.floor(activeDungeonEvolution / 2) : stage;
            setPlayer(prev => {
                const nextBuffs = { ...prev.buffs };
                const talentBonuses = getTalentBonuses(prev);
                const resourceMax = getUnlockedResourceMax(prev);
                if (prev.cardBonuses.openingAtkBuff > 0) {
                    nextBuffs.atkMod = Math.max(nextBuffs.atkMod, prev.cardBonuses.openingAtkBuff);
                    nextBuffs.atkTurns = Math.max(nextBuffs.atkTurns, 2);
                }
                if (prev.cardBonuses.openingDefBuff > 0) {
                    nextBuffs.defMod = Math.max(nextBuffs.defMod, prev.cardBonuses.openingDefBuff);
                    nextBuffs.defTurns = Math.max(nextBuffs.defTurns, 2);
                }
                return {
                    ...prev,
                    buffs: nextBuffs,
                    isDefending: false,
                    statusEffects: [],
                    classResource: {
                        ...prev.classResource,
                        max: resourceMax,
                        value: resourceMax > 0 ? Math.min(resourceMax, talentBonuses.resourceStart) : 0,
                    },
                };
            });
    setGameState(GameState.BATTLE);
            setPlayerAnimationAction('battle-idle');
      setTurnState(TurnState.PLAYER_INPUT);
    setEnemyAnimationAction('battle-idle');
      setEnemy(null);
      setLogs([]);
      spawnEnemy(encounterStage, isBoss, mode, isDungeonBattle ? activeDungeonEvolution : undefined);
  };

  const enterBattle = (isBoss: boolean, mode: 'hunt' | 'dungeon' = dungeonRun ? 'dungeon' : 'hunt', dungeonClearedOverride?: number) => {
      if (resolvedGameState !== GameState.TAVERN) {
          enterBattleImmediate(isBoss, mode, dungeonClearedOverride);
          return;
      }

      if (menuTransitionTimerRef.current !== null) {
          return;
      }

      setShowTavernUi(false);
      setMenuCameraFocusOverride(false);
      menuTransitionTimerRef.current = window.setTimeout(() => {
          menuTransitionTimerRef.current = null;
          setMenuCameraFocusOverride(null);
          enterBattleImmediate(isBoss, mode, dungeonClearedOverride);
      }, MENU_CAMERA_TRANSITION_MS);
  };

    const handleChangePlayerClass = (classId: Player['classId']) => {
        setPlayer(prev => syncPlayerConstellationSkills({
            ...applyPlayerClass(prev, classId),
            classResource: createClassResourceState(classId),
            statusEffects: [],
        }, SKILLS));
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
          buffs: createEmptyBuffState() // Reset buffs on flee
      }));
      setKillCount(0);

      addLog(canLeaveFreely ? 'Saiu da batalha sem custo, recuperou toda a vida e reiniciou a fase.' : `Fugiu! Perdeu ${lostGold} Ouro, recuperou toda a vida e voltou ao inicio da fase.`, "info");
      setGameState(GameState.TAVERN);
      setEnemy(null);
  }

  const respawnAtCamp = () => {
      setOnboardingPhase((prev) => {
          if (prev === 'merchant_prompt' || prev === 'merchant_unlocked' || prev === 'items_prompt' || prev === 'flee_prompt' || prev === 'flee_unlocked') {
              return prev;
          }

          return 'merchant_prompt';
      });
      setPlayer((prev) => ({
          ...prev,
          stats: {
              ...prev.stats,
              hp: prev.stats.maxHp,
              mp: prev.stats.maxMp,
          },
          isDefending: false,
          buffs: createEmptyBuffState(),
          statusEffects: [],
      }));
      setEnemy(null);
      setKillCount(0);
      setLogs([]);
      setTurnState(TurnState.PLAYER_INPUT);
      setNarration('Voce se recuperou no acampamento.');
      setGameState(GameState.TAVERN);
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
            buffs: createEmptyBuffState(),
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







  const { handleVictory } = useBattleResolution({
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
        shouldForceFirstEnemyDrop: onboardingPhase === 'intro_camp',
        shouldTriggerInventoryUnlockTutorial: onboardingPhase === 'intro_camp' || onboardingPhase === 'post_first_hunt',
        onTriggerInventoryUnlockTutorial: () => setOnboardingPhase('inventory_prompt'),
        shouldTriggerConstellationUnlockTutorial: player.talentPoints === 0 && player.unlockedTalentNodeIds.length === 0,
        onTriggerConstellationUnlockTutorial: () => setConstellationUnlockPromptPending(true),
          allowPotionDrops: hasPlayerDiedOnce,
  });

  const { handlePlayerAttack, handlePlayerDefense, handleSkill, handleUseItem, handleEnemyTurn } = useBattleController({
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
        onPlayerDefeat: () => setHasPlayerDiedOnce(true),
  });

  useEffect(() => {
    if (turnState === TurnState.ENEMY_TURN && enemy && gameState === GameState.BATTLE) {
      handleEnemyTurn();
    }
  }, [enemy, gameState, handleEnemyTurn, turnState]);

    useEffect(() => {
            const hasPendingCardChoice = Boolean(currentCardOffer) || currentCardChoices.length > 0 || cardRewardQueue.length > 0;

          if (gameState === GameState.BATTLE && !enemy && bossVictoryContext && !hasPendingCardChoice && postCardFlow !== 'boss-victory') {
                    setGameState(GameState.BOSS_VICTORY);
            }
      }, [bossVictoryContext, cardRewardQueue.length, currentCardChoices.length, currentCardOffer, enemy, gameState, postCardFlow]);

  const handleCardSelection = (card: ProgressionCard) => {
      if (!currentCardOffer) return;

      addLog(`Carta escolhida: ${card.name}`, 'buff');
      triggerLevelUpPulse(card.category);
      const afterCardPlayer = applyCardChoice(player, card);
      const { nextPlayer, levelsGained } = applyLevelProgression(afterCardPlayer);
      let nextQueue = [...cardRewardQueue];
            const shouldTriggerCardsUnlockTutorial = currentCardOffer.source === 'level-up' && onboardingPhase === 'inventory_unlocked';

      if (levelsGained > 0) {
        nextQueue = [...createLevelUpOffers(levelsGained), ...nextQueue];
      }

            if (shouldTriggerCardsUnlockTutorial) {
                setOnboardingPhase('cards_prompt');
            }

      setPlayer(nextPlayer);
              continueProgressionFlow(nextPlayer, nextQueue, postCardFlowRef.current);
  };

  const handleBossVictoryContinue = () => {
      if (!bossVictoryContext) {
          setGameState(GameState.TAVERN);
          return;
      }

      setPostCardFlow(null);

      if (bossVictoryContext.mode === 'hunt') {
          setBossVictoryContext(null);
          enterBattle(false);
          return;
      }

      const nextEvolution = bossVictoryContext.nextEvolution ?? dungeonEvolution;
      const nextRun: DungeonRunState = {
          entrySnapshot: clonePlayer(player),
          rewards: createEmptyDungeonRewards(nextEvolution),
          evolution: nextEvolution,
      };

      setBossVictoryContext(null);
      setDungeonResult(null);
      setPendingDungeonQueue([]);
      setDungeonRun(nextRun);
      setLogs([]);
      setEnemy(null);
      setNarration(`A dungeon evoluiu para o nivel ${nextEvolution}. Um novo ciclo comecou.`);
      enterBattle(false, 'dungeon', 0);
  };

  const handleBossVictoryExit = () => {
      setBossVictoryContext(null);
      setPostCardFlow(null);
      setDungeonResult(null);
      setPendingDungeonQueue([]);
      setGameState(GameState.TAVERN);
  };

  const handleOpenConstellationFromBossModal = () => {
      setBossVictoryContext(null);
      setPostCardFlow(null);
      setDungeonResult(null);
      setPendingDungeonQueue([]);
      setGameState(GameState.TAVERN);
      setOpenConstellationToken((prev) => prev + 1);
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
          triggerLevelUpPulse(offer.card.category);
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
            if (postCardFlow === 'boss-victory' && bossVictoryContext) {
                return GameState.BOSS_VICTORY;
            }

            if (postCardFlow === 'resume-hunt') {
                return GameState.BATTLE;
            }

            return GameState.TAVERN;
        }

        if (gameState === GameState.DUNGEON_RESULT && !dungeonResult) {
            return GameState.TAVERN;
        }

        if (gameState === GameState.BOSS_VICTORY && !bossVictoryContext) {
            return GameState.TAVERN;
        }

        return gameState;
    })();
    const isCampIntroRestricted = onboardingPhase === 'intro_camp'
        || onboardingPhase === 'post_first_hunt'
        || onboardingPhase === 'inventory_prompt'
        || onboardingPhase === 'inventory_unlocked'
        || onboardingPhase === 'cards_prompt'
        || onboardingPhase === 'cards_unlocked'
        || onboardingPhase === 'merchant_prompt';
    const isProfileStatusOnly = true;
    const isFirstBattleActionRestricted = false;
    const isInventoryUnlocked = onboardingPhase === 'inventory_unlocked' || onboardingPhase === 'cards_prompt' || onboardingPhase === 'cards_unlocked' || onboardingPhase === 'merchant_prompt' || onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked';
    const isCardsUnlocked = onboardingPhase === 'cards_prompt' || onboardingPhase === 'cards_unlocked' || onboardingPhase === 'merchant_prompt' || onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked';
    const isItemsActionUnlocked = onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked';
    const isFleeUnlocked = onboardingPhase === 'flee_unlocked';
    const isSkillsActionUnlocked = skillsActionUnlocked;
    const isMerchantUnlocked = onboardingPhase === 'merchant_unlocked' || onboardingPhase === 'items_prompt' || onboardingPhase === 'flee_prompt' || onboardingPhase === 'flee_unlocked';
    const isDungeonUnlocked = false;
    const shouldMenuCameraFocus = menuCameraFocusOverride ?? (resolvedGameState === GameState.TAVERN);
    const previousResolvedGameStateRef = useRef<GameState>(resolvedGameState);

    useEffect(() => {
        if (onboardingPhase !== 'intro_camp') {
            return;
        }

        if (killCount > 0) {
            setOnboardingPhase('post_first_hunt');
        }
    }, [killCount, onboardingPhase]);

    useEffect(() => {
        const previousSkillCount = previousSkillCountRef.current;
        const currentSkillCount = player.skills.length;

        if (previousSkillCount === 0 && currentSkillCount > 0 && !skillsActionUnlocked && !skillsUnlockPromptPending) {
            setSkillsUnlockPromptPending(true);
            setSkillsActionUnlocked(true);
        }

        previousSkillCountRef.current = currentSkillCount;
    }, [player.skills.length, skillsActionUnlocked, skillsUnlockPromptPending]);

    useEffect(() => {
        const previousState = previousResolvedGameStateRef.current;

        if (resolvedGameState === GameState.TAVERN && previousState === GameState.BATTLE) {
            if (menuTransitionTimerRef.current !== null) {
                window.clearTimeout(menuTransitionTimerRef.current);
                menuTransitionTimerRef.current = null;
            }

            setShowTavernUi(false);
            setMenuCameraFocusOverride(true);
            menuTransitionTimerRef.current = window.setTimeout(() => {
                menuTransitionTimerRef.current = null;
                setMenuCameraFocusOverride(null);
                setShowTavernUi(true);
            }, MENU_CAMERA_TRANSITION_MS);
        }
        if (resolvedGameState === GameState.TAVERN && previousState !== GameState.TAVERN && previousState !== GameState.BATTLE) {
            setMenuCameraFocusOverride(null);
            setShowTavernUi(true);
        }

        if (resolvedGameState !== GameState.TAVERN) {
            setShowTavernUi(false);
        }

        previousResolvedGameStateRef.current = resolvedGameState;
    }, [resolvedGameState]);

    useEffect(() => {
        if (resolvedGameState !== GameState.TAVERN) {
            setMenuHeroAction('idle');
            return;
        }

        setMenuHeroAction('idle');
        const first = window.setTimeout(() => {
            setMenuHeroAction('item');
            window.setTimeout(() => setMenuHeroAction('idle'), 720);
        }, 1300);
        const interval = window.setInterval(() => {
            setMenuHeroAction('item');
            window.setTimeout(() => setMenuHeroAction('idle'), 720);
        }, 3600);

        return () => {
            window.clearTimeout(first);
            window.clearInterval(interval);
        };
    }, [resolvedGameState]);

    const [hasUnlockedMusic, setHasUnlockedMusic] = useState(false);
    const targetMusicTrack = useMemo<MusicTrackId | null>(() => {
        if (pathname.startsWith('/developer')) {
            return null;
        }

        if (!isBootReady || !hasConfirmedStartingClass || resolvedGameState === GameState.MENU) {
            return 'title';
        }

        if (dungeonRun) {
            return 'dungeon';
        }

        if (resolvedGameState === GameState.BATTLE) {
            return isNightTime(gameTime) ? 'forestNight' : 'forestDay';
        }

        return sceneRegion === 'dungeon' ? 'dungeon' : 'title';
    }, [dungeonRun, gameTime, hasConfirmedStartingClass, isBootReady, pathname, resolvedGameState, sceneRegion]);

    useEffect(() => {
        if (typeof window === 'undefined' || hasUnlockedMusic) {
            return;
        }

        const unlockMusic = () => {
            gameMusicManager.unlock().finally(() => {
                setHasUnlockedMusic(true);
            });
        };

        window.addEventListener('pointerdown', unlockMusic, { once: true });
        window.addEventListener('keydown', unlockMusic, { once: true });

        return () => {
            window.removeEventListener('pointerdown', unlockMusic);
            window.removeEventListener('keydown', unlockMusic);
        };
    }, [hasUnlockedMusic]);

    useEffect(() => {
        if (!hasUnlockedMusic) {
            return;
        }

        if (!targetMusicTrack) {
            gameMusicManager.stopAll();
            return;
        }

        gameMusicManager.transitionTo(targetMusicTrack);
    }, [hasUnlockedMusic, targetMusicTrack]);

    useEffect(() => () => {
        gameMusicManager.dispose();
    }, []);

    const hasAnySaveSlot = saveSlots.some((slot) => slot.hasSave);
    const selectedSlotSummary = saveSlots.find((slot) => slot.slotId === selectedSaveSlotId) ?? null;
    const canContinueSelectedSlot = Boolean(selectedSlotSummary?.hasSave);

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

    if (!hasConfirmedStartingClass) {
        if (!isSaveSlotCatalogReady) {
            return (
                <div className="w-full h-screen bg-[#ead6c2] overflow-hidden select-none flex items-center justify-center">
                    <div className="rounded-[22px] border border-[#cfab91] bg-[#f7ecdd] px-6 py-5 text-center shadow-[0_18px_42px_rgba(54,26,33,0.2)]">
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Sincronizando</div>
                        <div className="mt-2 font-gamer text-2xl font-black text-[#6b3141]">Lendo slots locais</div>
                    </div>
                </div>
            );
        }

        if (hasAnySaveSlot && !hasSavePromptDecision) {
            return (
                <div className="w-full h-screen bg-[#ead6c2] overflow-hidden select-none relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(107,49,65,0.16),transparent_42%),linear-gradient(180deg,#f7ecdd_0%,#edd8c0_100%)]" />
                    <div className="relative z-10 flex h-full items-center justify-center px-4">
                        <div className="w-full max-w-3xl rounded-[30px] border border-[#cfab91] bg-[#fff8ef] p-5 shadow-[0_30px_80px_rgba(54,26,33,0.28)] sm:p-7">
                            <div className="text-center">
                                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#9a7068]">Modo Offline</div>
                                <h2 className="mt-2 font-gamer text-3xl font-black text-[#6b3141] sm:text-4xl">Selecionar save local</h2>
                                <p className="mt-2 text-sm text-[#7f5b56]">Escolha um slot para continuar de onde parou ou iniciar uma nova jornada.</p>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                {saveSlots.map((slot) => {
                                    const isSelected = selectedSaveSlotId === slot.slotId;
                                    return (
                                        <button
                                            key={slot.slotId}
                                            onClick={() => {
                                                setSelectedSaveSlotId(slot.slotId);
                                                setActiveSaveSlotId(slot.slotId);
                                            }}
                                            className={`rounded-[18px] border px-4 py-4 text-left transition-all ${isSelected ? 'border-[#6b3141] bg-[#f7ecdd] shadow-[0_10px_24px_rgba(107,49,65,0.22)]' : 'border-[#d9bda8] bg-[#fffdf9] hover:border-[#b88f7b]'}`}
                                        >
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Slot {slot.slotId}</div>
                                            <div className="mt-1 text-lg font-black text-[#6b3141]">{slot.hasSave ? `Lv ${slot.level ?? 1}` : 'Vazio'}</div>
                                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#8a5a57]">{slot.classId ?? 'sem classe'}</div>
                                            <div className="mt-2 text-xs text-[#7f5b56]">{formatSaveDate(slot.savedAt)}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                <button
                                    onClick={handleContinueFromSave}
                                    disabled={!canContinueSelectedSlot}
                                    className="flex-1 rounded-[16px] border-b-4 border-[#4f2430] bg-[#6b3141] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    Continuar slot selecionado
                                </button>
                                <button
                                    onClick={handleNewGameFromSlot}
                                    className="flex-1 rounded-[16px] border-b-4 border-[#8d6a55] bg-[#b98562] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition-all hover:brightness-105"
                                >
                                    Novo jogo neste slot
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full h-screen bg-[#ead6c2] overflow-hidden select-none">
                <ClassSelectionScreen
                    classes={PLAYER_CLASSES}
                    selectedClassId={selectedStartingClassId}
                    onSelect={setSelectedStartingClassId}
                    onConfirm={startGame}
                />
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
                                playerAnimationAction={resolvedGameState === GameState.TAVERN
                                    ? menuHeroAction
                                    : playerAnimationAction === 'idle' && resolvedGameState === GameState.BATTLE
                                        ? 'battle-idle'
                                        : playerAnimationAction === 'defend-hit' || playerAnimationAction === 'evade'
                                            ? playerAnimationAction
                                            : player.isDefending ? 'defend' : playerAnimationAction}
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
                        levelUpCardCategory={levelUpCardCategory}
                        stage={stage}
                        playerClassId={player.classId}
                        isDungeonRun={Boolean(dungeonRun)}
                        playerState={player}
                        enemyState={enemy}
                        isArCameraMode={isArCameraOpen}
                        isMenuView={resolvedGameState === GameState.TAVERN}
                        menuCameraFocus={shouldMenuCameraFocus}
                        isDungeonScene={sceneRegion === 'dungeon'}
                    />
            </SceneErrorBoundary>

            <ARModeOverlay
                isOpen={isArOverlayOpen}
                entryPoint={arEntryPoint}
                arSupport={arSupport}
                onClose={handleCloseAr}
                onStartAr={handleStartArExperience}
                onOpenFallback3D={handleOpenFallback3D}
            />

            <ARCameraFallbackOverlay
                isOpen={isArCameraOpen}
                entryPoint={arEntryPoint}
                onClose={handleCloseCameraFallback}
                onFallback3D={handleOpenFallback3D}
            />

            <ARFallback3DOverlay
                isOpen={isArFallback3DOpen}
                entryPoint={arEntryPoint}
                onClose={handleCloseFallback3D}
            />

            {isWebXrRoutingOpen && (
                <div className="absolute inset-0 z-[77] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto">
                    <div className="w-full max-w-md rounded-2xl border border-[#cfab91] bg-[#f7ecdd] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                        <h3 className="text-xl font-black text-[#6b3141]">Rota WebXR selecionada</h3>
                        <p className="mt-2 text-sm text-[#7f5b56]">
                            Este dispositivo suportou immersive-ar. A etapa seguinte e acoplar a sessao XR no renderer para AR real de batalha.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button onClick={handleCloseWebXrRouting} className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-3 py-2 text-xs font-black text-[#6b3141]">
                                Fechar
                            </button>
                            <button onClick={handleOpenFallback3D} className="rounded-xl bg-[#4d7a96] px-3 py-2 text-xs font-black text-white">
                                Usar fallback 3D
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {resolvedGameState === GameState.MENU && <MenuScreen onStart={startGame} />}
      
                        {resolvedGameState === GameState.TAVERN && showTavernUi && !isArFallback3DOpen && !isArCameraOpen && (
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
            onOpenAr={() => handleOpenAr('tavern')}
            arSupport={arSupport}
            shopItems={ALL_ITEMS}
            autoOpenConstellationToken={openConstellationToken}
            onEquipItem={equipItem}
            onUseItem={handleUseItem}
            onUnlockTalent={handleUnlockTalent}
                        campIntroOnly={isCampIntroRestricted}
                        restrictProfileToStatusOnly={isProfileStatusOnly}
                        inventoryUnlocked={isInventoryUnlocked}
                        inventoryUnlockPromptActive={onboardingPhase === 'inventory_prompt'}
                        onAcknowledgeInventoryUnlock={() => setOnboardingPhase('inventory_unlocked')}
                        cardsUnlockPromptActive={false}
                        onAcknowledgeCardsUnlock={() => setOnboardingPhase('cards_unlocked')}
                        skillsUnlockPromptActive={skillsUnlockPromptPending}
                        onAcknowledgeSkillsUnlock={() => {
                            setSkillsUnlockPromptPending(false);
                        }}
                        constellationUnlockPromptActive={constellationUnlockPromptPending}
                        onAcknowledgeConstellationUnlock={() => {
                            setConstellationUnlockPromptPending(false);
                        }}
                        allowCardsInProfile={isCardsUnlocked}
                        fleeUnlocked={isFleeUnlocked}
                        merchantUnlockPromptActive={onboardingPhase === 'merchant_prompt'}
                        onAcknowledgeMerchantUnlock={() => setOnboardingPhase('merchant_unlocked')}
                        merchantUnlocked={isMerchantUnlocked}
                        dungeonUnlocked={isDungeonUnlocked}
                        showSkillsAction={isSkillsActionUnlocked}
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
            onEquip={equipItem}
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

    {resolvedGameState === GameState.BATTLE && !isArFallback3DOpen && !isArCameraOpen && (
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
            onUnlockTalent={handleUnlockTalent}
            onStartBattle={(isBoss) => enterBattle(isBoss)}
            onEnterShop={() => {}} // Disabled in battle
            onBuyItem={buyItem}
            onSellItem={sellItem}
            onEquipItem={equipItem}
            onContinue={() => {}}
            onFlee={handleFlee}
            onOpenAr={() => handleOpenAr('battle')}
            arSupport={arSupport}
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
                        restrictProfileToStatusOnly={isProfileStatusOnly}
                        limitBattleActionsToBasics={isFirstBattleActionRestricted}
                                                showItemsAction={isItemsActionUnlocked}
                                                showSkillsAction={isSkillsActionUnlocked}
                        inventoryUnlocked={isInventoryUnlocked}
                        inventoryUnlockPromptActive={onboardingPhase === 'inventory_prompt'}
                        onAcknowledgeInventoryUnlock={() => setOnboardingPhase('inventory_unlocked')}
                                                cardsUnlockPromptActive={onboardingPhase === 'cards_prompt'}
                                                onAcknowledgeCardsUnlock={() => setOnboardingPhase('cards_unlocked')}
                                                skillsUnlockPromptActive={skillsUnlockPromptPending}
                                                onAcknowledgeSkillsUnlock={() => {
                                                    setSkillsUnlockPromptPending(false);
                                                }}
                                                constellationUnlockPromptActive={constellationUnlockPromptPending}
                                                onAcknowledgeConstellationUnlock={() => {
                                                    setConstellationUnlockPromptPending(false);
                                                }}
                                                                                                itemsUnlockPromptActive={onboardingPhase === 'items_prompt'}
                                                                                                onAcknowledgeItemsUnlock={() => setOnboardingPhase('flee_prompt')}
                                                                                                fleeUnlockPromptActive={onboardingPhase === 'flee_prompt'}
                                                                                                onAcknowledgeFleeUnlock={() => setOnboardingPhase('flee_unlocked')}
                                                allowCardsInProfile={isCardsUnlocked}
                                                                                                fleeUnlocked={isFleeUnlocked}
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

                if (dungeonResult.outcome === 'defeat') {
                    respawnAtCamp();
                    return;
                }

                if (shouldOpenCards) {
                    setPostCardFlow('tavern');
                    openCardRewardQueue(player, queue);
                } else {
                    setGameState(GameState.TAVERN);
                }
            }}
        />
      )}

      {resolvedGameState === GameState.BOSS_VICTORY && bossVictoryContext && (
          <BossVictoryModal
              context={bossVictoryContext}
              narration={bossVictoryContext.mode === 'hunt' ? narration : undefined}
              onContinue={handleBossVictoryContinue}
              onExit={handleBossVictoryExit}
              onOpenConstellation={handleOpenConstellationFromBossModal}
          />
      )}

      {resolvedGameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(160,38,38,0.35),rgba(20,8,8,0.92)_45%,rgba(8,4,4,0.98)_100%)] p-4 pointer-events-auto">
              <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-[#b46d6d] bg-[#2a1414]/90 text-[#fce8e8] shadow-[0_30px_120px_rgba(80,20,20,0.55)] backdrop-blur-sm">
                  <div className="border-b border-[#8d4d4d] bg-[linear-gradient(135deg,#6b1f1f,#8f2d2d)] px-6 py-6 text-center sm:px-8">
                      <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f9dada]">
                          Derrota
                      </div>
                      <h1 className="mt-4 text-4xl font-black uppercase tracking-[0.08em] text-[#ffe2e2] sm:text-5xl">Voce perdeu</h1>
                      <p className="mt-2 text-sm font-semibold text-[#f3c3c3] sm:text-base">A batalha terminou, mas sua jornada continua.</p>
                  </div>

                  <div className="px-6 py-6 sm:px-8 sm:py-7">
                      <div className="rounded-2xl border border-[#8d4d4d] bg-[#3a1b1b]/70 px-5 py-4 text-center">
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d8a3a3]">Resumo</div>
                          <div className="mt-1 text-lg font-black text-[#ffe2e2]">Fase {stage}</div>
                          <p className="mt-2 text-sm text-[#e7b7b7]">HP e mana serao restaurados ao renascer no acampamento.</p>
                      </div>

                      <button
                          onClick={respawnAtCamp}
                          className="mt-5 w-full rounded-xl border border-[#d8a3a3] bg-[#f6dada] px-5 py-3 text-base font-black uppercase tracking-[0.14em] text-[#6b1f1f] transition-all hover:bg-[#ffe7e7]"
                      >
                          Renascer no acampamento
                      </button>
                  </div>
              </div>
          </div>
      )}

      {resourceUnlockModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] p-6 text-center shadow-[0_30px_90px_rgba(40,20,25,0.4)]">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Novo Recurso</div>
                  <h3 className="mt-2 text-2xl font-black text-[#6b3141]">Recurso da classe liberado</h3>
                  <p className="mt-3 text-sm text-[#7f5b56]">
                      Agora voce pode gerar e consumir <span className="font-black" style={{ color: resourceUnlockModal.color }}>{resourceUnlockModal.name}</span> em habilidades da classe.
                  </p>
                  <button
                      onClick={() => setResourceUnlockModal(null)}
                      className="mt-5 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
                  >
                      Entendi
                  </button>
              </div>
          </div>
      )}

      {lootResult && <KillLootOverlay loot={lootResult} />}
    </div>
  );
}

